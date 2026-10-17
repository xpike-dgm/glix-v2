# Dağıtım

Önizleme: https://glix.212.38.88.237.sslip.io (Caddy -> 127.0.0.1:3900 -> Docker).

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

- `Dockerfile`, `docker-compose.yml` — imaj ve çalışma sınırları (512 MB, 2 CPU, salt okunur).
- `.env.example` — `/srv/glix/shared/.env` için örnek (`GLIX_ALLOWED_ORIGINS`).
- `Caddyfile.glix` — Caddy'ye eklenecek blok.
- `deploy.sh` — sunucu dağıtım betiği.

## Geri alma

Eski bir sürüme dönmek için: `/srv/glix/deploy.sh <eski-sha>`.
