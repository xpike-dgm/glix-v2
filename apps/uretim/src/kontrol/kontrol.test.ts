import { describe, expect, it } from "vitest";
import { ffmpegVar, lufsOlc, sesAc } from "../medya.js";
import { gecisOlur } from "../ortak/durum.js";
import type { CanliHavuz } from "../oyun.js";
import { pngAc } from "../png.js";
import { gorsel } from "../test/ortam.js";
import { wavYaz } from "../wav.js";
import { motorIslevi } from "./alan.js";
import { alfaAnalizi, GORSEL_PROFILLERI, gorselKontrol, profilBul } from "./gorsel.js";
import { benzerlik, havuzKontrolleri, kalipKontrolleri } from "./metin.js";
import { ornekAnalizi, sesProfili, sesSatirlari } from "./ses.js";

const FFMPEG = await ffmpegVar();
const sonuc = (s: { kod: string; sonuc: string }[], kod: string): string | undefined =>
  s.find((x) => x.kod === kod)?.sonuc;

describe("görsel kontrolleri", () => {
  const cerceve = profilBul("apps/client/public/assets/shop/cerceve/neon.webp");

  it("profil hedef yoldan bulunur", () => {
    expect(cerceve?.ad).toBe("çerçeve");
    expect(profilBul("apps/client/public/assets/badges/x.webp")?.siluet).toBe(48);
    expect(GORSEL_PROFILLERI.length).toBeGreaterThan(5);
  });

  it("oran ±%2 içinde geçer, dışında kalır", () => {
    expect(sonuc(gorselKontrol(pngAc(gorsel(300, 300)), cerceve, "a"), "oran")).toBe("gecti");
    expect(sonuc(gorselKontrol(pngAc(gorsel(300, 305)), cerceve, "a"), "oran")).toBe("gecti");
    expect(sonuc(gorselKontrol(pngAc(gorsel(300, 320)), cerceve, "a"), "oran")).toBe("kaldi");
  });

  it("şeffaf istenen görselde kenar opaksa kalır", () => {
    const dolu = pngAc(gorsel(256, 256, (x) => [x, 100, 50, 255]));
    expect(sonuc(gorselKontrol(dolu, cerceve, "a"), "seffaflik")).toBe("kaldi");
    expect(sonuc(gorselKontrol(pngAc(gorsel(256, 256)), cerceve, "a"), "seffaflik")).toBe("gecti");
  });

  it("boş ve tek renk görsel kalır", () => {
    expect(sonuc(gorselKontrol(pngAc(gorsel(64, 64, () => [0, 0, 0, 0])), null, "a"), "bos")).toBe("kaldi");
    expect(sonuc(gorselKontrol(pngAc(gorsel(64, 64, () => [10, 20, 30, 255])), null, "a"), "tek-renk")).toBe(
      "kaldi",
    );
  });

  it("düşük alfa kalıntısı uyarır", () => {
    const img = pngAc(
      gorsel(100, 100, (x, y) =>
        x > 20 && x < 80 && y > 20 && y < 80 ? [x, y, 90, 255] : x < 10 ? [255, 255, 255, 10] : [0, 0, 0, 0],
      ),
    );
    expect(alfaAnalizi(img).dusukAlfa).toBeGreaterThan(0);
    expect(sonuc(gorselKontrol(img, null, "a"), "dusuk-alfa")).toBe("uyari");
  });

  it("48 px siluet: ince çizgi uyarır, dolu şekil geçer", () => {
    const rozet = profilBul("apps/client/public/assets/badges/x.webp");
    expect(sonuc(gorselKontrol(pngAc(gorsel(256, 256)), rozet, "a"), "siluet")).toBe("gecti");
    const ince = pngAc(
      gorsel(256, 256, (x, y) => (x === 128 && y > 10 && y < 240 ? [255, 255, 255, 255] : [0, 0, 0, 0])),
    );
    expect(sonuc(gorselKontrol(ince, rozet, "a"), "siluet")).toBe("uyari");
  });

  it("sprite şeridi: genişlik kare katı, boş kare kalır", () => {
    const fx = profilBul("apps/client/public/assets/fx/konfeti.webp");
    const iyi = pngAc(
      gorsel(256 * 3, 256, (x, y) =>
        x % 256 > 100 && x % 256 < 150 && y > 100 && y < 150 ? [x % 255, 200, 100, 255] : [0, 0, 0, 0],
      ),
    );
    expect(sonuc(gorselKontrol(iyi, fx, "a"), "izgara")).toBe("gecti");
    const bosKare = pngAc(
      gorsel(256 * 2, 256, (x, y) =>
        x < 256 && x > 100 && x < 150 && y > 100 && y < 150 ? [x % 255, 200, 100, 255] : [0, 0, 0, 0],
      ),
    );
    expect(sonuc(gorselKontrol(bosKare, fx, "a"), "izgara")).toBe("kaldi");
    const kaymis = pngAc(
      gorsel(300, 256, (x, y) =>
        x > 100 && x < 150 && y > 100 && y < 150 ? [x, 200, 100, 255] : [0, 0, 0, 0],
      ),
    );
    expect(sonuc(gorselKontrol(kaymis, fx, "a"), "izgara")).toBe("kaldi");
  });
});

