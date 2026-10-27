import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";
import { ART_PATTERN, buildAssetManifest, fileRevision } from "./assetManifest.mjs";

/** Girişin (statik) bağımlı olduğu parçalar kabuğun parçasıdır: önbelleğe alınmadan çevrimdışı açılış çalışmaz. */
const shellChunks: { url: string; revision: string | null }[] = [];
/**
 * Ağsız da görünmesi gereken maskotlar kabukta: bağlantı örtüsü ("baglanti-koptu") ve ilk açılış
 * "Hazırlanıyor" ekranı ("yukleniyor"). Revizyon görselin içerik özetidir; görsel değişince kendiliğinden yenilenir.
 */
const SHELL_ART = ["/assets/mascot/baglanti-koptu.webp", "/assets/mascot/yukleniyor.webp"] as const;
let publicDir = "";
/** Çalışma anı `glix-art` önbelleğinin (CacheFirst) ve indirme bildiriminin ortak kuralı. */
const artMatch = ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }): boolean =>
  sameOrigin && ART_PATTERN.test(url.pathname);

/**
 * `asset-manifest.json`: istemcinin önceden indirdiği görsellerin yol/boyut/özet listesi. Kabuktaki (precache)
 * görseller listede yoktur. Kabuk dosyası değildir: her seferinde ağdan okunur, böylece yeni sürüm fark edilir.
 */
function emitAssetManifest(): Plugin {
  return {
    name: "glix-asset-manifest",
    apply: "build",
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle() {
      const manifest = buildAssetManifest(publicDir, SHELL_ART);
      this.emitFile({ type: "asset", fileName: "asset-manifest.json", source: JSON.stringify(manifest) });
    },
  };
}

function collectShellChunks(): Plugin {
  return {
    name: "glix-shell-chunks",
    apply: "build",
    generateBundle(_, bundle) {
      shellChunks.length = 0;
      for (const art of SHELL_ART)
        shellChunks.push({ url: art.slice(1), revision: fileRevision(publicDir, art) });
      const seen = new Set<string>();
      const visit = (name: string): void => {
        const chunk = bundle[name];
        if (chunk?.type !== "chunk" || seen.has(name)) return;
        seen.add(name);
        for (const dep of chunk.imports) visit(dep);
      };
      for (const [name, item] of Object.entries(bundle))
        if (item.type === "chunk" && item.isEntry) visit(name);
      for (const name of seen) if (name.includes("/chunks/")) shellChunks.push({ url: name, revision: null });
    },
  };
}

export default defineConfig({
  plugins: [
    solid(),
    emitAssetManifest(),
    collectShellChunks(),
    VitePWA({
      // Kayıt kodu bizde (src/pwa/pwa.ts); manifest public/manifest.webmanifest dosyasında.
      registerType: "prompt",
      injectRegister: false,
      manifest: false,
      includeAssets: [],
      workbox: {
        // Kabuk: giriş betiği/stili, yazı tipleri (yalnız latin + latin-ext), görseller, simgeler.
        // Tembel oyun ve Pixi parçaları assets/chunks altındadır; ilk ziyarette çalışma anında önbelleğe alınır.
        globPatterns: [
          "index.html",
          "manifest.webmanifest",
          "icons/*.png",
          "assets/*.{js,css}",
          "assets/**/*.{png,webp,jpg,svg}",
          "assets/*latin-*.woff2",
        ],
        // Ruh hâli, maskot, rozet ve oyun nesnesi ve dünya arka planı görselleri kabuğa girmez; ilk kullanımda çalışma anında önbelleğe alınır.
        globIgnores: [
          "**/chunks/**",
          "**/assets/avatars/moods/**",
          "**/assets/mascot/**",
          "**/assets/badges/**",
          "**/assets/props/**",
          "**/assets/worlds/**",
          "**/assets/cards/**",
          "**/assets/briefing/**",
          // Paylaşım kartı (≈260 KB) yalnız tarayıcıların/sosyal ağların indirdiği bir dosyadır; kabuğa girmez.
          "**/assets/brand/paylasim.jpg",
          // iOS açılış görselleri (iki MB'a kadar) kabuğa girmez; iOS bunları kendisi indirir.
          "splash/**",
        ],
        additionalManifestEntries: shellChunks,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/ws(\/|$)/, /^\/api\//, /^\/health(\/|$)/],
        // Web bildirimleri: `push` ve `notificationclick` işleyicileri public/sw-push.js içinde; oluşturulan sw.js
        // bunu başta `importScripts` ile yükler. Tarayıcı içe aktarılan betikleri de güncelleme denetimine katar
        // (bayt değişirse yeni sürüm "bekliyor" olur ve mevcut güncelleme akışı — pwa.ts — aynen çalışır).
        // Dosya kabuğa (precache) alınmaz: hizmet çalışanı kendi betik önbelleğinde tutar, sunucu "no-cache" verir.
        importScripts: ["sw-push.js"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: artMatch,
            handler: "CacheFirst",
            options: {
              // Süre/adet sınırı (ExpirationPlugin) bilerek yok: küme sabit ve sınırlı (≈16 MB) ve içeriği
              // `pwa/contentPack.ts` yönetir (değişeni yeniler, listeden düşeni siler). Sınır olsaydı Workbox
              // ön indirilen dosyaları sessizce silebilir, 90 gün sonra çevrimdışı görseller kaybolurdu.
              cacheName: "glix-art",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/chunks/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "glix-chunks",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    // `scripts/ui-check.mjs`: yalnız denetimde modüller tarayıcı önbelleğinden gelsin (her yenilemede yeniden doğrulanmasın).
    ...(process.env.GLIX_UI_CHECK ? { headers: { "Cache-Control": "max-age=3600" } } : {}),
    proxy: {
      "/ws": { target: "http://localhost:3900", ws: true },
      "/health": "http://localhost:3900",
      "/api": "http://localhost:3900",
    },
  },
  // Pixi tembel yüklenir; geliştirme sunucusu ilk açılışta yeniden paketleyip sayfayı yenilemesin.
  optimizeDeps: { include: ["pixi.js"] },
  build: {
    target: "es2022",
    rollupOptions: {
      // Tembel parçalar ayrı klasörde: hizmet çalışanı kabuğu (giriş) ile bunları ayırt eder.
      output: { chunkFileNames: "assets/chunks/[name]-[hash].js" },
    },
  },
});
