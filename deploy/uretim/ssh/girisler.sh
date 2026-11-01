#!/usr/bin/env bash
# Yalnız uretim-* kullanıcılarının SSH giriş denemelerini siteye aktarır (root, cron her dakika):
#   /srv/glix/uretim/ssh-gunluk/girisler.log  →  ISO_ZAMAN|basarili|basarisiz|kullanıcı|yöntem|ip
# Kaynak: journalctl (ssh/sshd birimi), yoksa /var/log/auth.log. Son 5000 satır tutulur. Başka hiçbir satır yazılmaz.
set -euo pipefail
HEDEF="${URETIM_SSH_GUNLUK:-/srv/glix/uretim/ssh-gunluk/girisler.log}"
DURUM_DIR="${URETIM_SSH_DURUM:-/var/lib/uretim-ssh}"
DURUM="$DURUM_DIR/girisler.son"
install -d -m 0755 "$(dirname "$HEDEF")"
install -d -m 0700 "$DURUM_DIR"
SON="$(cat "$DURUM" 2>/dev/null || echo "10 minutes ago")"
SIMDI="$(date -Iseconds)"
if [ -n "${URETIM_SSH_KAYNAK:-}" ]; then
  kaynak() { cat "$URETIM_SSH_KAYNAK"; } # testler
elif command -v journalctl >/dev/null; then
  kaynak() { journalctl -q -o short-iso --since "$SON" _COMM=sshd 2>/dev/null || true; }
else
  kaynak() { tail -n 5000 /var/log/auth.log 2>/dev/null || true; }
fi
# Kalıplar sıkıdır: önek tam (zaman, makine, sshd[pid]), kullanıcı adı yalnız `uretim-[a-z-]+` (boşluk içeremez,
# bu yüzden saldırgan kullanıcı adına " from <IP>" yazarak IP ya da sahte "başarılı" kayıt seçemez), satır
# `port <N> ssh2` ile biter.
ONEK='^([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8})[.0-9]*([+-][0-9:]{4,5}) [A-Za-z0-9._-]+ sshd(-session)?\[[0-9]+\]: '
IP='([0-9]{1,3}(\.[0-9]{1,3}){3}|[0-9a-fA-F:]{2,39})'
kaynak | LC_ALL=C sed -nE \
  -e "s/${ONEK}Accepted (password|publickey) for (uretim-[a-z-]{1,40}) from ${IP} port [0-9]{1,5} ssh2$/\1\2|basarili|\5|\4|\6/p" \
  -e "s/${ONEK}Failed (password|publickey) for (invalid user )?(uretim-[a-z-]{1,40}) from ${IP} port [0-9]{1,5} ssh2$/\1\2|basarisiz|\6|\4|\7/p" \
  >> "$HEDEF"
tail -n 5000 "$HEDEF" > "$HEDEF.tmp" && mv "$HEDEF.tmp" "$HEDEF"
chmod 0644 "$HEDEF"
echo "$SIMDI" > "$DURUM"
