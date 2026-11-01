# Test ortamları: test.glix ve test2.glix

Üretim Merkezi 2 planı Aşama 2 (`docs/uretim/URETIM-2-PLAN.md`), kararlar UM-O1, UM-O2, UM-O6, UM-O7
(`docs/oneriler/uretim-merkezi.md` bölüm 8b). **Bu dosyalar sunucuda henüz hiç çalıştırılmadı**; kurulumu yönetici,
sahibin onayıyla yapar. Canlı düzen (`deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/deploy.sh`,
`deploy/Caddyfile.glix`) değişmedi.

| Ortam | Adres | Kap | Yerel kapı | Veri | İmaj |
|---|---|---|---|---|---|
| canlı | glix.dgmcraft.online | `glix-glix-1` (proje `glix`) | 127.0.0.1:3900 | `glix_glix-data` birimi | `glix-v2:latest` |
| onay (test) | test.glix.dgmcraft.online | `glix-test-glix-1` (proje `glix-test`) | 127.0.0.1:3901 | `/srv/glix/ortam/test/veri` | `glix-v2:test` |
| oyun alanı (test2) | test2.glix.dgmcraft.online | `glix-test2-glix-1` (proje `glix-test2`) | 127.0.0.1:3902 | `/srv/glix/ortam/test2/veri` | `glix-v2:test2` (= test'in imajı) |

Her test kabı: 512 MB bellek, 1 çekirdek, salt okunur kök, yetkisiz (`cap_drop: ALL`). İkisi toplam ~1 GB tutar.

## Dosyalar

| Dosya | Ne |
|---|---|
| `kur.sh` | Kurulum (root, tekrar çalıştırılabilir): bellek ölçümü, klasörler, gizli anahtarlar, erişim, ilk çıkış |
| `test-cikar.sh [ref]` | Ref'i (varsayılan `main`) derler, `glix-v2:test` yapar, test'i açar; aynı sürümdeyse bir şey yapmaz |
| `canliya-al.sh` | Test'te çalışan imajın aynısını canlıya taşır (yeniden derleme yok) |
| `test2-yenile.sh` | Gece yenilemesi: test'in imajına geç, içeriği canlıdan kopyala, sıfırla, sahte hesapları üret |
| `icerik-kopyala.sh <test\|test2> [--sifirla]` | Yalnız içerik kopyalama (test için de) |
| `erisim.sh` | Giriş kullanıcıları ve Caddy dosyası (`liste`, `ekle`, `sil`, `cerez-yenile`, `yaz`) |
| `ortak.sh` | Ortak işlevler (sağlık denetimi, maç sayımı, güvenli sürüm açma: `deploy.sh` ile aynı mantık) |
| `docker-compose.yml` | İki ortamın ortak compose dosyası (değerler `--env-file` ve betiklerden) |
| `Caddyfile.ortamlar` | Caddy site bloğu şablonu (taslak; gizli değerler kurulumda doldurulur) |

Sunucuda düzen:

```
/srv/glix/ortam/
  betik/            bu klasörün kopyası (cron buradan çalışır)
  gizli/            0700: .env.test, .env.test2, erisim-kullanicilar, sifre-<ad>, cerez.test, cerez.test2
  caddy/            ortamlar.caddy (0640 root:caddy; /etc/caddy/Caddyfile bunu import eder)
  kaynak/<sha>/     test'e çıkan sürümlerin kaynağı (son 3)
  test/veri/        test veritabanı (uid 1000)
  test2/veri/       oyun alanı veritabanı (uid 1000)
```

## Ortam bayrağı (`GLIX_ORTAM`)

Sunucu `GLIX_ORTAM=canli|test|test2` okur (`apps/server/src/ortam.ts`). Boş = canlı; tanınmayan değer açılışı durdurur.
Canlıda davranış birebir aynıdır (testler: `apps/server/src/ortam.test.ts`). test ve test2'de:

- **E-posta, web bildirimi ve Google girişi kapalı**: anahtar verilse bile okunmaz; gönderim hiç denenmez.
  (Kayıt çalışır, e-posta doğrulanmamış kalır; şifre sıfırlama ve bildirim anahtarı gizlenir.)
- **Yapay zekâ yorumu düşük sınırla**: dakikada 3, 24 saatte 100 istek (oyun sonu yorumu ve ilham ayrı ayrı). Anahtar
  ortamın kendi `GLIX_AI_KEY`'idir; boşsa özellik kapalı.
- **Arama motorlarına kapalı**: her yanıtta `X-Robots-Tag: noindex, nofollow`; `/robots.txt` her yolu kapatır
  (Caddy de aynısını yapar).
- **Ekranda şerit**: ana sayfanın üst ortasında küçük, dokunmayı engellemeyen "TEST" (sarı) ya da "OYUN ALANI" (mor)
  yazısı. Sunucu `index.html`'i verirken ekler; istemci kodu değişmedi, canlıda hiçbir şey eklenmez.
- `/health` yanıtında `ortam` alanı (canlıda yok).
- test2'de taslak oyunlar açık (`GLIX_TASLAK_OYUNLAR=1`).

## Erişim

**Seçilen yol: Caddy `basic_auth` + giriş çerezi.** Uygulamaya şifresiz hiçbir istek ulaşmaz; sunucu kodu değişmez.

- İlk girişte tarayıcı kullanıcı adı/şifre sorar. Doğru girişten sonra 30 günlük `HttpOnly` bir çerez verilir;
  sonraki istekler ve oyunun WebSocket bağlantısı bu çerezle geçer (iOS Safari WebSocket'e şifreyi eklemez).
- Çerez ortam başına 64 haneli rastgele sırdır, şifre doğrulanmadan verilmez (`route` sırası).
- Davetli: `erisim.sh ekle ayse` → şifre `/srv/glix/ortam/gizli/sifre-ayse`. Çıkarmak: `erisim.sh sil ayse` ve
  hemen kesmek için `erisim.sh cerez-yenile` (herkes bir kez yeniden şifre girer).
- **Yapay zekâ anahtarları (Aşama 3):** her yapay zekâya ayrı kullanıcı: `erisim.sh ekle yz-magaza`. Araç
  `Authorization: Basic base64(yz-magaza:şifre)` başlığıyla girer (HTTP ve WebSocket); kullanıcı silinince erişim
  biter. Aynı makinedeki Üretim Merkezi Caddy'ye uğramadan `127.0.0.1:3901/3902`'ye (ya da Docker ağından)
  bağlanabilir. Ortamın kendi `GLIX_URETIM_TOKEN`'ı kur.sh tarafından üretilir (canlınınkinden ayrı).
- Ana ekrana ekleme (PWA) test ortamlarında çalışmayabilir: tarayıcı uygulama bildirimini şifresiz ister. Oyun
  tarayıcıda sorunsuz çalışır.

Alternatif (seçilmedi): sunucuda ortam giriş kapısı. Daha çok kod ve canlının sunucusunda ek yol demekti.

## Kopyalanan tablolar (içerik)

İzin listesi `apps/server/src/ortamIcerikDisa.ts` içindedir; yeni bir tablo oraya açıkça eklenmedikçe kopyalanmaz.
Test (`ortam-icerik.test.ts`) veritabanındaki her tablonun sınıflandırıldığını doğrular: bir göç yeni tablo eklerse
sınıflandırılmadan testler geçmez.

| Tablo | Kopyalanan |
|---|---|
| `content_overrides` | İçerik havuzu değişiklikleri (yönetici ve Üretim Merkezi eklemeleri/kapatmaları), tüm satırlar |
| `banned_words` | Yasaklı kelime listesi, tüm satırlar |
| `server_settings` | **Yalnız** `games` (oyun açma/kapama) ve `gunlukGorevler` anahtarları |

Mağaza kataloğu, rozet tanımları, kartlar ve yerleşik havuzlar kodun içindedir: imajla birlikte gelir (test2 her
gece test'in imajına geçtiği için güncel kalır).

**Kopyalanmayanlar:** `accounts` (kullanıcı adı, e-posta, şifre özeti, Glix), `sessions`, `email_tokens`,
`account_push`, `account_games`, `account_matches`, `account_coplay`, `account_game_stats`, `friends`, `blocks`,
`badges` (kazanılmış rozetler), `glix_ledger`, `cosmetic_owned`, `cosmetic_equipped`, `quest_rewards`, `reports`,
`admin_audit`, `admin_otp`, `admin_sessions`, `server_starts`, `wiki_feedback`, `uretim_transfers`, tüm istatistik
tabloları (`matches`, `game_plays`, `feedback`, `perf`, `client_errors`, `game_failures`, `mail_stats`,
`content_stats`, `content_play`) ve `server_settings` içindeki duyuru, bakım kipi ve son bildirim kaydı.

**Nasıl:** dışa aktarma betiği hedefin imajından alınır ve canlı kapta standart girdiden çalışır
(`docker exec -i glix-glix-1 node --input-type=module -`); veritabanını salt okunur açar, yalnız izinli tablo ve
sütunları sorgular, JSON yazar. İçe aktarma hedefin imajıyla, hedef durmuşken ağsız tek seferlik bir kapta yapılır;
paket sıkı doğrulanır (izinsiz tablo, fazla sütun, izinsiz anahtar reddedilir) ve tek işlemde yazılır.

## Sahte hesaplar

Her kopyalamada silinip güncel kataloğa göre yeniden kurulur (başka hesaplara dokunulmaz):

| Kullanıcı adı | Ne |
|---|---|
| `Zengin` | Mağazadaki her ürün sahip, her türden biri kuşanılmış, 1.000.000 Glix |
| `YeniOyuncu` | Boş hesap (yeni oyuncu deneyimi) |
| `Rozetli` | Her rozet kazanılmış, 5.000 Glix |

Şifre ortam başına tek: `grep '^GLIX_SAHTE_SIFRE=' /srv/glix/ortam/gizli/.env.test` (test2 için `.env.test2`).
E-postaları `@oyun-alani.invalid` (hiçbir yere gidemez).

## Kurulum (adım adım, root)

0. Önkoşul: bu klasör `main`'de. Boş bellek en az 1,5 GB (`kur.sh` ölçer).
1. Klasörü sunucuya al (canlıya dokunmadan):
   ```
   git -C /srv/glix/repo.git fetch --prune origin '+refs/heads/*:refs/heads/*'
   rm -rf /tmp/ortamlar && mkdir /tmp/ortamlar
   git -C /srv/glix/repo.git archive main deploy/ortamlar | tar -x -C /tmp/ortamlar
   ```
2. Kur: `bash /tmp/ortamlar/deploy/ortamlar/kur.sh`
   - betikleri `/srv/glix/ortam/betik/`'e kopyalar, `.env.test`/`.env.test2` üretir (değer basmaz),
   - `sahip` giriş kullanıcısını ve Caddy dosyasını yazar,
   - `main`'i derleyip test'i açar (ilk derleme birkaç dakika sürer), içeriği canlıdan kopyalar,
   - test2'yi test'in imajıyla sıfırdan kurar.
3. DNS: `test.glix` ve `test2.glix` için A/AAAA kayıtları.
4. Caddy: `/etc/caddy/Caddyfile` sonuna `import /srv/glix/ortam/caddy/ortamlar.caddy`, sonra
   `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && systemctl reload caddy`.
5. Cron (`/etc/cron.d/glix-ortamlar`):
   ```
   */10 * * * * root /srv/glix/ortam/betik/test-cikar.sh main >> /srv/glix/ortam/test/cikar.log 2>&1
   23 4 * * * root /srv/glix/ortam/betik/test2-yenile.sh >> /srv/glix/ortam/test2/yenile.log 2>&1
   ```
6. Denetim: `curl -s 127.0.0.1:3901/health` ve `:3902` (`"ortam":"test"`/`"test2"`); tarayıcıda şifre sorulmalı,
   girişten sonra şerit görünmeli; `curl -sI https://test.glix.dgmcraft.online` → 401.

Betikler güncellenince `kur.sh` yeniden çalıştırılır (değerler korunur, betikler yenilenir).

## Günlük kullanım

- Ana dala giren her şey en geç 10 dakikada test'e çıkar (cron). Elle: `test-cikar.sh main` ya da `test-cikar.sh <sha>`.
- Oyun alanını hemen test'in sürümüne geçirmek: `test2-yenile.sh`.
- Test'in içeriğini canlıdan tazelemek (hesaplar kalır): `icerik-kopyala.sh test`.
- **Canlıya alma** (yalnız sahip "canlıya al" deyince): `canliya-al.sh`.
  - Canlıda maç ya da oyuncu varsa durur: "Canlıda şu an N maç ve M oyuncu var..." (çıkış kodu 3).
  - Test kabının imaj kimliğini canlıya etiketler, `/srv/glix/releases/<sha>` ve `/srv/glix/current`'ı `deploy.sh`
    gibi hazırlar, canlıyı derlemeden yeniden kurar.
  - Sağlık (90 sn, sürüm eşleşmeli) ve imaj kimliği eşleşmesi doğrulanır; olmazsa önceki imaj ve sürüm bağıyla geri
    açılır.

## Geri alma

- **Canlı:** `canliya-al.sh` öncekini `glix-v2:canli-onceki` olarak saklar. Elle dönmek için:
  `docker tag glix-v2:canli-onceki glix-v2:latest` ve
  `docker compose -f /srv/glix/current/deploy/docker-compose.yml -p glix --env-file /srv/glix/current/deploy/.env up -d --no-build --force-recreate`
  ya da her zamanki yol: `/srv/glix/deploy.sh <eski-sha>` (kaynaktan derler).
- **Test:** `test-cikar.sh <eski-sha>`.
- **Ortamları tamamen kaldırma** (canlı etkilenmez):
  ```
  rm -f /etc/cron.d/glix-ortamlar
  # /etc/caddy/Caddyfile'dan import satırını sil, sonra: systemctl reload caddy
  for o in test test2; do
    p=3901; [ "$o" = test2 ] && p=3902
    ORTAM_IMAJ=glix-v2:$o ORTAM_PORT=$p ORTAM_VERI=/srv/glix/ortam/$o/veri \
      docker compose -f /srv/glix/ortam/betik/docker-compose.yml -p glix-$o \
      --env-file /srv/glix/ortam/gizli/.env.$o down
  done
  docker rmi glix-v2:test glix-v2:test2 $(docker image ls --format '{{.Repository}}:{{.Tag}}' glix-v2 | grep ':sha-') || true
  rm -rf /srv/glix/ortam
  ```

## Açık konular

- Yönetici paneli test ortamlarında kapalı: giriş kodu e-postayla gelir, e-posta kapalı. Gerekirse ayrı karar.
- Ortamların yapay zekâ anahtarı boş başlar; sahip ayrı bir anahtar açarsa `.env.test`'e `GLIX_AI_KEY=` olarak yazılır
  (canlıyla aynı değer kurulumu durdurur).
- `test-cikar.sh` ve `deploy.sh` aynı aynayı (`/srv/glix/repo.git`) günceller; aynı anda çalışırlarsa biri git kilidi
  hatasıyla durur, bir sonraki cron turunda düzelir.
