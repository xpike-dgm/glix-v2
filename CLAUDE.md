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
