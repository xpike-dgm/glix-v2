import type {
  KorKronometreEntry,
  KorKronometreFinal,
  KorKronometreHand,
  KorKronometrePhase,
  KorKronometrePublicView,
  KorKronometreReveal,
  KorKronometreStanding,
  KorKronometreView,
} from "@glix/engine";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Hedef aralığı (tam saniye); sunucu sözleşmesiyle aynı. */
const TARGET_MIN_MS = 7_000;
const TARGET_MAX_MS = 13_000;
/** Çizgi, hedef + 8 sn'lik basış süresini kapsar (nokta konumu için). */
const EXTRA_MS = 8_000;
/** El arası (ms); sunucu sözleşmesiyle aynı (sıradaki el henüz gelmediyse tahmin için). */
const GAP_MS = 3_000;
/** Tam isabet eşiği (ms, dahil). */
export const BULLSEYE_MS = 50;
const MAX_HANDS = 3;
const MAX_PLAYERS = 16;

function parseEntry(v: unknown): KorKronometreEntry | null {
  if (!isRec(v) || !isStr(v.playerId)) return null;
  const { ms, distance, rank, points } = v;
  if (typeof v.pressed !== "boolean" || typeof v.bullseye !== "boolean") return null;
  if (!isInt(points) || points < 0 || points > 3) return null;
  if (!v.pressed) {
    // Basmayan: sıralamaya girmez, süresi/mesafesi/derecesi yoktur, puanı 0'dır.
    if (ms !== null || distance !== null || rank !== null || points !== 0 || v.bullseye) return null;
    return {
      playerId: v.playerId,
      ms: null,
      pressed: false,
      distance: null,
      rank: null,
      bullseye: false,
      points: 0,
    };
  }
  if (!isNum(ms) || ms < 0 || ms > 1_000_000) return null;
  if (!isNum(distance) || distance < 0) return null;
  if (!isInt(rank) || rank < 1) return null;
  return { playerId: v.playerId, ms, pressed: true, distance, rank, bullseye: v.bullseye, points };
}

function parseReveal(v: unknown): KorKronometreReveal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !Array.isArray(v.entries) || v.entries.length > MAX_PLAYERS) return undefined;
  const entries: KorKronometreEntry[] = [];
  for (const raw of v.entries) {
    const e = parseEntry(raw);
    if (!e) return undefined;
    entries.push(e);
  }
  return { entries };
}

function parseHand(v: unknown, index: number): KorKronometreHand | null {
  if (!isRec(v) || v.index !== index) return null;
  if (!isNum(v.targetMs) || !Number.isInteger(v.targetMs / 1000)) return null;
  if (v.targetMs < TARGET_MIN_MS || v.targetMs > TARGET_MAX_MS) return null;
  if (!isNum(v.startAt) || !isNum(v.goAt) || !isNum(v.endsAt)) return null;
  if (v.goAt < v.startAt || v.endsAt < v.goAt) return null;
  const reveal = parseReveal(v.reveal);
  if (reveal === undefined) return null;
  return { index, targetMs: v.targetMs, startAt: v.startAt, goAt: v.goAt, endsAt: v.endsAt, reveal };
}

function parseStanding(v: unknown): KorKronometreStanding | null {
  if (!isRec(v) || !isStr(v.playerId)) return null;
  if (!isInt(v.total) || !isInt(v.pressedHands) || !isInt(v.rank) || !isInt(v.award)) return null;
  if (v.rank < 1 || v.award < 0 || v.award > 2) return null;
  if (v.avgDistance !== null && !isNum(v.avgDistance)) return null;
  if (!Array.isArray(v.handPoints) || v.handPoints.length > MAX_HANDS) return null;
  const handPoints: (number | null)[] = [];
  for (const p of v.handPoints) {
    if (p !== null && !isInt(p)) return null;
    handPoints.push(p);
  }
  return {
    playerId: v.playerId,
    total: v.total,
    handPoints,
    pressedHands: v.pressedHands,
    avgDistance: v.avgDistance,
    rank: v.rank,
    award: v.award,
  };
}

function parseFinal(v: unknown): KorKronometreFinal | null | undefined {
  if (v === null) return null;
  if (!isRec(v) || !Array.isArray(v.standings) || v.standings.length > MAX_PLAYERS) return undefined;
  const standings: KorKronometreStanding[] = [];
  for (const raw of v.standings) {
    const s = parseStanding(raw);
    if (!s) return undefined;
    standings.push(s);
  }
  return { standings };
}

