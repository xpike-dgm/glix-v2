/**
 * Rapor panosu biçimi (Üretim Merkezi 2, aşama 1): `tur: "rapor"` teslimin öğesindeki `rapor` nesnesi.
 *
 *   rapor: {
 *     baslik?: string, donem?: string,
 *     ozet:     [{ ad, deger: number, birim?, onceki?: number, iyi?: "yukari" | "asagi" }],   // kutucuklar
 *     seriler:  [{ ad, tur: "cizgi" | "cubuk", birim?, etiketler: string[], degerler: number[], esik?: number }],
 *     tablolar: [{ ad, sutunlar: string[], satirlar: (string | number)[][] }],
 *     bulgular: [{ baslik, onem: "kritik" | "yuksek" | "orta" | "dusuk", oyun?, adimlar?: string[], kanit?, oneri?,
 *                  siklik?: number }]
 *   }
 *
 * Bu dört anahtardan biri varsa nesne yapılandırılmış sayılır ve sıkı doğrulanır. Yoksa (eski düz metin ya da eski
 * `geceTest/hatalar/performans` biçimi) olduğu gibi kabul edilir ve basit kart olarak gösterilir.
 */

export const ONEMLER = ["kritik", "yuksek", "orta", "dusuk"] as const;
export type Onem = (typeof ONEMLER)[number];
export const ONEM_ADI: Record<Onem, string> = {
  kritik: "Kritik",
  yuksek: "Yüksek",
  orta: "Orta",
  dusuk: "Düşük",
};

export interface RaporKutucuk {
  ad: string;
  deger: number;
  birim?: string;
  onceki?: number;
  iyi?: "yukari" | "asagi";
}
export interface RaporSeri {
  ad: string;
  tur: "cizgi" | "cubuk";
  birim?: string;
  etiketler: string[];
  degerler: number[];
  esik?: number;
}
export interface RaporTablo {
  ad: string;
  sutunlar: string[];
  satirlar: (string | number)[][];
}
export interface RaporBulgu {
  baslik: string;
  onem: Onem;
  oyun?: string;
  adimlar?: string[];
  kanit?: string;
  oneri?: string;
  siklik?: number;
}
export interface YapiliRapor {
  baslik?: string;
  donem?: string;
  ozet: RaporKutucuk[];
  seriler: RaporSeri[];
  tablolar: RaporTablo[];
  bulgular: RaporBulgu[];
}

const ANAHTARLAR = ["ozet", "seriler", "tablolar", "bulgular"] as const;
const kayitMi = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Yapılandırılmış rapor mu (dört anahtardan biri). */
export const yapiliRaporMu = (v: unknown): boolean =>
  kayitMi(v) && ANAHTARLAR.some((k) => v[k] !== undefined);

