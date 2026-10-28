import { type ContentPool, cleanWord, dedupeKey } from "../../content.js";
import { CAGRISIM_WORDS } from "./words.js";

/** Çağrışım Ağı ana kelime havuzu: tek kelime, büyük harf. Maç başına bir kelime çekilir. */
export const CAGRISIM_POOL: ContentPool<string> = {
  id: "cagrisim-agi/kelimeler",
  gameId: "cagrisim-agi",
  label: "Çağrışım Ağı kelimeleri",
  hint: "Herkesin aklına birkaç farklı şey getiren tek bir kelime (aile dostu).",
  fields: [{ key: "text", label: "Kelime", hint: "tek sözcük", min: 2, max: 16 }],
  min: 10,
  needed: 1,
  builtin: CAGRISIM_WORDS,
  fromFields(v) {
    return cleanWord(v.text, "Kelime", 2, 16, true);
  },
  toFields: (e) => ({ text: e }),
  unpack: (raw) => (typeof raw === "string" ? { text: raw } : null),
  key: (e) => dedupeKey(e),
};
