# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
ENV CI=true
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @glix/engine build \
 && corepack pnpm --filter @glix/client build \
 && corepack pnpm --filter @glix/server build
# Üretim bağımlılıklarıyla yalnız sunucu paketi (@glix/engine çalışma alanı bağımlılığı dahil).
RUN corepack pnpm --filter @glix/server deploy --legacy --prod /out/server

FROM node:22-alpine AS runtime
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
