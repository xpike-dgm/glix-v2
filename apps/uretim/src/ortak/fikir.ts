/**
 * Fikir panosu (Üretim Merkezi 2, aşama 1): yapılandırılmış fikir teslimi ve fikrin yaşam döngüsü.
 *
 * Teslim (`tur: "fikir"`) her öğede: ad (başlık), ozet (tek cümle), kategori, etki (dusuk/orta/yuksek), zahmet
 * (kucuk/orta/buyuk), gerekce; isteğe bağlı küçük önizleme görseli (dosyalar). Eski düz metin fikirler (yalnız ad +
 * aciklama) yine kabul edilir ve basit kart olarak gösterilir.
 *
 * Aşama, kayıtlardan türetilir (elle tutulmaz, bu yüzden kendiliğinden ilerler):
 *   fikir → onaylandi → uygulaniyor → teslim_edildi → kabul_edildi → ana_kodda → canlida
 *   (reddedilen: reddedildi; düzeltme istenen: fikir)
 */

import type { TasarimFikri } from "./tasarim.js";

export const ETKILER = ["dusuk", "orta", "yuksek"] as const;
export type Etki = (typeof ETKILER)[number];
export const ZAHMETLER = ["kucuk", "orta", "buyuk"] as const;
export type Zahmet = (typeof ZAHMETLER)[number];

export const ETKI_ADI: Record<Etki, string> = {
  dusuk: "Düşük etki",
  orta: "Orta etki",
  yuksek: "Yüksek etki",
};
export const ZAHMET_ADI: Record<Zahmet, string> = { kucuk: "Küçük iş", orta: "Orta iş", buyuk: "Büyük iş" };

export interface FikirAlanlari {
  ozet: string;
  kategori: string;
  etki: Etki;
  zahmet: Zahmet;
  /** Oyun Tasarımı kartı (yeni oyun / sistem / oyuna ek; `tasarim.ts`). */
  tasarim?: TasarimFikri;
}

export const FIKIR_ASAMALARI = [
  "fikir",
  "onaylandi",
  "uygulaniyor",
  "teslim_edildi",
  "kabul_edildi",
  "ana_kodda",
  "canlida",
  "reddedildi",
] as const;
export type FikirAsamasi = (typeof FIKIR_ASAMALARI)[number];

export const FIKIR_ASAMA_ADI: Record<FikirAsamasi, string> = {
  fikir: "Fikir",
  onaylandi: "Onaylandı",
  uygulaniyor: "Uygulanıyor",
  teslim_edildi: "Teslim edildi",
  kabul_edildi: "Kabul edildi",
  ana_kodda: "Ana kodda",
  canlida: "Canlıda",
  reddedildi: "Reddedildi",
};

/** Yaşam döngüsünün ilerleyen basamakları (şerit göstergesi için; reddedildi dışarıda). */
export const FIKIR_YOLU: readonly FikirAsamasi[] = FIKIR_ASAMALARI.filter((a) => a !== "reddedildi");

export interface FikirKarti extends Partial<FikirAlanlari> {
  /** Fikir öğesinin kimliği (= teslimlerdeki `fikirId`). */
  id: number;
  alan: string;
  baslik: string;
  aciklama: string;
  gerekce: string;
  asama: FikirAsamasi;
  /** Yapılandırılmış mı (eski düz metin fikir değil). */
  yapili: boolean;
  olusturma: number;
  /** Sahibin "şöyle olsun" notları (en yeni üstte). */
  notlar: string[];
  /** Fikri uygulayan iş(ler) ve teslim edilen öğe. */
  isler: number[];
  uygulamaOge: number | null;
  /** Küçük önizleme görselinin öğe dosya özeti (varsa). */
  onizleme: string | null;
  /** Kartı yazan yapay zekâ (anahtar adı, bildirilen araç ve model). */
  kaynak?: { ad: string; arac: string | null; model: string | null; kanal: string };
  /** Kartın sürümü (Geliştir ile artar) ve eleştiri sayısı (Oyun Tasarımı). */
  surum?: number;
  elestiri?: number;
}

/** Yapay zekâya iş ayrıntısında giden fikir (is_oku). */
export interface UygulanacakFikir {
  fikirId: number;
  baslik: string;
  ozet: string;
  kategori: string;
  etki: string;
  zahmet: string;
  not: string;
}

const temiz = (v: unknown, enAz: number, enCok: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (/\p{Cc}/u.test(t)) return null;
  const n = [...t].length;
  return n >= enAz && n <= enCok ? t : null;
};

/**
 * Öğedeki fikir alanlarını doğrular. Hiçbiri yoksa `null` (eski düz metin fikir). Biri bile varsa hepsi zorunlu.
 */
export function fikirAlanlari(
  v: Record<string, unknown>,
  yer: string,
  hatalar: string[],
): FikirAlanlari | null {
  const anahtarlar = ["ozet", "kategori", "etki", "zahmet"] as const;
  if (anahtarlar.every((k) => v[k] === undefined)) return null;
  const ozet = temiz(v.ozet, 3, 160);
  const kategori = temiz(v.kategori, 1, 30);
  const etki = (ETKILER as readonly unknown[]).includes(v.etki) ? (v.etki as Etki) : null;
  const zahmet = (ZAHMETLER as readonly unknown[]).includes(v.zahmet) ? (v.zahmet as Zahmet) : null;
  if (!ozet) hatalar.push(`${yer}: "ozet" tek cümle olmalı (3–160 karakter).`);
  if (!kategori) hatalar.push(`${yer}: "kategori" 1–30 karakter olmalı.`);
  if (!etki) hatalar.push(`${yer}: "etki" dusuk, orta ya da yuksek olmalı.`);
  if (!zahmet) hatalar.push(`${yer}: "zahmet" kucuk, orta ya da buyuk olmalı.`);
  return ozet && kategori && etki && zahmet ? { ozet, kategori, etki, zahmet } : null;
}

/**
 * Aşamayı kayıtlardan türetir.
 * @param durum fikir öğesinin durumu
 * @param isAcik fikre bağlı açık ya da tamamlanmış iş var mı
 * @param uygulama fikri uygulayan en son öğenin durumu (yoksa null)
 */
export function fikirAsamasi(durum: string, isVar: boolean, uygulama: string | null): FikirAsamasi {
  if (durum === "reddedildi" || durum === "arsiv") return "reddedildi";
  if (durum === "bekliyor" || durum === "duzeltme_istendi" || durum === "gelen" || durum === "on_kontrolde")
    return "fikir";
  if (uygulama) {
    if (uygulama === "canlida") return "canlida";
    if (uygulama === "oyuna_eklendi") return "ana_kodda";
    // Yöneticiye gönderilmiş (pakette) olan hâlâ kabul edilmiş sayılır; ana koda girince ilerler.
    if (uygulama === "onaylandi" || uygulama === "havuzda" || uygulama === "pakette") return "kabul_edildi";
    if (uygulama === "bekliyor") return "teslim_edildi";
  }
  return isVar ? "uygulaniyor" : "onaylandi";
}
