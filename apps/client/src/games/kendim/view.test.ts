import { kendimRevealMs } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { activeSlot, KN_REVEAL_PLAN, revealOrder, revealTimeline } from "./timeline.js";
import {
  awardLabel,
  cardOfPlayer,
  choiceOf,
  guessesFor,
  joinWord,
  outcomeOf,
  pairOf,
  parseKendimView,
  runningScores,
  wordLen,
} from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "match",
  topic: "Hayvan olsaydın?",
  hint: "Ben bir…",
  startedAt: 100,
  writeEndsAt: 30_100,
  matchEndsAt: 60_100,
  finishAt: 72_100,
  ready: [],
  owners: ["a", "b", "c"],
  cards: [
    { id: 0, text: "ARMUT" },
    { id: 1, text: "ELMA" },
    { id: 2, text: "KİRAZ" },
  ],
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
    { id: 0, text: "ARMUT", owner: "b", finders: ["a"], bonus: true, twin: false },
    { id: 1, text: "ELMA", owner: "a", finders: [], bonus: false, twin: false },
    { id: 2, text: "KİRAZ", owner: "c", finders: [], bonus: false, twin: false },
  ],
  order: [2, 1, 0],
  pairs: {
    a: [
      { card: 0, target: "b", ok: true },
      { card: 2, target: "b", ok: false },
    ],
    b: [{ card: 2, target: "a", ok: false }],
    c: [{ card: 2, target: "b", ok: false }],
  },
  scores: { a: 1, b: 1, c: 0 },
  awards: { a: 2, b: 2, c: 0 },
};

describe("Kendim görünümü", () => {
  it("eşleştirme görünümünü okur: konu, ipucu, sahipsiz bütün kartlar", () => {
    const v = parseKendimView(pub, priv);
    expect(v?.stage).toBe("match");
    expect(v?.topic).toBe("Hayvan olsaydın?");
    expect(v?.hint).toBe("Ben bir…");
    expect(v?.cards).toHaveLength(2);
    expect(v?.allCards).toHaveLength(3);
    expect(v?.myPairs).toEqual({ "0": "b" });
  });
  it("izleyici ve TV: kişisel görünüm boş ya da hiç yok", () => {
    expect(parseKendimView(pub, { myText: null, locked: false, cards: [], myPairs: {} })?.cards).toEqual([]);
    const tv = parseKendimView(pub, null);
    expect(tv?.cards).toEqual([]);
    expect(tv?.allCards.map((c) => c.text)).toEqual(["ARMUT", "ELMA", "KİRAZ"]);
  });
  it("sonucu okur; reveal yoksa kapalı sayılır", () => {
    const v = parseKendimView({ ...pub, stage: "reveal", reveal }, priv);
    expect(v?.reveal?.awards).toEqual({ a: 2, b: 2, c: 0 });
    expect(v?.reveal?.order).toEqual([2, 1, 0]);
    const { reveal: _r, ...rest } = pub;
    expect(parseKendimView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseKendimView(null, priv)).toBeNull();
    expect(parseKendimView({ ...pub, stage: "x" }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, topic: 3 }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, hint: undefined }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, cards: [{ id: "0" }] }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, owners: [1] }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, matchEndsAt: "x" }, priv)).toBeNull();
    expect(parseKendimView(pub, { ...priv, cards: [{ id: "0", text: "x" }] })).toBeNull();
    expect(parseKendimView(pub, { ...priv, myPairs: { "0": 3 } })).toBeNull();
    expect(parseKendimView(pub, { ...priv, myText: 4 })).toBeNull();
    expect(parseKendimView(pub, { ...priv, locked: 1 })).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, cards: [{ id: 1 }] } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, awards: null } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, order: ["x"] } }, priv)).toBeNull();
    expect(parseKendimView({ ...pub, reveal: { ...reveal, pairs: { a: [{ card: 0 }] } } }, priv)).toBeNull();
  });
  it("kartın eşi ve oyuncunun kartı bulunur", () => {
    const v = parseKendimView(pub, priv);
    if (!v) throw new Error("yok");
    expect(pairOf(v, 0)).toBe("b");
    expect(pairOf(v, 2)).toBeNull();
    expect(cardOfPlayer(v, "b")?.text).toBe("ARMUT");
    expect(cardOfPlayer(v, "c")).toBeNull();
  });
  it("kendi sonucum: doğru, yanlış, bonus, tanıma puanı ve genel ödül", () => {
    const r = parseKendimView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(outcomeOf(r, "a")).toEqual({ right: 1, wrong: 1, bonus: false, total: 1, award: 2 });
    expect(outcomeOf(r, "b")).toEqual({ right: 0, wrong: 1, bonus: true, total: 1, award: 2 });
    expect(outcomeOf(r, "zz")).toMatchObject({ total: 0, award: 0 });
    expect(awardLabel(2)).toBe("+2 genel");
    expect(awardLabel(0)).toBe("0 genel");
  });
  it("tahmin grupları: kim kimi dedi, kalabalıktan aza", () => {
    const r = parseKendimView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(guessesFor(r, 2, ["a", "b", "c"])).toEqual([
      { target: "b", by: ["a", "c"], ok: false },
      { target: "a", by: ["b"], ok: false },
    ]);
    expect(guessesFor(r, 1, ["a", "b", "c"])).toEqual([]);
    expect(choiceOf(r, "a", 0)).toEqual({ card: 0, target: "b", ok: true });
    expect(choiceOf(r, "c", 0)).toBeNull();
  });
  it("canlı puan: kart dönünce bulanlar, şeritte tek bulanın sahibi", () => {
    const r = parseKendimView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(runningScores(r, [], [])).toEqual({});
    expect(runningScores(r, [0], [])).toEqual({ a: 1 });
    expect(runningScores(r, [0, 1, 2], [0, 1, 2])).toEqual({ a: 1, b: 1 });
  });
  it("KN-M3: boşluklar bitiştirilir", () => {
    expect(joinWord("ÇOK NEŞELİ")).toEqual({ text: "ÇOKNEŞELİ", hadSpace: true });
    expect(joinWord("TATLI-SERT")).toEqual({ text: "TATLI-SERT", hadSpace: false });
  });
  it("kart yazısı uzunluğu en az 4 sayılır", () => {
    expect(wordLen("ÇAY")).toBe(4);
    expect(wordLen("KARAKTERLİ")).toBe(10);
    expect(wordLen("😀😀😀😀😀😀")).toBe(6);
  });
});

