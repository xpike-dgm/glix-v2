import { createRng, type Rng } from "../rng.js";
import { CARDS, type CardId, type CardRarity } from "./catalog.js";

/** Karma tohum: parçaları sıralı birleştirip FNV-1a ile özetler. Aynı girdi her zaman aynı sayıyı verir. */
export function hashSeed(parts: readonly (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join("\u0001")) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Maç tohumundan, olaya özgü bağımsız bir rastgelelik üretir (durum içinde saklanan akış yoktur; tekrar oynatma birebir). */
export function deriveRng(seed: number, ...parts: (number | string)[]): Rng {
  return createRng(hashSeed([seed, ...parts]));
}

export type Half = "ust" | "alt" | "notr";

/**
 * Üst/alt yarı (docs/KURALLAR.md K2.3): kendinden kesin yüksek puanlı sayısı n/2'den azsa üst, kendinden kesin düşük
 * sayısı n/2'den azsa alt; ikisi birden doğruysa nötr.
 */
export function halfOf(
  playerId: string,
  scores: Readonly<Record<string, number>>,
  ids: readonly string[],
): Half {
  const mine = scores[playerId] ?? 0;
  const n = ids.length;
  let higher = 0;
  let lower = 0;
  for (const id of ids) {
    const s = scores[id] ?? 0;
    if (s > mine) higher++;
    else if (s < mine) lower++;
  }
  const top = higher * 2 < n;
  const bottom = lower * 2 < n;
  if (top && bottom) return "notr";
  return top ? "ust" : "alt";
}

/** Kötü kart olasılığı (gizli): taban %30, üst yarı %35, alt yarı %25. */
export function badChance(half: Half): number {
  return half === "ust" ? 0.35 : half === "alt" ? 0.25 : 0.3;
}

/** Kötü olmayan yuva için nadirlik ağırlıkları (yüzde): normal 70/25/5, alt yarı 60/32/8; `boost` nadir ve efsanevi ağırlığını iki katlar. */
export function rarityWeights(half: Half, boost: boolean): Record<"siradan" | "nadir" | "efsanevi", number> {
  const base =
    half === "alt" ? { siradan: 60, nadir: 32, efsanevi: 8 } : { siradan: 70, nadir: 25, efsanevi: 5 };
  return boost ? { siradan: base.siradan, nadir: base.nadir * 2, efsanevi: base.efsanevi * 2 } : base;
}

export interface DrawParams {
  /** Etkin kartlar. */
  enabled: readonly CardId[];
  half: Half;
  /** Lanetli Hediye: bu çekilişte nadir ve efsanevi ağırlığı iki katı. */
  boost: boolean;
  /** İstenen seçenek sayısı (3 ya da 4). */
  count: number;
}

/** Ağırlıklı seçim; ağırlığı 0 olanlar hiç seçilmez. */
function weighted<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = (Object.entries(weights) as [T, number][]).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rng.next() * total;
  for (const [key, w] of entries) {
    if (x < w) return key;
    x -= w;
  }
  return (entries[entries.length - 1] as [T, number])[0];
}

/**
 * Bir oyuncunun seçeneklerini çeker (K2): her yuva önce kötü mü iyi mi, sonra nadirlik, sonra kart.
 * Aynı kart iki kez çıkmaz; çekilebilir kart kalmadıysa seçenek sayısı azalır. Çekim yalnız `rng`e bağlıdır.
 */
export function drawOptions(rng: Rng, params: DrawParams): CardId[] {
  const out: CardId[] = [];
  const left = (rarity: CardRarity): CardId[] =>
    params.enabled.filter((id) => CARDS[id].rarity === rarity && !out.includes(id));
  for (let slot = 0; slot < params.count; slot++) {
    const bad = left("kotu");
    const pools: Record<"siradan" | "nadir" | "efsanevi", CardId[]> = {
      siradan: left("siradan"),
      nadir: left("nadir"),
      efsanevi: left("efsanevi"),
    };
    const goodCount = pools.siradan.length + pools.nadir.length + pools.efsanevi.length;
    if (bad.length + goodCount === 0) break;
    const takeBad = bad.length > 0 && (goodCount === 0 || rng.next() < badChance(params.half));
    let pool: CardId[];
    if (takeBad) pool = bad;
    else {
      const w = rarityWeights(params.half, params.boost);
      // Çekilebilir kartı kalmamış nadirlik elenir; kalanlar yeniden normalleşir (ağırlıklı seçim toplamla böler).
      for (const r of ["siradan", "nadir", "efsanevi"] as const) if (pools[r].length === 0) w[r] = 0;
      pool = pools[weighted(rng, w)];
    }
    out.push(pool[rng.int(pool.length)] as CardId);
  }
  return out;
}
