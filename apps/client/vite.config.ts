import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";

/** Girişin (statik) bağımlı olduğu parçalar kabuğun parçasıdır: önbelleğe alınmadan çevrimdışı açılış çalışmaz. */
const shellChunks: { url: string; revision: null }[] = [];
function collectShellChunks(): Plugin {
  return {
    name: "glix-shell-chunks",
    apply: "build",
    generateBundle(_, bundle) {
      shellChunks.length = 0;
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
          "favicon.svg",
          "icons/*.png",
          "assets/*.{js,css}",
          "assets/**/*.{png,webp,jpg,svg}",
          "assets/*latin-*.woff2",
        ],
        globIgnores: ["**/chunks/**"],
        additionalManifestEntries: shellChunks,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/ws(\/|$)/, /^\/api\//, /^\/health(\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
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
    proxy: {
      "/ws": { target: "http://localhost:3900", ws: true },
      "/health": "http://localhost:3900",
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
