import type { BozukPrompt, BozukReveal, BozukStep, KaralamaStroke } from "@glix/engine";
import { parseStroke } from "../karalama-defteri/view.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Bir çizimin darbeleri + değişimi anlamak için ucuz bir anahtar. */
export interface ParsedDrawing {
  strokes: KaralamaStroke[];
  key: string;
}

export function parseDrawing(list: unknown): ParsedDrawing | null {
  if (!Array.isArray(list)) return null;
  const strokes: KaralamaStroke[] = [];
  let total = 0;
  for (const raw of list) {
    const s = parseStroke(raw);
    if (!s) continue;
    strokes.push(s);
    total += s.length;
  }
  const last = strokes.at(-1);
  return { strokes, key: `${strokes.length}:${total}:${last?.[2] ?? 0}:${last?.[3] ?? 0}` };
}

export type ParsedStep =
  | { kind: "write"; author: string; text: string }
  | { kind: "draw"; author: string; drawing: ParsedDrawing };

export type ParsedPrompt = { kind: "write"; text: string } | { kind: "draw"; drawing: ParsedDrawing };

function parseStep(v: unknown): ParsedStep | null {
  if (!isRec(v) || typeof v.author !== "string") return null;
  if (v.kind === "write" && typeof v.text === "string")
    return { kind: "write", author: v.author, text: v.text };
  if (v.kind === "draw") {
    const drawing = parseDrawing(v.strokes);
    return drawing ? { kind: "draw", author: v.author, drawing } : null;
  }
  return null;
}

function parsePrompt(v: unknown): ParsedPrompt | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  if (v.kind === "write" && typeof v.text === "string") return { kind: "write", text: v.text };
  if (v.kind === "draw") {
    const drawing = parseDrawing(v.strokes);
    return drawing ? { kind: "draw", drawing } : undefined;
  }
  return undefined;
}

export interface ParsedReveal extends Omit<BozukReveal, "steps"> {
  steps: ParsedStep[];
}

function parseReveal(v: unknown): ParsedReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const { stage } = v;
  if (stage !== "show" && stage !== "vote" && stage !== "result") return undefined;
  if (!isNum(v.chain) || !isNum(v.chains) || typeof v.starter !== "string") return undefined;
  if (!isNum(v.shown) || !isNum(v.chainStartedAt) || !isNum(v.stageEndsAt)) return undefined;
  if (!isStrArray(v.voted) || !Array.isArray(v.steps)) return undefined;
  const steps: ParsedStep[] = [];
  for (const raw of v.steps) {
    const s = parseStep(raw);
    if (!s) return undefined;
    steps.push(s);
  }
  let tally: number[] | null = null;
  if (v.tally !== null) {
    if (!Array.isArray(v.tally) || !v.tally.every(isNum)) return undefined;
    tally = v.tally;
  }
  if (v.robust !== null && typeof v.robust !== "boolean") return undefined;
  return {
    chain: v.chain,
    chains: v.chains,
    starter: v.starter,
    stage,
    shown: v.shown,
    steps,
    chainStartedAt: v.chainStartedAt,
    stageEndsAt: v.stageEndsAt,
    voted: v.voted,
    tally,
    robust: v.robust,
  };
}

export interface BozukPublicParsed {
  phase: "write" | "draw" | "reveal" | "done";
  startedAt: number;
  step: number;
  steps: number;
  stepStartedAt: number | null;
  stepEndsAt: number | null;
  players: string[];
  doneIds: string[];
  reveal: ParsedReveal | null;
  scores: Record<string, number> | null;
}

const optNum = (v: unknown): number | null | undefined => (v === null ? null : isNum(v) ? v : undefined);

/** Sunucudan gelen `publicView` bilinmez; Bozuk Telefon ortak görünümü olarak doğrulanır. */
export function parseBozukPublicView(v: unknown): BozukPublicParsed | null {
  if (!isRec(v)) return null;
  const { phase } = v;
  if (phase !== "write" && phase !== "draw" && phase !== "reveal" && phase !== "done") return null;
  if (!isNum(v.startedAt) || !isNum(v.step) || !isNum(v.steps)) return null;
  const stepStartedAt = optNum(v.stepStartedAt);
  const stepEndsAt = optNum(v.stepEndsAt);
  if (stepStartedAt === undefined || stepEndsAt === undefined) return null;
  if (!isStrArray(v.players) || !isStrArray(v.doneIds)) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  let scores: Record<string, number> | null = null;
  if (v.scores !== null) {
    if (!isRec(v.scores)) return null;
    scores = {};
    for (const [id, n] of Object.entries(v.scores)) {
      if (!isNum(n)) return null;
      scores[id] = n;
    }
  }
  return {
    phase,
    startedAt: v.startedAt,
    step: v.step,
    steps: v.steps,
    stepStartedAt,
    stepEndsAt,
    players: v.players,
    doneIds: v.doneIds,
    reveal,
    scores,
  };
}

export interface BozukPrivateParsed {
  role: "write" | "draw" | null;
  prompt: ParsedPrompt | null;
  text: string | null;
  /** Kendi darbelerin, sıra numarasına göre. */
  strokes: KaralamaStroke[];
  pointsLeft: number;
  done: boolean;
  myVote: number | null;
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. Darbeler numaraya göre sıralanır. */
export function parseBozukPrivateView(v: unknown): BozukPrivateParsed | null {
  if (!isRec(v)) return null;
  const { role } = v;
  if (role !== null && role !== "write" && role !== "draw") return null;
  const prompt = parsePrompt(v.prompt);
  if (prompt === undefined) return null;
  if (v.text !== null && typeof v.text !== "string") return null;
  if (!isNum(v.pointsLeft) || typeof v.done !== "boolean") return null;
  if (v.myVote !== null && !isNum(v.myVote)) return null;
  if (!isRec(v.strokes)) return null;
  const keyed: { n: number; s: KaralamaStroke }[] = [];
  for (const [k, raw] of Object.entries(v.strokes)) {
    const n = Number(k);
    const s = parseStroke(raw);
    if (!Number.isInteger(n) || !s) continue;
    keyed.push({ n, s });
  }
  keyed.sort((a, b) => a.n - b.n);
  return {
    role,
    prompt,
    text: v.text,
    strokes: keyed.map((x) => x.s),
    pointsLeft: Math.max(0, v.pointsLeft),
    done: v.done,
    myVote: v.myVote,
  };
}

export type BozukScreenView = BozukPublicParsed & BozukPrivateParsed;

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseBozukView(publicView: unknown, view: unknown): BozukScreenView | null {
  const pub = parseBozukPublicView(publicView);
  const priv = parseBozukPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Ekranda kullanılan tipler (motor tipleriyle uyumlu). */
export type { BozukPrompt, BozukStep };
