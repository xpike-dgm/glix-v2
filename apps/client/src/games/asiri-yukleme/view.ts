import type { AsiriYuklemePublicView, AsiriYuklemeReveal, AsiriYuklemeView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isCount = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v >= 0;

function parseReveal(v: unknown): AsiriYuklemeReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const before = parseNumberRecord(v.before);
  const after = parseNumberRecord(v.after);
  const points = parseNumberRecord(v.points);
  if (!before || !after || !points || !isCount(v.total)) return undefined;
  if (![...Object.values(before), ...Object.values(after)].every(isCount)) return undefined;
  if (!Array.isArray(v.exploders)) return undefined;
  const exploders: string[] = [];
  for (const id of v.exploders) {
    if (typeof id !== "string" || id.length === 0 || exploders.includes(id)) return undefined;
    exploders.push(id);
  }
  return { total: v.total, before, after, exploders, points };
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
  /** 100'e kadar yapılan tıklamalar (sıralamada sayılan). */
  before: number;
  /** 100'ü geçtikten sonra yapılan tıklamalar. */
  after: number;
  points: number;
  exploded: boolean;
}

/**
 * Sonuç sırası (aynı zamanda açılış sırası): patlamayanlar 100'e kadarki tıklamalarına göre çoktan aza; patlayanlar
 * en sonda, 100'den sonra az basandan çok basana (en ağır ceza en son açılır). Eşitlikte katılım sırası korunur.
 */
export function resultRows(reveal: AsiriYuklemeReveal, order: readonly string[]): ResultRow[] {
  const pos = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const ids = Object.keys(reveal.before).sort((a, b) => pos(a) - pos(b));
  const rows = ids.map((playerId) => ({
    playerId,
    before: reveal.before[playerId] ?? 0,
    after: reveal.after[playerId] ?? 0,
    points: reveal.points[playerId] ?? 0,
    exploded: reveal.exploders.includes(playerId),
  }));
  return rows.sort((a, b) => {
    if (a.exploded !== b.exploded) return Number(a.exploded) - Number(b.exploded);
    return a.exploded ? a.after - b.after : b.before - a.before;
  });
}

/** Satır çubuğunun parçaları (0..1): önce (mavi) ve sonra (kırmızı); en uzun satır tam dolu. */
export function barParts(row: ResultRow, rows: readonly ResultRow[]): { before: number; after: number } {
  const max = Math.max(1, ...rows.map((r) => r.before + r.after));
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const before = clamp(row.before / max);
  return { before, after: clamp(Math.min(row.after / max, 1 - before)) };
}

/** Puan yazısı: "+2", "0", "−1" (gerçek eksi işareti). */
export function pointsText(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${-points}`;
  return "0";
}
