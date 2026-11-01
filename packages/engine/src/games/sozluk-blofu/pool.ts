import { type ContentPool, cleanLine, cleanWord, dedupeKey, textLength } from "../../content.js";
import { SOZLUK_ENTRIES } from "./words.js";

/** Kelimenin sözlükteki türü (SB-M3); kelimenin altında küçük italik satır olarak görünür. */
export const SOZLUK_WORD_TYPES = ["isim", "sıfat", "fiil", "zarf"] as const;
export type SozlukWordType = (typeof SOZLUK_WORD_TYPES)[number];

export interface SozlukEntry {
  readonly word: string;
  /** Tür; eski (türü girilmemiş) eklenen girdilerde null: tür satırı hiç görünmez. */
  readonly type: SozlukWordType | null;
  readonly definition: string;
}

/** Gerçek tanımın en çok uzunluğu (SB-M6): oyuncunun yazabileceği gibi kısa, tek cümle. */
export const SOZLUK_DEFINITION_MAX = 70;
/** Eski kayıtların okunduğu gevşek sınır (bugünkü havuzu bozmamak için; yeni girdiler 70'e tabidir). */
const DEFINITION_LEGACY_MAX = 100;

/** Metinden türü bulur (büyük/küçük harf ve ı/i duyarsız); boşsa null, tanınmazsa undefined. */
export function sozlukWordType(raw: string | undefined): SozlukWordType | null | undefined {
  const key = dedupeKey(raw ?? "");
  if (key === "") return null;
  return SOZLUK_WORD_TYPES.find((t) => dedupeKey(t) === key);
}

/**
 * Gerçek tanım biçim kuralı (SB-M6): tek cümle, en çok 70 karakter; noktalı virgül, parantez ve "ör." yok. Gerçek kart
 * üslubuyla ele vermesin. Yönetici panelinde yeni eklenen ve düzenlenen girdilere uygulanır; sorun yoksa null.
 */
export function sozlukDefinitionProblem(definition: string): string | null {
  if (
    /[;()]/.test(definition) ||
    /(^|\s)ör\./iu.test(definition) ||
    textLength(definition) > SOZLUK_DEFINITION_MAX
  )
    return `Gerçek tanım kısa ve tek cümle olmalı (en çok ${SOZLUK_DEFINITION_MAX} karakter; ";", "(", ")" ve "ör." yok).`;
  return null;
}

/** Sözlük Blöfü kelime havuzu: kelime + tür + gerçek tanım. Maç başına bir girdi çekilir. */
export const SOZLUK_POOL: ContentPool<SozlukEntry> = {
  id: "sozluk-blofu/kelimeler",
  gameId: "sozluk-blofu",
  label: "Sözlük Blöfü kelimeleri",
  hint: "Az bilinen bir Türkçe sözcük, türü ve onun kısa, tek cümlelik gerçek tanımı (TDK'dan elle doğrulanmış).",
  fields: [
    { key: "word", label: "Kelime", hint: "tek sözcük", min: 3, max: 16 },
    {
      key: "type",
      label: "Tür",
      hint: "isim, sıfat, fiil ya da zarf",
      min: 4,
      max: 5,
      options: SOZLUK_WORD_TYPES,
    },
    {
      key: "definition",
      label: "Gerçek tanım",
      hint: "küçük harfle başlayan tek cümle; ; ( ) yok",
      min: 6,
      max: SOZLUK_DEFINITION_MAX,
      long: true,
    },
  ],
  min: 10,
  needed: 1,
  builtin: SOZLUK_ENTRIES,
  feedback: true,
  fromFields(v) {
    const word = cleanWord(v.word, "Kelime", 3, 16, true);
    if (!word.ok) return word;
    const type = sozlukWordType(v.type);
    if (type === undefined) return { ok: false, error: "Tür isim, sıfat, fiil ya da zarf olmalı." };
    const def = cleanLine(v.definition, "Tanım", 6, DEFINITION_LEGACY_MAX);
    if (!def.ok) return def;
    if (dedupeKey(def.entry).includes(dedupeKey(word.entry)))
      return { ok: false, error: "Tanım kelimenin kendisini içermemeli." };
    return { ok: true, entry: { word: word.entry, type, definition: def.entry } };
  },
  strict(e) {
    if (e.type === null) return "Türü seç: isim, sıfat, fiil ya da zarf.";
    return sozlukDefinitionProblem(e.definition);
  },
  toFields: (e) => ({ word: e.word, type: e.type ?? "", definition: e.definition }),
  // Eski kayıtlarda tür alanı yoktur: boş tür sayılır (tür satırı görünmez).
  unpack(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.word !== "string" || typeof r.definition !== "string") return null;
    if (r.type !== undefined && r.type !== null && typeof r.type !== "string") return null;
    return { word: r.word, type: typeof r.type === "string" ? r.type : "", definition: r.definition };
  },
  key: (e) => dedupeKey(e.word),
};
