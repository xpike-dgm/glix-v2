import type { GameInfo } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  emptySeats,
  friendsHint,
  gameTag,
  isGameDim,
  minPlayersNeeded,
  playerCounter,
  settingsLine,
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
  it("boş koltuklar en çok bir satır, kalanı '+N yer daha'", () => {
    expect(emptySeats(1, 8)).toEqual({ shown: 3, more: 4 });
    expect(emptySeats(2, 8)).toEqual({ shown: 2, more: 4 });
    expect(emptySeats(4, 8)).toEqual({ shown: 4, more: 0 });
    expect(emptySeats(5, 8)).toEqual({ shown: 3, more: 0 });
    expect(emptySeats(7, 8)).toEqual({ shown: 1, more: 0 });
    expect(emptySeats(8, 8)).toEqual({ shown: 0, more: 0 });
  });
  it("ayar özeti tek satır", () => {
    const base = {
      mode: "random",
      randomCount: 5,
      selectedCount: 0,
      cardsOn: true,
      joinPolicy: "izleyici",
    } as const;
    expect(settingsLine(base)).toBe("5 rastgele oyun · Kartlar açık · Geç gelen izler");
    expect(
      settingsLine({ ...base, mode: "manual", selectedCount: 3, cardsOn: false, joinPolicy: "kapali" }),
    ).toBe("3 oyun seçili · Kartlar kapalı · Geç gelen giremez");
  });
});
