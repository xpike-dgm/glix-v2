import { type ContentPool, cleanLine, dedupeKey } from "../../content.js";
import { YAZI_YAZ_TOPICS } from "./topics.js";

/**
 * Yazı Yaz konu havuzu (YY-M1): her oyunda herkese açık bir konu çıkar (ör. MEYVE, MUTFAKTA BULUNUR). Yerleşik liste
 * `topics.ts` (100 konu); sahip yönetici panelinden kapatır, düzenler ya da ekler. "SERBEST" eklenirse o konu çıkınca
 * oyun konusuz oynanır.
 */
export const YAZI_YAZ_TOPIC_POOL: ContentPool<string> = {
  id: "yazi-yaz/konular",
  gameId: "yazi-yaz",
  label: "Yazı Yaz konuları",
  hint: "Yazanların kelimesini seçeceği geniş bir konu (ör. MEYVE, MESLEK, MUTFAKTA BULUNUR). SERBEST: konusuz tur.",
  fields: [{ key: "text", label: "Konu", hint: "ör. MEYVE", min: 2, max: 24 }],
  min: 1,
  needed: 1,
  builtin: YAZI_YAZ_TOPICS,
  fromFields(v) {
    const line = cleanLine(v.text, "Konu", 2, 24);
    if (!line.ok) return line;
    return { ok: true, entry: line.entry.toLocaleUpperCase("tr-TR") };
  },
  toFields: (e) => ({ text: e }),
  unpack: (raw) => (typeof raw === "string" ? { text: raw } : null),
  key: (e) => dedupeKey(e),
};
