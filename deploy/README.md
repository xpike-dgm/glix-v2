# Dağıtım

Önizleme: https://glix.dgmcraft.online (Caddy -> 127.0.0.1:3900 -> Docker).

## Akış

1. Değişiklik `main`'e girer (CI: check, typecheck, test, build, docker build).
2. Sunucuda root olarak: `/srv/glix/deploy.sh [git-ref]` (varsayılan `main`).
3. Betik `/srv/glix/repo.git` aynasını günceller, ref'i tam SHA'ya çevirir, `git archive` ile
   `/srv/glix/releases/<sha>` altına açar ve `REVISION` dosyasını yazar.
4. `/srv/glix/current` bu sürüme bağlanır; `/srv/glix/shared/.env` varsa `current/deploy/.env` olarak kopyalanır.
5. `docker compose -p glix up -d --build` çalışır (SHA, `GIT_SHA` build arg olarak imaja girer).
6. `http://127.0.0.1:3900/health` en fazla 90 sn beklenir; başarısızsa günlükler basılır ve betik hata ile çıkar.
7. En yeni 5 sürüm tutulur, eskiler silinir.

## Dosyalar

- `Dockerfile`, `docker-compose.yml` — imaj, çalışma sınırları (512 MB, 2 CPU, salt okunur) ve `glix-data` birimi.
- `.env.example` — `/srv/glix/shared/.env` için örnek (`GLIX_ALLOWED_ORIGINS`).
- `Caddyfile.glix` — Caddy'ye eklenecek blok.
- `deploy.sh` — sunucu dağıtım betiği.

## İstatistik ve geri bildirim

- Anonim istatistik (maç/oyun sayıları, süreler, final geri bildirimi) SQLite dosyasına yazılır: `STATS_DB=/data/glix.db`.
  Takma ad, kimlik, IP, belirteç, cevap ya da çizim saklanmaz; 90 günden eski satırlar açılışta ve günlük silinir.
- `/data`, `glix-data` adlı Docker birimidir (konteyner başka yerde salt okunurdur). Dockerfile `/data`'yı `node` kullanıcısına
  verir; birim ilk oluşturulduğunda bu sahipliği devralır. Birim `docker compose down` ile silinmez; `down -v` siler.
- Özet (son 30 gün, Türkçe): `docker exec glix-glix-1 node dist/stats.js`
- Yedek: `docker run --rm -v glix_glix-data:/data -v "$PWD":/b alpine tar czf /b/glix-data.tgz -C /data .`
- İstemci hataları `POST /api/client-error` ile gelir ve günlükte `client_error` olarak görünür
  (`docker logs glix-glix-1 | grep client_error`). IP yazılmaz.
- Node 22'de `node:sqlite` deneysel uyarısı sunucuda yükleme anında bastırılır; `dist/stats.js` aynı şekilde sessizdir.
- Sorun olursa `stats_error` günlüğü görünür; istatistik hataları maçı etkilemez, veritabanı açılamazsa sunucu istatistiksiz başlar.

## Geri alma

Eski bir sürüme dönmek için: `/srv/glix/deploy.sh <eski-sha>`.
