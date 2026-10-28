import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import base from "./vite.config.js";

/**
 * Başarım ölçümü için üretim paketi + mock ekranlar: `scripts/perf-check.mjs` bunu çalıştırır.
 * Normal yapı gibi küçültülmüş/parçalanmış çıkar; farkı yalnız `import.meta.env.DEV`in açık olması (mock sayfaları)
 * ve hizmet çalışanının olmamasıdır (önbellek ölçümü tarayıcı HTTP önbelleğiyle yapılır). Dağıtıma girmez.
 */
export default defineConfig(async (env) => {
  const resolved = typeof base === "function" ? await base(env) : base;
  const plugins = (resolved.plugins ?? []).flat(5).filter((p) => {
    const name = p && typeof p === "object" && "name" in p ? String(p.name) : "";
    return !name.startsWith("vite-plugin-pwa") && !name.startsWith("glix-");
  });
  return mergeConfig(
    { ...resolved, plugins },
    {
      define: { "import.meta.env.DEV": "true" },
      build: { outDir: resolve(import.meta.dirname, "dist-perf"), emptyOutDir: true },
    },
  );
});
