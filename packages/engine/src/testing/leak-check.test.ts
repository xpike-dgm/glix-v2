import { describe, expect, it } from "vitest";
import { type GameDefinition, isRejected } from "../game.js";
import { checkGameInvariants, findLeaks, InvariantViolation } from "./invariants.js";
import type { GameBot } from "./simulate.js";

interface FakeState {
  players: string[];
  endsAt: number;
  codes: Record<string, string>;
  count: number;
}
interface FakeView {
  mine: string | null;
  all?: Record<string, string>;
  spectatorCopy?: string;
}

/** Her oyuncunun gizli bir kodu var. `leak`: kodların kime sızacağı. */
function fakeGame(
  leak: "none" | "players" | "spectator",
): GameDefinition<FakeState, { kind: "guess" }, FakeView> {
  return {
    id: "sahte",
    name: "Sahte",
    minPlayers: 2,
    maxPlayers: 4,
    orientation: "portrait",
    briefing: { goal: "x", steps: [] },
    parseAction: (raw) =>
      typeof raw === "object" &&
      raw !== null &&
      !Array.isArray(raw) &&
      (raw as { kind?: unknown }).kind === "guess" &&
      Object.keys(raw).length === 1
        ? { kind: "guess" }
        : null,
    setup: (players, ctx) => ({
      players: [...players],
      endsAt: ctx.now + 10_000,
      codes: Object.fromEntries(players.map((p) => [p, `GIZLI-${p}-${ctx.rng.int(1_000_000)}`])),
      count: 0,
    }),
    reduce: (s, id, _a, ctx) =>
      !s.players.includes(id)
        ? { rejected: "not_participant" }
        : ctx.now >= s.endsAt
          ? { rejected: "ended" }
          : { ...s, count: s.count + 1 },
    tick: (s) => s,
    view: (s, id) => {
      const view: FakeView = { mine: id === null ? null : (s.codes[id] ?? null) };
      if (leak === "players") view.all = s.codes;
      if (leak === "spectator" && id === null) view.spectatorCopy = JSON.stringify(s.codes);
      return view;
    },
    isFinished: (s, ctx) => ctx.now >= s.endsAt,
    result: (s) => ({ miniScores: Object.fromEntries(s.players.map((p) => [p, s.count])), awards: {} }),
    secrets: (s) => s.players.map((p) => ({ ownerIds: [p], value: s.codes[p] as string, label: `kod ${p}` })),
  };
}

const bot: GameBot = { durationMs: 10_000, generate: () => ({ kind: "guess" }) };

describe("sızıntı denetimi kendini kanıtlar", () => {
  it("sızıntısı olmayan sahte oyun tüm değişmezleri geçer", () => {
    expect(() => checkGameInvariants(fakeGame("none"), bot, { seed: 7, playerCount: 3 })).not.toThrow();
  });

  it("başkalarının kodunu gösteren görünüm yakalanır", () => {
    const game = fakeGame("players");
    const state = game.setup(["a", "b"], {
      now: 0,
      rng: { next: () => 0, int: () => 1, shuffle: (x) => [...x] },
    });
    const found = findLeaks(game, state, ["a", "b"], 0);
    expect(found.some((f) => f.code === "leak")).toBe(true);
    let caught: unknown;
    try {
      checkGameInvariants(game, bot, { seed: 7, playerCount: 3 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(InvariantViolation);
    expect((caught as InvariantViolation).code).toBe("leak");
  });

  it("yalnız izleyiciye sızan değer de yakalanır", () => {
    const game = fakeGame("spectator");
    expect(() => checkGameInvariants(game, bot, { seed: 3, playerCount: 2 })).toThrow(/leak/);
  });

  it("çok kısa gizli değer reddedilir", () => {
    const game = { ...fakeGame("none"), secrets: () => [{ ownerIds: [], value: "ab", label: "kısa" }] };
    const state = game.setup(["a", "b"], {
      now: 0,
      rng: { next: () => 0, int: () => 1, shuffle: (x) => [...x] },
    });
    expect(findLeaks(game, state, ["a", "b"], 0)[0]?.code).toBe("short-secret");
    expect(
      isRejected(
        game.reduce(
          state,
          "zzz",
          { kind: "guess" },
          { now: 0, rng: { next: () => 0, int: () => 0, shuffle: (x) => [...x] } },
        ),
      ),
    ).toBe(true);
  });
});
