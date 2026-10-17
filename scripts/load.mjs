// GLIX v2 WebSocket yük testi. Önce `pnpm build` çalıştırılmış olmalı.
// Kullanım: pnpm load -- [--rooms=20 --players=8 --url=ws://127.0.0.1:3900/ws --origin=https://... ]
// Her seçenek aynı adlı ortam değişkeniyle de verilebilir (ROOMS, PLAYERS, URL, ORIGIN, RAMP_MS,
// PRESS_HZ, HEALTH_URL, MATCHES, MAX_P95_MS, ROOM_TIMEOUT_MS, DEFLATE=1).
// Tüm botlar tek IP'den bağlanır: büyük koşular, IP başına sınırları yükseltilmiş ayrı bir test
// sunucusuna karşı yapılır (MAX_SOCKETS_PER_IP vb. ortam değişkenleri); yayındaki sunucu değişmez.
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = resolve(ROOT, "packages/engine/dist/index.js");
if (!existsSync(ENGINE)) {
  console.error("packages/engine/dist/index.js bulunamadı. Önce `pnpm build` çalıştırın.");
  process.exit(2);
}
const { applyMerge } = await import(pathToFileURL(ENGINE).href);
if (typeof applyMerge !== "function") {
  console.error("Motor derlemesinde applyMerge yok. `pnpm build` ile yeniden derleyin.");
  process.exit(2);
}

// ---- Ayarlar ---------------------------------------------------------------------------------
const flags = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--") continue;
  const m = /^--([a-zA-Z_]+)(?:=(.*))?$/.exec(a);
  if (!m) {
    console.error(`Anlaşılmayan argüman: ${a}`);
    process.exit(2);
  }
  let val = m[2];
  if (val === undefined) {
    const next = process.argv[i + 1];
    val = next !== undefined && !next.startsWith("--") ? next : "1";
    if (val === next) i++;
  }
  flags[m[1].toUpperCase()] = val;
}
const opt = (name, def) => flags[name] ?? process.env[name] ?? def;
const num = (name, def) => {
  const v = Number(opt(name, def));
  if (!Number.isFinite(v) || v < 0) {
    console.error(`${name} geçersiz sayı`);
    process.exit(2);
  }
  return v;
};

const URL_WS = String(opt("URL", "ws://127.0.0.1:3900/ws"));
const ORIGIN = opt("ORIGIN", "") || undefined;
const ROOMS = Math.max(1, Math.floor(num("ROOMS", 20)));
const PLAYERS = Math.min(8, Math.max(2, Math.floor(num("PLAYERS", 8))));
const RAMP_MS = num("RAMP_MS", 10000);
const PRESS_HZ = Math.max(0.1, num("PRESS_HZ", 3));
const MATCHES = Math.max(1, Math.floor(num("MATCHES", 1)));
const MAX_P95_MS = num("MAX_P95_MS", 50);
const ROOM_TIMEOUT_MS = num("ROOM_TIMEOUT_MS", 150000 * MATCHES);
const DEFLATE = opt("DEFLATE", "") === "1";
const HEALTH_URL =
  opt("HEALTH_URL", "") ||
  (() => {
    const u = new URL(URL_WS);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    u.pathname = "/health";
    u.search = "";
    return u.href;
  })();
const GRID_MS = 300;

// ---- Sayaçlar --------------------------------------------------------------------------------
const actionLatencies = [];
const pingRtts = [];
const rejected = {};
const errorsByCode = {};
const totals = {
  roomMsgs: 0,
  roomBytes: 0,
  patchMsgs: 0,
  patchBytes: 0,
  resyncs: 0,
  unexpectedCloses: 0,
  connectFailures: 0,
};
const bots = [];
const rooms = [];

