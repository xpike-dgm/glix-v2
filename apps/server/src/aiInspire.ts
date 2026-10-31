/**
 * "💡 İlham ver" (Bozuk Telefon ilk cümle adımı, BT-AI1): oyuncu düğmeye basınca sunucu, ortak kısa metin üretimiyle
 * (aiComment.ts `createAiText`) anlık 3 komik, çizilebilir cümle ister. Öneriler yalnız isteyen oyuncunun kişisel
 * anlık görüntüsüne (`MatchSnapshot.inspire`) gider; havuz değildir, oyun bitince unutulur, hiçbir yere yazılmaz.
 * Modele kişisel bilgi gitmez (istem sabittir; oyuncu adı, oda kodu, önceki cümleler yok). Oyun motoru bundan habersizdir.
 */
import {
  bozukTelefon,
  INSPIRE_IDEAS,
  INSPIRE_MAX_REQUESTS,
  INSPIRE_TEXT_MAX,
  type InspireMine,
} from "@glix/engine";
import type { AiPrompt } from "./aiComment.js";

export const INSPIRE_TIMEOUT_MS = 6_000;
export const INSPIRE_PER_MINUTE = 30;
export const INSPIRE_MAX_TOKENS = 200;

/** İlham destekleyen oyun ve adım: Bozuk Telefon'un ilk yazma adımı. */
export const INSPIRE_GAME_ID = bozukTelefon.id;

/** Sunucunun oyun başına tuttuğu kişisel durum (yalnız bellekte). */
export interface InspireEntry {
  used: number;
  pending: boolean;
  failed: boolean;
  ideas: string[];
}

export const freshInspire = (): InspireEntry => ({ used: 0, pending: false, failed: false, ideas: [] });

export function inspireMine(entry: InspireEntry | undefined): InspireMine {
  const e = entry ?? freshInspire();
  return {
    left: Math.max(0, INSPIRE_MAX_REQUESTS - e.used),
    pending: e.pending,
    failed: e.failed,
    ideas: [...e.ideas],
  };
}

/** Ortak görünüm ilk cümle adımında mı (yazma, adım 0). Görünüm doğrulanmamış veridir. */
export function isFirstWriteStep(publicView: unknown): boolean {
  if (typeof publicView !== "object" || publicView === null) return false;
  const v = publicView as { phase?: unknown; step?: unknown };
  return v.phase === "write" && v.step === 0;
}

/** Sabit istem: yalnız görev tarifi; kişisel bilgi yok. */
export function inspirePrompt(): AiPrompt {
  return {
    system:
      "Türkçe bir parti oyunu için yazıyorsun: Bozuk Telefon. Oyuncu kısa bir cümle yazar, arkadaşı onu çizer. " +
      "Görevin: çizimi kolay, komik, aile dostu, birbirinden farklı kısa cümleler önermek. Gerçek kişi, marka, siyaset, " +
      "argo, kaba söz yok.",
    user:
      `Tam ${INSPIRE_IDEAS} cümle öner. Her cümle ayrı satırda, en çok ${INSPIRE_TEXT_MAX} karakter, ` +
      "somut ve çizilebilir bir sahne (ör. KEDİ UZAYDA PİZZA YİYOR). Numara, tırnak, açıklama ya da emoji yazma; " +
      "yalnız cümleler.",
  };
}

/**
 * Yanıtı satır satır önerilere çevirir: numara/madde işareti ve tırnaklar atılır, Türkçe büyük harfe çevrilir;
 * her öneri tek satır, en çok `INSPIRE_TEXT_MAX` karakter, en az bir harf, işaretleme/bağlantı yok, yasaklı kelime
 * yok. En çok `INSPIRE_IDEAS` öneri; hiç geçerli öneri yoksa null.
 */
export function parseIdeas(raw: string | null, isBanned: (text: string) => boolean): string[] | null {
  if (raw === null) return null;
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    let text = line
      .trim()
      .replace(/^(?:[-*•–]|\d+[.)])\s*/u, "")
      .replace(/^["'“”‘’«»„\s]+|["'“”‘’«»„\s.]+$/gu, "")
      .replace(/\s+/g, " ");
    if (text.length === 0) continue;
    text = text.normalize("NFC").toLocaleUpperCase("tr-TR");
    if (Array.from(text).length > INSPIRE_TEXT_MAX) continue;
    if (!/\p{L}/u.test(text)) continue;
    if (/[\p{Cc}\p{Cf}]/u.test(text) || /[<>`*#_[\]{}|\\]/.test(text) || /https?:|www\./i.test(text))
      continue;
    if (/\p{Extended_Pictographic}/u.test(text)) continue;
    if (isBanned(text)) continue;
    if (out.includes(text)) continue;
    out.push(text);
    if (out.length >= INSPIRE_IDEAS) break;
  }
  return out.length > 0 ? out : null;
}
