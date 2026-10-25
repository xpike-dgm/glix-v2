import type {
  LafCard,
  LafCardResult,
  LafDuel,
  LafDuelReveal,
  LafPhase,
  LafPublicView,
  LafTask,
  LafTone,
  LafView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isNullableStr = (v: unknown): v is string | null => v === null || isStr(v);
const PHASES: readonly LafPhase[] = ["write", "vote", "reveal", "finalWrite", "finalVote", "finalReveal"];
const TONES: readonly LafTone[] = ["aile", "arkadas", "ofis"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type LafScreenView = LafPublicView & LafView;

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

function parseCard(v: unknown): LafCard | null {
  if (!isRec(v) || !isStr(v.id) || !isNullableStr(v.text)) return null;
  return { id: v.id, text: v.text };
}

function parseDuel(v: unknown): LafDuel | null {
  if (!isRec(v) || !isStr(v.id) || !isStr(v.prompt) || !Array.isArray(v.cards)) return null;
  const cards: LafCard[] = [];
  for (const c of v.cards) {
    const card = parseCard(c);
    if (!card) return null;
    cards.push(card);
  }
  return { id: v.id, prompt: v.prompt, cards };
}

function parseCardResult(v: unknown): LafCardResult | null {
  if (!isRec(v) || !isStr(v.id) || !isStr(v.author) || !isNullableStr(v.text)) return null;
  if (!isStrArr(v.voters) || !isNum(v.points) || typeof v.master !== "boolean") return null;
  return {
    id: v.id,
    author: v.author,
    text: v.text,
    voters: [...v.voters],
    points: v.points,
    master: v.master,
  };
}

function parseReveal(v: unknown): LafDuelReveal | null {
  if (!isRec(v) || !isStr(v.id) || !isStr(v.prompt) || !Array.isArray(v.cards)) return null;
  const cards: LafCardResult[] = [];
  for (const c of v.cards) {
    const card = parseCardResult(c);
    if (!card) return null;
    cards.push(card);
  }
  return { id: v.id, prompt: v.prompt, cards };
}

/** Sunucudan gelen `publicView` bilinmez; Laf Sokma ortak görünümü olarak doğrulanır. */
export function parseLafPublicView(v: unknown): LafPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.ready) || !isStrArr(v.voters)) return null;
  if (!isStr(v.phase) || !PHASES.includes(v.phase as LafPhase)) return null;
  if (!isStr(v.tone) || !TONES.includes(v.tone as LafTone)) return null;
  if (v.index !== null && !isNum(v.index)) return null;
  if (!isNum(v.total) || !isNum(v.startedAt) || !isNum(v.stageStartedAt) || !isNum(v.stageEndsAt))
    return null;
  const duel = v.duel === null || v.duel === undefined ? null : parseDuel(v.duel);
  if (v.duel !== null && v.duel !== undefined && duel === null) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  const history: LafDuelReveal[] = [];
  if (!Array.isArray(v.history)) return null;
  for (const h of v.history) {
    const item = parseReveal(h);
    if (!item) return null;
    history.push(item);
  }
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return {
    players: [...v.players],
    tone: v.tone as LafTone,
    phase: v.phase as LafPhase,
    index: v.index === null ? null : (v.index as number),
    total: v.total,
    startedAt: v.startedAt,
    stageStartedAt: v.stageStartedAt,
    stageEndsAt: v.stageEndsAt,
    ready: [...v.ready],
    voters: [...v.voters],
    duel,
    reveal,
    history,
    scores,
  };
}

function parseTask(v: unknown): LafTask | null {
  if (!isRec(v) || !isStr(v.id) || !isStr(v.prompt) || !isNullableStr(v.answer)) return null;
  return { id: v.id, prompt: v.prompt, answer: v.answer };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseLafPrivateView(v: unknown): LafView | null {
  if (!isRec(v) || !Array.isArray(v.tasks)) return null;
  const tasks: LafTask[] = [];
  for (const t of v.tasks) {
    const task = parseTask(t);
    if (!task) return null;
    tasks.push(task);
  }
  if (typeof v.locked !== "boolean" || !isNullableStr(v.myCard) || !isNullableStr(v.myVote)) return null;
  return { tasks, locked: v.locked, myCard: v.myCard, myVote: v.myVote };
}

export function parseLafView(publicView: unknown, view: unknown): LafScreenView | null {
  const pub = parseLafPublicView(publicView);
  const priv = parseLafPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export const LAF_MAX_LENGTH = 80;

/** Sunucunun reddetme nedeni → oyuncuya gösterilen dostça Türkçe cümle (teknik kod gösterilmez). */
export function lafErrorText(reason: string | undefined): string {
  switch (reason) {
    case "inappropriate":
      return "Bu cevap pek uygun değil. Başka bir şey dene!";
    case "too_long":
      return "Biraz kısalt, en çok 80 karakter.";
    case "empty":
      return "Önce bir şeyler yaz.";
    case "invalid":
      return "Bu karakterleri kullanamayız.";
    case "locked":
      return "Cevapların zaten kesinleşti.";
    case "not_writing":
    case "ended":
      return "Süre doldu.";
    case "nothing_to_lock":
      return "Önce bir cevap yaz.";
    default:
      return "Gönderemedim, tekrar dene.";
  }
}

/** Cevap yazılabilir mi: görünür karakter var ve en çok 80 karakter. */
export function canSubmitAnswer(text: string, max = LAF_MAX_LENGTH): boolean {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  return trimmed.length > 0 && [...trimmed].length <= max;
}

/** Sunucunun yapacağı sadeleştirme (karşılaştırma için): boşluklar teke iner, uçlar kırpılır. */
export function tidyAnswer(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Final açılışı: en çok puan alandan aza; eşitte kart sırasıyla. */
export function rankedCards(cards: readonly LafCardResult[]): LafCardResult[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.points - a.c.points || a.i - b.i)
    .map((x) => x.c);
}

/** Düello açılışında: oy alan üstte; eşitte kart sırasıyla (soldaki kart önce). */
export function duelCards(cards: readonly LafCardResult[]): LafCardResult[] {
  return rankedCards(cards);
}

/** Bu açılışta senin kazandığın puan (kartın yoksa null). */
export function myPoints(reveal: LafDuelReveal | null, selfId: string): number | null {
  const card = reveal?.cards.find((c) => c.author === selfId);
  return card ? card.points : null;
}

/** Kartın görüntülenecek metni: cevap yoksa null. */
export const hasText = (c: { text: string | null }): boolean => c.text !== null;
