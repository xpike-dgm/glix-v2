import { describe, expect, it } from "vitest";
import type { AnyGame } from "../game.js";
import { GameRecorder, replayWithCards } from "../replay.js";
import { DEFAULT_CARD_SETTINGS } from "./catalog.js";
import { cardsResolveInput, createCardsState } from "./state.js";

/** Hemen biten sahte oyun: ilk oyuncu birinci. */
const game: AnyGame = {
  id: "sahte",
  name: "Sahte",
  minPlayers: 2,
  maxPlayers: 8,
  orientation: "portrait",
  briefing: { goal: "g", steps: [] },
  parseAction: () => null,
  setup: (players: string[]) => ({ players }),
  reduce: () => ({ rejected: "no" }),
  tick: (s: unknown) => s,
  publicView: () => ({}),
  view: () => ({}),
  isFinished: () => true,
  result: (s: { players: string[] }) => ({
    miniScores: Object.fromEntries(s.players.map((id, i) => [id, 10 - i * 5])),
    awards: Object.fromEntries(s.players.map((id, i) => [id, 2 - i])),
  }),
  secrets: () => [],
};

describe("replayWithCards", () => {
  it("kayıtta kart girdileri yoksa kart hesabı yoktur", () => {
    const rec = new GameRecorder("sahte", 1, ["a", "b", "c"], 0);
    const out = replayWithCards(game, rec.finish(100));
    expect(out.cards).toBeNull();
    expect(out.result.awards).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("kart girdileri kayda yazılır ve nihai puanlar birebir yeniden üretilir", () => {
    const players = ["a", "b", "c"];
    let state = createCardsState(5, players, DEFAULT_CARD_SETTINGS);
    state = JSON.parse(JSON.stringify(state));
    const rec = new GameRecorder("sahte", 1, players, 0);
    const input = cardsResolveInput(
      {
        ...state,
        plays: [
          { playerId: "c", cardId: "celme", target: "a" },
          { playerId: "a", cardId: "cift-puan" },
        ],
      },
      { present: players, gameIndex: 0 },
    );
    rec.setCards(input);
    const log = rec.finish(100);
    expect(log.cards?.plays).toHaveLength(2);
    const out = replayWithCards(game, JSON.parse(JSON.stringify(log)));
    // Ham 2/1/0 → Çift Puan A = 4 → Çelme A = 3
    expect(out.cards?.awards).toEqual({ a: 3, b: 1, c: 0 });
    expect(replayWithCards(game, log).cards).toEqual(out.cards);
  });
});