const PHASES: readonly KorKronometrePhase[] = ["ready", "count", "gap", "over"];

/** Ekranın okuduğu birleşik görünüm: ortak (`publicView`) + kişiye özel (`view`). */
export type KorKronometreScreenView = KorKronometrePublicView & KorKronometreView;

export function parseKorKronometrePublicView(v: unknown): KorKronometrePublicView | null {
  if (!isRec(v)) return null;
  if (!isNum(v.startedAt) || !isInt(v.hands) || v.hands < 1 || v.hands > MAX_HANDS) return null;
  if (!isInt(v.hand) || v.hand < 0 || v.hand >= v.hands) return null;
  if (typeof v.phase !== "string" || !PHASES.includes(v.phase as KorKronometrePhase)) return null;
  if (!Array.isArray(v.played) || v.played.length < 1 || v.played.length > v.hands) return null;
  const played: KorKronometreHand[] = [];
  for (const [i, raw] of v.played.entries()) {
    const h = parseHand(raw, i);
    if (!h) return null;
    played.push(h);
  }
  if (!isRec(v.totals)) return null;
  const totals: Record<string, number> = {};
  for (const [id, n] of Object.entries(v.totals)) {
    if (!isInt(n)) return null;
    totals[id] = n;
  }
  if (v.endsAt !== null && !isNum(v.endsAt)) return null;
  if (v.revealEndsAt !== null && !isNum(v.revealEndsAt)) return null;
  const final = parseFinal(v.final);
  if (final === undefined) return null;
  return {
    startedAt: v.startedAt,
    hands: v.hands,
    hand: v.hand,
    phase: v.phase as KorKronometrePhase,
    played,
    totals,
    endsAt: v.endsAt,
    revealEndsAt: v.revealEndsAt,
    final,
  };
}

export function parseKorKronometrePrivateView(v: unknown): KorKronometreView | null {
  if (!isRec(v) || typeof v.pressed !== "boolean") return null;
  return { pressed: v.pressed };
}

export function parseKorKronometreView(publicView: unknown, view: unknown): KorKronometreScreenView | null {
  const pub = parseKorKronometrePublicView(publicView);
  const priv = parseKorKronometrePrivateView(view);
  return pub && priv ? { ...pub, ...priv } : null;
}

/** Yerel saatle çözülen akış (görünüm yalnız durum değişince gelir; "BAŞLA!" anı her telefonda kendi saatiyle çizilir). */
export interface KroClock {
  /** Gösterilen el (0 tabanlı). */
  hand: number;
  phase: KorKronometrePhase;
  current: KorKronometreHand;
  /** El arasında bilinen sıradaki el. */
  next: KorKronometreHand | null;
  phaseStartsAt: number;
  phaseEndsAt: number;
}

export function clockAt(v: Pick<KorKronometrePublicView, "played" | "hands">, now: number): KroClock | null {
  const { played } = v;
  for (let i = 0; i < played.length; i++) {
    const h = played[i] as KorKronometreHand;
    if (now < h.startAt) {
      const prev = played[i - 1];
      if (!prev)
        return { hand: i, phase: "ready", current: h, next: null, phaseStartsAt: now, phaseEndsAt: h.goAt };
      return {
        hand: i - 1,
        phase: "gap",
        current: prev,
        next: h,
        phaseStartsAt: prev.endsAt,
        phaseEndsAt: h.startAt,
      };
    }
    if (now < h.goAt)
      return {
        hand: i,
        phase: "ready",
        current: h,
        next: null,
        phaseStartsAt: h.startAt,
        phaseEndsAt: h.goAt,
      };
    if (now < h.endsAt)
      return {
        hand: i,
        phase: "count",
        current: h,
        next: null,
        phaseStartsAt: h.goAt,
        phaseEndsAt: h.endsAt,
      };
  }
  const last = played[played.length - 1];
  if (!last) return null;
  if (last.index >= v.hands - 1) {
    return {
      hand: last.index,
      phase: "over",
      current: last,
      next: null,
      phaseStartsAt: last.endsAt,
      phaseEndsAt: last.endsAt,
    };
  }
  // Sıradaki el henüz gelmedi: el arası sürüyor.
  return {
    hand: last.index,
    phase: "gap",
    current: last,
    next: null,
    phaseStartsAt: last.endsAt,
    phaseEndsAt: last.endsAt + GAP_MS,
  };
}

