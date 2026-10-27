import { applyMerge, GAMES, type RoomSnapshot } from "@glix/engine";
import { describe, expect, it, vi } from "vitest";
import { createManualClock } from "./clock.js";
import { applyAction, beginMatch, markReady, runTick, stepMatch } from "./match.js";
import { createRoom, createRuntime } from "./rooms.js";
import type { Connection, Player } from "./runtime.js";

/** İstemci gibi davranan sahte bağlantı: yamayı uygular, baseRev uyuşmazsa hata verir. */
function fakeConn() {
  const raw: string[] = [];
  const conn = {
    player: null,
    stage: null,
    lastSent: null,
    sentVer: -1,
    ip: "x",
    failedJoins: 0,
    close() {},
    send() {},
    sendRaw(text: string) {
      raw.push(text);
      const m = JSON.parse(text) as {
        type: string;
        snapshot?: RoomSnapshot;
        baseRev?: number;
        patch?: unknown;
      };
      if (m.type === "room") view.snapshot = m.snapshot ?? null;
      else if (m.type === "patch") {
        if (!view.snapshot || view.snapshot.rev !== m.baseRev) throw new Error("baseRev uyuşmuyor");
        view.snapshot = applyMerge(view.snapshot, m.patch) as RoomSnapshot;
      }
    },
  } as unknown as Connection;
  const view: { snapshot: RoomSnapshot | null } = { snapshot: null };
  return { conn, raw, view };
}

function setup(players = 3) {
  const clock = createManualClock();
  const rt = createRuntime(clock);
  const room = createRoom(rt);
  room.gameIds = ["butona-bas"];
  const conns = [];
  for (let i = 0; i < players; i++) {
    const c = fakeConn();
    const player: Player = {
      id: `p${i}`,
      nickname: `O${i}`,
      avatar: i,
      token: `t${i}`,
      score: 0,
      spectator: false,
      joinOrder: i,
      conn: c.conn,
      room,
      graceCancel: null,
      lobbyReady: false,
      lastReactAt: Number.NEGATIVE_INFINITY,
      lastRenameAt: Number.NEGATIVE_INFINITY,
      lastContinueAt: Number.NEGATIVE_INFINITY,
      hidden: false,
      push: null,
      lastPushAt: Number.NEGATIVE_INFINITY,
    };
    c.conn.player = player;
    room.players.set(player.id, player);
    if (i === 0) room.hostId = player.id;
    conns.push(c);
  }
  rt.rooms.set(room.code, room);
  return { clock, rt, room, conns };
}

function startPlaying({ clock, rt, room }: ReturnType<typeof setup>): void {
  beginMatch(rt, room);
  for (const id of room.players.keys()) markReady(room, id);
  stepMatch(rt, room);
  clock.advance(3100);
  runTick(rt);
  rt.broadcaster.flush(room);
  expect(room.phase).toBe("playing");
}

