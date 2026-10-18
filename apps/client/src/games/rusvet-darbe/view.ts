import {
  type Allocation,
  type DuelHand,
  RUSVET_MAX_PER_PLAYER,
  type RusvetDuel,
  type RusvetPhase,
  type RusvetPublicView,
  type RusvetReveal,
  type RusvetView,
  resolveHand,
  SIGNS,
  type Sign,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const PHASES: readonly RusvetPhase[] = ["vote", "duel", "give", "reveal"];
const asSign = (v: unknown): Sign | null => SIGNS.find((s) => s === v) ?? null;

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type RusvetScreenView = RusvetPublicView & RusvetView;

function parseSigns(v: unknown): Record<string, Sign> | null {
  if (!isRec(v)) return null;
  const out: Record<string, Sign> = {};
  for (const [id, s] of Object.entries(v)) {
    const sign = asSign(s);
    if (sign === null) return null;
    out[id] = sign;
  }
  return out;
}

const strArr = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every(isStr) ? [...(v as string[])] : null;

function parseHand(v: unknown): DuelHand | null {
  if (!isRec(v)) return null;
  const candidates = strArr(v.candidates);
  const advance = strArr(v.advance);
  const signs = parseSigns(v.signs);
  if (!candidates || !advance || !signs || typeof v.replay !== "boolean") return null;
  return { candidates, advance, signs, replay: v.replay };
}

function parseHands(v: unknown): DuelHand[] | null {
  if (!Array.isArray(v)) return null;
  const out: DuelHand[] = [];
  for (const item of v) {
    const h = parseHand(item);
    if (!h) return null;
    out.push(h);
  }
  return out;
}

function parseDuel(v: unknown): RusvetDuel | null {
  if (!isRec(v)) return null;
  const candidates = strArr(v.candidates);
  const history = parseHands(v.history);
  if (!candidates || !history) return null;
  if (!isNum(v.hand) || !isNum(v.signStartedAt) || !isNum(v.signEndsAt) || !isNum(v.revealEndsAt))
    return null;
  let signs: Record<string, Sign> | null = null;
  if (v.signs !== null && v.signs !== undefined) {
    signs = parseSigns(v.signs);
    if (!signs) return null;
  }
  return {
    hand: v.hand,
    candidates,
    signStartedAt: v.signStartedAt,
    signEndsAt: v.signEndsAt,
    revealEndsAt: v.revealEndsAt,
    signs,
    history,
  };
}

function parseReveal(v: unknown): RusvetReveal | null {
  if (!isRec(v) || !isRec(v.votes)) return null;
  const votes: Record<string, string> = {};
  for (const [from, to] of Object.entries(v.votes)) {
    if (!isStr(to)) return null;
    votes[from] = to;
  }
  const counts = parseNumberRecord(v.counts);
  const tokens = parseNumberRecord(v.tokens);
  const scores = parseNumberRecord(v.scores);
  const duelHands = parseHands(v.duelHands);
  if (!counts || !tokens || !scores || !duelHands) return null;
  return { votes, counts, tokens, scores, duelHands };
}

/** Sunucudan gelen `publicView` bilinmez; Rüşvet ve Darbe ortak görünümü olarak doğrulanır. */
export function parseRusvetPublicView(v: unknown): RusvetPublicView | null {
  if (!isRec(v)) return null;
  const players = strArr(v.players);
  if (!players) return null;
  if (!isStr(v.phase) || !PHASES.includes(v.phase as RusvetPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.phaseStartedAt) || !isNum(v.phaseEndsAt)) return null;
  if (v.president !== null && v.president !== undefined && !isStr(v.president)) return null;
  if (v.budget !== null && v.budget !== undefined && !isNum(v.budget)) return null;
  let duel: RusvetDuel | null = null;
  if (v.duel !== null && v.duel !== undefined) {
    duel = parseDuel(v.duel);
    if (!duel) return null;
  }
  let reveal: RusvetReveal | null = null;
  if (v.reveal !== null && v.reveal !== undefined) {
    reveal = parseReveal(v.reveal);
    if (!reveal) return null;
  }
  return {
    players,
    phase: v.phase as RusvetPhase,
    startedAt: v.startedAt,
    phaseStartedAt: v.phaseStartedAt,
    phaseEndsAt: v.phaseEndsAt,
    president: v.president ?? null,
    budget: v.budget ?? null,
    duel,
    reveal,
  };
}

function parseAllocations(v: unknown): Allocation[] | null {
  if (!Array.isArray(v)) return null;
  const out: Allocation[] = [];
  for (const item of v) {
    if (!isRec(item) || !isStr(item.to) || !isNum(item.n)) return null;
    out.push({ to: item.to, n: item.n });
  }
  return out;
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseRusvetPrivateView(v: unknown): RusvetView | null {
  if (!isRec(v)) return null;
  if (v.myVote !== null && !isStr(v.myVote)) return null;
  const mySign = v.mySign === null || v.mySign === undefined ? null : asSign(v.mySign);
  if (v.mySign !== null && v.mySign !== undefined && mySign === null) return null;
  let myTokens: Allocation[] | null = null;
  if (v.myTokens !== null && v.myTokens !== undefined) {
    myTokens = parseAllocations(v.myTokens);
    if (!myTokens) return null;
  }
  return { myVote: v.myVote, mySign, myTokens };
}

export function parseRusvetView(publicView: unknown, view: unknown): RusvetScreenView | null {
  const pub = parseRusvetPublicView(publicView);
  const priv = parseRusvetPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Dağıtım listesinden kişi → jeton sözlüğü. */
export function tokenMap(list: readonly Allocation[] | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { to, n } of list ?? []) out[to] = n;
  return out;
}

export function tokenTotal(tokens: Record<string, number>): number {
  return Object.values(tokens).reduce((a, b) => a + b, 0);
}

/**
 * Bir kişiye dokununca sıradaki jeton sayısı: yer varsa +1, sınıra ya da bütçeye gelince 0'a döner.
 * `canAdd` false ise (ör. bağlantısı kopuk) artış yapılmaz.
 */
export function nextTokenCount(current: number, remaining: number, canAdd = true): number {
  if (canAdd && current < RUSVET_MAX_PER_PLAYER && remaining > 0) return current + 1;
  return 0;
}

export function tokensToAllocations(tokens: Record<string, number>, order: readonly string[]): Allocation[] {
  return order.flatMap((to) => ((tokens[to] ?? 0) > 0 ? [{ to, n: tokens[to] as number }] : []));
}

/** Açılmış elin sonucu (devam edenler / tekrar); istemci kuralı yeniden icat etmez, motorun işlevini kullanır. */
export function handOutcome(candidates: readonly string[], signs: Record<string, Sign>): DuelHand | null {
  if (!candidates.every((id) => signs[id] !== undefined)) return null;
  return resolveHand(candidates, signs);
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

export const SIGN_LABEL: Record<Sign, string> = { tas: "Taş", kagit: "Kağıt", makas: "Makas" };
