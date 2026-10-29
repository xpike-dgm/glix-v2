// GLIX v2 gerçekçi yük testi. Önce `pnpm build` çalıştırılmış olmalı.
//
// Kullanım: node scripts/load.mjs [--ROOMS=50 --PLAYERS=4-8 ...]   (ya da `pnpm load -- --rooms=50`)
// Her seçenek aynı adlı ortam değişkeniyle de verilebilir. Bayraklar (varsayılan):
//   URL=ws://127.0.0.1:3900/ws   ORIGIN=   (boşsa URL'nin http kaynağı; kayıt ucu için Origin==Host gerekir)
//   ROOMS=20                     oda sayısı
//   PLAYERS=4-8                  oda başına oyuncu ("6" ya da "4-8" aralığı; oda başına rastgele)
//   GAMES=mix                    "mix" (kısa oyun havuzu), "all" ya da virgüllü oyun kimlikleri
//   GAME_COUNT=3                 maç başına oyun sayısı (havuzdan odaya göre döndürülür)
//   MATCHES=1                    oda başına maç (maç sonunda returnToLobby)
//   DURATION_S=0                 >0 ise ramp bittikten sonra bu kadar sn ölç, sonra kes (yarım maçlar hata sayılmaz)
//   RAMP_MS=10000                odaların açılış süresi
//   THINK_MS=500-2000            oyun içi insan benzeri eylem aralığı (butona-bas: PRESS_HZ)
//   PRESS_HZ=3                   Butona Bas basış hızı
//   READY_MS=1000-4000           "Hazırım"/"Devam" gecikmesi
//   STAGES=1                     oda başına TV/sahne bağlantısı
//   SPECTATORS=1                 maç başladıktan sonra odaya giren izleyici (oda 8 kişiyi aşmaz)
//   REACT_PER_MIN=6              lobi/sonuç/final aşamasında oyuncu başına emoji
//   RECONNECT_PER_MIN=0.5        oyuncu başına dakikada kopup `resume` ile dönen bağlantı
//   ACCOUNT_RATIO=0.5            hesaplı oyuncu oranı (host hep hesaplı; oda kurmak hesap ister)
//   ACCOUNTS_FILE=/yol/hesap.json  kayıtlı hesap/çerez önbelleği (yoksa kayıt ucundan üretilir; sunucu aynı DB ile açık kalmalı)
//   HTTP_AT_END=1                maç sonunda hesaplı oyuncular /api/shop, quests, profile, leaderboard çağırır
//   WORKERS=1                    yük üretecini N sürece böler (tek süreç ~600+ bota yetmez)
//   HEALTH_URL=                  (varsayılan http://host/health?detail=1)
//   PROBE_FILE=                  scripts/load-probe.mjs çıktısı; adım penceresi özetlenir (cpu, rss, gecikme, SQLite)
//   OUT=/yol/sonuc.json          tam JSON raporu dosyaya da yazılır
//   MAX_P95_MS=50                geçti/kaldı eşiği (eylem RTT p95)
//   ROOM_TIMEOUT_MS              oda zaman aşımı (varsayılan 400000 * MATCHES)
//   DEFLATE=1                    istemci perMessageDeflate
// Sunucu: TRUST_PROXY=1 ile açılmalı (her bot `X-Forwarded-For` ile ayrı IP gibi görünür; üretimdeki Caddy düzeni).
// Yayındaki sunucuya KARŞI ÇALIŞTIRILMAZ; yerel/geçici sunucu ve geçici hesap DB'si kullanın.
import { fork } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import WebSocket from "ws";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = resolve(ROOT, "packages/engine/dist/index.js");
const TESTING = resolve(ROOT, "packages/engine/dist/testing/index.js");
if (!existsSync(ENGINE) || !existsSync(TESTING)) {
  console.error("packages/engine/dist bulunamadı. Önce `pnpm build` çalıştırın.");
  process.exit(2);
}
const { applyMerge, createRng, GAMES } = await import(pathToFileURL(ENGINE).href);
const { BOTS } = await import(pathToFileURL(TESTING).href);

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
const range = (name, def) => {
  const s = String(opt(name, def));
  const m = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/.exec(s);
  if (!m) {
    console.error(`${name} geçersiz aralık`);
    process.exit(2);
  }
  const lo = Number(m[1]);
  return [lo, m[2] ? Number(m[2]) : lo];
};

