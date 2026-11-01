#!/usr/bin/env bash
# Sitenin yazdığı alan dosyalarını yerine koyar (root, cron her dakika):
#   ssh-yetki/<alan>.authorized_keys → /etc/ssh/uretim/uretim-<alan>.authorized_keys (root, 0644)
#   ssh-yetki/<alan>.anahtar         → <chroot>/etc/uretim/anahtar (uretim-<alan>, 0400)
#   ssh-yetki/<alan>.parola          → `chpasswd -e` (yalnız uretim-<alan>)
# Kaynak klasör site kabına yazılabilir; bu yüzden oradaki hiçbir şeye güvenilmez:
# - Kullanıcı adı dosyadan ASLA alınmaz; betik `uretim-<alan>` adını kendisi kurar ve kullanıcının önceden var olan,
#   `uretim-alanlari` grubunda, ayrılmış uid aralığında bir alan kullanıcısı olduğunu denetler.
# - Dosya sembolik bağsa, düz dosya değilse, sert bağı varsa, sahibi site değilse ya da izni beklenenden genişse
#   okunmaz. Okuma `dd iflag=nofollow` ile root'a ait özel bir geçici klasöre yapılır (bağ takip edilmez, boyut
#   sınırlı); okumadan önceki ve sonraki kimlik (aygıt:inode) aynı değilse dosya bırakılır.
# - Doğrulama geçici kopyada yapılır; hedefe atomik `mv` ile konur (denetim ile yerleştirme arasında yarış yok).
# Örnek cron: * * * * * /srv/glix/current/deploy/uretim/ssh/eslestir.sh
set -euo pipefail
umask 077
BURASI="$(cd "$(dirname "$0")" && pwd)"
YETKI="${URETIM_SSH_YETKI:-/srv/glix/uretim/ssh-yetki}"
KOK="${URETIM_SSH_KOK:-/srv/glix/uretim/ssh}"
ETC="${URETIM_SSH_ETC:-/etc/ssh/uretim}"
DURUM="${URETIM_SSH_DURUM:-/var/lib/uretim-ssh}"
ALANLAR="${URETIM_SSH_ALANLAR:-$BURASI/alanlar.txt}"
# Site kabının uid'i (Dockerfile: 3910) ve alan kullanıcılarına ayrılmış uid aralığı (kur.sh: 3920–3959).
SITE_UID="${URETIM_SITE_UID:-3910}"
UID_ALT="${URETIM_UID_ALT:-3920}"
UID_UST="${URETIM_UID_UST:-3959}"
GRUP=uretim-alanlari
DESEN='^restrict (ssh-ed25519|ecdsa-sha2-nistp(256|384|521)|ssh-rsa) [A-Za-z0-9+/]+=* uretim-[a-z-]+-[0-9]+$'
OZET_DESENI='^\$6\$[./A-Za-z0-9]{1,16}\$[./A-Za-z0-9]{86}$'

kayit() { logger -t uretim-ssh "$*" 2>/dev/null || true; }

[ -d "$YETKI" ] && [ ! -L "$YETKI" ] || exit 0
install -d -m 0700 "$DURUM"
GECICI="$(mktemp -d "$DURUM/.eslestir.XXXXXX")"
trap 'rm -rf "$GECICI"' EXIT

# guvenli_oku KAYNAK HEDEF EN_COK_BAYT IZINLER... → 0: HEDEF, KAYNAĞIN doğrulanmış bir kopyası.
guvenli_oku() {
  local f="$1" hedef="$2" enCok="$3" once sonra izin
  shift 3
  [ ! -L "$f" ] && [ -f "$f" ] || return 1
  once="$(stat -c '%d:%i:%u:%h:%a:%F' -- "$f" 2>/dev/null)" || return 1
  IFS=: read -r _ _ sahip baglar izin tur <<<"$once"
  [ "$sahip" = "$SITE_UID" ] && [ "$baglar" = 1 ] || return 1
  case "$tur" in "regular file" | "regular empty file") ;; *) return 1 ;; esac
  local uygun=1 m
  for m in "$@"; do [ "$izin" = "$m" ] && uygun=0; done
  [ "$uygun" = 0 ] || return 1
  rm -f "$hedef"
  dd if="$f" of="$hedef" iflag=nofollow,nonblock bs="$((enCok + 1))" count=1 status=none 2>/dev/null || return 1
  sonra="$(stat -c '%d:%i:%u:%h:%a:%F' -- "$f" 2>/dev/null)" || return 1
  [ "$once" = "$sonra" ] || return 1
  [ "$(stat -c %s -- "$hedef")" -le "$enCok" ] || return 1
}

