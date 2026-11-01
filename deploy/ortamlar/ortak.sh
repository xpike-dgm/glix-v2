# shellcheck shell=bash
# Ortam betiklerinin ortak parçaları (test-cikar.sh, canliya-al.sh, icerik-kopyala.sh, test2-yenile.sh, kur.sh).
# Doğrudan çalıştırılmaz; `source` edilir. Sağlık denetimi ve maç sayımı deploy.sh ile aynı mantıktadır
# (deploy.sh'a dokunmamak için buraya kopyalandı; değişirse ikisi birlikte güncellenir).

BASE=/srv/glix
ORTAM_KOK="$BASE/ortam"
GIZLI="$ORTAM_KOK/gizli"
KAYNAKLAR="$ORTAM_KOK/kaynak"
MIRROR="$BASE/repo.git"
REPO_URL="${GLIX_REPO_URL:-https://github.com/xpike-dgm/glix-v2}"
BETIK_DIZIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORTAM_COMPOSE="$BETIK_DIZIN/docker-compose.yml"
# Yalnız test2: Üretim Merkezi'nin iç ağdan ulaştığı ortak ağ (docker-compose.oyun-alani.yml).
ORTAM_COMPOSE_OYUN_ALANI="$BETIK_DIZIN/docker-compose.oyun-alani.yml"
OYUN_ALANI_AG=glix-oyun-alani
IMAJ_ADI=glix-v2
CANLI_PORT=3900
CANLI_KAP=glix-glix-1
CANLI_PROJE=glix
# Sağlık denetimi: deploy.sh gibi 45 x 2 sn.
SAGLIK_DENEME=45

hata() {
  echo "HATA: $*" >&2
  exit 1
}

kok_mu() {
  [ "$(id -u)" -eq 0 ] || hata "root olarak çalıştır."
}

# Aynı anda tek ortam işlemi (imaj etiketleri ve kaplar ortak).
# Kilidi tutan betiğin çağırdığı betikler (kur.sh → test-cikar.sh) yeniden kilitlemez.
kilit_al() {
  [ "${GLIX_ORTAM_KILITLI:-}" = "$$" ] && return 0
  if [ -n "${GLIX_ORTAM_KILITLI:-}" ] && kill -0 "$GLIX_ORTAM_KILITLI" 2>/dev/null; then
    return 0
  fi
  mkdir -p "$ORTAM_KOK"
  exec 9>"$ORTAM_KOK/.kilit"
  flock -n 9 || hata "Başka bir ortam işlemi sürüyor; bitince yeniden dene."
  export GLIX_ORTAM_KILITLI="$$"
}

# ortam_sec test|test2 → ORTAM, ORTAM_PORT, ORTAM_PROJE, ORTAM_KAP, ORTAM_ENV, ORTAM_VERI, ORTAM_IMAJ
ortam_sec() {
  case "${1:-}" in
    test) ORTAM=test; ORTAM_PORT=3901 ;;
    test2) ORTAM=test2; ORTAM_PORT=3902 ;;
    *) hata "Ortam test ya da test2 olmalı (verilen: ${1:-boş})." ;;
  esac
  ORTAM_PROJE="glix-$ORTAM"
  ORTAM_KAP="glix-$ORTAM-glix-1"
  ORTAM_ENV="$GIZLI/.env.$ORTAM"
  ORTAM_VERI="$ORTAM_KOK/$ORTAM/veri"
  ORTAM_IMAJ="$IMAJ_ADI:$ORTAM"
}

# Canlının gizli değerleri test ortamlarında kullanılamaz (UM-O7): aynı değer bulunursa durur, değeri basmaz.
CANLI_ENV="$BASE/shared/.env"
GIZLI_ADLAR=(GLIX_AI_KEY GLIX_URETIM_TOKEN GLIX_RESEND_API_KEY GLIX_VAPID_PRIVATE GLIX_GOOGLE_CLIENT_SECRET GLIX_SAHTE_SIFRE)
canli_anahtar_denetle() {
  [ -f "$CANLI_ENV" ] || return 0
  local ad deger canli
  for ad in "${GIZLI_ADLAR[@]}"; do
    deger="$(env_degeri "$1" "$ad")"
    canli="$(env_degeri "$CANLI_ENV" "$ad")"
    if [ -n "$deger" ] && [ "$deger" = "$canli" ]; then
      hata "$1 içindeki $ad canlıyla aynı; test ortamı kendi anahtarını kullanmalı."
    fi
  done
  # Dışarıya giden servislerin anahtarları test ortamlarına hiç yazılmaz (sunucu zaten okumaz).
  for ad in GLIX_RESEND_API_KEY GLIX_VAPID_PRIVATE GLIX_GOOGLE_CLIENT_SECRET; do
    [ -z "$(env_degeri "$1" "$ad")" ] || hata "$1 içinde $ad olmamalı (test ortamlarında kapalı)."
  done
}