const URL_WS = String(opt("URL", "ws://127.0.0.1:3900/ws"));
const HTTP_BASE = (() => {
  const u = new URL(URL_WS);
  u.protocol = u.protocol === "wss:" ? "https:" : "http:";
  u.pathname = "";
  u.search = "";
  return u.origin;
})();
const ORIGIN = opt("ORIGIN", "") || HTTP_BASE;
const ROOMS = Math.max(1, Math.floor(num("ROOMS", 20)));
const [PLAYERS_LO, PLAYERS_HI] = range("PLAYERS", "4-8");
const GAME_COUNT = Math.max(1, Math.floor(num("GAME_COUNT", 3)));
const MATCHES = Math.max(1, Math.floor(num("MATCHES", 1)));
const DURATION_S = num("DURATION_S", 0);
const RAMP_MS = num("RAMP_MS", 10000);
const [THINK_LO, THINK_HI] = range("THINK_MS", "500-2000");
const [READY_LO, READY_HI] = range("READY_MS", "1000-4000");
const PRESS_HZ = Math.max(0.1, num("PRESS_HZ", 3));
const STAGES = Math.floor(num("STAGES", 1));
const SPECTATORS = Math.floor(num("SPECTATORS", 1));
const REACT_PER_MIN = num("REACT_PER_MIN", 6);
const RECONNECT_PER_MIN = num("RECONNECT_PER_MIN", 0.5);
const ACCOUNT_RATIO = Math.min(1, num("ACCOUNT_RATIO", 0.5));
const ACCOUNTS_FILE = opt("ACCOUNTS_FILE", "");
const HTTP_AT_END = opt("HTTP_AT_END", "1") !== "0";
const WORKERS = Math.max(1, Math.floor(num("WORKERS", 1)));
const MAX_P95_MS = num("MAX_P95_MS", 50);
const ROOM_TIMEOUT_MS = num("ROOM_TIMEOUT_MS", 400000 * MATCHES);
const DEFLATE = opt("DEFLATE", "") === "1";
const HEALTH_URL = opt("HEALTH_URL", "") || `${HTTP_BASE}/health?detail=1`;
const PROBE_FILE = opt("PROBE_FILE", "");
const OUT = opt("OUT", "");
const ROOM_BASE = Math.floor(num("ROOM_BASE", 0)); // alt süreçlerde oda numarası kayması
const ROOMS_LOCAL = Math.floor(num("ROOMS_LOCAL", ROOMS));
const IS_CHILD = process.env.LOAD_CHILD === "1";

const MIX = [
  "butona-bas",
  "son-kisi",
  "acgozluluk-limiti",
  "capraz-ates",
  "kor-kronometre",
  "gizli-hirsiz",
  "cagrisim-agi",
  "cizgiyi-gecme",
  "ortalamanin-yarisi",
  "gizli-alisveris",
  "kor-bomba",
  "zehirli-kadeh",
];
const GAME_POOL = (() => {
  const g = String(opt("GAMES", "mix"));
  const list = g === "mix" ? MIX : g === "all" ? Object.keys(GAMES) : g.split(",");
  for (const id of list) {
    if (!GAMES[id] || !BOTS[id]) {
      console.error(`Bilinmeyen oyun: ${id}`);
      process.exit(2);
    }
  }
  return list;
})();
const EMOJIS = ["👋", "😂", "🔥", "😱", "👏", "❤️"];

// ---- Sayaçlar --------------------------------------------------------------------------------
const lat = { action: [], ping: [], broadcast: [], broadcastAny: [], reaction: [], resume: [] };
const http = {}; // uç -> { lat: [], status: {} }
const rejected = {};
const errorsByCode = {};
const totals = {
  roomMsgs: 0,
  roomBytes: 0,
  patchMsgs: 0,
  patchBytes: 0,
  stageMsgs: 0,
  stageBytes: 0,
  resyncs: 0,
  unexpectedCloses: 0,
  connectFailures: 0,
  reconnects: 0,
  reconnectFailures: 0,
  playerSeconds: 0,
  matchesDone: 0,
  gamesPlayed: 0,
  actionsSent: 0,
  reactionsSent: 0,
};
const bots = [];
const rooms = [];
let accountPool = [];

const bump = (obj, key) => {
  obj[key] = (obj[key] ?? 0) + 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (lo, hi) => lo + Math.random() * (hi - lo);

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

// ---- Hesaplar --------------------------------------------------------------------------------
let ipCounter = 0;
const fakeIp = () => {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};

async function registerAccount(i) {
  const username = `yuk${i}`;
  const res = await fetch(`${HTTP_BASE}/api/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-forwarded-for": `172.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`,
    },
    body: JSON.stringify({ username, email: `${username}@example.com`, password: "yuk-test-parola-1" }),
  });
  if (res.status === 409) {
    // Önbellek kayıp ama hesap var: giriş yap.
    const login = await fetch(`${HTTP_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": `172.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`,
      },
      body: JSON.stringify({ login: username, password: "yuk-test-parola-1" }),
    });
    return cookieOf(login, username);
  }
  return cookieOf(res, username);
}
function cookieOf(res, username) {
  if (!res.ok) throw new Error(`kayıt/giriş başarısız (${res.status}) ${username}`);
  const sc = res.headers.getSetCookie?.() ?? [];
  const sess = sc.map((c) => c.split(";")[0]).find((c) => c.startsWith("glix_sess="));
  if (!sess) throw new Error("oturum çerezi yok");
  return { username, cookie: sess };
}
async function ensureAccounts(n) {
  let pool = [];
  if (ACCOUNTS_FILE && existsSync(ACCOUNTS_FILE)) {
    try {
      pool = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
    } catch {
      pool = [];
    }
  }
  const t0 = performance.now();
  let next = pool.length;
  const need = n - pool.length;
  if (need > 0) {
    console.log(`${need} hesap kaydediliyor...`);
    const workers = Array.from({ length: 6 }, async () => {
      while (next < n) {
        const i = next++;
        pool[i] = await registerAccount(i);
      }
    });
    await Promise.all(workers);
    if (ACCOUNTS_FILE) writeFileSync(ACCOUNTS_FILE, JSON.stringify(pool));
    console.log(`hesaplar hazır (${Math.round(performance.now() - t0)} ms)`);
  }
  return pool.slice(0, n);
}

