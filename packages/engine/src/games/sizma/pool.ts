import { type ContentPool, cleanWord, dedupeKey, unpackFields } from "../../content.js";
import { SIZMA_PAIRS } from "./words.js";

export type SizmaPair = readonly [string, string];

/** Sızma çift havuzu: birbirine yakın ama farklı iki gündelik isim. Maç başına bir çift çekilir (taraf rastgele). */
export const SIZMA_POOL: ContentPool<SizmaPair> = {
  id: "sizma/ciftler",
  gameId: "sizma",
  label: "Sızma kelime çiftleri",
  hint: "Birbirine yakın ama farklı iki gündelik isim; biri çoğunluğa, öteki sızana verilir.",
  fields: [
    { key: "a", label: "Birinci kelime", hint: "ör. çay", min: 2, max: 16 },
    { key: "b", label: "İkinci kelime", hint: "ör. kahve", min: 2, max: 16 },
  ],
  min: 10,
  needed: 1,
  builtin: SIZMA_PAIRS,
  fromFields(v) {
    const a = cleanWord(v.a, "Birinci kelime", 2, 16, false);
    if (!a.ok) return a;
    const b = cleanWord(v.b, "İkinci kelime", 2, 16, false);
    if (!b.ok) return b;
    if (dedupeKey(a.entry) === dedupeKey(b.entry))
      return { ok: false, error: "İki kelime birbirinden farklı olmalı." };
    return { ok: true, entry: [a.entry, b.entry] };
  },
  toFields: (e) => ({ a: e[0], b: e[1] }),
  unpack(raw) {
    if (Array.isArray(raw) && raw.length === 2 && typeof raw[0] === "string" && typeof raw[1] === "string")
      return { a: raw[0], b: raw[1] };
    return unpackFields(raw, ["a", "b"]);
  },
  key: (e) => [dedupeKey(e[0]), dedupeKey(e[1])].sort().join("|"),
};
