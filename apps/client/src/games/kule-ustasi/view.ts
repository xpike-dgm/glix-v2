import type { KuleBlock, KuleLast, KulePublicView, KuleView } from "@glix/engine";
import { KULE_TRACK } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const MAX_BLOCKS = 400;

function parseBlock(v: unknown): KuleBlock | null {
  if (!isRec(v) || !isNum(v.left) || !isNum(v.width) || typeof v.perfect !== "boolean") return null;
  if (v.width <= 0 || v.left < 0 || v.left + v.width > KULE_TRACK) return null;
  return { left: v.left, width: v.width, perfect: v.perfect };
}

function parseBlocks(v: unknown): KuleBlock[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_BLOCKS) return null;
  const out: KuleBlock[] = [];
  for (const x of v) {
    const b = parseBlock(x);
    if (!b) return null;
    out.push(b);
  }
  return out;
}

function parseLast(v: unknown): KuleLast | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (v.kind !== "ok" && v.kind !== "perfect" && v.kind !== "miss") return undefined;
  if (
    !isNum(v.turn) ||
    !isNum(v.at) ||
    typeof v.player !== "string" ||
    typeof v.auto !== "boolean" ||
    !isNum(v.dropLeft) ||
    !isNum(v.dropWidth) ||
    !isNum(v.cutLeft) ||
    !isNum(v.cutWidth)
  )
    return undefined;
  const last: KuleLast = {
    turn: v.turn,
    player: v.player,
    kind: v.kind,
    at: v.at,
    auto: v.auto,
    dropLeft: v.dropLeft,
    dropWidth: v.dropWidth,
    cutLeft: v.cutLeft,
    cutWidth: v.cutWidth,
  };
  if (v.fallen !== undefined) {
    const fallen = parseBlocks(v.fallen);
    if (!fallen) return undefined;
    last.fallen = fallen;
  }
  return last;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KuleScreenView = KulePublicView & KuleView;

/** Sunucudan gelen `publicView` bilinmez; Kule Ustası ortak görünümü olarak doğrulanır. */
export function parseKulePublicView(v: unknown): KulePublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.order) || !isStrArr(v.eliminated)) return null;
  const scores = parseNumberRecord(v.scores);
  const perfects = parseNumberRecord(v.perfects);
  if (!scores || !perfects) return null;
  if (v.active !== null && typeof v.active !== "string") return null;
  if (
    !isNum(v.turn) ||
    !isNum(v.turnStart) ||
    !isNum(v.deadline) ||
    !isNum(v.speed) ||
    !isNum(v.blockWidth) ||
    !isNum(v.floors) ||
    !isNum(v.need) ||
    !isNum(v.startedAt) ||
    !isNum(v.endsAt) ||
    typeof v.timeUp !== "boolean"
  )
    return null;
  if (v.endsAt <= v.startedAt || v.speed < 1 || v.blockWidth <= 0 || v.blockWidth > KULE_TRACK) return null;
  const tower = parseBlocks(v.tower);
  if (!tower) return null;
  const last = parseLast(v.last);
  if (last === undefined) return null;
  return {
    order: v.order,
    eliminated: v.eliminated,
    scores,
    perfects,
    active: v.active,
    turn: v.turn,
    turnStart: v.turnStart,
    deadline: v.deadline,
    speed: v.speed,
    blockWidth: v.blockWidth,
    tower,
    floors: v.floors,
    need: v.need,
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    timeUp: v.timeUp,
    last,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseKulePrivateView(v: unknown): KuleView | null {
  if (!isRec(v)) return null;
  if (typeof v.isOut !== "boolean" || typeof v.myTurn !== "boolean") return null;
  if (v.turnsAway !== null && !isNum(v.turnsAway)) return null;
  return { isOut: v.isOut, myTurn: v.myTurn, turnsAway: v.turnsAway };
}

export function parseKuleView(publicView: unknown, view: unknown): KuleScreenView | null {
  const pub = parseKulePublicView(publicView);
  const priv = parseKulePrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** İstemcinin kendi saatinden türettiği evre; sunucu görünümü yalnız durum değişince gelir. */
export type KulePhase = "pause" | "moving" | "expired" | "over";

export function kulePhase(
  v: Pick<KulePublicView, "turnStart" | "deadline" | "endsAt" | "active" | "timeUp">,
  now: number,
): KulePhase {
  if (v.active === null || v.timeUp) return "over";
  if (now >= v.endsAt) return "expired";
  if (now < v.turnStart) return "pause";
  if (now < v.deadline) return "moving";
  return "expired";
}

/** Sıra başlığı için kısa durum. Yalnız görünümden türer. */
export type KuleStatus = "intro" | "mine" | "other" | "ok" | "perfect" | "miss" | "eliminated" | "over";

export function kuleStatus(args: { v: KuleScreenView; phase: KulePhase; spectator: boolean }): KuleStatus {
  const { v, phase, spectator } = args;
  if (phase === "over") return "over";
  if (phase === "pause") {
    if (v.last && v.last.turn === v.turn - 1) return v.last.kind;
    return "intro";
  }
  if (!spectator && v.isOut) return "eliminated";
  return !spectator && v.myTurn ? "mine" : "other";
}

/** Sonuç bu ekran açıkken mi geldi (açılışta eski sonuç efekt vermesin). */
export function isNewResult(last: KuleLast | null, seenTurn: number | null): boolean {
  return last !== null && seenTurn !== null && last.turn > seenTurn;
}

/** Kalan toplam süre "d:ss" (örn. 1:05); yukarı yuvarlanır, negatifte 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Pist birimini yüzdeye çevirir (0..100). */
export const pct = (units: number): number => (units / KULE_TRACK) * 100;
