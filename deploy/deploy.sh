#!/usr/bin/env bash
# Sunucuda root olarak çalışır: deploy.sh [git-ref]  (varsayılan: main)
set -euo pipefail

REF="${1:-main}"
REPO_URL="${GLIX_REPO_URL:-https://github.com/xpike-dgm/glix-v2}"
BASE=/srv/glix
MIRROR="$BASE/repo.git"
RELEASES="$BASE/releases"
KEEP=5

mkdir -p "$RELEASES" "$BASE/shared"

if [ ! -d "$MIRROR" ]; then
  git clone --bare "$REPO_URL" "$MIRROR"
fi
git -C "$MIRROR" fetch --prune origin '+refs/heads/*:refs/heads/*'

SHA="$(git -C "$MIRROR" rev-parse --verify "${REF}^{commit}")"
echo "Sürüm: $REF -> $SHA"

RELEASE="$RELEASES/$SHA"
if [ ! -d "$RELEASE" ]; then
  mkdir -p "$RELEASE"
  if ! git -C "$MIRROR" archive "$SHA" | tar -x -C "$RELEASE"; then
    rm -rf "$RELEASE"
    echo "Arşiv açılamadı" >&2
    exit 1
  fi
fi
echo "$SHA" > "$RELEASE/REVISION"

ln -sfn "$RELEASE" "$BASE/current.new"
mv -T "$BASE/current.new" "$BASE/current"

if [ -f "$BASE/shared/.env" ]; then
  cp "$BASE/shared/.env" "$BASE/current/deploy/.env"
fi

COMPOSE=(docker compose -f "$BASE/current/deploy/docker-compose.yml" -p glix)
if [ -f "$BASE/current/deploy/.env" ]; then
  COMPOSE+=(--env-file "$BASE/current/deploy/.env")
fi

GIT_SHA="$SHA" "${COMPOSE[@]}" up -d --build

echo "Sağlık denetimi bekleniyor..."
ok=0
for _ in $(seq 1 45); do
  if curl -fsS http://127.0.0.1:3900/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "Sağlık denetimi başarısız (90 sn). Günlükler:" >&2
  "${COMPOSE[@]}" logs --tail 100 >&2 || true
  exit 1
fi
curl -fsS http://127.0.0.1:3900/health
echo

# En yeni KEEP sürümü tut, eskilerini sil (güncel olan asla silinmez).
CURRENT="$(readlink -f "$BASE/current")"
# shellcheck disable=SC2012
ls -1t "$RELEASES" | tail -n +$((KEEP + 1)) | while read -r old; do
  if [ "$(readlink -f "$RELEASES/$old")" != "$CURRENT" ]; then
    rm -rf "${RELEASES:?}/$old"
  fi
done

echo "Tamam: $SHA"
