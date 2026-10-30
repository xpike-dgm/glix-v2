# GLIX v2 — Çalışma kuralları

Türkçe, telefon odaklı, gerçek zamanlı parti oyunu. Plan: `docs/PLAN.md`. Oyun kuralları: `docs/KURALLAR.md` (kanonik; UI kural icat etmez).

## Yapı

```
apps/client     SolidJS + PixiJS + Vite (PWA)
apps/server     Node 22 + ws; sunucu tek otorite
packages/engine Oyun çatısı (defineGame), protokol tipleri, oyunlar
deploy/         Dockerfile, compose, Caddy bloğu, deploy betiği
```

## Komutlar

```
pnpm install
pnpm check       # biome lint + format kontrolü
pnpm typecheck
pnpm test
pnpm build
```

Bir değişiklik bu dördü yeşil olmadan bitmiş sayılmaz.

## Kurallar

- TypeScript strict; `any` yok. Ağdan gelen her veri doğrulanır.
- Gizli bilgi yalnız `view(state, playerId)` üzerinden ve yalnız hak sahibine gider.
- Oyuncuya teknik metin gösterilmez (debug, protocol, server, stage vb.). Arayüz metinleri Türkçe.
- Dosya/klasör adları aşama numarası taşımaz (`stage7` gibi adlar yasak); oyun veya işlev adını taşır.
- Her oyun `packages/engine/src/games/<oyun-id>/` altında: kural, görünüm ve testleriyle birlikte.
- Yeni bağımlılık eklemeden önce gerekçe yazılır; mümkünse eklenmez.

## Görsel üretimi (ChatGPT) — her zaman bu akış

Yeni görseli sahip ChatGPT ile üretir; ChatGPT'nin VDS'e erişimi vardır. Yönetici (Claude):
1. VDS'te `/srv/glix/gorsel/<GOREV-ADI>.md` görev dosyası yazar: ne üretilecek, tarifler, referanslar, kayıt yeri
   (`/srv/glix/gorsel/gelen/<gorev-adi>/`), sınırlar, öncelik sırası, kontrol ve `TAMAM` dosyası. Örnek:
   `MAGAZA-2.md`, `OYUN-GELISTIRME-1.md`. Tarifler ve referans görseller
   `/srv/glix/gorsel/referans/<gorev-adi>/` altına konur (canlı imajdan `docker cp` ya da repodan).
2. Sahibe ChatGPT'ye yapıştıracağı kısa bir istem verir. İstemde mutlaka: VDS'e **SSH ile** bağlanacağı, SSH
   bağlantısının adının **`dgmcraft_agent_root`** olduğu, önce `/srv/glix/gorsel/OKU-BENI.md` sonra görev dosyasını
   okuyacağı.
3. Görseller `gelen/` altına gelince kontrol eder, WebP'ye çevirir, `apps/client/public/assets/...` yerine koyar.
Sahibe "görseli kendin üret, tarifi kopyala-yapıştır yap" denmez; iş görev dosyası + tek istemle yürür.
