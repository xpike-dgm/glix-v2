#!/usr/bin/env bash
# Test ortamlarının kurulumu (root, tekrar çalıştırılabilir): kur.sh
# - Boş belleği ölçer (en az 1,5 GB boş olmalı: iki kap x 512 MB + pay).
# - Klasörler: /srv/glix/ortam/{gizli,kaynak,caddy,betik,test,test2}; veri klasörleri kap kullanıcısına (uid 1000).
# - Betikleri /srv/glix/ortam/betik/ altına kopyalar (cron yolları sürüm silinse de değişmez).
# - Gizli anahtarlar: /srv/glix/ortam/gizli/.env.test ve .env.test2 (0600). Var olan değerler korunur, eksikler
#   üretilir; canlının anahtarları kullanılmaz. Hiçbir değer ekrana basılmaz.
# - Erişim: ilk kurulumda `sahip` kullanıcısı (şifre /srv/glix/ortam/gizli/sifre-sahip) ve Caddy dosyası.
# - test: ana daldaki son sürümü derler ve açar; ilk kurulumda içeriği canlıdan kopyalar, sahte hesapları üretir.
# - test2: test'in imajıyla açılır; ilk kurulumda içerik + sahte hesaplarla sıfırdan kurulur.
# - Sonunda Caddy, DNS ve cron için yapılacakları yazar (bunları kendisi yapmaz).
# /etc/caddy/Caddyfile, crontab, canlı kap ve /srv/glix/shared/.env değiştirilmez.
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"

[ "$#" -eq 0 ] || hata "Bu betik seçenek almaz."
kok_mu
for k in docker git curl flock openssl caddy; do
  command -v "$k" >/dev/null || hata "$k bulunamadı."
done
docker compose version >/dev/null 2>&1 || hata "docker compose bulunamadı."
kilit_al

# --- Bellek -----------------------------------------------------------------------------------------------------
BOS_MB="$(awk '/^MemAvailable:/ { print int($2 / 1024) }' /proc/meminfo)"
echo "Boş bellek: ${BOS_MB} MB"
if ! docker inspect glix-test-glix-1 >/dev/null 2>&1 && [ "$BOS_MB" -lt 1536 ]; then
  hata "Boş bellek 1536 MB'tan az; iki ortam (2 x 512 MB) için yer yok."
fi

# --- Klasörler ----------------------------------------------------------------------------------------------------
install -d -m 0755 "$ORTAM_KOK" "$KAYNAKLAR" "$ORTAM_KOK/betik"
install -d -m 0700 "$GIZLI"
for o in test test2; do
  install -d -m 0755 "$ORTAM_KOK/$o" "$ORTAM_KOK/$o/aktarim"
  # Kap içindeki `node` kullanıcısı (uid/gid 1000) yazar; başka kimse okuyamaz.
  install -d -m 0700 -o 1000 -g 1000 "$ORTAM_KOK/$o/veri"
done

# --- Betikler -----------------------------------------------------------------------------------------------------
if [ "$BETIK_DIZIN" != "$ORTAM_KOK/betik" ]; then
  for f in ortak.sh test-cikar.sh canliya-al.sh icerik-kopyala.sh test2-yenile.sh erisim.sh kur.sh \
    docker-compose.yml Caddyfile.ortamlar README.md; do
    install -m 0755 "$BETIK_DIZIN/$f" "$ORTAM_KOK/betik/$f"
  done
  chmod 0644 "$ORTAM_KOK/betik/"{ortak.sh,docker-compose.yml,Caddyfile.ortamlar,README.md}
  echo "Betikler kopyalandı: $ORTAM_KOK/betik"
fi
B="$ORTAM_KOK/betik"

