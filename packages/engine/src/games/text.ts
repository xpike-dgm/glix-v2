/** Serbest kelime girişi için sunucu tarafı temizlik (Yazı Yaz, Kendim ve benzeri oyunlar). */

export const WORD_MAX_LENGTH = 24;

const CONTROL_CHARS = /[\p{Cc}\p{Zl}\p{Zp}]+/gu;
/** Görünmez/yön değiştiren biçim karakterleri, özel kullanım ve yetim vekil. */
const FORBIDDEN_CHARS = /[\p{Cf}\p{Co}\p{Cs}]/u;
/** Zalgo benzeri yığılmayı önler: en çok 2 ardışık birleştirici işaret. */
const MARK_STACK = /\p{M}{3,}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const WHITESPACE_RUN = /\s+/gu;
const RAW_LIMIT = 256;

/**
 * Tek satır kelime girişini temizler: Unicode NFC, satır sonu/sekme boşluğa, boşluklar teke iner ve kırpılır,
 * Türkçe büyük harfe çevrilir. Görünmez/yön değiştiren karakter, birleştirici işaret yığını, harf/rakamsız metin,
 * uzunluk (1..maxLength, kod noktası) geçersizdir: null. Karşılaştırma bu biçimle yapılır.
 */
export function sanitizeWord(value: unknown, maxLength = WORD_MAX_LENGTH): string | null {
  if (typeof value !== "string" || value.length > RAW_LIMIT) return null;
  const clean = value.normalize("NFC").replace(CONTROL_CHARS, " ").replace(WHITESPACE_RUN, " ").trim();
  if (FORBIDDEN_CHARS.test(clean) || MARK_STACK.test(clean) || !LETTER_OR_DIGIT.test(clean)) return null;
  const upper = clean.toLocaleUpperCase("tr-TR");
  const length = Array.from(upper).length;
  if (length < 1 || length > maxLength) return null;
  return upper;
}
