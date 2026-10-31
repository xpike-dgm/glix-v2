#!/usr/bin/env bash
# Yalnız uretim-* kullanıcılarının SSH giriş denemelerini siteye aktarır (root, cron her dakika):
#   /srv/glix/uretim/ssh-gunluk/girisler.log  →  ISO_ZAMAN|basarili|basarisiz|kullanıcı|yöntem|ip
# Kaynak: journalctl (ssh/sshd birimi), yoksa /var/log/auth.log. Son 5000 satır tutulur. Başka hiçbir satır yazılmaz.
set -euo pipefail
HEDEF="${URETIM_SSH_GUNLUK:-/srv/glix/uretim/ssh-gunluk/girisler.log}"
DURUM=/var/lib/uretim-ssh/girisler.son
install -d -m 0755 "$(dirname "$HEDEF")"
install -d -m 0700 /var/lib/uretim-ssh
SON="$(cat "$DURUM" 2>/dev/null || echo "10 minutes ago")"
SIMDI="$(date -Iseconds)"
if command -v journalctl >/dev/null; then
  kaynak() { journalctl -q -o short-iso --since "$SON" _COMM=sshd 2>/dev/null || true; }
else
  kaynak() { tail -n 5000 /var/log/auth.log 2>/dev/null || true; }
fi
kaynak | sed -nE \
  -e 's/^([0-9T:+-]+)[^ ]* .*sshd.*: Accepted (password|publickey) for (uretim-[a-z-]+) from ([0-9a-fA-F:.]+) .*/\1|basarili|\3|\2|\4/p' \
  -e 's/^([0-9T:+-]+)[^ ]* .*sshd.*: Failed (password|publickey) for (invalid user )?(uretim-[a-z-]+) from ([0-9a-fA-F:.]+) .*/\1|basarisiz|\4|\2|\5/p' \
  >> "$HEDEF"
tail -n 5000 "$HEDEF" > "$HEDEF.tmp" && mv "$HEDEF.tmp" "$HEDEF"
chmod 0644 "$HEDEF"
echo "$SIMDI" > "$DURUM"
