// GLIX v2 yayın CPU mikro-ölçümü (`pnpm test` parçası değildir). Önce `pnpm build` gerekir.
// Kullanım: node scripts/bench-broadcast.mjs [ROOMS=200] [PLAYERS=8] [STEPS=600]
// N oda × 8 bağlantıyı Butona Bas oynarken 50 ms'lik adımlarla yayınlar (sahte saat, gerçek ağ yok);
// oda-yayını başına µs, saniyede mesaj ve bayt (oyun saniyesi başına) basar.
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { createManualClock } = await load("apps/server/dist/clock.js");
const { createRuntime, createRoom } = await load("apps/server/dist/rooms.js");
const { beginMatch, markReady, stepMatch, applyAction, runTick } = await load("apps/server/dist/match.js");
const { applyMerge } = await load("packages/engine/dist/index.js");

const env = (k, d) => Number(process.env[k] ?? d);
const ROOMS = env("ROOMS", 200);
const PLAYERS = env("PLAYERS", 8);
const STEPS = env("STEPS", 600);
const STEP_MS = env("STEP_MS", 50);
const PRESSES = env("PRESSES", 1); // oda başına adım başına basış (~oyuncu başı 2,5 Hz)

const clock = createManualClock();
const rt = createRuntime(clock, ROOMS + 10, 1e9);
let messages = 0;
let bytes = 0;
const rooms = [];
for (let r = 0; r < ROOMS; r++) {
  const room = createRoom(rt);
  room.gameIds = ["butona-bas"];
  const ids = [];
  for (let i = 0; i < PLAYERS; i++) {
    const id = `p${r}_${i}`;
    ids.push(id);
    const mirrored = r === 0;
    const conn = {
      player: null,
      lastSent: null,
      sentVer: -1,
      ip: "x",
      failedJoins: 0,
      close() {},
      send() {},
    };
    conn.sendRaw = (t) => {
      messages++;
      bytes += t.length;
      if (mirrored) conn.mirror = parse(conn, t); // yalnız ilk oda istemci gibi doğrulanır
    };
    const player = {
      id,
      nickname: `Oyuncu${i}`,
      avatar: i,
      token: id,
      score: 0,
      joinOrder: i,
      conn,
      room,
      graceCancel: null,
    };
    conn.player = player;
    room.players.set(id, player);
    if (i === 0) room.hostId = id;
  }
  rt.rooms.set(room.code, room);
  beginMatch(rt, room);
  for (const id of ids) markReady(room, id);
  rooms.push({ room, ids });
}
// istemci aynası: her yamanın doğru uygulandığını doğrular
function parse(conn, t) {
  const m = JSON.parse(t);
  if (m.type === "room") return m.snapshot;
  if (m.type === "patch") {
    if (!conn.mirror || conn.mirror.rev !== m.baseRev) throw new Error("baseRev uyuşmazlığı");
    return applyMerge(conn.mirror, m.patch);
  }
  return conn.mirror;
}
for (const { room } of rooms) stepMatch(rt, room);
clock.advance(3100);
runTick(rt);
for (const { room } of rooms) rt.broadcaster.flush(room);
if (rooms[0].room.phase !== "playing") throw new Error(`oyun başlamadı: ${rooms[0].room.phase}`);

messages = 0;
bytes = 0;
const t0 = performance.now();
for (let s = 0; s < STEPS; s++) {
  for (const { room, ids } of rooms) {
    for (let j = 0; j < PRESSES; j++)
      applyAction(rt, room, ids[(s * PRESSES + j) % ids.length], { kind: "press" });
  }
  clock.advance(STEP_MS);
  if (s % 2 === 1) runTick(rt);
}
const ms = performance.now() - t0;
// son durum: her bağlantının aynası sunucunun gönderdiği son snapshot ile tutarlı mı
for (const p of rooms[0].room.players.values())
  if (p.conn.mirror?.selfId !== p.id) throw new Error("ayna bozuk");
const sec = (STEPS * STEP_MS) / 1000;
const flushes = ROOMS * STEPS;
console.log(
  `rooms=${ROOMS}x${PLAYERS} steps=${STEPS}x${STEP_MS}ms  cpu/oda-adımı=${((ms * 1000) / flushes).toFixed(1)} µs  ` +
    `toplam=${ms.toFixed(0)} ms (${((ms / (sec * 1000)) * 100).toFixed(0)}% tek çekirdek)  ` +
    `mesaj/sn=${Math.round(messages / sec)}  bayt/sn=${Math.round(bytes / sec)}`,
);
