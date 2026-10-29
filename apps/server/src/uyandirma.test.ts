import { type AnyGame, GAMES } from "@glix/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COUNTDOWN_MS, clearMatch, TICK_MS } from "./match.js";
import { deleteRoom } from "./rooms.js";
import { k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

useServer();

interface S {
  startedAt: number;
  wakeAt: number;
  tickedAt: number[];
}

const setups: number[] = [];

/** `nextWake`i olan sahte oyun: 700 ms sonra "uyanır"; tick'in hangi anlarda çalıştığını kaydeder. */
const wakeGame: AnyGame = {
  id: "test-uyanan",
  name: "Uyanan",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: { goal: "g", steps: [] },
  parseAction: (raw) => (raw === "go" ? "go" : null),
  setup(_players, ctx): S {
    setups.push(ctx.now);
    return { startedAt: ctx.now, wakeAt: ctx.now + 700, tickedAt: [] };
  },
  reduce: (state: S) => state,
  tick(state: S, ctx) {
    if (ctx.now < state.wakeAt || state.tickedAt.length > 0) return state;
    return { ...state, tickedAt: [ctx.now] };
  },
  nextWake: (state: S, ctx) => (ctx.now < state.wakeAt && state.tickedAt.length === 0 ? state.wakeAt : null),
  publicView: (state: S) => ({ woke: state.tickedAt.length > 0 }),
  view: () => ({}),
  isFinished: (state: S, ctx) => ctx.now >= state.startedAt + 600_000,
  result: () => ({ miniScores: {}, awards: {} }),
  secrets: () => [],
};

beforeAll(() => {
  GAMES[wakeGame.id] = wakeGame;
});
afterAll(() => {
  delete GAMES[wakeGame.id];
});

const rt = () => k.srv.runtime;
const roomOf = (code: string) => {
  const room = rt().rooms.get(code);
  if (!room) throw new Error("oda yok");
  return room;
};

describe("Tam zamanlı uyandırma", () => {
  it("geri sayım tam bitiş anında oyunu başlatır (tick'i beklemez)", async () => {
    const cs = await setupRoom(["A", "B"], [wakeGame.id]);
    const host = cs[0] as (typeof cs)[number];
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    const room = roomOf(host.session.roomCode);
    const endsAt = room.match?.phaseEndsAt as number;
    expect(room.wakeAt).toBe(endsAt);
    expect(room.wakeCancel).not.toBeNull();
    setups.length = 0;
    // Tek eşzamanlı ilerleme: arada gerçek tick çalışamaz; oyun yine de bitiş anında kurulur.
    k.clock.advance(endsAt - k.clock.now() + 1500);
    expect(setups).toEqual([endsAt]);
    expect(room.phase).toBe("playing");
    expect(COUNTDOWN_MS).toBeGreaterThan(TICK_MS);
  });

  it("oyunun nextWake anında tick çalışır ve görünüm değişir", async () => {
    const cs = await setupRoom(["A", "B"], [wakeGame.id]);
    const host = cs[0] as (typeof cs)[number];
    await startPlaying(cs);
    const room = roomOf(host.session.roomCode);
    const match = room.match;
    const state = match?.state as S;
    expect(state.tickedAt).toEqual([]);
    expect(room.wakeAt).toBe(state.wakeAt);
    k.clock.advance(state.wakeAt - k.clock.now() + 50);
    expect(((room.match as NonNullable<typeof room.match>).state as S).tickedAt).toEqual([state.wakeAt]);
    // Uyandırma işlendi; başka vade kalmadığı için yenisi kurulmaz (sıfır gecikmeli döngü yok).
    expect(room.wakeCancel).toBeNull();
    expect(room.wakeAt).toBeNull();
  });

  it("maç bitince / lobiye dönünce uyandırma iptal olur, zamanlayıcı sızmaz", async () => {
    const cs = await setupRoom(["A", "B"], [wakeGame.id]);
    const host = cs[0] as (typeof cs)[number];
    await startPlaying(cs);
    const room = roomOf(host.session.roomCode);
    expect(room.wakeCancel).not.toBeNull();
    clearMatch(rt(), room);
    expect(room.wakeCancel).toBeNull();
    expect(room.wakeAt).toBeNull();
    const pending = k.clock.pending();
    k.clock.advance(5000);
    await sync();
    expect(room.match).toBeNull();
    expect(k.clock.pending()).toBeLessThanOrEqual(pending);
  });

  it("oda silinince uyandırma iptal olur", async () => {
    const cs = await setupRoom(["A", "B"], [wakeGame.id]);
    const host = cs[0] as (typeof cs)[number];
    await startPlaying(cs);
    const room = roomOf(host.session.roomCode);
    expect(room.wakeCancel).not.toBeNull();
    const before = k.clock.pending();
    deleteRoom(rt(), room);
    expect(rt().rooms.has(room.code)).toBe(false);
    expect(room.wakeCancel).toBeNull();
    expect(k.clock.pending()).toBeLessThan(before);
  });

  it("Butona Bas: basış penceresi kapanınca sonuç tick'i beklemeden kesinleşir", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    const host = cs[0] as (typeof cs)[number];
    const { startedAt } = await startPlaying(cs);
    await press(cs[0] as (typeof cs)[number]);
    const room = roomOf(host.session.roomCode);
    const state = () => room.match?.state as { scores: Record<string, number>; pending: object };
    const closes = room.wakeAt as number;
    expect(closes).toBeGreaterThan(k.clock.now());
    expect(closes).toBeLessThanOrEqual(startedAt + 300 + 10_000);
    // Tek eşzamanlı ilerleme: kapanış anında puanlanır, sonraki vade (tur sonu) için yeni uyandırma kurulur.
    const bos = Object.keys(state().pending).length;
    expect(bos).toBeGreaterThan(0);
    k.clock.advance(closes - k.clock.now());
    expect(Object.keys(state().pending)).toHaveLength(0);
    expect(Object.values(state().scores).sort()).toEqual([-1, 0]);
    expect(room.wakeAt).not.toBeNull();
    expect(room.wakeAt as number).toBeGreaterThan(closes);
  });
});
