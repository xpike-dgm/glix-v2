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
export type KendimScreenView = Omit<KendimPublicView, "cards"> & KendimView & { allCards: KendimCard[] };

function parseCard(v: unknown): KendimCard | null {
  if (!isRec(v) || !isNum(v.id) || !isStr(v.text)) return null;
  return { id: v.id, text: v.text };
}

function parseRevealCard(v: unknown): KendimRevealCard | null {
  const card = parseCard(v);
  if (!card || !isRec(v) || !isStr(v.owner) || !isStrArr(v.finders) || typeof v.bonus !== "boolean") {
    return null;
  }
  return { ...card, owner: v.owner, finders: [...v.finders], bonus: v.bonus, twin: v.twin === true };
}

function parseCards(v: unknown): KendimCard[] | null {
  if (!Array.isArray(v)) return null;
  const out: KendimCard[] = [];
  for (const c of v) {
    const parsed = parseCard(c);
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

function parseReveal(v: unknown): KendimReveal | null {
  if (!isRec(v) || !Array.isArray(v.cards) || !isRec(v.pairs) || !Array.isArray(v.order)) return null;
  if (!v.order.every(isNum)) return null;
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
  const awards = parseNumberRecord(v.awards);
  if (!scores || !awards) return null;
  return { cards, order: [...(v.order as number[])], pairs, scores, awards };
}

export function parseKendimPublicView(v: unknown): KendimPublicView | null {
  if (!isRec(v) || !isStrArr(v.players)) return null;
  if (!isStr(v.stage) || !STAGES.includes(v.stage as KendimStage)) return null;
  if (!isNum(v.startedAt) || !isNum(v.writeEndsAt) || !isNum(v.matchEndsAt) || !isNum(v.finishAt))
    return null;
  if (!isStrArr(v.ready) || !isStrArr(v.owners)) return null;
  if (!isStr(v.topic) || !isStr(v.hint)) return null;
  const cards = parseCards(v.cards ?? []);
  if (!cards) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    stage: v.stage as KendimStage,
    topic: v.topic,
    hint: v.hint,
    startedAt: v.startedAt,
    writeEndsAt: v.writeEndsAt,
    matchEndsAt: v.matchEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    owners: [...v.owners],
    cards,
    reveal,
  };
}

export function parseKendimPrivateView(v: unknown): KendimView | null {
  if (!isRec(v)) return null;
  if (v.myText !== null && !isStr(v.myText)) return null;
  if (typeof v.locked !== "boolean" || !isRec(v.myPairs)) return null;
  const cards = parseCards(v.cards);
  if (!cards) return null;
  const myPairs: Record<string, string> = {};
  for (const [card, who] of Object.entries(v.myPairs)) {
    if (!isStr(who)) return null;
    myPairs[card] = who;
  }
  return { myText: v.myText, locked: v.locked, cards, myPairs };
}

/**
 * Birleşik görünüm. Kişiye özel görünüm yoksa (izleyici, TV) boş sayılır. `cards` kişinin önündeki kartlardır;
 * herkese açık bütün kartlar `allCards`'tadır (KN-U7).
 */
export function parseKendimView(publicView: unknown, view: unknown): KendimScreenView | null {
  const pub = parseKendimPublicView(publicView);
  const priv = view === null || view === undefined ? EMPTY_PRIVATE : parseKendimPrivateView(view);
  return pub && priv ? { ...pub, allCards: pub.cards, ...priv } : null;
}

const EMPTY_PRIVATE: KendimView = { myText: null, locked: false, cards: [], myPairs: {} };

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
  /** Tanıma puanı. */
  total: number;
  /** Genel skora giden ödül (+2 / +1 / 0). */
  award: number;
}

export function outcomeOf(reveal: KendimReveal, id: string): MyOutcome {
  const list = reveal.pairs[id] ?? [];
  const right = list.filter((p) => p.ok).length;
  return {
    right,
    wrong: list.length - right,
    bonus: reveal.cards.some((c) => c.owner === id && c.bonus),
    total: reveal.scores[id] ?? 0,
    award: reveal.awards[id] ?? 0,
  };
}

/** Bir kart için tahmin grupları: tahmin edilen kişi -> onu seçenler (katılım sırasıyla), kalabalıktan aza. */
export interface GuessGroup {
  target: string;
  by: string[];
  ok: boolean;
}

export function guessesFor(reveal: KendimReveal, card: number, players: readonly string[]): GuessGroup[] {
  const groups = new Map<string, GuessGroup>();
  for (const id of players) {
    const p = reveal.pairs[id]?.find((x) => x.card === card);
    if (!p) continue;
    const g = groups.get(p.target) ?? { target: p.target, by: [], ok: p.ok };
    g.by.push(id);
    groups.set(p.target, g);
  }
  return [...groups.values()].sort((a, b) => b.by.length - a.by.length);
}

/** Bir oyuncunun bir karttaki seçimi (yoksa null). */
export function choiceOf(reveal: KendimReveal, id: string, card: number) {
  return reveal.pairs[id]?.find((p) => p.card === card) ?? null;
}

/**
 * Açılışta o ana kadar açılmış kartlardan toplanan tanıma puanı (TV'de canlı artar): kart döndüğünde doğru bilenler
 * +1, tek bulan şeridinde kartın sahibi +1. Bütün kartlar açılınca `reveal.scores`'a eşittir.
 */
export function runningScores(
  reveal: KendimReveal,
  flipped: readonly number[],
  bonused: readonly number[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of reveal.cards) {
    if (flipped.includes(c.id)) for (const f of c.finders) out[f] = (out[f] ?? 0) + 1;
    if (c.bonus && bonused.includes(c.id)) out[c.owner] = (out[c.owner] ?? 0) + 1;
  }
  return out;
}

/** Ödül rozeti: "+2 genel" gibi. */
export function awardLabel(n: number): string {
  return n > 0 ? `+${n} genel` : "0 genel";
}

/** KN-M3: yazıdaki boşluklar atılır (yapıştırılan "ÇOK NEŞELİ" → "ÇOKNEŞELİ"); boşluk vardı mı da döner. */
export function joinWord(raw: string): { text: string; hadSpace: boolean } {
  const hadSpace = /\s/u.test(raw);
  return { text: hadSpace ? raw.replace(/\s+/gu, "") : raw, hadSpace };
}

/** Kart yazısının uzunluğu (en az 4): yazı boyu kartın genişliğine ve bu uzunluğa göre ayarlanır. */
export function wordLen(text: string): number {
  return Math.max(4, Array.from(text).length);
}
