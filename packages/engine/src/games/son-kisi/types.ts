/** Son Kişi — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §17, docs/A6-OYUNLAR.md. */

/** Gizli bitiş, oyun başından en az / en çok bu kadar sonra (ms çözünürlükte rastgele). */
export const SON_KISI_MIN_MS = 10_000;
export const SON_KISI_MAX_MS = 20_000;

export type SonKisiAction = { kind: "escape" };

/** Gerilim düzeyi: geçen/toplam ≥ 0,5 → 1, ≥ 0,75 → 2, ≥ 0,9 → 3. Bitiş zamanı hiçbir görünümde yoktur. */
export type SonKisiTension = 0 | 1 | 2 | 3;

export interface SonKisiEscape {
  id: string;
  /** Oyun başından kaçışa geçen süre (ms). */
  ms: number;
}

/** Bitişte açılan sonuç. Bitiş zamanının kendisi yoktur. */
export interface SonKisiResult {
  /** Kaçanlar, kaçış sırasıyla. */
  escapes: SonKisiEscape[];
  /** En son kaçanlar (+1); kimse kaçmadıysa boş. */
  last: string[];
  /** Hiç kaçmayanlar (−1). */
  missed: string[];
  /** Mini oyun puanları. */
  scores: Record<string, number>;
}

/** Herkese açık görünüm. */
export interface SonKisiPublicView {
  startedAt: number;
  /** Kaçanlar (koridorda kaybolan avatarlar), kaçış sırasıyla. Süreler bitişe kadar açılmaz. */
  escaped: string[];
  tension: SonKisiTension;
  /** Gizli bitiş geldi mi. */
  finished: boolean;
  result: SonKisiResult | null;
}

/** Kişiye özel görünüm: bu oyuncu kaçtı mı. İzleyicide false. */
export interface SonKisiView {
  escaped: boolean;
}
