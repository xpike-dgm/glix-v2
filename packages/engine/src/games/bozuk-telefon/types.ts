/** Bozuk Telefon — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §26, docs/A8-OYUNLAR.md. */

import type { DrawPen, DrawSize, DrawStroke } from "../drawing.js";

/**
 * Bozuk Telefon zaman çizelgesi — tüm süreler ve adım sınırı tek yerde (sahip "süre değişsin" derse buradan).
 * Gösteri: zincirin ilk adımı hemen, sonrakiler `showStepMs` aralıkla açılır; son adım görünür görünmez oylama
 * başlar (`voteMs`), ardından zincir sonucu (`resultMs`). Herkes "Tamam" derse / oy verirse `lockGraceMs` sonra biter.
 */
export const BOZUK_TIMELINE = {
  writeMs: 20_000,
  drawMs: 45_000,
  showStepMs: 2_000,
  voteMs: 6_000,
  resultMs: 2_000,
  lockGraceMs: 1_000,
  maxSteps: 5,
} as const;

export const BOZUK_WRITE_MS: number = BOZUK_TIMELINE.writeMs;
export const BOZUK_DRAW_MS: number = BOZUK_TIMELINE.drawMs;
/** Gösteride iki adımın açılışı arasındaki süre. */
export const BOZUK_SHOW_STEP_MS: number = BOZUK_TIMELINE.showStepMs;
export const BOZUK_VOTE_MS: number = BOZUK_TIMELINE.voteMs;
/** Oylama sonrası zincir sonucu penceresi (yazarlar burada açılır). */
export const BOZUK_RESULT_MS: number = BOZUK_TIMELINE.resultMs;
/** Herkes "Tamam" deyince aşamanın bitmesine kalan süre (ms). */
export const BOZUK_LOCK_GRACE_MS: number = BOZUK_TIMELINE.lockGraceMs;
export const BOZUK_MAX_STEPS: number = BOZUK_TIMELINE.maxSteps;
/** Cümle uzunluğu (kod noktası). */
export const BOZUK_TEXT_MAX = 60;
/** Süresi dolan boş yazı adımının zincire geçen değeri. */
export const BOZUK_EMPTY_TEXT = "…";

/** Bir oyuncunun çiziminde duran darbe/nokta/eylem üst sınırları. */
export const BOZUK_MAX_STROKES = 150;
export const BOZUK_MAX_TOTAL_POINTS = 1_500;
export const BOZUK_MAX_DRAW_ACTIONS = 400;

/** Mini oyun puanı (genel skora giden): kahkaha puanı sırasına göre birinci(ler) +2, sonraki toplam +1. */
export const BOZUK_AWARD_FIRST = 2;
export const BOZUK_AWARD_SECOND = 1;

/** Zincir adımı sayısı: oyuncu sayısı, en çok 5. */
export const bozukStepCount = (playerCount: number): number => Math.min(playerCount, BOZUK_MAX_STEPS);
/** Çift adımlar yazı, tek adımlar çizim (yaz → çiz → yaz …). */
export const bozukStepKind = (step: number): "write" | "draw" => (step % 2 === 0 ? "write" : "draw");
export const bozukStepMs = (step: number): number =>
  bozukStepKind(step) === "write" ? BOZUK_WRITE_MS : BOZUK_DRAW_MS;
/** Gösterinin oylamaya kadar süren kısmı: ilk adım hemen, son adım `(steps - 1)` aralık sonra (oylama o an açılır). */
export const bozukShowMs = (steps: number): number => Math.max(0, steps - 1) * BOZUK_SHOW_STEP_MS;
/** Bir zincirin gösteri + oylama + sonuç süresi (erken bitişsiz). */
export const bozukChainMs = (steps: number): number => bozukShowMs(steps) + BOZUK_VOTE_MS + BOZUK_RESULT_MS;
/** Erken bitişsiz toplam süre. */
export function bozukDurationMs(playerCount: number): number {
  const steps = bozukStepCount(playerCount);
  let total = 0;
  for (let s = 0; s < steps; s++) total += bozukStepMs(s);
  return total + playerCount * bozukChainMs(steps);
}
export const BOZUK_MAX_DURATION_MS = Math.max(...[3, 4, 5, 6, 7, 8].map(bozukDurationMs));

/**
 * Kahkaha puanından mini oyun puanı: en yüksek toplam(lar) +2, ondan sonraki farklı toplam +1, diğerleri 0.
 * Toplamı 0 olan ödül almaz. Herkesin toplamı aynı ve 0'dan büyükse herkes +1. Eksi yok.
 */
export function bozukRankAwards(
  laugh: Readonly<Record<string, number>>,
  players: readonly string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of players) out[id] = 0;
  const totals = players.map((id) => laugh[id] ?? 0);
  const distinct = [...new Set(totals.filter((v) => v > 0))].sort((a, b) => b - a);
  if (distinct.length === 0) return out;
  const allSame = totals.every((v) => v === totals[0]);
  if (allSame) {
    for (const id of players) out[id] = BOZUK_AWARD_SECOND;
    return out;
  }
  const [first, second] = distinct;
  for (const id of players) {
    const v = laugh[id] ?? 0;
    if (v === first) out[id] = BOZUK_AWARD_FIRST;
    else if (second !== undefined && v === second) out[id] = BOZUK_AWARD_SECOND;
  }
  return out;
}

