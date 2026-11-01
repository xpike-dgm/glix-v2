/**
 * Test ortamı botları (bots.ts): canlıda kapalılık, 1 insan + botlarla uçtan uca maçlar (sahte saat), hesap
 * tablolarına bot satırı yazılmaması, kopma/yeniden bağlanma, lobiye dönüş ve zamanlayıcı temizliği. Son blok bütün
 * oyunları hareketsiz bir insan + botlarla kilitlenmeden bitirir.
 */
import { applyMerge, GAMES, MAX_PLAYERS, type RoomSnapshot, type ServerMessage } from "@glix/engine";
import { BOTS } from "@glix/engine/testing";
import { describe, expect, it } from "vitest";
import type { AccountStatsRecorder } from "./accountStats.js";
import { botsOf } from "./bots.js";
import { createManualClock, type ManualClock } from "./clock.js";
import { handleClose, handleMessage } from "./handlers.js";
import { runTick, TICK_MS } from "./match.js";
import { createRuntime, deleteRoom, EMPTY_ROOM_MS, GRACE_MS } from "./rooms.js";
import type { Connection, Room, Runtime } from "./runtime.js";
import { create, join, until, useServer } from "./testkit.js";

interface Fake {
  conn: Connection;
  sent: ServerMessage[];
  snapshot: RoomSnapshot | null;
  errors(): string[];
}

function fake(account: { id: number; username: string } | null): Fake {
  const f: Fake = {
    sent: [],
    snapshot: null,
    errors: () => f.sent.flatMap((m) => (m.type === "error" ? [m.code] : [])),
    conn: null as unknown as Connection,
  };
  f.conn = {
    player: null,
    stage: null,
    lastSent: null,
    sentVer: -1,
    ip: "1.2.3.4",
    failedJoins: 0,
    account,
    close() {},
    send(msg: ServerMessage) {
      f.sent.push(msg);
    },
    sendRaw(text: string) {
      const m = JSON.parse(text) as { type: string; snapshot?: RoomSnapshot; patch?: unknown };
      if (m.type === "room" && m.snapshot) f.snapshot = m.snapshot;
      else if (m.type === "patch" && f.snapshot) f.snapshot = applyMerge(f.snapshot, m.patch) as RoomSnapshot;
    },
  };
  return f;
}

interface Rows {
  game: { accountId: number }[];
  match: { accountId: number }[];
}

function setup(botsEnabled = true): {
  clock: ManualClock;
  rt: Runtime;
  host: Fake;
  room: Room;
  rows: Rows;
} {
  const clock = createManualClock();
  const rt = createRuntime(clock);
  rt.botsEnabled = botsEnabled;
  // Hesap tablolarına gidecek satırlar (createAccountRecorder yalnız `rows`u yazar).
  const rows: Rows = { game: [], match: [] };
  const recorder: AccountStatsRecorder = {
    gameFinished: (r) => {
      rows.game.push(...r.rows);
    },
    matchFinished: (r) => {
      rows.match.push(...r.rows);
    },
  } as AccountStatsRecorder;
  rt.accountStats = recorder;
  const host = fake({ id: 77, username: "Sahip" });
  handleMessage(rt, host.conn, { type: "createRoom", nickname: "Sahip" });
  const room = [...rt.rooms.values()][0] as Room;
  return { clock, rt, host, room, rows };
}

/** Sunucu döngüsü gibi: saat TICK_MS ilerler, tick çalışır. `done` true olunca ya da süre bitince durur. */
function run(clock: ManualClock, rt: Runtime, done: () => boolean, maxMs: number): number {
  const start = clock.now();
  while (!done() && clock.now() - start < maxMs) {
    clock.advance(TICK_MS);
    runTick(rt);
  }
  return clock.now() - start;
}

function botActions(rt: Runtime, gameId: string, botIds: readonly string[]): number {
  const log = [...rt.recentLogs].reverse().find((l) => l.gameId === gameId);
  return log ? log.actions.filter((a) => botIds.includes(a.playerId)).length : 0;
}

describe("botlar: canlıda kapalı", () => {
  it("botsEnabled false iken ekleme/doldurma reddedilir, oda değişmez, anlık görüntüde bot izni yok", () => {
    const { clock, rt, host, room } = setup(false);
    for (const type of ["addBot", "fillBots", "clearBots"] as const) handleMessage(rt, host.conn, { type });
    handleMessage(rt, host.conn, { type: "removeBot", playerId: "x" });
    expect(host.errors()).toEqual([
      "invalid_message",
      "invalid_message",
      "invalid_message",
      "invalid_message",
    ]);
    expect(room.players.size).toBe(1);
    clock.advance(200);
    expect(host.snapshot?.bots).toBeUndefined();
    expect(host.snapshot?.players.some((p) => p.bot)).toBe(false);
  });
});