/** 9850 → "9,85" (Türkçe ondalık virgül, iki hane; sıralama yuvarlanmamış değerle yapılır). */
export function formatSeconds(ms: number): string {
  return (Math.round(ms / 10) / 100).toFixed(2).replace(".", ",");
}

/** KR-U6: hedefe göre fark: "0,15 erken" / "0,42 geç" / "tam isabet" (≤ 50 ms). */
export function formatOffset(ms: number, targetMs: number): string {
  const d = ms - targetMs;
  if (Math.abs(d) <= BULLSEYE_MS) return "tam isabet";
  return `${formatSeconds(Math.abs(d))} ${d < 0 ? "erken" : "geç"}`;
}

/** KR-U7: büyük el sonucu: "0,32 sn GEÇ" / "0,15 sn ERKEN" / "TAM İSABET". */
export function bigOffset(ms: number, targetMs: number): string {
  const d = ms - targetMs;
  if (Math.abs(d) <= BULLSEYE_MS) return "TAM İSABET";
  return `${formatSeconds(Math.abs(d))} sn ${d < 0 ? "ERKEN" : "GEÇ"}`;
}

/** Herkese gösterilen hedef: "Hedef: 11 saniye". */
export function formatTarget(targetMs: number): string {
  return `Hedef: ${Math.round(targetMs / 1000)} saniye`;
}

export const targetSeconds = (targetMs: number): number => Math.round(targetMs / 1000);

/** Basış anının çizgi üzerindeki konumu (yüzde, 0..100); çizgi 0..hedef+8 sn. */
export function trackPercent(ms: number, targetMs: number): number {
  return Math.max(0, Math.min(100, (ms / (targetMs + EXTRA_MS)) * 100));
}

export function targetPercent(targetMs: number): number {
  return trackPercent(targetMs, targetMs);
}

export function entryOf(reveal: KorKronometreReveal | null, playerId: string): KorKronometreEntry | null {
  return reveal?.entries.find((e) => e.playerId === playerId) ?? null;
}

/** KR-U16: çizgideki işaret: el +2 (1. derece) ★, 2. derece ●, diğerleri ○; basmayan yok. */
export function markOf(e: KorKronometreEntry): "star" | "dot" | "ring" | null {
  if (!e.pressed) return null;
  return e.rank === 1 ? "star" : e.rank === 2 ? "dot" : "ring";
}

/** KR-U16: puan işareti: "+2 ★" / "+1" / "0" / "–" (basmadı). */
export function pointsLabel(points: number, pressed = true): string {
  if (!pressed) return "–";
  if (points <= 0) return "0";
  return points >= 2 ? `+${points} ★` : `+${points}`;
}

/** 1 → "1.", 2 → "2." (derece rozeti). */
export const ordinal = (n: number): string => `${n}.`;

/** KR-U7: elin kazananları (1. derece) ve uzaklığı; kimse basmadıysa null. */
export function handWinners(reveal: KorKronometreReveal): { ids: string[]; distance: number } | null {
  const top = reveal.entries.filter((e) => e.pressed && e.rank === 1);
  const first = top[0];
  if (!first || first.distance === null) return null;
  return { ids: top.map((e) => e.playerId), distance: first.distance };
}

/**
 * KR-U7: kendi eğilimin (yalnız kendi basışlarından; 2. elden itibaren). Bastığın ellerin hepsi geçse "yavaş", hepsi
 * erkense "hızlı"; karışıksa ortalamaya bakılır. En az iki basış gerekir.
 */
export function trendLine(offsets: readonly number[]): string | null {
  const pressed = offsets;
  if (pressed.length < 2) return null;
  const n = pressed.length === 2 ? "iki" : "üç";
  if (pressed.every((d) => d > BULLSEYE_MS)) return `İç saatin biraz yavaş: ${n} elde de geç bastın.`;
  if (pressed.every((d) => d < -BULLSEYE_MS)) return `İç saatin biraz hızlı: ${n} elde de erken bastın.`;
  if (pressed.every((d) => Math.abs(d) <= BULLSEYE_MS)) return "İç saatin kusursuz işliyor.";
  const avg = pressed.reduce((a, b) => a + b, 0) / pressed.length;
  if (Math.abs(avg) <= 150) return "Bir erken bir geç: iç saatin ortayı buluyor.";
  return avg > 0 ? "Çoğunlukla geç kalıyorsun: biraz erken bas." : "Çoğunlukla erkencisin: biraz bekle.";
}

