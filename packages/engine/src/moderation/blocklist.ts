/**
 * Serbest metin için küçük, muhafazakâr küfür ve nefret söylemi süzgeci (Türkçe).
 *
 * Amaç hafif kaçamakları (harf değiştirme, noktalama araya koyma, tekrar eden harf) yakalamak ve yaygın
 * kelimeleri yanlışlıkla (ör. "götürmek", "sıkıntı") engellememektir. Liste bilerek kısa tutulmuştur:
 * sahip gözden geçirir, gerektikçe genişletir. Yapay zekâ ya da dış servis kullanmaz.
 */

export type ModerationReason = "profanity" | "hate";

export type ModerationVerdict = { ok: true } | { ok: false; reason: ModerationReason };

const LEET: Record<string, string> = {
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

const FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
  ê: "e",
};

/** Küçük harf, Türkçe harfler ASCII'ye, rakam/simge benzetmeleri harfe, art arda aynı harf teke iner. */
export function foldForModeration(text: string): string {
  const lower = text.normalize("NFC").toLocaleLowerCase("tr-TR");
  let out = "";
  for (const ch of lower) {
    const mapped = FOLD[ch] ?? LEET[ch] ?? ch;
    out += mapped;
  }
  return out.replace(/(\p{L})\1+/gu, "$1");
}

const tokens = (folded: string): string[] => folded.split(/[^a-z]+/u).filter((t) => t.length > 0);
const squash = (folded: string): string => folded.replace(/[^a-z]+/gu, "");
const fold = (word: string): string => foldForModeration(word);

/** Ayırt edici uzun kökler: harfler arasına boşluk/noktalama konsa da (squash) aranır. */
const PROFANITY_STEMS: readonly string[] = ["orospu", "oruspu", "siktir", "pezevenk", "yarrak"].map(fold);

/** Kelime başı eşleşmesi (ek alabilir: "gavatlık"). */
const PROFANITY_PREFIXES: readonly string[] = [
  "orospu",
  "oruspu",
  "siktir",
  "sikeyim",
  "sikerim",
  "yarrak",
  "yarak",
  "amcik",
  "amina",
  "pezevenk",
  "ibne",
  "pust",
  "gavat",
  "kahpe",
  "kaltak",
  "tasak",
  "porno",
  "tecavuz",
].map(fold);

/** Tam kelime eşleşmesi (kısa kelimeler başka sözcüklerin içinde geçebilir). */
const PROFANITY_WORDS: ReadonlySet<string> = new Set(
  [
    "amk",
    "aq",
    "got",
    "gotu",
    "gotum",
    "gotun",
    "gotunu",
    "gotler",
    "gotveren",
    "bok",
    "boku",
    "boktan",
    "boklu",
    "pic",
    "piclik",
    "picler",
    "seks",
    "sex",
  ].map(fold),
);

/** Nefret söylemi: kelime başı eşleşmesi. */
const HATE_PREFIXES: readonly string[] = ["mongol", "zenci", "gavur"].map(fold);

/** Metni süzer. Boş ya da zararsız metin için `{ ok: true }`. */
export function moderateText(text: string): ModerationVerdict {
  const folded = foldForModeration(text);
  const words = tokens(folded);
  for (const w of words) {
    if (HATE_PREFIXES.some((p) => w.startsWith(p))) return { ok: false, reason: "hate" };
  }
  for (const w of words) {
    if (PROFANITY_WORDS.has(w) || PROFANITY_PREFIXES.some((p) => w.startsWith(p))) {
      return { ok: false, reason: "profanity" };
    }
  }
  const squashed = squash(folded);
  if (PROFANITY_STEMS.some((s) => squashed.includes(s))) return { ok: false, reason: "profanity" };
  return { ok: true };
}