# --- Gizli anahtarlar ---------------------------------------------------------------------------------------------
umask 077
# env_ekle <dosya> <ad> <değer>: ad yoksa ekler; varsa dokunmaz (tekrar çalıştırılabilir).
env_ekle() {
  grep -q "^$2=" "$1" 2>/dev/null || printf '%s=%s\n' "$2" "$3" >>"$1"
}
for o in test test2; do
  ortam_sec "$o"
  touch "$ORTAM_ENV"
  chmod 0600 "$ORTAM_ENV"
  env_ekle "$ORTAM_ENV" GLIX_ORTAM "$o"
  env_ekle "$ORTAM_ENV" GLIX_ALLOWED_ORIGINS "https://$o.glix.dgmcraft.online"
  env_ekle "$ORTAM_ENV" GLIX_PUBLIC_URL "https://$o.glix.dgmcraft.online"
  env_ekle "$ORTAM_ENV" GLIX_URETIM_TOKEN "$(openssl rand -hex 32)"
  env_ekle "$ORTAM_ENV" GLIX_SAHTE_SIFRE "$(openssl rand -hex 12)"
  # Ortamın kendi model anahtarı: sahip ayrı bir anahtar açarsa buraya yazılır (canlınınki kullanılmaz).
  env_ekle "$ORTAM_ENV" GLIX_AI_KEY ""
  env_ekle "$ORTAM_ENV" GLIX_ADMIN_ACCOUNT_IDS ""
  if [ "$o" = test2 ]; then
    env_ekle "$ORTAM_ENV" GLIX_TASLAK_OYUNLAR "1"
  else
    env_ekle "$ORTAM_ENV" GLIX_TASLAK_OYUNLAR ""
  fi
  [ "$(env_degeri "$ORTAM_ENV" GLIX_ORTAM)" = "$o" ] || hata "$ORTAM_ENV içinde GLIX_ORTAM=$o olmalı."
  canli_anahtar_denetle "$ORTAM_ENV"
done
umask 022
echo "Gizli anahtarlar hazır: $GIZLI/.env.test, $GIZLI/.env.test2 (değerler basılmadı)."

# --- Erişim -------------------------------------------------------------------------------------------------------
if [ ! -s "$GIZLI/erisim-kullanicilar" ]; then
  "$B/erisim.sh" ekle sahip
else
  "$B/erisim.sh" yaz
fi

# --- test ---------------------------------------------------------------------------------------------------------
"$B/test-cikar.sh" main
if [ ! -f "$ORTAM_KOK/test/.icerik-kopyalandi" ]; then
  icerik_kopyala test 0
  date -Is >"$ORTAM_KOK/test/.icerik-kopyalandi"
fi

# --- test2 --------------------------------------------------------------------------------------------------------
if [ ! -f "$ORTAM_KOK/test2/.icerik-kopyalandi" ]; then
  "$B/test2-yenile.sh"
  date -Is >"$ORTAM_KOK/test2/.icerik-kopyalandi"
else
  ortam_sec test2
  [ -n "$(etiket_imaji "$ORTAM_IMAJ")" ] || docker tag "$(etiket_imaji "$IMAJ_ADI:test")" "$ORTAM_IMAJ"
  ortam_compose up -d --no-build
  saglik_bekle "$ORTAM_PORT" || hata "test2 sağlık denetimi başarısız."
fi

cat <<METIN

Kurulum tamam. Kalan adımlar (otomatik yapılmadı):

1. DNS: test.glix.dgmcraft.online ve test2.glix.dgmcraft.online için sunucunun IP'sine A (ve varsa AAAA) kaydı.
2. Caddy: /etc/caddy/Caddyfile sonuna şu satırı ekle, sonra doğrula ve yeniden yükle:
     import $ORTAM_KOK/caddy/ortamlar.caddy
     caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy
3. Giriş: kullanıcı adı "sahip", şifre: cat $GIZLI/sifre-sahip   (davetli eklemek: $B/erisim.sh ekle <ad>)
   Oyunda sahte hesaplar: Zengin, YeniOyuncu, Rozetli — şifre: grep '^GLIX_SAHTE_SIFRE=' $GIZLI/.env.test2
4. Cron önerisi (/etc/cron.d/glix-ortamlar):
     */10 * * * * root $B/test-cikar.sh main >> $ORTAM_KOK/test/cikar.log 2>&1
     23 4 * * * root $B/test2-yenile.sh >> $ORTAM_KOK/test2/yenile.log 2>&1
5. Canlıya alma (yalnız sahip "canlıya al" deyince): $B/canliya-al.sh
METIN
