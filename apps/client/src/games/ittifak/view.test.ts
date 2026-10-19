import { describe, expect, it } from "vitest";
import { bondPattern, flowsOf, parseIttifakView, ringPosition } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  phase: "talk",
  startedAt: 100,
  talkEndsAt: 60_100,
  voteEndsAt: 75_100,
  finishAt: 83_100,
  reveal: null,
};
const priv = { myVote: null };
const reveal = { votes: { a: "b", b: "a", c: "a" }, scores: { a: 2, b: 1, c: 0 } };

describe("İttifak görünümü", () => {
  it("pazarlık ve oylama görünümünü okur", () => {
    expect(parseIttifakView(pub, priv)?.phase).toBe("talk");
    expect(parseIttifakView({ ...pub, phase: "vote" }, { myVote: "b" })?.myVote).toBe("b");
  });
  it("açılmış görünümü okur", () => {
    const v = parseIttifakView({ ...pub, phase: "reveal", reveal }, priv);
    expect(v?.reveal?.scores.a).toBe(2);
    expect(v?.reveal?.votes.c).toBe("a");
  });
  it("reveal alanı yoksa kapalı sayılır", () => {
    const { reveal: _drop, ...rest } = pub;
    expect(parseIttifakView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseIttifakView(null, priv)).toBeNull();
    expect(parseIttifakView(pub, null)).toBeNull();
    expect(parseIttifakView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, talkEndsAt: "x" }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, reveal: { votes: { a: 3 }, scores: {} } }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, reveal: { votes: {}, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseIttifakView(pub, { myVote: 3 })).toBeNull();
  });
  it("oy akışı geçersiz ve kendine giden oyları atar", () => {
    const flows = flowsOf({ votes: { a: "b", b: "b", c: "zzz" }, scores: {} }, ["a", "b", "c"]);
    expect(flows).toEqual([{ from: "a", to: "b" }]);
  });
  it("bağlar yalnız geçerli, tekrarsız çiftlerdir", () => {
    for (let n = 3; n <= 8; n++) {
      const bonds = bondPattern(n);
      expect(bonds.length).toBeGreaterThan(0);
      const keys = new Set(bonds.map((b) => `${b.a}-${b.b}`));
      expect(keys.size).toBe(bonds.length);
      for (const b of bonds) {
        expect(b.a).not.toBe(b.b);
        expect(b.a).toBeGreaterThanOrEqual(0);
        expect(b.b).toBeLessThan(n);
      }
    }
  });
  it("halka yerleşimi ilk oyuncuyu üste koyar", () => {
    const p = ringPosition(0, 4);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(50);
  });
});
