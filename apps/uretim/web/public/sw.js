/* Üretim Merkezi hizmet çalışanı: bildirimler ve kabuğun çevrimdışı açılışı. API yanıtları ve taslak dosyalar asla
 * önbelleğe alınmaz. Bildirimde gizli bilgi yoktur (sunucu yalnız genel başlık ve sayılar yollar). */
const KABUK = "uretim-kabuk-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(KABUK)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/simge.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) => Promise.all(k.filter((x) => x !== KABUK).map((x) => caches.delete(x))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/mcp") return;
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(KABUK).then(async (c) => {
        const var_ = await c.match(e.request);
        if (var_) return var_;
        const r = await fetch(e.request);
        if (r.ok) c.put(e.request, r.clone());
        return r;
      }),
    );
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const kopya = r.clone();
          caches.open(KABUK).then((c) => c.put("/", kopya));
          return r;
        })
        .catch(() => caches.match("/")),
    );
  }
});

self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = {};
  }
  const baslik = typeof d.title === "string" && d.title ? d.title : "Üretim Merkezi";
  const url = typeof d.url === "string" && /^\/(?!\/)/.test(d.url) ? d.url : "/";
  e.waitUntil(
    self.registration.showNotification(baslik, {
      body: typeof d.body === "string" ? d.body : "",
      tag: typeof d.tag === "string" ? d.tag : "uretim",
      data: { url },
      icon: "/simge-192.png",
      badge: "/simge-192.png",
      lang: "tr",
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hedef =
    e.notification.data && typeof e.notification.data.url === "string" ? e.notification.data.url : "/";
  e.waitUntil(
    (async () => {
      const w = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const acik = w.find((x) => new URL(x.url).origin === self.location.origin);
      if (acik) {
        await acik.focus();
        if ("navigate" in acik) await acik.navigate(hedef).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(hedef);
    })(),
  );
});
