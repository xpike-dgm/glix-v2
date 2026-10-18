import type { OrtalamaPublicView, OrtalamaReveal, OrtalamaView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

function parseReveal(v: unknown): OrtalamaReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const choices = parseNumberRecord(v.choices);
  const distances = parseNumberRecord(v.distances);
  const ranks = parseNumberRecord(v.ranks);
  const points = parseNumberRecord(v.points);
  if (!choices || !distances || !ranks || !points) return undefined;
  if (!isNum(v.mean) || !isNum(v.target)) return undefined;
  if (!Array.isArray(v.order) || !v.order.every((x) => typeof x === "string")) return undefined;
  const order = v.order as string[];
  const ids = Object.keys(choices);
  if (order.length !== ids.length || !order.every((id) => id in choices)) return undefined;
  if (!Object.values(choices).every((x) => isInt(x, 0, 100))) return undefined;
  for (const id of ids) if (!(id in distances) || !(id in ranks) || !(id in points)) return undefined;
  return { choices, mean: v.mean, target: v.target, distances, order, ranks, points };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type OrtalamaScreenView = OrtalamaPublicView & OrtalamaView;

/** Sunucudan gelen `publicView` bilinmez; Ortalamaya En Yakın ortak görünümü olarak doğrulanır. */
export function parseOrtalamaPublicView(v: unknown): OrtalamaPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return { startedAt: v.startedAt, endsAt: v.endsAt, revealEndsAt: v.revealEndsAt, reveal };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseOrtalamaPrivateView(v: unknown): OrtalamaView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, 100)) return null;
  return { myChoice: v.myChoice };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseOrtalamaView(publicView: unknown, view: unknown): OrtalamaScreenView | null {
  const pub = parseOrtalamaPublicView(publicView);
  const priv = parseOrtalamaPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export type Phase = "choosing" | "revealed";

export function phaseOf(view: OrtalamaScreenView | null): Phase {
  return view?.reveal ? "revealed" : "choosing";
}

/** Türkçe ondalık yazım: tam sayıysa "20", değilse tek basamak "19,2". */
export function formatNumber(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** Sayı doğrusundaki konum (yüzde, 0..100). */
export function linePercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Aynı sayı doğrusunda üst üste binen noktalar için şerit (satır) numarası: soldan sağa, ilk boş şeride.
 * `minGap`: aynı şeritteki iki nokta arası en az yüzde farkı.
 */
export function assignLanes(values: readonly number[], minGap: number): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lastInLane: number[] = [];
  const lanes: number[] = new Array(values.length).fill(0);
  for (const [v, i] of order) {
    let lane = lastInLane.findIndex((last) => v - last >= minGap);
    if (lane === -1) {
      lane = lastInLane.length;
      lastInLane.push(v);
    } else {
      lastInLane[lane] = v;
    }
    lanes[i] = lane;
  }
  return lanes;
}

/** Bir oyuncunun bu oyundan aldığı puan. */
export function pointsOf(reveal: OrtalamaReveal, playerId: string): number {
  return reveal.points[playerId] ?? 0;
}

export type Tier = "gold" | "blue" | "none";

/** Işık rengi: +2 ya da eşit en yakınların +1'i altın; ikinci derecenin +1'i mavi. */
export function tierOf(reveal: OrtalamaReveal, playerId: string): Tier {
  const pts = pointsOf(reveal, playerId);
  if (pts <= 0) return "none";
  return (reveal.ranks[playerId] ?? 99) === 1 ? "gold" : "blue";
}
