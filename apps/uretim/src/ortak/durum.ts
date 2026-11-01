/**
 * Öğe durumları ve geçişleri (UM-İ1). Tek kaynak: sunucu her geçişi buradan denetler, arayüz etiketleri buradan alır.
 *
 * gelen → on_kontrolde → bekliyor → onaylandi | reddedildi | duzeltme_istendi
 * onaylandi → havuzda → pakette → oyuna_eklendi → canlida
 *   (Üretim Merkezi 2 adları: kabulde → yöneticide → ana kodda → [paket test'te] → canlıda; kabul havuzu sayfası)
 * Ön kontrolde "kaldı" alan öğe `kaldi` olur: sahibe gitmez, yapay zekâya döner.
 * Tek tık alanlarda (içerik havuzu, moderasyon) havuzdaki öğe aktarımla doğrudan `canlida` olur; geri alınınca `havuzda`.
 * Yeni sürümü gelen eski öğe `arsiv` olur (onaylanmış öğe ise onaylı kalır, yan yana gösterilir).
 */

export const DURUMLAR = [
  "gelen",
  "on_kontrolde",
  "kaldi",
  "bekliyor",
  "onaylandi",
  "reddedildi",
  "duzeltme_istendi",
  "havuzda",
  "pakette",
  "oyuna_eklendi",
  "canlida",
  "arsiv",
] as const;
export type Durum = (typeof DURUMLAR)[number];

export const isDurum = (v: unknown): v is Durum =>
  typeof v === "string" && (DURUMLAR as readonly string[]).includes(v);

export const DURUM_ADI: Record<Durum, string> = {
  gelen: "Gelen",
  on_kontrolde: "Ön kontrolde",
  kaldi: "Geri döndü",
  bekliyor: "Bekliyor",
  onaylandi: "Onaylandı",
  reddedildi: "Reddedildi",
  duzeltme_istendi: "Düzeltme istendi",
  havuzda: "Kabulde",
  pakette: "Yöneticide",
  oyuna_eklendi: "Ana kodda",
  canlida: "Canlıda",
  arsiv: "Arşivde",
};

const GECISLER: Record<Durum, readonly Durum[]> = {
  gelen: ["on_kontrolde"],
  on_kontrolde: ["bekliyor", "kaldi"],
  kaldi: ["arsiv"],
  bekliyor: ["onaylandi", "reddedildi", "duzeltme_istendi", "arsiv"],
  onaylandi: ["havuzda"],
  reddedildi: ["arsiv"],
  duzeltme_istendi: ["arsiv", "bekliyor"],
  havuzda: ["pakette", "canlida"],
  pakette: ["oyuna_eklendi", "havuzda"],
  oyuna_eklendi: ["canlida"],
  canlida: ["havuzda"],
  arsiv: [],
};

export function gecisOlur(from: Durum, to: Durum): boolean {
  return GECISLER[from].includes(to);
}

/** Sahibin karar verebildiği durum. */
export const kararBekliyor = (d: Durum): boolean => d === "bekliyor";

/** Ret ve düzeltme için hazır notlar (UM-İ4). */
export const HAZIR_NOTLAR = [
  { kod: "tarz", metin: "Tarz uymuyor" },
  { kod: "yazi", metin: "Yazı var" },
  { kod: "zor", metin: "Çok zor" },
  { kod: "tekrar", metin: "Tekrar" },
  { kod: "kalitesiz", metin: "Kalitesiz" },
  { kod: "oran", metin: "Oran yanlış" },
  { kod: "alan-disi", metin: "Alan dışı" },
] as const;
export type HazirNotKodu = (typeof HAZIR_NOTLAR)[number]["kod"];
export const isHazirNot = (v: unknown): v is HazirNotKodu =>
  typeof v === "string" && HAZIR_NOTLAR.some((n) => n.kod === v);
export const hazirNotMetni = (k: HazirNotKodu): string => HAZIR_NOTLAR.find((n) => n.kod === k)?.metin ?? k;

/** Bir alanda aynı hazır not bu kadar tekrar edince talimata ekleme önerilir. */
export const TALIMAT_ONERI_ESIGI = 3;
