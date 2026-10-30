import type { CaprazAtesPublicView, CaprazAtesRoundReveal, CaprazAtesView } from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type CaprazAtesScreenView = CaprazAtesPublicView & CaprazAtesView;

function parseIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 64) return null;
  const out: string[] = [];
  for (const id of v) {
    if (!isId(id)) return null;
    out.push(id);
  }
  return out;
}

function parseRound(v: unknown): CaprazAtesRoundReveal | null {
  if (!isRec(v) || !isRec(v.targets) || !Array.isArray(v.mutual)) return null;
  const scores = parseNumberRecord(v.scores);
  const cover = parseIds(v.cover);
  if (!scores || !cover) return null;
  const targets: Record<string, string | null> = {};
  for (const [id, t] of Object.entries(v.targets)) {
    if (t !== null && !isId(t)) return null;
    targets[id] = t;
  }
  const mutual: [string, string][] = [];
  for (const pair of v.mutual) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const [a, b] = pair;
    if (!isId(a) || !isId(b)) return null;
    mutual.push([a, b]);
  }
  return { targets, cover, scores, mutual };
}

/** Sunucudan gelen `publicView` bilinmez; Çapraz Ateş ortak görünümü olarak doğrulanır. */
export function parseCaprazAtesPublicView(v: unknown): CaprazAtesPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.roundStartedAt) || !isNum(v.endsAt) || !isNum(v.finishAt)) return null;
  if (v.round !== 1 && v.round !== 2) return null;
  const lockedIds = parseIds(v.lockedIds);
  if (!lockedIds || !Array.isArray(v.rounds) || v.rounds.length > 2) return null;
  const rounds: CaprazAtesRoundReveal[] = [];
  for (const r of v.rounds) {
    const parsed = parseRound(r);
    if (!parsed) return null;
    rounds.push(parsed);
  }
  let totals: Record<string, number> | null = null;
  if (v.totals !== null && v.totals !== undefined) {
    totals = parseNumberRecord(v.totals);
    if (!totals) return null;
  }
  return {
    startedAt: v.startedAt,
    round: v.round,
    roundStartedAt: v.roundStartedAt,
    endsAt: v.endsAt,
    finishAt: v.finishAt,
    rounds,
    totals,
    lockedIds,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseCaprazAtesPrivateView(v: unknown): CaprazAtesView | null {
  if (!isRec(v)) return null;
  if (v.myTarget !== null && !isId(v.myTarget)) return null;
  if (typeof v.locked !== "boolean" || typeof v.cover !== "boolean") return null;
  return { myTarget: v.myTarget, cover: v.cover, locked: v.locked };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseCaprazAtesView(publicView: unknown, view: unknown): CaprazAtesScreenView | null {
  const pub = parseCaprazAtesPublicView(publicView);
  const priv = parseCaprazAtesPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/**
 * Ekranın aşaması: `pick` seçim (tur 1 ya da 2), `interval` tur 1'in kısa açılışı, `closed` süre doldu ama
 * sonuç henüz gelmedi, `final` tur 2'nin açılışı.
 */
export type Stage = "pick" | "interval" | "closed" | "final";

export function stageOf(v: CaprazAtesPublicView, now: number): Stage {
  if (v.rounds.length >= 2) return "final";
  if (v.rounds.length === 1 && now < v.roundStartedAt) return "interval";
  if (now >= v.endsAt) return "closed";
  return "pick";
}

export interface Tracer {
  from: string;
  to: string;
  /** Karşılıklı: mermiler ortada çarpışır. */
  mutual: boolean;
  /** Hedef siperde: mermi kalkandan seker. */
  cover: boolean;
}

/** Açılan hedeflerden iz listesi (hedefi olan herkes için bir iz; geçersiz kimlikler atılır). */
export function tracersOf(reveal: CaprazAtesRoundReveal, order: readonly string[]): Tracer[] {
  const known = new Set(order);
  const mutualIds = new Set(reveal.mutual.flat());
  const out: Tracer[] = [];
  for (const from of order) {
    const to = reveal.targets[from];
    if (to === null || to === undefined || !known.has(to) || to === from) continue;
    const isMutual = mutualIds.has(from) && reveal.targets[to] === from;
    out.push({ from, to, mutual: isMutual, cover: reveal.cover.includes(to) });
  }
  return out;
}

export type Outcome = "hit" | "free" | "clash" | "cover" | "idle";

/** Bir oyuncunun tur sonucu: vuruldu (−1), sağ kaldı (+1), çarpıştı, siperde ya da boşta (0). */
export function outcomeOf(reveal: CaprazAtesRoundReveal, id: string): Outcome {
  if (reveal.cover.includes(id)) return "cover";
  if (reveal.mutual.some((pair) => pair.includes(id))) return "clash";
  const score = reveal.scores[id] ?? 0;
  if (score < 0) return "hit";
  if (score > 0) return "free";
  return "idle";
}

/** Bu oyuncuya ateş edenler (katılım sırasıyla). */
export function shootersOf(reveal: CaprazAtesRoundReveal, id: string, order: readonly string[]): string[] {
  return order.filter((from) => from !== id && reveal.targets[from] === id);
}

/** En çok hedeflenen(ler) ve kaç kişinin hedeflediği; kimse hedeflenmediyse null. */
export function mostTargeted(
  reveal: CaprazAtesRoundReveal,
  order: readonly string[],
): { ids: string[]; count: number } | null {
  let count = 0;
  let ids: string[] = [];
  for (const id of order) {
    const n = shootersOf(reveal, id, order).length;
    if (n > count) {
      count = n;
      ids = [id];
    } else if (n === count && n > 0) ids.push(id);
  }
  return count > 0 ? { ids, count } : null;
}

/** Tur 2 rozetleri: tur 1'de bu oyuncu seni vurdu mu, sen onu vurdun mu, siperde miydi. */
export interface Badges {
  shotYou: boolean;
  youShot: boolean;
  cover: boolean;
}

export function badgesOf(first: CaprazAtesRoundReveal | undefined, selfId: string, id: string): Badges {
  if (!first) return { shotYou: false, youShot: false, cover: false };
  return {
    shotYou: first.targets[id] === selfId,
    youShot: first.targets[selfId] === id,
    cover: first.cover.includes(id),
  };
}

/** Daire üzerinde yerleşim (yüzde): ilk oyuncu üstte, saat yönünde. */
export function ringPosition(index: number, count: number, radius = 38): { x: number; y: number } {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 - Math.PI / 2;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

/** Izgara sütun sayısı. Alçak (yatay telefon) ekranda 7 kişi 4 sütuna, dik ekranda 3 sütuna yerleşir. */
export function gridColumns(count: number, short = false): number {
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return short ? 4 : 3;
}

/** Puan yazısı: +1, −1 (gerçek eksi işareti), 0. */
export const scoreText = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/** "Elif", "Elif ve Kaan", "Elif, Kaan ve Mert". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`;
}

/** Dağıtma sayısı: 1'er, 2'şer, 6'şar, 9'ar … (Türkçe ses uyumu). */
export function eachCount(n: number): string {
  const last = Math.abs(n) % 10;
  const tens = Math.abs(n) % 100;
  if (last === 0) {
    if (tens === 10 || tens === 30) return `${n}'ar`;
    if (tens === 20 || tens === 50) return `${n}'şer`;
    return `${n}'ar`;
  }
  if (last === 2 || last === 7) return `${n}'şer`;
  if (last === 6) return `${n}'şar`;
  if (last === 9) return `${n}'ar`;
  return `${n}'er`;
}
