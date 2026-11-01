import type {
  AcgozlulukBand,
  AcgozlulukPublicView,
  AcgozlulukReveal,
  AcgozlulukRoundRecord,
  AcgozlulukScoutPeek,
  AcgozlulukScoutWord,
  AcgozlulukView,
} from "@glix/engine";
import { parseNumberRecord } from "../../net/parse.js";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min: number, max: number): v is number =>
  isNum(v) && Number.isInteger(v) && v >= min && v <= max;

function parseIds(v: unknown, max = 64): string[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: string[] = [];
  for (const id of v) {
    if (typeof id !== "string" || id.length > 64) return null;
    out.push(id);
  }
  return out;
}

function parseReveal(v: unknown): AcgozlulukReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v)) return undefined;
  const choices = parseNumberRecord(v.choices);
  const points = parseNumberRecord(v.points);
  const missing = parseIds(v.missing);
  const order = parseIds(v.order);
  const spillers = parseIds(v.spillers);
  if (!choices || !points || !missing || !order || !spillers) return undefined;
  if (!isInt(v.total, 0, 10_000) || !isInt(v.limit, 1, 10_000) || typeof v.over !== "boolean")
    return undefined;
  return { choices, missing, total: v.total, limit: v.limit, over: v.over, points, order, spillers };
}

function parseBand(v: unknown): AcgozlulukBand | null {
  if (!isRec(v) || !isInt(v.low, 1, 10_000) || !isInt(v.high, 1, 10_000) || v.low > v.high) return null;
  return { low: v.low, high: v.high };
}

function parseHistory(v: unknown): AcgozlulukRoundRecord[] | null {
  if (!Array.isArray(v) || v.length > 10) return null;
  const out: AcgozlulukRoundRecord[] = [];
  for (const h of v) {
    if (!isRec(h)) return null;
    if (h.scoutId !== null && (typeof h.scoutId !== "string" || h.scoutId.length > 64)) return null;
    const reveal = parseReveal(h.reveal);
    if (!reveal) return null;
    out.push({ scoutId: h.scoutId, reveal });
  }
  return out;
}

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type AcgozlulukScreenView = AcgozlulukPublicView & AcgozlulukView;

/** Sunucudan gelen `publicView` bilinmez; Açgözlülük Limiti ortak görünümü olarak doğrulanır. */
export function parseAcgozlulukPublicView(v: unknown): AcgozlulukPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isNum(v.roundStartedAt) || !isNum(v.endsAt) || !isNum(v.revealEndsAt))
    return null;
  if (!isInt(v.round, 1, 10) || !isInt(v.rounds, 1, 10) || !isInt(v.maxChoice, 1, 64)) return null;
  const band = parseBand(v.band);
  const reveal = parseReveal(v.reveal);
  const history = parseHistory(v.history);
  const totals = parseNumberRecord(v.totals);
  const lockedIds = parseIds(v.lockedIds);
  if (!band || reveal === undefined || !history || !totals || !lockedIds) return null;
  if (v.scoutId !== null && (typeof v.scoutId !== "string" || v.scoutId.length > 64)) return null;
  if (v.scoutPeekedAt !== null && !isNum(v.scoutPeekedAt)) return null;
  let final: Record<string, number> | null = null;
  if (v.final !== null) {
    final = parseNumberRecord(v.final);
    if (!final) return null;
  }
  return {
    startedAt: v.startedAt,
    roundStartedAt: v.roundStartedAt,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    round: v.round,
    rounds: v.rounds,
    band,
    maxChoice: v.maxChoice,
    scoutId: v.scoutId,
    scoutPeekedAt: v.scoutPeekedAt,
    history,
    totals,
    reveal,
    final,
    lockedIds,
  };
}

const WORDS: readonly AcgozlulukScoutWord[] = ["rahat", "sinirda", "tasiyor"];

