import { type ContentPool, cleanWord, dedupeKey } from "../../content.js";
import {
  KARALAMA_CLOSENESS,
  KARALAMA_DIRECTIONS,
  type KaralamaCloseness,
  type KaralamaDirection,
} from "./types.js";
import { DRAWING_PAIRS, type DrawingPair, PAIR_CLOSENESS } from "./words.js";

/** Kelime uzunluğu (kod noktası): sızıntı denetimi için gizli değer en az 3 karakter olmalıdır. */
const MIN_WORD_LENGTH = 3;

/** Havuz girdisi: iki kelime, yakınlık etiketi (KD-M6; etiketsiz null = "yakın") ve yön (KD-M4). */
export interface KaralamaPair extends DrawingPair {
  readonly closeness: KaralamaCloseness | null;
  /** true: "Kelime 1" hep çoğunluğun (yön sabit); false (varsayılan): yön rastgele. */
  readonly fixed: boolean;
}

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

/** Seçim metnini bilinen değere çevirir (büyük/küçük harf duyarsız); boşsa null, tanınmazsa undefined. */
function pickOption<T extends string>(options: readonly T[], raw: string | undefined): T | null | undefined {
  const key = dedupeKey(raw ?? "");
  if (key === "") return null;
  return options.find((o) => dedupeKey(o) === key);
}

/** Çiftin etkin yakınlığı: etiketsiz çift "yakın" sayılır. */
export const closenessOf = (p: KaralamaPair): KaralamaCloseness => p.closeness ?? "yakın";

/** Çiftin kelimeleri (tekrar önlemenin kelime hafızası, KD-M5). */
export const pairWordKeys = (p: DrawingPair): string[] => [dedupeKey(p.main), dedupeKey(p.near)];

/** Kelime hafızası kimliği (KD-M5): son 10 oyunda geçen kelimeler; çift havuzundan ayrı tutulur. */
export const KARALAMA_WORD_MEMORY_ID = "karalama-defteri/kelimeler";

const BUILTIN: readonly KaralamaPair[] = DRAWING_PAIRS.filter(isPlayablePair).map((p) => ({
  main: p.main,
  near: p.near,
  closeness: PAIR_CLOSENESS[`${p.main}/${p.near}`] ?? null,
  fixed: false,
}));

/** Karalama Defteri çift havuzu: iki kelime (yön rastgele), yakınlık ve yön alanları. */
export const KARALAMA_POOL: ContentPool<KaralamaPair> = {
  id: "karalama-defteri/ciftler",
  gameId: "karalama-defteri",
  label: "Karalama Defteri kelime çiftleri",
  hint:
    "İkisi de çizilebilen, birbirine yakın iki kelime; oyunda hangisinin çoğunluğa gideceği rastgeledir. Yakınlık: " +
    "çok yakın (çizimle zor ayrılır), yakın, uzak (hiç çekilmez); boşsa yakın sayılır.",
  fields: [
    { key: "main", label: "Kelime 1", hint: "ör. elma", min: 3, max: 16 },
    { key: "near", label: "Kelime 2", hint: "ör. armut", min: 3, max: 16 },
    {
      key: "closeness",
      label: "Yakınlık",
      hint: "çok yakın, yakın ya da uzak (boş: yakın)",
      min: 0,
      max: 9,
      options: KARALAMA_CLOSENESS,
    },
    {
      key: "direction",
      label: "Yön",
      hint: "rastgele ya da sabit (sabit: Kelime 1 hep çoğunluğun; boş: rastgele)",
      min: 0,
      max: 8,
      options: KARALAMA_DIRECTIONS,
    },
  ],
  min: 10,
  needed: 1,
  builtin: BUILTIN,
  playStats: true,
  playKind: "cift",
  related: { id: KARALAMA_WORD_MEMORY_ID, keys: pairWordKeys },
  fromFields(v) {
    const main = cleanWord(v.main, "Kelime 1", 3, 16, false);
    if (!main.ok) return main;
    const near = cleanWord(v.near, "Kelime 2", 3, 16, false);
    if (!near.ok) return near;
    const closeness = pickOption(KARALAMA_CLOSENESS, v.closeness);
    if (closeness === undefined) return { ok: false, error: "Yakınlık çok yakın, yakın ya da uzak olmalı." };
    const direction = pickOption<KaralamaDirection>(KARALAMA_DIRECTIONS, v.direction);
    if (direction === undefined) return { ok: false, error: "Yön rastgele ya da sabit olmalı." };
    const pair: KaralamaPair = {
      main: main.entry,
      near: near.entry,
      closeness,
      fixed: direction === "sabit",
    };
    if (!isPlayablePair(pair)) return { ok: false, error: "Kelimelerden biri ötekinin içinde geçmemeli." };
    return { ok: true, entry: pair };
  },
  toFields: (e) => ({
    main: e.main,
    near: e.near,
    closeness: e.closeness ?? "",
    direction: e.fixed ? "sabit" : "",
  }),
  // Eski kayıtlar yalnız iki kelimedir: yakınlık ve yön boş (yakın, rastgele) sayılır.
  unpack(raw) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.main !== "string" || typeof r.near !== "string") return null;
    const opt = (v: unknown): string | null =>
      v === undefined || v === null ? "" : typeof v === "string" ? v : null;
    const closeness = opt(r.closeness);
    const direction = opt(r.direction);
    if (closeness === null || direction === null) return null;
    return { main: r.main, near: r.near, closeness, direction };
  },
  key: (e) => [dedupeKey(e.main), dedupeKey(e.near)].sort().join("|"),
};
