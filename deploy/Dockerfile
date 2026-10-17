# syntax=docker/dockerfile:1
# İmaj digest ile sabitlenmiştir (docker buildx imagetools inspect node:22-alpine). Güncellemek için digest'i elle değiştir.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
ENV CI=true
WORKDIR /repo
# pnpm sürümü package.json "packageManager" ile aynı olmalı.
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @glix/engine build \
 && corepack pnpm --filter @glix/client build \
 && corepack pnpm --filter @glix/server build
# Üretim bağımlılıklarıyla yalnız sunucu paketi (@glix/engine çalışma alanı bağımlılığı dahil).
RUN corepack pnpm --filter @glix/server deploy --legacy --prod /out/server

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
ARG GIT_SHA=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3900 CLIENT_DIR=/app/client GIT_SHA=${GIT_SHA}
WORKDIR /app/server
COPY --from=build --chown=node:node /out/server/ ./
COPY --from=build --chown=node:node /repo/apps/client/dist /app/client
USER node
EXPOSE 3900
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3900/health >/dev/null || exit 1
CMD ["node", "dist/index.js"]
