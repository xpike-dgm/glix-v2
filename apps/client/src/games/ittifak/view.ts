import type { IttifakPhase, IttifakPublicView, IttifakReveal, IttifakView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const PHASES: readonly IttifakPhase[] = ["talk", "vote", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type IttifakScreenView = IttifakPublicView & IttifakView;

function parseReveal(v: unknown): IttifakReveal | null {
  if (!isRec(v) || !isRec(v.votes)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  const votes: Record<string, string> = {};
  for (const [from, to] of Object.entries(v.votes)) {
    if (typeof to !== "string") return null;
    votes[from] = to;
  }
  return { votes, scores };
}

/** Sunucudan gelen `publicView` bilinmez; İttifak ortak görünümü olarak doğrulanır. */
export function parseIttifakPublicView(v: unknown): IttifakPublicView | null {
  if (!isRec(v)) return null;
  if (!Array.isArray(v.players) || !v.players.every((p) => typeof p === "string")) return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as IttifakPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.talkEndsAt) || !isNum(v.voteEndsAt) || !isNum(v.finishAt)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...(v.players as string[])],
    phase: v.phase as IttifakPhase,
    startedAt: v.startedAt,
    talkEndsAt: v.talkEndsAt,
    voteEndsAt: v.voteEndsAt,
    finishAt: v.finishAt,
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseIttifakPrivateView(v: unknown): IttifakView | null {
  if (!isRec(v)) return null;
  if (v.myVote !== null && typeof v.myVote !== "string") return null;
  return { myVote: v.myVote };
}

export function parseIttifakView(publicView: unknown, view: unknown): IttifakScreenView | null {
  const pub = parseIttifakPublicView(publicView);
  const priv = parseIttifakPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export interface Flow {
  from: string;
  to: string;
}

/** Açılan oylardan akış listesi (geçersiz ve kendine giden oylar atılır), katılım sırasıyla. */
export function flowsOf(reveal: IttifakReveal, order: readonly string[]): Flow[] {
  const known = new Set(order);
  const out: Flow[] = [];
  for (const from of order) {
    const to = reveal.votes[from];
    if (to === undefined || to === from || !known.has(to)) continue;
    out.push({ from, to });
  }
  return out;
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

export interface Bond {
  a: number;
  b: number;
  /** Animasyon gecikmesi ve süresi (s). */
  delay: number;
  dur: number;
}

/**
 * Pazarlık sırasında portreler arasında beliren geçici neon bağlar (yalnız süs; hiçbir şey kaydedilmez).
 * Oyuncu sayısına göre belirli bir desen: komşu ve karşı çiftler sırayla yanar.
 */
export function bondPattern(count: number): Bond[] {
  if (count < 2) return [];
  const bonds: Bond[] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number): void => {
    const x = Math.min(a, b);
    const y = Math.max(a, b);
    const key = `${x}-${y}`;
    if (x === y || seen.has(key)) return;
    seen.add(key);
    const k = bonds.length;
    bonds.push({ a: x, b: y, delay: (k * 1.7) % 7, dur: 5 + ((k * 0.9) % 3) });
  };
  for (let i = 0; i < count; i += 2) add(i, (i + 1) % count);
  for (let i = 0; i < count; i += 3) add(i, (i + Math.max(2, Math.floor(count / 2))) % count);
  for (let i = 1; i < count; i += 3) add(i, (i + 2) % count);
  return bonds.slice(0, 6);
}