const metin = (v: unknown, enCok: number, enAz = 1): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/(?![\n\t])\p{Cc}/u.test(t)) return null;
  const n = [...t].length;
  return n >= enAz && n <= enCok ? t : null;
};
const sayi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Yapılandırılmış raporu doğrular; hatalar `yer` önekiyle. */
export function raporDogrula(v: unknown, yer: string, hatalar: string[]): YapiliRapor | null {
  if (!kayitMi(v)) {
    hatalar.push(`${yer}: rapor bir nesne olmalı.`);
    return null;
  }
  const once = hatalar.length;
  const bilinen = new Set(["baslik", "donem", ...ANAHTARLAR]);
  for (const k of Object.keys(v))
    if (!bilinen.has(k)) hatalar.push(`${yer}: rapor içinde bilinmeyen alan "${k.slice(0, 30)}".`);
  const liste = (k: string, enCok: number): unknown[] => {
    const x = v[k];
    if (x === undefined) return [];
    if (!Array.isArray(x) || x.length > enCok) {
      hatalar.push(`${yer}: rapor.${k} en çok ${enCok} öğelik liste olmalı.`);
      return [];
    }
    return x;
  };
  const r: YapiliRapor = { ozet: [], seriler: [], tablolar: [], bulgular: [] };
  if (v.baslik !== undefined) {
    const b = metin(v.baslik, 120);
    if (b) r.baslik = b;
    else hatalar.push(`${yer}: rapor.baslik 1–120 karakter.`);
  }
  if (v.donem !== undefined) {
    const d = metin(v.donem, 60);
    if (d) r.donem = d;
    else hatalar.push(`${yer}: rapor.donem 1–60 karakter.`);
  }
  liste("ozet", 12).forEach((x, i) => {
    const y = `${yer}: rapor.ozet[${i}]`;
    if (!kayitMi(x) || !metin(x.ad, 40) || !sayi(x.deger)) {
      hatalar.push(`${y} { ad, deger: sayı } olmalı.`);
      return;
    }
    const k: RaporKutucuk = { ad: metin(x.ad, 40) ?? "", deger: x.deger };
    if (x.birim !== undefined) {
      const b = metin(x.birim, 12);
      if (b) k.birim = b;
      else hatalar.push(`${y}.birim en çok 12 karakter.`);
    }
    if (x.onceki !== undefined) {
      if (sayi(x.onceki)) k.onceki = x.onceki;
      else hatalar.push(`${y}.onceki sayı olmalı.`);
    }
    if (x.iyi !== undefined) {
      if (x.iyi === "yukari" || x.iyi === "asagi") k.iyi = x.iyi;
      else hatalar.push(`${y}.iyi "yukari" ya da "asagi" olmalı.`);
    }
    r.ozet.push(k);
  });
  liste("seriler", 12).forEach((x, i) => {
    const y = `${yer}: rapor.seriler[${i}]`;
    if (!kayitMi(x) || !metin(x.ad, 60) || (x.tur !== "cizgi" && x.tur !== "cubuk")) {
      hatalar.push(`${y} { ad, tur: "cizgi" | "cubuk", etiketler, degerler } olmalı.`);
      return;
    }
    const et = x.etiketler;
    const dg = x.degerler;
    if (
      !Array.isArray(et) ||
      !Array.isArray(dg) ||
      dg.length < 1 ||
      dg.length > 200 ||
      et.length !== dg.length ||
      !dg.every(sayi) ||
      !et.every((e) => metin(typeof e === "number" ? String(e) : e, 24) !== null)
    ) {
      hatalar.push(`${y}: etiketler ve degerler aynı uzunlukta (1–200) olmalı; değerler sayı.`);
      return;
    }
    const s: RaporSeri = {
      ad: metin(x.ad, 60) ?? "",
      tur: x.tur,
      etiketler: et.map((e) => String(e).trim()),
      degerler: dg as number[],
    };
    if (x.birim !== undefined) {
      const b = metin(x.birim, 12);
      if (b) s.birim = b;
      else hatalar.push(`${y}.birim en çok 12 karakter.`);
    }
    if (x.esik !== undefined) {
      if (sayi(x.esik)) s.esik = x.esik;
      else hatalar.push(`${y}.esik sayı olmalı.`);
    }
    r.seriler.push(s);
  });
  liste("tablolar", 8).forEach((x, i) => {
    const y = `${yer}: rapor.tablolar[${i}]`;
    if (
      !kayitMi(x) ||
      !metin(x.ad, 60) ||
      !Array.isArray(x.sutunlar) ||
      x.sutunlar.length < 1 ||
      x.sutunlar.length > 12 ||
      !x.sutunlar.every((s) => metin(s, 40) !== null) ||
      !Array.isArray(x.satirlar) ||
      x.satirlar.length > 200
    ) {
      hatalar.push(`${y} { ad, sutunlar (1–12), satirlar (≤ 200) } olmalı.`);
      return;
    }
    const n = x.sutunlar.length;
    const satirlar: (string | number)[][] = [];
    for (const s of x.satirlar) {
      if (
        !Array.isArray(s) ||
        s.length !== n ||
        !s.every((h) => sayi(h) || (typeof h === "string" && [...h].length <= 200))
      ) {
        hatalar.push(`${y}: her satır ${n} hücre (metin ya da sayı) olmalı.`);
        return;
      }
      satirlar.push(s as (string | number)[]);
    }
    r.tablolar.push({
      ad: metin(x.ad, 60) ?? "",
      sutunlar: (x.sutunlar as string[]).map((s) => s.trim()),
      satirlar,
    });
  });
  liste("bulgular", 100).forEach((x, i) => {
    const y = `${yer}: rapor.bulgular[${i}]`;
    if (!kayitMi(x) || !metin(x.baslik, 140) || !(ONEMLER as readonly unknown[]).includes(x.onem)) {
      hatalar.push(`${y} { baslik, onem: kritik | yuksek | orta | dusuk } olmalı.`);
      return;
    }
    const b: RaporBulgu = { baslik: metin(x.baslik, 140) ?? "", onem: x.onem as Onem };
    const ek = (k: "oyun" | "kanit" | "oneri", enCok: number): void => {
      if (x[k] === undefined) return;
      const t = metin(x[k], enCok);
      if (t) b[k] = t;
      else hatalar.push(`${y}.${k} en çok ${enCok} karakter.`);
    };
    ek("oyun", 60);
    ek("kanit", 2000);
    ek("oneri", 600);
    if (x.adimlar !== undefined) {
      if (Array.isArray(x.adimlar) && x.adimlar.length <= 20 && x.adimlar.every((a) => metin(a, 300)))
        b.adimlar = (x.adimlar as string[]).map((a) => a.trim());
      else hatalar.push(`${y}.adimlar en çok 20 kısa adım olmalı.`);
    }
    if (x.siklik !== undefined) {
      if (sayi(x.siklik) && x.siklik >= 0) b.siklik = x.siklik;
      else hatalar.push(`${y}.siklik sayı olmalı.`);
    }
    r.bulgular.push(b);
  });
  if (!r.ozet.length && !r.seriler.length && !r.tablolar.length && !r.bulgular.length)
    hatalar.push(`${yer}: rapor boş (ozet, seriler, tablolar ya da bulgular gerekli).`);
  return hatalar.length === once ? r : null;
}

