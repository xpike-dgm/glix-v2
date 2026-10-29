import { defineConfig } from "vitest/config";

// Paralel çalışan paketler ortak önbellek klasörünü silip çakışmasın diye paket içinde tutulur.
// Test zaman aşımı: sunucu testleri gerçek WebSocket/SQLite ve `sync` (adım başına >= 30 ms gerçek bekleme)
// kullanır. Boş makinede en yavaşı birkaç sn sürer; makine 3-5 kat aşırı yüklüyken (başka bir tam test koşusu, UI
// denetimi) vitest'in 5 sn varsayılanı rastgele testleri düşürüyordu (hepsi "Test timed out in 5000ms"). Sınır
// yalnızca takılmayı yakalar; doğrulamalar aynıdır ve beklemeler koşul/olay tabanlıdır.
export default defineConfig({
  cacheDir: "node_modules/.vite-cache",
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
