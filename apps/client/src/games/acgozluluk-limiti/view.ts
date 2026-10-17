import type { AcgozlulukPublicView, AcgozlulukReveal, AcgozlulukView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

function parseReveal(v: unknown): AcgozlulukReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const choices = parseNumberRecord(v.choices);
  if (!choices || !isNum(v.total) || typeof v.over !== "boolean") return undefined;
  return { choices, total: v.total, over: v.over };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type AcgozlulukScreenView = AcgozlulukPublicView & AcgozlulukView;

/** Sunucudan gelen `publicView` bilinmez; Açgözlülük Limiti ortak görünümü olarak doğrulanır. */
export function parseAcgozlulukPublicView(v: unknown): AcgozlulukPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  if (!isInt(v.limit, 1, 1000) || !isInt(v.maxChoice, 1, 64)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return {
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    limit: v.limit,
    maxChoice: v.maxChoice,
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseAcgozlulukPrivateView(v: unknown): AcgozlulukView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, 64)) return null;
  return { myChoice: v.myChoice };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseAcgozlulukView(publicView: unknown, view: unknown): AcgozlulukScreenView | null {
  const pub = parseAcgozlulukPublicView(publicView);
  const priv = parseAcgozlulukPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Hazne kapasitesi limitin 1,5 katıdır: en kötü toplam (N×N) her oyuncu sayısında kapasiteye sığar. */
export const TANK_FACTOR = 1.5;

export function tankCapacity(limit: number): number {
  return Math.max(1, limit) * TANK_FACTOR;
}

/** Limit çizgisinin hazne dibinden yüksekliği (yüzde). */
export function limitLinePercent(limit: number): number {
  return Math.min(100, (limit / tankCapacity(limit)) * 100);
}

/** `value` jetonunun hazne içindeki yüksekliği (yüzde, 0..100). */
export function segmentPercent(value: number, limit: number): number {
  return Math.max(0, Math.min(100, (value / tankCapacity(limit)) * 100));
}

/** Sayı düğmeleri ızgarası: 0..N için sütun sayısı (tek satır ya da dengeli iki satır). */
export function chipColumns(count: number): number {
  if (count <= 5) return Math.max(1, count);
  if (count === 6) return 3;
  if (count <= 8) return 4;
  return 5;
}

export type Phase = "choosing" | "revealed";

export function phaseOf(view: AcgozlulukScreenView | null): Phase {
  return view?.reveal ? "revealed" : "choosing";
}

/** Bir oyuncunun bu oyundan alacağı puan (taşarsa 0). */
export function pointsOf(reveal: AcgozlulukReveal, playerId: string): number {
  return reveal.over ? 0 : (reveal.choices[playerId] ?? 0);
}
