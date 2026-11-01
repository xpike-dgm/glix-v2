/**
 * Görsel kuralı (sözleşme bölüm 10): görsel üreten alanlarda görseller bir görsel üretim becerisi ya da aracıyla
 * (ör. Codex'in imagegen becerisi, ChatGPT görsel oluşturma) üretilir; Python/PIL, SVG, canvas gibi kodla çizmek
 * yasaktır. Bu metin talimata, kopyalanan isteme, istek → iş taslağına (model ya da kalıp) ve `is_oku` çıktısına kodla
 * eklenir; model çıkaramaz. Teslim `uretimYontemi` bildirir: "kod" bu alanlarda reddedilir, eksikse uyarı verilir.
 *
 * Bu dosya `alanlar.ts`'den değer almaz (döngüsel bağımlılık olmasın); yalnız tip.
 */
import type { AlanId } from "./alanlar.js";

export const GORSEL_ALANLARI: readonly AlanId[] = ["magaza", "rozet", "kartlar", "ikon", "efekt"];
export const gorselAlaniMi = (alan: string): boolean => (GORSEL_ALANLARI as readonly string[]).includes(alan);

export const URETIM_YONTEMLERI = ["gorsel-model", "kod"] as const;
export type UretimYontemi = (typeof URETIM_YONTEMLERI)[number];

/**
 * Alanın referans klasörleri: oyunun canlı varlıklarından (`apps/client/public/assets/<klasör>`) alanın
 * `okunur/referans/<klasör>/` altına salt okunur kopyalanır (deploy/uretim/ssh/referans.sh, referanslar.txt).
 */
export const REFERANS_KLASORLERI: Readonly<Partial<Record<AlanId, readonly string[]>>> = {
  magaza: ["shop", "karakter"],
  rozet: ["badges"],
  kartlar: ["cards"],
  ikon: ["props", "avatars", "mascot", "brand"],
  efekt: ["fx", "props", "worlds"],
};

export const GORSEL_KURALI_BASLIGI = "GÖRSEL KURALI (zorunlu)";
/** İş kısıtlarının başına konan kısa hatırlatma (≤ 200 karakter). */
export const GORSEL_KURALI_KISA =
  "Görseller görsel üretim becerisi/aracıyla üretilir; kodla (PIL, SVG, canvas) çizim yasak. Üretemiyorsan görsel teslim etme, söyle.";

/** Kuralın maddeleri (iş taslağının kısıtlarına da eklenir). */
export function gorselKuraliMaddeleri(alan: AlanId): string[] {
  const ref = (REFERANS_KLASORLERI[alan] ?? []).map((k) => `okunur/referans/${k}/`).join(", ");
  return [
    "Görselleri görsel üretim becerinle ya da aracınla üret (ör. Codex'in imagegen becerisi, ChatGPT görsel oluşturma).",
    "Python/PIL, SVG, canvas ya da benzeri kodla görsel çizme; kodla çizilmiş görsel kabul edilmez.",
    'Bu beceri ortamında yoksa görsel teslim etme ve bunu açıkça yaz: yalnız metin önerisi gönder ("görsel üretilemedi" notuyla) ya da dur.',
    `Kalite çıtası oyundaki mevcut ürünlerdir: üretmeden önce referans görsellere bak${ref ? ` (SSH: ${ref}; MCP: katalog_oku)` : " (katalog_oku)"}.`,
    'Teslimde nasıl ürettiğini bildir: "uretimYontemi": "gorsel-model". "kod" bu alanda reddedilir.',
  ];
}

/** Talimatın ve iş açıklamasının başına konan bölüm (Markdown). */
export function gorselKuraliBolumu(alan: AlanId): string {
  return `## ${GORSEL_KURALI_BASLIGI}\n${gorselKuraliMaddeleri(alan)
    .map((m) => `- **${m}**`)
    .join("\n")}\n`;
}

/** Kopyalanan istemde tek paragraf (öne konur). */
export function gorselKuraliIstemi(alan: AlanId): string {
  return `${GORSEL_KURALI_BASLIGI}: ${gorselKuraliMaddeleri(alan).join(" ")}`;
}
