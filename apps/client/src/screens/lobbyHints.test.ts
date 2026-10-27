import type { GameInfo } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  friendsHint,
  gameTag,
  isGameDim,
  minPlayersNeeded,
  playerCounter,
  selectionSummary,
} from "./lobbyHints.js";

const g = (id: string, minPlayers: number): GameInfo => ({
  id,
  name: id,
  minPlayers,
  maxPlayers: 8,
  orientation: "portrait",
});
const catalog = [g("a", 3), g("b", 2), g("c", 4)];

describe("lobi ipuçları", () => {
  it("rastgele modda katalogdaki en küçük alt sınır", () => {
    expect(minPlayersNeeded(catalog, "random", [])).toBe(2);
    expect(minPlayersNeeded([g("x", 3)], "random", [])).toBe(3);
  });
  it("el ile modda seçilenlerin en büyük alt sınırı", () => {
    expect(minPlayersNeeded(catalog, "manual", [g("a", 3), g("c", 4)])).toBe(4);
    expect(minPlayersNeeded(catalog, "manual", [])).toBe(2);
  });
  it("boş katalogda 1", () => {
    expect(minPlayersNeeded([], "random", [])).toBe(1);
  });
  it("olumlu arkadaş metni", () => {
    expect(friendsHint(1)).toBe("Bir arkadaş daha gelince başlayabilirsin");
    expect(friendsHint(3)).toBe("3 arkadaş daha gelince başlayabilirsin");
  });
  it("oyuncu sayacı", () => {
    expect(playerCounter(1, 8, 2)).toBe("1/8 oyuncu · en az 2 gerekli");
  });
  it("yetersiz oyunculu oyun soluk ve 'en az N kişi' yazar", () => {
    expect(isGameDim(g("a", 3), 1)).toBe(true);
    expect(gameTag(g("a", 3), 1)).toBe("en az 3 kişi");
    expect(isGameDim(g("a", 3), 3)).toBe(false);
    expect(gameTag(g("a", 3), 3)).toBe("3–8 oyuncu");
  });
  it("oyuncu olmayanlar için salt okunur özet", () => {
    expect(selectionSummary("random", 5, 0)).toBe("Rastgele · 5");
    expect(selectionSummary("manual", 0, 3)).toBe("Bu gece: 3 oyun");
  });
});
