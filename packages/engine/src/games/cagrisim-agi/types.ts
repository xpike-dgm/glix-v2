/** Çağrışım Ağı — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §5. */

/** Bir oyunda üst üste oynanan kelime sayısı (CG-M2). */
export const CAGRISIM_ROUNDS = 3;
/** Kelime başına cevap süresi (ms; CG-M2). */
export const CAGRISIM_ANSWER_MS = 20_000;
/** Kelimeler arasındaki kısa açılış (ms; CG-M2): dokunarak geçilmez, sabittir. */
export const CAGRISIM_MINI_MS = 4_000;
/** Üçüncü kelimeden sonraki büyük açılışın en az süresi (ms; CG-M2, CG-U5). "Devam et" ile geçilir. */
export const CAGRISIM_FINAL_MS = 8_000;
/** Hiç erken bitiş olmazsa oyunun toplam süresi (ms): 3 × 20 + 2 × 4 + 8 = 76 sn. */
export const CAGRISIM_TOTAL_MS =
  CAGRISIM_ROUNDS * CAGRISIM_ANSWER_MS + (CAGRISIM_ROUNDS - 1) * CAGRISIM_MINI_MS + CAGRISIM_FINAL_MS;
/** Teknik üst sınır (karakter); kural "sınır yok" der, bu yalnız ağ mesajını korur. */
export const CAGRISIM_MAX_LENGTH = 60;
/** Son cevaptan sonra cevapların açılmasına kalan süre (ms). */
export const CAGRISIM_LOCK_GRACE_MS = 1_000;
/** Aynı odada tekrar gelmeyen son kelime sayısı (CG-M4; ~20 oyun). */
export const CAGRISIM_CONTENT_MEMORY = 60;
/** Tek harf yazım hatası toleransı yalnız bu uzunluktan (karşılaştırma anahtarında harf) itibaren (CG-M3). */
export const CAGRISIM_TYPO_MIN = 6;
/** Çoğul eki atıldıktan sonra kalan kök en az bu kadar harf olmalı (CG-M3). */
export const CAGRISIM_PLURAL_ROOT_MIN = 3;

/** Kelime zorluğu (CG-M5). Etiketsiz kelime "orta" sayılır. */
export const CAGRISIM_LEVELS = ["kolay", "orta", "zor"] as const;
export type CagrisimLevel = (typeof CAGRISIM_LEVELS)[number];
/** Serinin zorluk sırası: kolaydan zora (CG-M5). */
export const CAGRISIM_SERIES: readonly CagrisimLevel[] = ["kolay", "orta", "zor"];

/** Gönderilen cevap kesindir (değiştirilemez); ayrı bir kilit eylemi yoktur: cevap göndermek "Tamam"dır. */
export type CagrisimAgiAction = { kind: "answer"; text: string };

/** Aynı cevabı (eşleşme kurallarıyla) veren en az iki oyuncu: bir ağ. */
export interface CagrisimGroup {
  /** Ekranda gösterilen yazılış: oyuncunun yazdığı biçim (küçük harfe çevrilmez; CG-M3). */
  text: string;
  members: string[];
  /** Üyelerin her birinin aldığı ağ puanı (= üye sayısı). */
  points: number;
  /** Ağda birleşen farklı yazılışlar (en az ikiyse; yoksa boş): "(dalgalar, dalga)". */
  variants: string[];
}

export interface CagrisimSingle {
  playerId: string;
  text: string;
}

/** Bir kelimenin açılan sonucu. */
export interface CagrisimReveal {
  /** Büyükten küçüğe. */
  groups: CagrisimGroup[];
  /** Tek kalan cevaplar (0 puan). */
  singles: CagrisimSingle[];
  /** Cevap vermeyenler (0 puan). */
  silent: string[];
}

/** Cevapları açılmış bir kelime. */
export interface CagrisimRoundResult {
  word: string;
  reveal: CagrisimReveal;
}

/**
 * Aşama: `answer` cevap yazılıyor, `mini` kelimeler arası kısa açılış (4 sn), `final` üçüncü kelimeden sonraki büyük
 * açılış.
 */
export type CagrisimPhase = "answer" | "mini" | "final";

/** Herkese açık görünüm (oda başına bir kez hesaplanır). Cevaplar o kelimenin süresi bitene kadar yoktur. */
export interface CagrisimAgiPublicView {
  /** Oyunun (ilk kelimenin) başlangıcı. */
  startedAt: number;
  /** 0'dan başlayan kelime sırası. */
  round: number;
  rounds: number;
  /** Bu kelimenin cevap süresinin başlangıcı. */
  roundStartedAt: number;
  /** Bu kelimenin cevap süresinin bitişi. */
  answerEndsAt: number;
  /** Bu kelimenin açılışının (mini ya da büyük) bitişi. */
  revealEndsAt: number;
  /** Oyunun en geç bitişi (erken bitişle öne gelir). */
  endsAt: number;
  /** Ortak ana kelime (bu kelime). */
  word: string;
  phase: CagrisimPhase;
  /** Bu kelimede cevabını gönderenler (cevabın kendisi değil). */
  answeredIds: string[];
  /** Cevapları açılmış kelimeler (bu kelime dahil, `phase !== "answer"` ise). */
  results: CagrisimRoundResult[];
  /** Açılmış kelimelerdeki ağ puanlarının toplamı (oyuncu başına). */
  totals: Record<string, number>;
  /** Genel skora gidecek ödüller (CG-M1); yalnız büyük açılışta. */
  awards: Record<string, number> | null;
}

/** Kişiye özel görünüm. */
export interface CagrisimAgiView {
  /** Bu kelimede gönderdiğin cevap; henüz göndermediysen ve izleyicide null. */
  myAnswer: string | null;
}

/**
 * Genel skor ödülü (CG-M1): en yüksek toplam ağ puanı **+2** (eşitlikte hepsi), sonraki farklı toplam **+1**, diğerleri
 * 0. Ağ puanı 0 olan ödül almaz. Herkesin toplamı aynı ve 0'dan büyükse herkes +1; hepsi 0 ise kimse.
 */
export function cagrisimAwards(points: Readonly<Record<string, number>>): Record<string, number> {
  const ids = Object.keys(points);
  const awards: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const value = (id: string): number => points[id] ?? 0;
  const positive = [...new Set(ids.map(value).filter((v) => v > 0))].sort((x, y) => y - x);
  const top = positive[0];
  if (top === undefined) return awards;
  if (ids.every((id) => value(id) === top)) {
    for (const id of ids) awards[id] = 1;
    return awards;
  }
  const second = positive[1];
  for (const id of ids) {
    if (value(id) === top) awards[id] = 2;
    else if (second !== undefined && value(id) === second) awards[id] = 1;
  }
  return awards;
}