describe("yayın: gereksiz mesaj ve yama zinciri", () => {
  it("yalnız serverNow/rev değişiyorsa hiçbir bağlantıya mesaj gitmez", () => {
    const t = setup();
    t.rt.broadcaster.flush(t.room);
    const before = t.conns.map((c) => c.raw.length);
    expect(before.every((n) => n === 1)).toBe(true);
    t.clock.advance(500);
    t.rt.broadcaster.flush(t.room);
    t.clock.advance(500);
    t.rt.broadcaster.flush(t.room);
    expect(t.conns.map((c) => c.raw.length)).toEqual(before);
  });

  it("içerik değişince yama gider ve serverNow/rev güncellenir", () => {
    const t = setup();
    t.rt.broadcaster.flush(t.room);
    t.clock.advance(500);
    const p1 = t.room.players.get("p1");
    if (p1) p1.score = 5;
    t.rt.broadcaster.flush(t.room);
    for (const c of t.conns) {
      expect(c.raw).toHaveLength(2);
      expect(JSON.parse(c.raw[1] ?? "").type).toBe("patch");
      expect(c.view.snapshot?.players.find((p) => p.id === "p1")?.score).toBe(5);
      expect(c.view.snapshot?.serverNow).toBe(t.clock.now());
      expect(c.view.snapshot?.rev).toBe(t.room.rev);
    }
  });

  it("mesaj atlayan bağlantı sonraki yamayı kendi son rev'inden doğru uygular", () => {
    const t = setup();
    startPlaying(t);
    const [a, b, c] = t.conns;
    if (!a || !b || !c) throw new Error("bağlantı yok");
    const counts = () => t.conns.map((x) => x.raw.length);
    // yalnız p0 basar: yalnız p0'ın görünümü değişir (pressedThisWindow)
    const c0 = counts();
    applyAction(t.rt, t.room, "p0", { kind: "press" });
    t.clock.advance(60);
    t.rt.broadcaster.flush(t.room);
    expect(a.raw.length).toBe((c0[0] ?? 0) + 1);
    expect(b.raw.length).toBe(c0[1]);
    expect(c.raw.length).toBe(c0[2]);
    const staleRev = b.view.snapshot?.rev ?? 0;
    // pencere kapanır: herkesin skor görünümü değişir
    t.clock.advance(400);
    runTick(t.rt);
    t.rt.broadcaster.flush(t.room);
    expect(b.raw.length).toBe((c0[1] ?? 0) + 1);
    const last = JSON.parse(b.raw.at(-1) ?? "") as { baseRev: number; rev: number };
    expect(last.baseRev).toBe(staleRev);
    expect(last.rev).toBeGreaterThan(staleRev + 1);
    // her istemci aynasının sunucunun o oyuncu için tam hesapladığı snapshot ile birebir aynı olduğunu doğrula
    for (const [i, x] of t.conns.entries()) {
      const fresh = fakeConn();
      const player = t.room.players.get(`p${i}`) as Player;
      const oldConn = player.conn;
      player.conn = fresh.conn;
      t.rt.broadcaster.resync(t.room, player);
      player.conn = oldConn;
      const mirror = x.view.snapshot as RoomSnapshot;
      const full = fresh.view.snapshot as RoomSnapshot;
      expect({ ...mirror, rev: 0, serverNow: 0 }).toEqual({ ...full, rev: 0, serverNow: 0 });
    }
  });

  it("odaya yeni bağlanan (lastSent null) ilk mesajda tam room alır, diğerlerinin zinciri bozulmaz", () => {
    const t = setup(2);
    t.rt.broadcaster.flush(t.room);
    const late = fakeConn();
    const player: Player = {
      id: "p9",
      nickname: "Geç",
      avatar: 5,
      token: "t9",
      score: 0,
      spectator: false,
      joinOrder: 9,
      conn: late.conn,
      room: t.room,
      graceCancel: null,
      lobbyReady: false,
      lastReactAt: Number.NEGATIVE_INFINITY,
      lastRenameAt: Number.NEGATIVE_INFINITY,
      lastContinueAt: Number.NEGATIVE_INFINITY,
      hidden: false,
      push: null,
      lastPushAt: Number.NEGATIVE_INFINITY,
    };
    late.conn.player = player;
    t.room.players.set("p9", player);
    t.clock.advance(60);
    t.rt.broadcaster.flush(t.room);
    expect(JSON.parse(late.raw[0] ?? "").type).toBe("room");
    for (const c of t.conns) expect(c.view.snapshot?.players).toHaveLength(3);
    t.clock.advance(60);
    const p0 = t.room.players.get("p0");
    if (p0) p0.score = 2;
    t.rt.broadcaster.flush(t.room);
    for (const c of [...t.conns, late])
      expect(c.view.snapshot?.players.find((p) => p.id === "p0")?.score).toBe(2);
  });
});

describe("yayın: publicView oda başına bir kez", () => {
  it("flush başına publicView bir kez hesaplanır (bağlantı sayısından bağımsız)", () => {
    const t = setup(5);
    startPlaying(t);
    const game = GAMES["butona-bas"];
    if (!game) throw new Error("oyun yok");
    const spy = vi.spyOn(game, "publicView");
    try {
      for (let i = 0; i < 3; i++) {
        t.clock.advance(60);
        applyAction(t.rt, t.room, `p${i}`, { kind: "press" });
        t.rt.broadcaster.flush(t.room);
      }
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  it("yalnız bir oyuncunun özel görünümü değişince yalnız ona mesaj gider; herkese açık görünüm değişmez", () => {
    const t = setup(4);
    startPlaying(t);
    const before = t.conns.map((c) => c.raw.length);
    t.clock.advance(60);
    applyAction(t.rt, t.room, "p2", { kind: "press" });
    t.rt.broadcaster.flush(t.room);
    t.conns.forEach((c, i) => {
      expect(c.raw.length).toBe((before[i] ?? 0) + (i === 2 ? 1 : 0));
    });
    const msg = JSON.parse(t.conns[2]?.raw.at(-1) ?? "") as {
      patch: { match?: Record<string, unknown> };
    };
    expect(Object.keys(msg.patch.match ?? {})).toEqual(["view"]);
  });

  it("herkese açık görünüm değişince her bağlantı ortak yamayı alır, özel görünüm yamaya girmez", () => {
    const t = setup(3);
    startPlaying(t);
    t.clock.advance(100);
    applyAction(t.rt, t.room, "p0", { kind: "press" });
    applyAction(t.rt, t.room, "p1", { kind: "press" });
    t.rt.broadcaster.flush(t.room);
    const before = t.conns.map((c) => c.raw.length);
    t.clock.advance(400);
    runTick(t.rt);
    t.rt.broadcaster.flush(t.room);
    t.conns.forEach((c, i) => {
      expect(c.raw.length).toBe((before[i] ?? 0) + 1);
      const m = JSON.parse(c.raw.at(-1) ?? "") as { patch: { match: Record<string, unknown> } };
      expect(m.patch.match).toHaveProperty("publicView");
    });
    const first = t.conns[0]?.view.snapshot?.match?.publicView as { scores: Record<string, number> };
    expect(first.scores).toEqual({ p0: 1, p1: 1, p2: 0 });
    for (const c of t.conns) expect(c.view.snapshot?.match?.publicView).toEqual(first);
  });
});
