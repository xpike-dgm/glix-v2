import type {
  KorBombaBet,
  KorBombaHand,
  KorBombaJourney,
  KorBombaPass,
  KorBombaPredictionResult,
  KorBombaPublicView,
  KorBombaView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function parsePass(v: unknown): KorBombaPass | null {
  if (!isRec(v) || !isNum(v.seq) || !isStr(v.from) || !isStr(v.to)) return null;
  return { seq: v.seq, from: v.from, to: v.to };
}

function parseResult(v: unknown): KorBombaPredictionResult | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !isNum(v.turn) || typeof v.correct !== "boolean") return undefined;
  return { turn: v.turn, correct: v.correct };
}

function parseBet(v: unknown): KorBombaBet | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !isNum(v.turn) || !isStr(v.holder)) return undefined;
  return { turn: v.turn, holder: v.holder };
}

function parseJourney(v: unknown): KorBombaJourney | null | undefined {
  if (v === null || v === undefined) return null;
  if (!isRec(v) || !isNum(v.fuseMs) || !isNum(v.totalMs)) return undefined;
  if (!Array.isArray(v.bonusesMs) || !Array.isArray(v.hands)) return undefined;
  const bonusesMs = v.bonusesMs.filter(isNum);
  const hands: KorBombaHand[] = [];
  for (const h of v.hands) {
    if (!isRec(h) || !isStr(h.holder) || !isNum(h.heldMs)) return undefined;
    hands.push({ holder: h.holder, heldMs: h.heldMs });
  }
  if (bonusesMs.length !== v.bonusesMs.length || hands.length === 0) return undefined;
  return { fuseMs: v.fuseMs, totalMs: v.totalMs, bonusesMs, hands };
}

/** Sunucudan gelen `publicView` bilinmez; Kör Bomba ortak görünümü olarak doğrulanır. */
export function parseKorBombaPublicView(v: unknown): KorBombaPublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isStr(v.holder) || !isNum(v.passes)) return null;
  if (typeof v.exploded !== "boolean") return null;
  if (v.explodedAt !== null && !isNum(v.explodedAt)) return null;
  let lastPass: KorBombaPass | null = null;
  if (v.lastPass !== null) {
    lastPass = parsePass(v.lastPass);
    if (!lastPass) return null;
  }
  const journey = parseJourney(v.journey);
  if (journey === undefined) return null;
  const trail = Array.isArray(v.trail) ? v.trail.filter(isStr) : [];
  return {
    startedAt: v.startedAt,
    holder: v.holder,
    passes: v.passes,
    lastPass,
    trail: trail.length > 0 ? trail : [v.holder],
    lockedUntil: isNum(v.lockedUntil) ? v.lockedUntil : v.startedAt,
    exploded: v.exploded,
    explodedAt: v.explodedAt,
    correctPredictors: Array.isArray(v.correctPredictors) ? v.correctPredictors.filter(isStr) : [],
    journey,
  };
}

/** Sunucudan gelen `view` bilinmez; Kör Bomba kişisel görünümü olarak doğrulanır. */
export function parseKorBombaPrivateView(v: unknown): KorBombaView | null {
  if (!isRec(v)) return null;
  const betUsed = v.betUsed === true;
  if (v.role === "holder") {
    const lastResult = parseResult(v.lastResult);
    return lastResult === undefined ? null : { role: "holder", betUsed, lastResult };
  }
  if (v.role === "spectator") return { role: "spectator" };
  if (v.role === "watcher") {
    if (!isNum(v.explodeAt)) return null;
    if (v.lastBonusMs !== null && !isNum(v.lastBonusMs)) return null;
    const bet = parseBet(v.bet);
    const lastResult = parseResult(v.lastResult);
    if (bet === undefined || lastResult === undefined) return null;
    return { role: "watcher", explodeAt: v.explodeAt, lastBonusMs: v.lastBonusMs, bet, betUsed, lastResult };
  }
  return null;
}

export interface KorBombaScreenView {
  pub: KorBombaPublicView;
  priv: KorBombaView;
}

/** İki görünüm de geçerliyse birleşik görünümü verir. */
export function parseKorBombaView(publicView: unknown, view: unknown): KorBombaScreenView | null {
  const pub = parseKorBombaPublicView(publicView);
  const priv = parseKorBombaPrivateView(view);
  return pub && priv ? { pub, priv } : null;
}

/** Kalan süre (ms); yalnız süreyi gören katılımcıda, aksi halde null. Negatif olmaz. */
export function remainingMs(view: KorBombaScreenView, now: number): number | null {
  if (view.priv.role !== "watcher") return null;
  return Math.max(0, view.priv.explodeAt - now);
}

