import { describe, expect, it } from "vitest";
import { foldForModeration, moderateText } from "./blocklist.js";

const blocked = (t: string) => moderateText(t).ok === false;

describe("moderasyon süzgeci", () => {
  it("temiz cümleler geçer", () => {
    for (const t of [
      "Kedim sabah beşte beni uyandırıyor",
      "Annem bana yine çorba yaptı",
      "Toplantıyı bitirelim, kahve molası!",
      "Koli götürmek zorunda kaldım",
      "Bu sıkıntıyı çözmek lazım",
      "Sikke koleksiyonu yapıyorum",
      "Çok sıkıldım, sıkıştım, sık sık böyle oluyor",
    ]) {
      expect(moderateText(t), t).toEqual({ ok: true });
    }
  });

  it("açık küfürleri yakalar", () => {
    for (const t of ["siktir git", "Orospu çocuğu", "bu çok boktan", "amına koyayım", "yarrak kadar", "aq"]) {
      expect(blocked(t), t).toBe(true);
    }
  });

  it("harf değiştirme, noktalama ve tekrar kaçamaklarını yakalar", () => {
    for (const t of ["s1kt1r", "S.İ.K.T.İ.R", "o r o s p u", "siiiiktir", "0r0spu", "p3zevenk", "SİKTİR"]) {
      expect(blocked(t), t).toBe(true);
    }
  });

  it("nefret söylemini ayrı gerekçeyle yakalar", () => {
    expect(moderateText("seni zenci")).toEqual({ ok: false, reason: "hate" });
    expect(moderateText("mongol gibi")).toEqual({ ok: false, reason: "hate" });
    expect(moderateText("siktir")).toEqual({ ok: false, reason: "profanity" });
  });

  it("kısa kelimeler yalnız tam kelime olarak engellenir", () => {
    expect(blocked("götürmek")).toBe(false);
    expect(blocked("sık sık gelir")).toBe(false);
    expect(blocked("boks maçı")).toBe(false);
    expect(blocked("piknik yapalım")).toBe(false);
    expect(blocked("got")).toBe(true);
  });

  it("Türkçe büyük/küçük harf ve aksan sadeleştirmesi", () => {
    expect(foldForModeration("ÇİĞKÖFTE Işık")).toBe("cigkofte isik");
  });
});
