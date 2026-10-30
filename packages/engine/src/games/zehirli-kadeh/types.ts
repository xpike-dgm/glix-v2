/** Zehirli Kadeh — istemci ile sunucu arasındaki sözleşme. Kurallar: docs/KURALLAR.md §22, docs/A6-OYUNLAR.md. */

/** Başlangıç süresi ve her takasın eklediği süre (ms). */
export const ZEHIRLI_KADEH_BASE_MS = 20_000;
export const ZEHIRLI_KADEH_SWAP_BONUS_MS = 5_000;
/** Herkes takas hakkını kullandıysa oyunun bitişine kalan süre (ms). */
export const ZEHIRLI_KADEH_LOCK_GRACE_MS = 1_000;

/** Oyuncu sayısına göre zehirli kadeh sayısı: 2-3 → 1, 4-5 → 2, 6-8 → 3. */
export function zehirliKadehPoisonCount(players: number): number {
  return players <= 3 ? 1 : players <= 5 ? 2 : 3;
}

/**
 * `swap`: elindeki kadehi hedefin kadehiyle değiştir (kişi başı 1, hedef bağlı olmalı).
 * `check`: hedefin o anki kadehini gizlice kontrol et (kişi başı 1; hedefin bağlı olması gerekmez).
 */
export type ZehirliKadehAction = { kind: "swap"; target: string } | { kind: "check"; target: string };

/**
 * Kontrol sonucu: yalnız kontrol edenin kişisel görünümünde. Bilgi kadeh NUMARASINA bağlıdır; kadeh sonra takasla
 * yer değiştirse de doğru kalır. Kimin elindeyken kontrol edildiği bilinçli olarak tutulmaz.
 */
export interface ZehirliKadehCheck {
  cup: number;
  poisoned: boolean;
}

/** Herkese açık takas olayı: kim kiminle takas etti (kadeh içeriği yok). */
export interface ZehirliKadehSwap {
  seq: number;
  from: string;
  to: string;
  /** Sunucu zamanı (ms). */
  at: number;
}

/** Süre bitince açılan sonuç. */
export interface ZehirliKadehResult {
  /** Temiz kadehi olanlar (+1). */
  clean: string[];
  /** Zehirli kadehi olanlar (0). */
  poisoned: string[];
  /** Zehirli kadehlerin numaraları (`holdings` değerleriyle aynı numaralama). */
  poisonedCups: number[];
}

/** Herkese açık görünüm. Zehirli kadehler sonuca kadar hiçbir görünümde yoktur. */
export interface ZehirliKadehPublicView {
  startedAt: number;
  /** Süre bitişi; her takasla 5 sn uzar. */
  endsAt: number;
  players: string[];
  /** Oyuncu kimliği → şu an elindeki kadeh numarası (numara = başlangıçtaki sahibinin sırası). */
  holdings: Record<string, number>;
  /** Takas hakkını kullananlar. */
  swapped: string[];
  /** Takas geçmişi (herkese açık), sırayla. */
  swaps: ZehirliKadehSwap[];
  poisonCount: number;
  ended: boolean;
  result: ZehirliKadehResult | null;
}

/**
 * Kişiye özel görünüm: rol ve (yalnız kendi yaptığın) kontrolün sonucu. Kendi kadehinin durumu hiçbir zaman yoktur.
 * Kontrol hakkını kullanıp kullanmadığın da yalnız burada (yalnız sana) görünür. İzleyicide `check` hep null.
 */
export interface ZehirliKadehView {
  role: "player" | "spectator";
  check: ZehirliKadehCheck | null;
}
