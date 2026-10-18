import { describe, expect, it } from "vitest";
import {
  handOutcome,
  nextTokenCount,
  parseRusvetView,
  tokenMap,
  tokensToAllocations,
  tokenTotal,
} from "./view.js";

const base = {
  players: ["a", "b", "c"],
  phase: "vote",
  startedAt: 1,
  phaseStartedAt: 1,
  phaseEndsAt: 20_001,
  president: null,
  budget: null,
  duel: null,
  reveal: null,
};
const priv = { myVote: null, mySign: null, myTokens: null };
const hand = { candidates: ["a", "b"], signs: { a: "tas", b: "makas" }, advance: ["a"], replay: false };
const duel = {
  hand: 2,
  candidates: ["a", "b"],
  signStartedAt: 1,
  signEndsAt: 8_001,
  revealEndsAt: 10_501,
  signs: null,
  history: [hand],
};
const reveal = {
  votes: { a: "b", b: "a", c: "a" },
  counts: { a: 2, b: 1, c: 0 },
  tokens: { a: 0, b: 2, c: 0 },
  scores: { a: 1, b: 2, c: 0 },
  duelHands: [hand],
};

describe("Rüşvet ve Darbe görünümü", () => {
  it("seçim, düello, dağıtım ve sonuç görünümlerini okur", () => {
    expect(parseRusvetView(base, { ...priv, myVote: "b" })?.myVote).toBe("b");
    const d = parseRusvetView({ ...base, phase: "duel", duel }, { ...priv, mySign: "tas" });
    expect(d?.duel?.history[0]?.advance).toEqual(["a"]);
    expect(d?.mySign).toBe("tas");
    const g = parseRusvetView(
      { ...base, phase: "give", president: "a", budget: 3 },
      { ...priv, myTokens: [{ to: "b", n: 2 }] },
    );
    expect(g?.budget).toBe(3);
    expect(g?.myTokens).toEqual([{ to: "b", n: 2 }]);
    const r = parseRusvetView({ ...base, phase: "reveal", president: "a", budget: 2, reveal }, priv);
    expect(r?.reveal?.scores.b).toBe(2);
  });
  it("eksik alanları boş sayar", () => {
    const { president: _p, budget: _b, duel: _d, reveal: _r, ...rest } = base;
    const v = parseRusvetView(rest, { myVote: null });
    expect(v?.president).toBeNull();
    expect(v?.mySign).toBeNull();
    expect(v?.myTokens).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseRusvetView(null, priv)).toBeNull();
    expect(parseRusvetView(base, null)).toBeNull();
    expect(parseRusvetView({ ...base, phase: "x" }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, players: [1] }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, budget: "3" }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, duel: { ...duel, signs: { a: "rock" } } }, priv)).toBeNull();
    expect(
      parseRusvetView({ ...base, duel: { ...duel, history: [{ ...hand, replay: 1 }] } }, priv),
    ).toBeNull();
    expect(parseRusvetView({ ...base, reveal: { ...reveal, tokens: { a: "x" } } }, priv)).toBeNull();
    expect(parseRusvetView(base, { ...priv, mySign: "rock" })).toBeNull();
    expect(parseRusvetView(base, { ...priv, myTokens: [{ to: "b" }] })).toBeNull();
    expect(parseRusvetView(base, { ...priv, myVote: 3 })).toBeNull();
  });
  it("jeton yardımcıları", () => {
    expect(
      tokenMap([
        { to: "b", n: 2 },
        { to: "c", n: 1 },
      ]),
    ).toEqual({ b: 2, c: 1 });
    expect(tokenMap(null)).toEqual({});
    expect(tokenTotal({ b: 2, c: 1 })).toBe(3);
    expect(tokensToAllocations({ b: 2, c: 0, d: 1 }, ["a", "b", "c", "d"])).toEqual([
      { to: "b", n: 2 },
      { to: "d", n: 1 },
    ]);
  });
  it("dokunma sırası: +1, sınırda ya da bütçe bitince 0'a döner", () => {
    expect(nextTokenCount(0, 3)).toBe(1);
    expect(nextTokenCount(1, 2)).toBe(2);
    expect(nextTokenCount(2, 1)).toBe(0);
    expect(nextTokenCount(1, 0)).toBe(0);
    expect(nextTokenCount(0, 0)).toBe(0);
    expect(nextTokenCount(0, 3, false)).toBe(0);
  });
  it("el sonucu motorun kuralıyla bulunur", () => {
    expect(handOutcome(["a", "b"], { a: "tas", b: "makas" })?.advance).toEqual(["a"]);
    expect(handOutcome(["a", "b"], { a: "tas" })).toBeNull();
    expect(handOutcome(["a", "b", "c"], { a: "tas", b: "kagit", c: "makas" })?.replay).toBe(true);
  });
});
