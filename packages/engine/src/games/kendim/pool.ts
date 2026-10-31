import { type ContentPool, cleanLine, dedupeKey, unpackFields } from "../../content.js";
import { KENDIM_TOPICS } from "./topics.js";
import type { KendimTopic } from "./types.js";

/**
 * Kendim konu havuzu (KN-M2): her oyunda bir konu kartı çekilir ("Hayvan olsaydın?"), herkes kendini o konuyla tek
 * kelimeyle anlatır. Yerleşik liste `topics.ts`; sahip yönetici panelinden kapatır, düzenler ya da ekler. Etkin liste
 * boşsa bugünkü konu ("Kendini anlat | Ben…") kullanılır.
 */
export const KENDIM_TOPIC_POOL: ContentPool<KendimTopic> = {
  id: "kendim/konular",
  gameId: "kendim",
  label: "Kendim konuları",
  hint: "Herkesin kendini tek kelimeyle anlatacağı konu ve yazı kutusundaki ipucu (ör. Hayvan olsaydın? | Ben bir…).",
  fields: [
    { key: "topic", label: "Konu", hint: "ör. Hayvan olsaydın?", min: 3, max: 40 },
    { key: "hint", label: "İpucu", hint: "ör. Ben bir…", min: 2, max: 16 },
  ],
  min: 1,
  needed: 1,
  builtin: KENDIM_TOPICS,
  fromFields(v) {
    const topic = cleanLine(v.topic, "Konu", 3, 40);
    if (!topic.ok) return topic;
    const hint = cleanLine(v.hint, "İpucu", 2, 16);
    if (!hint.ok) return hint;
    return { ok: true, entry: { topic: topic.entry, hint: hint.entry } };
  },
  toFields: (e) => ({ topic: e.topic, hint: e.hint }),
  unpack: (raw) => unpackFields(raw, ["topic", "hint"]),
  key: (e) => dedupeKey(e.topic),
};