describe("ses kontrolleri", () => {
  const ton = (sn: number, genlik: number, sessizBas = 0): Float32Array => {
    const n = Math.round(48000 * sn);
    return new Float32Array(n).map((_, i) =>
      i < sessizBas * 48000 ? 0 : Math.sin((2 * Math.PI * 440 * i) / 48000) * genlik,
    );
  };
  const bilgi = (s: Float32Array) => ({
    sure: s.length / 48000,
    kanal: 1,
    ornekleme: 48000,
    mono: s,
    monoOrnekleme: 48000,
  });

  it("efekt süresi 2 sn'yi aşarsa kalır; arayüz sesi 0,4 sn", () => {
    expect(sonuc(sesSatirlari(bilgi(ton(1, 0.5)), -16, sesProfili("ses", null, null), "a"), "sure")).toBe(
      "gecti",
    );
    expect(sonuc(sesSatirlari(bilgi(ton(2.5, 0.5)), -16, sesProfili("ses", null, null), "a"), "sure")).toBe(
      "kaldi",
    );
    expect(
      sonuc(sesSatirlari(bilgi(ton(0.6, 0.5)), -16, sesProfili("ses", "x/arayuz/a.ogg", null), "a"), "sure"),
    ).toBe("kaldi");
  });

  it("kırpılma ve baş sessizliği yakalanır", () => {
    const k = ton(1, 1.5).map((v) => Math.max(-1, Math.min(1, v)));
    expect(sonuc(sesSatirlari(bilgi(k), -10, sesProfili("ses", null, null), "a"), "kirpilma")).toBe("kaldi");
    expect(ornekAnalizi(ton(1, 0.5, 0.3), 48000).basSessizlik).toBeGreaterThan(0.25);
    expect(
      sonuc(sesSatirlari(bilgi(ton(1, 0.5, 0.3)), -16, sesProfili("ses", null, null), "a"), "bas-sessizlik"),
    ).toBe("uyari");
  });

  it("müzik: süre 30–120 sn ve döngü dikişi", () => {
    const p = sesProfili("muzik", null, null);
    expect(p.hedefLufs).toBe(-20);
    const dikissiz = ton(31, 0.4).map((v, i, a) => (i > a.length - 2000 ? v * 0.05 : v));
    expect(sonuc(sesSatirlari(bilgi(dikissiz), -20, p, "a"), "dongu-dikisi")).toBe("uyari");
    expect(sonuc(sesSatirlari(bilgi(ton(10, 0.4)), -20, p, "a"), "sure")).toBe("kaldi");
  });

  it("LUFS ölçümü yoksa atlandı", () => {
    expect(sonuc(sesSatirlari(bilgi(ton(1, 0.5)), "yok", sesProfili("ses", null, null), "a"), "lufs")).toBe(
      "atlandi",
    );
  });

  it.skipIf(!FFMPEG)("ffmpeg ile LUFS ölçer ve OGG açar", async () => {
    const w = wavYaz(ton(1, 0.3), 48000);
    const l = await lufsOlc(w, "wav");
    expect(l).not.toBeNull();
    expect(l ?? 0).toBeLessThan(-5);
    expect((await sesAc(w, "wav")).sure).toBeCloseTo(1, 2);
  });
});

