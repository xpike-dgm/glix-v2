import type { KorBombaPass, KorBombaPublicView, KorBombaView } from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function parsePass(v: unknown): KorBombaPass | null {
  if (!isRec(v) || !isNum(v.seq) || !isStr(v.from) || !isStr(v.to)) return null;
  return { seq: v.seq, from: v.from, to: v.to };
}

/** Sunucudan gelen `publicView` bilinmez; Kör Bomba ortak görünümü olarak doğrulanır. */
export function parseKorBombaPublicView(v: unknown): KorBombaPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isStr(v.holder) || !isNum(v.passes)) return null;
  if (typeof v.exploded !== "boolean") return null;
  if (v.explodedAt !== null && !isNum(v.explodedAt)) return null;
  let lastPass: KorBombaPass | null = null;
  if (v.lastPass !== null) {
    lastPass = parsePass(v.lastPass);
    if (!lastPass) return null;
  }
  return {
    startedAt: v.startedAt,
    holder: v.holder,
    passes: v.passes,
    lastPass,
    exploded: v.exploded,
    explodedAt: v.explodedAt,
  };
}

/** Sunucudan gelen `view` bilinmez; Kör Bomba kişisel görünümü olarak doğrulanır. */
export function parseKorBombaPrivateView(v: unknown): KorBombaView | null {
  if (!isRec(v)) return null;
  if (v.role === "holder") return { role: "holder" };
  if (v.role === "spectator") return { role: "spectator" };
  if (v.role === "watcher") {
    if (!isNum(v.explodeAt)) return null;
    if (v.lastBonusMs !== null && !isNum(v.lastBonusMs)) return null;
    return { role: "watcher", explodeAt: v.explodeAt, lastBonusMs: v.lastBonusMs };
  }
  return null;
}

export interface KorBombaScreenView {
  pub: KorBombaPublicView;
  priv: KorBombaView;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseKorBombaView(publicView: unknown, view: unknown): KorBombaScreenView | null {
  const pub = parseKorBombaPublicView(publicView);
  const priv = parseKorBombaPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Kalan süre (ms); yalnız süreyi gören katılımcıda, aksi halde null. Negatif olmaz. */
export function remainingMs(view: KorBombaScreenView, now: number): number | null {
  if (view.priv.role !== "watcher") return null;
  return Math.max(0, view.priv.explodeAt - now);
}

/** Büyük sayaç metni: 12,4 (bir ondalık, Türkçe virgül). */
export function formatRemaining(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}

/** Eklenen süre kıvılcımı: +2,5 */
export function formatBonus(ms: number): string {
  const tenths = Math.round(Math.max(0, ms) / 100);
  return `+${Math.floor(tenths / 10)},${tenths % 10}`;
}

/** Koltukların yüzde konumu (0-100). Kendin altta; diğerleri saat yönünde (izleyicide ilk katılımcı altta). */
export interface SeatPos {
  id: string;
  x: number;
  y: number;
}

export function seatPositions(ids: readonly string[], selfId: string): SeatPos[] {
  const mine = ids.indexOf(selfId);
  const ordered = mine > 0 ? [...ids.slice(mine), ...ids.slice(0, mine)] : [...ids];
  const n = Math.max(1, ordered.length);
  return ordered.map((id, i) => {
    const a = Math.PI / 2 + (i / n) * Math.PI * 2;
    return { id, x: 50 + 41 * Math.cos(a), y: 50 + 36 * Math.sin(a) };
  });
}
