import { describe, expect, it } from "vitest";
import { player } from "../net/fixtures.js";
import { formatScore, podiumOrder, rankPlayers, winnersOf } from "./ranking.js";

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