describe("Kendim açılış zaman çizelgesi (KN-U4)", () => {
  const cards = reveal.cards;
  it("senin kartın en sona alınır; kartı olmayan sunucu sırasını görür", () => {
    expect(revealOrder([2, 1, 0], cards, "b")).toEqual([2, 1, 0]);
    expect(revealOrder([2, 1, 0], cards, "c")).toEqual([1, 0, 2]);
    expect(revealOrder([2, 1, 0], cards, "izleyici")).toEqual([2, 1, 0]);
    // Sırada eksik kart varsa sona eklenir.
    expect(revealOrder([1], cards, "izleyici")).toEqual([1, 0, 2]);
  });
  it("her kart 3 sn, özet kartlardan sonra; bitiş motorun açılış süresiyle aynı", () => {
    const tl = revealTimeline([2, 1, 0]);
    expect(tl.slots.map((s) => s.startAt)).toEqual([0, 3_000, 6_000]);
    expect(tl.slots[1]?.flipAt).toBe(3_000 + KN_REVEAL_PLAN.flipAt);
    expect(tl.summaryAt).toBe(9_000);
    expect(tl.endAt).toBe(kendimRevealMs(3));
    for (const s of tl.slots) {
      expect(s.guessesAt).toBeLessThan(s.flipAt);
      expect(s.flipAt).toBeLessThan(s.bonusAt);
      expect(s.bonusAt).toBeLessThan(s.startAt + 3_000);
    }
    expect(activeSlot(tl, 0)).toBe(0);
    expect(activeSlot(tl, 3_100)).toBe(1);
    expect(activeSlot(tl, 8_999)).toBe(2);
    expect(activeSlot(tl, 9_000)).toBe(-1);
    expect(activeSlot(tl, -500)).toBe(0);
  });
});
