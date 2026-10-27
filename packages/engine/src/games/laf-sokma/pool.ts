import { type ContentPool, cleanLine, dedupeKey } from "../../content.js";
import { LAF_PROMPTS, LAF_TONES, type LafTone } from "./prompts.js";

const TONE_NAMES: Record<LafTone, string> = { aile: "Aile", arkadas: "Arkadaş", ofis: "Ofis" };
const TONE_HINTS: Record<LafTone, string> = {
  aile: "Çocukların da oynayabileceği masum esprili, açık uçlu soru.",
  arkadas: "Kışkırtıcı ama kaba, cinsel ya da nefret içeren olmayan, açık uçlu soru.",
  ofis: "İş yerinde rahatça sorulabilecek, açık uçlu soru.",
};

/** 8 oyunculu maç: her oyuncu için bir düello sorusu + final sorusu. */
const LAF_MAX_PROMPTS = 9;

function makePool(tone: LafTone): ContentPool<string> {
  return {
    id: `laf-sokma/${tone}`,
    gameId: "laf-sokma",
    label: `Laf Sokma soruları (${TONE_NAMES[tone]})`,
    hint: TONE_HINTS[tone],
    fields: [
      { key: "text", label: "Soru", hint: "soru işaretiyle biten tek cümle", min: 12, max: 90, long: true },
    ],
    min: 20,
    needed: LAF_MAX_PROMPTS,
    builtin: LAF_PROMPTS[tone],
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

/** Ton -> Laf Sokma soru havuzu. Oyun, odanın tonuna karşılık gelen havuzu okur. */
export const LAF_POOLS: Record<LafTone, ContentPool<string>> = {
  aile: makePool("aile"),
  arkadas: makePool("arkadas"),
  ofis: makePool("ofis"),
};

export const LAF_POOL_LIST: readonly ContentPool<string>[] = LAF_TONES.map((t) => LAF_POOLS[t]);
