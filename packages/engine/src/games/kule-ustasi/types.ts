/** Kule Ustası — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §29. */

/** Pist genişliği (kule birimi). Tüm konumlar bu birimle ve tam sayıyla hesaplanır. */
export const KULE_TRACK = 1000;
/** Başlangıç (ve her sıfırlanmadan sonraki) taban bloğun genişliği. */
export const KULE_START_WIDTH = 400;
/** Başlangıç hızı: saniyede pist birimi (hız çarpanı 1,0 iken). */
export const KULE_BASE_SPEED = 450;
/** Hız çarpanı binde cinsinden: 1000 = 1,0×. */
export const KULE_SPEED_START = 1_000;
/** Her başarılı katta hız %6 artar (bileşik; tam sayı: ×106/100, aşağı yuvarlanır). */
export const KULE_SPEED_GROWTH_PERCENT = 6;
/** Hız en çok başlangıcın 2,5 katı. */
export const KULE_SPEED_CAP = 2_500;
/** Kusursuz: taşma, bloğun genişliğinin %4'ünden azsa (kesin küçük) kesilmez. */
export const KULE_PERFECT_PERCENT = 4;
/** Bir sıranın süresi; dokunmayan oyuncu süre dolduğu anda bırakmış sayılır. */
export const KULE_TURN_MS = 6_000;
/** Bırakış anı bu süreden eskiyse kabul edilmez (gecikme hilesine karşı). */
export const KULE_AT_MAX_AGE_MS = 400;
/** Toplam süre: oyun kurulduğu andan. */
export const KULE_TOTAL_MS = 90_000;
/** İlk sıranın başlamasından önceki hazırlık payı. */
export const KULE_INTRO_MS = 1_500;
/** Başarılı bırakıştan sonra sonraki sıranın başlamasına kadar pay. */
export const KULE_PAUSE_OK_MS = 900;
/** Iskadan sonra (kule yıkılışı gösterilsin diye) sonraki sıranın başlamasına kadar pay. */
export const KULE_PAUSE_MISS_MS = 2_200;
/** Simülasyon/bot süre sınırı (toplam süreden biraz uzun). */
export const KULE_BOT_SPAN_MS = 95_000;

export type KuleAction = { kind: "drop"; at: number };

export interface KuleBlock {
  /** Sol kenar (0..KULE_TRACK). */
  left: number;
  width: number;
  /** Bu blok kusursuz oturtuldu. */
  perfect: boolean;
}

/** Hız çarpanını (binde) bir kat artırır; tavanı aşmaz. */
export function kuleNextSpeed(speed: number): number {
  return Math.min(KULE_SPEED_CAP, Math.floor((speed * (100 + KULE_SPEED_GROWTH_PERCENT)) / 100));
}

/**
 * Kayan bloğun sol kenarı: `(turnStart, speed, width, now)` saf fonksiyonu (üçgen dalga).
 * Blok pistte `[0, KULE_TRACK − width]` aralığında sağa-sola gidip gelir; sıra başında sol uçtan çıkar.
 * Tamamı tam sayı aritmetiğidir; sunucu ve istemci aynı sonucu bulur.
 */
export function kuleBlockLeft(turnStart: number, speed: number, width: number, now: number): number {
  const range = KULE_TRACK - width;
  if (range <= 0) return 0;
  const elapsed = Math.max(0, Math.floor(now) - Math.floor(turnStart));
  const dist = Math.floor((elapsed * KULE_BASE_SPEED * speed) / 1_000_000);
  const m = dist % (2 * range);
  return m <= range ? m : 2 * range - m;
}

/**
 * Bırakılan bloğun sonucu. `overlap` 0 ise ıska. Kusursuzda blok alttakine tam oturur.
 * `drop` bırakılan bloğun sol kenarı, `width` genişliği; `top` alttaki (kulenin en üstteki) blok.
 */
export interface KuleCut {
  kind: "ok" | "perfect" | "miss";
  /** Yeni üst blok (ıskada null). */
  block: KuleBlock | null;
  /** Kesilip düşen parça (sol, genişlik); kesilmediyse genişlik 0. Iskada bloğun tamamı. */
  cutLeft: number;
  cutWidth: number;
}

export function kuleCut(top: KuleBlock, dropLeft: number, width: number): KuleCut {
  const overlapLeft = Math.max(dropLeft, top.left);
  const overlapRight = Math.min(dropLeft + width, top.left + top.width);
  const overlap = overlapRight - overlapLeft;
  if (overlap <= 0) return { kind: "miss", block: null, cutLeft: dropLeft, cutWidth: width };
  const overhang = width - overlap;
  if (overhang * 100 < width * KULE_PERFECT_PERCENT) {
    return {
      kind: "perfect",
      block: { left: top.left, width: top.width, perfect: true },
      cutLeft: dropLeft,
      cutWidth: 0,
    };
  }
  const cutLeft = dropLeft < top.left ? dropLeft : overlapRight;
  return {
    kind: "ok",
    block: { left: overlapLeft, width: overlap, perfect: false },
    cutLeft,
    cutWidth: overhang,
  };
}

export type KuleOutcome = "ok" | "perfect" | "miss";

export interface KuleLast {
  /** Hangi sıranın sonucu (1'den başlar). */
  turn: number;
  player: string;
  kind: KuleOutcome;
  /** Bırakışın hesaba katıldığı an (sunucu saati, ms). */
  at: number;
  /** Oyuncu dokunmadı, süre dolunca kendiliğinden bırakıldı. */
  auto: boolean;
  /** Bırakılan bloğun sol kenarı ve genişliği. */
  dropLeft: number;
  dropWidth: number;
  /** Kesilen parça (genişlik 0: kesilmedi). Iskada bloğun tamamı. */
  cutLeft: number;
  cutWidth: number;
  /** Yalnız ıskada: yıkılan kulenin blokları. */
  fallen?: KuleBlock[];
}

/** Herkese açık görünüm. Konum, `turnStart` + `speed` + `now`'dan `kuleBlockLeft` ile türetilir. */
export interface KulePublicView {
  /** Sabit oyuncu sırası (maç başında bir kez karıştırılır). */
  order: string[];
  /** Çıkanlar, çıkış sırasıyla. */
  eliminated: string[];
  /** Şu ana kadarki puanlar (oyun biterse aynen genel skora aktarılır). */
  scores: Record<string, number>;
  /** Oyuncu başına kusursuz sayısı. */
  perfects: Record<string, number>;
  /** Sırası olan oyuncu; oyun bitince null. */
  active: string | null;
  turn: number;
  /** Sıranın (bloğun hareketinin) başladığı an; ileride olabilir (hazırlık). */
  turnStart: number;
  /** Sıra süresinin bittiği an (= turnStart + 6 sn). */
  deadline: number;
  /** Hız çarpanı (binde). */
  speed: number;
  /** Kayan bloğun genişliği (= kulenin üst bloğunun genişliği). */
  blockWidth: number;
  /** Kule, alttan üste; ilk eleman taban. */
  tower: KuleBlock[];
  /** Kuleye eklenen başarılı kat sayısı (taban hariç). */
  floors: number;
  need: number;
  startedAt: number;
  endsAt: number;
  timeUp: boolean;
  last: KuleLast | null;
}

/** Kişiye özel görünüm (gizli bilgi yok; yalnız kendi durumun). */
export interface KuleView {
  isOut: boolean;
  myTurn: boolean;
  /** Sıramın gelmesine kaç sıra var (0 = şimdi); çıkmışta ve izleyicide null. */
  turnsAway: number | null;
}
