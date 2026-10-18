import type {
  ZehirliKadehPublicView,
  ZehirliKadehResult,
  ZehirliKadehSwap,
  ZehirliKadehView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Kadeh rengi: başlangıçtaki sahibinin sırasına göre (oyuncu renk dizisiyle aynı sıra). */
export const CUP_COLORS = [
  "#2EF2FF",
  "#FF2BD6",
  "#FFC23B",
  "#B6FF3B",
  "#8B5CFF",
  "#FF8A3B",
  "#2BFFA8",
  "#3B7BFF",
] as const;

export function cupColor(cup: number): string {
  return CUP_COLORS[((cup % 8) + 8) % 8] ?? CUP_COLORS[0];
}

function parseSwaps(v: unknown): ZehirliKadehSwap[] | null {
  if (!Array.isArray(v)) return null;
  const out: ZehirliKadehSwap[] = [];
  for (const s of v) {
    if (!isRec(s) || !isNum(s.seq) || typeof s.from !== "string" || typeof s.to !== "string" || !isNum(s.at))
      return null;
    out.push({ seq: s.seq, from: s.from, to: s.to, at: s.at });
  }
  return out;
}

function parseResult(v: unknown): ZehirliKadehResult | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !isStrArr(v.clean) || !isStrArr(v.poisoned)) return undefined;
  if (!Array.isArray(v.poisonedCups) || !v.poisonedCups.every(isNum)) return undefined;
  return { clean: v.clean, poisoned: v.poisoned, poisonedCups: v.poisonedCups as number[] };
}

/** Sunucudan gelen `publicView` bilinmez; Zehirli Kadeh ortak görünümü olarak doğrulanır. */
export function parseZehirliKadehPublicView(v: unknown): ZehirliKadehPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.poisonCount)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.swapped) || typeof v.ended !== "boolean") return null;
  if (!isRec(v.holdings)) return null;
  const holdings: Record<string, number> = {};
  for (const [id, cup] of Object.entries(v.holdings)) {
    if (!isNum(cup)) return null;
    holdings[id] = cup;
  }
  const swaps = parseSwaps(v.swaps);
  const result = parseResult(v.result);
  if (!swaps || result === undefined) return null;
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    players: v.players,
    holdings,
    swapped: v.swapped,
    swaps,
    poisonCount: v.poisonCount,
    ended: v.ended,
    result,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseZehirliKadehPrivateView(v: unknown): ZehirliKadehView | null {
  if (!isRec(v)) return null;
  return v.role === "player" || v.role === "spectator" ? { role: v.role } : null;
}

export interface ZehirliKadehScreenView {
  pub: ZehirliKadehPublicView;
  priv: ZehirliKadehView;
}

export function parseZehirliKadehView(publicView: unknown, view: unknown): ZehirliKadehScreenView | null {
  const pub = parseZehirliKadehPublicView(publicView);
  const priv = parseZehirliKadehPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Kalan süre oranı (0–1) ve takasların eklediği amber payın oranı. */
export function clockFractions(
  startedAt: number,
  endsAt: number,
  swaps: number,
  now: number,
): { left: number; bonus: number } {
  const total = Math.max(1, endsAt - startedAt);
  return {
    left: Math.min(1, Math.max(0, (endsAt - now) / total)),
    bonus: Math.min(1, (swaps * 5000) / total),
  };
}

/** Kalan tam saniye (yukarı yuvarlanır). */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function gridColumns(n: number): number {
  return n <= 4 ? 2 : n <= 6 ? 3 : 4;
}