# Üretim Merkezi ↔ test2 ağı yoksa kurar (tekrar çalıştırılabilir).
oyun_alani_agi() {
  docker network inspect "$OYUN_ALANI_AG" >/dev/null 2>&1 || docker network create "$OYUN_ALANI_AG" >/dev/null
}

ortam_compose() {
  [ -f "$ORTAM_ENV" ] || hata "$ORTAM_ENV yok; önce kur.sh çalıştır."
  canli_anahtar_denetle "$ORTAM_ENV"
  local ek=()
  if [ "$ORTAM" = test2 ]; then
    oyun_alani_agi
    ek=(-f "$ORTAM_COMPOSE_OYUN_ALANI")
  fi
  ORTAM_IMAJ="$ORTAM_IMAJ" ORTAM_PORT="$ORTAM_PORT" ORTAM_VERI="$ORTAM_VERI" \
    docker compose -f "$ORTAM_COMPOSE" "${ek[@]}" -p "$ORTAM_PROJE" --env-file "$ORTAM_ENV" "$@"
}

# .env dosyasından tek değer (dosya `source` edilmez: elle eklenen değerlerde kabuk karakterleri olabilir).
env_degeri() {
  grep -m1 "^$2=" "$1" 2>/dev/null | cut -d= -f2- || true
}

# Kabın çalıştırdığı imajın kimliği (sha256:...); kap yoksa boş.
kap_imaji() {
  docker inspect --format '{{.Image}}' "$1" 2>/dev/null || true
}

# Etiketin imaj kimliği; yoksa boş.
etiket_imaji() {
  docker image inspect --format '{{.Id}}' "$1" 2>/dev/null || true
}

# /health'ten tek sayı alanı (503 drain gövdesi de okunur; sunucu yoksa 0). deploy.sh active_matches ile aynı.
saglik_alani() {
  local n
  n="$(curl -sS --max-time 5 "http://127.0.0.1:$1/health" 2>/dev/null | grep -o "\"$2\":[0-9]*" | head -n1 | cut -d: -f2 || true)"
  echo "${n:-0}"
}

saglik_surumu() {
  curl -sS --max-time 5 "http://127.0.0.1:$1/health" 2>/dev/null | grep -o '"revision":"[^"]*"' | head -n1 | cut -d'"' -f4 || true
}

