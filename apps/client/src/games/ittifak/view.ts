import {
  ITTIFAK_BAND_MS,
  type IttifakLabel,
  type IttifakPhase,
  type IttifakPromise,
  type IttifakPublicView,
  type IttifakReveal,
  type IttifakView,
  ittifakAlliances,
  ittifakAwards,
  ittifakLabel,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrs = (v: unknown): v is string[] => Array.isArray(v) && v.every((p) => typeof p === "string");
const PHASES: readonly IttifakPhase[] = ["talk", "vote", "reveal"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type IttifakScreenView = IttifakPublicView & IttifakView;

function parsePromises(v: unknown): Record<string, IttifakPromise[]> | null {
  if (v === undefined || v === null) return {};
  if (!isRec(v)) return null;
  const out: Record<string, IttifakPromise[]> = {};
  for (const [from, list] of Object.entries(v)) {
    if (!Array.isArray(list)) return null;
    const items: IttifakPromise[] = [];
    for (const item of list) {
      if (!isRec(item) || typeof item.to !== "string" || typeof item.kept !== "boolean") return null;
      items.push({ to: item.to, kept: item.kept });
    }
    out[from] = items;
  }
  return out;
}

function parseReveal(v: unknown): IttifakReveal | null {
  if (!isRec(v) || !isRec(v.votes)) return null;
  const scores = parseNumberRecord(v.scores);
  if (!scores) return null;
  const votes: Record<string, string> = {};
  for (const [from, to] of Object.entries(v.votes)) {
    if (typeof to !== "string") return null;
    votes[from] = to;
  }
  const promises = parsePromises(v.promises);
  if (!promises) return null;
  const awards = v.awards === undefined ? ittifakAwards(scores) : parseNumberRecord(v.awards);
  if (!awards) return null;
  if (v.random !== undefined && !isStrs(v.random)) return null;
  const random = isStrs(v.random) ? [...v.random] : [];
  return { votes, scores, awards, random, promises };
}

/** Sunucudan gelen `publicView` bilinmez; İttifak ortak görünümü olarak doğrulanır. */
export function parseIttifakPublicView(v: unknown): IttifakPublicView | null {
  if (!isRec(v)) return null;
  if (!isStrs(v.players)) return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as IttifakPhase)) return null;
  if (!isNum(v.startedAt) || !isNum(v.talkEndsAt) || !isNum(v.voteEndsAt) || !isNum(v.finishAt)) return null;
  if (!isStrs(v.ready)) return null;
  const reveal = v.reveal === null || v.reveal === undefined ? null : parseReveal(v.reveal);
  if (v.reveal !== null && v.reveal !== undefined && reveal === null) return null;
  return {
    players: [...v.players],
    phase: v.phase as IttifakPhase,
    startedAt: v.startedAt,
    talkEndsAt: v.talkEndsAt,
    voteEndsAt: v.voteEndsAt,
    finishAt: v.finishAt,
    ready: [...v.ready],
    reveal,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseIttifakPrivateView(v: unknown): IttifakView | null {
  if (!isRec(v)) return null;
  if (v.myVote !== null && typeof v.myVote !== "string") return null;
  if (typeof v.locked !== "boolean") return null;
  const mine = v.myPromises === undefined ? [] : v.myPromises;
  if (!isStrs(mine)) return null;
  return { myVote: v.myVote, myPromises: [...mine], locked: v.locked };
}

export function parseIttifakView(publicView: unknown, view: unknown): IttifakScreenView | null {
  const pub = parseIttifakPublicView(publicView);
  const priv = parseIttifakPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Oylamanın gerçekten başladığı an: pazarlık bitişi + 1 sn'lik geçiş bandı (IT-U8). */
export const voteOpensAt = (v: Pick<IttifakPublicView, "talkEndsAt">): number =>
  v.talkEndsAt + ITTIFAK_BAND_MS;

export interface Flow {
  from: string;
  to: string;
}

/** Açılan oylardan akış listesi (geçersiz ve kendine giden oylar atılır), katılım sırasıyla. */
export function flowsOf(reveal: IttifakReveal, order: readonly string[]): Flow[] {
  const known = new Set(order);
  const out: Flow[] = [];
  for (const from of order) {
    const to = reveal.votes[from];
    if (to === undefined || to === from || !known.has(to)) continue;
    out.push({ from, to });
  }
  return out;
}

/**
 * Oy okuma sırası (IT-U5): önce en az oy alanlara gidenler, en son lider(ler)e gidenler. Aynı oy sayısındaki hedeflerin
 * kartları sırayla karışır (A'nın 1., B'nin 1., A'nın 2. oyu…): lider eşitliği son karta kadar belli olmaz.
 */
export function readingOrder(reveal: IttifakReveal, order: readonly string[]): Flow[] {
  const flows = flowsOf(reveal, order);
  const seen: Record<string, number> = {};
  const keyed = flows.map((f, i) => {
    const k = seen[f.to] ?? 0;
    seen[f.to] = k + 1;
    return { f, score: reveal.scores[f.to] ?? 0, k, target: order.indexOf(f.to), i };
  });
  keyed.sort((a, b) => a.score - b.score || a.k - b.k || a.target - b.target || a.i - b.i);
  return keyed.map((x) => x.f);
}

/** Bir oy kartının söz denetimi (IT-U5). `others`: ihanete uğrayanlar (söz verilip oy verilmeyenler). */
export interface CardVerdict {
  kind: "kept" | "betray" | "dice" | "plain";
  others: string[];
}

export function cardVerdict(reveal: IttifakReveal, from: string): CardVerdict {
  const to = reveal.votes[from];
  const promised = (reveal.promises[from] ?? []).map((p) => p.to);
  if (reveal.random.includes(from)) return { kind: "dice", others: [] };
  const others = promised.filter((id) => id !== to);
  if (to !== undefined && promised.includes(to)) return { kind: "kept", others };
  return { kind: promised.length > 0 ? "betray" : "plain", others };
}

/** Açılış zaman planı (ms, açılış başından): kart başına 0,9 sn; "…" 0,4 sn bekler; sonra son tablo. */
export const CARD_LEAD_MS = 300;
export const CARD_MS = 900;
export const CARD_NAME_MS = 400;
export const finalAt = (cards: number): number => CARD_LEAD_MS + cards * CARD_MS;

/** Şu an okunan kart (−1: henüz başlamadı; `cards`: hepsi bitti) ve kart içinde hedefin adı açıldı mı. */
export function cardAt(elapsed: number, cards: number): { index: number; named: boolean } {
  if (elapsed < CARD_LEAD_MS) return { index: -1, named: false };
  const index = Math.min(cards, Math.floor((elapsed - CARD_LEAD_MS) / CARD_MS));
  const within = elapsed - CARD_LEAD_MS - index * CARD_MS;
  return { index, named: index < cards && within >= CARD_NAME_MS };
}

/** Oyuncu başına sonuç etiketi (IT-U6). */
export function labelsOf(reveal: IttifakReveal, order: readonly string[]): Record<string, IttifakLabel> {
  const out: Record<string, IttifakLabel> = {};
  for (const id of order) {
    const label = ittifakLabel(reveal.promises[id], reveal.random.includes(id));
    if (label) out[id] = label;
  }
  return out;
}

export const LABEL_TEXT: Record<IttifakLabel, string> = {
  eri: "Sözünün eri",
  cifte: "Çifte oyun",
  hain: "Hain",
  zar: "Oy vermedi",
};

/** Kalabalık masada ad şeridine işlenen etiket simgesi (renk körlüğü için renge ek). */
export const LABEL_ICON: Record<IttifakLabel, string> = { eri: "✓", cifte: "½", hain: "✗", zar: "🎲" };
export const LABEL_ORDER: readonly IttifakLabel[] = ["eri", "cifte", "hain", "zar"];

/** Karşılıklı oy veren ikililer (zarla atanan oy hariç). */
export const alliancesOf = (reveal: IttifakReveal, order: readonly string[]): [string, string][] =>
  ittifakAlliances(order, reveal.votes, reveal.random);

/** Başlık özeti: "2 ittifak · 1 hain · 3 çifte oyun" (sıfır olanlar yazılmaz). */
export function summaryLine(alliances: number, labels: Record<string, IttifakLabel>): string {
  const count = (l: IttifakLabel) => Object.values(labels).filter((x) => x === l).length;
  const parts = [
    alliances > 0 ? `${alliances} ittifak` : "",
    count("hain") > 0 ? `${count("hain")} hain` : "",
    count("cifte") > 0 ? `${count("cifte")} çifte oyun` : "",
  ].filter((x) => x !== "");
  return parts.join(" · ");
}

/** Kendi hikâyen (IT-U7). */
export interface Story {
  voters: string[];
  promisers: { from: string; kept: boolean }[];
  myVote: string | null;
  /** Söz verdiysen: oy verdiğin kişiye söz vermiş miydin. */
  myPromise: "kept" | "broken" | null;
  random: boolean;
  votes: number;
  award: number;
}

export function storyOf(reveal: IttifakReveal, order: readonly string[], selfId: string): Story {
  const myVote = reveal.votes[selfId] ?? null;
  const mine = reveal.promises[selfId] ?? [];
  return {
    voters: order.filter((id) => id !== selfId && reveal.votes[id] === selfId),
    promisers: order.flatMap((from) =>
      from === selfId
        ? []
        : (reveal.promises[from] ?? []).filter((p) => p.to === selfId).map((p) => ({ from, kept: p.kept })),
    ),
    myVote,
    myPromise: mine.length === 0 ? null : mine.some((p) => p.kept) ? "kept" : "broken",
    random: reveal.random.includes(selfId),
    votes: reveal.scores[selfId] ?? 0,
    award: reveal.awards[selfId] ?? 0,
  };
}

/** Genel skora giden ödülün açıklaması (IT-M1). */
export function awardText(reveal: IttifakReveal, id: string): string {
  const award = reveal.awards[id] ?? 0;
  const all = Object.values(reveal.awards);
  if (award === 1 && all.length > 0 && all.every((a) => a === 1)) return "+1 · herkes eşit";
  if (award === 2) return "+2 · en çok oy";
  if (award === 1) return "+1 · ikinci";
  return "+0";
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

/** İki portre arasındaki ok: uçlar portre kenarında; karşılıklı oylar birbirine binmesin diye yana kayar. */
export function arrowPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  gap: number,
  side: number,
): { x1: number; y1: number; x2: number; y2: number; head: string } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ox = -uy * side;
  const oy = ux * side;
  const x1 = a.x + ux * gap + ox;
  const y1 = a.y + uy * gap + oy;
  const x2 = b.x - ux * gap + ox;
  const y2 = b.y - uy * gap + oy;
  const s = 2.6;
  const r = (n: number) => Math.round(n * 100) / 100;
  const head = [
    `${r(x2)},${r(y2)}`,
    `${r(x2 - ux * s - uy * s * 0.6)},${r(y2 - uy * s + ux * s * 0.6)}`,
    `${r(x2 - ux * s + uy * s * 0.6)},${r(y2 - uy * s - ux * s * 0.6)}`,
  ].join(" ");
  return { x1: r(x1), y1: r(y1), x2: r(x2), y2: r(y2), head };
}

/** Açılan sözler: söz veren, alıcı ve tutuldu mu; katılım sırasıyla (kendi sözlerin önde). */
export interface PromiseRow {
  from: string;
  to: string;
  kept: boolean;
  /** Söz verenin oyu zarla atandı (IT-M3: "oy vermedi" notu). */
  random: boolean;
}

export function promiseRows(reveal: IttifakReveal, order: readonly string[], selfId: string): PromiseRow[] {
  const known = new Set(order);
  const rows: PromiseRow[] = [];
  const ordered = [...order].sort((a, b) => Number(b === selfId) - Number(a === selfId));
  for (const from of ordered) {
    for (const p of reveal.promises[from] ?? []) {
      if (known.has(p.to) && p.to !== from)
        rows.push({ from, to: p.to, kept: p.kept, random: reveal.random.includes(from) });
    }
  }
  return rows;
}

/** Söz işaretini koy/kaldır: yeni liste (en çok `max` kişi; doluyken yeni eklenmez -> null). */
export function togglePromise(current: readonly string[], target: string, max: number): string[] | null {
  if (current.includes(target)) return current.filter((id) => id !== target);
  return current.length >= max ? null : [...current, target];
}

/** Pazarlıkta söz mühürleri konduktan bu kadar sonra soluklaşır (IT-U10 ekran koruması). */
export const SEAL_FADE_MS = 3_000;
/** Pazarlığın son saniyeleri (IT-U8). */
export const TALK_URGENT_MS = 10_000;
/** Oylamanın son saniyeleri (IT-U4, IT-U8). */
export const VOTE_URGENT_MS = 5_000;

/** Türkçe tamlayan eki (ses uyumu): "Mert'in", "Kaan'ın", "Defne'nin", "Burak'ın", "Ufuk'un", "Gül'ün". */
export function genitive(name: string): string {
  const lower = name.toLocaleLowerCase("tr");
  const vowels = [...lower].filter((ch) => "aıeioöuü".includes(ch));
  const last = vowels[vowels.length - 1] ?? "e";
  const harmony = "aı".includes(last) ? "ı" : "ei".includes(last) ? "i" : "ou".includes(last) ? "u" : "ü";
  const endsVowel = "aıeioöuü".includes(lower.slice(-1));
  return `${name}'${endsVowel ? "n" : ""}${harmony}n`;
}
