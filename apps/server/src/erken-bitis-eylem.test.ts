import { type AnyGame, GAMES } from "@glix/engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { k, setupRoom, sleep, startPlaying, until, useServer } from "./testkit.js";

useServer();

const events: string[] = [];

interface S {
  done: boolean;
}

/** Tek bir "go" eylemiyle biten sahte oyun; hangi oyun işlevinin hangi sırayla çağrıldığını kaydeder. */
const finisher: AnyGame = {
  id: "test-eylemle-biten",
  name: "Eylemle Biten",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: { goal: "g", steps: [] },
  parseAction: (raw) => (raw === "go" || raw === "nop" ? raw : null),
  setup: (): S => ({ done: false }),
  reduce(state: S, _id, action) {
    events.push(`reduce:${String(action)}`);
    return action === "go" ? { done: true } : state;
  },
  tick(state: S) {
    events.push("tick");
    return state;
  },
  publicView: (state: S) => ({ done: state.done }),
  view: () => ({}),
  isFinished(state: S) {
    events.push("isFinished");
    return state.done;
  },
  result(state: S) {
    events.push("result");
    return { miniScores: {}, awards: {} };
  },
  secrets: () => [],
};

beforeAll(() => {
  GAMES[finisher.id] = finisher;
});
afterAll(() => {
  delete GAMES[finisher.id];
});

async function act(c: Awaited<ReturnType<typeof setupRoom>>[number], payload: string, n: number) {
  c.send({ type: "action", seq: n, payload });
  await until(() => c.of("actionAck").some((a) => a.seq === n), "onay");
}

describe("Oyunu bitiren eylem", () => {
  it("sonucu bir sonraki tick'i beklemeden, eylemin işlendiği adımda işler", async () => {
    const cs = await setupRoom(["A", "B"], [finisher.id]);
    const host = cs[0] as (typeof cs)[number];
    await startPlaying(cs);
    expect(host.room.phase).toBe("playing");

    // Bitirmeyen eylem tick'i ya da bitiş denetimini tetiklemez.
    events.length = 0;
    await act(host, "nop", 1);
    expect(events).not.toContain("result");
    expect(host.room.phase).toBe("playing");

    // Bitiren eylem: reduce'tan sonra aynı eşzamanlı adımda isFinished, son tick, isFinished, result.
    events.length = 0;
    await act(host, "go", 2);
    const at = events.lastIndexOf("reduce:go");
    expect(events.slice(at)).toEqual(["reduce:go", "isFinished", "tick", "isFinished", "result"]);
    await until(() => host.room.phase === "results", "sonuç aşaması");
  });

  it("eylem oyunu bitirmeden önce de zaman zamanlayıcı sızdırmaz", async () => {
    const cs = await setupRoom(["A", "B"], [finisher.id]);
    await startPlaying(cs);
    const pendingBefore = k.clock.pending();
    await act(cs[0] as (typeof cs)[number], "go", 3);
    await sleep(20);
    expect(k.clock.pending()).toBeLessThanOrEqual(pendingBefore);
  });
});
