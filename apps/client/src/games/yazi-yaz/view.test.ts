import { YAZI_YAZ_REVEAL_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { revealPlan, YY_REVEAL_PLAN } from "./timeline.js";
import {
  findersOf,
  gridRows,
  isInnocentText,
  letterSlots,
  lettersText,
  outcomeOf,
  parseYaziYazView,
  ringPosition,
} from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "write",
  startedAt: 100,
  writeEndsAt: 30_100,
  talkEndsAt: 90_100,
  guessEndsAt: 120_100,
  finishAt: 128_100,
  ready: [],
  readyCount: 0,
  topic: "MEYVE",
  letters: null,
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
  hidden: [],
  scores: { a: 1, b: 0, c: 2 },
  awards: { a: 1, b: 0, c: 2 },
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
    expect(parseYaziYazView(pub, 5)).toBeNull();
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
    expect(outcomeOf(r, "c")).toEqual({ personOk: true, wordOk: true, points: 2, award: 2, hidden: false });
    expect(outcomeOf(r, "a")).toEqual({ personOk: true, wordOk: null, points: 1, award: 1, hidden: false });
    expect(outcomeOf(r, "b")).toEqual({ personOk: null, wordOk: null, points: 0, award: 0, hidden: false });
    expect(outcomeOf(r, "zz").points).toBe(0);
  });
  it("konu, harf ipucu ve hazır sayısı okunur; bozuk ipucu reddedilir", () => {
    const v = parseYaziYazView({ ...pub, stage: "talk", letters: [5, null], readyCount: 2 }, priv);
    expect(v?.topic).toBe("MEYVE");
    expect(v?.letters).toEqual([5, null]);
    expect(v?.readyCount).toBe(2);
    expect(parseYaziYazView({ ...pub, topic: null }, priv)?.topic).toBeNull();
    expect(parseYaziYazView({ ...pub, letters: [1, 2, 3] }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, letters: ["5"] }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, letters: [-1] }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, topic: 3 }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, readyCount: "2" }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, reveal: { ...reveal, hidden: undefined } }, priv)).toBeNull();
    expect(parseYaziYazView({ ...pub, reveal: { ...reveal, awards: null } }, priv)).toBeNull();
  });
  it("sahne (TV) kişisel görünüm taşımaz: rol yok", () => {
    expect(parseYaziYazView(pub, null)?.role).toBeNull();
  });
  it("ipucu metni ve harf kutucukları", () => {
    expect(lettersText([5, 7])).toBe("5 harf · 7 harf");
    expect(lettersText([6, null])).toBe("6 harf · yazılmadı");
    expect(lettersText(null)).toBe("");
    expect(letterSlots("ki r", 5)).toEqual(["k", "i", "r", "", ""]);
    expect(letterSlots("kiraz", 3)).toHaveLength(5);
    expect(letterSlots("", null)).toEqual([]);
  });
  it("yazan MASUM yazamaz: klavyeden bağımsız tanınır", () => {
    expect(isInnocentText("masum")).toBe(true);
    expect(isInnocentText("MAŞUM")).toBe(true);
    expect(isInnocentText(" Masum! ")).toBe(true);
    expect(isInnocentText("MASUMLAR")).toBe(false);
  });
  it("ızgara satırları ortalanır, boş hücre kalmaz", () => {
    expect(gridRows(3)).toEqual([3]);
    expect(gridRows(4)).toEqual([2, 2]);
    expect(gridRows(5)).toEqual([3, 2]);
    expect(gridRows(7)).toEqual([4, 3]);
    expect(gridRows(8)).toEqual([4, 4]);
  });
  it("açılış planı süreye sığar; bulanlar katılım sırasıyla", () => {
    const r = parseYaziYazView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(findersOf(r, ["a", "b", "c"], "a")).toEqual(["c"]);
    for (const n of [3, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const plan = revealPlan(["p0", "p1"], { p0: "BUZ DOLABI MAKİNESİ", p1: "" }, () => ids, n);
      expect(plan.cards[0]?.flipAt).toBe(YY_REVEAL_PLAN.drumMs);
      expect(plan.cards[1]?.letters).toEqual([]);
      expect(plan.meAt).toBeLessThan(YAZI_YAZ_REVEAL_MS);
      for (const c of plan.cards) expect(c.stampAt).toBeLessThan(plan.rowsAt + 1);
    }
  });
  it("halka yerleşimi ilk oyuncuyu üste koyar", () => {
    const p = ringPosition(0, 4);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(50);
  });
});
