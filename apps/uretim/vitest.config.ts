import { defineConfig } from "vitest/config";

// Sunucu testleri gerçek SQLite, dosya sistemi ve (varsa) ffmpeg kullanır; yük altında 5 sn varsayılanı dar kalır.
export default defineConfig({
  cacheDir: "node_modules/.vite-cache",
  test: { testTimeout: 60_000, hookTimeout: 60_000, include: ["src/**/*.test.ts", "web/src/**/*.test.ts"] },
});
