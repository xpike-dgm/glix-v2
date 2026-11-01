import {
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  type ButonaBasCrowd,
  type ButonaBasFinal,
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
  const crowd: ButonaBasCrowd | null = v.crowd === "crowd" || v.crowd === "full" ? v.crowd : null;
  if (v.crowd !== undefined && v.crowd !== null && crowd === null) return null;
  const points = isNum(v.points) ? v.points : v.outcome === "match" ? 1 : -1;
  return {
    round: v.round,
    index: v.index,
    pressers: v.pressers as string[],
    outcome: v.outcome,
    points,
    crowd,
    settledAt: isNum(v.settledAt) ? v.settledAt : 0,
  };
}

function parseRoundScores(v: unknown): Record<string, number[]> | null {
  if (v === undefined) return {};
  if (!isRec(v)) return null;
  const out: Record<string, number[]> = {};
  for (const [id, list] of Object.entries(v)) {
    if (!Array.isArray(list) || list.length > 9 || !list.every(isNum)) return null;
    out[id] = [...list];
  }
  return out;
}

function parseFinal(v: unknown): ButonaBasFinal | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !Array.isArray(v.pairs)) return undefined;
  const solos = parseNumberRecord(v.solos);
  if (!solos) return undefined;
  const pairs: ButonaBasFinal["pairs"] = [];
  for (const p of v.pairs) {
    if (!isRec(p) || typeof p.a !== "string" || typeof p.b !== "string" || !isNum(p.count)) return undefined;
    pairs.push({ a: p.a, b: p.b, count: p.count });
  }
  return { pairs, solos };
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
  const roundScores = parseRoundScores(v.roundScores);
  const final = parseFinal(v.final);
  if (!scores || !roundScores || final === undefined || !Array.isArray(v.recent)) return null;
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
    roundScores,
    recent,
    final,
  };
}

