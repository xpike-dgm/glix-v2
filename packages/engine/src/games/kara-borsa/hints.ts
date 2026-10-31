import type { Rng } from "../../rng.js";
import { BORSA_MAX_VALUE, type BorsaHint, type BorsaHintPair } from "./types.js";

/** Bir ipucunun gerçek değer için doğru olup olmadığı (lanetli: değer −20). */
export function hintHolds(hint: BorsaHint, value: number): boolean {
  const cursed = value < 0;
  const mod = (n: number): number => ((value % n) + n) % n;
  switch (hint.kind) {
    case "gt":
      return value > hint.n;
    case "lt":
      return value < hint.n;
    case "between":
      return value >= hint.lo && value <= hint.hi;
    case "even":
      return mod(2) === 0;
    case "odd":
      return mod(2) === 1;
    case "multiple":
      return mod(hint.n) === 0;
    case "notMultiple":
      return mod(hint.n) !== 0;
    case "cursed":
      return cursed;
    case "notCursed":
      return !cursed;
  }
}

const signature = (h: BorsaHint): string => JSON.stringify(h);

/** Değeri daraltan ana ipucu adayları (lanetsiz kutu): büyük / küçük / arasında; eşikler değere yakın rastgele. */
function mainCandidates(value: number, scale: number, rng: Rng): BorsaHint[] {
  const max = BORSA_MAX_VALUE * scale;
  const out: BorsaHint[] = [];
  if (value >= 1) {
    out.push({ kind: "gt", n: Math.max(0, value - 1 - rng.int(25 * scale)) });
    out.push({ kind: "gt", n: Math.max(0, value - 1 - rng.int(25 * scale)) });
  }
  if (value < max) {
    out.push({ kind: "lt", n: Math.min(max, value + 1 + rng.int(25 * scale)) });
    out.push({ kind: "lt", n: Math.min(max, value + 1 + rng.int(25 * scale)) });
  }
  // "Arasında" aralığı en çok 28 (son turda 56) genişlikte: sınır 30 × ölçek.
  const lo = Math.max(0, value - (3 * scale + rng.int(12 * scale)));
  const hi = Math.min(max, value + (3 * scale + rng.int(12 * scale)));
  out.push({ kind: "between", lo, hi });
  return out.filter((h) => hintHolds(h, value));
}

/** Ek ipucu adayları: çift/tek, 3/5/10'un katı mı; "lanetli değil" yalnız lanetsiz kutuda ve ana ipucu söylemiyorsa. */
function extraCandidates(value: number, main: BorsaHint): BorsaHint[] {
  const mod = (n: number): number => ((value % n) + n) % n;
  const out: BorsaHint[] = [{ kind: mod(2) === 0 ? "even" : "odd" }];
  for (const n of [3, 5, 10]) out.push(mod(n) === 0 ? { kind: "multiple", n } : { kind: "notMultiple", n });
  if (value >= 0 && main.kind === "lt") out.push({ kind: "notCursed" });
  return out.filter((h) => hintHolds(h, value));
}

/** Havuzdan, kullanılmamış olanı yeğleyerek seçer (en çok 6 deneme; seçenek kalmazsa tekrar eder). */
function pickFresh(pool: readonly BorsaHint[], used: Set<string>, rng: Rng): BorsaHint {
  let pick = pool[rng.int(pool.length)] as BorsaHint;
  for (let i = 0; i < 6 && used.has(signature(pick)); i++) pick = pool[rng.int(pool.length)] as BorsaHint;
  used.add(signature(pick));
  return pick;
}

/** Lanetli kutuda "Kutu lanetli!" görecek oyuncu sayısı: en az 1, en çok yarısı (yukarı yuvarlanır). */
export const cursedSeerLimit = (players: number): number => Math.max(1, Math.ceil(players / 2));

/**
 * Her oyuncu için, gerçek değere göre her zaman doğru iki ipucu üretir (KB-M3): değeri daraltan ana ipucu ve küçük
 * ek ipucu. Lanetli kutuda oyuncuların en az biri, en çok yarısı "Kutu lanetli!" görür; diğerleri doğru ama
 * yanıltıcı "Değeri n'den küçük" görür. Mümkün olduğunca farklı oyunculara farklı ipuçları verilir.
 * `scale` son turda (Büyük Kutu) 2'dir: eşikler iki katına çıkar.
 */
export function makeHints(
  value: number,
  players: readonly string[],
  rng: Rng,
  scale = 1,
): Record<string, BorsaHintPair> {
  const cursed = value < 0;
  const seers = new Set<string>();
  if (cursed) {
    const count = 1 + rng.int(cursedSeerLimit(players.length));
    const order = [...players];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j] as string, order[i] as string];
    }
    for (const id of order.slice(0, count)) seers.add(id);
  }
  const usedMain = new Set<string>();
  const usedExtra = new Set<string>();
  const hints: Record<string, BorsaHintPair> = {};
  for (const id of players) {
    let main: BorsaHint;
    if (seers.has(id)) main = { kind: "cursed" };
    else if (cursed) {
      const pool: BorsaHint[] = Array.from({ length: 4 }, () => ({ kind: "lt", n: 1 + rng.int(40 * scale) }));
      main = pickFresh(pool, usedMain, rng);
    } else main = pickFresh(mainCandidates(value, scale, rng), usedMain, rng);
    const extra = pickFresh(extraCandidates(value, main), usedExtra, rng);
    hints[id] = { main, extra };
  }
  return hints;
}
