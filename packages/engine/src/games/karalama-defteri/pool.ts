import { type ContentPool, cleanWord, dedupeKey, unpackFields } from "../../content.js";
import { DRAWING_PAIRS, type DrawingPair } from "./words.js";

/** Kelime uzunluğu (kod noktası): sızıntı denetimi için gizli değer en az 3 karakter olmalıdır. */
const MIN_WORD_LENGTH = 3;

/**
 * Oynanabilir çift: iki kelime de en az 3 karakter ve biri ötekinin içinde geçmez
 * (aksi halde bir oyuncunun kelimesi ötekinin görünümünde "sızmış" sayılırdı ve ipucu olurdu).
 */
export function isPlayablePair(p: DrawingPair): boolean {
  const main = p.main.toLocaleLowerCase("tr");
  const near = p.near.toLocaleLowerCase("tr");
  return (
    [...p.main].length >= MIN_WORD_LENGTH &&
    [...p.near].length >= MIN_WORD_LENGTH &&
    !main.includes(near) &&
    !near.includes(main)
  );
}

/** Karalama Defteri çift havuzu: `main` çoğunluğa, `near` bilgisiz oyuncuya verilir. */
export const KARALAMA_POOL: ContentPool<DrawingPair> = {
  id: "karalama-defteri/ciftler",
  gameId: "karalama-defteri",
  label: "Karalama Defteri kelime çiftleri",
  hint: "İkisi de çizilebilen, birbirine yakın iki kelime; ana kelime çoğunluğa, yakın kelime bilgisiz oyuncuya verilir.",
  fields: [
    { key: "main", label: "Ana kelime", hint: "ör. elma", min: 3, max: 16 },
    { key: "near", label: "Yakın kelime", hint: "ör. armut", min: 3, max: 16 },
  ],
  min: 10,
  needed: 1,
  builtin: DRAWING_PAIRS.filter(isPlayablePair),
  fromFields(v) {
    const main = cleanWord(v.main, "Ana kelime", 3, 16, false);
    if (!main.ok) return main;
    const near = cleanWord(v.near, "Yakın kelime", 3, 16, false);
    if (!near.ok) return near;
    const pair = { main: main.entry, near: near.entry };
    if (!isPlayablePair(pair)) return { ok: false, error: "Kelimelerden biri ötekinin içinde geçmemeli." };
    return { ok: true, entry: pair };
  },
  toFields: (e) => ({ main: e.main, near: e.near }),
  unpack: (raw) => unpackFields(raw, ["main", "near"]),
  key: (e) => [dedupeKey(e.main), dedupeKey(e.near)].sort().join("|"),
};
