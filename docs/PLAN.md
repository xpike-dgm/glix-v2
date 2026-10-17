# GLIX v2 — Aşamalı Plan

GLIX'in sıfırdan yeniden yazımı. Eski sürüm: `xpike-dgm/glix` (dokunulmaz, kural ve davranış referansı).

## Kanonik kaynaklar

1. **Oyun kuralları:** `docs/KURALLAR.md` (eski repodaki `GLIX-MINIOYUN-KURALLARI-FORMU.md` kopyası)
2. **Davranış referansı:** eski repodaki `packages/shared/src/*.test.ts` senaryoları
3. Bu plan ve `CLAUDE.md`

## Teknoloji

| Alan | Seçim |
|---|---|
| Dil | TypeScript (strict) her yerde |
| Monorepo | pnpm workspaces + Turborepo |
| Lint/format | Biome |
| Test | Vitest, fast-check (bot simülasyonu), Playwright, k6 |
| Sunucu | Node 22 + `ws`, sunucu tek otorite |
| İstemci | SolidJS + PixiJS (oyun sahneleri) + Vite, PWA |
| Kalıcı veri | SQLite (yalnız istatistik) |
| Barındırma | VDS 212.38.88.237, Docker Compose, Caddy önünde |
| Önizleme | `https://glix.212.38.88.237.sslip.io` |

## Mimari ilkesi

Her oyun saf fonksiyonlardan oluşur: `setup / reduce / view / score`.
İstemciye yalnız `view(state, playerId)` çıktısı gider; gizli alanlar `Secret<T>` ile işaretlenir ve
sızıntı testi otomatik kırılır. Sunucu oyun bilmez; durum her yayında bir kez hesaplanır, fark olarak gönderilir.

## Çalışma düzeni

- **Yönetici (Opus):** görev tanımı, arayüz sözleşmesi, inceleme, test, VDS dağıtımı, aşama kapıları.
- **Geliştirici (Sonnet alt ajanları):** kod.
- **Mekanik işler (Haiku alt ajanları):** kelime listeleri, test iskeletleri, dokümanlar.
- VDS'e yalnız yönetici dokunur. `/opt/dgmcraft`, Mailu, together-radio, dgmusic'e dokunulmaz.

## Aşamalar

| Aşama | İçerik | Kapı |
|---|---|---|
| **A0** Hazırlık | Monorepo iskeleti, CI, Docker imajı, VDS'te izole kurulum, Caddy bloğu, deploy betiği | Önizleme adresi HTTPS ile açılıyor, `/health` yanıt veriyor |
| **A1** Dikey kesit | `defineGame` çatısı, oda sunucusu, reconnect, sade istemci çerçevesi, Butona Bas | 3 gerçek telefonla oynanıyor |
| **A2** Sağlamlaştırma | Bot simülasyonu, sızıntı testi, fark protokolü, hız sınırları, Hazırım (sunucu), host kick, k6 | p95 < 50 ms, konteyner < 512 MB |
| **A3** Tasarım sistemi | Token'lar, bileşenler, ana sayfa, lobi, briefing, sonuç, portrait/landscape çerçeve, ses/titreşim | Playwright görüntüleri 320/390/844, Android'de 60 fps |
| **A4** İlk 7 oyun | Butona Bas, Açgözlülük Limiti, Çapraz Ateş, Çağrışım Ağı, Karalama Defteri, Kör Bomba, Zaman Bombası Hafızası | Kural senaryoları + bot testleri yeşil |
| **A5** Kapalı beta | PWA, hata kaydı, istatistik, arkadaş grubuyla oyun gecesi | Kritik hata yok |
| **A6** Kalan 17 oyun | 3–4'lük gruplar | Her grup önizlemede telefon testinden geçer |
| **A7** Canlıya geçiş | `glix.lynrax.com` → yeni sürüm, eski sunucu yedek | — |

## Aşama günlüğü

### A0 — tamamlandı (2026-10-17, `bb2666e`)
- [x] Monorepo iskeleti (pnpm 10, turbo, biome, vitest, TS)
- [x] Sunucu: `/health` (revision dahil), `/ws` merhaba, statik istemci servisi, origin kontrolü
- [x] İstemci: Solid + Pixi "merhaba" sahnesi (Pixi tembel yüklenir)
- [x] Dockerfile + compose (512 MB / 2 CPU, read-only, cap_drop ALL, yalnız 127.0.0.1:3900)
- [x] GitHub Actions CI (ilk koşu yeşil)
- [x] VDS: `glix` kullanıcısı, `/srv/glix/{repo.git,releases,shared,current}`, Caddy bloğu
      (yedek: `/etc/caddy/Caddyfile.pre-glix-v2-20261017T023000Z`), `/srv/glix/deploy.sh`
- [x] Önizleme doğrulandı: HTTPS, `/health`, index, asset önbellek + zstd, 404, ws welcome,
      yabancı origin 403. Konteyner ~14 MB RAM. Diğer siteler etkilenmedi.

