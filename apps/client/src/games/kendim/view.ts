import type {
  KendimCard,
  KendimPublicView,
  KendimReveal,
  KendimRevealCard,
  KendimRevealPair,
  KendimStage,
  KendimView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const STAGES: readonly KendimStage[] = ["write", "match", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KendimScreenView = KendimPublicView & KendimView;

function parseCard(v: unknown): KendimCard | null {
  if (!isRec(v) || !isNum(v.id) || !isStr(v.text)) return null;
  return { id: v.id, text: v.text };
}

function parseRevealCard(v: unknown): KendimRevealCard | null {
  const card = parseCard(v);
  if (!card || !isRec(v) || !isStr(v.owner) || !isStrArr(v.finders) || typeof v.bonus !== "boolean") {
    return null;
  }
  return { ...card, owner: v.owner, finders: [...v.finders], bonus: v.bonus };
}

function parseReveal(v: unknown): KendimReveal | null {
  if (!isRec(v) || !Array.isArray(v.cards) || !isRec(v.pairs) || !isStrArr(v.winners)) return null;
  const cards: KendimRevealCard[] = [];
  for (const c of v.cards) {
    const parsed = parseRevealCard(c);
    if (!parsed) return null;
    cards.push(parsed);
  }
  const pairs: Record<string, KendimRevealPair[]> = {};
  for (const [id, list] of Object.entries(v.pairs)) {
    if (!Array.isArray(list)) return null;
    const out: KendimRevealPair[] = [];
    for (const p of list) {
      if (!isRec(p) || !isNum(p.card) || !isStr(p.target) || typeof p.ok !== "boolean") return null;
      out.push({ card: p.card, target: p.target, ok: p.ok });
    }
    pairs[id] = out;
  }
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  return { cards, pairs, scores, winners: [...v.winners] };
}

export function parseKendimPublicView(v: unknown): KendimPublicView | null {
  if (!isRec(v) || !isStrArr(v.players)) return null;
  if (!isStr(v.stage) || !STAGES.includes(v.stage as KendimStage)) return null;
  if (!isNum(v.startedAt) || !isNum(v.writeEndsAt) || !isNum(v.matchEndsAt) || !isNum(v.finishAt))
    return null;
  if (!isStrArr(v.ready) || !isStrArr(v.owners)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    stage: v.stage as KendimStage,
    startedAt: v.startedAt,
    writeEndsAt: v.writeEndsAt,
    matchEndsAt: v.matchEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    owners: [...v.owners],
    reveal,
  };
}

export function parseKendimPrivateView(v: unknown): KendimView | null {
  if (!isRec(v)) return null;
  if (v.myText !== null && !isStr(v.myText)) return null;
  if (typeof v.locked !== "boolean" || !Array.isArray(v.cards) || !isRec(v.myPairs)) return null;
  const cards: KendimCard[] = [];
  for (const c of v.cards) {
    const parsed = parseCard(c);
    if (!parsed) return null;
    cards.push(parsed);
  }
  const myPairs: Record<string, string> = {};
  for (const [card, who] of Object.entries(v.myPairs)) {
    if (!isStr(who)) return null;
    myPairs[card] = who;
  }
  return { myText: v.myText, locked: v.locked, cards, myPairs };
}

export function parseKendimView(publicView: unknown, view: unknown): KendimScreenView | null {
  const pub = parseKendimPublicView(publicView);
  const priv = parseKendimPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Bir kartın eşi (yoksa null). */
export function pairOf(view: Pick<KendimView, "myPairs">, card: number): string | null {
  const who = view.myPairs[String(card)];
  return who === undefined ? null : who;
}

/** Bir oyuncunun şu an eşlendiği kart (yoksa null). */
export function cardOfPlayer(
  view: Pick<KendimView, "myPairs" | "cards">,
  playerId: string,
): KendimCard | null {
  for (const card of view.cards) if (view.myPairs[String(card.id)] === playerId) return card;
  return null;
}

export interface MyOutcome {
  right: number;
  wrong: number;
  /** Kelimen yalnız bir kişi tarafından bulundu mu. */
  bonus: boolean;
  total: number;
}

export function outcomeOf(reveal: KendimReveal, id: string): MyOutcome {
  const list = reveal.pairs[id] ?? [];
  const right = list.filter((p) => p.ok).length;
  return {
    right,
    wrong: list.length - right,
    bonus: reveal.cards.some((c) => c.owner === id && c.bonus),
    total: reveal.scores[id] ?? 0,
  };
}

/** Skor metni: artıda "+2", eksideki "−1" (gerçek eksi işareti), sıfır "0". */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

/** Kart yazısının uzunluğu (en az 4): yazı boyu kartın genişliğine ve bu uzunluğa göre ayarlanır. */
export function wordLen(text: string): number {
  return Math.max(4, Array.from(text).length);
}
