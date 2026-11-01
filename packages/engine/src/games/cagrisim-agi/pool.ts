import { type ContentPool, cleanWord, dedupeKey } from "../../content.js";
import { CAGRISIM_LEVELS, type CagrisimLevel } from "./types.js";
import { CAGRISIM_ENTRIES } from "./words.js";

export interface CagrisimWord {
  /** Tek kelime, büyük harf. */
  readonly text: string;
  /** Zorluk (CG-M5); etiketsiz (eski) girdide null: "orta" sayılır. */
  readonly level: CagrisimLevel | null;
}

/** Metinden zorluğu bulur (büyük/küçük harf duyarsız); boşsa null, tanınmazsa undefined. */
export function cagrisimLevel(raw: string | undefined): CagrisimLevel | null | undefined {
  const key = dedupeKey(raw ?? "");
  if (key === "") return null;
  return CAGRISIM_LEVELS.find((l) => dedupeKey(l) === key);
}

/** Girdinin etkin zorluğu: etiketsiz kelime "orta" sayılır. */
export const levelOf = (w: CagrisimWord): CagrisimLevel => w.level ?? "orta";

/** Çağrışım Ağı ana kelime havuzu: tek kelime, büyük harf, zorluk etiketi. Oyun başına üç kelime çekilir. */
export const CAGRISIM_POOL: ContentPool<CagrisimWord> = {
  id: "cagrisim-agi/kelimeler",
  gameId: "cagrisim-agi",
  label: "Çağrışım Ağı kelimeleri",
  hint:
    "Herkesin aklına birkaç farklı şey getiren tek bir kelime (aile dostu) ve zorluğu: kolay (tek baskın çağrışım), " +
    "orta (iki-üç güçlü çağrışım), zor (dağınık). Zorluk boşsa orta sayılır.",
  fields: [
    { key: "text", label: "Kelime", hint: "tek sözcük", min: 2, max: 16 },
    {
      key: "level",
      label: "Zorluk",
      hint: "kolay, orta ya da zor (boş: orta)",
      min: 0,
      max: 5,
      options: CAGRISIM_LEVELS,
    },
  ],
  min: 10,
  needed: 3,
  builtin: CAGRISIM_ENTRIES,
  playStats: true,
  fromFields(v) {
    const word = cleanWord(v.text, "Kelime", 2, 16, true);
    if (!word.ok) return word;
    const level = cagrisimLevel(v.level);
    if (level === undefined) return { ok: false, error: "Zorluk kolay, orta ya da zor olmalı." };
    return { ok: true, entry: { text: word.entry, level } };
  },
  toFields: (e) => ({ text: e.text, level: e.level ?? "" }),
  // Eski kayıtlar düz metindir (zorluksuz): "orta" sayılır.
  unpack(raw) {
    if (typeof raw === "string") return { text: raw, level: "" };
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.text !== "string") return null;
    if (r.level !== undefined && r.level !== null && typeof r.level !== "string") return null;
    return { text: r.text, level: typeof r.level === "string" ? r.level : "" };
  },
  key: (e) => dedupeKey(e.text),
};
