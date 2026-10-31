import { describe, expect, it } from "vitest";
import { cosmeticItem } from "./cosmetics.js";
import { validateDance, validateWardrobeLayer } from "./karakter.js";

const RIG = {
  format: "glix-parts-1",
  parts: { torso: {}, head: {}, left_foot: {}, left_shin: {}, left_thigh: {}, left_upper_arm: {} },
};
const dance = (over: Record<string, unknown> = {}) => ({
  format: "glix-dance-3",
  fps: 15,
  loop: true,
  bones: ["torso", "head"],
  y: Array.from({ length: 30 }, () => 0),
  a: Array.from({ length: 60 }, (_, i) => (i % 2) * 50),
  ...over,
});

describe("dans doğrulayıcı (MG-5)", () => {
  it("geçerli dans geçer; kemik, süre, biçim ve boyut denetlenir", () => {
    expect(validateDance(dance(), RIG)).toEqual({ ok: true, errors: [], warnings: [] });
    expect(validateDance(dance({ bones: ["torso", "tail"] }), RIG).errors.join()).toContain(
      '"tail" iskelette yok',
    );
    expect(validateDance(dance({ bones: ["torso", "torso"] }), RIG).ok).toBe(false);
    expect(validateDance(dance({ fps: 60 }), RIG).errors.join()).toContain("süre 0.50 sn");
    expect(validateDance(dance({ fps: 2 }), RIG).errors.join()).toContain("süre 15.00 sn");
    expect(validateDance(dance({ format: "glix-dance-2" }), RIG).ok).toBe(false);
    expect(validateDance(dance({ a: [1, 2] }), RIG).ok).toBe(false);
    expect(validateDance(dance({ y: Array.from({ length: 30 }, () => 4000) }), RIG).ok).toBe(false);
    expect(validateDance(dance({ fazla: 1 }), RIG).ok).toBe(false);
    expect(validateDance(dance(), { format: "x" }).ok).toBe(false);
    expect(validateDance("dans", RIG).ok).toBe(false);
  });

  it("döngüde sert sıçrama hata değil uyarıdır", () => {
    const a = Array.from({ length: 60 }, (_, i) => (i < 58 ? 0 : 900));
    const r = validateDance(dance({ a }), RIG);
    expect(r.ok).toBe(true);
    expect(r.warnings[0]).toContain("90 derecelik sıçrama");
    expect(validateDance(dance({ a, loop: false }), RIG).warnings).toEqual([]);
  });
});

describe("giysi katmanı doğrulayıcı (MG-5)", () => {
  const piece = (bone: string, over: Record<string, unknown> = {}) => ({
    file: `giysi/x_${bone}.webp`,
    size: [80, 60],
    pivot: [10, 10],
    bone,
    sourceOrigin: [0, 0],
    ...over,
  });

  it("doğru yuvadaki katman geçer; yanlış yuva, kemik ve dosya reddedilir", () => {
    expect(validateWardrobeLayer({ slot: "sapka", pieces: [piece("head")] }, RIG).ok).toBe(true);
    expect(validateWardrobeLayer({ slot: "sapka", pieces: [piece("torso")] }, RIG).errors.join()).toContain(
      '"sapka" yuvasının kemiğinde hiç parça yok',
    );
    // Bot gibi: ayakkabı yuvasında baldıra taşan parça olabilir.
    expect(
      validateWardrobeLayer({ slot: "ayakkabi", pieces: [piece("left_foot"), piece("left_shin")] }, RIG).ok,
    ).toBe(true);
    expect(
      validateWardrobeLayer({ slot: "aksesuar", pieces: [piece("torso", { layer: "arka" })] }, RIG).ok,
    ).toBe(true);
    expect(validateWardrobeLayer({ slot: "sapka", pieces: [piece("kuyruk")] }, RIG).ok).toBe(false);
    expect(
      validateWardrobeLayer({ slot: "sapka", pieces: [piece("head", { file: "../x.webp" })] }, RIG).ok,
    ).toBe(false);
    expect(validateWardrobeLayer({ slot: "sapka", pieces: [piece("head", { layer: "ust" })] }, RIG).ok).toBe(
      false,
    );
    expect(validateWardrobeLayer({ slot: "pelerin", pieces: [piece("head")] }, RIG).ok).toBe(false);
    expect(validateWardrobeLayer({ slot: "sapka", pieces: [] }, RIG).ok).toBe(false);
  });

  it("ürünle uyum: tür = yuva; kostümün covers alanı parçaların kemiklerinden türeyen yuvalarla aynı", () => {
    const ninja = cosmeticItem("kostum-ninja");
    if (!ninja) throw new Error("katalog");
    const tam = {
      slot: "kostum",
      pieces: [piece("head"), piece("torso"), piece("left_thigh"), piece("left_foot")],
    };
    expect(validateWardrobeLayer(tam, RIG, ninja).ok).toBe(true);
    const eksik = { slot: "kostum", pieces: [piece("head"), piece("torso")] };
    expect(validateWardrobeLayer(eksik, RIG, ninja).errors.join()).toContain("covers");
    const sapka = cosmeticItem("sapka-tac");
    if (!sapka) throw new Error("katalog");
    expect(validateWardrobeLayer({ slot: "ust", pieces: [piece("torso")] }, RIG, sapka).ok).toBe(false);
  });
});
