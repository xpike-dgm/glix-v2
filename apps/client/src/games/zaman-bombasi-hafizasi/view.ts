import {
  ZAMAN_BOMBASI_COLORS,
  type ZamanBombasiColor,
  type ZamanBombasiLast,
  type ZamanBombasiPhase,
  type ZamanBombasiPick,
  type ZamanBombasiPublicView,
  type ZamanBombasiThrow,
  type ZamanBombasiView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const PHASES: readonly ZamanBombasiPhase[] = ["pick", "pause", "playback", "input", "over"];

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

function parsePick(v: unknown): ZamanBombasiPick | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (typeof v.by !== "string" || (v.kind !== "throw" && v.kind !== "restart")) return undefined;
  if (!isNum(v.opensAt) || !isNum(v.deadline) || v.deadline < v.opensAt) return undefined;
  if (typeof v.colorDone !== "boolean") return undefined;
  if (v.blocked !== null && typeof v.blocked !== "string") return undefined;
  return {
    by: v.by,
    kind: v.kind,
    opensAt: v.opensAt,
    deadline: v.deadline,
    colorDone: v.colorDone,
    blocked: v.blocked,
  };
}

function parseThrow(v: unknown): ZamanBombasiThrow | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (v.from !== null && typeof v.from !== "string") return undefined;
  if (typeof v.to !== "string" || !isNum(v.at) || typeof v.auto !== "boolean") return undefined;
  return { from: v.from, to: v.to, at: v.at, auto: v.auto };
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
    !isNum(v.need) ||
    !isNum(v.startedAt) ||
    !isNum(v.endsAt) ||
    !isNum(v.suddenDeathAt) ||
    typeof v.timeUp !== "boolean"
  )
    return null;
  if (v.endsAt <= v.startedAt || v.suddenDeathAt < v.startedAt || v.suddenDeathAt > v.endsAt) return null;
  if (v.length < 1 || v.length > 200 || v.stepMs <= 0) return null;
  const sequence = v.sequence === null ? null : colorList(v.sequence);
  if (v.sequence !== null && sequence === null) return null;
  const pressed = colorList(v.pressed);
  if (!pressed) return null;
  const last = parseLast(v.last);
  if (last === undefined) return null;
  const pick = parsePick(v.pick);
  const lastThrow = parseThrow(v.lastThrow);
  if (pick === undefined || lastThrow === undefined) return null;
  if ((phase === "pick") !== (pick !== null)) return null;
  return {
    order: v.order,
    eliminated: v.eliminated,
    scores,
    active: v.active,
    pick,
    lastThrow,
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
    startedAt: v.startedAt,
    endsAt: v.endsAt,
    suddenDeathAt: v.suddenDeathAt,
    timeUp: v.timeUp,
    last,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseZamanBombasiPrivateView(v: unknown): ZamanBombasiView | null {
  if (!isRec(v)) return null;
  if (typeof v.isOut !== "boolean" || typeof v.myTurn !== "boolean" || typeof v.myPick !== "boolean")
    return null;
  const pickColor = v.pickColor === null ? null : asColor(v.pickColor);
  if (pickColor === null && v.pickColor !== null) return null;
  return { isOut: v.isOut, myTurn: v.myTurn, myPick: v.myPick, pickColor };
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
export type ClientPhase = "pick" | "pause" | "playback" | "input" | "expired" | "over";

export function clientPhase(
  v: Pick<ZamanBombasiPublicView, "phase" | "turnStart" | "inputStart" | "deadline"> &
    Partial<Pick<ZamanBombasiPublicView, "endsAt" | "pick">>,
  now: number,
): ClientPhase {
  if (v.phase === "over") return "over";
  // Seçim evresi: süresi (ya da toplam süre) dolunca sunucunun atışı bildirmesine kadar `expired`.
  if (v.phase === "pick") {
    if (!v.pick || now >= v.pick.deadline) return "expired";
    if (v.endsAt !== undefined && now >= v.endsAt) return "expired";
    return "pick";
  }
  // Toplam süre dolduysa giriş bitmiştir (sunucu sırayı cezasız iptal eder).
  if (v.endsAt !== undefined && now >= v.endsAt && now >= v.inputStart) return "expired";
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

/** Evre başlığı için kısa durum. Yalnız görünümden ve saatten türer. */
export type StatusKind =
  | "intro"
  | "alert"
  | "thrown"
  | "watch"
  | "watchMine"
  | "mine"
  | "other"
  | "ok"
  | "fail"
  | "timeout"
  | "pickColor"
  | "pickTarget"
  | "pickOther"
  | "eliminated"
  | "over";

export function statusOf(args: {
  v: ZamanBombasiScreenView;
  phase: ClientPhase;
  spectator: boolean;
  now: number;
}): StatusKind {
  const { v, phase, spectator, now } = args;
  if (phase === "over") return "over";
  const resultKind = (): StatusKind =>
    v.last?.kind === "fail" ? "fail" : v.last?.kind === "timeout" ? "timeout" : "ok";
  const picker = !spectator && v.myPick;
  if (v.phase === "pick" && v.pick) {
    // Seçim ekranı açılmadan önce sıranın sonucu gösterilir ("TEMİZ!" ya da patlama).
    if (phase === "pick" && now < v.pick.opensAt && v.last) return resultKind();
    if (!picker) return "pickOther";
    return v.pick.colorDone ? "pickTarget" : "pickColor";
  }
  const mine = !spectator && v.myTurn;
  if (phase === "pause") {
    // Atanı olmayan elenmede bomba patlama gösteriminden sonra atılır.
    if (v.lastThrow && now < v.lastThrow.at && v.last && v.last.turn === v.turn - 1) return resultKind();
    if (mine) return "alert";
    return v.lastThrow ? "thrown" : "intro";
  }
  if (phase === "playback") return mine ? "watchMine" : "watch";
  if (!spectator && v.isOut) return "eliminated";
  return mine ? "mine" : "other";
}

/**
 * Fitilin yanmış payı (0 = yeni, 1 = bitti): son 2 sn'de kıvılcım iki kat hızlı ilerler (ZB-U1).
 * `total` giriş süresi, `left` kalan süre (ms).
 */
export const FUSE_RUSH_MS = 2_000;
export function fuseBurnt(total: number, left: number): number {
  if (total <= 0) return 1;
  const l = Math.min(total, Math.max(0, left));
  const rush = Math.min(FUSE_RUSH_MS, total);
  const rate = 1 / (total + rush);
  const elapsed = total - l;
  const calm = total - rush;
  const burnt = elapsed <= calm ? elapsed * rate : calm * rate + (elapsed - calm) * 2 * rate;
  return Math.min(1, burnt);
}

/** Fitil tikinin aralığı (ms): son 2 sn'de sıklaşır. */
export function fuseTickMs(left: number): number {
  return left <= 1_000 ? 160 : left <= FUSE_RUSH_MS ? 250 : 500;
}

/** "DİZİ N" sayacının tonu: 8+ turuncu, 12+ kırmızı (ZB-U3). */
export function lengthTone(length: number): "" | "amber" | "red" {
  return length >= 12 ? "red" : length >= 8 ? "amber" : "";
}

/** Ani ölüm evresinde miyiz (oyun başından 60 sn geçti, toplam süre bitmedi). */
export function isSuddenDeath(
  v: Pick<ZamanBombasiPublicView, "suddenDeathAt" | "endsAt">,
  now: number,
): boolean {
  return now > v.suddenDeathAt && now < v.endsAt;
}

/** Kalan toplam süre "d:ss" (örn. 1:05); yukarı yuvarlanır, negatifte 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
