/**
 * Cevap temizliği (sunucuda): games/text.ts ile aynı biçimde denetim ve görünmez karakterler atılır, boşluklar
 * sadeleşir. Cevabın büyük/küçük harfi korunur (esprili vurgu oyuncuya aittir).
 */

const CONTROL_CHARS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
const FORBIDDEN_CHARS = /[\p{Cf}\p{Co}\p{Cs}\p{Cn}]/u;
const MARK_STACK = /\p{M}{3,}/u;
/** Emoji bileşik dizileri için bağlayıcı (ZWJ) serbesttir; öteki biçim karakterleri değil. */
const ZWJ = /\u200d/gu;
/** En az bir harf, rakam ya da emoji (yalnız noktalama/simge cevap sayılmaz). */
const CONTENT = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
const WHITESPACE_RUN = /\s+/gu;

export type AnswerClean =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "invalid" | "too_long" };

/** Unicode karakter (kod noktası) sayısı. */
export function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/**
 * Cevabı temizler: NFC, satır sonu/sekme boşluğa, boşluklar teke iner, uçlar kırpılır.
 * Boş ya da harf/rakamsız metin `empty`, görünmez/yön değiştiren karakter ve birleştirici işaret yığını `invalid`,
 * sınırı aşan metin `too_long` olur.
 */
export function cleanAnswer(raw: string, maxLength: number): AnswerClean {
  const text = raw.normalize("NFC").replace(CONTROL_CHARS, " ").replace(WHITESPACE_RUN, " ").trim();
  if (text === "") return { ok: false, reason: "empty" };
  if (FORBIDDEN_CHARS.test(text.replace(ZWJ, "")) || MARK_STACK.test(text))
    return { ok: false, reason: "invalid" };
  if (!CONTENT.test(text)) return { ok: false, reason: "empty" };
  if (charCount(text) > maxLength) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}