describe("botlar: canlı sunucu (GLIX_ORTAM boş)", () => {
  useServer();
  it("WebSocket üzerinden addBot reddedilir; görüntüde bot düğmesi bayrağı yok", async () => {
    const host = await create("Sahip");
    host.send({ type: "addBot" });
    await until(() => host.lastError?.code === "invalid_message", "ret");
    expect(host.room.players).toHaveLength(1);
    expect(host.room.bots).toBeUndefined();
  });
});

describe("botlar: test sunucusu (GLIX_ORTAM=test)", () => {
  useServer({ ortam: "test" });
  it("host bot ekler, doldurur, çıkarır; misafir ekleyemez; bot hazır olur", async () => {
    const host = await create("Sahip");
    expect(host.room.bots).toBe(true);
    host.send({ type: "addBot" });
    await until(() => host.room.players.length === 2, "bot geldi");
    const bot = host.room.players.find((p) => p.bot);
    expect(bot?.connected).toBe(true);
    const guest = await join(host.session.roomCode, "Misafir");
    guest.send({ type: "addBot" });
    await until(() => guest.lastError?.code === "not_host", "misafir host değil");
    host.send({ type: "fillBots" });
    await until(() => host.room.players.length === MAX_PLAYERS, "dolu");
    host.send({ type: "addBot" });
    await until(() => host.lastError?.code === "room_full", "oda dolu");
    host.send({ type: "removeBot", playerId: bot?.id ?? "" });
    await until(() => host.room.players.length === MAX_PLAYERS - 1, "bot çıktı");
    // Bot ev sahibi olamaz.
    const other = host.room.players.find((p) => p.bot);
    host.send({ type: "transferHost", playerId: other?.id ?? "" });
    await until(() => host.lastError?.code === "not_in_room", "devir reddi");
    // Botlar kendiliğinden "Hazırım" der.
    await until(
      () => host.room.players.filter((p) => p.bot).every((p) => host.room.lobbyReady.includes(p.id)),
      "botlar hazır",
    );
    host.send({ type: "clearBots" });
    await until(() => host.room.players.length === 2, "botlar gitti");
  });
});

