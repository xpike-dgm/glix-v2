#!/usr/bin/env bash
# Sitenin yazdığı alan anahtarlarını yerine koyar (root, cron her dakika):
#   /srv/glix/uretim/ssh-yetki/<alan>.authorized_keys → /etc/ssh/uretim/uretim-<alan>.authorized_keys (root, 0644)
#   /srv/glix/uretim/ssh-yetki/<alan>.anahtar         → <chroot>/etc/uretim/anahtar (uretim-<alan>, 0400)
# Her satır `restrict ssh-…`/`restrict ecdsa-…` biçiminde olmalı; başka seçenek içeren dosya hiç uygulanmaz.
# Örnek cron: * * * * * /srv/glix/current/deploy/uretim/ssh/eslestir.sh
set -euo pipefail
BURASI="$(cd "$(dirname "$0")" && pwd)"
YETKI="${URETIM_SSH_YETKI:-/srv/glix/uretim/ssh-yetki}"
KOK="${URETIM_SSH_KOK:-/srv/glix/uretim/ssh}"
DESEN='^restrict (ssh-ed25519|ecdsa-sha2-nistp(256|384|521)|ssh-rsa) [A-Za-z0-9+/]+=* uretim-[a-z-]+-[0-9]+$'
while read -r alan; do
  [ -n "$alan" ] || continue
  k="uretim-$alan"
  kaynak="$YETKI/$alan.authorized_keys"
  hedef="/etc/ssh/uretim/$k.authorized_keys"
  if [ -f "$kaynak" ] && [ ! -L "$kaynak" ]; then
    if grep -Evq "$DESEN" "$kaynak"; then
      logger -t uretim-ssh "$alan: geçersiz anahtar satırı, uygulanmadı"
    elif ! cmp -s "$kaynak" "$hedef" 2>/dev/null; then
      install -m 0644 -o root -g root "$kaynak" "$hedef"
    fi
  else
    rm -f "$hedef"
  fi
  akaynak="$YETKI/$alan.anahtar"
  ahedef="$KOK/$alan/etc/uretim/anahtar"
  if [ -f "$akaynak" ] && [ ! -L "$akaynak" ] && grep -Eq "^um_${alan}_[A-Za-z0-9_-]{43}$" "$akaynak"; then
    if ! cmp -s "$akaynak" "$ahedef" 2>/dev/null; then
      install -m 0400 -o "$k" -g root "$akaynak" "$ahedef"
    fi
  else
    rm -f "$ahedef"
  fi
  # Parola: site yalnız SHA-512 crypt özetini yazar (`uretim-<alan>:$6$…`); açık parola diske hiç düşmez.
  pkaynak="$YETKI/$alan.parola"
  pdurum="/var/lib/uretim-ssh/$alan.parola"
  if [ -f "$pkaynak" ] && [ ! -L "$pkaynak" ]; then
    if grep -Eq "^${k}:"'\$6\$[./A-Za-z0-9]{1,16}\$[./A-Za-z0-9]{86}$' "$pkaynak" && [ "$(wc -l < "$pkaynak")" -eq 1 ]; then
      if ! cmp -s "$pkaynak" "$pdurum" 2>/dev/null; then
        chpasswd -e < "$pkaynak"
        install -D -m 0600 -o root -g root "$pkaynak" "$pdurum"
      fi
    else
      logger -t uretim-ssh "$alan: parola dosyası biçime uymuyor, uygulanmadı"
    fi
  fi
done < "$BURASI/alanlar.txt"
