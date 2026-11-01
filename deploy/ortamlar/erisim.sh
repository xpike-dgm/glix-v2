#!/usr/bin/env bash
# Test ortamlarına giriş (Caddy basic_auth + giriş çerezi). root olarak:
#   erisim.sh liste                 kullanıcı adlarını listeler (şifre ya da özet basılmaz)
#   erisim.sh ekle <ad>             kullanıcı ekler; şifre /srv/glix/ortam/gizli/sifre-<ad> dosyasına yazılır (0600)
#   erisim.sh sil <ad>              kullanıcıyı siler (o kişinin çerezi de geçersiz olsun istersen: cerez-yenile)
#   erisim.sh cerez-yenile          giriş çerezlerini değiştirir: herkes bir kez yeniden şifre girer
#   erisim.sh yaz                   /srv/glix/ortam/caddy/ortamlar.caddy dosyasını yeniden üretir
# Her değişiklikten sonra Caddy dosyası yeniden üretilir; /etc/caddy/Caddyfile bu dosyayı içe aktarıyorsa Caddy
# doğrulanıp yeniden yüklenir. Hiçbir şifre, özet ya da çerez ekrana basılmaz.
# Ad: küçük harf, rakam ve tire (ör. sahip, ayse, yz-magaza).
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"
shopt -u patsub_replacement 2>/dev/null || true

KULLANICILAR="$GIZLI/erisim-kullanicilar"
CADDY_DIZIN="$ORTAM_KOK/caddy"
CADDY_DOSYA="$CADDY_DIZIN/ortamlar.caddy"
SABLON="$BETIK_DIZIN/Caddyfile.ortamlar"
ANA_CADDY=/etc/caddy/Caddyfile

kok_mu
command -v caddy >/dev/null || hata "caddy bulunamadı."
getent group caddy >/dev/null || hata "caddy grubu yok (Caddy dosyayı okuyamaz)."
install -d -m 0700 "$GIZLI"
umask 077
touch "$KULLANICILAR"

ad_denetle() {
  [[ "${1:-}" =~ ^[a-z0-9][a-z0-9-]{1,30}$ ]] || hata "Geçersiz ad (küçük harf, rakam, tire; 2-31 karakter)."
}

rastgele_hex() {
  openssl rand -hex "$1"
}

cerez_dosyasi() {
  echo "$GIZLI/cerez.$1"
}

cerez_hazirla() {
  local o f
  for o in test test2; do
    f="$(cerez_dosyasi "$o")"
    [ -s "$f" ] || rastgele_hex 32 >"$f"
  done
}

# Caddy 2.8 öncesinde yönerge adı `basicauth`.
basic_auth_adi() {
  local v
  v="$(caddy version 2>/dev/null | grep -o 'v2\.[0-9]*' | head -n1 | cut -d. -f2 || true)"
  if [ -n "$v" ] && [ "$v" -lt 8 ]; then echo basicauth; else echo basic_auth; fi
}

yaz() {
  cerez_hazirla
  [ -s "$KULLANICILAR" ] || hata "Hiç kullanıcı yok; önce: erisim.sh ekle sahip"
  local sablon satirlar="" ad ozet blok cikti="" o port cerez yonerge
  sablon="$(grep -v '^#' "$SABLON")"
  while read -r ad ozet; do
    [ -n "$ad" ] || continue
    satirlar+=$'\t\t\t'"$ad $ozet"$'\n'
  done <"$KULLANICILAR"
  satirlar="${satirlar%$'\n'}"
  yonerge="$(basic_auth_adi)"
  for o in test test2; do
    ortam_sec "$o"
    cerez="$(cat "$(cerez_dosyasi "$o")")"
    [[ "$cerez" =~ ^[0-9a-f]{64}$ ]] || hata "Çerez dosyası bozuk: $(cerez_dosyasi "$o")"
    blok="$sablon"
    blok="${blok//__ALAN__/$o.glix.dgmcraft.online}"
    blok="${blok//__PORT__/$ORTAM_PORT}"
    blok="${blok//__CEREZ__/$cerez}"
    blok="${blok//__BASIC_AUTH__/$yonerge}"
    blok="${blok//__KULLANICILAR__/$satirlar}"
    cikti+="$blok"$'\n'
  done
  install -d -m 0750 -o root -g caddy "$CADDY_DIZIN"
  local gecici="$CADDY_DOSYA.yeni"
  printf '# kur.sh / erisim.sh üretti; elle düzenleme. Gizli değer içerir.\n%s' "$cikti" >"$gecici"
  chown root:caddy "$gecici"
  chmod 0640 "$gecici"
  mv -f "$gecici" "$CADDY_DOSYA"
  echo "Caddy dosyası yazıldı: $CADDY_DOSYA"
  if grep -qs "import $CADDY_DOSYA" "$ANA_CADDY"; then
    caddy validate --config "$ANA_CADDY" --adapter caddyfile >/dev/null 2>&1 || hata "Caddy doğrulaması başarısız: caddy validate --config $ANA_CADDY"
    systemctl reload caddy
    echo "Caddy yeniden yüklendi."
  else
    echo "Not: $ANA_CADDY henüz bu dosyayı içe aktarmıyor (README adım 4)."
  fi
}

ekle() {
  ad_denetle "$1"
  grep -q "^$1 " "$KULLANICILAR" && hata "$1 zaten var."
  local sifre ozet
  sifre="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  # Şifre komut satırına konmaz: caddy hash-password terminal değilse standart girdiden tek satır okur.
  ozet="$(printf '%s\n' "$sifre" | caddy hash-password 2>/dev/null)"
  [[ "$ozet" == \$2* ]] || hata "Şifre özeti üretilemedi."
  printf '%s\n' "$sifre" >"$GIZLI/sifre-$1"
  chmod 0600 "$GIZLI/sifre-$1"
  printf '%s %s\n' "$1" "$ozet" >>"$KULLANICILAR"
  echo "Eklendi: $1 (şifre: $GIZLI/sifre-$1 — kişiye güvenli yoldan ilet, sonra dosyayı silebilirsin)."
  yaz
}

sil() {
  ad_denetle "$1"
  grep -q "^$1 " "$KULLANICILAR" || hata "$1 yok."
  local gecici="$KULLANICILAR.yeni"
  grep -v "^$1 " "$KULLANICILAR" >"$gecici" || true
  mv -f "$gecici" "$KULLANICILAR"
  rm -f "$GIZLI/sifre-$1"
  echo "Silindi: $1. Açık oturumunu da kapatmak için: erisim.sh cerez-yenile"
  yaz
}

case "${1:-}" in
  liste) cut -d' ' -f1 "$KULLANICILAR" ;;
  ekle) ekle "${2:-}" ;;
  sil) sil "${2:-}" ;;
  cerez-yenile)
    rm -f "$(cerez_dosyasi test)" "$(cerez_dosyasi test2)"
    yaz
    ;;
  yaz) yaz ;;
  *) hata "Kullanım: erisim.sh liste | ekle <ad> | sil <ad> | cerez-yenile | yaz" ;;
esac
