import { describe, expect, it } from "vitest";
import { bluffErrorText, canSubmitBluff, parseSozlukView, revealCards, revealPlan } from "./view.js";

const cards = [
  { id: "k1", text: "bir tür kayık" },
  { id: "k2", text: "gerçek anlam" },
  { id: "k3", text: "dağ kuşu" },
];
const pub = {
  players: ["a", "b", "c"],
  phase: "write",
  word: "ŞAKUL",
  startedAt: 100,
  writeEndsAt: 50_100,
  pickEndsAt: 80_100,
  finishAt: 92_100,
  ready: [],
  cards: null,
  reveal: null,
};
const priv = { myBluff: null, myCard: null, myPick: null, locked: false };
const reveal = {
  realCard: "k2",
  authors: { k1: "a", k3: "c" },
  picks: { a: "k2", b: "k1", c: "k1" },
  scores: { a: 3, b: 0, c: 0 },
};

describe("Sözlük Blöfü görünümü", () => {
  it("yazma görünümünü okur", () => {
    const v = parseSozlukView(pub, priv);
    expect(v?.phase).toBe("write");
    expect(v?.word).toBe("ŞAKUL");
    expect(v?.cards).toBeNull();
  });
  it("seçme görünümünü, kartları ve kendi kartı/seçimi okur", () => {
    const v = parseSozlukView(
      { ...pub, phase: "pick", cards, ready: ["a"] },
      { myBluff: "dağ kuşu", myCard: "k3", myPick: "k1", locked: true },
    );
    expect(v?.cards?.length).toBe(3);
    expect(v?.myCard).toBe("k3");
    expect(v?.myPick).toBe("k1");
    expect(v?.locked).toBe(true);
    expect(v?.ready).toEqual(["a"]);
  });
  it("açılmış görünümü okur", () => {
    const v = parseSozlukView({ ...pub, phase: "reveal", cards, reveal }, priv);
    expect(v?.reveal?.realCard).toBe("k2");
    expect(v?.reveal?.authors.k3).toBe("c");
    expect(v?.reveal?.scores.a).toBe(3);
  });
  it("izleyici görünümü geçerlidir; reveal/cards alanı yoksa kapalı sayılır", () => {
    const { cards: _c, reveal: _r, ...rest } = pub;
    const v = parseSozlukView(rest, priv);
    expect(v?.cards).toBeNull();
    expect(v?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseSozlukView(null, priv)).toBeNull();
    expect(parseSozlukView(pub, null)).toBeNull();
    expect(parseSozlukView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, word: 3 }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, writeEndsAt: "x" }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, cards: [{ id: 1, text: "x" }] }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, cards: "k1" }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, reveal: { ...reveal, authors: { k1: 3 } } }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseSozlukView({ ...pub, reveal: { realCard: 3 } }, priv)).toBeNull();
    expect(parseSozlukView(pub, { ...priv, myBluff: 3 })).toBeNull();
    expect(parseSozlukView(pub, { ...priv, myCard: 3 })).toBeNull();
    expect(parseSozlukView(pub, { ...priv, myPick: 3 })).toBeNull();
    expect(parseSozlukView(pub, { myBluff: null, myCard: null, myPick: null })).toBeNull();
  });
  it("ret nedenleri dostça Türkçe; bilinmeyen neden genel mesajdır, teknik kod sızmaz", () => {
    expect(bluffErrorText("same_as_real")).toMatch(/gerçek/);
    expect(bluffErrorText("too_long")).toMatch(/100/);
    expect(bluffErrorText("ended")).toBe("Süre doldu.");
    for (const r of ["same_as_real", "too_long", "empty", "ended", "offline", "timeout", "xyz", undefined]) {
      expect(bluffErrorText(r as string | undefined)).not.toMatch(
        /same_as_real|too_long|offline|timeout|xyz/,
      );
    }
  });
  it("gönder düğmesi: görünür karakter ve 100 sınırı", () => {
    expect(canSubmitBluff("")).toBe(false);
    expect(canSubmitBluff("   \n ")).toBe(false);
    expect(canSubmitBluff("a")).toBe(true);
    expect(canSubmitBluff("x".repeat(100))).toBe(true);
    expect(canSubmitBluff("x".repeat(101))).toBe(false);
    expect(canSubmitBluff("😀".repeat(100))).toBe(true);
  });
  it("açılış kartları: gerçek başta, sonra seçilme sayısına göre; seçenler katılım sırasıyla", () => {
    const rc = revealCards(cards, reveal, ["a", "b", "c"]);
    expect(rc.map((c) => c.id)).toEqual(["k2", "k1", "k3"]);
    expect(rc[0]).toMatchObject({ real: true, author: null, pickers: ["a"] });
    expect(rc[1]).toMatchObject({ real: false, author: "a", pickers: ["b", "c"] });
    expect(rc[2]?.pickers).toEqual([]);
  });
  it("sıralı açılış: önce gerçek, sonra sahteler azdan çoğa; en çok kandıran en son", () => {
    const five = [
      { id: "g", text: "gerçek", real: true, author: null, pickers: ["a"] },
      { id: "x", text: "x", real: false, author: "a", pickers: ["b", "c", "d"] },
      { id: "y", text: "y", real: false, author: "b", pickers: [] },
      { id: "z", text: "z", real: false, author: "c", pickers: ["e"] },
    ];
    const plan = revealPlan(five);
    expect(plan.steps).toBe(4);
    expect(plan.step).toEqual({ g: 0, y: 1, z: 2, x: 3 });
    expect(plan.champion).toBe("x");
  });
  it("sıralı açılış: eşitte kart sırası korunur; kimse kandırılmadıysa şampiyon yok", () => {
    const tie = [
      { id: "g", text: "g", real: true, author: null, pickers: [] },
      { id: "x", text: "x", real: false, author: "a", pickers: [] },
      { id: "y", text: "y", real: false, author: "b", pickers: [] },
    ];
    const plan = revealPlan(tie);
    expect(plan.step).toEqual({ g: 0, x: 1, y: 2 });
    expect(plan.champion).toBeNull();
    expect(revealPlan([]).steps).toBe(0);
  });
});
