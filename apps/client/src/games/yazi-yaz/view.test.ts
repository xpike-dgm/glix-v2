import { describe, expect, it } from "vitest";
import { outcomeOf, parseYaziYazView, ringPosition } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "write",
  startedAt: 100,
  writeEndsAt: 30_100,
  talkEndsAt: 90_100,
  guessEndsAt: 120_100,
  finishAt: 128_100,
  ready: [],
  reveal: null,
};
const priv = { role: "innocent", myText: null, locked: false, myGuess: { target: null, word: "" } };
const reveal = {
  writers: ["a", "b"],
  words: { a: "ELMA", b: "" },
  guesses: {
    a: { target: "b", word: "", personOk: true, wordOk: false },
    b: { target: null, word: "", personOk: false, wordOk: false },
    c: { target: "a", word: "ELMA", personOk: true, wordOk: true },
  },
  scores: { a: 1, b: 0, c: 2 },
};

describe("Yazı Yaz görünümü", () => {
  it("yazma görünümünü ve rolü okur", () => {
    const v = parseYaziYazView(pub, priv);
    expect(v?.stage).toBe("write");
    expect(v?.role).toBe("innocent");
    expect(parseYaziYazView(pub, { ...priv, role: "writer", myText: "ELMA" })?.myText).toBe("ELMA");
  });
  it("izleyici görünümünü (rol yok) okur", () => {
    expect(parseYaziYazView(pub, { ...priv, role: null })?.role).toBeNull();
  });
  it("sonucu okur; reveal alanı yoksa kapalı sayılır", () => {
    const v = parseYaziYazView({ ...pub, stage: "reveal", reveal }, priv);
    expect(v?.reveal?.scores.c).toBe(2);
    const { reveal: _r, ...rest } = pub;
    expect(parseYaziYazView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseYaziYazView(null, priv)).toBeNull();
    expect(parseYaziYazView(pub, null)).toBeNull();
    expect(parseYaziYazView({ ...pub, stage: "x" }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, talkEndsAt: "x" }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseYaziYazView(pub, { ...priv, role: "x" })).toBeNull();
    expect(parseYaziYazView(pub, { ...priv, myText: 3 })).toBeNull();
    expect(parseYaziYazView(pub, { ...priv, locked: "evet" })).toBeNull();
    expect(parseYaziYazView(pub, { ...priv, myGuess: null })).toBeNull();
    expect(parseYaziYazView(pub, { ...priv, myGuess: { target: 1, word: "" } })).toBeNull();
    expect(parseYaziYazView({ ...pub, reveal: { ...reveal, writers: [1] } }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(
      parseYaziYazView({ ...pub, reveal: { ...reveal, guesses: { a: { target: 3 } } } }, priv),
    ).toBeNull();
  });
  it("kendi sonucum: tahmin yok, kelime boş, doğru", () => {
    const r = parseYaziYazView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(outcomeOf(r, "c")).toEqual({ personOk: true, wordOk: true, points: 2 });
    expect(outcomeOf(r, "a")).toEqual({ personOk: true, wordOk: null, points: 1 });
    expect(outcomeOf(r, "b")).toEqual({ personOk: null, wordOk: null, points: 0 });
    expect(outcomeOf(r, "zz").points).toBe(0);
  });
  it("halka yerleşimi ilk oyuncuyu üste koyar", () => {
    const p = ringPosition(0, 4);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(50);
  });
});
