/** Gizli Hırsız — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §8, docs/A6-OYUNLAR.md. */

export const GIZLI_HIRSIZ_DURATION_MS = 30_000;

export type GizliHirsizAction = { kind: "steal" };

/** Tur sonunda açılan sonuç: kimin bastığı yalnız burada ortaya çıkar. */
export interface GizliHirsizReveal {
  /** Basanlar, basış sırasıyla. */
  thieves: string[];
  /** solo: tek hırsız (+1), multi: birden çok hırsız (her biri −1), none: kimse basmadı. */
  outcome: "solo" | "multi" | "none";
  /** Mini oyun puanları (basmayanlar 0). */
  scores: Record<string, number>;
}

/** Herkese açık görünüm. Süre dolana kadar kimin bastığına dair hiçbir şey içermez. */
export interface GizliHirsizPublicView {
  startedAt: number;
  endsAt: number;
  /** Süre doldu mu. */
  finished: boolean;
  reveal: GizliHirsizReveal | null;
}

/** Kişiye özel görünüm: yalnız kendi basışın. İzleyicide hep false. */
export interface GizliHirsizView {
  pressed: boolean;
}
