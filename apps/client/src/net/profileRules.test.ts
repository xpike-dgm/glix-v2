import { describe, expect, it } from "vitest";
import {
  isEmptyProfile,
  matchLine,
  memberSince,
  parseProfile,
  percentText,
  whenText,
} from "./profileRules.js";

const good = {
  ok: true,
  username: "ali_1",
  createdAt: 1_700_000_000_000,
  totals: { matches: 3, wins: 1, winRate: 0.333, games: 5, gameWins: 2 },
  favoriteGame: { id: "butona-bas", name: "Butona Bas", plays: 4 },
  perGame: [{ gameId: "butona-bas", name: "Butona Bas", plays: 4, wins: 2, bestMini: 7, avgMini: 3.5 }],
  recent: [{ endedAt: 5, players: 4, place: 1, score: -2 }],
  coPlayers: [{ username: "veli", matches: 2 }],
};

describe("parseProfile rozetler", () => {
  it("rozet listesini okur; alan yoksa boş", () => {
    const badge = {
      id: "ilk-mac",
      name: "İlk Adım",
      description: "İlk maçını bitir.",
      secret: false,
      earned: true,
    };
    expect(parseProfile({ ...good, badges: [badge] })?.badges).toEqual([badge]);
    expect(parseProfile(good)?.badges).toEqual([]);
    expect(parseProfile(good)?.glix).toBeNull();
    expect(parseProfile({ ...good, glix: 120 })?.glix).toBe(120);
    expect(parseProfile({ ...good, glix: -5 })?.glix).toBeNull();
    expect(parseProfile(good)?.cosmetics).toBeUndefined();
    expect(parseProfile({ ...good, cosmetics: { title: "unvan-efsane", frame: "yok" } })?.cosmetics).toEqual({
      title: "unvan-efsane",
    });
    expect(
      parseProfile({ ...good, cosmetics: { dance: "dans-lambada", top: "ust-neon-bomber", hat: "x" } })
        ?.cosmetics,
    ).toEqual({
      dance: "dans-lambada",
      top: "ust-neon-bomber",
    });
    expect(parseProfile({ ...good, badges: "x" })?.badges).toEqual([]);
  });
});

describe("parseProfile", () => {
  it("geçerli yanıtı okur", () => {
    const p = parseProfile(good);
    expect(p?.username).toBe("ali_1");
    expect(p?.perGame[0]?.bestMini).toBe(7);
    expect(p?.favoriteGame?.name).toBe("Butona Bas");
    expect(p?.recent).toHaveLength(1);
  });
  it("bozuk yanıtı reddeder", () => {
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ ...good, ok: false })).toBeNull();
    expect(parseProfile({ ...good, totals: { ...good.totals, winRate: 2 } })).toBeNull();
    expect(parseProfile({ ...good, totals: { ...good.totals, matches: -1 } })).toBeNull();
    expect(parseProfile({ ...good, username: 5 })).toBeNull();
  });
  it("bozuk satırları atar, listeleri kırpar", () => {
    const p = parseProfile({
      ...good,
      perGame: [{ gameId: 1 }, ...good.perGame],
      recent: Array.from({ length: 30 }, () => good.recent[0]),
      coPlayers: [{ username: "", matches: 1 }, ...good.coPlayers],
      favoriteGame: { id: 1 },
    });
    expect(p?.perGame).toHaveLength(1);
    expect(p?.recent).toHaveLength(10);
    expect(p?.coPlayers).toHaveLength(1);
    expect(p?.favoriteGame).toBeNull();
  });
  it("yeni hesap boş sayılır", () => {
    const p = parseProfile({
      ...good,
      totals: { matches: 0, wins: 0, winRate: 0, games: 0, gameWins: 0 },
      favoriteGame: null,
      perGame: [],
      recent: [],
      coPlayers: [],
    });
    expect(p && isEmptyProfile(p)).toBe(true);
  });
});

describe("metinler", () => {
  it("yüzde, tarih ve maç satırı", () => {
    expect(percentText(0.667)).toBe("67");
    expect(percentText(0)).toBe("0");
    expect(memberSince(new Date(2026, 9, 5).getTime())).toBe("Ekim 2026");
    expect(matchLine({ endedAt: 0, players: 5, place: 2, score: -3 })).toBe("5 oyuncu · −3 puan");
  });
  it("maç zamanı", () => {
    const now = new Date(2026, 9, 27, 15, 0).getTime();
    const at = (d: number, h = 10) => new Date(2026, 9, 27 - d, h).getTime();
    expect(whenText(at(0, 1), now)).toBe("Bugün");
    expect(whenText(at(1, 23), now)).toBe("Dün");
    expect(whenText(at(3), now)).toBe("3 gün önce");
    expect(whenText(at(20), now)).toBe("7 Eki");
  });
});
