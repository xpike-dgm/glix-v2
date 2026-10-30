/** Kontrol Paneli Kaosu — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §21. */

/**
 * Oyunun bütün zaman çizelgesi tek yerde (ms). Üç dalga; dalgalar arasında kısa sonuç; son dalgadan sonra sonuç
 * açılışı (oyun onun sonunda biter). Yanlış kesim dalga saatinden `penaltyMs` düşer, saat `floorMs`'nin altına inmez.
 */
export const KONTROL_TIMELINE = {
  /** Dalga süreleri: 1 Isınma, 2 Karmaşa, 3 Kaos. */
  waveMs: [25_000, 25_000, 20_000],
  /** Dalga başına kablo sayısı (dalga 3'te 5. renk mor). */
  wires: [4, 4, 5],
  /** İki dalga arasındaki kısa sonuç. */
  breakMs: 4_000,
  /** Son dalgadan sonraki sonuç açılışı (oyun bunun sonunda biter). */
  revealMs: 8_000,
  /** Bağlı herkes kestiyse dalganın bitişine kalan süre. */
  lockGraceMs: 1_000,
  /** Yanlış kesimin ortak saatten düşürdüğü süre. */
  penaltyMs: 5_000,
  /** Saat bu sürenin altına inmez; bu süreye inmiş saatte yanlış kesim süre düşürmez. */
  floorMs: 3_000,
} as const;

export const KONTROL_WAVES = KONTROL_TIMELINE.waveMs.length;
/** Sonuç açıldıktan sonra gösterildiği süre (oyun bu sürenin sonunda biter). */
export const KONTROL_REVEAL_MS = KONTROL_TIMELINE.revealMs;
/** Dalgalar arasındaki kısa sonuç. */
export const KONTROL_BREAK_MS = KONTROL_TIMELINE.breakMs;
/** Herkes kesimini yaptıysa dalganın bitişine kalan süre (ms). */
export const KONTROL_LOCK_GRACE_MS = KONTROL_TIMELINE.lockGraceMs;
export const KONTROL_PENALTY_MS = KONTROL_TIMELINE.penaltyMs;
export const KONTROL_FLOOR_MS = KONTROL_TIMELINE.floorMs;
/** Hiç kısalmayan bir oyunun toplam süresi: 25 + 4 + 25 + 4 + 20 + 8 = 86 sn. */
export const KONTROL_DURATION_MS =
  KONTROL_TIMELINE.waveMs.reduce((a, b) => a + b, 0) +
  KONTROL_TIMELINE.breakMs * (KONTROL_WAVES - 1) +
  KONTROL_TIMELINE.revealMs;

/** Bütün kablo renkleri; bir dalgada ilk `wires[dalga]` tanesi kullanılır (mor yalnız dalga 3'te). */
export const WIRE_COLORS = ["blue", "green", "red", "yellow", "purple"] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

/** Dalgadaki renkler (ilk N renk). */
export function waveColors(wave: number): WireColor[] {
  const n = KONTROL_TIMELINE.wires[wave] ?? KONTROL_TIMELINE.wires[0];
  return WIRE_COLORS.slice(0, n);
}

/** Kesim geri alınamaz; dalga başına tek kesim. */
export type KontrolAction = { kind: "cut"; color: WireColor };

/** play: dalga sürüyor; break: dalgalar arası kısa sonuç; reveal: oyun sonu açılışı. */
export type KontrolStage = "play" | "break" | "reveal";

/**
 * İpucu koşulları (konumlar 1 = en üst):
 * - `at`: "N. kablo R ise"; `notAt`: "N. kablo R değilse";
 * - `adjacent`: "A ile B yan yanaysa"; `above`: "A, B'den yukarıdaysa".
 */
export type ClueCondition =
  | { kind: "at"; position: number; color: WireColor }
  | { kind: "notAt"; position: number; color: WireColor }
  | { kind: "adjacent"; a: WireColor; b: WireColor }
  | { kind: "above"; a: WireColor; b: WireColor };

/** Ne kesilecek: bir renk ya da bir konum ("en alttaki kabloyu kes"). */
export type ClueCut = { kind: "color"; color: WireColor } | { kind: "position"; position: number };

/**
 * İpucu yapısal veridir (istemci Türkçe cümleye çevirir): "koşulların hepsi doğruysa `cut`u kes".
 * Hedef oyuncunun adı içermez. `wave` (1..3) ve `wires` (kablo sayısı) cümle ve çizim içindir.
 */
export interface Clue {
  wave: number;
  wires: number;
  conditions: ClueCondition[];
  cut: ClueCut;
}

export interface KontrolRevealRow {
  /** Panelin dizilimi (yukarıdan aşağı). */
  panel: WireColor[];
  /** Oyuncunun kesimi; kesmediyse null. */
  cut: WireColor | null;
  /** Kesilmesi gereken renk. */
  answer: WireColor;
  /** Doğru kabloyu kesti mi. */
  correct: boolean;
  /** Bu panelin ipucunu taşıyan oyuncu. */
  carrier: string;
  /** Panelin ipucu. */
  clue: Clue;
}

/** Biten bir dalganın açık sonucu (dalga bitince herkese açılır). */
export interface KontrolWaveResult {
  /** 0 tabanlı dalga sırası. */
  wave: number;
  rows: Record<string, KontrolRevealRow>;
  /** Bu dalganın imha puanı: doğru kesen +1, doğru kesilen panelin ipucu taşıyıcısı +1. */
  scores: Record<string, number>;
}

/** Oyun sonu: toplam imha puanı ve ondan çıkan mini oyun puanı (+2 / +1 / 0). */
export interface KontrolReveal {
  totals: Record<string, number>;
  awards: Record<string, number>;
}

/** Herkese açık görünüm: süren dalganın panelleri, ipuçları ve kesim renkleri hiçbir yerde yoktur. */
export interface KontrolPublicView {
  players: string[];
  stage: KontrolStage;
  /** 0 tabanlı dalga (aradayken biten dalga). */
  wave: number;
  waves: number;
  /** Bu dalganın kablo sayısı. */
  wires: number;
  /** Dalganın başlangıcı ve (cezalarla öne gelebilen) bomba saati bitişi. */
  startedAt: number;
  endsAt: number;
  /** Aradayken sonraki dalganın başlangıcı; açılışta oyunun bitişi. */
  nextAt: number;
  finishAt: number;
  /** Bu dalgada kesimini yapanlar (neyi kestikleri gizli). */
  done: string[];
  /** Bu dalgadaki saat atlaması sayısı ve son atlamanın anı (hangi kesim olduğu söylenmez). */
  jumps: number;
  lastJumpAt: number | null;
  /** Biten dalgaların sonuçları (sırayla). */
  results: KontrolWaveResult[];
  reveal: KontrolReveal | null;
}

/** Kişiye özel görünüm (yalnız süren dalga). İzleyicide ve aradayken boştur. */
export interface KontrolView {
  /** Kendi panelinin dizilimi (yukarıdan aşağı). */
  panel: WireColor[];
  /** Başka bir oyuncunun paneli için taşıdığın ipucu. */
  clue: Clue | null;
  /** Bu dalgadaki kendi kesimin. */
  myCut: WireColor | null;
}
