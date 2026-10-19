import type {
  YaziYazGuessResult,
  YaziYazPublicView,
  YaziYazReveal,
  YaziYazRole,
  YaziYazStage,
  YaziYazView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const STAGES: readonly YaziYazStage[] = ["write", "talk", "guess", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type YaziYazScreenView = YaziYazPublicView & YaziYazView;

function parseGuess(v: unknown): YaziYazGuessResult | null {
  if (!isRec(v)) return null;
  if (v.target !== null && !isStr(v.target)) return null;
  if (!isStr(v.word) || typeof v.personOk !== "boolean" || typeof v.wordOk !== "boolean") return null;
  return { target: v.target, word: v.word, personOk: v.personOk, wordOk: v.wordOk };
}

function parseReveal(v: unknown): YaziYazReveal | null {
  if (!isRec(v) || !isStrArr(v.writers) || !isRec(v.words) || !isRec(v.guesses)) return null;
  const words: Record<string, string> = {};
  for (const [id, w] of Object.entries(v.words)) {
    if (!isStr(w)) return null;
    words[id] = w;
  }
  const guesses: Record<string, YaziYazGuessResult> = {};
  for (const [id, g] of Object.entries(v.guesses)) {
    const parsed = parseGuess(g);
    if (!parsed) return null;
    guesses[id] = parsed;
  }
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return { writers: [...v.writers], words, guesses, scores };
}

export function parseYaziYazPublicView(v: unknown): YaziYazPublicView | null {
  if (!isRec(v) || !isStrArr(v.players)) return null;
  if (!isStr(v.stage) || !STAGES.includes(v.stage as YaziYazStage)) return null;
  if (!isNum(v.startedAt) || !isNum(v.writeEndsAt) || !isNum(v.talkEndsAt)) return null;
  if (!isNum(v.guessEndsAt) || !isNum(v.finishAt) || !isStrArr(v.ready)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    stage: v.stage as YaziYazStage,
    startedAt: v.startedAt,
    writeEndsAt: v.writeEndsAt,
    talkEndsAt: v.talkEndsAt,
    guessEndsAt: v.guessEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    reveal,
  };
}

export function parseYaziYazPrivateView(v: unknown): YaziYazView | null {
  if (!isRec(v)) return null;
  if (v.role !== null && v.role !== "writer" && v.role !== "innocent") return null;
  if (v.myText !== null && !isStr(v.myText)) return null;
  if (typeof v.locked !== "boolean" || !isRec(v.myGuess)) return null;
  if (v.myGuess.target !== null && !isStr(v.myGuess.target)) return null;
  if (!isStr(v.myGuess.word)) return null;
  return {
    role: v.role as YaziYazRole | null,
    myText: v.myText,
    locked: v.locked,
    myGuess: { target: v.myGuess.target, word: v.myGuess.word },
  };
}

export function parseYaziYazView(publicView: unknown, view: unknown): YaziYazScreenView | null {
  const pub = parseYaziYazPublicView(publicView);
  const priv = parseYaziYazPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Yuvarlak yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

export interface MyOutcome {
  /** Kişi tahmini doğru mu; tahmin vermediyse null. */
  personOk: boolean | null;
  wordOk: boolean | null;
  points: number;
}

export function outcomeOf(reveal: YaziYazReveal, id: string): MyOutcome {
  const g = reveal.guesses[id];
  const points = reveal.scores[id] ?? 0;
  if (!g || g.target === null) return { personOk: null, wordOk: null, points };
  return { personOk: g.personOk, wordOk: g.word === "" ? null : g.wordOk, points };
}
