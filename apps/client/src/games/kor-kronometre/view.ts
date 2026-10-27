import type {
  KorKronometreEntry,
  KorKronometrePublicView,
  KorKronometreReveal,
  KorKronometreView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Hedef aralığı (tam saniye); sunucu sözleşmesiyle aynı. */
const TARGET_MIN_MS = 7_000;
const TARGET_MAX_MS = 13_000;
/** Çizgi, hedef + 8 sn'lik basış süresini kapsar (ibre konumu için). */
const EXTRA_MS = 8_000;

function parseEntry(v: unknown): KorKronometreEntry | null {
  if (!isRec(v) || !isStr(v.playerId)) return null;
  const { ms, distance, rank, points } = v;
  if (typeof v.pressed !== "boolean") return null;
  if (!isNum(points) || !Number.isInteger(points)) return null;
  if (!v.pressed) {
    // Basmayan: sıralamaya girmez, süresi/mesafesi/derecesi yoktur, puanı 0'dır.
    if (ms !== null || distance !== null || rank !== null || points !== 0) return null;
    return { playerId: v.playerId, ms: null, pressed: false, distance: null, rank: null, points: 0 };
  }
  if (!isNum(ms) || ms < 0 || ms > 1_000_000) return null;
  if (!isNum(distance) || distance < 0) return null;
  if (!isNum(rank) || !Number.isInteger(rank) || rank < 1) return null;
  return { playerId: v.playerId, ms, pressed: true, distance, rank, points };
}

function parseReveal(v: unknown): KorKronometreReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !Array.isArray(v.entries) || v.entries.length > 16) return undefined;
  const entries: KorKronometreEntry[] = [];
  for (const raw of v.entries) {
    const e = parseEntry(raw);
    if (!e) return undefined;
    entries.push(e);
  }
  return { entries };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KorKronometreScreenView = KorKronometrePublicView & KorKronometreView;

export function parseKorKronometrePublicView(v: unknown): KorKronometrePublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt)) return null;
  if (!isNum(v.targetMs) || !Number.isInteger(v.targetMs / 1000)) return null;
  if (v.targetMs < TARGET_MIN_MS || v.targetMs > TARGET_MAX_MS) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return {
    startedAt: v.startedAt,
    targetMs: v.targetMs,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    reveal,
  };
}

export function parseKorKronometrePrivateView(v: unknown): KorKronometreView | null {
  if (!isRec(v) || typeof v.pressed !== "boolean") return null;
  return { pressed: v.pressed };
}

export function parseKorKronometreView(publicView: unknown, view: unknown): KorKronometreScreenView | null {
  const pub = parseKorKronometrePublicView(publicView);
  const priv = parseKorKronometrePrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export type Phase = "counting" | "revealed";

export function phaseOf(view: KorKronometreScreenView | null): Phase {
  return view?.reveal ? "revealed" : "counting";
}

/** 9850 → "9,85" (Türkçe ondalık virgül, iki hane; sıralama yuvarlanmamış değerle yapılır). */
export function formatSeconds(ms: number): string {
  return (Math.round(ms / 10) / 100).toFixed(2).replace(".", ",");
}

/** Hedefe göre fark: "−0,15 sn" (erken) / "+0,15 sn" (geç) / "tam isabet". */
export function formatOffset(ms: number, targetMs: number): string {
  const d = Math.round((ms - targetMs) / 10) / 100;
  if (d === 0) return "tam isabet";
  const abs = Math.abs(d).toFixed(2).replace(".", ",");
  return `${d < 0 ? "−" : "+"}${abs} sn`;
}

/** Herkese gösterilen hedef: "Hedef: 11 saniye". */
export function formatTarget(targetMs: number): string {
  return `Hedef: ${Math.round(targetMs / 1000)} saniye`;
}

/** Basış anının çizgi üzerindeki konumu (yüzde, 0..100); çizgi 0..hedef+8 sn. */
export function trackPercent(ms: number, targetMs: number): number {
  return Math.max(0, Math.min(100, (ms / (targetMs + EXTRA_MS)) * 100));
}

export function targetPercent(targetMs: number): number {
  return trackPercent(targetMs, targetMs);
}

export function entryOf(reveal: KorKronometreReveal | null, playerId: string): KorKronometreEntry | null {
  return reveal?.entries.find((e) => e.playerId === playerId) ?? null;
}
