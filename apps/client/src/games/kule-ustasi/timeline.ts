import { KULE_PAUSE_MISS_MS, KULE_WARN_MS } from "@glix/engine";

/**
 * Kule Ustası ekran zaman çizelgesi (tek yer). Hepsi bırakışın sunucu anına (`last.at`) ya da sıranın
 * başlangıcına (`turnStart`) göre ms; istemci zamanlayıcıları `atServerTime` ile sunucu saatine bağlanır.
 * Oyun kuralını değiştirmez: sonuç dokunulan ana göre sunucuda hesaplanır, bunlar yalnız gösteridir.
 */
export const KULE_FX = {
  /** Kanca açılınca bloğun bir kat aşağı düşüp oturması (KU-U1). */
  dropFall: 200,
  /** Oturma tozu ve "tak" (düşüş bitince). */
  landDust: 420,
  /** Kesilen parçanın dönerek düşüp ekrandan çıkması (KU-U5). */
  cutFall: 1000,
  /** "KUSURSUZ!" damgası ve altın dalga. */
  stamp: 900,
  /** Yıkılış: üstten alta her katın savrulma aralığı ve tek katın düşüşü (KU-U6). */
  collapseStep: 70,
  collapseFall: 900,
  /** Yeni taban vinçle iner ("Yeni kule!"): ıska arasının sonu, uyarıdan önce. */
  newBaseAt: KULE_PAUSE_MISS_MS - 700,
  newBase: 700,
  /** "Sıra sende!" bandı ve kancanın yeni blokla inişi = sunucu uyarı payı. */
  warn: KULE_WARN_MS,
  /** Sıra süresinin son kısmı: halka kırmızı, tik hızlanır, blok titrer (KU-U3). */
  urgent: 2_000,
  /** Toplam sürenin son kısmı: sayaç kırmızı ve büyük. */
  clockUrgent: 10_000,
  /** Sonucun yeniden bağlanmada hâlâ gösterilmeye değer sayıldığı süre. */
  fresh: 1_100,
} as const;

/** Son 2 saniyedeki tik anları (sıra bitişinden geriye, ms): giderek sıklaşır. */
export const KULE_URGENT_TICKS = [2_000, 1_500, 1_100, 800, 550, 350, 180] as const;

/** Ekranda görünen kule katı (taban dahil, KU-U2) ve kayan bloğun üstündeki kanca/halka payı (kat). */
export const KULE_VISIBLE_ROWS = 14;
export const KULE_HOOK_ROWS = 3.2;
