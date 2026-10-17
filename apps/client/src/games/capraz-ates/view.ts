import type { CaprazAtesPublicView, CaprazAtesReveal, CaprazAtesView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CaprazAtesScreenView = CaprazAtesPublicView & CaprazAtesView;

function parseReveal(v: unknown): CaprazAtesReveal | null {
  if (!isRec(v) || !isRec(v.targets) || !Array.isArray(v.mutual)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  const targets: Record<string, string | null> = {};
  for (const [id, t] of Object.entries(v.targets)) {
    if (t !== null && typeof t !== "string") return null;
    targets[id] = t;
  }
  const mutual: [string, string][] = [];
  for (const pair of v.mutual) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [a, b] = pair;
    if (typeof a !== "string" || typeof b !== "string") return null;
    mutual.push([a, b]);
  }
  return { targets, scores, mutual };
}

/** Sunucudan gelen `publicView` bilinmez; Çapraz Ateş ortak görünümü olarak doğrulanır. */
export function parseCaprazAtesPublicView(v: unknown): CaprazAtesPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.finishAt)) return null;
  if (v.reveal === null || v.reveal === undefined) {
    return { startedAt: v.startedAt, endsAt: v.endsAt, finishAt: v.finishAt, reveal: null };
  }
  const reveal = parseReveal(v.reveal);
  return reveal ? { startedAt: v.startedAt, endsAt: v.endsAt, finishAt: v.finishAt, reveal } : null;
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseCaprazAtesPrivateView(v: unknown): CaprazAtesView | null {
  if (!isRec(v)) return null;
  if (v.myTarget !== null && typeof v.myTarget !== "string") return null;
  return { myTarget: v.myTarget };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseCaprazAtesView(publicView: unknown, view: unknown): CaprazAtesScreenView | null {
  const pub = parseCaprazAtesPublicView(publicView);
  const priv = parseCaprazAtesPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export interface Tracer {
  from: string;
  to: string;
  /** Karşılıklı: izler ortada çarpışır. */
  mutual: boolean;
}

/** Açılan hedeflerden iz listesi (hedefi olan herkes için bir iz; geçersiz kimlikler atılır). */
export function tracersOf(reveal: CaprazAtesReveal, order: readonly string[]): Tracer[] {
  const known = new Set(order);
  const mutualIds = new Set(reveal.mutual.flat());
  const out: Tracer[] = [];
  for (const from of order) {
    const to = reveal.targets[from];
    if (to === null || to === undefined || !known.has(to) || to === from) continue;
    const isMutual = mutualIds.has(from) && reveal.targets[to] === from;
    out.push({ from, to, mutual: isMutual });
  }
  return out;
}

export type Outcome = "hit" | "free" | "clash" | "idle";

/** Bir oyuncunun sonucu: vuruldu (−1), serbest atış (+1), çarpışma (0) ya da boşta (0). */
export function outcomeOf(reveal: CaprazAtesReveal, id: string): Outcome {
  if (reveal.mutual.some((pair) => pair.includes(id))) return "clash";
  const score = reveal.scores[id] ?? 0;
  if (score < 0) return "hit";
  if (score > 0) return "free";
  return "idle";
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

/** Izgara sütun sayısı. Alçak (yatay telefon) ekranda 7 kişi 4 sütuna, dik ekranda 3 sütuna yerleşir. */
export function gridColumns(count: number, short = false): number {
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return short ? 4 : 3;
}
