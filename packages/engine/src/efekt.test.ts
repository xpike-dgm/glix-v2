import { describe, expect, it } from "vitest";
import { COSMETIC_ITEMS } from "./cosmetics.js";
import {
  EFFECT_ENGINE_IDS,
  EFFECT_ENGINES,
  EFFECT_MAX_PARTICLES,
  effectTextures,
  isEffectColour,
  isEffectTexture,
  parseEffectRecipe,
  validateEffectRecipe,
} from "./efekt.js";

describe("efekt motorları (MG-4)", () => {
  it("yedi motor; kullanım türleri öneri dosyasındaki tabloyla aynı", () => {
    expect(EFFECT_ENGINE_IDS).toEqual([
      "parlama",
      "akan-renk",
      "kivilcim",
      "donen-halka",
      "parcacik-yagmuru",
      "kare-animasyon",
      "doku-katmani",
    ]);
    expect(EFFECT_ENGINES.parlama.turler).toEqual(["ad-efekti", "cerceve"]);
    expect(EFFECT_ENGINES["akan-renk"].turler).toEqual(["ad-efekti", "cerceve"]);
    expect(EFFECT_ENGINES.kivilcim.turler).toEqual(["ad-efekti", "cerceve", "giris"]);
    expect(EFFECT_ENGINES["donen-halka"].turler).toEqual(["cerceve"]);
    expect(EFFECT_ENGINES["parcacik-yagmuru"].turler).toEqual(["giris", "zafer"]);
    expect(EFFECT_ENGINES["kare-animasyon"].turler).toEqual(["zafer", "tepki", "giris"]);
    expect(EFFECT_ENGINES["doku-katmani"].turler).toEqual(["cerceve", "kart-arkasi"]);
    for (const e of Object.values(EFFECT_ENGINES)) {
      expect(e.sade.length).toBeGreaterThan(0);
      for (const p of Object.values(e.parametreler)) {
        expect(p.aciklama.length).toBeGreaterThan(0);
        // Parçacık sayısı sınırı: hiçbir sayı parametresi 60 parçacığı aşamaz.
        if (p.tur === "sayi" && p.birim === "adet") expect(p.max).toBeLessThanOrEqual(EFFECT_MAX_PARTICLES);
        if ((p.tur === "doku" || p.tur === "dokular") && e.id !== "doku-katmani" && e.id !== "donen-halka")
          expect(p.enBuyukPiksel).toBeLessThanOrEqual(384);
      }
    }
    expect(EFFECT_ENGINES.kivilcim.parametreler.doku).toMatchObject({ enBuyukPiksel: 256 });
    expect(EFFECT_ENGINES["parcacik-yagmuru"].parametreler.dokular).toMatchObject({ enBuyukPiksel: 256 });
  });

  it("katalogdaki her ad efekti ve çerçeve geçerli bir tarif taşır", () => {
    for (const i of COSMETIC_ITEMS.filter((x) => x.type === "ad-efekti" || x.type === "cerceve")) {
      expect(validateEffectRecipe(i.efekt, i.type), i.id).toEqual({ ok: true, errors: [] });
      expect(parseEffectRecipe(i.efekt, i.type), i.id).not.toBeNull();
    }
  });

  it("geçersiz tarifler reddedilir", () => {
    const bad = (r: unknown, t?: Parameters<typeof validateEffectRecipe>[1]) => validateEffectRecipe(r, t).ok;
    expect(bad(null)).toBe(false);
    expect(bad({ motor: "yok", parametreler: {} })).toBe(false);
    expect(bad({ motor: "toString", parametreler: {} })).toBe(false);
    expect(bad({ motor: "kivilcim" })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: {} })).toBe(false); // renk zorunlu
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#fff" } })).toBe(false); // kısa onaltılık
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff", sayi: 61 } })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff", sayi: 2.5 } })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff", hiz: 9 } })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff", fazla: 1 } })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff" }, ek: 1 })).toBe(false);
    expect(bad({ motor: "kivilcim", parametreler: { renk: "#ffffff", doku: "../gizli.webp" } })).toBe(false);
    expect(bad({ motor: "donen-halka", parametreler: { doku: "cerceve/a.webp", donusHizi: 10 } })).toBe(true);
    expect(
      bad({ motor: "donen-halka", parametreler: { doku: "cerceve/a.webp", donusHizi: 10 } }, "giris"),
    ).toBe(false);
    // Ad efektinde parlama metin rengi, çerçevede parlama/akan renk çerçeve görseli ister.
    const parlama = { motor: "parlama", parametreler: { isiklar: [{ renk: "#ffffff", yaricap: 4 }] } };
    expect(bad(parlama)).toBe(true);
    expect(bad(parlama, "ad-efekti")).toBe(false);
    expect(bad(parlama, "cerceve")).toBe(false);
    expect(
      bad({
        motor: "parlama",
        parametreler: { isiklar: [{ renk: "#ffffff", yaricap: 41 }], renk: "#000000" },
      }),
    ).toBe(false);
    expect(
      bad({
        motor: "akan-renk",
        parametreler: { renkler: ["#ffffff", "#000000"], duraklar: [0, 50, 100], akisHizi: 3 },
      }),
    ).toBe(false);
    expect(
      bad({
        motor: "akan-renk",
        parametreler: { renkler: ["#ffffff", "#000000"], duraklar: [60, 40], akisHizi: 3 },
      }),
    ).toBe(false);
    expect(bad({ motor: "kare-animasyon", parametreler: { kareler: ["zafer/a-1.webp"] } })).toBe(false);
  });

  it("renk ve doku biçimi", () => {
    expect(isEffectColour("#2EF2FF")).toBe(true);
    expect(isEffectColour("#2ef2ff80")).toBe(true);
    expect(isEffectColour("rgba(46, 242, 255, 0.7)")).toBe(true);
    expect(isEffectColour("rgba(300, 0, 0, 1)")).toBe(false);
    expect(isEffectColour("red")).toBe(false);
    expect(isEffectColour("url(x)")).toBe(false);
    expect(isEffectTexture("efekt/yildiz-1.webp")).toBe(true);
    expect(isEffectTexture("efekt/Yildiz.webp")).toBe(false);
    expect(isEffectTexture("/assets/shop/efekt/a.webp")).toBe(false);
    expect(isEffectTexture("efekt/a.png")).toBe(false);
  });

  it("çözülen tarif varsayılanları doldurur; dokular listelenir", () => {
    expect(parseEffectRecipe({ motor: "kivilcim", parametreler: { renk: "#ffc23b" } })).toEqual({
      motor: "kivilcim",
      doku: null,
      sayi: 12,
      hiz: 1.6,
      renk: "#ffc23b",
      boyut: 6,
    });
    const halka = parseEffectRecipe({
      motor: "donen-halka",
      parametreler: { doku: "cerceve/x.webp", donusHizi: 9 },
    });
    expect(halka).toEqual({
      motor: "donen-halka",
      doku: "cerceve/x.webp",
      donusHizi: 9,
      katman: 1,
      yon: "saat",
    });
    if (halka) expect(effectTextures(halka)).toEqual(["cerceve/x.webp"]);
    const yagmur = parseEffectRecipe({
      motor: "parcacik-yagmuru",
      parametreler: { dokular: ["zafer/a-1.webp", "zafer/a-2.webp"] },
    });
    expect(yagmur).toMatchObject({ yogunluk: 24, yon: "asagi", sure: 2.4 });
    if (yagmur) expect(effectTextures(yagmur)).toHaveLength(2);
    expect(parseEffectRecipe({ motor: "kivilcim", parametreler: {} })).toBeNull();
  });
});
