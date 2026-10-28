/** Aynı görseli iki kez istemeyen, çözülmüş halini sıcak tutan ortak önden yükleme. */
const warm = new Map<string, HTMLImageElement>();
/** Bellekte tutulan görsel sayısı üst sınırı; aşılınca en eski bırakılır (tarayıcı önbelleğinde kalır). */
const MAX_KEPT = 160;

/**
 * Görseli indirir ve çözer (decode). `low`: şu an görünen ekranın görselleriyle yarışmasın diye düşük öncelik.
 * Daha sonra aynı adres bir `<img>`le istenirse tarayıcı isteği kendiliğinden yükseltir.
 */
export function warmImage(src: string, low = false): void {
  if (typeof Image === "undefined" || warm.has(src)) return;
  const img = new Image();
  img.decoding = "async";
  if (low) img.fetchPriority = "low";
  img.src = src;
  warm.set(src, img);
  if (warm.size > MAX_KEPT) {
    const oldest = warm.keys().next().value;
    if (oldest !== undefined) warm.delete(oldest);
  }
  // Çözme hatası (404, bozuk dosya) sessizce geçilir: ekrandaki <img> kendi yedeğine düşer.
  img.decode().catch(() => undefined);
}