// ---- Bot -------------------------------------------------------------------------------------
class Bot {
  /** kind: player | spectator | stage */
  constructor(room, index, kind, account) {
    this.room = room;
    this.index = index;
    this.kind = kind;
    this.account = account ?? null;
    this.isHost = index === 0 && kind === "player";
    this.nick = `Y${room.id}_${index}`.slice(0, 16);
    this.ip = fakeIp();
    this.ws = null;
    this.snap = null;
    this.rev = -1;
    this.needResync = false;
    this.closing = false;
    this.seq = 0;
    this.sent = new Map();
    this.token = null;
    this.thinkTimer = null;
    this.pingTimer = null;
    this.reactTimer = null;
    this.reconnectTimer = null;
    this.readySentFor = -1;
    this.continueSentFor = -1;
    this.finalHttpFor = -1;
    this.rng = createRng((room.id * 7919 + index * 104729 + 12345) >>> 0);
    this.connectedAt = 0;
    this.resumeAt = 0;
    this.stats = { roomMsgs: 0, roomBytes: 0, patchMsgs: 0, patchBytes: 0, resyncs: 0 };
    bots.push(this);
  }

  headers() {
    const h = { "x-forwarded-for": this.ip };
    if (this.account) h.cookie = this.account.cookie;
    return h;
  }

  connect() {
    return new Promise((resolveConn) => {
      const ws = new WebSocket(URL_WS, {
        origin: ORIGIN,
        perMessageDeflate: DEFLATE,
        handshakeTimeout: 15000,
        headers: this.headers(),
      });
      this.ws = ws;
      let opened = false;
      ws.on("open", () => {
        opened = true;
        this.connectedAt = performance.now();
        this.send({ type: "hello", clientVersion: "load-test" });
        this.pingTimer = setInterval(() => this.send({ type: "ping", t: performance.now() }), 5000);
        if (RECONNECT_PER_MIN > 0 && this.kind === "player") this.armReconnect();
        resolveConn(true);
      });
      ws.on("message", (data, isBinary) => this.onMessage(data, isBinary));
      ws.on("error", (err) => {
        if (!opened) {
          if (this.resumeAt) totals.reconnectFailures++;
          else {
            totals.connectFailures++;
            this.room.fail(`bağlantı kurulamadı: ${err.message}`);
          }
          resolveConn(false);
        }
      });
      ws.on("close", () => {
        this.accountTime();
        this.stopTimers();
        if (!this.closing && !this.reconnecting) {
          totals.unexpectedCloses++;
          this.room.fail(`beklenmeyen kapanış (bot ${this.index})`);
        }
        if (!opened) resolveConn(false);
      });
    });
  }

  accountTime() {
    if (this.connectedAt) {
      totals.playerSeconds += (performance.now() - this.connectedAt) / 1000;
      this.connectedAt = 0;
    }
  }

  stopTimers() {
    clearInterval(this.pingTimer);
    clearTimeout(this.thinkTimer);
    clearTimeout(this.reactTimer);
    clearTimeout(this.reconnectTimer);
    this.thinkTimer = this.reactTimer = this.reconnectTimer = null;
  }

  close() {
    this.closing = true;
    this.stopTimers();
    try {
      this.ws?.close();
    } catch {
      /* yok say */
    }
  }

  send(msg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  armReconnect() {
    const mean = 60000 / RECONNECT_PER_MIN;
    this.reconnectTimer = setTimeout(() => this.dropAndResume(), -Math.log(1 - Math.random()) * mean);
  }

  async dropAndResume() {
    if (this.room.done || this.closing) return;
    if (!this.token || !this.snap || this.snap.phase === "lobby") {
      this.armReconnect();
      return;
    }
    this.reconnecting = true;
    totals.reconnects++;
    const old = this.ws;
    this.stopTimers();
    this.accountTime();
    old?.terminate();
    this.snap = null;
    this.rev = -1;
    this.needResync = false;
    this.sent.clear();
    await sleep(between(500, 3000));
    if (this.room.done) return;
    this.resumeAt = performance.now();
    const ok = await this.connect();
    this.reconnecting = false;
    if (ok) this.send({ type: "resume", token: this.token });
    else this.armReconnect();
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
      case "session":
        this.token = msg.token;
        break;
      case "stage":
        break;
      case "room":
        this.countSnap(size, true);
        this.snap = msg.snapshot;
        this.rev = msg.snapshot.rev;
        this.needResync = false;
        this.afterSnapshot();
        break;
      case "patch":
        this.countSnap(size, false);
        if (this.needResync) break;
        if (this.snap === null || msg.baseRev !== this.rev) {
          this.needResync = true;
          this.stats.resyncs++;
          this.send({ type: "resync" });
          break;
        }
        this.snap = applyMerge(this.snap, msg.patch);
        this.rev = msg.rev;
        this.afterSnapshot();
        break;
      case "actionAck": {
        const t0 = this.sent.get(msg.seq);
        if (t0 !== undefined) {
          this.sent.delete(msg.seq);
          if (msg.ok) {
            lat.action.push(performance.now() - t0);
            this.room.actionAccepted(this, t0);
          } else bump(rejected, msg.reason ?? "unknown");
        }
        break;
      }
      case "reaction":
        this.room.reactionSeen(this, msg.playerId);
        break;
      case "pong":
        if (typeof msg.t === "number") lat.ping.push(performance.now() - msg.t);
        break;
      case "error":
        bump(errorsByCode, msg.code);
        if (this.room.phase === "setup" || !["rate_limited", "wrong_phase"].includes(msg.code)) {
          if (msg.code !== "resume_failed") this.room.fail(`sunucu hatası: ${msg.code}`);
        }
        break;
      case "left":
        if (!this.closing) this.room.fail(`odadan çıkarıldı: ${msg.reason}`);
        break;
      default:
        break;
    }
  }

