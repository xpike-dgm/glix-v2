/** Çağrışım Ağı — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §5. */

/** Cevap süresi (ms). */
export const CAGRISIM_ANSWER_MS = 30_000;
/** Cevaplar açıldıktan sonra kümelerin gösterildiği kısa bölüm (ms). */
export const CAGRISIM_REVEAL_MS = 6_000;
export const CAGRISIM_TOTAL_MS = CAGRISIM_ANSWER_MS + CAGRISIM_REVEAL_MS;
/** Teknik üst sınır (karakter); kural "sınır yok" der, bu yalnız ağ mesajını korur. */
export const CAGRISIM_MAX_LENGTH = 60;

export type CagrisimAgiAction = { kind: "answer"; text: string };

/** Aynı normalleştirilmiş cevabı veren en az iki oyuncu. */
export interface CagrisimGroup {
  /** Normalleştirilmiş cevap (ekranda gösterilen). */
  text: string;
  members: string[];
  /** Üyelerin her birinin aldığı puan (= üye sayısı). */
  points: number;
}

export interface CagrisimSingle {
  playerId: string;
  text: string;
}

/** Süre dolunca açılan sonuç. */
export interface CagrisimReveal {
  /** Büyükten küçüğe. */
  groups: CagrisimGroup[];
  /** Tek kalan cevaplar (0 puan). */
  singles: CagrisimSingle[];
  /** Cevap vermeyenler (0 puan). */
  silent: string[];
}

/** Herkese açık görünüm (oda başına bir kez hesaplanır). Cevaplar süre bitene kadar yoktur. */
export interface CagrisimAgiPublicView {
  startedAt: number;
  /** Cevap süresinin bitişi. */
  answerEndsAt: number;
  /** Açılış bölümünün (ve oyunun) bitişi. */
  endsAt: number;
  /** Ortak ana kelime. */
  word: string;
  phase: "answer" | "reveal";
  /** Cevabını gönderenler (cevabın kendisi değil). */
  answeredIds: string[];
  /** Yalnız `phase === "reveal"` iken dolu. */
  reveal: CagrisimReveal | null;
}

/** Kişiye özel görünüm. */
export interface CagrisimAgiView {
  /** Gönderdiğin cevap; henüz göndermediysen ve izleyicide null. */
  myAnswer: string | null;
}
