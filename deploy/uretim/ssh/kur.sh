#!/usr/bin/env bash
# Üretim Merkezi SSH kanalı kurulumu (root, tekrar çalıştırılabilir). ÇALIŞTIRMADAN ÖNCE README'yi oku.
# Yapar: grup ve alan kullanıcıları, alan başına chroot (/srv/glix/uretim/ssh/<alan>/{gelen,okunur}), chroot içine
# node + sftp-server + `uretim` komut aracı, sshd ayarı. Kullanıcılar şifresiz (yalnız anahtar), kabuksuzdur.
set -euo pipefail
BURASI="$(cd "$(dirname "$0")" && pwd)"
KOK="${URETIM_SSH_KOK:-/srv/glix/uretim/ssh}"
SITE_GID="${URETIM_SITE_GID:-3910}"
KAP="${URETIM_KAP:-uretim-uretim-1}"
SITE_URL="${URETIM_IC_URL:-http://127.0.0.1:3910/mcp}"
SFTP="$(for p in /usr/lib/openssh/sftp-server /usr/libexec/openssh/sftp-server /usr/lib/ssh/sftp-server; do [ -x "$p" ] && echo "$p" && break; done)"
NODE="$(command -v node || true)"
[ "$(id -u)" = 0 ] || { echo "root olarak çalıştır" >&2; exit 1; }
[ -n "$NODE" ] || { echo "sunucuda node yok (chroot'a kopyalanacak)" >&2; exit 1; }
[ -n "$SFTP" ] || { echo "sftp-server bulunamadı" >&2; exit 1; }

getent group uretim-alanlari >/dev/null || groupadd uretim-alanlari
getent group uretim-site >/dev/null || groupadd -g "$SITE_GID" uretim-site
install -d -m 0755 -o root -g root "$KOK" /etc/ssh/uretim

ARAC="$(mktemp)"
docker cp "$KAP:/app/cli/uretim.js" "$ARAC"

kopyala_bagimli() { # $1 ikili, $2 chroot
  install -D -m 0755 "$1" "$2$1"
  ldd "$1" 2>/dev/null | grep -oE '/[^ ]+' | while read -r lib; do [ -f "$lib" ] && install -D -m 0644 "$lib" "$2$lib"; done
}

: > /etc/ssh/sshd_config.d/uretim-chroot.conf.inc
while read -r alan; do
  [ -n "$alan" ] || continue
  k="uretim-$alan"
  id "$k" >/dev/null 2>&1 || useradd -M -d / -s /usr/sbin/nologin -g uretim-alanlari "$k"
  usermod -p '*' "$k" # şifre yok
  c="$KOK/$alan"
  install -d -m 0755 -o root -g root "$c" "$c/bin" "$c/etc" "$c/etc/uretim" "$c/dev" "$c/tmp"
  chmod 1777 "$c/tmp"
  [ -e "$c/dev/null" ] || mknod -m 666 "$c/dev/null" c 1 3
  [ -e "$c/dev/urandom" ] || mknod -m 444 "$c/dev/urandom" c 1 9
  kopyala_bagimli "$NODE" "$c"
  # Araç `#!/bin/node` ile başlar; chroot içinde gerçek yola bağlanır.
  [ "$NODE" = /bin/node ] || ln -sfn "$NODE" "$c/bin/node"
  kopyala_bagimli "$SFTP" "$c"
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
