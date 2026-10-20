/** Kontrol Paneli Kaosu — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md, docs/A6-OYUNLAR.md. */

export const KONTROL_PLAY_MS = 60_000;
/** Sonuç açıldıktan sonra gösterildiği süre (oyun bu sürenin sonunda biter). */
export const KONTROL_REVEAL_MS = 8_000;
export const KONTROL_DURATION_MS = KONTROL_PLAY_MS + KONTROL_REVEAL_MS;
/** Herkes kesimini yaptıysa bitişe kalan süre (ms). */
export const KONTROL_LOCK_GRACE_MS = 1_000;

export const WIRE_COLORS = ["blue", "green", "red", "yellow"] as const;
export type WireColor = (typeof WIRE_COLORS)[number];

/** Kesim geri alınamaz. */
export type KontrolAction = { kind: "cut"; color: WireColor };

export type KontrolStage = "play" | "reveal";

/** "N. kablo R ise" koşulu; `position` 1 (en üst) .. 4 (en alt). */
export interface ClueCondition {
  position: number;
  color: WireColor;
}

/**
 * İpucu yapısal veridir (istemci Türkçe cümleye çevirir): "koşulların hepsi doğruysa `cut` rengini kes".
 * Hedef oyuncunun adı içermez.
 */
export interface Clue {
  conditions: ClueCondition[];
  cut: WireColor;
}

export interface KontrolRevealRow {
  /** Panelin dizilimi (yukarıdan aşağı). */
  panel: WireColor[];
  /** Oyuncunun kesimi; kesmediyse null. */
  cut: WireColor | null;
  /** Doğru kabloyu kesti mi. */
  correct: boolean;
  /** Bu panelin ipucunu taşıyan oyuncu. */
  carrier: string;
  /** Panelin ipucu. */
  clue: Clue;
}

export interface KontrolReveal {
  /** Oyuncu -> kendi paneli ve sonucu. */
  rows: Record<string, KontrolRevealRow>;
  /** Mini oyun puanı (= genel skora eklenen): doğru kesen +1, doğru kesilen panelin ipucu taşıyıcısı +1. */
  scores: Record<string, number>;
}

/** Herkese açık görünüm: paneller, ipuçları ve kesimler sonuç açılana kadar hiçbir yerde yoktur. */
export interface KontrolPublicView {
  players: string[];
  stage: KontrolStage;
  startedAt: number;
  endsAt: number;
  finishAt: number;
  /** Kesimini yapanlar (neyi kestikleri gizli). */
  done: string[];
  reveal: KontrolReveal | null;
}

/** Kişiye özel görünüm. İzleyicide boştur. */
export interface KontrolView {
  /** Kendi panelinin dizilimi (yukarıdan aşağı). */
  panel: WireColor[];
  /** Başka bir oyuncunun paneli için taşıdığın ipucu. */
  clue: Clue | null;
  /** Kendi kesimin. */
  myCut: WireColor | null;
}
