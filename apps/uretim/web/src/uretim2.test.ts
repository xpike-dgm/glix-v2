/** Üretim Merkezi 2 arayüzünün saf hesapları: fikir süzgeci/sıralama, rapor panosu (kutucuk farkı, bulgu farkı, eksen). */
import { describe, expect, it } from "vitest";
import type { FikirKarti } from "../../src/ortak/fikir.js";
import { ORNEK_RAPOR } from "../../src/ortak/rapor.js";
import type { OgeAyrinti } from "../../src/ortak/tipler.js";
import { fikirSuz } from "./fikirSuzgec.js";
import { bulguFarki, eksenBasamaklari, kutucukFarki, raporOku, sayiBicimi } from "./onizleme/raporHesap.js";

const kart = (id: number, ek: Partial<FikirKarti>): FikirKarti => ({
  id,
  alan: "magaza",
  baslik: `Fikir ${id}`,
  aciklama: "",
  gerekce: "",
  asama: "fikir",
  yapili: true,
  olusturma: id,
  notlar: [],
  isler: [],
  uygulamaOge: null,
  onizleme: null,
  ...ek,
});
const SUZ = {
  ara: "",
  alan: null,
  kategori: null,
  etki: null,
  zahmet: null,
  asama: null,
  siralama: "yeni" as const,
};

describe("fikir süzgeci", () => {
  const l = [
    kart(1, { etki: "dusuk", zahmet: "kucuk", kategori: "Ses", ozet: "zil sesi" }),
    kart(2, { etki: "yuksek", zahmet: "buyuk", kategori: "Koleksiyon" }),
    kart(3, { etki: "yuksek", zahmet: "kucuk", kategori: "Koleksiyon", alan: "rozet" }),
    kart(4, { etki: "orta", zahmet: "orta", asama: "reddedildi" }),
    kart(5, { yapili: false, aciklama: "Eski düz fikir" }),
  ];
  it("arama, alan, kategori, etki, zahmet, aşama", () => {
    expect(fikirSuz(l, { ...SUZ, ara: "ZİL" }).map((f) => f.id)).toEqual([1]);
    expect(fikirSuz(l, { ...SUZ, alan: "rozet" }).map((f) => f.id)).toEqual([3]);
    expect(fikirSuz(l, { ...SUZ, kategori: "Koleksiyon" }).map((f) => f.id)).toEqual([3, 2]);
    expect(fikirSuz(l, { ...SUZ, etki: "yuksek", zahmet: "kucuk" }).map((f) => f.id)).toEqual([3]);
    expect(fikirSuz(l, { ...SUZ, asama: "acik" }).map((f) => f.id)).not.toContain(4);
    expect(fikirSuz(l, { ...SUZ, asama: "reddedildi" }).map((f) => f.id)).toEqual([4]);
  });
  it("sıralama: yeni, etki, kolay kazanç (etki/zahmet)", () => {
    expect(fikirSuz(l, SUZ).map((f) => f.id)).toEqual([5, 4, 3, 2, 1]);
    expect(
      fikirSuz(l, { ...SUZ, siralama: "etki" })
        .map((f) => f.id)
        .slice(0, 2),
    ).toEqual([3, 2]);
    expect(fikirSuz(l, { ...SUZ, siralama: "kolay" }).map((f) => f.id)[0]).toBe(3);
  });
  it("30+ fikirde hızlı", () => {
    const cok = Array.from({ length: 500 }, (_, i) =>
      kart(i, { etki: "orta", zahmet: "orta", kategori: `K${i % 7}` }),
    );
    const t = performance.now();
    for (let i = 0; i < 50; i++) fikirSuz(cok, { ...SUZ, ara: "fikir 4", siralama: "kolay" });
    expect(performance.now() - t).toBeLessThan(500);
  });
});

describe("rapor panosu hesapları", () => {
  const oge = (id: number, rapor: unknown): OgeAyrinti =>
    ({ id, alan: "test", rapor }) as unknown as OgeAyrinti;
  it("yapılandırılmış rapor okunur; eski rapor null (basit kart)", () => {
    expect(raporOku(oge(1, ORNEK_RAPOR))?.bulgular).toHaveLength(1);
    expect(raporOku(oge(1, { ozet: [{ ad: "x", deger: 1 }] }))?.seriler).toEqual([]);
    expect(raporOku(oge(1, { geceTest: [] }))).toBeNull();
    expect(raporOku(oge(1, null))).toBeNull();
  });
  it("kutucuk farkı: kendi önceki değeri ya da önceki rapordaki aynı kutucuk; iyi yön", () => {
    expect(kutucukFarki({ ad: "Takılan", deger: 3, onceki: 5, iyi: "asagi" }, null)).toEqual({
      onceki: 5,
      fark: -2,
      iyi: true,
    });
    const onceki = raporOku(oge(1, { ozet: [{ ad: "Maç", deger: 300 }] }));
    expect(kutucukFarki({ ad: "Maç", deger: 270, iyi: "yukari" }, onceki)).toEqual({
      onceki: 300,
      fark: -30,
      iyi: false,
    });
    expect(kutucukFarki({ ad: "Yeni", deger: 1 }, onceki)).toBeNull();
  });
  it("bulgu farkı: yeni ve çözülen (başlığa göre)", () => {
    const f = bulguFarki(
      [
        { baslik: "A takılıyor", onem: "yuksek" },
        { baslik: "B yavaş", onem: "orta" },
      ],
      [
        { baslik: "a takılıyor ", onem: "kritik" },
        { baslik: "C bozuk", onem: "dusuk" },
      ],
    );
    expect([...f.yeni]).toEqual(["b yavaş"]);
    expect(f.cozulen.map((b) => b.baslik)).toEqual(["C bozuk"]);
  });
  it("eksen basamakları okunur sayılar; sayı biçimi Türkçe", () => {
    expect(eksenBasamaklari(0, 180)).toEqual([0, 50, 100, 150, 200]);
    expect(eksenBasamaklari(0, 1)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(sayiBicimi(1.8)).toBe("1,8");
    expect(sayiBicimi(25_000)).toBe("25 B");
  });
});
