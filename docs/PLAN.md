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

### A0
- [ ] Monorepo iskeleti (pnpm, turbo, biome, vitest, TS)
- [ ] Sunucu: `/health`, `/ws` merhaba, statik istemci servisi
- [ ] İstemci: Solid + Pixi "merhaba" sahnesi
- [ ] Dockerfile + compose (512 MB / 2 CPU limit, yalnız 127.0.0.1)
- [ ] GitHub Actions CI
- [ ] VDS: `glix` kullanıcısı, `/srv/glix`, Caddy bloğu (yedekli), deploy betiği
- [ ] Önizleme adresi doğrulandı