/** Büyük sayaç metni: 12,4 (bir ondalık, Türkçe virgül). */
export function formatRemaining(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}

/** BM-U7: bakarken sayaç; son 1 sn'de iki ondalık ("0,47"). */
export function formatPeek(ms: number): string {
  const clean = Math.max(0, ms);
  if (clean >= 1_000) return formatRemaining(clean);
  const hundredths = Math.floor(clean / 10);
  return `0,${String(hundredths).padStart(2, "0")}`;
}

/** BM-U7 / BM-U16: bakarken aciliyet düzeyi (yalnız bakan oyuncuda kullanılır). */
export function peekLevel(ms: number): "calm" | "red" | "shake" {
  if (ms < 3_000) return "shake";
  if (ms < 5_000) return "red";
  return "calm";
}

/** Eklenen süre kıvılcımı: +2,5 */
export function formatBonus(ms: number): string {
  const tenths = Math.round(Math.max(0, ms) / 100);
  return `+${Math.floor(tenths / 10)},${tenths % 10}`;
}

/** Saniye, bir ondalık: 3,4 */
export function formatSeconds(ms: number): string {
  const tenths = Math.round(Math.max(0, ms) / 100);
  return `${Math.floor(tenths / 10)},${tenths % 10}`;
}

/** Koltukların yüzde konumu (0-100). Kendin altta; diğerleri saat yönünde (izleyicide ilk katılımcı altta). */
export interface SeatPos {
  id: string;
  x: number;
  y: number;
}

/**
 * BM-U8: elips yarıçapları; alttaki kendi koltuğun (y = 50 + ry) kenardan içeride kalır. Kalabalık masada elips biraz
 * küçülür ki koltuklar ekran kenarına dayanmasın.
 */
export function seatRadii(n: number): { rx: number; ry: number } {
  return n >= 7 ? { rx: 40, ry: 33 } : { rx: 41, ry: 34 };
}

/**
 * BM-U8: sen altta ortada; diğerleri masanın üst yayına (165°…375°) eşit aralıkla, saat yönünde dizilir. Alt köşeler
 * (bahis düğmesi, "SÜREYE BAK", "Devam et", taşıyıcı bandı) koltuklardan boş kalır.
 */
export const SEAT_ARC_FROM = 165;
export const SEAT_ARC_TO = 375;

export function seatPositions(ids: readonly string[], selfId: string): SeatPos[] {
  const mine = ids.indexOf(selfId);
  const ordered = mine > 0 ? [...ids.slice(mine), ...ids.slice(0, mine)] : [...ids];
  const n = Math.max(1, ordered.length);
  const { rx, ry } = seatRadii(n);
  const others = n - 1;
  return ordered.map((id, i) => {
    let deg = 90;
    if (i > 0) {
      deg = others === 1 ? 270 : SEAT_ARC_FROM + ((i - 1) / (others - 1)) * (SEAT_ARC_TO - SEAT_ARC_FROM);
    }
    const a = (deg * Math.PI) / 180;
    return { id, x: 50 + rx * Math.cos(a), y: 50 + ry * Math.sin(a) };
  });
}

/**
 * Bomba, taşıyıcının koltuğuyla masa merkezi arasında, taşıyıcının önünde durur. BM-U8: 7+ kişide merkeze %10 daha
 * yakın (koltuğa binmesin).
 */
export function bombSpot(seat: SeatPos | undefined, n: number): { x: number; y: number } {
  if (!seat) return { x: 50, y: 50 };
  const k = n >= 7 ? 0.32 : 0.36;
  return { x: 50 + (seat.x - 50) * k, y: 50 + (seat.y - 50) * k };
}

/** BM-U8: koltuk altındaki ad en çok `max` harf; uzunsa "…" ile kesilir. */
export function shortName(name: string, max = 8): string {
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : name;
}

/**
 * Taşıyıcının bir koltuğa pas verip veremeyeceği (BM-M1 / BM-U2). Kural sunucudadır; bu yalnız koltuğu işaretler.
 * - `ok`: verilebilir, `offline`: kopuk, `return`: az önce atan (3+ bağlıda), `locked`: fitil tutuşuyor.
 */
export type SeatTap = "ok" | "offline" | "return" | "locked";
export function seatTap(
  pub: KorBombaPublicView,
  target: string,
  connected: readonly string[],
  now: number,
): SeatTap {
  if (!connected.includes(target)) return "offline";
  const from = pub.lastPass?.from;
  if (from !== undefined && from === target) {
    const others = connected.some((id) => id !== pub.holder && id !== from);
    if (others) return "return";
  }
  return now < pub.lockedUntil ? "locked" : "ok";
}

