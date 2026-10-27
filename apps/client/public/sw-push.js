/* Web bildirimleri: hizmet çalışanına `importScripts` ile eklenir (vite.config.ts, workbox.importScripts).
 * Sunucu yalnız genel bir başlık, "Oda KOD" gövdesi ve oda etiketi yollar; gizli bilgi asla. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "GLIX";
  const body = typeof data.body === "string" ? data.body : "";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : "glix";
  // Davet bildirimi tıklanınca açılacak adres: yalnız bu sitenin kendi yolu ("/..." ve "//" değil).
  const url = typeof data.url === "string" && /^\/(?!\/)/.test(data.url) ? data.url : "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      // Aynı oda için eski bildirim değişir ama yine de uyarır.
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "tr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Uygulama açıksa öne getirilir (oturum kendiliğinden odaya döner); değilse açılır, kayıtlı oturum odayı geri getirir.
      const open = windows.find((w) => {
        const url = new URL(w.url);
        return url.origin === self.location.origin && !url.pathname.startsWith("/tv");
      });
      if (open) {
        await open.focus();
        // Davet: açık uygulama odanın katılma ekranına gider (oyun bildirimlerinde adres yoktur, sayfa olduğu gibi kalır).
        if (target && "navigate" in open) await open.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target || "/");
    })(),
  );
});
