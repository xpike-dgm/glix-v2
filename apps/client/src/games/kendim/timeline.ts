import { KENDIM_REVEAL_CARD_MS, kendimRevealMs } from "@glix/engine";

/**
 * Kendim zamanlamaları (ms). Tek sabit: süreler yalnız buradan değişir. Açılış anları açılışın başından (sunucu
 * saatinde `matchEndsAt`) ölçülür; ekran `atServerTime` ile sunucu saatine bağlanır.
 */
export const KN_PLAN = {
  /** KN-U3: son bu kadar saniyede saat kırmızı nabız atar, tıklar, titrer (yalnız Tamam dememiş olana). */
  warnSec: 5,
  /** KN-M3: boşluk basılınca pano sallanır ve "Tek kelime!" bu kadar görünür. */
  oneWordMs: 1_400,
  /** KN-U1: Tamam'da aynadaki ışık çakması. */
  flashMs: 650,
  /** KN-U2: bırakınca ip bu kadar titreyip kartın altına yerleşir. */
  snapMs: 520,
} as const;

/**
 * Kart kart açılış (KN-U4). Her kart `KENDIM_REVEAL_CARD_MS` (3 sn) sürer: kart büyür ve kelime okunur → kimin kimi
 * tahmin ettiği → kart döner, sahibi açılır, doğru bilenler ✓ ile zıplar → tek bulan şeridi. Kartlardan sonra özet.
 */
export const KN_REVEAL_PLAN = {
  /** Kart içi anlar (kartın başından). */
  guessesAt: 450,
  flipAt: 1_450,
  bonusAt: 2_150,
} as const;

export interface CardSlot {
  card: number;
  startAt: number;
  guessesAt: number;
  flipAt: number;
  bonusAt: number;
}

export interface RevealTimeline {
  slots: CardSlot[];
  /** Özet ekranının açıldığı an. */
  summaryAt: number;
  /** Açılışın bittiği an (oyun biter; "Devam et" sürer). */
  endAt: number;
}

/**
 * Açılış sırası: sunucunun karışık sırası; izleyicinin kartı varsa en sona alınır ("Seni kim tanıdı?"). Kartı
 * olmayan (izleyici ya da kelime yazmayan) sunucu sırasını görür; en son kart rastgeledir.
 */
export function revealOrder(
  order: readonly number[],
  cards: readonly { id: number; owner: string }[],
  selfId: string,
): number[] {
  const known = order.filter((id) => cards.some((c) => c.id === id));
  for (const c of cards) if (!known.includes(c.id)) known.push(c.id);
  const mine = cards.find((c) => c.owner === selfId);
  if (!mine) return known;
  return [...known.filter((id) => id !== mine.id), mine.id];
}

export function revealTimeline(order: readonly number[]): RevealTimeline {
  const p = KN_REVEAL_PLAN;
  const slots = order.map((card, i) => {
    const startAt = i * KENDIM_REVEAL_CARD_MS;
    return {
      card,
      startAt,
      guessesAt: startAt + p.guessesAt,
      flipAt: startAt + p.flipAt,
      bonusAt: startAt + p.bonusAt,
    };
  });
  const summaryAt = order.length * KENDIM_REVEAL_CARD_MS;
  return { slots, summaryAt, endAt: kendimRevealMs(order.length) };
}

/** Şu an (açılışın başından ms) gösterilen kartın sırası; özet açıldıysa -1. */
export function activeSlot(tl: RevealTimeline, t: number): number {
  if (t >= tl.summaryAt) return -1;
  let idx = 0;
  for (let i = 0; i < tl.slots.length; i++) if (t >= (tl.slots[i]?.startAt ?? 0)) idx = i;
  return idx;
}
