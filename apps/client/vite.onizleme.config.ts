import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.js";

/**
 * Üretim Merkezi önizleme sayfası (`onizleme.html`, UM-U4) AYRI derlenir: oyunun paket parçalanmasını ve hizmet
 * çalışanı kabuğunu hiç etkilemez (ortak parça yok). Çıktı aynı `dist`'e, `assets/onizleme/` altına yazılır; ana
 * derlemeden SONRA çalışır (`pnpm build`), bu yüzden hizmet çalışanının ön önbelleğine girmez (ayrıca `globIgnores`).
 */
export default defineConfig(async (env) => {
  const resolved = typeof base === "function" ? await base(env) : base;
  const plugins = (resolved.plugins ?? []).flat(5).filter((p) => {
    const name = p && typeof p === "object" && "name" in p ? String(p.name) : "";
    return !name.startsWith("vite-plugin-pwa") && !name.startsWith("glix-");
  });
  const merged = mergeConfig(
    { ...resolved, plugins, publicDir: false },
    {
      build: {
        outDir: resolve(import.meta.dirname, "dist"),
        emptyOutDir: false,
        copyPublicDir: false,
      },
    },
  );
  merged.build.rollupOptions = {
    input: { onizleme: resolve(import.meta.dirname, "onizleme.html") },
    output: {
      entryFileNames: "assets/onizleme/[name]-[hash].js",
      chunkFileNames: "assets/onizleme/[name]-[hash].js",
      assetFileNames: "assets/onizleme/[name]-[hash][extname]",
    },
  };
  return merged;
});
