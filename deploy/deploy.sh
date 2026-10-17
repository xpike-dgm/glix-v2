#!/usr/bin/env bash
# Sunucuda root olarak çalışır: deploy.sh [--force] [git-ref]  (varsayılan: main)
# Çalışan maç varsa bitmesini bekler (10 sn aralıkla, en çok 10 dk); --force beklemeden devam eder.
set -euo pipefail

FORCE=0
REF=main
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*) echo "Geçersiz seçenek/ref: $arg" >&2; exit 2 ;;
    *) REF="$arg" ;;
  esac
done
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
  # Önce geçici dizine aç, doğrula, sonra tek adımda yerine taşı (yarım sürüm kalmaz).
  rm -rf "$RELEASE.tmp"
  mkdir -p "$RELEASE.tmp"
  if ! git -C "$MIRROR" archive "$SHA" | tar --no-same-owner --no-same-permissions -x -C "$RELEASE.tmp"; then
    rm -rf "$RELEASE.tmp"
    echo "Arşiv açılamadı" >&2
    exit 1
  fi
  # Sembolik bağ içeren sürüm reddedilir (root olarak yazarken bağ izleme saldırısını önler).
  if [ -n "$(find "$RELEASE.tmp" -type l -print -quit)" ]; then
    find "$RELEASE.tmp" -type l >&2
    rm -rf "$RELEASE.tmp"
    echo "Sürüm sembolik bağ içeriyor; iptal edildi" >&2
    exit 1
  fi
  mv -T "$RELEASE.tmp" "$RELEASE"
fi
rm -f "$RELEASE/REVISION"
echo "$SHA" > "$RELEASE/REVISION"

ln -sfn "$RELEASE" "$BASE/current.new"
mv -T "$BASE/current.new" "$BASE/current"

if [ -f "$BASE/shared/.env" ]; then
  rm -f "$BASE/current/deploy/.env"
  cp --no-dereference "$BASE/shared/.env" "$BASE/current/deploy/.env"
fi

COMPOSE=(docker compose -f "$BASE/current/deploy/docker-compose.yml" -p glix)
if [ -f "$BASE/current/deploy/.env" ]; then
  COMPOSE+=(--env-file "$BASE/current/deploy/.env")
fi

# İmajı önce derle; böylece maçlar bitince yalnız konteyner değişimi kalır.
GIT_SHA="$SHA" "${COMPOSE[@]}" build

# Çalışan maçları öldürmemek için: /health activeMatches > 0 ise bekle.
active_matches() {
  # 503 (drain) gövdesi de okunur; sunucu yoksa ya da alan yoksa 0.
  local n
  n="$(curl -sS --max-time 5 http://127.0.0.1:3900/health 2>/dev/null | grep -o '"activeMatches":[0-9]*' | head -n1 | cut -d: -f2 || true)"
  echo "${n:-0}"
}

if [ "$FORCE" -ne 1 ]; then
  waited=0
  while :; do
    n="$(active_matches)"
    if [ "$n" -le 0 ]; then
      break
    fi
    if [ "$waited" -ge 600 ]; then
      echo "10 dk beklendi, $n maç hâlâ sürüyor; sunucu drain ile yeniden başlatılacak."
      break
    fi
    echo "Çalışan maç: $n. Bitmesi bekleniyor (${waited}/600 sn)..."
    sleep 10
    waited=$((waited + 10))
  done
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