  countSnap(size, full) {
    if (this.kind === "stage") {
      totals.stageMsgs++;
      totals.stageBytes += size;
    } else if (full) {
      this.stats.roomMsgs++;
      this.stats.roomBytes += size;
    } else {
      this.stats.patchMsgs++;
      this.stats.patchBytes += size;
    }
    if (this.resumeAt && full) {
      lat.resume.push(performance.now() - this.resumeAt);
      this.resumeAt = 0;
    }
    this.room.snapshotSeen(this);
  }

  afterSnapshot() {
    const s = this.snap;
    if (!s || this.room.done || this.kind === "stage") {
      return;
    }
    const m = s.match;
    const phase = s.phase;
    if (this.kind === "player") {
      const isPart = m?.participants?.includes(s.selfId);
      if (phase === "playing" && isPart) this.scheduleThink();
      else this.cancelThink();
      if (phase === "briefing" && isPart && this.readySentFor !== m.round) {
        this.readySentFor = m.round;
        setTimeout(() => this.send({ type: "ready" }), between(READY_LO, READY_HI));
      }
      if (phase === "results" && isPart && this.continueSentFor !== m.round) {
        this.continueSentFor = m.round;
        totals.gamesPlayed += this.isHost ? 1 : 0;
        setTimeout(() => this.send({ type: "continue" }), between(READY_LO, READY_HI));
      }
      if (phase === "final" && this.finalHttpFor !== this.room.matchNo) {
        this.finalHttpFor = this.room.matchNo;
        if (this.account && HTTP_AT_END) setTimeout(() => this.httpBurst(), between(200, 1500));
      }
    }
    if (REACT_PER_MIN > 0 && this.reactTimer === null && ["lobby", "results", "final"].includes(phase)) {
      this.reactTimer = setTimeout(
        () => {
          this.reactTimer = null;
          const ph = this.snap?.phase;
          if (ph === "lobby" || ph === "results" || ph === "final") {
            this.reactSentAt = performance.now();
            this.room.reactionSent(this);
            totals.reactionsSent++;
            this.send({ type: "react", emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] });
          }
          this.afterSnapshot();
        },
        -Math.log(1 - Math.random()) * (60000 / REACT_PER_MIN) + 750,
      );
    }
    if (this.isHost) this.room.hostReact(this, s);
  }

  cancelThink() {
    clearTimeout(this.thinkTimer);
    this.thinkTimer = null;
    if (this.sent.size > 64) this.sent.clear();
  }

  scheduleThink() {
    if (this.thinkTimer !== null) return;
    const gameId = this.snap?.match?.gameId;
    const delay =
      gameId === "butona-bas" ? (1000 / PRESS_HZ) * (0.6 + Math.random() * 0.8) : between(THINK_LO, THINK_HI);
    this.thinkTimer = setTimeout(() => {
      this.thinkTimer = null;
      this.act();
    }, delay);
  }

  act() {
    const s = this.snap;
    if (!s || this.room.done || s.phase !== "playing" || !s.match) return;
    const m = s.match;
    const bot = BOTS[m.gameId];
    if (!bot) return;
    const connected = m.participants.filter((id) => s.players.find((p) => p.id === id)?.connected !== false);
    let payload;
    try {
      payload = bot.generate(this.rng, s.selfId, m.publicView, m.view, connected);
    } catch {
      payload = undefined;
    }
    if (payload !== undefined && payload !== null) {
      const seq = this.seq++;
      const t0 = performance.now();
      this.sent.set(seq, t0);
      totals.actionsSent++;
      this.send({ type: "action", seq, payload });
    }
    this.scheduleThink();
  }

  async httpBurst() {
    const calls = [
      ["shop", "/api/shop"],
      ["quests", "/api/quests"],
      ["profile", "/api/profile"],
      ["leaderboard", "/api/leaderboard?period=week&metric=wins"],
      ["leaderboardGames", "/api/leaderboard/games?period=week"],
    ];
    for (const [name, path] of calls) {
      const t0 = performance.now();
      let status = 0;
      try {
        const res = await fetch(`${HTTP_BASE}${path}`, {
          headers: { cookie: this.account.cookie, "x-forwarded-for": this.ip },
          signal: AbortSignal.timeout(10000),
        });
        await res.text();
        status = res.status;
      } catch {
        status = -1;
      }
      http[name] ??= { lat: [], status: {} };
      const e = http[name];
      e.lat.push(performance.now() - t0);
      bump(e.status, status);
    }
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
    this.truncated = false;
    this.reason = null;
    this.started = 0;
    this.finals = 0;
    this.matchNo = 0;
    this.t0 = 0;
    this.elapsedMs = 0;
    this.timer = null;
    this.code = null;
    this.target = 4 + (Math.floor(Math.random() * 1000) % 1);
    this.target = Math.round(between(PLAYERS_LO, PLAYERS_HI));
    this.spectatorsJoined = false;
    this.pending = null; // yayın gecikmesi örneği
    this.reactPending = new Map(); // gönderen botun dizini -> t0
    this.lastBcastSample = 0;
    this.resolveDone = null;
    this.finished = new Promise((r) => {
      this.resolveDone = r;
    });
  }

  fail(reason) {
    this.finish(false, reason);
  }

  finish(ok, reason, truncated = false) {
    if (this.done) return;
    this.done = true;
    this.ok = ok;
    this.truncated = truncated;
    this.reason = ok ? null : reason;
    this.elapsedMs = performance.now() - this.t0;
    clearTimeout(this.timer);
    for (const b of this.bots) b.close();
    this.resolveDone();
  }

  // Yayın gecikmesi: bir eylem kabul edilince (ack ok), diğer botların o andan sonraki ilk anlık görüntüsü.
  actionAccepted(from, t0) {
    const now = performance.now();
    if (this.pending || now - this.lastBcastSample < 400) return;
    this.lastBcastSample = now;
    this.pending = { from, t0, seen: new Set(), game: from.snap?.match?.gameId };
  }

  snapshotSeen(bot) {
    const p = this.pending;
    if (!p || bot === p.from || bot.kind === "stage" || p.seen.has(bot)) return;
    p.seen.add(bot);
    const d = performance.now() - p.t0;
    // Butona Bas'ta her kabul edilen basış herkese açık görünümü değiştirir: temiz yayın gecikmesi. Diğer oyunlarda
    // eylem yalnız gönderene özel görünümü değiştirebilir; ilk anlık görüntü başka bir nedenden gelir (üst sınır).
    if (p.game === "butona-bas" && d < 1000) lat.broadcast.push(d);
    lat.broadcastAny.push(d);
    if (p.seen.size >= 2 || performance.now() - p.t0 > 2000) this.pending = null;
  }

  reactionSent(bot) {
    this.reactPending.set(bot.index, performance.now());
  }

  reactionSeen(bot, fromPlayerId) {
    const sender = this.bots.find((b) => b.snap?.selfId === fromPlayerId);
    if (!sender || sender === bot) return;
    const t0 = this.reactPending.get(sender.index);
    if (t0 !== undefined) lat.reaction.push(performance.now() - t0);
  }

  pickGames() {
    const out = [];
    for (let i = 0; i < GAME_COUNT; i++) {
      const id = GAME_POOL[(this.id * 5 + this.matchNo * GAME_COUNT + i) % GAME_POOL.length];
      const g = GAMES[id];
      if (this.target >= g.minPlayers && !out.includes(id)) out.push(id);
    }
    return out.length ? out : ["butona-bas"];
  }

  hostReact(host, s) {
    if (s.phase === "lobby") {
      const connected = s.players.filter((p) => p.connected).length;
      if (this.started === this.finals && s.players.length === this.target && connected === this.target) {
        this.started++;
        this.matchNo = this.started - 1;
        this.phase = "running";
        host.send({ type: "setGames", gameIds: this.pickGames() });
        setTimeout(() => host.send({ type: "startMatch" }), between(300, 1200));
        this.spawnSpectators();
      }
    } else if (s.phase === "final") {
      if (this.finals < this.started) {
        this.finals++;
        totals.matchesDone++;
        if (this.finals >= MATCHES) setTimeout(() => this.finish(true), 4000);
        else setTimeout(() => host.send({ type: "returnToLobby" }), between(2000, 5000));
      }
    }
  }

  spawnSpectators() {
    const n = Math.min(SPECTATORS, 8 - this.target);
    for (let i = 0; i < n; i++) {
      setTimeout(
        async () => {
          if (this.done) return;
          const b = new Bot(this, 100 + i, "spectator", null);
          this.bots.push(b);
          if (await b.connect()) b.send({ type: "joinRoom", code: this.code, nickname: b.nick });
        },
        between(3000, 15000),
      );
    }
  }

  async run(accounts) {
    this.t0 = performance.now();
    this.timer = setTimeout(() => this.fail(`zaman aşımı (${ROOM_TIMEOUT_MS} ms)`), ROOM_TIMEOUT_MS);
    const acc = (i) => (i === 0 || Math.random() < ACCOUNT_RATIO ? accounts.take() : null);
    const host = new Bot(this, 0, "player", acc(0));
    this.bots.push(host);
    if (!(await host.connect())) return;
    host.send({ type: "createRoom", nickname: host.nick });
    const code = await this.waitForCode(host);
    if (code === null) return;
    this.code = code;
    if (STAGES > 0) {
      const st = new Bot(this, 200, "stage", null);
      this.bots.push(st);
      st.connect().then((ok) => ok && st.send({ type: "joinStage", code }));
    }
    for (let i = 1; i < this.target; i++) {
      const b = new Bot(this, i, "player", acc(i));
      this.bots.push(b);
      b.connect().then((ok) => {
        if (ok) b.send({ type: "joinRoom", code, nickname: b.nick });
      });
      await sleep(30);
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

// ---- Sağlık ve prob örneklemesi ---------------------------------------------------------------
const health = {
  samples: 0,
  failures: 0,
  maxTickMsP95: 0,
  maxMemoryRssMb: 0,
  maxBytesOutPerSec: 0,
  avgBytesOutPerSecSteady: 0,
  maxActiveMatches: 0,
  maxRooms: 0,
  maxPlayers: 0,
  histStart: null,
  histEnd: null,
  steady: false,
  steadyBytes: [],
};
async function sampleHealth() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2500) });
    const h = await res.json();
    health.samples++;
    health.maxTickMsP95 = Math.max(health.maxTickMsP95, Number(h.tickMsP95) || 0);
    health.maxMemoryRssMb = Math.max(health.maxMemoryRssMb, Number(h.memoryRssMb) || 0);
    health.maxBytesOutPerSec = Math.max(health.maxBytesOutPerSec, Number(h.bytesOutPerSec) || 0);
    health.maxActiveMatches = Math.max(health.maxActiveMatches, Number(h.activeMatches) || 0);
    health.maxRooms = Math.max(health.maxRooms, Number(h.rooms) || 0);
    health.maxPlayers = Math.max(health.maxPlayers, Number(h.players) || 0);
    if (health.steady) health.steadyBytes.push(Number(h.bytesOutPerSec) || 0);
    if (h.tickHistogram) {
      if (health.steady && !health.histStart) health.histStart = h.tickHistogram;
      health.histEnd = h.tickHistogram;
    }
  } catch {
    health.failures++;
  }
}

