# syntax=docker/dockerfile:1
# Üretim Merkezi (apps/uretim). Oyunla aynı taban imaj (digest sabit). Görsel/ses işleme için ffmpeg, katalog aynasını
# okumak için git kurulur; ikisi de yalnız bu kaba girer, oyun imajını etkilemez.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
ENV CI=true
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@10.34.7 --activate
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    corepack pnpm install --frozen-lockfile
RUN corepack pnpm --filter @glix/engine build \
 && corepack pnpm --filter @glix/uretim build
RUN corepack pnpm --filter @glix/uretim deploy --legacy --prod /out/uretim

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
ARG GIT_SHA=dev
RUN apk add --no-cache ffmpeg git
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3910 GIT_SHA=${GIT_SHA} \
    URETIM_DB=/veri/uretim.db URETIM_DEPO_DIR=/depo URETIM_AKTARIM_DIR=/aktarim URETIM_REPO_DIR=/repo.git \
    URETIM_YEDEK_DIR=/yedek URETIM_SSH_YETKI_DIR=/ssh-yetki URETIM_SSH_KOK=/ssh URETIM_WEB_DIR=/app/web TRUST_PROXY=1
WORKDIR /app/uretim
COPY --from=build --chown=node:node /out/uretim/ ./
COPY --from=build --chown=node:node /repo/apps/uretim/dist/web /app/web
# SSH komut aracı: kurulum betiği bunu kaptan alıp her alanın chroot'una kopyalar (ssh/kur.sh).
COPY --from=build --chown=node:node /repo/apps/uretim/dist/cli/uretim.js /app/cli/uretim.js
RUN mkdir -p /veri /depo /aktarim /yedek /ssh-yetki /ssh && chown node:node /veri /depo /aktarim /yedek /ssh-yetki
USER node
EXPOSE 3910
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3910/saglik >/dev/null || exit 1
CMD ["node", "dist/index.js"]
