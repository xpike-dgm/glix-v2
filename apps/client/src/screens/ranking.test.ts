import { describe, expect, it } from "vitest";
import { player } from "../net/fixtures.js";
import {
  deltaLabel,
  formatScore,
  playersOnly,
  podiumOrder,
  previousScore,
  rankDeltas,
  rankPlayers,
  watchersOf,
  winnersOf,
} from "./ranking.js";

const players = [player("a"), player("b"), player("c"), player("d")];

describe("sıralama", () => {
  it("puana göre azalan, eşitlikte aynı sıra", () => {
    const scores: Record<string, number> = { a: 3, b: 7, c: 3, d: -1 };
    const r = rankPlayers(players, (p) => scores[p.id]);
    expect(r.map((x) => [x.player.id, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
  it("puanı olmayan oyuncu (izleyici) listeye girmez", () => {
    const r = rankPlayers(players, (p) => (p.id === "a" ? 1 : undefined));
    expect(r).toHaveLength(1);
  });
  it("beraberlikte tüm liderler kazanan", () => {
    const r = rankPlayers(players, (p) => (p.id === "a" || p.id === "b" ? 5 : 1));
    expect(winnersOf(r).map((x) => x.player.id)).toEqual(["a", "b"]);
  });
  it("podyum 2·1·3 dizilir", () => {
    expect(podiumOrder(["1.", "2.", "3."])).toEqual(["2.", "1.", "3."]);
    expect(podiumOrder(["1.", "2."])).toEqual(["2.", "1."]);
    expect(podiumOrder(["1."])).toEqual(["1."]);
    expect(podiumOrder([])).toEqual([]);
  });
});

describe("formatScore", () => {
  it("eksi için gerçek eksi işareti kullanır", () => {
    expect(formatScore(-1)).toBe("\u22121");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(12)).toBe("12");
  });
});

describe("izleyiciler", () => {
  const all = [player("a"), player("b", 1, { spectator: true }), player("c", 2)];
  it("sıralamaya yalnız oyuncular girer, izleyenler ayrı listelenir", () => {
    expect(playersOnly(all).map((p) => p.id)).toEqual(["a", "c"]);
    expect(watchersOf(all).map((p) => p.id)).toEqual(["b"]);
    const r = rankPlayers(playersOnly(all), (p) => p.score);
    expect(r.map((x) => x.player.id)).toEqual(["a", "c"]);
  });
});

describe("tur sonu sıra değişimi", () => {
  const mk = (id: string, score: number) => ({ ...player(id), score });
  it("önceki puan, bu turun ödülü çıkarılarak bulunur", () => {
    expect(previousScore(mk("a", 5), { a: 2 })).toBe(3);
    expect(previousScore(mk("a", 5), {})).toBe(5);
  });
  it("yükselen pozitif, düşen negatif, değişmeyen yok", () => {
    // Önce: a 5, b 4, c 3, d 0 -> sonra: c +3 = 6 öne geçer, a ve b birer düşer.
    const now = [mk("a", 5), mk("b", 4), mk("c", 6), mk("d", 0)];
    expect(rankDeltas(now, { c: 3 })).toEqual({ c: 2, a: -1, b: -1 });
  });
  it("ödül yoksa değişim yoktur; eşit puan sırayı paylaşır", () => {
    expect(rankDeltas([mk("a", 2), mk("b", 1)], {})).toEqual({});
    // Önce a 3, b 1 -> sonra b +2 = 3: eşitlik, b 2. sıradan 1.'ye çıkar, a 1.'de kalır.
    expect(rankDeltas([mk("a", 3), mk("b", 3)], { b: 2 })).toEqual({ b: 1 });
  });
  it("rozet metni", () => {
    expect(deltaLabel(2)).toBe("↑2");
    expect(deltaLabel(-1)).toBe("↓1");
    expect(deltaLabel(0)).toBe("");
    expect(deltaLabel(undefined)).toBe("");
  });
});
