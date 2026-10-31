/** Arayüzün saf işlevleri ve tasarım belirteçlerinin karşıtlığı (WCAG AA). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boyut, goreliZaman, saniye, selam } from "./bicim.js";
import { alanFarklari, kelimeFarki } from "./fark.js";
import { jestIpucu, jestKarari } from "./jest.js";
import { iletiAyristir, varsayilanEkran } from "./onizleme/protokol.js";

describe("biçim", () => {
  it("göreli zaman ve boyut Türkçe", () => {
    const s = Date.parse("2026-10-31T12:00:00Z");
    expect(goreliZaman(s - 30_000, s)).toBe("az önce");
    expect(goreliZaman(s - 5 * 60_000, s)).toBe("5 dk önce");
    expect(goreliZaman(s - 3 * 3600_000, s)).toBe("3 sa önce");
    expect(goreliZaman(s - 26 * 3600_000, s)).toBe("dün");
    expect(boyut(1536)).toBe("1,5 KB");
    expect(boyut(3 * 1024 ** 2)).toBe("3,0 MB");
    expect(saniye(0.9)).toBe("0,90 sn");
    expect(selam(9)).toBe("Günaydın");
  });
});

describe("fark", () => {
  it("kelime farkı eklenen ve silineni ayırır", () => {
    const f = kelimeFarki("altın işlemeli kraliyet sırtı", "altın zarif kraliyet sırtı");
    expect(f.filter((x) => x.tur === "silindi").map((x) => x.metin.trim())).toEqual(["işlemeli"]);
    expect(f.filter((x) => x.tur === "eklendi").map((x) => x.metin.trim())).toEqual(["zarif"]);
  });
  it("alan farkları yalnız değişenleri verir", () => {
    expect(alanFarklari({ price: 400, name: "A" }, { price: 350, name: "A" })).toEqual([
      { anahtar: "price", eski: 400, yeni: 350 },
    ]);
  });
});

describe("kaydırma jestleri", () => {
  it("sağ onay, sol ret, yukarı düzeltme; kararsız hareket boş", () => {
    expect(jestKarari(140, 10, 300)).toBe("onay");
    expect(jestKarari(-140, 10, 300)).toBe("ret");
    expect(jestKarari(10, -140, 300)).toBe("duzeltme");
    expect(jestKarari(10, 140, 300)).toBeNull();
    expect(jestKarari(40, 30, 600)).toBeNull();
    expect(jestKarari(60, 5, 80)).toBe("onay");
    expect(jestIpucu(48, 0).guc).toBeCloseTo(0.5);
  });
});

describe("önizleme protokolü (sözleşme bölüm 4)", () => {
  const pencere = {};
  it("yalnız beklenen kaynak ve pencereden gelen ileti kabul edilir", () => {
    const k = "https://glix.dgmcraft.online";
    expect(
      iletiAyristir({ origin: k, source: pencere, data: { tur: "hazir", surum: 1 } }, k, pencere),
    ).toEqual({ tur: "hazir" });
    expect(
      iletiAyristir(
        { origin: "https://kotu.example", source: pencere, data: { tur: "hazir", surum: 1 } },
        k,
        pencere,
      ),
    ).toBeNull();
    expect(iletiAyristir({ origin: k, source: {}, data: { tur: "hazir", surum: 1 } }, k, pencere)).toBeNull();
    expect(
      iletiAyristir({ origin: k, source: pencere, data: { tur: "hazir", surum: 2 } }, k, pencere),
    ).toBeNull();
    expect(
      iletiAyristir(
        { origin: k, source: pencere, data: { tur: "cizildi", boyut: { w: 390, h: 844 } } },
        k,
        pencere,
      ),
    ).toEqual({ tur: "cizildi", w: 390, h: 844 });
    expect(
      iletiAyristir({ origin: k, source: pencere, data: { tur: "hata", neden: "yok" } }, k, pencere),
    ).toEqual({ tur: "hata", neden: "yok" });
  });
  it("ekran seçimi teslimdeki önizleme notundan, yoksa alandan", () => {
    expect(varsayilanEkran({ alan: "magaza", onizleme: null })).toBe("magaza-kart");
    expect(varsayilanEkran({ alan: "magaza", onizleme: { ekran: "kursu", not: "" } })).toBe("kursu");
    expect(varsayilanEkran({ alan: "icerik", onizleme: null })).toBeNull();
  });
});

// ---- Karşıtlık ------------------------------------------------------------------------------------------

function belirtecler(css: string, secici: string): Record<string, string> {
  const i = css.indexOf(secici);
  const blok = css.slice(css.indexOf("{", i) + 1, css.indexOf("}", i));
  return Object.fromEntries(
    [...blok.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1] ?? "", m[2] ?? ""]),
  );
}
const parlaklik = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const karsitlik = (a: string, b: string): number => {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((m, n) => n - m);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};

describe("belirteç karşıtlığı (WCAG AA ≥ 4.5)", () => {
  const css = readFileSync(join(import.meta.dirname, "stil/belirtecler.css"), "utf8");
  const temalar = { acik: belirtecler(css, ":root {"), koyu: belirtecler(css, ':root[data-theme="koyu"]') };
  temalar.koyu = belirtecler(css, ':root[data-tema="koyu"]');
  const ciftler: [string, string][] = [
    ["metin", "bg"],
    ["metin", "yuzey"],
    ["metin-2", "yuzey"],
    ["metin-2", "bg"],
    ["metin-3", "yuzey"],
    ["metin-3", "bg"],
    ["metin-3", "bg-ince"],
    ["vurgu", "yuzey"],
    ["vurgu-metin", "vurgu"],
    ["vurgu", "vurgu-zayif"],
    ["gecti", "gecti-zayif"],
    ["uyari", "uyari-zayif"],
    ["kaldi", "kaldi-zayif"],
    ["gecti", "yuzey"],
    ["kaldi", "yuzey"],
  ];
  for (const [ad, t] of Object.entries(temalar))
    for (const [on, arka] of ciftler)
      it(`${ad}: ${on} / ${arka}`, () => {
        const a = t[on];
        const b = t[arka];
        expect(a && b, `${on} ya da ${arka} tanımlı değil`).toBeTruthy();
        expect(karsitlik(a ?? "#000000", b ?? "#000000")).toBeGreaterThanOrEqual(4.5);
      });
});
