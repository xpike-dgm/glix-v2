/**
 * Yakınlaştırmayı kapatır. Android `user-scalable=no` görünüm ayarına uyar; iOS Safari onu yok saydığı için iki
 * parmakla sıkıştırma (`gesture*` olayları ve çok parmaklı `touchmove`) burada engellenir. Çift dokunarak
 * yakınlaştırmayı kökteki `touch-action: manipulation` kapatır. Oyunlarda çok parmaklı hareket kullanılmaz.
 */
export function installNoZoom(doc: EventTarget = document): void {
  const block = (e: Event): void => e.preventDefault();
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) doc.addEventListener(type, block);
  doc.addEventListener(
    "touchmove",
    (e: Event) => {
      if ((e as TouchEvent).touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}