const bump = (obj, key) => {
  obj[key] = (obj[key] ?? 0) + 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pct(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}
function summarize(values) {
  const s = Float64Array.from(values).sort();
  return {
    count: s.length,
    p50: pct(s, 50),
    p95: pct(s, 95),
    p99: pct(s, 99),
    max: s.length ? Math.round(s[s.length - 1] * 100) / 100 : null,
  };
}

// ---- Bot -------------------------------------------------------------------------------------
class Bot {
  constructor(room, index, isHost) {
    this.room = room;
    this.index = index;
    this.isHost = isHost;
    this.nick = `Y${room.id}_${index}`.slice(0, 16);
    this.ws = null;
    this.snap = null;
    this.rev = -1;
    this.needResync = false;
    this.closing = false;
    this.seq = 0;
    this.sent = new Map();
    this.readySentFor = -1;
    this.pressTimer = null;
    this.pingTimer = null;
    this.sync = index % 2 === 0;
    this.stats = { roomMsgs: 0, roomBytes: 0, patchMsgs: 0, patchBytes: 0, resyncs: 0 };
    bots.push(this);
  }

  connect() {
    return new Promise((resolveConn) => {
      const ws = new WebSocket(URL_WS, {
        origin: ORIGIN,
        perMessageDeflate: DEFLATE,
        handshakeTimeout: 15000,
      });
      this.ws = ws;
      let opened = false;
      ws.on("open", () => {
        opened = true;
        this.send({ type: "hello", clientVersion: "load-test" });
        this.pingTimer = setInterval(() => this.send({ type: "ping", t: performance.now() }), 5000);
        resolveConn(true);
      });
      ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
      ws.on("error", (err) => {
        if (!opened) {
          totals.connectFailures++;
          this.room.fail(`bağlantı kurulamadı: ${err.message}`);
          resolveConn(false);
        }
      });
      ws.on("close", () => {
        this.cleanup();
        if (!this.closing) {
          totals.unexpectedCloses++;
          this.room.fail(`beklenmeyen kapanış (bot ${this.index})`);
        }
        if (!opened) resolveConn(false);
      });
    });
  }

  cleanup() {
    clearInterval(this.pingTimer);
    clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  close() {
    this.closing = true;
    this.cleanup();
    try {
      this.ws?.close();
    } catch {
      /* yok say */
    }
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  onMessage(data, isBinary) {
    if (isBinary) return;
    const text = typeof data === "string" ? data : data.toString("utf8");
    const size = typeof data === "string" ? Buffer.byteLength(data) : data.length;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      bump(errorsByCode, "client_bad_json");
      return;
    }
    switch (msg.type) {
      case "room":
        this.stats.roomMsgs++;
        this.stats.roomBytes += size;
        this.snap = msg.snapshot;
        this.rev = msg.snapshot.rev;
        this.needResync = false;
        this.react();
        break;
      case "patch":
        this.stats.patchMsgs++;
        this.stats.patchBytes += size;
        if (this.needResync) break;
        if (this.snap === null || msg.baseRev !== this.rev) {
          this.needResync = true;
          this.stats.resyncs++;
          this.send({ type: "resync" });
          break;
        }
        this.snap = applyMerge(this.snap, msg.patch);
        this.rev = msg.rev;
        this.react();
        break;
      case "actionAck": {
        const t0 = this.sent.get(msg.seq);
        if (t0 !== undefined) {
          this.sent.delete(msg.seq);
          if (msg.ok) actionLatencies.push(performance.now() - t0);
          else bump(rejected, msg.reason ?? "unknown");
        }
        break;
      }
      case "pong":
        if (typeof msg.t === "number") pingRtts.push(performance.now() - msg.t);
        break;
      case "error":
        bump(errorsByCode, msg.code);
        if (this.room.phase === "setup" || msg.code !== "rate_limited") {
          this.room.fail(`sunucu hatası: ${msg.code}`);
        }
        break;
      case "left":
        if (!this.closing) this.room.fail(`odadan çıkarıldı: ${msg.reason}`);
        break;
      default:
        break;
    }
  }

  react() {
    const s = this.snap;
    if (!s || this.room.done) return;
    const phase = s.phase;
    if (phase === "playing" && s.match?.participants?.includes(s.selfId)) this.startPressing();
    else this.stopPressing();

    if (phase === "briefing" && s.match) {
      if (this.readySentFor !== s.match.round && s.match.participants.includes(s.selfId)) {
        this.readySentFor = s.match.round;
        this.send({ type: "ready" });
      }
    }
    if (this.isHost) this.room.hostReact(this, s);
  }

  startPressing() {
    if (this.pressTimer !== null) return;
    const step = () => {
      this.pressTimer = null;
      if (this.room.done || this.snap?.phase !== "playing") return;
      const seq = this.seq++;
      this.sent.set(seq, performance.now());
      this.send({ type: "action", seq, payload: { kind: "press" } });
      this.pressTimer = setTimeout(step, this.nextDelay());
    };
    this.pressTimer = setTimeout(step, this.nextDelay());
  }

  stopPressing() {
    if (this.pressTimer !== null) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    if (this.sent.size > 0 && this.snap && this.snap.phase !== "playing") {
      // Cevabı gelmeyen eski eylemleri bellekte tutma.
      if (this.sent.size > 64) this.sent.clear();
    }
  }

  nextDelay() {
    const base = 1000 / PRESS_HZ;
    if (this.sync) {
      // Duvar saatinin 300 ms ızgarasına yakın bas: eşleşme (match) üretir.
      const target = Date.now() + base * 0.8;
      const next = Math.ceil(target / GRID_MS) * GRID_MS + Math.random() * 25;
      return Math.max(10, next - Date.now());
    }
    return base * (0.6 + Math.random() * 0.8);
  }
}

// ---- Oda -------------------------------------------------------------------------------------
class Room {
  constructor(id) {
    this.id = id;
    this.bots = [];
    this.phase = "setup"; // setup | running | finished
    this.done = false;
    this.ok = false;
    this.reason = null;
    this.started = 0;
    this.finals = 0;
    this.t0 = 0;
    this.elapsedMs = 0;
    this.timer = null;
    this.resolveDone = null;
    this.finished = new Promise((r) => {
      this.resolveDone = r;
    });
  }

  fail(reason) {
    this.finish(false, reason);
  }

  finish(ok, reason) {
    if (this.done) return;
    this.done = true;
    this.ok = ok;
    this.reason = ok ? null : reason;
    this.elapsedMs = performance.now() - this.t0;
    clearTimeout(this.timer);
    for (const b of this.bots) b.close();
    this.resolveDone();
  }

  hostReact(host, s) {
    if (s.phase === "lobby") {
      if (
        this.started === this.finals &&
        s.players.length === PLAYERS &&
        s.players.every((p) => p.connected)
      ) {
        this.started++;
        this.phase = "running";
        host.send({ type: "startMatch" });
      }
    } else if (s.phase === "final") {
      if (this.finals < this.started) {
        this.finals++;
        if (this.finals >= MATCHES) this.finish(true);
        else host.send({ type: "returnToLobby" });
      }
    }
  }

  async run() {
    this.t0 = performance.now();
    this.timer = setTimeout(() => this.fail(`zaman aşımı (${ROOM_TIMEOUT_MS} ms)`), ROOM_TIMEOUT_MS);
    const host = new Bot(this, 0, true);
    this.bots.push(host);
    if (!(await host.connect())) return;
    host.send({ type: "createRoom", nickname: host.nick });
    const code = await this.waitForCode(host);
    if (code === null) return;
    for (let i = 1; i < PLAYERS; i++) {
      const b = new Bot(this, i, false);
      this.bots.push(b);
      b.connect().then((ok) => {
        if (ok) b.send({ type: "joinRoom", code, nickname: b.nick });
      });
      if (this.done) return;
    }
  }

  async waitForCode(host) {
    while (!this.done) {
      if (host.snap?.code) return host.snap.code;
      await sleep(20);
    }
    return null;
  }
}

// ---- Sağlık örneklemesi ----------------------------------------------------------------------
const health = {
  samples: 0,
  failures: 0,
  maxTickMsP95: 0,
  maxMemoryRssMb: 0,
  maxBytesOutPerSec: 0,
  maxActiveMatches: 0,
};
let healthTimer = null;
async function sampleHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
    const h = await res.json();
    health.samples++;
    health.maxTickMsP95 = Math.max(health.maxTickMsP95, Number(h.tickMsP95) || 0);
    health.maxMemoryRssMb = Math.max(health.maxMemoryRssMb, Number(h.memoryRssMb) || 0);
    health.maxBytesOutPerSec = Math.max(health.maxBytesOutPerSec, Number(h.bytesOutPerSec) || 0);
    health.maxActiveMatches = Math.max(health.maxActiveMatches, Number(h.activeMatches) || 0);
  } catch {
    health.failures++;
  }
}

