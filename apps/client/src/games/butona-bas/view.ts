import type { ButonaBasPublicView, ButonaBasView, ButonaBasWindowResult } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseWindow(v: unknown): ButonaBasWindowResult | null {
  if (!isRec(v) || !isNum(v.index) || !Array.isArray(v.pressers)) return null;
  if (!v.pressers.every((p) => typeof p === "string")) return null;
  if (v.outcome !== "match" && v.outcome !== "solo") return null;
  return { index: v.index, pressers: v.pressers as string[], outcome: v.outcome };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type ButonaBasScreenView = ButonaBasPublicView & ButonaBasView;

/** Sunucudan gelen `publicView` bilinmez; Butona Bas ortak görünümü olarak doğrulanır. */
export function parseButonaBasPublicView(v: unknown): ButonaBasPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.windowMs)) return null;
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
    windowMs: v.windowMs > 0 ? v.windowMs : 300,
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

/** `lastSeen`'den yeni pencereler (eski → yeni). `lastSeen` null ise hepsi görülmüş sayılır. */
export function newWindows(
  recent: readonly ButonaBasWindowResult[],
  lastSeen: number | null,
): ButonaBasWindowResult[] {
  if (lastSeen === null) return [];
  return recent.filter((w) => w.index > lastSeen).sort((a, b) => a.index - b.index);
}

export function maxWindowIndex(
  recent: readonly ButonaBasWindowResult[],
  fallback: number | null,
): number | null {
  let m = fallback;
  for (const w of recent) if (m === null || w.index > m) m = w.index;
  return m;
}