/** Kendi bastığın ellerdeki fark (ms − hedef) listesi; açılmış eller, el sırasıyla. */
export function myOffsets(played: readonly KorKronometreHand[], selfId: string, upTo: number): number[] {
  const out: number[] = [];
  for (const h of played) {
    if (h.index > upTo || !h.reveal) continue;
    const e = entryOf(h.reveal, selfId);
    if (e?.pressed && e.ms !== null) out.push(e.ms - h.targetMs);
  }
  return out;
}

/** KR-U5 ibre koşusu zamanlaması (ms, açılışın başından). */
export const NEEDLE = { lineIn: 600, run: 2_500, settle: 1_000 } as const;
export const NEEDLE_TOTAL_MS = NEEDLE.lineIn + NEEDLE.run + NEEDLE.settle;

/** İbrenin çizgi üzerindeki konumu (0..1). */
export function needleFrac(elapsed: number): number {
  return Math.max(0, Math.min(1, (elapsed - NEEDLE.lineIn) / NEEDLE.run));
}

/** İbre geçti mi: oyuncunun noktası (yüzde) ibrenin gerisinde kaldıysa avatar çizgiye düşmüştür. */
export function dropped(elapsed: number, percent: number): boolean {
  return needleFrac(elapsed) * 100 >= percent;
}

/** Liste (KR-U6) ibre bittikten sonra açılır. */
export function listShown(elapsed: number, reduced: boolean): boolean {
  return reduced || elapsed >= NEEDLE.lineIn + NEEDLE.run;
}

/** Hareket azaltmada satırlar 0,3 sn arayla belirir (KR-U17). */
export const REDUCED_ROW_STEP_MS = 300;

/** KR-U6 başlığının özet satırı: "0,15 sn erken · 1." / "tam isabet · 1." / "Basmadın". */
export function headLine(e: KorKronometreEntry | null, targetMs: number): string {
  if (!e?.pressed || e.ms === null) return "Basmadın";
  const d = e.ms - targetMs;
  const off =
    Math.abs(d) <= BULLSEYE_MS ? "tam isabet" : `${formatSeconds(Math.abs(d))} sn ${d < 0 ? "erken" : "geç"}`;
  return e.rank === null ? off : `${off} · ${ordinal(e.rank)}`;
}

/**
 * KR-U17 ekran okuyucu: "Hedef 11. Sen 10,85'te bastın, 0,15 erken, birinci, 2 puan. Elif ikinci, 0,42 geç."
 */
export function revealSpeech(
  reveal: KorKronometreReveal,
  targetMs: number,
  selfId: string | null,
  nameOf: (id: string) => string,
): string {
  const WORDS = ["birinci", "ikinci", "üçüncü", "dördüncü", "beşinci", "altıncı", "yedinci", "sekizinci"];
  const word = (r: number | null) => (r === null ? "" : (WORDS[r - 1] ?? `${r}.`));
  const parts = [`Hedef ${targetSeconds(targetMs)}.`];
  const mine = selfId === null ? null : entryOf(reveal, selfId);
  if (selfId !== null) {
    if (mine?.pressed && mine.ms !== null) {
      parts.push(
        `Sen ${formatSeconds(mine.ms)}'te bastın, ${formatOffset(mine.ms, targetMs)}, ${word(mine.rank)}, ${mine.points} puan.`,
      );
    } else parts.push("Basmadın.");
  }
  for (const e of reveal.entries) {
    if (e.playerId === selfId || !e.pressed || e.ms === null || (e.rank ?? 9) > 2) continue;
    parts.push(`${nameOf(e.playerId)} ${word(e.rank)}, ${formatOffset(e.ms, targetMs)}.`);
  }
  return parts.join(" ");
}

/** KR-M4: nabız vuruşları arası (ms), her telefonda ayrı rastgele; oyunla ilgisiz (sunucuya, puana dokunmaz). */
export const PULSE_MIN_MS = 600;
export const PULSE_MAX_MS = 2_200;
/** `r` ∈ [0, 1) rastgele sayıdan vuruş arası. */
export const nextPulseGap = (r: number): number =>
  PULSE_MIN_MS + Math.max(0, Math.min(1, r)) * (PULSE_MAX_MS - PULSE_MIN_MS);