# Alan kullanıcısı önceden var, ayrılmış aralıkta ve yalnız uretim-alanlari grubunda mı.
alan_kullanicisi() {
  local k="$1" u gruplar
  [[ "$k" =~ ^uretim-[a-z][a-z-]{0,30}$ ]] || return 1
  u="$(id -u "$k" 2>/dev/null)" || return 1
  [[ "$u" =~ ^[0-9]+$ ]] && [ "$u" -ge "$UID_ALT" ] && [ "$u" -le "$UID_UST" ] || return 1
  gruplar="$(id -nG "$k" 2>/dev/null)" || return 1
  [ "$gruplar" = "$GRUP" ]
}

# yerlestir GECICI HEDEF SAHIP IZIN: aynı klasörde geçici ad → sahip/izin → atomik mv.
yerlestir() {
  local kaynak="$1" hedef="$2" sahip="$3" izin="$4" ara
  [ -d "$(dirname "$hedef")" ] && [ ! -L "$(dirname "$hedef")" ] || return 1
  ara="$(mktemp "$(dirname "$hedef")/.eslestir.XXXXXX")"
  cat "$kaynak" >"$ara"
  chown "$sahip" "$ara"
  chmod "$izin" "$ara"
  mv -fT "$ara" "$hedef"
}

while read -r alan; do
  [ -n "$alan" ] || continue
  [[ "$alan" =~ ^[a-z][a-z-]{0,30}$ ]] || continue
  k="uretim-$alan"
  if ! alan_kullanicisi "$k"; then
    kayit "$alan: $k alan kullanıcısı değil (kur.sh çalıştırıldı mı?), atlandı"
    continue
  fi

  # authorized_keys
  kaynak="$YETKI/$alan.authorized_keys"
  hedef="$ETC/$k.authorized_keys"
  g="$GECICI/$alan.ak"
  if [ -e "$kaynak" ] || [ -L "$kaynak" ]; then
    if ! guvenli_oku "$kaynak" "$g" 65536 644 600; then
      kayit "$alan: anahtar dosyası güvenli okunamadı, uygulanmadı"
    elif [ ! -s "$g" ] || grep -aEvq "$DESEN" "$g"; then
      kayit "$alan: geçersiz anahtar satırı, uygulanmadı"
    elif ! cmp -s "$g" "$hedef" 2>/dev/null; then
      yerlestir "$g" "$hedef" root:root 0644
    fi
  else
    rm -f "$hedef"
  fi

  # SSH kanal anahtarı
  akaynak="$YETKI/$alan.anahtar"
  ahedef="$KOK/$alan/etc/uretim/anahtar"
  g="$GECICI/$alan.anahtar"
  if guvenli_oku "$akaynak" "$g" 128 600 && anahtar="$(head -c 128 "$g")" &&
    [[ "$anahtar" =~ ^um_${alan}_[A-Za-z0-9_-]{43}$ ]] && printf '%s\n' "$anahtar" | cmp -s - "$g"; then
    if ! cmp -s "$g" "$ahedef" 2>/dev/null; then
      yerlestir "$g" "$ahedef" "$k:root" 0400
    fi
  else
    [ -e "$akaynak" ] && kayit "$alan: kanal anahtarı dosyası biçime uymuyor, uygulanmadı"
    rm -f "$ahedef"
  fi

  # Parola: site yalnız SHA-512 crypt özetini yazar (tek satır `$6$…`); açık parola diske hiç düşmez.
  pkaynak="$YETKI/$alan.parola"
  pdurum="$DURUM/$alan.parola"
  g="$GECICI/$alan.parola"
  if [ -e "$pkaynak" ] || [ -L "$pkaynak" ]; then
    if guvenli_oku "$pkaynak" "$g" 160 600 && ozet="$(head -c 160 "$g" 2>/dev/null)" &&
      [[ "$ozet" =~ $OZET_DESENI ]] && printf '%s\n' "$ozet" | cmp -s - "$g"; then
      if ! printf '%s\n' "$ozet" | cmp -s - "$pdurum" 2>/dev/null; then
        printf '%s:%s\n' "$k" "$ozet" | chpasswd -e
        printf '%s\n' "$ozet" >"$pdurum"
      fi
    else
      kayit "$alan: parola dosyası biçime uymuyor, uygulanmadı"
    fi
  fi
done <"$ALANLAR"
