#!/usr/bin/env bash
# Onay ortamına (test.glix.dgmcraft.online) çıkarır: test-cikar.sh [git-ref]  (varsayılan: main)
# Ref'i tam SHA'ya çevirir, kaynağı /srv/glix/ortam/kaynak/<sha> altına açar, imajı derler (glix-v2:sha-<sha>),
# glix-v2:test olarak etiketler ve test kabını yeniden kurar. Test zaten bu sürümdeyse hiçbir şey yapmaz (cron ile
# her 10 dakikada çalıştırılabilir). Sağlık denetimi başarısızsa önceki imaja döner.
# Canlıya ve deploy.sh'ın /srv/glix/releases, /srv/glix/current düzenine dokunmaz.
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"

REF=main
for arg in "$@"; do
  case "$arg" in
    -*) hata "Geçersiz seçenek: $arg" ;;
    *) REF="$arg" ;;
  esac
done

kok_mu
kilit_al
ortam_sec test

ayna_guncelle
SHA="$(git -C "$MIRROR" rev-parse --verify "${REF}^{commit}")"
echo "Test sürümü: $REF -> $SHA"

if [ "$(saglik_surumu "$ORTAM_PORT")" = "$SHA" ] && [ "$(kap_imaji "$ORTAM_KAP")" = "$(etiket_imaji "$ORTAM_IMAJ")" ]; then
  echo "Test zaten bu sürümde."
  exit 0
fi

KAYNAK="$KAYNAKLAR/$SHA"
mkdir -p "$KAYNAKLAR"
surum_ac "$SHA" "$KAYNAK"

SHA_ETIKET="$IMAJ_ADI:sha-$SHA"
if [ -z "$(etiket_imaji "$SHA_ETIKET")" ]; then
  echo "İmaj derleniyor..."
  DOCKER_BUILDKIT=1 docker build -f "$KAYNAK/deploy/Dockerfile" --build-arg GIT_SHA="$SHA" -t "$SHA_ETIKET" "$KAYNAK"
fi

ONCEKI="$(etiket_imaji "$ORTAM_IMAJ")"
docker tag "$SHA_ETIKET" "$ORTAM_IMAJ"
ortam_compose up -d --no-build --force-recreate

echo "Sağlık denetimi bekleniyor..."
if ! saglik_bekle "$ORTAM_PORT" "$SHA"; then
  echo "Sağlık denetimi başarısız (90 sn). Günlükler:" >&2
  ortam_compose logs --tail 100 >&2 || true
  if [ -n "$ONCEKI" ]; then
    echo "Önceki imaja dönülüyor..." >&2
    docker tag "$ONCEKI" "$ORTAM_IMAJ"
    ortam_compose up -d --no-build --force-recreate || true
    saglik_bekle "$ORTAM_PORT" || echo "Önceki imaj da sağlıklı açılmadı." >&2
  fi
  exit 1
fi
curl -fsS "http://127.0.0.1:$ORTAM_PORT/health"
echo

# Eski kaynakları (son 3) ve kullanılmayan sha etiketlerini (son 5) temizle; kullanılan imaj silinmez.
# shellcheck disable=SC2012
ls -1t "$KAYNAKLAR" | tail -n +4 | while read -r eski; do
  [ "$eski" = "$SHA" ] || rm -rf "${KAYNAKLAR:?}/$eski"
done
docker image ls --format '{{.Repository}}:{{.Tag}}' "$IMAJ_ADI" | grep ':sha-' | tail -n +6 | while read -r etiket; do
  docker rmi "$etiket" >/dev/null 2>&1 || true
done

echo "Tamam: test $SHA"
