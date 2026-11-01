#!/usr/bin/env bash
# Oyun alanının (test2.glix.dgmcraft.online) gece yenilemesi (UM-O2), cron için: test2-yenile.sh
# 1. Kod: test'te çalışan imajın aynısına geçer (glix-v2:test2 etiketi).
# 2. İçerik: canlıdan yalnız içerik tabloları yeniden kopyalanır.
# 3. Sıfırlama: veritabanı (hesaplar, ilerleme, istatistik) silinir; kap yeniden açıldığı için odalar da kapanır.
# 4. Sahte hesaplar (Zengin: her ürün + bol Glix, YeniOyuncu: boş, Rozetli: her rozet) yeniden üretilir.
# Örnek cron (kur.sh önerir):
#   23 4 * * * root /srv/glix/ortam/betik/test2-yenile.sh >> /srv/glix/ortam/test2/yenile.log 2>&1
set -euo pipefail
# shellcheck source=ortak.sh
source "$(dirname "${BASH_SOURCE[0]}")/ortak.sh"

[ "$#" -eq 0 ] || hata "Bu betik seçenek almaz."
kok_mu
kilit_al
echo "== test2 yenileme: $(date -Is)"

ortam_sec test
TEST_IMAJ="$(kap_imaji "$ORTAM_KAP")"
[ -n "$TEST_IMAJ" ] || TEST_IMAJ="$(etiket_imaji "$ORTAM_IMAJ")"
[ -n "$TEST_IMAJ" ] || hata "Test imajı yok; önce test-cikar.sh çalıştır."
docker tag "$TEST_IMAJ" "$IMAJ_ADI:test2"
echo "test2 imajı: $TEST_IMAJ (test ile aynı)"

icerik_kopyala test2 1
echo "== test2 yenileme bitti: $(date -Is)"
