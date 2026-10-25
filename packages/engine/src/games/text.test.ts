import { describe, expect, it } from "vitest";
import { groupAnswers } from "./cagrisim-agi/index.js";
import { compareKey } from "./sozluk-blofu/text.js";
import { foldKey } from "./text.js";
import { yaziYazJudge } from "./yazi-yaz/index.js";

describe("foldKey: Türkçe ve İngilizce klavye eşleşir", () => {
  it.each([
    ["KAŞIK", "kasik"],
    ["KİTAP", "KITAP"],
    ["kitap", "KİTAP"],
    ["ılık", "ILIK"],
    ["Çiçek", "cicek"],
    ["ÖĞRETMEN", "ogretmen"],
    ["üzüm", "UZUM"],
    ["kâğıt", "kagit"],
    ["  deniz   kenarı! ", "deniz kenari"],
  ])("%s = %s", (a, b) => {
    expect(foldKey(a)).toBe(foldKey(b));
  });

  it("farklı kelimeler ayrı kalır", () => {
    expect(foldKey("KEDİ")).not.toBe(foldKey("KÖPEK"));
  });
});

describe("oyunlarda klavyeden bağımsız eşleşme", () => {
  it("Çağrışım: kaşık ve kasik aynı grupta", () => {
    const r = groupAnswers(["a", "b", "c"], { a: "Kaşık", b: "kasik", c: "çatal" });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.members).toEqual(["a", "b"]);
    expect(r.groups[0]?.text).toBe("kaşık");
  });

  it("Yazı Yaz: KITAP tahmini KİTAP kelimesini bulur", () => {
    const state = { writers: ["w1", "w2"], texts: { w1: "KİTAP", w2: "ELMA" } };
    expect(yaziYazJudge(state, "x", "w1", "KITAP").wordOk).toBe(true);
    expect(yaziYazJudge(state, "x", "w1", "KALEM").wordOk).toBe(false);
  });

  it("Sözlük: İngilizce klavyeyle yazılan gerçek tanım da aynı sayılır", () => {
    expect(compareKey("şakul: duvarın dikliğini ölçen ip")).toBe(
      compareKey("SAKUL duvarin dikligini olcen ip"),
    );
  });
});
