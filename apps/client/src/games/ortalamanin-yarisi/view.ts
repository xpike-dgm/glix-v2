import {
  ORTALAMA_MAX,
  ORTALAMA_MIN,
  type OrtalamaPublicView,
  type OrtalamaReveal,
  type OrtalamaRoundSummary,
  type OrtalamaView,
  ortalamaScore,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

function parseIdList(v: unknown, among: Record<string, number>): string[] | null {
  if (!Array.isArray(v) || v.length > 64) return null;
  const out: string[] = [];
  for (const id of v) {
    if (typeof id !== "string" || !(id in among) || out.includes(id)) return null;
    out.push(id);
  }
  return out;
}

function parseReveal(v: unknown): OrtalamaReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const choices = parseNumberRecord(v.choices);
  const distances = parseNumberRecord(v.distances);
  const ranks = parseNumberRecord(v.ranks);
  const points = parseNumberRecord(v.points);
  if (!choices || !distances || !ranks || !points) return undefined;
  if (!isNum(v.mean) || !isNum(v.target)) return undefined;
  if (!Array.isArray(v.order) || !v.order.every((x) => typeof x === "string")) return undefined;
  const order = v.order as string[];
  const ids = Object.keys(choices);
  if (order.length !== ids.length || !order.every((id) => id in choices)) return undefined;
  if (!Object.values(choices).every((x) => isInt(x, ORTALAMA_MIN, ORTALAMA_MAX))) return undefined;
  for (const id of ids) if (!(id in distances) || !(id in ranks) || !(id in points)) return undefined;
  const random = parseIdList(v.random, choices);
  const burned = parseIdList(v.burned, choices);
  if (!random || !burned) return undefined;
  return { choices, random, burned, mean: v.mean, target: v.target, distances, order, ranks, points };
}

function parseMultiplier(v: unknown): { num: number; den: number } | null {
  if (!isRec(v) || !isInt(v.num, 1, 9) || !isInt(v.den, 1, 9) || v.num >= v.den) return null;
  return { num: v.num, den: v.den };
}

