import { type ContentPool, cleanLine, cleanWord, dedupeKey, unpackFields } from "../../content.js";
import { SOZLUK_ENTRIES } from "./words.js";

export interface SozlukEntry {
  readonly word: string;
  readonly definition: string;
}

/** Sözlük Blöfü kelime havuzu: kelime + gerçek tanım. Maç başına bir girdi çekilir. */
export const SOZLUK_POOL: ContentPool<SozlukEntry> = {
  id: "sozluk-blofu/kelimeler",
  gameId: "sozluk-blofu",
  label: "Sözlük Blöfü kelimeleri",
  hint: "Az bilinen bir Türkçe sözcük ve onun kısa, gerçek tanımı (ör. TDK'dan elle doğrulanmış).",
  fields: [
    { key: "word", label: "Kelime", hint: "tek sözcük", min: 3, max: 16 },
    {
      key: "definition",
      label: "Gerçek tanım",
      hint: "kısa, küçük harfle başlayan tanım",
      min: 6,
      max: 100,
      long: true,
    },
  ],
  min: 10,
  needed: 1,
  builtin: SOZLUK_ENTRIES,
  fromFields(v) {
    const word = cleanWord(v.word, "Kelime", 3, 16, true);
    if (!word.ok) return word;
    const def = cleanLine(v.definition, "Tanım", 6, 100);
    if (!def.ok) return def;
    if (dedupeKey(def.entry).includes(dedupeKey(word.entry)))
      return { ok: false, error: "Tanım kelimenin kendisini içermemeli." };
    return { ok: true, entry: { word: word.entry, definition: def.entry } };
  },
  toFields: (e) => ({ word: e.word, definition: e.definition }),
  unpack: (raw) => unpackFields(raw, ["word", "definition"]),
  key: (e) => dedupeKey(e.word),
};