export type BozukAction =
  | { kind: "text"; text: string }
  | { kind: "stroke"; color: DrawPen; size: DrawSize; points: number[] }
  | { kind: "undo" }
  | { kind: "clear" }
  /** Gösteri sonrası oylama: o zincirin en komik adımı (adım numarası); tek seferlik. */
  | { kind: "vote"; step: number }
  /** Yazma/çizimde "Tamam": o adımdaki girdi kesinleşir (en az bir yazı / bir darbe gerekir). */
  | { kind: "lock" };

/** Zincire geçmiş bir adım. Boş yazı `BOZUK_EMPTY_TEXT`, boş çizim `strokes: []` ("boş tuval"). */
export type BozukStep =
  | { kind: "write"; author: string; text: string }
  | { kind: "draw"; author: string; strokes: DrawStroke[] };

/**
 * Gösteride görünen adım. İsimsiz oylama: gösteri ve oylama boyunca `author` her görünümde `null`dır; yazarlar
 * yalnız zincir sonucunda açılır.
 */
export type BozukShownStep =
  | { kind: "write"; author: string | null; text: string }
  | { kind: "draw"; author: string | null; strokes: DrawStroke[] };

/** Bir oyuncunun elindeki zincirden gördüğü önceki adım (yazarsız). */
export type BozukPrompt = { kind: "write"; text: string } | { kind: "draw"; strokes: DrawStroke[] };

export type BozukPhase = "write" | "draw" | "reveal" | "done";
export type BozukRevealStage = "show" | "vote" | "result";

export interface BozukReveal {
  /** Gösterilen zincir (0..chains-1). */
  chain: number;
  chains: number;
  /** Zinciri başlatan oyuncu; isimsizlik gereği yalnız sonuç aşamasında, öncesinde null. */
  starter: string | null;
  stage: BozukRevealStage;
  /** Görünen adım sayısı (gösteri sırasında 1..steps-1; oylama ve sonuçta hepsi). */
  shown: number;
  /** Zincirin görünen adımları (sonuca kadar yazarsız). */
  steps: BozukShownStep[];
  /** Gösterinin başladığı an, oylamanın açıldığı an (son adımın göründüğü an) ve bu aşamanın biteceği an. */
  chainStartedAt: number;
  voteStartsAt: number;
  stageEndsAt: number;
  /** Bu zincirde oy kullananlar (kime verdikleri sonuca kadar gizli). */
  voted: string[];
  /** Adım başına alınan oy sayısı; yalnız sonuç aşamasında. */
  tally: number[] | null;
  /** "Sağlam zincir" mi; yalnız sonuç aşamasında. */
  robust: boolean | null;
  /** En çok oy alan adım(lar) ("EN KOMİK"); oy yoksa boş. Yalnız sonuç aşamasında. */
  crowned: number[] | null;
}

/** Oyun sonu özeti: bir zincirin tamamı, oyları ve taçlı adımları ("Gecenin en komikleri"). */
export interface BozukChainRecap {
  chain: number;
  starter: string;
  steps: BozukStep[];
  tally: number[];
  robust: boolean;
  crowned: number[];
}

export interface BozukPublicView {
  phase: BozukPhase;
  startedAt: number;
  /** Girdi aşamasında geçerli adım (0..steps-1); gösteride steps. */
  step: number;
  steps: number;
  /** Girdi adımının başladığı ve biteceği an; gösteride null. */
  stepStartedAt: number | null;
  stepEndsAt: number | null;
  /** Katılımcılar, katılım sırasıyla. */
  players: string[];
  /** Bu adımda girdisini "Tamam" ile kesinleştirenler. */
  doneIds: string[];
  reveal: BozukReveal | null;
  /** Kahkaha puanı: sonucu açılmış zincirlerden biriken oy (+1) ve sağlam zincir (+1) toplamı; girdi aşamasında null. */
  scores: Record<string, number> | null;
  /** Oyun bitince tüm zincirler (yazarlarıyla); öncesinde null. */
  recap: BozukChainRecap[] | null;
}

export interface BozukView {
  /** Şu an yapacağın iş; gösteride ve izleyicide null. */
  role: "write" | "draw" | null;
  /** Elindeki zincirin bir önceki adımı; ilk adımda null. */
  prompt: BozukPrompt | null;
  /** Yazma adımında kendi taslağın. */
  text: string | null;
  /** Çizim adımında kendi darbelerin: sıra numarası (metin) -> darbe. Geri al/temizle `null` yamasıyla yansır. */
  strokes: Record<string, DrawStroke>;
  /** Kalan nokta kotası. */
  pointsLeft: number;
  /** Bu adımı kesinleştirdin mi. */
  done: boolean;
  /** Gösterilen zincirde verdiğin oy (adım numarası); yoksa null. */
  myVote: number | null;
  /**
   * Gösterilen zincirde görünen kendi adımın (adım numarası); yoksa null. Yalnız sana gider: oylamada kendi kartını
   * "senin" diye işaretlemek için (kimin hangi adımı yazdığı ortak görünümde sonuca kadar yoktur).
   */
  myStep: number | null;
}
