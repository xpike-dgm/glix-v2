#!/usr/bin/env bash
# Üretim Merkezi SSH kanalı kurulumu (root, tekrar çalıştırılabilir). ÇALIŞTIRMADAN ÖNCE README'yi oku.
# Yapar: grup ve alan kullanıcıları, alan başına chroot (/srv/glix/uretim/ssh/<alan>/{gelen,okunur}), chroot içine
# node + sftp-server + `uretim` komut aracı, sshd ayarı. Kullanıcılar şifresiz (yalnız anahtar), kabuksuzdur.
set -euo pipefail
BURASI="$(cd "$(dirname "$0")" && pwd)"
KOK="${URETIM_SSH_KOK:-/srv/glix/uretim/ssh}"
# Site kabının uid/gid'i (Dockerfile `uretim` kullanıcısı): ana makinede kullanılmayan, sabit bir numara. Burada
# `uretim-site` adıyla ayrılır ki ana makinede başka bir kullanıcı bu numarayı almasın.
SITE_GID="${URETIM_SITE_GID:-3910}"
SITE_UID="${URETIM_SITE_UID:-3910}"
# Alan kullanıcılarına ayrılmış uid aralığı (eslestir.sh yalnız bu aralıktaki kullanıcılara parola yazar).
UID_ALT="${URETIM_UID_ALT:-3920}"
UID_UST="${URETIM_UID_UST:-3959}"
KAP="${URETIM_KAP:-uretim-uretim-1}"
SITE_URL="${URETIM_IC_URL:-http://127.0.0.1:3910/mcp}"
SFTP="$(for p in /usr/lib/openssh/sftp-server /usr/libexec/openssh/sftp-server /usr/lib/ssh/sftp-server; do [ -x "$p" ] && echo "$p" && break; done)"
NODE="$(command -v node || true)"
[ "$(id -u)" = 0 ] || { echo "root olarak çalıştır" >&2; exit 1; }
[ -n "$NODE" ] || { echo "sunucuda node yok (chroot'a kopyalanacak)" >&2; exit 1; }
[ -n "$SFTP" ] || { echo "sftp-server bulunamadı" >&2; exit 1; }

getent group uretim-alanlari >/dev/null || groupadd uretim-alanlari
getent group uretim-site >/dev/null || groupadd -g "$SITE_GID" uretim-site
[ "$(getent group uretim-site | cut -d: -f3)" = "$SITE_GID" ] || { echo "uretim-site grubu $SITE_GID değil" >&2; exit 1; }
if ! id uretim-site >/dev/null 2>&1; then
  if getent passwd "$SITE_UID" >/dev/null; then
    echo "uid $SITE_UID ana makinede başka bir kullanıcıda; URETIM_SITE_UID ile kullanılmayan bir numara seç" >&2
    exit 1
  fi
  useradd -r -M -d /nonexistent -s /usr/sbin/nologin -u "$SITE_UID" -g uretim-site uretim-site
fi
[ "$(id -u uretim-site)" = "$SITE_UID" ] || { echo "uretim-site kullanıcısı $SITE_UID değil" >&2; exit 1; }
install -d -m 0755 -o root -g root "$KOK" /etc/ssh/uretim
# Giriş kabuğu: sshd ForceCommand'ı kullanıcının kabuğuyla (`<kabuk> -c <komut>`) çalıştırır. Ana makinede bu yol
# nologin'in kopyasıdır (giriş yok); chroot içinde aynı yolda dash durur ve yalnız ForceCommand'ı çalıştırır.
KABUK=/usr/local/sbin/uretim-kabuk
install -m 0755 -o root -g root "$(command -v nologin || echo /usr/sbin/nologin)" "$KABUK"
DASH="$(readlink -f /bin/sh)"

ARAC="$(mktemp)"
docker cp "$KAP:/app/cli/uretim.js" "$ARAC"

kopyala_bagimli() { # $1 ikili, $2 chroot
  install -D -m 0755 "$1" "$2$1"
  # Kitaplıklar 0644; dinamik yükleyici (ld-linux) çalıştırılabilir olmalı, yoksa chroot'ta node açılmaz.
  ldd "$1" 2>/dev/null | grep -oE '/[^ ]+' | while read -r lib; do
    [ -f "$lib" ] || continue
    case "$lib" in */ld-linux*) install -D -m 0755 "$lib" "$2$lib" ;; *) install -D -m 0644 "$lib" "$2$lib" ;; esac
  done
}

