import { existsSync } from "node:fs";
import { join } from "node:path";
import { COSMETIC_ITEMS, cosmeticItem, effectTextures, parseEffectRecipe } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { normalizeGamePath, setAssetOverrides } from "./assetOverride.js";
import { effectOf, flowEnd, frameLook, nameFxLook, particlesOf, seeded } from "./effects.js";

const fx = (id: string) => {
  const e = effectOf(cosmeticItem(id));
  if (!e) throw new Error(id);
  return e;
};

describe("efekt çizim kuralları (MG-4)", () => {
  it("bugünkü ad efektleri eski CSS değerlerini üretir", () => {
    expect(nameFxLook(fx("ad-neon-mavi"))).toEqual({
      class: "fx-parlama",
      style: {
        "--fx-renk": "#8dfaff",
        "--fx-isik": "0 0 6px rgba(46, 242, 255, 0.7), 0 0 14px rgba(46, 242, 255, 0.4)",
      },
      particles: null,
    });
    const kivilcim = nameFxLook(fx("ad-kivilcim"));
    expect(kivilcim.class).toBe("fx-parlama fx-nabiz");
    expect(kivilcim.style["--fx-sure"]).toBe("2.6s");
    expect(kivilcim.style["--fx-tepe"]).toBe(
      "0 0 5px rgba(255, 244, 200, 0.95), 0 0 14px rgba(255, 194, 59, 0.6), 0 0 22px rgba(46, 242, 255, 0.35)",
    );
    const gokkusagi = nameFxLook(fx("ad-gokkusagi"));
    expect(gokkusagi.style["--fx-degrade"]).toBe(
      "linear-gradient(90deg, #ff8080, #ffd666, #85ffa0, #66ddff, #bf9dff, #ff8080)",
    );
    expect(gokkusagi.style["--fx-son"]).toBe("-200% 0");
    const altin = nameFxLook(fx("ad-altin-parilti"));
    expect(altin.class).toBe("fx-akan fx-salinim");
    expect(altin.style["--fx-degrade"]).toBe(
      "linear-gradient(100deg, #ffc233 0%, #ffe9a0 22%, #ffb81f 44%, #fff4c9 52%, #ffc233 68%, #ffe08a 100%)",
    );
    expect(altin.style["--fx-filtre"]).toBe("drop-shadow(0 0 4px rgba(255, 194, 59, 0.45))");
    expect(altin.style["--fx-yon"]).toBe("alternate");
    expect(flowEnd(100)).toBe("0% 0");
  });

  it("çerçeveler: durağan doku ve dönen halka; her çerçevenin görseli diskte var", () => {
    expect(frameLook(fx("cerceve-galaksi")).layers).toEqual([
      { src: "/assets/shop/cerceve/galaksi.webp", class: "", style: {} },
    ]);
    expect(frameLook(fx("cerceve-donen-neon")).layers).toEqual([
      {
        src: "/assets/shop/cerceve/donen-neon.webp",
        class: "fx-don",
        style: { "--fx-sure": "14s", "--fx-yon": "normal" },
      },
    ]);
    const root = join(process.cwd(), "public/assets/shop");
    for (const it of COSMETIC_ITEMS) {
      const e = it.efekt ? parseEffectRecipe(it.efekt, it.type) : null;
      for (const t of e ? effectTextures(e) : [])
        expect(existsSync(join(root, t)), `${it.id}: ${t}`).toBe(true);
    }
  });

  it("parçacıklar belirlenimci, en çok 60", () => {
    const e = parseEffectRecipe({ motor: "kivilcim", parametreler: { renk: "#ffc23b", sayi: 60 } });
    if (!e) throw new Error("tarif");
    const a = particlesOf(e, "ring");
    expect(a).toHaveLength(60);
    expect(particlesOf(e, "ring")).toEqual(a);
    const y = parseEffectRecipe({
      motor: "parcacik-yagmuru",
      parametreler: { dokular: ["zafer/konfeti-1.webp"], yogunluk: 30, yon: "patlama" },
    });
    if (!y) throw new Error("tarif");
    expect(particlesOf(y, "box")).toHaveLength(30);
    expect(seeded(1, 2)).toBe(seeded(1, 2));
    expect(seeded(1, 2)).not.toBe(seeded(1, 3));
  });

  it("önizleme taslak dosyaları: oyun yolu normalleşir, tablo dokuya uygulanır", () => {
    expect(normalizeGamePath("apps/client/public/assets/shop/cerceve/yeni.webp")).toBe(
      "/assets/shop/cerceve/yeni.webp",
    );
    expect(normalizeGamePath("/assets/karakter/dans/yeni.json")).toBe("/assets/karakter/dans/yeni.json");
    expect(normalizeGamePath("/assets/../index.html")).toBeNull();
    expect(normalizeGamePath("/sw.js")).toBeNull();
    setAssetOverrides(new Map([["/assets/shop/cerceve/galaksi.webp", "data:image/webp;base64,AAAA"]]));
    try {
      expect(frameLook(fx("cerceve-galaksi")).layers[0]?.src).toBe("data:image/webp;base64,AAAA");
    } finally {
      setAssetOverrides(null);
    }
  });
});