// ---- Rapor -----------------------------------------------------------------------------------
function buildReport(wallMs) {
  for (const b of bots) {
    totals.roomMsgs += b.stats.roomMsgs;
    totals.roomBytes += b.stats.roomBytes;
    totals.patchMsgs += b.stats.patchMsgs;
    totals.patchBytes += b.stats.patchBytes;
    totals.resyncs += b.stats.resyncs;
  }
  const n = Math.max(1, bots.length);
  const completed = rooms.filter((r) => r.done && r.ok);
  const failed = rooms.filter((r) => !r.ok);
  const times = completed.map((r) => r.elapsedMs / 1000);
  const action = summarize(actionLatencies);
  return {
    config: {
      URL_WS,
      ORIGIN: ORIGIN ?? null,
      ROOMS,
      PLAYERS,
      RAMP_MS,
      PRESS_HZ,
      MATCHES,
      MAX_P95_MS,
      HEALTH_URL,
    },
    wallSeconds: Math.round(wallMs / 100) / 10,
    bots: bots.length,
    actionLatencyMs: {
      ...action,
      rejectedByReason: rejected,
      rejectedTotal: Object.values(rejected).reduce((a, b) => a + b, 0),
    },
    pingRttMs: (({ p50, p95, count }) => ({ p50, p95, count }))(summarize(pingRtts)),
    messages: {
      room: {
        count: totals.roomMsgs,
        bytes: totals.roomBytes,
        perBotCount: Math.round(totals.roomMsgs / n),
        perBotBytes: Math.round(totals.roomBytes / n),
      },
      patch: {
        count: totals.patchMsgs,
        bytes: totals.patchBytes,
        perBotCount: Math.round(totals.patchMsgs / n),
        perBotBytes: Math.round(totals.patchBytes / n),
      },
      resyncs: totals.resyncs,
      errorsByCode,
      unexpectedCloses: totals.unexpectedCloses,
      connectFailures: totals.connectFailures,
    },
    rooms: {
      total: rooms.length,
      completed: completed.length,
      failed: failed.length,
      failures: failed.slice(0, 10).map((r) => ({ room: r.id, reason: r.reason })),
      completeSeconds: {
        p50: pct(Float64Array.from(times).sort(), 50),
        max: times.length ? Math.round(Math.max(...times) * 10) / 10 : null,
      },
    },
    health,
  };
}