function parseSummary(v: unknown): OrtalamaRoundSummary | null {
  if (!isRec(v) || !isNum(v.mean) || !isNum(v.target)) return null;
  const multiplier = parseMultiplier(v.multiplier);
  const choices = parseNumberRecord(v.choices);
  const points = parseNumberRecord(v.points);
  if (!multiplier || !choices || !points) return null;
  if (!Object.values(choices).every((x) => isInt(x, ORTALAMA_MIN, ORTALAMA_MAX))) return null;
  const random = parseIdList(v.random, choices);
  const burned = parseIdList(v.burned, choices);
  if (!random || !burned) return null;
  return { mean: v.mean, target: v.target, multiplier, choices, points, random, burned };
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type OrtalamaScreenView = OrtalamaPublicView & OrtalamaView;

/** Sunucudan gelen `publicView` bilinmez; Ortalamaya En Yakın ortak görünümü olarak doğrulanır. */
export function parseOrtalamaPublicView(v: unknown): OrtalamaPublicView | null {
  if (!isRec(v)) return null;
  if (
    !isNum(v.startedAt) ||
    !isNum(v.introAt) ||
    !isNum(v.roundStartedAt) ||
    !isNum(v.endsAt) ||
    !isNum(v.revealEndsAt)
  )
    return null;
  if (!isInt(v.rounds, 1, 9) || !isInt(v.round, 1, v.rounds)) return null;
  const multiplier = parseMultiplier(v.multiplier);
  if (!multiplier) return null;
  if (!Array.isArray(v.previous) || v.previous.length > 8) return null;
  const previous: OrtalamaRoundSummary[] = [];
  for (const p of v.previous) {
    const s = parseSummary(p);
    if (!s) return null;
    previous.push(s);
  }
  const totals = parseNumberRecord(v.totals);
  if (!totals) return null;
  let final: Record<string, number> | null = null;
  if (v.final !== null) {
    final = parseNumberRecord(v.final);
    if (!final) return null;
  }
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  if (!Array.isArray(v.lockedIds) || v.lockedIds.length > 64) return null;
  const lockedIds: string[] = [];
  for (const id of v.lockedIds) {
    if (typeof id !== "string" || id.length > 64) return null;
    lockedIds.push(id);
  }
  return {
    startedAt: v.startedAt,
    introAt: v.introAt,
    roundStartedAt: v.roundStartedAt,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    round: v.round,
    rounds: v.rounds,
    multiplier,
    previous,
    totals,
    reveal,
    final,
    lockedIds,
  };
}

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseOrtalamaPrivateView(v: unknown): OrtalamaView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, ORTALAMA_MIN, ORTALAMA_MAX)) return null;
  if (typeof v.locked !== "boolean") return null;
  return { myChoice: v.myChoice, locked: v.locked };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseOrtalamaView(publicView: unknown, view: unknown): OrtalamaScreenView | null {
  const pub = parseOrtalamaPublicView(publicView);
  const priv = parseOrtalamaPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

export type Phase = "choosing" | "revealed";

export function phaseOf(view: OrtalamaScreenView | null): Phase {
  return view?.reveal ? "revealed" : "choosing";
}

/** Turun o anki evresi: tur kartı (OY-U3), seçim, açılış. */
export type RoundPhase = "card" | "choose" | "reveal";

export function roundPhase(view: OrtalamaPublicView, now: number): RoundPhase {
  if (view.reveal) return "reveal";
  return now < view.roundStartedAt ? "card" : "choose";
}

/** Seçimin son saniyeleri (OY-U4): kalan tam saniye 3, 2, 1; diğer anlarda null. */
export function lastSeconds(view: OrtalamaPublicView, now: number): number | null {
  if (roundPhase(view, now) !== "choose") return null;
  const left = Math.ceil((view.endsAt - now) / 1000);
  return left >= 1 && left <= 3 ? left : null;
}

/** Türkçe ondalık yazım: tam sayıysa "20", değilse tek basamak "19,2". */
export function formatNumber(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

/** Sayı doğrusundaki konum (yüzde, 0..100). */
export function linePercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Aynı sayı doğrusunda üst üste binen noktalar için şerit (satır) numarası: soldan sağa, ilk boş şeride.
 * `minGap`: aynı şeritteki iki nokta arası en az yüzde farkı.
 */
export function assignLanes(values: readonly number[], minGap: number): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lastInLane: number[] = [];
  const lanes: number[] = new Array(values.length).fill(0);
  for (const [v, i] of order) {
    let lane = lastInLane.findIndex((last) => v - last >= minGap);
    if (lane === -1) {
      lane = lastInLane.length;
      lastInLane.push(v);
    } else {
      lastInLane[lane] = v;
    }
    lanes[i] = lane;
  }
  return lanes;
}

/** Yakınlaşma eşiği (OY-U11): istif bundan yüksekse sonuç yolu hedef çevresine yakınlaşır. */
export const ZOOM_STACK = 4;
/** Yakınlaşmada büyütülen bölüm: hedefin ±20'si; yolun %70'ini kaplar. */
export const ZOOM_SPAN = 20;
const ZOOM_SHARE = 0.7;

/**
 * Yol üzerindeki konum (0..1). `zoom` açıkken hedefin ±20'lik bölümü yolun %70'ini kaplar, uçlar kalan alana
 * orantılı sıkışır (OY-U11). Monoton: sıralama bozulmaz; 0 → 0, 100 → 1.
 */
export function roadX(value: number, target: number, zoom: boolean): number {
  const v = linePercent(value);
  if (!zoom) return v / 100;
  const a = Math.max(0, target - ZOOM_SPAN);
  const b = Math.min(100, target + ZOOM_SPAN);
  const left = a;
  const right = 100 - b;
  const rest = left + right;
  const share = rest === 0 ? 1 : ZOOM_SHARE;
  const leftW = rest === 0 ? 0 : ((1 - share) * left) / rest;
  if (v <= a) return left === 0 ? 0 : (v / left) * leftW;
  if (v <= b) return leftW + ((v - a) / Math.max(1e-9, b - a)) * share;
  return leftW + share + ((v - b) / Math.max(1e-9, right)) * (1 - share - leftW);
}

/** Bir oyuncunun bu turdan aldığı puan. */
export function pointsOf(reveal: OrtalamaReveal, playerId: string): number {
  return reveal.points[playerId] ?? 0;
}

/** Satır rozeti (OY-U9, OY-U6): yalnız ödül alanlarda derece; yanan ve rastgele sayılar kendi etiketiyle. */
export type Badge = "best" | "second" | "tie" | "burned" | "random" | null;

export function badgeOf(reveal: OrtalamaReveal, playerId: string): Badge {
  if (reveal.random.includes(playerId)) return "random";
  if (reveal.burned.includes(playerId)) return "burned";
  const pts = pointsOf(reveal, playerId);
  if (pts >= 2) return "best";
  if (pts === 1) return (reveal.ranks[playerId] ?? 0) === 1 ? "tie" : "second";
  return null;
}

export const BADGE_TEXT: Record<Exclude<Badge, null>, string> = {
  best: "EN YAKIN",
  second: "2. YAKIN",
  tie: "EŞİT",
  burned: "YANDI",
  random: "rastgele · puan yok",
};

export type Tier = "gold" | "blue" | "none";

/** Işık rengi: tek en yakın ve eşit en yakınlar altın; ikinci derecenin +1'i mavi. */
export function tierOf(reveal: OrtalamaReveal, playerId: string): Tier {
  const b = badgeOf(reveal, playerId);
  return b === "best" || b === "tie" ? "gold" : b === "second" ? "blue" : "none";
}

const MULTIPLIER_GLYPH: Record<string, string> = { "1/2": "½", "2/3": "⅔", "3/4": "¾" };

/** Çarpanın yazılışı: ½, ⅔, ¾ (bilinmeyen kesir "a/b"). */
export function multiplierLabel(m: { num: number; den: number }): string {
  return MULTIPLIER_GLYPH[`${m.num}/${m.den}`] ?? `${m.num}/${m.den}`;
}

/** Kesrin okunuşu: "yarısı", "üçte iki", "dörtte üç". */
export function multiplierWord(m: { num: number; den: number }): string {
  if (m.num === 1 && m.den === 2) return "yarısı";
  if (m.num === 2 && m.den === 3) return "üçte iki";
  if (m.num === 3 && m.den === 4) return "dörtte üç";
  return `${m.num}/${m.den}`;
}

/** Hedefin adı: "ortalamanın yarısı", "ortalamanın üçte ikisi", "ortalamanın dörtte üçü". */
export function targetName(m: { num: number; den: number }): string {
  if (m.num === 1 && m.den === 2) return "ortalamanın yarısı";
  if (m.num === 2 && m.den === 3) return "ortalamanın üçte ikisi";
  if (m.num === 3 && m.den === 4) return "ortalamanın dörtte üçü";
  return `ortalamanın ${m.num}/${m.den}'ü`;
}

/** Tur kartındaki sabit örnek (OY-U3): "ortalama 30 olursa hedef 15 / 20 / 22,5". */
export function exampleLine(m: { num: number; den: number }): string {
  return `ortalama 30 olursa hedef ${formatNumber((30 * m.num) / m.den)}`;
}

/** Kapsül altındaki kısa ad (OY-U2): en çok 6 harf. */
export function shortName(nickname: string): string {
  const chars = Array.from(nickname.trim());
  return chars.length <= 6 ? chars.join("") : `${chars.slice(0, 5).join("")}…`;
}

/** Bir oyuncunun geçen turdaki sayısı (OY-U1/U2): açılmış son turdan. */
export function lastChoice(
  previous: readonly OrtalamaRoundSummary[],
  playerId: string,
): { value: number; distance: number; random: boolean } | null {
  const p = previous[previous.length - 1];
  const value = p?.choices[playerId];
  if (!p || value === undefined) return null;
  return { value, distance: Math.abs(value - p.target), random: p.random.includes(playerId) };
}

/** "Ne olurdu?" (OY-U7): kişiye özel tek satırın içeriği. */
export type WhatIf =
  | { kind: "random"; value: number }
  | { kind: "close"; rival: string; gap: number }
  | { kind: "alone" }
  | { kind: "range"; lo: number; hi: number; points: number }
  | { kind: "untouchable"; winner: string | null };

/** Kesintisiz aralıklar: sıralı tam sayılar → [lo, hi] parçaları. */
function runs(values: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && v === last[1] + 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

/** Kendi sayına en yakın kesintisiz aralık. */
function nearestRun(values: readonly number[], mine: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const r of runs(values)) {
    const d = mine < r[0] ? r[0] - mine : mine > r[1] ? mine - r[1] : 0;
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

/**
 * OY-U7: senin sayın 0–100 arasında X olsaydı (ortalama ve hedef yeniden hesaplanarak, yanma kuralı dahil) ne
 * alırdın? Açılmış verilerle istemcide hesaplanır; motorun puanlamasını (`ortalamaScore`) kullanır.
 */
export function whatIf(
  reveal: OrtalamaReveal,
  me: string,
  multiplier: { num: number; den: number },
): WhatIf | null {
  const mine = reveal.choices[me];
  if (mine === undefined) return null;
  if (reveal.random.includes(me)) return { kind: "random", value: mine };
  const ids = Object.keys(reveal.choices);
  const eligible = (id: string) => !reveal.random.includes(id) && !reveal.burned.includes(id);
  if (pointsOf(reveal, me) >= 2) {
    const myD = reveal.distances[me] ?? 0;
    const rivals = ids.filter((id) => id !== me && eligible(id));
    if (rivals.length === 0) return { kind: "alone" };
    const rival = rivals.reduce((a, b) =>
      (reveal.distances[b] ?? Number.POSITIVE_INFINITY) < (reveal.distances[a] ?? Number.POSITIVE_INFINITY)
        ? b
        : a,
    );
    return { kind: "close", rival, gap: (reveal.distances[rival] ?? 0) - myD };
  }
  const two: number[] = [];
  const one: number[] = [];
  for (let x = ORTALAMA_MIN; x <= ORTALAMA_MAX; x++) {
    const p = ortalamaScore(ids, { ...reveal.choices, [me]: x }, reveal.random, multiplier).points[me] ?? 0;
    if (p >= 2) two.push(x);
    else if (p === 1) one.push(x);
  }
  const r2 = nearestRun(two, mine);
  if (r2) return { kind: "range", lo: r2[0], hi: r2[1], points: 2 };
  const r1 = pointsOf(reveal, me) < 1 ? nearestRun(one, mine) : null;
  if (r1) return { kind: "range", lo: r1[0], hi: r1[1], points: 1 };
  const winner = reveal.order.find((id) => pointsOf(reveal, id) >= 2) ?? null;
  return { kind: "untouchable", winner };
}

export function whatIfText(w: WhatIf, nameOf: (id: string) => string): string {
  switch (w.kind) {
    case "random":
      return `Seçmedin, sana 🎲 ${w.value} düştü.`;
    case "close":
      return w.gap <= 0
        ? `Kıl payı: ${nameOf(w.rival)} seninle aynı uzaklıktaydı.`
        : `Kıl payı: ${nameOf(w.rival)} senden ${formatNumber(w.gap)} uzaktaydı.`;
    case "alone":
      return "Rakibin yoktu: diğer sayılar yandı ya da rastgeleydi.";
    case "range":
      return w.lo === w.hi
        ? `${w.lo} yazsaydın +${w.points} alırdın.`
        : `${w.lo} ile ${w.hi} arası yazsaydın +${w.points} alırdın.`;
    case "untouchable":
      return w.winner
        ? `Bu turu kimse alamazdı: ${nameOf(w.winner)} hedefe çok yakındı.`
        : "Bu turda kimse +2 alamazdı.";
  }
}

/**
 * İzleyici ve TV için (OY-U7): hedefe en az puan alan en yakın kadar yakın tam sayılar. Uygun (yanmamış, rastgele
 * olmayan) kimse yoksa null.
 */
export function winningRange(reveal: OrtalamaReveal): { lo: number; hi: number } | null {
  const eligible = Object.keys(reveal.choices).filter(
    (id) => !reveal.random.includes(id) && !reveal.burned.includes(id),
  );
  if (eligible.length === 0) return null;
  const best = Math.min(...eligible.map((id) => reveal.distances[id] ?? Number.POSITIVE_INFINITY));
  const lo = Math.max(ORTALAMA_MIN, Math.ceil(reveal.target - best - 1e-9));
  const hi = Math.min(ORTALAMA_MAX, Math.floor(reveal.target + best + 1e-9));
  return lo <= hi ? { lo, hi } : null;
}

export function winningRangeText(reveal: OrtalamaReveal): string {
  const r = winningRange(reveal);
  if (!r) return "Bu tur kimse puan alamadı.";
  return r.lo === r.hi ? `Kazandıran sayı: ${r.lo}` : `Kazandıran aralık: ${r.lo}–${r.hi}`;
}

/**
 * Açılış zaman çizelgesi (OY-U5; ms, seçim süresinin bitişinden): sayılar düşer (oyuncu başı en çok 0,15 sn, toplam
 * en çok 1,2 sn) → terazi ve ortalama → ışın kayar ve hedef → ipler uzaktan yakına söner → liste ve puan (en geç 4 sn) →
 * son turda üç turun tablosu (+1,5 sn). Hareket azaltmada ortalama, hedef, liste 0,4 sn arayla.
 */
export interface RevealTimeline {
  popStep: number;
  mean: number;
  target: number;
  ropes: number;
  ropeStep: number;
  list: number;
  table: number;
}

export function revealTimeline(players: number, reduced: boolean): RevealTimeline {
  const n = Math.max(1, players);
  if (reduced) return { popStep: 0, mean: 0, target: 400, ropes: 400, ropeStep: 0, list: 800, table: 2_300 };
  return {
    popStep: Math.min(150, Math.floor(1_200 / n)),
    mean: 1_200,
    target: 2_200,
    ropes: 3_000,
    ropeStep: Math.floor(1_000 / n),
    list: 4_000,
    table: 5_500,
  };
}

/** 0 sayılar · 1 terazi/ortalama · 2 ışın/hedef · 3 ipler · 4 liste ve puan · 5 üç turun tablosu (yalnız son tur). */
export type RevealStage = 0 | 1 | 2 | 3 | 4 | 5;

export function revealStage(elapsed: number, t: RevealTimeline, last: boolean): RevealStage {
  if (last && elapsed >= t.table) return 5;
  if (elapsed >= t.list) return 4;
  if (elapsed >= t.ropes && t.ropeStep > 0) return 3;
  if (elapsed >= t.target) return 2;
  if (elapsed >= t.mean) return 1;
  return 0;
}

/** Açılışta düşmüş nokta sayısı (adım 1). */
export function poppedCount(elapsed: number, t: RevealTimeline, players: number): number {
  if (t.popStep <= 0) return players;
  return Math.max(0, Math.min(players, Math.floor(elapsed / t.popStep) + 1));
}

/** Sönmüş ip sayısı (adım 4, en uzaktan en yakına). */
export function ropesOut(elapsed: number, t: RevealTimeline, players: number): number {
  if (t.ropeStep <= 0 || elapsed < t.ropes) return elapsed >= t.list ? players : 0;
  return Math.max(0, Math.min(players, Math.floor((elapsed - t.ropes) / t.ropeStep) + 1));
}

/** Üç turun tablosundaki bir satır (OY-U8 / OY-U13). */
export interface TableRow {
  id: string;
  /** Tur başına: puan (0/1/2), yandı mı, rastgele mi; o tur henüz oynanmadıysa null. */
  rounds: ({ points: number; burned: boolean; random: boolean } | null)[];
  total: number;
  /** Genel skora eklenen (yalnız sonda). */
  award: number | null;
}

export function roundTable(
  ids: readonly string[],
  played: readonly { points: Record<string, number>; burned: string[]; random: string[] }[],
  rounds: number,
  final: Record<string, number> | null,
): TableRow[] {
  const rows = ids.map((id) => {
    const cells = Array.from({ length: rounds }, (_, r) => {
      const p = played[r];
      return p
        ? { points: p.points[id] ?? 0, burned: p.burned.includes(id), random: p.random.includes(id) }
        : null;
    });
    const total = cells.reduce((a, c) => a + (c?.points ?? 0), 0);
    return { id, rounds: cells, total, award: final ? (final[id] ?? 0) : null };
  });
  // Toplamı en yüksekten aşağı; eşitlikte katılım sırası.
  return rows
    .map((r, i) => [r, i] as const)
    .sort((a, b) => b[0].total - a[0].total || a[1] - b[1])
    .map(([r]) => r);
}

/** Lider eşitliği (herkes +1): başlıkta "Berabere! Liderler +1". */
export function leadersTied(final: Record<string, number> | null): boolean {
  if (!final) return false;
  const v = Object.values(final);
  return v.length > 0 && !v.includes(2) && v.includes(1);
}

/**
 * Sürüklemede geçilen 5'in katı (OY-U15): `prev`'den `next`'e giderken geçilen (ya da varılan) en son 5'in katı;
 * yoksa null. İlk dokunuşta (`prev` null) varılan sayı 5'in katıysa o.
 */
export function crossedFive(prev: number | null, next: number): number | null {
  if (prev === next) return null;
  if (prev === null) return next % 5 === 0 ? next : null;
  const up = next > prev;
  const lo = up ? prev + 1 : next;
  const hi = up ? next : prev - 1;
  const first = Math.ceil(lo / 5) * 5;
  if (first > hi) return null;
  return up ? Math.floor(hi / 5) * 5 : first;
}

/** 0, 50 ve 100 "güçlü" işaretlerdir (biraz daha belirgin titreşim). */
export const strongMark = (v: number): boolean => v === 0 || v === 50 || v === 100;
