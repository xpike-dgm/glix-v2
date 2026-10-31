/**
 * Kademeli güven (UM-F4): otomatik onaya hiç açılamayan işler. Liste bu dosyadadır; sahip arayüzde bunları açamaz,
 * sunucu da açık olsa bile otomatik onaylamaz.
 */
import type { AlanId } from "./alanlar.js";
import type { TeslimTuru } from "./tipler.js";

export interface AslaOtomatik {
  alan: AlanId | "*";
  tur: TeslimTuru | "*";
  neden: string;
}

export const ASLA_OTOMATIK: readonly AslaOtomatik[] = [
  { alan: "magaza", tur: "yeni", neden: "Yeni mağaza ürünü her zaman sahip onayı ister." },
  { alan: "magaza", tur: "duzenleme", neden: "Fiyat değişikliği her zaman sahip onayı ister." },
  { alan: "kartlar", tur: "duzenleme", neden: "Kart dengesi her zaman sahip onayı ister." },
  { alan: "kartlar", tur: "yeni", neden: "Kart dengesi her zaman sahip onayı ister." },
  { alan: "rozet", tur: "yeni", neden: "Rozet koşulları her zaman sahip onayı ister." },
  { alan: "rozet", tur: "duzenleme", neden: "Rozet koşulları her zaman sahip onayı ister." },
  { alan: "*", tur: "yama", neden: "Kod yamaları her zaman sahip onayı ister." },
  {
    alan: "moderasyon",
    tur: "kaldirma-onerisi",
    neden: "Moderasyon listesinden çıkarma her zaman sahip onayı ister.",
  },
];

export function aslaOtomatik(alan: AlanId, tur: TeslimTuru): AslaOtomatik | null {
  return (
    ASLA_OTOMATIK.find((x) => (x.alan === "*" || x.alan === alan) && (x.tur === "*" || x.tur === tur)) ?? null
  );
}

/** Otomatik onay koşulu: son 50 kararda onay oranı en az %90 (en az 50 karar). */
export const GUVEN_PENCERE = 50;
export const GUVEN_ORAN = 0.9;
/** Her 10 otomatik onaydan biri sahibe denetime gider. */
export const DENETIM_ARALIGI = 10;

/** Sel önleme (UM-F5) varsayılanları. */
export const VARSAYILAN_SINIR = { bekleyenTavan: 30, gunlukKota: 100 };
/** Görsel varyantın en çok sayısı (UM-F2). */
export const EN_COK_VARYANT = 2;
