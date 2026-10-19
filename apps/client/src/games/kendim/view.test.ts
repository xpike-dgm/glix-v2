import { describe, expect, it } from "vitest";
import { cardOfPlayer, outcomeOf, pairOf, parseKendimView, signed, wordLen } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "match",
  startedAt: 100,
  writeEndsAt: 30_100,
  matchEndsAt: 60_100,
  finishAt: 69_100,
  ready: [],
  owners: ["a", "b", "c"],
  reveal: null,
};
const priv = {
  myText: "ELMA",
  locked: false,
  cards: [
    { id: 0, text: "ARMUT" },
    { id: 2, text: "KİRAZ" },
  ],
  myPairs: { "0": "b" },
};
const reveal = {
  cards: [
    { id: 0, text: "ARMUT", owner: "b", finders: ["a"], bonus: true },
    { id: 1, text: "ELMA", owner: "a", finders: [], bonus: false },
    { id: 2, text: "KİRAZ", owner: "c", finders: [], bonus: false },
  ],
  pairs: {
    a: [
      { card: 0, target: "b", ok: true },
      { card: 2, target: "b", ok: false },
    ],
    b: [],
  },
  scores: { a: 0, b: 1, c: 0 },
  winners: ["b"],
};

describe("Kendim görünümü", () => {
  it("eşleştirme görünümünü okur", () => {
    const v = parseKendimView(pub, priv);
    expect(v?.stage).toBe("match");
    expect(v?.cards).toHaveLength(2);
    expect(v?.myPairs).toEqual({ "0": "b" });
  });
  it("izleyici (boş) görünümü okur", () => {
    expect(parseKendimView(pub, { myText: null, locked: false, cards: [], myPairs: {} })?.cards).toEqual([]);
  });
  it("sonucu okur; reveal yoksa kapalı sayılır", () => {
    const v = parseKendimView({ ...pub, stage: "reveal", reveal }, priv);
    expect(v?.reveal?.winners).toEqual(["b"]);
    const { reveal: _r, ...rest } = pub;
    expect(parseKendimView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseKendimView(null, priv)).toBeNull();
    expect(parseKendimView(pub, null)).toBeNull();
    expect(parseKendimView({ ...pub, stage: "x" }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, owners: [1] }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, matchEndsAt: "x" }, priv)).toBeNull();
    expect(parseKendimView(pub, { ...priv, cards: [{ id: "0", text: "x" }] })).toBeNull();
    expect(parseKendimView(pub, { ...priv, myPairs: { "0": 3 } })).toBeNull();
    expect(parseKendimView(pub, { ...priv, myText: 4 })).toBeNull();
    expect(parseKendimView(pub, { ...priv, locked: 1 })).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, cards: [{ id: 1 }] } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, pairs: { a: [{ card: 0 }] } } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, winners: [1] } }, priv)).toBeNull();
  });
  it("kartın eşi ve oyuncunun kartı bulunur", () => {
    const v = parseKendimView(pub, priv);
    if (!v) throw new Error("yok");
    expect(pairOf(v, 0)).toBe("b");
    expect(pairOf(v, 2)).toBeNull();
    expect(cardOfPlayer(v, "b")?.text).toBe("ARMUT");
    expect(cardOfPlayer(v, "c")).toBeNull();
  });
  it("kendi sonucum: doğru, yanlış, bonus", () => {
    const r = parseKendimView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(outcomeOf(r, "a")).toEqual({ right: 1, wrong: 1, bonus: false, total: 0 });
    expect(outcomeOf(r, "b")).toEqual({ right: 0, wrong: 0, bonus: true, total: 1 });
    expect(outcomeOf(r, "zz").total).toBe(0);
  });
  it("işaretli skor metni", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(0)).toBe("0");
    expect(signed(-3)).toBe("−3");
  });
  it("kart yazısı uzunluğu en az 4 sayılır", () => {
    expect(wordLen("ÇAY")).toBe(4);
    expect(wordLen("KARAKTERLİ")).toBe(10);
    expect(wordLen("😀😀😀😀😀😀")).toBe(6);
  });
});