function printSummary(r, verdict) {
  const L = r.actionLatencyMs;
  console.log("");
  console.log("=== GLIX yük testi özeti ===");
  console.log(
    `süre ${r.wallSeconds} sn | bot ${r.bots} | oda ${r.rooms.completed}/${r.rooms.total} tamam, ${r.rooms.failed} başarısız`,
  );
  console.log(
    `eylem gecikmesi ms: p50 ${L.p50} p95 ${L.p95} p99 ${L.p99} max ${L.max} (n=${L.count}, reddedilen ${L.rejectedTotal} ${JSON.stringify(L.rejectedByReason)})`,
  );
  console.log(`ping RTT ms: p50 ${r.pingRttMs.p50} p95 ${r.pingRttMs.p95} (n=${r.pingRttMs.count})`);
  const m = r.messages;
  console.log(
    `bot başına: room ${m.room.perBotCount} mesaj / ${m.room.perBotBytes} B, patch ${m.patch.perBotCount} mesaj / ${m.patch.perBotBytes} B`,
  );
  console.log(
    `resync ${m.resyncs} | hata kodları ${JSON.stringify(m.errorsByCode)} | beklenmeyen kapanış ${m.unexpectedCloses} | bağlantı hatası ${m.connectFailures}`,
  );
  console.log(`oda tamamlanma sn: p50 ${r.rooms.completeSeconds.p50} max ${r.rooms.completeSeconds.max}`);
  const h = r.health;
  console.log(
    `sağlık (${h.samples} örnek, ${h.failures} hata): tickMsP95 ${h.maxTickMsP95} | rss ${h.maxMemoryRssMb} MB | out ${h.maxBytesOutPerSec} B/sn | aktif maç ${h.maxActiveMatches}`,
  );
  for (const f of r.rooms.failures) console.log(`  başarısız oda ${f.room}: ${f.reason}`);
  console.log(verdict.ok ? "SONUÇ: GEÇTI" : `SONUÇ: KALDI (${verdict.reasons.join("; ")})`);
}

// ---- Çalıştır --------------------------------------------------------------------------------
async function main() {
  console.log(`Yük testi: ${ROOMS} oda x ${PLAYERS} oyuncu, ${MATCHES} maç, ${URL_WS}`);
  const start = performance.now();
  healthTimer = setInterval(sampleHealth, 2000);
  sampleHealth();
  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
    for (const r of rooms) r.fail("kesildi (SIGINT)");
  });

  const runs = [];
  for (let i = 0; i < ROOMS; i++) {
    const room = new Room(i + 1);
    rooms.push(room);
    runs.push(room.run());
    if (ROOMS > 1 && RAMP_MS > 0) await sleep(RAMP_MS / ROOMS);
    if (interrupted) break;
  }
  await Promise.all(runs);
  await Promise.all(rooms.map((r) => r.finished));
  clearInterval(healthTimer);
  await sampleHealth();
  await sleep(200);

  const report = buildReport(performance.now() - start);
  const reasons = [];
  if (report.rooms.failed > 0) reasons.push(`${report.rooms.failed} oda başarısız`);
  if (report.messages.unexpectedCloses > 0)
    reasons.push(`${report.messages.unexpectedCloses} beklenmeyen kapanış`);
  const p95 = report.actionLatencyMs.p95;
  if (p95 === null) reasons.push("hiç eylem ölçülemedi");
  else if (p95 > MAX_P95_MS) reasons.push(`eylem p95 ${p95} ms > ${MAX_P95_MS} ms`);
  const verdict = { ok: reasons.length === 0, reasons };
  console.log(JSON.stringify({ ...report, verdict }));
  printSummary(report, verdict);
  process.exit(verdict.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
