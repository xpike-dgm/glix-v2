#!/usr/bin/env bash
# Canlının içerik tablolarını bir test ortamına kopyalar: icerik-kopyala.sh <test|test2> [--sifirla]
# Yalnız içerik (havuz değişiklikleri, yasaklı kelimeler, oyun ve görev anahtarları) kopyalanır; gerçek oyuncu
# hesapları, e-postalar, oturumlar, ilerleme ve istatistik KOPYALANMAZ (README "Kopyalanan tablolar").
# Sahte hesaplar (Zengin, YeniOyuncu, Rozetli) her çalıştırmada güncel kataloğa göre yeniden üretilir.
# --sifirla: hedefin veritabanını tamamen siler (oyun alanının gece yenilemesi; davetlilerin hesapları da gider).
# Hedef ortam kısa süre durur; odalar kapanır.
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"

HEDEF=""
SIFIRLA=0
for arg in "$@"; do
  case "$arg" in
    --sifirla) SIFIRLA=1 ;;
    test | test2) HEDEF="$arg" ;;
    *) hata "Kullanım: icerik-kopyala.sh <test|test2> [--sifirla]" ;;
  esac
done
[ -n "$HEDEF" ] || hata "Kullanım: icerik-kopyala.sh <test|test2> [--sifirla]"

kok_mu
kilit_al
icerik_kopyala "$HEDEF" "$SIFIRLA"
