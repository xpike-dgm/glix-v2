import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Arayüz `web/` altında; derleme `dist/web`e gider, sunucu oradan sunar. Geliştirmede /api ve /mcp yerel sunucuya.
const hedef = process.env.URETIM_GELISTIRME_SUNUCU ?? "http://127.0.0.1:3910";
export default defineConfig({
  root: resolve(import.meta.dirname, "web"),
  plugins: [solid()],
  cacheDir: resolve(import.meta.dirname, "node_modules/.vite-cache"),
  server: { host: "127.0.0.1", proxy: { "/api": hedef, "/mcp": hedef } },
  build: { outDir: resolve(import.meta.dirname, "dist/web"), emptyOutDir: true, target: "es2022" },
});