function histPercentiles(a, b) {
  if (!a || !b) return null;
  const counts = b.counts.map((c, i) => c - (a.counts[i] ?? 0));
  const total = counts.reduce((x, y) => x + y, 0);
  if (total === 0) return null;
  const edges = [...b.edgesMs, Number.POSITIVE_INFINITY];
  const at = (p) => {
    let acc = 0;
    for (let i = 0; i < counts.length; i++) {
      acc += counts[i];
      if (acc >= p * total) return edges[i];
    }
    return edges.at(-1);
  };
  return {
    ticks: total,
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    maxMsSinceBoot: b.maxMs,
    note: "kova üst sınırı (ms)",
  };
}

function probeSummary(fromMs, toMs) {
  if (!PROBE_FILE || !existsSync(PROBE_FILE)) return null;
  const lines = readFileSync(PROBE_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((l) => l.t >= fromMs && l.t <= toMs);
  if (lines.length === 0) return null;
  const avg = (k) => lines.reduce((a, l) => a + l[k], 0) / lines.length;
  const mx = (k) => Math.max(...lines.map((l) => l[k]));
  const r = (x) => Math.round(x * 100) / 100;
  const sqlN = lines.reduce((a, l) => a + l.sql.n, 0);
  const worst = lines.reduce((a, l) => (l.sql.max > a.sql.max ? l : a), lines[0]);
  return {
    seconds: lines.length,
    cpuPctAvg: r(avg("cpuPct")),
    cpuPctMax: r(mx("cpuPct")),
    rssMbMax: r(mx("rssMb")),
    heapMbMax: r(mx("heapMb")),
    eluAvg: r(avg("elu")),
    eluMax: r(mx("elu")),
    lagP50MsAvg: r(avg("lagP50")),
    lagP99MsMax: r(mx("lagP99")),
    lagMaxMs: r(mx("lagMax")),
    sql: {
      calls: sqlN,
      p99MsMax: r(Math.max(...lines.map((l) => l.sql.p99))),
      maxMs: r(worst.sql.max),
      worstSql: worst.sql.worstSql,
      busiestSecondTotalMs: r(Math.max(...lines.map((l) => l.sql.totalMs))),
    },
  };
}

// ---- Rapor -----------------------------------------------------------------------------------
function collect() {
  for (const b of bots) {
    totals.roomMsgs += b.stats.roomMsgs;
    totals.roomBytes += b.stats.roomBytes;
    totals.patchMsgs += b.stats.patchMsgs;
    totals.patchBytes += b.stats.patchBytes;
    totals.resyncs += b.stats.resyncs;
    b.accountTime();
  }
  return {
    lat,
    http,
    rejected,
    errorsByCode,
    totals,
    bots: bots.length,
    rooms: rooms.map((r) => ({
      id: r.id,
      ok: r.ok,
      truncated: r.truncated,
      reason: r.reason,
      elapsedMs: r.elapsedMs,
    })),
    cpu: process.cpuUsage(),
  };
}

function merge(parts) {
  const out = {
    lat: { action: [], ping: [], broadcast: [], broadcastAny: [], reaction: [], resume: [] },
    http: {},
    rejected: {},
    errorsByCode: {},
    totals: {},
    bots: 0,
    rooms: [],
    cpuMs: 0,
  };
  for (const p of parts) {
    for (const k of Object.keys(out.lat)) out.lat[k].push(...p.lat[k]);
    for (const [k, v] of Object.entries(p.http)) {
      out.http[k] ??= { lat: [], status: {} };
      const e = out.http[k];
      e.lat.push(...v.lat);
      for (const [s, c] of Object.entries(v.status)) e.status[s] = (e.status[s] ?? 0) + c;
    }
    for (const [k, v] of Object.entries(p.rejected)) out.rejected[k] = (out.rejected[k] ?? 0) + v;
    for (const [k, v] of Object.entries(p.errorsByCode)) out.errorsByCode[k] = (out.errorsByCode[k] ?? 0) + v;
    for (const [k, v] of Object.entries(p.totals)) out.totals[k] = (out.totals[k] ?? 0) + v;
    out.bots += p.bots;
    out.rooms.push(...p.rooms);
    out.cpuMs += (p.cpu.user + p.cpu.system) / 1000;
  }
  return out;
}

function buildReport(m, wallMs, steady) {
  const n = Math.max(1, m.totals.playerSeconds);
  const t = m.totals;
  const failed = m.rooms.filter((r) => !r.ok);
  const completed = m.rooms.filter((r) => r.ok && !r.truncated);
  const truncated = m.rooms.filter((r) => r.ok && r.truncated);
  const times = completed.map((r) => r.elapsedMs / 1000);
  const playerMsgs = t.roomMsgs + t.patchMsgs;
  const playerBytes = t.roomBytes + t.patchBytes;
  const httpOut = {};
  for (const [k, v] of Object.entries(m.http)) httpOut[k] = { ...summarize(v.lat), status: v.status };
  return {
    config: {
      URL_WS,
      ROOMS,
      PLAYERS: `${PLAYERS_LO}-${PLAYERS_HI}`,
      GAMES: GAME_POOL.join(","),
      GAME_COUNT,
      MATCHES,
      DURATION_S,
      RAMP_MS,
      STAGES,
      SPECTATORS,
      REACT_PER_MIN,
      RECONNECT_PER_MIN,
      ACCOUNT_RATIO,
      WORKERS,
    },
    wallSeconds: Math.round(wallMs / 100) / 10,
    bots: m.bots,
    generatorCpuSeconds: Math.round(m.cpuMs / 100) / 10,
    actionLatencyMs: {
      ...summarize(m.lat.action),
      rejectedByReason: m.rejected,
      rejectedTotal: Object.values(m.rejected).reduce((a, b) => a + b, 0),
    },
    broadcastLatencyMs: summarize(m.lat.broadcast),
    broadcastLatencyAnyGameMs: summarize(m.lat.broadcastAny),
    reactionLatencyMs: summarize(m.lat.reaction),
    resumeToSnapshotMs: summarize(m.lat.resume),
    pingRttMs: (({ p50, p95, count }) => ({ p50, p95, count }))(summarize(m.lat.ping)),
    perPlayer: {
      msgsPerSec: Math.round((playerMsgs / n) * 100) / 100,
      bytesPerSec: Math.round(playerBytes / n),
      avgMsgBytes: Math.round(playerBytes / Math.max(1, playerMsgs)),
      fullRoomMsgs: t.roomMsgs,
      patchMsgs: t.patchMsgs,
      playerSeconds: Math.round(t.playerSeconds),
    },
    stages: { msgs: t.stageMsgs, bytes: t.stageBytes },
    counts: {
      actionsSent: t.actionsSent,
      reactionsSent: t.reactionsSent,
      reconnects: t.reconnects,
      reconnectFailures: t.reconnectFailures,
      resyncs: t.resyncs,
      matchesDone: t.matchesDone,
      errorsByCode: m.errorsByCode,
      unexpectedCloses: t.unexpectedCloses,
      connectFailures: t.connectFailures,
    },
    http: httpOut,
    rooms: {
      total: m.rooms.length,
      completed: completed.length,
      truncatedOk: truncated.length,
      failed: failed.length,
      failures: failed.slice(0, 10).map((r) => ({ room: r.id, reason: r.reason })),
      completeSeconds: {
        p50: pct(Float64Array.from(times).sort(), 50),
        max: times.length ? Math.round(Math.max(...times) * 10) / 10 : null,
      },
    },
    server: {
      health: {
        samples: health.samples,
        failures: health.failures,
        maxRooms: health.maxRooms,
        maxPlayers: health.maxPlayers,
        maxActiveMatches: health.maxActiveMatches,
        maxRssMb: health.maxMemoryRssMb,
        maxTickMsP95Window: health.maxTickMsP95,
        bytesOutPerSecAvgSteady: Math.round(
          health.steadyBytes.reduce((a, b) => a + b, 0) / Math.max(1, health.steadyBytes.length),
        ),
        bytesOutPerSecMax: health.maxBytesOutPerSec,
      },
      tickMs: histPercentiles(health.histStart, health.histEnd),
      probe: probeSummary(steady.from, steady.to),
    },
  };
}

function printSummary(r, verdict) {
  const L = r.actionLatencyMs;
  const f = (x) => (x === null || x === undefined ? "-" : x);
  console.log("");
  console.log("=== GLIX yük testi özeti ===");
  console.log(
    `süre ${r.wallSeconds} sn | bot ${r.bots} | oda ${r.rooms.completed}+${r.rooms.truncatedOk} yarım/${r.rooms.total}, ${r.rooms.failed} başarısız | maç ${r.counts.matchesDone}`,
  );
  console.log(
    `eylem RTT ms: p50 ${f(L.p50)} p95 ${f(L.p95)} p99 ${f(L.p99)} max ${f(L.max)} (n=${L.count}, reddedilen ${L.rejectedTotal} ${JSON.stringify(L.rejectedByReason)})`,
  );
  const B = r.broadcastLatencyMs;
  console.log(
    `yayın gecikmesi (butona-bas) ms: p50 ${f(B.p50)} p95 ${f(B.p95)} p99 ${f(B.p99)} (n=${B.count})`,
  );
  const R = r.reactionLatencyMs;
  console.log(`emoji gecikmesi ms: p50 ${f(R.p50)} p95 ${f(R.p95)} p99 ${f(R.p99)} (n=${R.count})`);
  console.log(
    `oyuncu başına: ${r.perPlayer.msgsPerSec} mesaj/sn, ${r.perPlayer.bytesPerSec} B/sn (ort. mesaj ${r.perPlayer.avgMsgBytes} B)`,
  );
  console.log(
    `resync ${r.counts.resyncs} | kopma-dönüş ${r.counts.reconnects} (başarısız ${r.counts.reconnectFailures}) | hata ${JSON.stringify(r.counts.errorsByCode)} | beklenmeyen kapanış ${r.counts.unexpectedCloses}`,
  );
  for (const [k, v] of Object.entries(r.http))
    console.log(
      `  http ${k}: p50 ${f(v.p50)} p95 ${f(v.p95)} max ${f(v.max)} n=${v.count} ${JSON.stringify(v.status)}`,
    );
  console.log(`sunucu tick: ${JSON.stringify(r.server.tickMs)}`);
  console.log(`sunucu sağlık: ${JSON.stringify(r.server.health)}`);
  console.log(`sunucu prob: ${JSON.stringify(r.server.probe)}`);
  console.log(`üreteç CPU ${r.generatorCpuSeconds} sn`);
  for (const x of r.rooms.failures) console.log(`  başarısız oda ${x.room}: ${x.reason}`);
  console.log(verdict.ok ? "SONUÇ: GEÇTI" : `SONUÇ: KALDI (${verdict.reasons.join("; ")})`);
}

// ---- Çalıştır --------------------------------------------------------------------------------
function makeAccountTaker(pool) {
  let i = 0;
  return {
    take() {
      if (pool.length === 0) return null;
      return pool[i++ % pool.length];
    },
  };
}

async function runLocal(startIndex, count, pool) {
  const taker = makeAccountTaker(pool);
  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
    for (const r of rooms) r.fail("kesildi (SIGINT)");
  });
  const runs = [];
  for (let i = 0; i < count; i++) {
    const room = new Room(startIndex + i + 1);
    rooms.push(room);
    runs.push(room.run(taker));
    if (count > 1 && RAMP_MS > 0) await sleep(RAMP_MS / count / (WORKERS > 1 ? 1 : 1));
    if (interrupted) break;
  }
  if (DURATION_S > 0) {
    await sleep(DURATION_S * 1000);
    for (const r of rooms) r.finish(!r.done ? true : r.ok, r.reason, true);
  }
  await Promise.all(runs);
  await Promise.all(rooms.map((r) => r.finished));
}

