import type { SozlukCard, SozlukPhase, SozlukPublicView, SozlukReveal, SozlukView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");
const PHASES: readonly SozlukPhase[] = ["write", "pick", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type SozlukScreenView = SozlukPublicView & SozlukView;

export interface CrewMember {
  id: string;
  nickname: string;
  avatar: number;
  connected: boolean;
}

function parseStringRecord(v: unknown): Record<string, string> | null {
  if (!isRec(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(v)) {
    if (typeof s !== "string") return null;
    out[k] = s;
  }
  return out;
}

function parseCards(v: unknown): SozlukCard[] | null {
  if (!Array.isArray(v)) return null;
  const out: SozlukCard[] = [];
  for (const c of v) {
    if (!isRec(c) || typeof c.id !== "string" || typeof c.text !== "string") return null;
    out.push({ id: c.id, text: c.text });
  }
  return out;
}

function parseReveal(v: unknown): SozlukReveal | null {
  if (!isRec(v) || typeof v.realCard !== "string") return null;
  const authors = parseStringRecord(v.authors);
  const picks = parseStringRecord(v.picks);
  const scores = parseNumberRecord(v.scores);
  if (!authors || !picks || !scores) return null;
  return { realCard: v.realCard, authors, picks, scores };
}

/** Sunucudan gelen `publicView` bilinmez; Sözlük Blöfü ortak görünümü olarak doğrulanır. */
export function parseSozlukPublicView(v: unknown): SozlukPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrArr(v.players) || !isStrArr(v.ready) || typeof v.word !== "string") return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as SozlukPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.writeEndsAt) || !isNum(v.pickEndsAt) || !isNum(v.finishAt)) return null;
  const cards = v.cards === null || v.cards === undefined ? null : parseCards(v.cards);
  if (v.cards !== null && v.cards !== undefined && cards === null) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    phase: v.phase as SozlukPhase,
    word: v.word,
    startedAt: v.startedAt,
    writeEndsAt: v.writeEndsAt,
    pickEndsAt: v.pickEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    cards,
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseSozlukPrivateView(v: unknown): SozlukView | null {
  if (!isRec(v)) return null;
  for (const key of ["myBluff", "myCard", "myPick"] as const) {
    if (v[key] !== null && typeof v[key] !== "string") return null;
  }
  if (typeof v.locked !== "boolean") return null;
  return {
    myBluff: v.myBluff as string | null,
    myCard: v.myCard as string | null,
    myPick: v.myPick as string | null,
    locked: v.locked,
  };
}

export function parseSozlukView(publicView: unknown, view: unknown): SozlukScreenView | null {
  const pub = parseSozlukPublicView(publicView);
  const priv = parseSozlukPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Sunucunun reddetme nedeni → oyuncuya gösterilen dostça Türkçe cümle (teknik kod gösterilmez). */
export function bluffErrorText(reason: string | undefined): string {
  switch (reason) {
    case "same_as_real":
      return "Bu zaten gerçek anlam! Kendi cümleni yaz.";
    case "too_long":
      return "Biraz kısalt, en çok 100 karakter.";
    case "empty":
      return "Önce bir şeyler yaz.";
    case "not_writing":
    case "ended":
      return "Süre doldu.";
    case "already_written":
      return "Tanımın zaten gönderildi.";
    default:
      return "Gönderemedim, tekrar dene.";
  }
}

/** Gönder düğmesi için: görünür karakter var mı ve en çok 100 karakter mi. */
export function canSubmitBluff(text: string, max = 100): boolean {
  const trimmed = text.replace(/\s+/gu, " ").trim();
  return trimmed.length > 0 && [...trimmed].length <= max;
}

export interface RevealCard {
  id: string;
  text: string;
  real: boolean;
  author: string | null;
  /** Bu kartı seçenler (katılım sırasıyla). */
  pickers: string[];
}

/**
 * Açılışta gösterilecek kartlar: gerçek kart başta, sonra sahte kartlar seçilme sayısına göre (eşitte kart sırasıyla).
 * Bilinmeyen/bozuk eşleşmeler atılır.
 */
export function revealCards(
  cards: readonly SozlukCard[],
  reveal: SozlukReveal,
  order: readonly string[],
): RevealCard[] {
  const out = cards.map((c) => ({
    id: c.id,
    text: c.text,
    real: c.id === reveal.realCard,
    author: reveal.authors[c.id] ?? null,
    pickers: order.filter((p) => reveal.picks[p] === c.id),
  }));
  return out
    .map((c, i) => ({ c, i }))
    .sort(
      (a, b) => Number(b.c.real) - Number(a.c.real) || b.c.pickers.length - a.c.pickers.length || a.i - b.i,
    )
    .map((x) => x.c);
}
