import {
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  type ButonaBasPhase,
  type ButonaBasPublicView,
  type ButonaBasView,
  type ButonaBasWindowResult,
  butonaBasRoundOffset,
  butonaBasWindowMs,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseWindow(v: unknown): ButonaBasWindowResult | null {
  if (!isRec(v) || !isNum(v.index) || !isNum(v.round) || !Array.isArray(v.pressers)) return null;
  if (!v.pressers.every((p) => typeof p === "string")) return null;
  if (v.outcome !== "match" && v.outcome !== "solo") return null;
  return { round: v.round, index: v.index, pressers: v.pressers as string[], outcome: v.outcome };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type ButonaBasScreenView = ButonaBasPublicView & ButonaBasView;

/** Sunucudan gelen `publicView` bilinmez; Butona Bas ortak görünümü olarak doğrulanır. */
export function parseButonaBasPublicView(v: unknown): ButonaBasPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.windowMs) || !isNum(v.phaseEndsAt)) return null;
  if (!isNum(v.round) || !isNum(v.rounds) || v.rounds < 1 || v.rounds > 9) return null;
  if (v.phase !== "play" && v.phase !== "gap" && v.phase !== "over") return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores || !Array.isArray(v.recent)) return null;
  const recent: ButonaBasWindowResult[] = [];
  for (const r of v.recent) {
    const w = parseWindow(r);
    if (!w) return null;
    recent.push(w);
  }
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    round: v.round,
    rounds: v.rounds,
    phase: v.phase,
    windowMs: v.windowMs > 0 ? v.windowMs : 300,
    phaseEndsAt: v.phaseEndsAt,
    scores,
    recent,
  };
}

/** Sunucudan gelen `view` bilinmez; Butona Bas kişisel görünümü olarak doğrulanır. */
export function parseButonaBasPrivateView(v: unknown): ButonaBasView | null {
  if (!isRec(v)) return null;
  if (v.myScore !== null && !isNum(v.myScore)) return null;
  if (typeof v.pressedThisWindow !== "boolean") return null;
  return { myScore: v.myScore, pressedThisWindow: v.pressedThisWindow };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseButonaBasView(publicView: unknown, view: unknown): ButonaBasScreenView | null {
  const pub = parseButonaBasPublicView(publicView);
  const priv = parseButonaBasPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Pencerenin sıralama anahtarı: tur × 1000 + tur içi sıra (eski → yeni artar). */
export function windowKey(w: ButonaBasWindowResult): number {
  return w.round * 1000 + w.index;
}

/** `lastSeen`'den yeni pencereler (eski → yeni). `lastSeen` null ise hepsi görülmüş sayılır. */
export function newWindows(
  recent: readonly ButonaBasWindowResult[],
  lastSeen: number | null,
): ButonaBasWindowResult[] {
  if (lastSeen === null) return [];
  return recent.filter((w) => windowKey(w) > lastSeen).sort((a, b) => windowKey(a) - windowKey(b));
}

export function maxWindowIndex(
  recent: readonly ButonaBasWindowResult[],
  fallback: number | null,
): number | null {
  let m = fallback;
  for (const w of recent) if (m === null || windowKey(w) > m) m = windowKey(w);
  return m;
}

/** Sunucu saatine göre tur durumu (görünüm yalnız durum değişince gelir; tur/ara geçişi yerelde türetilir). */
export interface RoundClock {
  /** 0 tabanlı tur (aradayken yaklaşan tur). */
  round: number;
  phase: ButonaBasPhase;
  windowMs: number;
  /** Evrenin başı ve sonu (ms, sunucu saati): tur süre çubuğu için. */
  phaseStartsAt: number;
  phaseEndsAt: number;
}

export function roundClockAt(startedAt: number, endsAt: number, t: number): RoundClock {
  const rounds = BUTONA_BAS_ROUNDS;
  if (t >= endsAt) {
    const start = startedAt + butonaBasRoundOffset(rounds - 1);
    return {
      round: rounds - 1,
      phase: "over",
      windowMs: butonaBasWindowMs(rounds - 1),
      phaseStartsAt: start,
      phaseEndsAt: endsAt,
    };
  }
  const slot = BUTONA_BAS_ROUND_MS + BUTONA_BAS_GAP_MS;
  const round = Math.min(rounds - 1, Math.max(0, Math.floor((t - startedAt) / slot)));
  const start = startedAt + butonaBasRoundOffset(round);
  if (t < start + BUTONA_BAS_ROUND_MS) {
    return {
      round,
      phase: "play",
      windowMs: butonaBasWindowMs(round),
      phaseStartsAt: start,
      phaseEndsAt: start + BUTONA_BAS_ROUND_MS,
    };
  }
  return {
    round: round + 1,
    phase: "gap",
    windowMs: butonaBasWindowMs(round + 1),
    phaseStartsAt: start + BUTONA_BAS_ROUND_MS,
    phaseEndsAt: startedAt + butonaBasRoundOffset(round + 1),
  };
}
