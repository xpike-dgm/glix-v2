/**
 * Yönetici yasaklı kelime listesi için eşleştirme (kullanıcı adı ve misafir takma adı denetimi).
 *
 * Normalleştirme: Türkçe küçük harf, aksan/nokta işaretleri atılır (ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u), basit harf
 * benzetmeleri çevrilir (0→o 1→i 3→e 4→a 5→s 7→t, @→a, $→s, !→i), harf olmayan her şey ayraç sayılır ve atılır.
 *
 * Eşleştirme: 4+ harfli kelime, ayraçsız metnin içinde geçerse yakalanır ("S.i.k.t.1.r" gibi araya konan işaretler
 * boşa gider). 3 harf ve altı kelimeler başka sözcüklerin içinde geçebileceğinden yalnız bütün ad ya da ayraçla
 * ayrılmış bir sözcük olarak yakalanır ("kamkum" takılmaz, "a m k" ve "Ali_amk" takılır).
 * Serbest oyun metnine uygulanmaz (oyunlardaki metin için bkz. blocklist.ts).
 */

/** Listedeki en çok kelime ve bir kelimenin en çok uzunluğu (karakter). */
export const BANNED_WORDS_MAX = 500;
export const BANNED_WORD_LENGTH_MAX = 40;
/** Normalleştirilmiş kelimenin en az uzunluğu: tek harfli kelime herkesi engellerdi. */
export const BANNED_WORD_FOLDED_MIN = 2;
/** Bu uzunluk ve üstü kelimeler ayraçsız metnin içinde aranır; altı yalnız bütün ad / sözcük olarak. */
const SUBSTRING_FROM = 4;

const MAP: Readonly<Record<string, string>> = {
  ı: "i",
  ş: "s",
  ğ: "g",
  ç: "c",
  ö: "o",
  ü: "u",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

export interface Folded {
  /** Ayraçsız, yalnız a-z. */
  squashed: string;
  /** a-z olmayan her şeyden bölünmüş sözcükler. */
  tokens: string[];
}

/** Metni eşleştirme biçimine çevirir. */
export function foldBanned(text: string): Folded {
  const lower = text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("tr-TR");
  let out = "";
  for (const ch of lower) {
    const mapped = MAP[ch] ?? ch;
    out += /^[a-z]$/.test(mapped) ? mapped : " ";
  }
  const tokens = out.split(" ").filter((t) => t.length > 0);
  return { squashed: tokens.join(""), tokens };
}

/** Listeye eklenecek kelimeyi doğrular: kırpılmış, 1-40 karakter, denetim karakteri yok, normalleşince ≥2 harf. */
export function cleanBannedWord(value: unknown): { word: string; folded: string } | null {
  if (typeof value !== "string") return null;
  const word = value.replace(/\s+/gu, " ").trim();
  const length = Array.from(word).length;
  if (length < 1 || length > BANNED_WORD_LENGTH_MAX || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/u.test(word))
    return null;
  const folded = foldBanned(word).squashed;
  return folded.length >= BANNED_WORD_FOLDED_MIN ? { word, folded } : null;
}

/** `text` listedeki (normalleştirilmiş) kelimelerden birine takılıyor mu. */
export function matchesBanned(text: string, foldedWords: readonly string[]): boolean {
  if (foldedWords.length === 0) return false;
  const { squashed, tokens } = foldBanned(text);
  if (squashed === "") return false;
  for (const w of foldedWords) {
    if (w.length >= SUBSTRING_FROM) {
      if (squashed.includes(w)) return true;
    } else if (squashed === w || tokens.includes(w)) return true;
  }
  return false;
}