describe("havuz kontrolleri (oyunun kendi kuralları)", () => {
  const canli: CanliHavuz[] = [
    {
      id: "sizma/ciftler",
      gameId: "sizma",
      label: "",
      fields: [],
      kayitlar: [{ anahtar: "kahve|çay", alanlar: { a: "çay", b: "kahve" }, kaynak: "yerlesik", acik: true }],
    },
  ];

  it("çiftte aynı ya da iç içe kelime, tekrar ve yasaklı kelime kalır", () => {
    const s = havuzKontrolleri(
      [
        { havuz: "sizma/ciftler", alanlar: { a: "elma", b: "armut" } },
        { havuz: "sizma/ciftler", alanlar: { a: "kahve", b: "çay" } },
        { havuz: "sizma/ciftler", alanlar: { a: "göl", b: "gölet" } },
        { havuz: "sizma/ciftler", alanlar: { a: "elma", b: "armut" } },
        { havuz: "sizma/ciftler", alanlar: { a: "masa", b: "kotukelime" } },
        { havuz: "sizma/ciftler", alanlar: { a: "a", b: "b" } },
        { havuz: "yok/boyle", alanlar: {} },
      ],
      canli,
      ["kotukelime"],
      "canli",
    );
    const satir = (i: number) => s.filter((x) => x.satir === i).map((x) => `${x.kod}:${x.sonuc}`);
    expect(satir(0)).toEqual([]);
    expect(satir(1)).toContain("tekrar:kaldi");
    expect(satir(2)).toContain("cift:kaldi");
    expect(satir(3)).toContain("tekrar:kaldi");
    expect(satir(4)).toContain("yasakli:kaldi");
    expect(satir(5)).toContain("havuz-kurali:kaldi");
    expect(satir(6)).toContain("havuz:kaldi");
  });

  it("tanımda kelimenin kendisi geçerse kalır", () => {
    const s = havuzKontrolleri(
      [
        {
          havuz: "sozluk-blofu/kelimeler",
          alanlar: { word: "pergel", definition: "Pergel ile daire çizilir, çizim aleti." },
        },
      ],
      [],
      [],
      "canli",
    );
    expect(s.some((x) => (x.kod === "tanim" || x.kod === "havuz-kurali") && x.sonuc === "kaldi")).toBe(true);
  });

  it("çok benzer satırlar uyarılır", () => {
    expect(benzerlik("en sevdiğin yemek hangisi", "en sevdiğin yemek hangisidir")).toBeGreaterThan(0.75);
    const s = havuzKontrolleri(
      [
        { havuz: "laf-sokma/sorular", alanlar: { text: "Grupta en geç kalan kim olurdu?" } },
        { havuz: "laf-sokma/sorular", alanlar: { text: "Grupta en geç kalan kim olurdu ki?" } },
      ],
      [],
      [],
      "canli",
    );
    expect(s.some((x) => x.kod === "benzer" && x.sonuc === "uyari") || s.some((x) => x.kod === "havuz")).toBe(
      true,
    );
  });

  it("moderasyon: sık kelimeyi yakalayan kalıp uyarılır", () => {
    const s = kalipKontrolleri(
      [
        { kalip: "am", tur: "kufur" },
        { kalip: "kotukelime", tur: "kufur" },
        { kalip: "x", tur: "yok" },
      ],
      [{ kalip: "kotukelime", tur: "kufur", kaynak: "panel" }],
    );
    expect(s.filter((x) => x.satir === 1).map((x) => x.kod)).toContain("tekrar");
    expect(s.filter((x) => x.satir === 2).map((x) => x.sonuc)).toContain("kaldi");
  });
});

describe("motor doğrulayıcıları", () => {
  it("motorda olmayan işlev null döner (henüz yok)", () => {
    expect(motorIslevi("boyleBirIslevYok")).toBeNull();
  });
});

describe("durum makinesi", () => {
  it("yalnız tanımlı geçişler", () => {
    expect(gecisOlur("bekliyor", "onaylandi")).toBe(true);
    expect(gecisOlur("onaylandi", "havuzda")).toBe(true);
    expect(gecisOlur("havuzda", "pakette")).toBe(true);
    expect(gecisOlur("kaldi", "bekliyor")).toBe(false);
    expect(gecisOlur("reddedildi", "onaylandi")).toBe(false);
    expect(gecisOlur("arsiv", "bekliyor")).toBe(false);
  });
});
