import { defineConfig } from "vitest/config";

export default defineConfig({ cacheDir: "node_modules/.vite-cache", test: { environment: "node" } });
