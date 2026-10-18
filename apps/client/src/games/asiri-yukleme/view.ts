import type { AsiriYuklemePublicView, AsiriYuklemeReveal, AsiriYuklemeView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseReveal(v: unknown): AsiriYuklemeReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const clicks = parseNumberRecord(v.clicks);
  const points = parseNumberRecord(v.points);
  if (!clicks || !points || !isNum(v.total)) return undefined;
  if (v.exploder !== null && (typeof v.exploder !== "string" || v.exploder.length === 0)) return undefined;
  return { total: v.total, exploder: v.exploder, clicks, points };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type AsiriYuklemeScreenView = AsiriYuklemePublicView & AsiriYuklemeView;

export function parseAsiriYuklemePublicView(v: unknown): AsiriYuklemePublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || typeof v.danger !== "boolean") return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return { startedAt: v.startedAt, danger: v.danger, reveal };
}

export function parseAsiriYuklemePrivateView(v: unknown): AsiriYuklemeView | null {
  if (!isRec(v) || typeof v.participant !== "boolean") return null;
  return { participant: v.participant };
}

export function parseAsiriYuklemeView(publicView: unknown, view: unknown): AsiriYuklemeScreenView | null {
  const pub = parseAsiriYuklemePublicView(publicView);
  const priv = parseAsiriYuklemePrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export type Phase = "playing" | "danger" | "revealed";

export function phaseOf(view: AsiriYuklemeScreenView | null): Phase {
  if (view?.reveal) return "revealed";
  return view?.danger ? "danger" : "playing";
}

export interface ResultRow {
  playerId: string;
  clicks: number;
  points: number;
  exploded: boolean;
}

/** En çok tıklayandan aza; patlayan en sonda. Eşit tıklamada katılım sırası korunur. */
export function resultRows(reveal: AsiriYuklemeReveal, order: readonly string[]): ResultRow[] {
  const ids = Object.keys(reveal.clicks).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const rows = ids.map((playerId) => ({
    playerId,
    clicks: reveal.clicks[playerId] ?? 0,
    points: reveal.points[playerId] ?? 0,
    exploded: playerId === reveal.exploder,
  }));
  return rows.sort((a, b) => Number(a.exploded) - Number(b.exploded) || b.clicks - a.clicks);
}

/** Satır çubuğunun uzunluğu (0..1): en çok tıklayan tam dolu. */
export function barRatio(clicks: number, rows: readonly ResultRow[]): number {
  const max = Math.max(1, ...rows.filter((r) => !r.exploded).map((r) => r.clicks));
  return Math.max(0, Math.min(1, clicks / max));
}