### A1 — yayında, telefon testi bekleniyor (2026-10-17)
- [x] Sözleşmeler: `docs/PROTOKOL.md`, `docs/TASARIM.md`, `game.ts`, Butona Bas görünüm tipi
- [x] Motor: protokol ayrıştırıcı, Butona Bas (kural §6, ödüller eski `createRankAwards` ile aynı), kayıt defteri
- [x] Sunucu: oda/maç/yayın modülleri, enjekte edilebilir saat, Hazırım kapısı, host kick, resume,
      host için 20 sn bekleme, yayın birleştirme, hız sınırı
- [x] İstemci: tasarım sistemi + tüm ekranlar, ses, titreşim, yeniden bağlanma örtüsü, dev mock
- [x] `pnpm e2e`: 3 mobil Chromium ile gerçek tam maç (~80 sn)
- [ ] Kapı: 3 gerçek telefonla oyun (kullanıcı)
- Sonraya: sonuç listesinde puan sütunu hizası

### A2 — sürüyor
- [x] Sözleşmeler: `secrets()`, `GameLog`, `patch`/`resync`, `game_failed`/`draining` hata kodları
- [x] `@glix/engine/testing`: bot simülatörü, 8 değişmez (sızıntı dahil), sızıntı meta-testi, replay, fuzz
- [x] Merge-patch senkron: Butona Bas 8 oyuncuda oyuncu başına 827 KB → 166 KB
- [x] Oda bazlı hata izolasyonu + `game_failed` günlüğü (GameLog ile), `/health` metrikleri
- [x] Drain ile kesintisiz güncelleme; deploy.sh önce derler, süren maçları bekler (`--force` ile atlanır)
- [x] Güvenlik incelemesi (kritik/yüksek yok) + sertleştirme: geri basınç, heartbeat, soket/oda/IP sınırları,
      oda kodu tahmin sınırı, 8 KiB mesaj, takma ad karakter filtresi, CSP/çerçeve başlıkları, deploy.sh symlink
      koruması, imaj digest sabitleme; Caddy'de HSTS ve `/health` dışa kapalı
- [x] Yük testi aracı (`pnpm load`); büyük koşular yalnız 127.0.0.1'e açık ayrı test konteynerine (yayın ayarları değişmez)
- [x] Yayın iyileştirmesi (`5c941cf`): oda başına ortak fark, değişmeyen oyuncuya mesaj yok
- [~] Yük testi kapısı (VDS, sunucu konteyneri 2 CPU sınırlı, tek Node iş parçacığı):
      100 oda × 8: p95 32 ms, 100/100 ✔ · 150 oda: p95 66 ms, 150/150 · 200 oda: p95 142 ms, 200/200.
      Darboğaz sunucu ana iş parçacığı (4 ayrı üreteçle de aynı sonuç). Kapasite ≈ 100 eşzamanlı oda (800 oyuncu)
      p95 < 50 ms ile — arkadaş grubu kullanımının çok üstünde; kapı 100 odaya indirildi.
      Sonraki adım (A4 öncesi): görünümü herkese açık + kişiye özel diye ayırmak (ortak kısım oda başına bir kez).
- Açık soru: 100 odalık bir koşuda her odadan bir bot aynı anda koptu; tekrarında (günlük tutularak) görülmedi.
- Not: sslip.io adlarında DNS çözümlemesi zaman zaman 4+ sn sürüyor (sunucu yanıtı 0,02 sn). Gerçek alan adı A7'den önce alınmalı.

### A3 — tamamlandı, telefon doğrulaması bekleniyor (`5c65979`)
- [x] Görünüm ayrımı: `publicView` (oda başına bir kez) + kişiye özel `view`; sızıntı testi ikisini de kapsar
      (VDS 200 oda × 8: p95 142 → 79 ms, 200/200, hata yok; 100 oda kapısı rahat)
- [x] GameFrame (dikey/yatay), yan çevir örtüsü, yer tutucu yatay sahne (`?mock=landscape`), izleyici durumu
- [x] Ses/titreşim olay seti, ana ses düzeyi, iOS ses kilidi; aria-live, odak halkaları, sheet odak tuzağı
- [x] `pnpm ui:check` (114 denetim: taşma/kırpma/hedef/örtüşme/kontrast/konsol) ve `pnpm perf:check`; bkz. `docs/qa/a3/`
- [x] CI'a eklendi: Chromium kurulumu + `ui:check` + `e2e`, ekran görüntüleri artifact (repoya girmez)
- [ ] Gerçek telefonda 60 fps doğrulaması (kullanıcı); 4× CPU yavaşlatmada oyun ekranında ara sıra tek kare takılma kalıyor

**Dağıtım:** VDS'te `/srv/glix/deploy.sh <ref>` (varsayılan `main`). Geri alma: eski SHA ile aynı komut.
