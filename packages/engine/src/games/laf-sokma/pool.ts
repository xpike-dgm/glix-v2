import { type ContentPool, cleanLine, dedupeKey } from "../../content.js";
import type { LegacyContentTone } from "../../game.js";
import { LAF_LEGACY_PROMPTS, LAF_LEGACY_TONES, LAF_PROMPTS } from "./prompts.js";

/** 8 oyunculu maç: her oyuncu için bir düello sorusu + final sorusu. */
const LAF_MAX_PROMPTS = 9;

function makePool(id: string, label: string, hint: string, builtin: readonly string[]): ContentPool<string> {
  return {
    id,
    gameId: "laf-sokma",
    label,
    hint,
    fields: [
      { key: "text", label: "Soru", hint: "soru işaretiyle biten tek cümle", min: 12, max: 90, long: true },
    ],
    min: 20,
    needed: LAF_MAX_PROMPTS,
    builtin,
    fromFields(v) {
      const line = cleanLine(v.text, "Soru", 12, 90);
      if (!line.ok) return line;
      if (!line.entry.endsWith("?")) return { ok: false, error: "Soru, soru işaretiyle bitmeli." };
      return line;
    },
    toFields: (e) => ({ text: e }),
    unpack: (raw) => (typeof raw === "string" ? { text: raw } : null),
    key: (e) => dedupeKey(e),
  };
}

/** Laf Sokma'nın tek soru havuzu. */
export const LAF_POOL: ContentPool<string> = makePool(
  "laf-sokma/sorular",
  "Laf Sokma soruları",
  "Kışkırtıcı ama kaba, cinsel ya da nefret içeren olmayan, açık uçlu soru.",
  LAF_PROMPTS,
);

export const LAF_POOL_LIST: readonly ContentPool<string>[] = [LAF_POOL];

/**
 * Eski ton başına havuzlar: yalnız ton taşıyan eski kayıtların `replay`i içindir (kayıttaki `content` eski
 * havuz kimlikleriyle gelir). Yönetici paneline açılmaz, `CONTENT_POOLS`ta yoktur.
 */
export const LAF_LEGACY_POOLS: Record<LegacyContentTone, ContentPool<string>> = Object.fromEntries(
  LAF_LEGACY_TONES.map((t) => [
    t,
    makePool(`laf-sokma/${t}`, `Laf Sokma soruları (eski ${t})`, "", LAF_LEGACY_PROMPTS[t]),
  ]),
) as Record<LegacyContentTone, ContentPool<string>>;
