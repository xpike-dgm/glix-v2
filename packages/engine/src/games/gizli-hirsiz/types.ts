/** Gizli Hırsız — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §8, docs/A6-OYUNLAR.md. */

export const GIZLI_HIRSIZ_DURATION_MS = 30_000;

/** Bağlı herkes karar verdiyse oyunun bitişine kalan süre (ms; GH-M1). */
export const GIZLI_HIRSIZ_LOCK_GRACE_MS = 1_000;

/** GH-M2: kasanın ortak işareti verdiği an (başlangıçtan, ms). */
export const GIZLI_HIRSIZ_SIGNAL_MS = 15_000;

/** GH-M2: işaret için gereken en az oyuncu (2 oyuncuda işaret kimliği ele verirdi). */
export const GIZLI_HIRSIZ_SIGNAL_MIN_PLAYERS = 3;

/** GH-U5: süre bitince oyun içi kasa açılışının en az gösterimi (ms). */
export const GIZLI_HIRSIZ_REVEAL_MS = 4_500;

/** Oyun aşaması + oyun içi açılış (en uzun hâli). */
export const GIZLI_HIRSIZ_TOTAL_MS = GIZLI_HIRSIZ_DURATION_MS + GIZLI_HIRSIZ_REVEAL_MS;

/** GH-M1: herkes bir kez karar verir: ÇAL (`steal`) ya da ÇALMA (`pass`). */
export type GizliHirsizChoice = "steal" | "pass";
export type GizliHirsizAction = { kind: GizliHirsizChoice };

/** GH-M2: 15. saniyedeki ortak işaret: kasa sessiz ya da en az bir kişi ÇAL demiş. */
export type GizliHirsizSignal = "quiet" | "stir";

/** Tur sonunda açılan sonuç: kimin çaldığı yalnız burada ortaya çıkar. */
export interface GizliHirsizReveal {
  /** Çalanlar, ÇAL sırasıyla. */
  thieves: string[];
  /** Her hırsızın ÇAL dediği an (başlangıçtan ms; `thieves` ile aynı sırada). GH-U5 / GH-U6. */
  pressedAt: number[];
  /** solo: tek hırsız (+1), multi: birden çok hırsız (her biri −1), none: kimse çalmadı. */
  outcome: "solo" | "multi" | "none";
  /** Mini oyun puanları (çalmayanlar 0). */
  scores: Record<string, number>;
}

/**
 * Herkese açık görünüm. Süre dolana kadar kimin çaldığına dair hiçbir şey içermez: yalnız kimlerin karar verdiği
 * (ne seçtiği değil) ve 15. saniyedeki ortak işaret.
 */
export interface GizliHirsizPublicView {
  startedAt: number;
  endsAt: number;
  /** Süre doldu mu. */
  finished: boolean;
  /** GH-M1: karar verenler (oyuncu sırasıyla; ÇAL/ÇALMA ayrımı yok). */
  decided: string[];
  /** GH-M2: işaretin verileceği an; 2 oyuncuda null (işaret yok). */
  signalAt: number | null;
  /** GH-M2: işaret (yalnız `signalAt` geçtikten sonra; herkes daha önce karar verdiyse hiç gelmez). */
  signal: GizliHirsizSignal | null;
  reveal: GizliHirsizReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi kararın. İzleyicide hep null. */
export interface GizliHirsizView {
  choice: GizliHirsizChoice | null;
}
