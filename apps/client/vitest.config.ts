import { defineConfig } from "vitest/config";

// Testler Solid'in tarayıcı (reaktif) derlemesiyle çalışır: Node koşulunda `solid-js` sunucu derlemesine çözülür ve
// orada sinyaller/memo'lar güncellenmez; ekran geçişi gibi reaktif davranışlar ancak tarayıcı derlemesiyle sınanır.
export default defineConfig({
  cacheDir: "node_modules/.vite-cache",
  ssr: { resolve: { conditions: ["browser"], externalConditions: ["browser"] } },
  test: { environment: "node" },
});
