import { defineConfig } from "vitest/config";

// Paralel çalışan paketler ortak önbellek klasörünü silip çakışmasın diye paket içinde tutulur.
export default defineConfig({ cacheDir: "node_modules/.vite-cache" });