describe("botlar: 1 insan + 3 bot ile maç", () => {
  it("tepki, yazı, oylama ve çizim oyunu (kart aşamasıyla) uçtan uca biter; hesap satırı yalnız insana", () => {
    const { clock, rt, host, room, rows } = setup();
    const games = ["butona-bas", "yazi-yaz", "sozluk-blofu", "karalama-defteri"];
    handleMessage(rt, host.conn, { type: "setGames", gameIds: games });
    for (let i = 0; i < 3; i++) handleMessage(rt, host.conn, { type: "addBot" });
    expect(room.players.size).toBe(4);
    const botIds = botsOf(room).map((p) => p.id);
    run(clock, rt, () => botIds.every((id) => room.players.get(id)?.lobbyReady), 10_000);
    handleMessage(rt, host.conn, { type: "startMatch" });
    expect(room.phase).toBe("briefing");
    let sawCards = false;
    // İnsan da hızlıca hazır/devam der (sahibin gerçek kullanımı); oyunda hiçbir eylem yapmaz.
    run(
      clock,
      rt,
      () => {
        if (room.phase === "cards") sawCards = true;
        if (room.phase === "briefing") handleMessage(rt, host.conn, { type: "ready" });
        return room.phase === "final";
      },
      30 * 60_000,
    );
    expect(room.phase).toBe("final");
    expect(sawCards).toBe(true);
    for (const id of games) expect(botActions(rt, id, botIds), id).toBeGreaterThan(0);
    expect(rt.recentLogs.map((l) => l.gameId)).toEqual(games);
    // Hesap tablolarına yalnız insanın satırı gider: oyun başına 1, maç için 1.
    expect(rows.game.map((r) => r.accountId)).toEqual(games.map(() => 77));
    expect(rows.match.map((r) => r.accountId)).toEqual([77]);
    // Lobiye dönüş: botlar kalır, yeniden hazır olur, ikinci maç başlar.
    handleMessage(rt, host.conn, { type: "returnToLobby" });
    expect(room.phase).toBe("lobby");
    run(clock, rt, () => botIds.every((id) => room.players.get(id)?.lobbyReady), 10_000);
    expect(botsOf(room)).toHaveLength(3);
    handleMessage(rt, host.conn, { type: "setGames", gameIds: ["butona-bas"] });
    handleMessage(rt, host.conn, { type: "startMatch" });
    run(clock, rt, () => room.phase === "final", 10 * 60_000);
    expect(room.phase).toBe("final");
    expect(host.errors()).toEqual([]);
  });

  it("insan kopar ve döner: botlar oynamayı sürdürür, maç biter", () => {
    const { clock, rt, host, room } = setup();
    handleMessage(rt, host.conn, { type: "setGames", gameIds: ["cagrisim-agi"] });
    handleMessage(rt, host.conn, { type: "fillBots" });
    expect(room.players.size).toBe(MAX_PLAYERS);
    handleMessage(rt, host.conn, { type: "startMatch" });
    run(clock, rt, () => room.phase === "playing", 60_000);
    const token = (host.sent.find((m) => m.type === "session") as { token: string }).token;
    handleClose(rt, host.conn);
    run(clock, rt, () => false, 10_000);
    expect(room.phase).toBe("playing");
    const back = fake({ id: 77, username: "Sahip" });
    handleMessage(rt, back.conn, { type: "resume", token });
    expect(back.sent.some((m) => m.type === "session")).toBe(true);
    run(clock, rt, () => room.phase === "final", 10 * 60_000);
    expect(room.phase).toBe("final");
    expect(room.hostId).toBe(back.conn.player?.id);
  });

  it("son insan gidince botlar çıkar, oda silinir, hiç zamanlayıcı kalmaz", () => {
    const { clock, rt, host, room } = setup();
    handleMessage(rt, host.conn, { type: "setGames", gameIds: ["kendim"] });
    handleMessage(rt, host.conn, { type: "fillBots" });
    handleMessage(rt, host.conn, { type: "startMatch" });
    run(clock, rt, () => room.phase === "playing", 60_000);
    // İnsan kopar; bekleme süresi dolunca çıkarılır ve botlar da onunla gider.
    handleClose(rt, host.conn);
    run(clock, rt, () => room.players.size === 0, GRACE_MS + 5_000);
    expect(room.players.size).toBe(0);
    expect(room.phase).toBe("lobby");
    clock.advance(EMPTY_ROOM_MS + 1_000);
    runTick(rt);
    expect(rt.rooms.size).toBe(0);
    expect(clock.pending()).toBe(0);
  });

  it("oda kapanınca (deleteRoom) bot zamanlayıcıları iptal edilir", () => {
    const { clock, rt, host, room } = setup();
    handleMessage(rt, host.conn, { type: "setGames", gameIds: ["butona-bas"] });
    handleMessage(rt, host.conn, { type: "fillBots" });
    handleMessage(rt, host.conn, { type: "startMatch" });
    run(clock, rt, () => room.phase === "playing", 60_000);
    const bots = botsOf(room).map((p) => p.bot as unknown as { pending: boolean });
    expect(bots.some((b) => b.pending)).toBe(true);
    deleteRoom(rt, room);
    expect(bots.every((b) => !b.pending)).toBe(true);
    expect(clock.pending()).toBe(0);
  });
});

describe("botlar: bütün oyunlar hareketsiz insan + botlarla kilitlenmeden biter", () => {
  const ids = Object.keys(GAMES);
  it("her oyunun bir bot stratejisi var", () => {
    expect(ids.filter((id) => !BOTS[id])).toEqual([]);
  });
  for (const id of ids) {
    it(id, () => {
      const { clock, rt, host, room } = setup();
      handleMessage(rt, host.conn, { type: "setGames", gameIds: [id] });
      const game = GAMES[id];
      const total = Math.min(game?.maxPlayers ?? 4, Math.max(4, game?.minPlayers ?? 4));
      for (let i = 1; i < total; i++) handleMessage(rt, host.conn, { type: "addBot" });
      handleMessage(rt, host.conn, { type: "startMatch" });
      expect(room.phase).toBe("briefing");
      const botIds = botsOf(room).map((p) => p.id);
      run(clock, rt, () => room.phase === "final", 20 * 60_000);
      expect(room.phase, `${id} bitmedi`).toBe("final");
      // Botlar gerçekten oynadı: kabul edilen en az bir bot eylemi kayıtta.
      expect(botActions(rt, id, botIds), `${id}: bot eylemi yok`).toBeGreaterThan(0);
      expect(rt.recentLogs.at(-1)?.gameId).toBe(id);
      expect(host.errors()).toEqual([]);
    });
  }
});