/** Örnek rapor (ornek-paket, talimat ve testler). */
export const ORNEK_RAPOR: YapiliRapor = {
  baslik: "Gece testi — 1 Kasım",
  donem: "31 Ekim 22:00 – 1 Kasım 06:00",
  ozet: [
    { ad: "Oynanan maç", deger: 270, onceki: 240, iyi: "yukari" },
    { ad: "Takılan maç", deger: 3, onceki: 5, iyi: "asagi" },
    { ad: "Ortalama tur süresi", deger: 1.8, birim: "sn", onceki: 2.1, iyi: "asagi" },
  ],
  seriler: [
    {
      ad: "Tur başına yanıt süresi",
      tur: "cizgi",
      birim: "ms",
      etiketler: ["22:00", "00:00", "02:00", "04:00", "06:00"],
      degerler: [120, 135, 180, 150, 128],
      esik: 200,
    },
    {
      ad: "Oyuna göre takılma",
      tur: "cubuk",
      etiketler: ["Butona Bas", "Kara Borsa", "Sızma"],
      degerler: [0, 2, 1],
    },
  ],
  tablolar: [
    {
      ad: "Oyuncu sayısına göre",
      sutunlar: ["Oyuncu", "Maç", "Takılan"],
      satirlar: [
        [3, 90, 0],
        [5, 90, 1],
        [8, 90, 2],
      ],
    },
  ],
  bulgular: [
    {
      baslik: "Kara Borsa'da 8 oyuncuyla açık artırma evresi takılıyor",
      onem: "yuksek",
      oyun: "kara-borsa",
      adimlar: [
        "8 oyuncuyla oda aç",
        "İlk turda herkes aynı anda teklif versin",
        "Evre 30 sn sonra geçmiyor",
      ],
      kanit: "maç 4812, 02:14 kaydı",
      oneri: "Eş zamanlı tekliflerde sıra kilidi.",
      siklik: 2,
    },
  ],
};
