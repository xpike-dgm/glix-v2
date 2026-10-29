import type { TekPublicView, TekReveal, TekRoundSummary, TekView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;
const isIdList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === "string" && x.length <= 64);
const MAX_VALUE = 10;

function parseReveal(v: unknown): TekReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const picks = parseNumberRecord(v.picks);
  const points = parseNumberRecord(v.points);
  if (!picks || !points) return undefined;
  if (!Object.values(picks).every((x) => isInt(x, 1, MAX_VALUE))) return undefined;
  if (!Array.isArray(v.counts) || v.counts.length < 1 || v.counts.length > MAX_VALUE) return undefined;
  if (!v.counts.every((c) => isInt(c, 0, 64))) return undefined;
  if (v.winner !== null && (typeof v.winner !== "string" || v.winner.length > 64)) return undefined;
  if (v.winningValue !== null && !isInt(v.winningValue, 1, MAX_VALUE)) return undefined;
  return { picks, counts: v.counts as number[], winner: v.winner, winningValue: v.winningValue, points };
}

function parseSummary(v: unknown): TekRoundSummary | null {
  if (!isRec(v)) return null;
  if (v.winningValue !== null && !isInt(v.winningValue, 1, MAX_VALUE)) return null;
  if (v.winner !== null && typeof v.winner !== "string") return null;
  return { winningValue: v.winningValue, winner: v.winner };
}

export type TekScreenView = TekPublicView & TekView;

export function parseTekPublicView(v: unknown): TekPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.phaseStartedAt) || !isNum(v.phaseEndsAt)) return null;
  if (!isInt(v.rounds, 1, 9) || !isInt(v.round, 1, v.rounds) || !isInt(v.max, 2, MAX_VALUE)) return null;
  if (v.phase !== "choose" && v.phase !== "reveal") return null;
  if (!Array.isArray(v.previous) || v.previous.length > 9) return null;
  const previous: TekRoundSummary[] = [];
  for (const p of v.previous) {
    const s = parseSummary(p);
    if (!s) return null;
    previous.push(s);
  }
  const totals = parseNumberRecord(v.totals);
  if (!totals || !isIdList(v.lockedIds)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
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
    max: v.max,
    previous,
    totals,
    lockedIds: v.lockedIds,
    reveal,
    final,
  };
}

export function parseTekPrivateView(v: unknown): TekView | null {
  if (!isRec(v)) return null;
  if (v.myValue !== null && !isInt(v.myValue, 1, MAX_VALUE)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { myValue: v.myValue, locked: v.locked };
}

export function parseTekView(publicView: unknown, view: unknown): TekScreenView | null {
  const pub = parseTekPublicView(publicView);
  const priv = parseTekPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Bir sütunun durumu: kazanan, tek kalan (ama küçük bir sayı tek kalmış), çakışan ya da boş. */
export type Column = "win" | "solo" | "clash" | "empty";

export function columnOf(reveal: TekReveal, value: number): Column {
  const n = reveal.counts[value - 1] ?? 0;
  if (reveal.winningValue === value) return "win";
  if (n === 0) return "empty";
  return n === 1 ? "solo" : "clash";
}

/** Bir sayıyı seçenler (sunucunun sırasıyla). */
export function pickersOf(reveal: TekReveal, value: number): string[] {
  return Object.entries(reveal.picks)
    .filter(([, v]) => v === value)
    .map(([id]) => id);
}