const BACK = "aıou";
const FRONT = "eiöü";
const HARD = "fstkçşhp";

function lastVowel(word: string): string {
  const lower = word.toLocaleLowerCase("tr");
  for (let i = lower.length - 1; i >= 0; i--) {
    const c = lower[i] as string;
    if (BACK.includes(c) || FRONT.includes(c)) return c;
  }
  return "e";
}

/** Bulunma eki: Mert'te, Elif'te, Kaan'da, Ayşe'de. */
export function locative(name: string): string {
  const last = name.toLocaleLowerCase("tr").slice(-1);
  const v = lastVowel(name);
  const a = BACK.includes(v) ? "a" : "e";
  return `${name}'${HARD.includes(last) ? "t" : "d"}${a}`;
}

/** İlgi eki: Mert'in, Kaan'ın, Ayşe'nin, Burak'ın, Zeynep'in, Onur'un, Gül'ün. */
export function genitive(name: string): string {
  const last = name.toLocaleLowerCase("tr").slice(-1);
  const v = lastVowel(name);
  const h = v === "a" || v === "ı" ? "ı" : v === "e" || v === "i" ? "i" : v === "o" || v === "u" ? "u" : "ü";
  const vowelEnd = BACK.includes(last) || FRONT.includes(last);
  return `${name}'${vowelEnd ? "n" : ""}${h}n`;
}

/** BM-U3: "4. el · Mert'te" (bomba sendeyse "4. el · Sende"). */
export function handChip(passes: number, holderName: string, mine = false): string {
  return `${passes + 1}. el · ${mine ? "Sende" : locative(holderName)}`;
}

/** BM-U3: son 4 taşıyıcı (zincir). */
export function lastLinks(trail: readonly string[], count = 4): string[] {
  return trail.slice(-count);
}

/** BM-U5: "Elif, Mert ve Kaan bildi!"; 5+ kişide "5 kişi bildi!"; tek başına sen "Sen bildin!". */
export function bildiText(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1 && names[0] === "Sen") return "Sen bildin!";
  if (names.length >= 5) return `${names.length} kişi bildi!`;
  if (names.length === 1) return `${names[0]} bildi!`;
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]} bildi!`;
}

/** BM-U5: patlama damgası. Taşıyıcının kendisi için ayrı metin. */
export function blastText(name: string, mine: boolean): string {
  return mine ? "BOMBA SENDE PATLADI · −1" : `${locative(name).toLocaleUpperCase("tr")} PATLADI! −1`;
}

/** BM-U6: fitil hesabı satırı. */
export function fuseLine(j: KorBombaJourney): string {
  const passes =
    j.bonusesMs.length === 0 ? "pas yok" : `paslar ${j.bonusesMs.map((b) => formatBonus(b)).join(" ")}`;
  return `Fitil ${formatSeconds(j.fuseMs)} sn başladı · ${passes} · toplam ${formatSeconds(j.totalMs)} sn`;
}

/** BM-U6: en uzun tutan (bütün eller) ve en hızlı kurtulan (pasla biten eller). */
export function journeyStats(j: KorBombaJourney): {
  longest: KorBombaHand | null;
  fastest: KorBombaHand | null;
} {
  let longest: KorBombaHand | null = null;
  for (const h of j.hands) if (!longest || h.heldMs > longest.heldMs) longest = h;
  let fastest: KorBombaHand | null = null;
  for (const h of j.hands.slice(0, -1)) if (!fastest || h.heldMs < fastest.heldMs) fastest = h;
  return { longest, fastest };
}

/** BM-U4: "PATLAR!" düğmesi yalnız bombayı taşımayan ve hakkını kullanmamış katılımcıya; süreden bağımsızdır. */
export function canBet(view: KorBombaScreenView, selfId: string, spectator: boolean): boolean {
  return (
    !spectator &&
    !view.pub.exploded &&
    view.pub.holder !== selfId &&
    view.priv.role === "watcher" &&
    !view.priv.betUsed
  );
}

/** Kendi duran bahsim (şu anki ele bağlı); yoksa null. */
export function myBet(view: KorBombaScreenView): KorBombaBet | null {
  const b = view.priv.role === "watcher" ? view.priv.bet : null;
  return b && b.turn === view.pub.passes ? b : null;
}

/** Tek hakkımı kullandım mı. */
export function betUsed(view: KorBombaScreenView): boolean {
  return view.priv.role !== "spectator" && view.priv.betUsed;
}

/** Kendi son çözülen bahis sonucum. */
export function myResult(view: KorBombaScreenView): KorBombaPredictionResult | null {
  return view.priv.role === "spectator" ? null : view.priv.lastResult;
}
