# GLIX v2

Telefonla oynanan, gerçek zamanlı Türkçe parti oyunu. Plan: `docs/PLAN.md`, kurallar: `CLAUDE.md`.

## Geliştirme

```
corepack enable
pnpm install
pnpm dev        # sunucu :3900, istemci :5173
pnpm check && pnpm typecheck && pnpm test && pnpm build
```

## Yapı

- `apps/client` — SolidJS + PixiJS istemci
- `apps/server` — Node 22 + ws sunucu
- `packages/engine` — oyun çatısı ve protokol tipleri
- `deploy/` — Docker, compose, Caddy, deploy betiği
