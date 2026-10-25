/** Bozuk Telefon — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §26, docs/A8-OYUNLAR.md. */

import type { DrawPen, DrawSize, DrawStroke } from "../drawing.js";

export const BOZUK_WRITE_MS = 25_000;
export const BOZUK_DRAW_MS = 60_000;
/** Gösteride bir adımın ekranda kalma süresi. */
export const BOZUK_SHOW_STEP_MS = 3_000;
export const BOZUK_VOTE_MS = 10_000;
/** Oylama sonrası sonuç penceresi (açılış penceresi; kural süresi ve puan değişmez). */
export const BOZUK_RESULT_MS = 3_000;
/** Herkes "Tamam" deyince aşamanın bitmesine kalan süre (ms). */
export const BOZUK_LOCK_GRACE_MS = 1_000;
export const BOZUK_MAX_STEPS = 6;
/** Cümle uzunluğu (kod noktası). */
export const BOZUK_TEXT_MAX = 60;
/** Süresi dolan boş yazı adımının zincire geçen değeri. */
export const BOZUK_EMPTY_TEXT = "…";

/** Bir oyuncunun çiziminde duran darbe/nokta/eylem üst sınırları (60 sn'lik çizim). */
export const BOZUK_MAX_STROKES = 150;
export const BOZUK_MAX_TOTAL_POINTS = 1_500;
export const BOZUK_MAX_DRAW_ACTIONS = 400;

/** Zincir adımı sayısı: oyuncu sayısı, en çok 6. */
export const bozukStepCount = (playerCount: number): number => Math.min(playerCount, BOZUK_MAX_STEPS);
/** Çift adımlar yazı, tek adımlar çizim (yaz → çiz → yaz …). */
export const bozukStepKind = (step: number): "write" | "draw" => (step % 2 === 0 ? "write" : "draw");
export const bozukStepMs = (step: number): number =>
  bozukStepKind(step) === "write" ? BOZUK_WRITE_MS : BOZUK_DRAW_MS;
/** Bir zincirin gösteri + oylama + sonuç süresi (erken bitişsiz). */
export const bozukChainMs = (steps: number): number =>
  steps * BOZUK_SHOW_STEP_MS + BOZUK_VOTE_MS + BOZUK_RESULT_MS;
/** Erken bitişsiz toplam süre. */
export function bozukDurationMs(playerCount: number): number {
  const steps = bozukStepCount(playerCount);
  let total = 0;
  for (let s = 0; s < steps; s++) total += bozukStepMs(s);
  return total + playerCount * bozukChainMs(steps);
}
export const BOZUK_MAX_DURATION_MS = Math.max(...[3, 4, 5, 6, 7, 8].map(bozukDurationMs));

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

/** Bir oyuncunun elindeki zincirden gördüğü önceki adım (yazarsız). */
export type BozukPrompt = { kind: "write"; text: string } | { kind: "draw"; strokes: DrawStroke[] };

export type BozukPhase = "write" | "draw" | "reveal" | "done";
export type BozukRevealStage = "show" | "vote" | "result";

export interface BozukReveal {
  /** Gösterilen zincir (0..chains-1) ve zinciri başlatan oyuncu. */
  chain: number;
  chains: number;
  starter: string;
  stage: BozukRevealStage;
  /** Görünen adım sayısı (gösteri sırasında 1..steps; oylama ve sonuçta hepsi). */
  shown: number;
  /** Zincirin görünen adımları. */
  steps: BozukStep[];
  /** Gösterinin başladığı ve bu aşamanın biteceği an. */
  chainStartedAt: number;
  stageEndsAt: number;
  /** Bu zincirde oy kullananlar (kime verdikleri sonuca kadar gizli). */
  voted: string[];
  /** Adım başına alınan oy sayısı; yalnız sonuç aşamasında. */
  tally: number[] | null;
  /** "Sağlam zincir" mi; yalnız sonuç aşamasında. */
  robust: boolean | null;
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
  /** Sonucu açılmış zincirlerden birikmiş puanlar; girdi aşamasında null. */
  scores: Record<string, number> | null;
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
}
