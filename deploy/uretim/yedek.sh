#!/usr/bin/env bash
# Üretim Merkezi gece yedeği (UM-A5). Site her gece 03:00–03:30 arasında kendisi de yedek alır; bu betik elle ya da
# cron ile ek yedek içindir: veritabanının tutarlı kopyası + onaylananların dosyaları /srv/glix/yedek/uretim/<tarih>/,
# son 14 gün tutulur. Örnek cron: 17 3 * * * /srv/glix/current/deploy/uretim/yedek.sh
set -euo pipefail
KAP="${URETIM_KAP:-uretim-uretim-1}"
docker exec "$KAP" node dist/yedekAl.js
