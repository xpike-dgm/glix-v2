#!/usr/bin/env bash
# Görsel referansları (sözleşme bölüm 10): oyunun canlı varlıklarını her görsel alanın chroot'undaki
# `okunur/referans/<klasör>/` altına salt okunur kopyalar (root, cron saatlik ve her canlıya alıştan sonra).
#   Kaynak: /srv/glix/current/apps/client/public/assets/<klasör>   Eşleme: referanslar.txt (`alan klasör...`)
# Yalnız düz görsel/JSON dosyaları (webp, png, svg, json; ≤ 5 MB) kopyalanır; sembolik bağ izlenmez. Kopya önce
# geçici klasörde hazırlanır, sonra eskisinin yerine konur. Dosyalar root'a ait, 0644; yapay zekâ yalnız okur.
# Örnek cron: 17 * * * * /srv/glix/current/deploy/uretim/ssh/referans.sh
set -euo pipefail
umask 022
BURASI="$(cd "$(dirname "$0")" && pwd)"
KAYNAK="${URETIM_REFERANS_KAYNAK:-/srv/glix/current/apps/client/public/assets}"
KOK="${URETIM_SSH_KOK:-/srv/glix/uretim/ssh}"
LISTE="${URETIM_REFERANS_LISTE:-$BURASI/referanslar.txt}"

[ -d "$KAYNAK" ] || { echo "referans kaynağı yok: $KAYNAK" >&2; exit 1; }
while read -r alan klasorler; do
  [[ "${alan:-}" =~ ^[a-z][a-z-]{0,30}$ ]] || continue
  okunur="$KOK/$alan/okunur"
  [ -d "$okunur" ] && [ ! -L "$okunur" ] || continue
  yeni="$(mktemp -d "$okunur/.referans.XXXXXX")"
  for k in $klasorler; do
    [[ "$k" =~ ^[a-z0-9-]{1,40}$ ]] || continue
    kaynak="$KAYNAK/$k"
    [ -d "$kaynak" ] && [ ! -L "$kaynak" ] || continue
    (cd "$kaynak" && find . -type f \( -name '*.webp' -o -name '*.png' -o -name '*.svg' -o -name '*.json' \) \
      -size -5M -print0) |
      while IFS= read -r -d '' f; do
        [[ "$f" =~ ^\./[A-Za-z0-9._/-]+$ ]] || continue
        install -D -m 0644 "$kaynak/$f" "$yeni/$k/${f#./}"
      done
  done
  chmod -R u=rwX,go=rX "$yeni"
  [ "$(id -u)" = 0 ] && chown -R root:root "$yeni"
  hedef="$okunur/referans"
  eski="$okunur/.referans.eski.$$"
  [ -e "$hedef" ] && mv -T "$hedef" "$eski"
  mv -T "$yeni" "$hedef"
  rm -rf "$eski"
done <"$LISTE"