: > /etc/ssh/sshd_config.d/uretim-chroot.conf.inc
sira=0
while read -r alan; do
  [ -n "$alan" ] || continue
  k="uretim-$alan"
  u=$((UID_ALT + sira))
  sira=$((sira + 1))
  [ "$u" -le "$UID_UST" ] || { echo "alan kullanıcıları için uid aralığı doldu" >&2; exit 1; }
  if ! id "$k" >/dev/null 2>&1; then
    if getent passwd "$u" >/dev/null; then echo "uid $u başka bir kullanıcıda" >&2; exit 1; fi
    useradd -M -d / -s "$KABUK" -u "$u" -g uretim-alanlari "$k"
    usermod -p '*' "$k" # yeni kullanıcı parolasız başlar (site parola oluşturunca eslestir.sh yazar)
  fi
  ku="$(id -u "$k")"
  if [ "$ku" -lt "$UID_ALT" ] || [ "$ku" -gt "$UID_UST" ]; then
    echo "$k uid $ku ayrılmış aralıkta ($UID_ALT–$UID_UST) değil; kullanıcıyı elle düzelt" >&2
    exit 1
  fi
  usermod -G "" "$k" # yalnız uretim-alanlari (birincil grup)
  # Var olan parolaya dokunulmaz: kurulum yeniden çalıştırılınca bağlı yapay zekâlar dışarıda kalmasın.
  usermod -s "$KABUK" "$k"
  c="$KOK/$alan"
  install -d -m 0755 -o root -g root "$c" "$c/bin" "$c/etc" "$c/etc/uretim" "$c/dev" "$c/tmp"
  chmod 1777 "$c/tmp"
  [ -e "$c/dev/null" ] || mknod -m 666 "$c/dev/null" c 1 3
  [ -e "$c/dev/urandom" ] || mknod -m 444 "$c/dev/urandom" c 1 9
  kopyala_bagimli "$NODE" "$c"
  # Araç `#!/bin/node` ile başlar; chroot içinde gerçek yola bağlanır.
  [ "$NODE" = /bin/node ] || ln -sfn "$NODE" "$c/bin/node"
  kopyala_bagimli "$SFTP" "$c"
  # Chroot içindeki kabuk (dash) aynı yolda; sftp-server kullanıcıyı chroot'taki passwd'de arar.
  install -D -m 0755 "$DASH" "$c$KABUK"
  kopyala_bagimli "$DASH" "$c"
  printf 'root:x:0:0:root:/:%s\n%s:x:%s:%s::/:%s\n' "$KABUK" "$k" "$ku" "$(getent group uretim-alanlari | cut -d: -f3)" "$KABUK" > "$c/etc/passwd"
  printf 'root:x:0:\nuretim-alanlari:x:%s:\nuretim-site:x:%s:\n' "$(getent group uretim-alanlari | cut -d: -f3)" "$SITE_GID" > "$c/etc/group"
  chmod 0644 "$c/etc/passwd" "$c/etc/group"
  install -m 0755 -o root -g root "$ARAC" "$c/bin/uretim"
  printf '{"url":"%s","anahtar":"/etc/uretim/anahtar"}\n' "$SITE_URL" > "$c/etc/uretim/ayar.json"
  chmod 0644 "$c/etc/uretim/ayar.json"
  # gelen: yapay zekâ yazar, site okuyup siler. okunur: site yazar, yapay zekâ okur.
  install -d -m 2770 -o "$k" -g uretim-site "$c/gelen"
  install -d -m 2775 -o root -g uretim-site "$c/okunur"
  printf 'Match User %s\n\tChrootDirectory %s\n' "$k" "$c" >> /etc/ssh/sshd_config.d/uretim-chroot.conf.inc
done < "$BURASI/alanlar.txt"
rm -f "$ARAC"

install -m 0644 "$BURASI/uretim.conf" /etc/ssh/sshd_config.d/uretim.conf
sshd -t
echo "Kurulum tamam. sshd'yi yeniden yükle: systemctl reload ssh (ya da sshd). Eşitleme için: $BURASI/eslestir.sh (cron her dakika)."
