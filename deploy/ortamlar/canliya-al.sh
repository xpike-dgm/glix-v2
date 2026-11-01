#!/usr/bin/env bash
# Test'te çalışan imajın AYNISINI canlıya taşır (yeniden derleme yok; UM-O6): canliya-al.sh
# 1. Test kabının imaj kimliğini ve sürümünü (SHA) okur.
# 2. Canlıda aktif maç ya da oyuncu varsa durur ve sayıları söyler (kimse oynamıyorken yeniden dene).
# 3. Sürümü deploy.sh gibi /srv/glix/releases/<sha> altına açar, /srv/glix/current'ı ona bağlar, shared/.env'i kopyalar.
# 4. İmajı glix-v2:latest olarak etiketler ve canlı kabı derlemeden yeniden kurar (deploy.sh'ın compose dosyasıyla).
# 5. Sağlık denetimi (deploy.sh gibi 90 sn) + canlının imaj kimliği test'inkiyle aynı mı. Değilse önceki imaja ve
#    önceki sürüm bağına döner.
# Sonraki bir `deploy.sh` yine kaynaktan derler; geri almak için: `deploy.sh <eski-sha>` ya da bu betiğin döndüğü
# `glix-v2:canli-onceki` etiketi (README "Geri alma").
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"

[ "$#" -eq 0 ] || hata "Bu betik seçenek almaz."
kok_mu
kilit_al
ortam_sec test

TEST_IMAJ="$(kap_imaji "$ORTAM_KAP")"
[ -n "$TEST_IMAJ" ] || hata "Test kabı ($ORTAM_KAP) çalışmıyor."
SHA="$(saglik_surumu "$ORTAM_PORT")"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || hata "Test'in sürümü okunamadı (test sağlıklı mı?)."
echo "Test'teki sürüm: $SHA"
echo "Test'teki imaj:  $TEST_IMAJ"

oyuncu_denetle() {
  local maclar oyuncular
  maclar="$(saglik_alani "$CANLI_PORT" activeMatches)"
  oyuncular="$(saglik_alani "$CANLI_PORT" players)"
  if [ "$maclar" -gt 0 ] || [ "$oyuncular" -gt 0 ]; then
    echo "Canlıda şu an $maclar maç ve $oyuncular oyuncu var. Canlıya alma durduruldu; kimse oynamıyorken yeniden dene."
    exit 3
  fi
}

ONCEKI_IMAJ="$(kap_imaji "$CANLI_KAP")"
if [ "$ONCEKI_IMAJ" = "$TEST_IMAJ" ]; then
  echo "Canlı zaten test'teki imajla çalışıyor."
  exit 0
fi
oyuncu_denetle

ayna_guncelle
RELEASE="$BASE/releases/$SHA"
mkdir -p "$BASE/releases" "$BASE/shared"
surum_ac "$SHA" "$RELEASE"
ONCEKI_SURUM="$(readlink -f "$BASE/current" || true)"

canli_compose() {
  local c=(docker compose -f "$BASE/current/deploy/docker-compose.yml" -p "$CANLI_PROJE")
  [ -f "$BASE/current/deploy/.env" ] && c+=(--env-file "$BASE/current/deploy/.env")
  "${c[@]}" "$@"
}

bagla() {
  ln -sfn "$1" "$BASE/current.new"
  mv -T "$BASE/current.new" "$BASE/current"
  if [ -f "$BASE/shared/.env" ]; then
    rm -f "$BASE/current/deploy/.env"
    cp --no-dereference "$BASE/shared/.env" "$BASE/current/deploy/.env"
  fi
}

# Değiştirmeden hemen önce bir daha bak (bu arada maç başlamış olabilir).
oyuncu_denetle
[ -n "$ONCEKI_IMAJ" ] && docker tag "$ONCEKI_IMAJ" "$IMAJ_ADI:canli-onceki"
docker tag "$TEST_IMAJ" "$IMAJ_ADI:latest"
bagla "$RELEASE"
canli_compose up -d --no-build --force-recreate

echo "Sağlık denetimi bekleniyor..."
if saglik_bekle "$CANLI_PORT" "$SHA" && [ "$(kap_imaji "$CANLI_KAP")" = "$TEST_IMAJ" ]; then
  curl -fsS "http://127.0.0.1:$CANLI_PORT/health"
  echo
  echo "Tamam: canlı = test ($SHA, $TEST_IMAJ)"
  exit 0
fi

echo "Canlı sağlıklı açılmadı ya da imaj eşleşmedi. Günlükler:" >&2
canli_compose logs --tail 100 >&2 || true
if [ -n "$ONCEKI_IMAJ" ]; then
  echo "Önceki imaja dönülüyor..." >&2
  docker tag "$ONCEKI_IMAJ" "$IMAJ_ADI:latest"
  [ -n "$ONCEKI_SURUM" ] && [ -d "$ONCEKI_SURUM" ] && bagla "$ONCEKI_SURUM"
  canli_compose up -d --no-build --force-recreate || true
  if saglik_bekle "$CANLI_PORT"; then
    echo "Canlı önceki imajla yeniden açıldı." >&2
  else
    echo "Önceki imaj da sağlıklı açılmadı; deploy.sh <eski-sha> ile geri al." >&2
  fi
fi
exit 1
