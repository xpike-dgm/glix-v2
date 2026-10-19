/** Giriş alanında görünen biçim: Türkçe büyük harf, satır sonu/sekme boşluk, en çok 24 karakter. */
export function typedWord(value: string): string {
  return Array.from(value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, " ").toLocaleUpperCase("tr-TR"))
    .slice(0, 24)
    .join("");
}

/** Gönderilebilir mi (en az bir harf ya da rakam). */
export function hasWord(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}
