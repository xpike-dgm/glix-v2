import { describe, expect, it } from "vitest";
import {
  bluffErrorText,
  canSubmitBluff,
  cardNumber,
  chipName,
  clockLevel,
  insertTemplate,
  myOutcome,
  parseSozlukView,
  revealAnnouncement,
  revealCards,
  revealPlan,
  SB_REVEAL,
  scoreLine,
  specialMoment,
  TEMPLATES,
  templatesFor,
} from "./view.js";

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
  awards: { a: 2, b: 0, c: 0 },
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
    expect(parseSozlukView(pub, 3)).toBeNull();
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
  it("tür ve ödül okunur; tanınmayan tür yok sayılır; TV (view: null) kişisel bilgisiz görünüm alır", () => {
    expect(parseSozlukView({ ...pub, wordType: "sıfat" }, priv)?.wordType).toBe("sıfat");
    expect(parseSozlukView({ ...pub, wordType: "edat" }, priv)?.wordType).toBeNull();
    expect(parseSozlukView(pub, priv)?.wordType).toBeNull();
    expect(parseSozlukView({ ...pub, phase: "reveal", cards, reveal }, priv)?.reveal?.awards.a).toBe(2);
    expect(parseSozlukView({ ...pub, reveal: { ...reveal, awards: { a: "x" } } }, priv)).toBeNull();
    const tv = parseSozlukView(pub, null);
    expect(tv?.myCard).toBeNull();
    expect(tv?.myKnew).toBe(false);
    expect(parseSozlukView(pub, { ...priv, myKnew: true })?.myKnew).toBe(true);
  });
  it("kart numaraları ortak sıradan gelir (kendi kartın çıksa da değişmez)", () => {
    expect(cardNumber(cards, "k3")).toBe(3);
    expect(cardNumber(cards, null)).toBeNull();
    expect(cardNumber(cards, "k9")).toBeNull();
    expect(revealCards(cards, reveal, ["a", "b", "c"]).map((c) => c.no)).toEqual([2, 1, 3]);
  });
  const rc = (id: string, no: number, real: boolean, pickers: string[], author: string | null = null) => ({
    id,
    no,
    text: id,
    real,
    author,
    pickers,
  });
  it("mühürlü açılış: önce sahteler azdan çoğa (1 sn arayla), sonra 'Gerçek anlam…', mühür, özet; 12 sn'ye sığar", () => {
    const four = [
      rc("g", 1, true, ["a"]),
      rc("x", 2, false, ["b", "c", "d"], "a"),
      rc("y", 3, false, [], "b"),
      rc("z", 4, false, ["e"], "c"),
    ];
    const p = revealPlan(four);
    expect(p.flipAt).toEqual({ y: 0, z: 1_000, x: 2_000 });
    expect(p.suspenseAt).toBe(3_000);
    expect(p.stampAt).toBe(4_500);
    expect(p.summaryAt).toBe(5_500);
    expect(p.doneAt).toBe(7_000);
    expect(p.champion).toBe("x");
    // 8 kişide en çok 8 sahte kart: 12 sn.
    const eight = [
      rc("g", 1, true, []),
      ...Array.from({ length: 8 }, (_, i) => rc(`f${i}`, i + 2, false, [])),
    ];
    expect(revealPlan(eight).doneAt).toBe(8 * SB_REVEAL.fakeMs + 4_000);
    expect(revealPlan(eight).doneAt).toBeLessThanOrEqual(12_000);
  });
  it("eşitte kart numarası korunur; en çok kandıran eşitse ya da kimse kandırılmadıysa şampiyon yok; hareket azaltma 0,6 sn", () => {
    const tie = [rc("g", 1, true, []), rc("x", 2, false, ["a"], "b"), rc("y", 3, false, ["c"], "a")];
    expect(revealPlan(tie).flipAt).toEqual({ x: 0, y: 1_000 });
    expect(revealPlan(tie).champion).toBeNull();
    expect(revealPlan(tie, true).flipAt).toEqual({ x: 0, y: 600 });
    expect(revealPlan([rc("g", 1, true, [])]).champion).toBeNull();
  });
  it("özel an: Sözlük kazandı > Blöf Ustası > Herkes bildi", () => {
    const nobody = [rc("g", 1, true, []), rc("x", 2, false, ["a", "b"], "c"), rc("y", 3, false, ["c"], "a")];
    expect(specialMoment(nobody, "x")).toBe("sozluk");
    const usta = [rc("g", 1, true, ["a"]), rc("x", 2, false, ["b", "c"], "a"), rc("y", 3, false, [], "b")];
    expect(specialMoment(usta, "x")).toBe("usta");
    const all = [rc("g", 1, true, ["a", "b", "c"]), rc("x", 2, false, [], "a")];
    expect(specialMoment(all, null)).toBe("herkes");
    const mixed = [rc("g", 1, true, ["a"]), rc("x", 2, false, ["b"], "a"), rc("y", 3, false, ["c"], "b")];
    expect(specialMoment(mixed, null)).toBeNull();
    expect(specialMoment([rc("g", 1, true, [])], null)).toBeNull();
  });
  it("puan başlığı: iki parça, puan almayan için tek satır; ödül ayrı", () => {
    const a = myOutcome(reveal, "a");
    expect(a).toMatchObject({ found: true, fooled: 2, points: 3, award: 2, pick: "k2", fooledBy: null });
    expect(scoreLine(a)).toBe("Gerçeği buldun +1 · 2 kişiyi kandırdın +2");
    const c = myOutcome(reveal, "c");
    expect(c.fooledBy).toBe("a");
    expect(scoreLine(c)).toBe("Bu sefer olmadı · blöfün kimseyi kandırmadı");
    const b = myOutcome(reveal, "b");
    expect(b.wrote).toBe(false);
    expect(scoreLine(b)).toBe("Bu sefer olmadı · gerçeği bulamadın");
  });
  it("isim çipi 8 harften sonra kesilir; ekran okuyucu özeti", () => {
    expect(chipName("Gülizarcan")).toBe("Gülizarc…");
    expect(chipName("Mert")).toBe("Mert");
    const final = revealCards(cards, reveal, ["a", "b", "c"]);
    expect(revealAnnouncement(final, myOutcome(reveal, "a"))).toBe(
      "Gerçek anlam 2 numaraydı, 1 kişi buldu. Blöfün 2 kişiyi kandırdı.",
    );
    expect(revealAnnouncement(final, null)).toBe("Gerçek anlam 2 numaraydı, 1 kişi buldu.");
  });
  it("kalıplar: tür başına 6, sabit; türsüz kelimede isim kalıpları; imleç boşluğa konur", () => {
    for (const list of Object.values(TEMPLATES)) expect(list).toHaveLength(6);
    expect(templatesFor(null)).toBe(TEMPLATES.isim);
    const [birTur, icin] = TEMPLATES.isim;
    expect(insertTemplate("", 0, 0, birTur as (typeof TEMPLATES.isim)[number])).toEqual({
      text: "bir tür ",
      caret: 8,
    });
    expect(insertTemplate("su", 2, 2, icin as (typeof TEMPLATES.isim)[number])).toEqual({
      text: "su için kullanılan",
      caret: 2,
    });
  });
  it("kalan süre: son 10 sn amber, son 5 sn kırmızı", () => {
    expect(clockLevel(38)).toBe("calm");
    expect(clockLevel(10)).toBe("warn");
    expect(clockLevel(5)).toBe("hot");
  });
});
