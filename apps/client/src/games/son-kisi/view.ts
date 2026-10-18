import type { SonKisiPublicView, SonKisiResult, SonKisiTension, SonKisiView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

function parseTension(v: unknown): SonKisiTension | null {
  return v === 0 || v === 1 || v === 2 || v === 3 ? v : null;
}

function parseResult(v: unknown): SonKisiResult | null {
  if (!isRec(v) || !Array.isArray(v.escapes) || !isStrArr(v.last) || !isStrArr(v.missed)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  const escapes: SonKisiResult["escapes"] = [];
  for (const e of v.escapes) {
    if (!isRec(e) || typeof e.id !== "string" || !isNum(e.ms)) return null;
    escapes.push({ id: e.id, ms: e.ms });
  }
  return { escapes, last: v.last, missed: v.missed, scores };
}

/** Sunucudan gelen `publicView` bilinmez; Son Kişi ortak görünümü olarak doğrulanır. */
export function parseSonKisiPublicView(v: unknown): SonKisiPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isStrArr(v.escaped) || typeof v.finished !== "boolean")
    return null;
  const tension = parseTension(v.tension);
  if (tension === null) return null;
  let result: SonKisiResult | null = null;
  if (v.result !== null) {
    result = parseResult(v.result);
    if (!result) return null;
  }
  return { startedAt: v.startedAt, escaped: v.escaped, tension, finished: v.finished, result };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSonKisiPrivateView(v: unknown): SonKisiView | null {
  if (!isRec(v) || typeof v.escaped !== "boolean") return null;
  return { escaped: v.escaped };
}

export interface SonKisiScreenView {
  pub: SonKisiPublicView;
  priv: SonKisiView;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseSonKisiView(publicView: unknown, view: unknown): SonKisiScreenView | null {
  const pub = parseSonKisiPublicView(publicView);
  const priv = parseSonKisiPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Süre metni: 12,4 sn (Türkçe virgül). */
export function formatSeconds(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 10)},${tenths % 10} sn`;
}

/** Sonuç başlığı. */
export function resultHeadline(r: SonKisiResult): string {
  if (r.escapes.length === 0) return "Kimse kaçmadı";
  return r.last.length > 1 ? "Son kaçanlar" : "Son kaçan";
}

/** Gerilim düzeyine göre titreşim/ışık nabzı süresi (ms); düzey arttıkça hızlanır. */
export function pulseMs(tension: SonKisiTension): number {
  return [2800, 1700, 1000, 520][tension] ?? 2800;
}
