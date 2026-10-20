/**
 * Serbest metin temizliği (sunucuda): denetim ve görünmez karakterler atılır, boşluklar sadeleşir.
 * Karşılaştırma Türkçe büyük harfle (`tr-TR`) yapılır.
 */

// Görünmez/biçim karakterleri: denetim (Cc), biçim (Cf: sıfır genişlikli, yön işaretleri), vekil (Cs),
// özel kullanım (Co), atanmamış (Cn); ayrıca boş görünen Hangul doldurucuları, Braille boşluğu, birleştirici CGJ.
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\u115F\u1160\u3164\uFFA0\u2800\u180E]|\u034F/gu;
const SPACE = /\s/gu;

/** Her türlü boşluk tek aralığa iner, denetim/görünmez karakter atılır, uçlar kırpılır. */
export function sanitizeText(raw: string): string {
  return raw.normalize("NFC").replace(SPACE, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();
}

/** Unicode karakter (kod noktası) sayısı. */
export function charCount(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/**
 * Sahte tanımın kartta görünen biçimi: sözlük girdileri küçük harfle başlar ve noktasız biter; oyuncuların
 * "Cümle gibi" yazışı kartı ele vermesin diye sondaki nokta atılır, ilk harf (kısaltma değilse) küçülür.
 */
export function bluffDisplayForm(raw: string): string {
  let text = sanitizeText(raw).replace(/[.…\s]+$/u, "");
  const chars = [...text];
  const first = chars[0];
  const second = chars[1];
  if (first !== undefined && first !== first.toLocaleLowerCase("tr-TR")) {
    const acronym = second !== undefined && second !== second.toLocaleLowerCase("tr-TR");
    if (!acronym) text = first.toLocaleLowerCase("tr-TR") + chars.slice(1).join("");
  }
  return text;
}

/** Karşılaştırma anahtarı: temizlenmiş, Türkçe büyük harf, noktalama atılmış, boşluk tek. */
export function compareKey(text: string): string {
  return sanitizeText(text)
    .toLocaleUpperCase("tr-TR")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
