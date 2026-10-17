# A3 başarım ölçümü

Komut: `pnpm perf:check [home|playing|final]` (CI'da koşmaz; gürültülü). Ortam: Chromium (SwiftShader, yani
**yazılım** GL), CDP `Emulation.setCPUThrottlingRate` = 4, 390x844 mobil görünüm, DPR 3, 5 sn, Vite geliştirme
sunucusu (mock sayfaları yalnız orada; derlenmemiş kod olduğundan gerçek üretim paketinden daha ağırdır).
`PERF_CPU_RATE`, `PERF_DPR` ortam değişkenleriyle değiştirilebilir.

Hedef: ortalama >= 55 fps, p95 kare <= 20 ms, yüklemeden sonra > 50 ms uzun görev yok.

| Sahne | Önce (ort. fps / p95) | Sonra (ort. fps / p95) | Uzun görev |
|---|---|---|---|
| Ana sayfa (Pixi zemin) | 60,0 / 16,7 ms | 60,0 / 16,7 ms | 0 |
| Oyun (Butona Bas, 150 ms'de bir basış) | 23,9 / 100 ms | 56,6–57,5 / 16,8–33 ms | 0–1 (tek, ~50 ms) |
| Final (konfeti, ilk 2,2 sn dahil) | 59,6 / 16,8 ms (1 uzun görev) | 59,6–60,0 / 16,7 ms | 0 |

Üç tekrarın aralığı verilmiştir; oyun sahnesi ortalamada hedefin üstünde, ancak yazılım GL'de ara sıra tek bir
33–67 ms'lik kare (p95 bazen 33 ms) ve nadiren tek bir ~50 ms görev görülür. Gerçek telefon GPU'sunda ölçülmedi.

## Yapılan iyileştirmeler

- **Arcade buton (asıl darboğaz):** büyük bulanık `box-shadow`lar her karede yeniden boyanıyordu (`box-shadow: none`
  denemesi 50 → 60 fps). Çözüm: `.arcade`, kubbe (`.arcade__cap`) ve yan kenar (`.arcade__side`) kendi birleştirici
  katmanında (`will-change: transform`); basınca parlama `filter: brightness` yerine beyaz örtünün opaklığı.
- **Halka dalgaları:** 1,5x yerine 1,32x'te sönüyor, aynı anda en çok iki halka (CSS). `will-change` denendi, yeni
  katman maliyeti yüzünden daha kötü çıktı; bırakıldı.
- **Pixi:** zemin ve konfetide çözünürlük `min(DPR, 1,5)` (önce 2); az çekirdekli / az belekli cihazlarda
  parçacıklar 34 → 20, konfeti 130 → 80. Sekme gizliyken zemin durur (önceden vardı); Pixi yalnız gerektiğinde yüklenir.
- Ana JS (gzip) ≈ 31,5 kB (hedef < 120 kB).
