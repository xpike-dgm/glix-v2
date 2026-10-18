/** Ortalamaya En Yakın — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §13. */

/** Seçim süresi (ms). */
export const ORTALAMA_CHOOSE_MS = 20_000;
/** Seçimler açıldıktan sonra sonucun ekranda kaldığı süre (ms); hedef ışını animasyonu için. */
export const ORTALAMA_REVEAL_MS = 7_000;
export const ORTALAMA_DURATION_MS = ORTALAMA_CHOOSE_MS + ORTALAMA_REVEAL_MS;

/** Seçilebilecek en küçük ve en büyük sayı (tam sayı). */
export const ORTALAMA_MIN = 0;
export const ORTALAMA_MAX = 100;

export type OrtalamaAction = { kind: "choose"; value: number };

/** Süre dolunca herkese açılan sonuç. */
export interface OrtalamaReveal {
  /** Her katılımcının seçimi (göndermeyene sunucunun atadığı sayı da burada, normal seçim gibi). */
  choices: Record<string, number>;
  /** Seçimlerin ortalaması. */
  mean: number;
  /** Hedef = ortalamanın yarısı. */
  target: number;
  /** Hedefe uzaklık (|seçim − hedef|). */
  distances: Record<string, number>;
  /** Hedefe yakınlık sırası: en yakından en uzağa; eşit uzaklıklar katılım sırasıyla. */
  order: string[];
  /** Derece (1 = en yakın); eşit uzaklıktakiler aynı dereceyi paylaşır. */
  ranks: Record<string, number>;
  /** Bu oyundan kazanılan puan (doğrudan genel skora eklenir). */
  points: Record<string, number>;
}

/** Herkese açık görünüm (oda başına bir kez). Seçimler süre dolana kadar burada yoktur. */
export interface OrtalamaPublicView {
  startedAt: number;
  /** Seçim süresinin bitişi; seçimler bu anda açılır. */
  endsAt: number;
  /** Sonuç ekranının bitişi (oyunun bitişi). */
  revealEndsAt: number;
  /** Süre dolmadan null. */
  reveal: OrtalamaReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi seçimin. */
export interface OrtalamaView {
  /** Henüz seçmediysen ya da izleyiciysen null. */
  myChoice: number | null;
}