# saglik_bekle <port> [beklenen-sha]: deploy.sh gibi en çok 90 sn; sha verilirse /health revision'ı da eşleşmeli.
saglik_bekle() {
  local port="$1" sha="${2:-}"
  for _ in $(seq 1 "$SAGLIK_DENEME"); do
    if curl -fsS --max-time 5 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
      if [ -z "$sha" ] || [ "$(saglik_surumu "$port")" = "$sha" ]; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

# Ayna: deploy.sh ile aynı /srv/glix/repo.git (ikisi de yalnız fetch eder).
ayna_guncelle() {
  if [ ! -d "$MIRROR" ]; then
    git clone --bare "$REPO_URL" "$MIRROR"
  fi
  git -C "$MIRROR" fetch --prune origin '+refs/heads/*:refs/heads/*'
}

# surum_ac <sha> <hedef-dizin>: deploy.sh ile aynı güvenli açma (geçici dizin, sembolik bağ reddi, tek adımda taşı).
surum_ac() {
  local sha="$1" hedef="$2"
  if [ ! -d "$hedef" ]; then
    rm -rf "$hedef.tmp"
    mkdir -p "$hedef.tmp"
    if ! git -C "$MIRROR" archive "$sha" | tar --no-same-owner --no-same-permissions -x -C "$hedef.tmp"; then
      rm -rf "$hedef.tmp"
      hata "Arşiv açılamadı"
    fi
    if [ -n "$(find "$hedef.tmp" -type l -print -quit)" ]; then
      find "$hedef.tmp" -type l >&2
      rm -rf "$hedef.tmp"
      hata "Sürüm sembolik bağ içeriyor; iptal edildi"
    fi
    mv -T "$hedef.tmp" "$hedef"
  fi
  rm -f "$hedef/REVISION"
  echo "$sha" >"$hedef/REVISION"
}

# icerik_kopyala <test|test2> <sifirla:0|1>: canlıdan yalnız içerik tablolarını alır, hedefi durdurur, içe aktarır,
# sahte hesapları yeniden üretir ve hedefi yeniden başlatır. Hangi tabloların kopyalandığı
# apps/server/src/ortamIcerikDisa.ts içindeki izin listesindedir (README "Kopyalanan tablolar").
icerik_kopyala() {
  ortam_sec "$1"
  local sifirla="$2"
  local imaj
  imaj="$(etiket_imaji "$ORTAM_IMAJ")"
  [ -n "$imaj" ] || hata "$ORTAM_IMAJ imajı yok; önce test-cikar.sh çalıştır."
  docker inspect "$CANLI_KAP" >/dev/null 2>&1 || hata "Canlı kap ($CANLI_KAP) bulunamadı."

  local aktarim="$ORTAM_KOK/$ORTAM/aktarim"
  install -d -m 0755 "$aktarim"
  local disa="$aktarim/icerik-disa.mjs" paket="$aktarim/icerik.json"
  rm -f "$disa" "$paket"

  # Dışa aktarma betiği hedefin imajından alınır; canlı kapta salt okunur çalışır (canlının imajı eski olabilir).
  docker run --rm --network none --entrypoint cat "$imaj" /app/server/dist/ortamIcerikDisa.js >"$disa"
  echo "Canlıdan içerik alınıyor..."
  docker exec -i -e GLIX_ICERIK_DISA=1 "$CANLI_KAP" node --no-warnings --input-type=module - <"$disa" >"$paket"
  [ -s "$paket" ] || hata "İçerik paketi boş geldi."
  chmod 0644 "$paket"

  local args=(--icerik /icerik.json --sahte-hesaplar)
  [ "$sifirla" = "1" ] && args+=(--sifirla)

  local sahte
  sahte="$(env_degeri "$ORTAM_ENV" GLIX_SAHTE_SIFRE)"
  [ -n "$sahte" ] || hata "$ORTAM_ENV içinde GLIX_SAHTE_SIFRE yok; kur.sh'ı yeniden çalıştır."

  echo "$ORTAM durduruluyor (odalar kapanır)..."
  ortam_compose stop -t 30 glix >/dev/null 2>&1 || true

  # Şifre komut satırına yazılmaz: değişken ortamdan aktarılır (`-e AD` değeri çağıranın ortamından alır).
  local ok=1
  GLIX_SAHTE_SIFRE="$sahte" docker run --rm --network none --user node --read-only --tmpfs /tmp \
    -e GLIX_ORTAM="$ORTAM" -e STATS_DB=/data/glix.db -e GLIX_SAHTE_SIFRE \
    -v "$ORTAM_VERI:/data" -v "$paket:/icerik.json:ro" \
    "$imaj" node dist/ortamYenile.js "${args[@]}" || ok=0
  rm -f "$disa" "$paket"
  if [ "$ok" -ne 1 ]; then
    # İçe aktarma tek işlemdir: yarıda kalmaz. Ortam eski veriyle yeniden açılır.
    ortam_compose up -d --no-build >/dev/null 2>&1 || true
    hata "İçe aktarma başarısız; $ORTAM eski verisiyle yeniden açıldı."
  fi

  ortam_compose up -d --no-build --force-recreate
  saglik_bekle "$ORTAM_PORT" || {
    ortam_compose logs --tail 100 >&2 || true
    hata "$ORTAM sağlık denetimi başarısız (90 sn)."
  }
  echo "$ORTAM hazır."
}
