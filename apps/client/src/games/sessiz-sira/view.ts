import {
  SESSIZ_MAX_CARD,
  type SessizMissed,
  type SessizPlay,
  type SessizPublicView,
  type SessizView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

function parsePlays(v: unknown): SessizPlay[] | null {
  if (!Array.isArray(v) || v.length > 64) return null;
  const out: SessizPlay[] = [];
  for (const p of v) {
    if (!isRec(p) || !isId(p.playerId) || !isInt(p.card, 1, SESSIZ_MAX_CARD) || typeof p.ok !== "boolean")
      return null;
    out.push({ playerId: p.playerId, card: p.card, ok: p.ok });
  }
  return out;
}

function parseMissed(v: unknown): SessizMissed[] | null {
  if (!Array.isArray(v) || v.length > 64) return null;
  const out: SessizMissed[] = [];
  for (const p of v) {
    if (!isRec(p) || !isId(p.playerId) || !isInt(p.card, 1, SESSIZ_MAX_CARD)) return null;
    out.push({ playerId: p.playerId, card: p.card });
  }
  return out;
}

export type SessizScreenView = SessizPublicView & SessizView;

export function parseSessizPublicView(v: unknown): SessizPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.phaseStartedAt) || !isNum(v.phaseEndsAt)) return null;
  if (!isInt(v.rounds, 1, 9) || !isInt(v.round, 1, v.rounds)) return null;
  if (v.phase !== "look" && v.phase !== "play" && v.phase !== "reveal") return null;
  if (!isInt(v.maxLives, 1, 9) || !isInt(v.lives, 0, v.maxLives)) return null;
  const counts = parseNumberRecord(v.counts);
  const totals = parseNumberRecord(v.totals);
  const plays = parsePlays(v.plays);
  const missed = parseMissed(v.missed);
  if (!counts || !totals || !plays || !missed || typeof v.dead !== "boolean") return null;
  let final: Record<string, number> | null = null;
  if (v.final !== null) {
    final = parseNumberRecord(v.final);
    if (!final) return null;
  }
  return {
    startedAt: v.startedAt,
    round: v.round,
    rounds: v.rounds,
    phase: v.phase,
    phaseStartedAt: v.phaseStartedAt,
    phaseEndsAt: v.phaseEndsAt,
    lives: v.lives,
    maxLives: v.maxLives,
    counts,
    plays,
    missed,
    totals,
    dead: v.dead,
    final,
  };
}

export function parseSessizPrivateView(v: unknown): SessizView | null {
  if (!isRec(v) || !Array.isArray(v.hand) || v.hand.length > 8) return null;
  if (!v.hand.every((c) => isInt(c, 1, SESSIZ_MAX_CARD))) return null;
  return { hand: v.hand as number[] };
}

export function parseSessizView(publicView: unknown, view: unknown): SessizScreenView | null {
  const pub = parseSessizPublicView(publicView);
  const priv = parseSessizPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Turun olay akışı: oynananlar ve açılıp atılan kartlar tek sırada (küçük karttan büyüğe değil, oluş sırasıyla oynananlar, ardından atılanlar). */
export interface Beat {
  playerId: string;
  card: number;
  kind: "ok" | "wrong" | "missed";
}

export function beatsOf(v: Pick<SessizPublicView, "plays" | "missed">): Beat[] {
  return [
    ...v.plays.map((p): Beat => ({ playerId: p.playerId, card: p.card, kind: p.ok ? "ok" : "wrong" })),
    ...v.missed.map((m): Beat => ({ playerId: m.playerId, card: m.card, kind: "missed" })),
  ];
}

/** Turun özeti için kısa başlık. */
export function roundVerdict(v: SessizPublicView): { text: string; tone: "good" | "bad" } {
  if (v.dead) return { text: "Canlar bitti!", tone: "bad" };
  if (v.plays.some((p) => !p.ok)) return { text: "Hata! Takım can kaybetti", tone: "bad" };
  if (v.missed.length > 0) return { text: "Süre doldu! Takım can kaybetti", tone: "bad" };
  return { text: "Kusursuz sıra!", tone: "good" };
}
