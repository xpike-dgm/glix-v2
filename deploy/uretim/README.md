# Üretim Merkezi — kurulum

`apps/uretim` için dağıtım dosyaları. **Bu dosyalar sunucuda hiç çalıştırılmadı**; ilk kurulumu yönetici, sahibin
onayıyla yapar. Oyunun kendi blokları ve kabı değişmez.

| Dosya | Ne |
|---|---|
| `Dockerfile` | Site imajı (Node 22 alpine, oyunla aynı digest) + `ffmpeg` (görsel/ses işleme) + `git` (katalog aynası) |
| `docker-compose.yml` | `uretim` servisi: oyunla aynı Docker ağı, `127.0.0.1:3910`, salt okunur kök, 768 MB bellek |
| `Caddyfile.uretim` | `uretim.dgmcraft.online` site bloğu (taslak) |
| `yedek.sh` | Elle/cron ile ek yedek (site her gece kendisi de yedek alır) |
| `ssh/` | SSH kanalı (UM-G3): `kur.sh`, `eslestir.sh`, `uretim.conf`, `alanlar.txt` |

## 1. DNS

`uretim.dgmcraft.online` için VDS'in IP'sine bir `A` (ve varsa `AAAA`) kaydı.

## 2. Klasörler (sunucuda, root)

```
install -d -m 0755 -o root -g root /srv/glix/uretim
install -d -m 0750 -o 1000 -g 1000 /srv/glix/uretim/veri /srv/glix/uretim/depo /srv/glix/uretim/aktarim /srv/glix/uretim/ssh-yetki
install -d -m 0750 -o 1000 -g 1000 /srv/glix/yedek/uretim
install -d -m 0755 -o root -g root /srv/glix/uretim/ssh-gunluk
```

