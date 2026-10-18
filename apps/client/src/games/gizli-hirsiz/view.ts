import type { GizliHirsizPublicView, GizliHirsizReveal, GizliHirsizView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseReveal(v: unknown): GizliHirsizReveal | null {
  if (!isRec(v) || !Array.isArray(v.thieves)) return null;
  if (!v.thieves.every((t) => typeof t === "string")) return null;
  if (v.outcome !== "solo" && v.outcome !== "multi" && v.outcome !== "none") return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return { thieves: v.thieves as string[], outcome: v.outcome, scores };
}

/** Sunucudan gelen `publicView` bilinmez; Gizli Hırsız ortak görünümü olarak doğrulanır. */
export function parseGizliHirsizPublicView(v: unknown): GizliHirsizPublicView | null {
  if (!isRec(v) || !isNum(v.startedAt) || !isNum(v.endsAt) || typeof v.finished !== "boolean") return null;
  let reveal: GizliHirsizReveal | null = null;
  if (v.reveal !== null) {
    reveal = parseReveal(v.reveal);
    if (!reveal) return null;
  }
  return { startedAt: v.startedAt, endsAt: v.endsAt, finished: v.finished, reveal };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseGizliHirsizPrivateView(v: unknown): GizliHirsizView | null {
  if (!isRec(v) || typeof v.pressed !== "boolean") return null;
  return { pressed: v.pressed };
}

export type GizliHirsizScreenView = GizliHirsizPublicView & GizliHirsizView;

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseGizliHirsizView(publicView: unknown, view: unknown): GizliHirsizScreenView | null {
  const pub = parseGizliHirsizPublicView(publicView);
  const priv = parseGizliHirsizPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Açılış metni: sonucun tek cümlelik özeti. */
export function revealHeadline(r: GizliHirsizReveal): string {
  if (r.outcome === "solo") return "Kasa soyuldu!";
  if (r.outcome === "multi") return "Alarm! Birden çok hırsız";
  return "Kimse çalmadı";
}
