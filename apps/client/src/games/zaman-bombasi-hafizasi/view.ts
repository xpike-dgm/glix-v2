import {
  ZAMAN_BOMBASI_COLORS,
  type ZamanBombasiColor,
  type ZamanBombasiLast,
  type ZamanBombasiPhase,
  type ZamanBombasiPublicView,
  type ZamanBombasiView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const PHASES: readonly ZamanBombasiPhase[] = ["pause", "playback", "input", "over"];

export function asColor(v: unknown): ZamanBombasiColor | null {
  return ZAMAN_BOMBASI_COLORS.find((c) => c === v) ?? null;
}

function colorList(v: unknown): ZamanBombasiColor[] | null {
  if (!Array.isArray(v)) return null;
  const out: ZamanBombasiColor[] = [];
  for (const x of v) {
    const c = asColor(x);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

function parseLast(v: unknown): ZamanBombasiLast | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (!isNum(v.turn) || !isNum(v.at) || typeof v.player !== "string") return undefined;
  if (v.kind !== "ok" && v.kind !== "fail" && v.kind !== "timeout") return undefined;
  const last: ZamanBombasiLast = { turn: v.turn, player: v.player, kind: v.kind, at: v.at };
  const color = asColor(v.color);
  const expected = asColor(v.expected);
  if (color) last.color = color;
  if (expected) last.expected = expected;
  return last;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type ZamanBombasiScreenView = ZamanBombasiPublicView & ZamanBombasiView;

/** Sunucudan gelen `publicView` bilinmez; Zaman Bombası Hafızası ortak görünümü olarak doğrulanır. */
export function parseZamanBombasiPublicView(v: unknown): ZamanBombasiPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.order) || !isStrArr(v.eliminated)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  if (v.active !== null && typeof v.active !== "string") return null;
  const phase = PHASES.find((p) => p === v.phase);
  if (!phase) return null;
  if (
    !isNum(v.length) ||
    !isNum(v.turn) ||
    !isNum(v.turnStart) ||
    !isNum(v.inputStart) ||
    !isNum(v.deadline) ||
    !isNum(v.stepMs) ||
    !isNum(v.playbackIndex) ||
    !isNum(v.need)
  )
    return null;
  if (v.length < 1 || v.length > 200 || v.stepMs <= 0) return null;
  const sequence = v.sequence === null ? null : colorList(v.sequence);
  if (v.sequence !== null && sequence === null) return null;
  const pressed = colorList(v.pressed);
  if (!pressed) return null;
  const last = parseLast(v.last);
  if (last === undefined) return null;
  return {
    order: v.order,
    eliminated: v.eliminated,
    scores,
    active: v.active,
    length: v.length,
    phase,
    turn: v.turn,
    turnStart: v.turnStart,
    inputStart: v.inputStart,
    deadline: v.deadline,
    stepMs: v.stepMs,
    playbackIndex: v.playbackIndex,
    sequence,
    pressed,
    need: v.need,
    last,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseZamanBombasiPrivateView(v: unknown): ZamanBombasiView | null {
  if (!isRec(v)) return null;
  if (typeof v.isOut !== "boolean" || typeof v.myTurn !== "boolean") return null;
  if (v.turnsAway !== null && !isNum(v.turnsAway)) return null;
  return { isOut: v.isOut, myTurn: v.myTurn, turnsAway: v.turnsAway };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseZamanBombasiView(publicView: unknown, view: unknown): ZamanBombasiScreenView | null {
  const pub = parseZamanBombasiPublicView(publicView);
  const priv = parseZamanBombasiPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/**
 * İstemcinin kendi saatinden türettiği evre. Sunucu görünümü yalnız durum değişince gelir; evre geçişleri
 * mutlak zamanlardan çıkar. Süre dolduktan sonra sunucunun yeni sırayı bildirmesine kadar `expired`.
 */
export type ClientPhase = "pause" | "playback" | "input" | "expired" | "over";

export function clientPhase(
  v: Pick<ZamanBombasiPublicView, "phase" | "turnStart" | "inputStart" | "deadline">,
  now: number,
): ClientPhase {
  if (v.phase === "over") return "over";
  if (now < v.turnStart) return "pause";
  if (now < v.inputStart) return "playback";
  if (now < v.deadline) return "input";
  return "expired";
}

/** Bir elemanın yanık kaldığı süre: kısa dizide yavaş ve belirgin, uzadıkça daha ritmik (kısa ışık). */
export function litMs(length: number, stepMs: number): number {
  const ratio = length <= 3 ? 0.8 : length <= 5 ? 0.66 : 0.55;
  return Math.round(stepMs * ratio);
}

/** Oynatmada `now` anında yanan elemanın sırası; sönükse (ya da oynatma dışıysa) -1. */
export function litIndexAt(
  v: Pick<ZamanBombasiPublicView, "turnStart" | "stepMs" | "length">,
  now: number,
): number {
  const elapsed = now - v.turnStart;
  if (elapsed < 0) return -1;
  const i = Math.floor(elapsed / v.stepMs);
  if (i >= v.length) return -1;
  return elapsed - i * v.stepMs < litMs(v.length, v.stepMs) ? i : -1;
}

/** Sıra özetinin yeni mi olduğu: `last` bu ekran açıkken değişti mi. */
export function isNewResult(last: ZamanBombasiLast | null, seenTurn: number | null): boolean {
  return last !== null && seenTurn !== null && last.turn > seenTurn;
}

/** Evre başlığı için kısa durum. Yalnız görünümden türer. */
export type StatusKind =
  | "intro"
  | "watch"
  | "watchMine"
  | "mine"
  | "other"
  | "ok"
  | "fail"
  | "timeout"
  | "eliminated"
  | "over";

export function statusOf(args: {
  v: ZamanBombasiScreenView;
  phase: ClientPhase;
  spectator: boolean;
}): StatusKind {
  const { v, phase, spectator } = args;
  if (phase === "over") return "over";
  const mine = !spectator && v.myTurn;
  if (phase === "pause") {
    if (v.last && v.last.turn === v.turn - 1) {
      if (v.last.kind === "fail") return "fail";
      if (v.last.kind === "timeout") return "timeout";
      return "ok";
    }
    return "intro";
  }
  if (phase === "playback") return mine ? "watchMine" : "watch";
  if (!spectator && v.isOut) return "eliminated";
  return mine ? "mine" : "other";
}