`/srv/glix/uretim` ve `/srv/glix/uretim/ssh` root'a ait kalmalı (SSH chroot şartı). `1000`, kap içindeki `node`
kullanıcısıdır. Katalog aynası `/srv/glix/repo.git` salt okunur bağlanır (oyunun `deploy.sh`'ı zaten günceller).

## 3. Ortam değişkenleri (`/srv/glix/shared/.env`)

Compose, `--env-file /srv/glix/shared/.env` ile çalıştırılır; dosyadan yalnız `docker-compose.yml`'de adı geçen
değerler kaba girer.

| Değişken | Not |
|---|---|
| `GLIX_URETIM_TOKEN` | Oyunla aynı uzun rastgele değer (`openssl rand -base64 48`). Oyun tarafı bu değer doluyken `/api/uretim/*` uçlarını açar. |
| `URETIM_SAHIP_EPOSTA` | Girişe izinli e-postalar, virgülle. |
| `GLIX_RESEND_API_KEY`, `GLIX_MAIL_FROM` | Oyunla aynı; giriş kodu e-postası. |
| `GLIX_AI_KEY` | Oyunun mevcut model anahtarı. Compose bunu `URETIM_AI_KEY: ${GLIX_AI_KEY:-}` olarak aktarır; değer hiçbir dosyaya kopyalanmaz, günlüğe yazılmaz. Boşsa istemler sabit kalıptan hazırlanır. |
| `URETIM_VAPID_PUBLIC`, `URETIM_VAPID_PRIVATE`, `URETIM_VAPID_SUBJECT` | İsteğe bağlı; site bildirimleri için ayrı anahtar (`node scripts/vapid-keys.mjs mailto:…`). |
| `URETIM_GIZLI_ANAHTAR` | SSH parolalarının ve MCP anahtarlarının şifreli kaydı için anahtar (en az 32 rastgele karakter: `openssl rand -base64 48`). Değişirse eski parolalar ve anahtarlar istemde doldurulamaz; parolayı sitede yenile. Boşsa SSH parolası kapalıdır. |
| `URETIM_SSH_SUNUCU` | İstemlerde görünen SSH adresi (varsayılan `dgmcraft.online`). Sır değildir. |
| `URETIM_SITE_GID` | `ssh/kur.sh`'ın oluşturduğu `uretim-site` grubunun numarası (varsayılan 3910). |
| `GLIX_AG` | Oyunun Docker ağı (varsayılan `glix_default`, oyun `-p glix` ile çalışıyor). |

Varsayılanlar: `URETIM_PUBLIC_URL=https://uretim.dgmcraft.online`, `URETIM_ONIZLEME_URL=https://glix.dgmcraft.online/onizleme.html`,
`URETIM_OYUN_URL=http://glix:3900`, kota 20 GB (`URETIM_KOTA_GB`), model günlük sınırı 200 (`URETIM_AI_GUNLUK`).

## 4. Kap

```
cd /srv/glix/current
docker compose --env-file /srv/glix/shared/.env -f deploy/uretim/docker-compose.yml -p uretim up -d --build
curl -fsS http://127.0.0.1:3910/saglik
```

Oyun kabını etkilemez; site çökse de oyun çalışır.

## 5. Caddy

1. `Caddyfile.uretim` bloğunu Caddy yapılandırmasına ekle, `caddy reload`.
2. **Öneri (oyun bloğu):** oyunun Üretim Merkezi uçları yalnız iç ağdan çağrılmalı. `glix.dgmcraft.online` bloğuna şu iki
   satırın eklenmesini öneriyorum (bu depoda `Caddyfile.glix` değiştirilmedi):

   ```
   @uretim path /api/uretim/*
   respond @uretim 404
   ```

## 6. Yedek

Site her gece 03:00–03:30 (İstanbul) arasında `/yedek/<YYYY-AA-GG>/` altına veritabanı kopyası (`VACUUM INTO`) ve
onaylanan öğelerin dosyalarını yazar; 14 günden eskisini siler. Ek yedek için: `deploy/uretim/yedek.sh` (cron).

## 7. SSH kanalı (UM-G3)

Yapay zekâ SSH ile bağlanınca kabuk açılmaz; her bağlantı `uretim` komut aracına gider (MCP araçlarının birebir
karşılığı) ya da SFTP ile yalnız kendi `gelen/` ve `okunur/` klasörünü görür.

1. Sunucuda `node` ve `openssh` kurulu olmalı (node chroot'a kopyalanır).
2. `deploy/uretim/ssh/kur.sh` (root): `uretim-alanlari` ve `uretim-site` gruplarını, `uretim-<alan>` kullanıcılarını
   (şifresiz, kabuksuz), `/srv/glix/uretim/ssh/<alan>/` chroot'larını ve `/etc/ssh/sshd_config.d/uretim.conf`
   ayarını kurar, `sshd -t` ile denetler. Sonra `systemctl reload ssh`.
3. `deploy/uretim/ssh/eslestir.sh` her dakika cron ile çalışır: sahip sitede alana SSH açık anahtarı ekleyince site
   `ssh-yetki/<alan>.authorized_keys` (her satır `restrict` önekli) ve `ssh-yetki/<alan>.anahtar` dosyalarını yazar;
   betik bunları `/etc/ssh/uretim/` ve chroot'taki `etc/uretim/anahtar` (0400) yerine koyar. Biçime uymayan satır varsa
   dosya hiç uygulanmaz.
4. Ana `sshd_config` dosyasında `Include /etc/ssh/sshd_config.d/*.conf` satırı olmalı (Ubuntu'da varsayılan).
5. **Parola (sözleşme bölüm 9):** `uretim.conf` parolayı yalnız `Match Group uretim-alanlari` bloğunda açar
   (`PasswordAuthentication yes`, `KbdInteractiveAuthentication no`, `MaxAuthTries 3`); sunucunun genel ayarı
   değişmez, anahtarla giriş de açık kalır. Sahip sitede parolayı oluşturunca/yenileyince site yalnız SHA-512 crypt
   özetini `ssh-yetki/<alan>.parola` dosyasına yazar; `eslestir.sh` bunu `chpasswd -e` ile **yalnız** `uretim-<alan>`
   kullanıcısına uygular. Açık parola diske hiç yazılmaz; sitede yalnız özeti ve `URETIM_GIZLI_ANAHTAR` ile şifreli
   kaydı durur (kopyalama anında çözülür, kopyalama denetim kaydına sırsız yazılır).
6. **Kaba kuvvet önlemi (5 başarısız denemede 15 dk engel):** sunucudaki sürüme göre biri seçilir.
   - **fail2ban (önerilen, her sürümde):** `ssh/fail2ban/uretim-sshd.filter.conf` → `/etc/fail2ban/filter.d/uretim-sshd.conf`,
     `ssh/fail2ban/uretim-jail.conf` → `/etc/fail2ban/jail.d/uretim.conf`, sonra `systemctl reload fail2ban`. Yalnız
     `uretim-*` kullanıcılarının denemelerini sayar (15 dk içinde 5 → 15 dk engel).
   - **OpenSSH 9.8+ `PerSourcePenalties`:** genel bir ayardır (Match içinde kullanılamaz), bu yüzden bütün kullanıcıları
     etkiler; sahip onaylamadan açılmamalı. Örnek: `PerSourcePenalties authfail:90s max:15m` (`sshd -V` ile sürümü gör).
7. **Giriş kayıtları:** `ssh/girisler.sh` her dakika cron ile journal'dan (yoksa `/var/log/auth.log`) yalnız `uretim-*`
   satırlarını `/srv/glix/uretim/ssh-gunluk/girisler.log` dosyasına yazar; site bunu salt okunur okur ve alan
   sayfasında son başarılı/başarısız girişleri gösterir (IP'nin son parçası gizlenir).

Cron örneği (root):
```
* * * * * /srv/glix/current/deploy/uretim/ssh/eslestir.sh
* * * * * /srv/glix/current/deploy/uretim/ssh/girisler.sh
```

Kullanım (yapay zekâ tarafı; istem bunları kopyalanınca doldurulmuş verir): `ssh uretim-magaza@dgmcraft.online uretim talimat-oku`; paket için
`sftp uretim-magaza@…` ile `gelen/<paket>/` klasörüne dosyalar + `teslim.json` (dosyalar `{"dosya":"ad.png","hedefYol":…}`),
sonra `ssh … uretim teslim-et <paket>` ya da klasöre boş bir `TAMAM` dosyası (site bir dakika içinde alır, sonucu
`okunur/sonuclar/<paket>.json`a yazar).

## 8. Oyun tarafının bekledikleri (sözleşme)

- `GLIX_URETIM_TOKEN` oyunda da tanımlı olmalı; `/api/uretim/havuzlar`, `…/ekle` (`{ satirlar: [{alan: değer}] }`),
  `…/kapat` (`{ anahtarlar }`), `/api/uretim/aktarim/:id/geri-al`, `/api/uretim/moderasyon`, `…/moderasyon/ekle`
  (`{ kaliplar: [{ kalip, tur }] }`), `/api/uretim/magaza/istatistik`, `/api/uretim/saglik`.
- Önizleme sayfası `onizleme.html`, `frame-ancestors https://uretim.dgmcraft.online` ile.
- Uçlar kapalıyken site çalışmaya devam eder: tek tık aktarım ve canlı havuz denetimi devre dışı kalır, panoda sarı uyarı görünür.