/** Sunucudan gelen `view` bilinmez; kişisel görünüm olarak doğrulanır. */
export function parseAcgozlulukPrivateView(v: unknown): AcgozlulukView | null {
  if (!isRec(v)) return null;
  if (v.myChoice !== null && !isInt(v.myChoice, 0, 64)) return null;
  if (typeof v.locked !== "boolean") return null;
  let scout: AcgozlulukScoutPeek | null = null;
  if (v.scout !== null && v.scout !== undefined) {
    const s = v.scout;
    if (!isRec(s) || !isNum(s.at) || !WORDS.includes(s.word as AcgozlulukScoutWord)) return null;
    scout = { word: s.word as AcgozlulukScoutWord, at: s.at };
  }
  return { myChoice: v.myChoice, locked: v.locked, scout };
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseAcgozlulukView(publicView: unknown, view: unknown): AcgozlulukScreenView | null {
  const pub = parseAcgozlulukPublicView(publicView);
  const priv = parseAcgozlulukPrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

// ——— Hazne ölçeği ———

/** Hazne kapasitesi bandın üst ucunun 1,5 katıdır: en kötü toplam (N×N) her oyuncu sayısında sığar. */
export const TANK_FACTOR = 1.5;

export function tankCapacity(band: AcgozlulukBand): number {
  return Math.max(1, band.high) * TANK_FACTOR;
}

/** `value`nun hazne dibinden yüksekliği (yüzde, 0..100). */
export function tankPercent(value: number, band: AcgozlulukBand): number {
  return Math.max(0, Math.min(100, (value / tankCapacity(band)) * 100));
}

/** Sayı düğmeleri ızgarası: 0..N için sütun sayısı (tek satır ya da dengeli iki satır). */
export function chipColumns(count: number): number {
  if (count <= 5) return Math.max(1, count);
  if (count === 6) return 3;
  if (count <= 8) return 4;
  return 5;
}

// ——— AL-U2: açgözlülük düğmeleri ———

/** Adil pay: ⌊bandın orta değeri ÷ N⌋. */
export function fairShareOf(band: AcgozlulukBand, maxChoice: number): number {
  return Math.floor((band.low + band.high) / 2 / Math.max(1, maxChoice));
}

/** Seçimin karakter etiketi: 0 Pas, adil payın altı Kanaatkâr, adil pay Dengeli, üstü Açgözlü, N Hepsi benim!. */
export function greedLabel(value: number, fair: number, max: number): string {
  if (value <= 0) return "Pas";
  if (value >= max) return "Hepsi benim!";
  if (value < fair) return "Kanaatkâr";
  if (value === fair) return "Dengeli";
  return "Açgözlü";
}

/** Düğme rengi: 0'da sakin yeşil (140°), N'de ateş kırmızısı (0°). */
export function chipHue(value: number, max: number): number {
  return Math.round(140 * (1 - Math.min(1, Math.max(0, value / Math.max(1, max)))));
}

// ——— AL-U1: "herkes senin kadar koyarsa" ———

export type EveryoneFit = "fits" | "maybe" | "over";

/** Herkes `choice` derse toplam ve sisli banda göre: altında sığar, üstünde taşar, içinde belki. */
export function everyoneLine(
  choice: number,
  players: number,
  band: AcgozlulukBand,
): { total: number; fit: EveryoneFit } {
  const total = choice * players;
  return { total, fit: total <= band.low ? "fits" : total > band.high ? "over" : "maybe" };
}

export const FIT_TEXT: Record<EveryoneFit, string> = {
  fits: "sığar",
  maybe: "sisin içinde",
  over: "taşar",
};

// ——— AL-M3 / AL-U5: Gözcü ———

export const SCOUT_TEXT: Record<AcgozlulukScoutWord, string> = {
  rahat: "RAHAT",
  sinirda: "SINIRDA",
  tasiyor: "TAŞIYOR",
};

// ——— AL-U6: sıralı dolum ———

/** Bant çizgiye dönüşür (AL-M4), ardından dolum başlar. */
export const FOG_MS = 600;
export const SEG_MS = 300;
/** Limit çizgisine 3 ya da daha az kala şeritler yavaşlar ve kalp atışı başlar. */
export const SEG_SLOW_MS = 450;
export const SLOW_WITHIN = 3;
export const VERDICT_AFTER_MS = 250;
export const WHATIF_AFTER_MS = 600;
/** Hareket azaltmada metin adımları. */
export const REDUCED_STEP_MS = 500;

export interface FillSegment {
  id: string;
  value: number;
  /** Açılış başından düşüş anı (ms). */
  at: number;
  dur: number;
  /** Şerit oturduktan sonraki toplam. */
  cum: number;
  /** Limite 3 ya da daha az kalmışken düştü (yavaş, kalp atışı). */
  slow: boolean;
  /** Bu şerit limitin üstünde (çatlar). */
  spill: boolean;
}

export interface FillPlan {
  segments: FillSegment[];
  /** Karar yazısı (ve altın ışık / çatlak) anı. */
  verdictAt: number;
  /** "Ne olurdu?" satırı anı. */
  whatIfAt: number;
}

export function fillPlan(reveal: AcgozlulukReveal, reduced = false): FillPlan {
  const segments: FillSegment[] = [];
  let at = reduced ? 0 : FOG_MS;
  let cum = 0;
  for (const id of reveal.order) {
    const value = reveal.choices[id] ?? 0;
    const slow = !reduced && reveal.limit - cum <= SLOW_WITHIN;
    const dur = reduced ? 0 : slow ? SEG_SLOW_MS : SEG_MS;
    cum += value;
    segments.push({ id, value, at, dur, cum, slow, spill: cum > reveal.limit });
    at += dur;
  }
  const verdictAt = reduced ? REDUCED_STEP_MS : at + VERDICT_AFTER_MS;
  return { segments, verdictAt, whatIfAt: reduced ? 2 * REDUCED_STEP_MS : verdictAt + WHATIF_AFTER_MS };
}

/** `elapsed` anında sayaçta görünen toplam; ilk şerit düşmeden null ("?"). */
export function runningTotal(plan: FillPlan, elapsed: number): number | null {
  let shown: number | null = null;
  for (const s of plan.segments) if (elapsed >= s.at) shown = s.cum;
  if (shown === null && elapsed >= plan.verdictAt) return 0;
  return shown;
}

// ——— AL-U8: dört karar ———

export type Verdict = "full" | "close" | "roomy" | "gold" | "one" | "boom" | "over";

export function verdictOf(reveal: Pick<AcgozlulukReveal, "total" | "limit">): Verdict {
  const { total, limit } = reveal;
  if (total === limit) return "full";
  if (total < limit) {
    if (limit - total <= 2) return "close";
    if (total * 10 < limit * 7) return "roomy";
    return "gold";
  }
  if (total - limit === 1) return "one";
  if ((total - limit) * 4 > limit) return "boom";
  return "over";
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  full: "AĞZINA KADAR!",
  close: "Kıl payı!",
  roomy: "Bol bol yer var",
  gold: "Altın!",
  one: "Bir jetonla taştı!",
  boom: "PATLADI!",
  over: "Taştı!",
};

// ——— AL-U7: "Ne olurdu?" ———

/** Ad, sonuç şeridinde en çok 8 harf. */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : name;
}

/**
 * Sana özel tek satır. `selfId` null ise (izleyici, TV) ortak satır. `totals` bu tur dahil mini puan toplamları
 * ("birinci olurdun" yalnız o değişiklikle tek lider olacaksan).
 */
export function whatIfLine(
  reveal: AcgozlulukReveal,
  selfId: string | null,
  maxChoice: number,
  totals: Record<string, number>,
  nameOf: (id: string) => string,
): string {
  const excess = reveal.total - reveal.limit;
  const space = reveal.limit - reveal.total;
  const isPlayer = selfId !== null && reveal.choices[selfId] !== undefined;
  if (!isPlayer) {
    if (excess > 0) return `${excess} jeton fazla.`;
    return space === 0 ? "Ağzına kadar! Bir jeton daha taşırırdı." : `${space} boşluk kaldı.`;
  }
  if (reveal.missing.includes(selfId)) return "Seçmedin, 0 sayıldın.";
  const mine = reveal.choices[selfId] ?? 0;
  if (excess > 0) {
    const x = mine - excess;
    if (x >= 0) return `Sen ${x} deseydin sığardı.`;
    const who = reveal.spillers.map((id) => `${nameOf(id)} (${reveal.choices[id] ?? 0})`).join(", ");
    return `${excess} jeton fazla. Taşıran: ${who}.`;
  }
  if (space === 0) return "Ağzına kadar! Bir jeton daha taşırırdı.";
  const x = Math.min(maxChoice, mine + space);
  if (x <= mine) return `Kasada ${space} boşluk kaldı.`;
  const mineTotal = (totals[selfId] ?? 0) + (x - mine);
  const others = Object.entries(totals).filter(([id]) => id !== selfId);
  const best = Math.max(0, ...others.map(([, t]) => t));
  const first = mineTotal > best ? " (ve birinci olurdun)" : "";
  return `Kasada ${space} boşluk kaldı: ${x} deseydin de sığardı${first}.`;
}

// ——— AL-U9: sonuç şeridi ———

/** Sayıya göre büyükten küçüğe; eşitlerde katılım sırası. */
export function stripOrder(reveal: AcgozlulukReveal, participants: readonly string[]): string[] {
  return [...participants].sort((a, b) => (reveal.choices[b] ?? 0) - (reveal.choices[a] ?? 0));
}

// ——— AL-U3: kasa defteri ———

export interface LedgerBox {
  round: number;
  total: number | null;
  limit: number | null;
  over: boolean | null;
  current: boolean;
}

export function ledgerBoxes(view: AcgozlulukPublicView): LedgerBox[] {
  const out: LedgerBox[] = [];
  for (let r = 1; r <= view.rounds; r++) {
    const rec =
      r <= view.history.length ? view.history[r - 1]?.reveal : r === view.round ? view.reveal : null;
    out.push({
      round: r,
      total: rec ? rec.total : null,
      limit: rec ? rec.limit : null,
      over: rec ? rec.over : null,
      current: r === view.round,
    });
  }
  return out;
}

/** Tur `round`un (1 tabanlı) açılmış kaydı: geçmişten ya da açılmış güncel turdan. */
export function roundReveal(view: AcgozlulukPublicView, round: number): AcgozlulukReveal | null {
  if (round <= view.history.length) return view.history[round - 1]?.reveal ?? null;
  return round === view.round ? view.reveal : null;
}

// ——— AL-U12: TV ———

/**
 * TV'de dolum daha yavaş (herkes aynı ekrana bakar): plan zamanları açılış süresine sığacak kadar (en çok 1,5 kat)
 * uzar; "Ne olurdu?" satırı açılış bitmeden en az 0,8 sn görünür.
 */
export function tvSlow(planEnd: number, revealMs: number): number {
  if (planEnd <= 0) return 1;
  return Math.min(1.5, Math.max(1, (revealMs - 800) / planEnd));
}

// ——— Zamanlama ———

export type Phase = "choosing" | "revealed";

export function phaseOf(view: AcgozlulukScreenView | null): Phase {
  return view?.reveal ? "revealed" : "choosing";
}

/** Kasa kapısı (AL-U15): son 5 sn'de 0→1 iner; seçim dışında 0. */
export const DOOR_MS = 5_000;
export function doorProgress(view: AcgozlulukPublicView, now: number): number {
  if (view.reveal) return 0;
  const left = view.endsAt - now;
  if (left > DOOR_MS || left <= 0) return left <= 0 ? 1 : 0;
  return 1 - left / DOOR_MS;
}