/** Sunucudan gelen `view` bilinmez; Butona Bas kişisel görünümü olarak doğrulanır. */
export function parseButonaBasPrivateView(v: unknown): ButonaBasView | null {
  if (!isRec(v)) return null;
  if (v.myScore !== null && !isNum(v.myScore)) return null;
  if (typeof v.pressedThisWindow !== "boolean") return null;
  const readyAt = v.readyAt === undefined || v.readyAt === null ? null : isNum(v.readyAt) ? v.readyAt : NaN;
  if (Number.isNaN(readyAt)) return null;
  return { myScore: v.myScore, pressedThisWindow: v.pressedThisWindow, readyAt };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. İzleyicinin (TV dahil) kişisel görünümü yoksa boş sayılır. */
export function parseButonaBasView(publicView: unknown, view: unknown): ButonaBasScreenView | null {
  const pub = parseButonaBasPublicView(publicView);
  const priv =
    view === null || view === undefined
      ? { myScore: null, pressedThisWindow: false, readyAt: null }
      : parseButonaBasPrivateView(view);
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

/** BB-U1: turun pencere genişliği tek kelimeyle (ms yazılmaz). */
export const RING_WORDS: readonly string[] = ["Geniş", "Dar", "İğne ucu"];
export const ringWord = (round: number): string =>
  RING_WORDS[Math.min(RING_WORDS.length - 1, Math.max(0, round))] ?? "Geniş";

/** Öndekiler (taç): en yüksek puanı paylaşanlar; en yüksek puan 0 ya da altındaysa kimse. */
export function leadersOf(scores: Record<string, number>): string[] {
  const values = Object.values(scores);
  if (values.length === 0) return [];
  const top = Math.max(...values);
  if (top <= 0) return [];
  return Object.keys(scores).filter((id) => scores[id] === top);
}

/** Sıra (1 tabanlı; eşitler aynı sırada) ve lidere fark. */
export function rankOf(scores: Record<string, number>, id: string): { rank: number; gap: number } {
  const mine = scores[id] ?? 0;
  const values = Object.values(scores);
  const top = values.length > 0 ? Math.max(...values) : mine;
  return { rank: 1 + values.filter((v) => v > mine).length, gap: Math.max(0, top - mine) };
}

const ORDINALS = ["birinci", "ikinci", "üçüncü", "dördüncü", "beşinci", "altıncı", "yedinci", "sekizinci"];
const ORDINAL_YOU = [
  "birincisin",
  "ikincisin",
  "üçüncüsün",
  "dördüncüsün",
  "beşincisin",
  "altıncısın",
  "yedincisin",
  "sekizincisin",
];
export const ordinal = (rank: number): string => ORDINALS[rank - 1] ?? `${rank}.`;

/** BB-U17: ekran okuyucu tur sonu satırı. */
export function roundEndLine(round1: number, score: number | null, rank: number | null): string {
  const head = `Tur ${round1} bitti.`;
  if (score === null || rank === null) return head;
  return `${head} Puanın ${score}, ${ORDINAL_YOU[rank - 1] ?? `${rank}. sıradasın`}.`;
}

/** BB-U2: şeritteki ad: en çok `max` harf, taşan "…". */
export function shortName(name: string, max = 7): string {
  const chars = Array.from(name.trim());
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max).join("")}…`;
}

/** BB-U4 / BB-U16: kendi sonucun satırı ve yüzen yazı (işaret her zaman vardır). */
export function resultOf(w: ButonaBasWindowResult): {
  tone: "match" | "crowd" | "solo";
  float: string;
  line: string;
} {
  if (w.outcome === "solo") return { tone: "solo", float: "−1 ✕", line: "Yalnız kaldın −1" };
  const plus = `+${w.points}`;
  if (w.crowd === "full") return { tone: "crowd", float: `${plus} ✓`, line: `${plus} TAM EKİP!` };
  if (w.crowd === "crowd") return { tone: "crowd", float: `${plus} ✓`, line: `${plus} KALABALIK!` };
  return { tone: "match", float: `${plus} ✓`, line: plus };
}

/** BB-U5: biten turun yıldızı (o turda en çok puan; 0'ın üstünde değilse yok). */
export function roundStar(
  roundScores: Record<string, number[]>,
  round: number,
  order: readonly string[],
): { id: string; points: number } | null {
  let best: { id: string; points: number } | null = null;
  for (const id of order) {
    const p = roundScores[id]?.[round] ?? 0;
    if (p > 0 && (best === null || p > best.points)) best = { id, points: p };
  }
  return best;
}

/** BB-U5 ara akışı (3 sn): 0–1,2 sn tur özeti, 1,2–2,2 sn tur puanları, 2,2–3 sn "DARALIYOR!". */
export type GapStep = "done" | "gains" | "tight";
export function gapStep(sinceGapStart: number): GapStep {
  if (sinceGapStart < 1_200) return "done";
  if (sinceGapStart < 2_200) return "gains";
  return "tight";
}

/** BB-U6: turun son 3 saniyesi: kalan tam saniye (3, 2, 1); değilse null. */
export function urgentSecs(c: RoundClock, now: number): number | null {
  if (c.phase !== "play") return null;
  const left = c.phaseEndsAt - now;
  return left > 0 && left <= 3_000 ? Math.ceil(left / 1_000) : null;
}

/** BB-U7: açılış sırası: toplamı en düşükten başlayarak, lider en son (eşitlikte oyuncu sırası tersinden). */
export function revealOrder(scores: Record<string, number>, order: readonly string[]): string[] {
  return [...order].sort(
    (a, b) => (scores[a] ?? 0) - (scores[b] ?? 0) || order.indexOf(b) - order.indexOf(a),
  );
}

/** BB-U15: ipucu bandı: hesap yoksa her oyunda; hesapta yalnız ilk oyunda. */
export const hintKey = (username: string): string => `glix.bb.ipucu.${username}`;
export const hintNeeded = (username: string | null, stored: string | null): boolean =>
  username === null || stored !== "1";

/** BB-U12: ekrana tur ortasında girildiyse (geri dönüş) kısa bant metni; değilse null. */
export function rejoinLine(c: RoundClock, now: number): string | null {
  if (c.phase !== "play" || now - c.phaseStartsAt < 1_500) return null;
  return `Tur ${c.round + 1} sürüyor — bas!`;
}

/** BB-U2: şerit iki sıraya geçer (5+ oyuncu): ilk sıradaki kişi sayısı. */
export const stripSplit = (n: number): number => (n > 4 ? Math.ceil(n / 2) : n);