async function main() {
  const needAccounts = Math.ceil(ROOMS * PLAYERS_HI * ACCOUNT_RATIO) + ROOMS + 10;
  if (IS_CHILD) {
    const pool = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8"));
    // Her alt süreç havuzun kendi dilimini kullanır (aynı hesap iki odada olmasın).
    const slice = pool.filter((_, i) => i % WORKERS === ROOM_BASE_INDEX);
    await runLocal(ROOM_BASE, ROOMS_LOCAL, slice);
    // Büyük IPC mesajı çıkıştan önce tamamen yazılmalı.
    process.send({ type: "result", data: collect() }, () => process.exit(0));
    return;
  }

  console.log(
    `Yük testi: ${ROOMS} oda x ${PLAYERS_LO}-${PLAYERS_HI} oyuncu, ${GAME_COUNT} oyun/maç, ${MATCHES} maç, ${WORKERS} süreç, ${URL_WS}`,
  );
  accountPool = await ensureAccounts(needAccounts);
  if (WORKERS > 1 && !ACCOUNTS_FILE) {
    console.error("WORKERS>1 için ACCOUNTS_FILE gerekli");
    process.exit(2);
  }
  const start = performance.now();
  const healthTimer = setInterval(sampleHealth, 1000);
  await sampleHealth();
  const steady = { from: Date.now() + RAMP_MS, to: 0 };
  setTimeout(() => {
    health.steady = true;
  }, RAMP_MS);

  let merged;
  if (WORKERS === 1) {
    await runLocal(0, ROOMS, accountPool);
    merged = merge([collect()]);
  } else {
    const per = Math.ceil(ROOMS / WORKERS);
    const jobs = [];
    for (let w = 0; w < WORKERS; w++) {
      const local = Math.min(per, ROOMS - w * per);
      if (local <= 0) break;
      jobs.push(
        new Promise((res, rej) => {
          const child = fork(fileURLToPath(import.meta.url), process.argv.slice(2), {
            env: {
              ...process.env,
              LOAD_CHILD: "1",
              ROOM_BASE: String(w * per),
              ROOMS_LOCAL: String(local),
              ROOM_BASE_INDEX: String(w),
            },
          });
          child.on("message", (m) => m?.type === "result" && res(m.data));
          child.on("exit", (code) => code !== 0 && rej(new Error(`alt süreç ${w} çıktı: ${code}`)));
        }),
      );
    }
    merged = merge(await Promise.all(jobs));
  }
  steady.to = Date.now();
  await sampleHealth();
  clearInterval(healthTimer);
  await sleep(1200);

  const wallMs = performance.now() - start;
  const report = buildReport(merged, wallMs, steady);
  const reasons = [];
  if (report.rooms.failed > 0) reasons.push(`${report.rooms.failed} oda başarısız`);
  const p95 = report.actionLatencyMs.p95;
  if (p95 === null) reasons.push("hiç eylem ölçülemedi");
  else if (p95 > MAX_P95_MS) reasons.push(`eylem p95 ${p95} ms > ${MAX_P95_MS} ms`);
  const verdict = { ok: reasons.length === 0, reasons };
  if (OUT) writeFileSync(OUT, JSON.stringify({ ...report, verdict }, null, 1));
  printSummary(report, verdict);
  process.exit(verdict.ok ? 0 : 1);
}

const ROOM_BASE_INDEX = Math.floor(num("ROOM_BASE_INDEX", 0));

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
