# Hesaplar, arkadaşlar, istatistik ve rozetler (U15)

Durum: TASARIM (Ekim 2026). Sahip kararları:
- Misafirin istatistiği tutulmaz. Misafir yalnız **kodla katılıp oynar**.
- Giriş: **Google ile** ya da **kendi hesabını oluşturarak** (e-posta + şifre).
- Sıralama yalnız **arkadaşlar** arasında. Arkadaş sistemiyle birlikte lobiye hızlı davet ve arkadaşın lobisine katılma.

## İlkeler
- Yeni bağımlılık yok: şifre `node:crypto` scrypt, oturum imzası HMAC, Google OAuth düz `fetch`, veri SQLite.
- Oyun motoru kimlik bilmez. Hesap bilgisi sunucuda oyuncu kaydına bağlanır; `view` sözleşmesi değişmez.
- Gizlilik: hesap verisi en az düzeyde (e-posta, kullanıcı adı, şifre özeti). Anonim istatistik tabloları aynen kalır.

## Kimlik
- **Kullanıcı adı:** 3–20 karakter, harf/rakam/alt çizgi, büyük-küçük harf duyarsız benzersiz. Arkadaş aramada kullanılır.
  Oyundaki takma ad ayrı kalır (odada istediğini yazabilir; varsayılan kullanıcı adı).
- **Kendi hesabı:** e-posta + şifre (en az 8 karakter). Şifre scrypt ile özetlenir (tuz + sabit süreli karşılaştırma).
- **Google ile giriş:** OAuth yetkilendirme kodu akışı (PKCE + state). Kimlik belirteci doğrudan Google'ın belirteç
  uç noktasından TLS ile alınır; `sub` hesabı belirler. İlk girişte kullanıcı adı seçtirilir.
  Aynı doğrulanmış e-postayla açılmış hesap varsa, şifreyle girdikten sonra Google bağlanabilir (otomatik birleştirme yok).
- **Oturum:** `glix_sess` çerezi (HttpOnly, Secure, SameSite=Lax, 180 gün). Sunucuda oturum tablosu; çıkış ve
  "tüm cihazlardan çık" oturumu siler. WS el sıkışmasında çerez okunur, bağlantı hesaba bağlanır.
- **Kötüye kullanım:** giriş/kayıt/sıfırlama uçlarında IP + hesap başına hız sınırı (mevcut `ratelimit.ts`).

## E-posta
VDS'teki Mailu dışarıya mail **gönderemiyor**: sağlayıcı 25. portu kapatmış, alan adının MX kaydı ImprovMX'e gidiyor,
DKIM yok, SPF bu sunucuyu kapsamıyor, iki ayrı DMARC kaydı var. Bu yüzden işlemsel e-posta servisi kullanılır
(587 portu açık): **Brevo** (ücretsiz günde 300) ya da **Resend** (ücretsiz ayda 3000). Gönderen: `noreply@dgmcraft.online`.
Gerekenler: servis hesabı, API anahtarı (`/srv/glix/shared/.env`), alan adına SPF/DKIM kayıtları, DMARC'ın teke indirilmesi.
Mail servisi gelene kadar hesaplar doğrulanmamış açılır; şifre sıfırlama mail gelince açılır.

## Misafir
- Misafir oda **kuramaz**; ana sayfada "Kodla katıl" ve "Giriş yap / Kayıt ol" görür.
- Misafir oyunda her şeyi yapar ama hiçbir şey kaydedilmez; maç sonunda "Rozet ve istatistik için hesap aç" daveti.
- TV/sahne modu kodla bağlandığı için değişmez.

## İstatistik (yalnız hesaplılar)
Maç sonunda sunucu her hesaplı oyuncu için yazar:
- Maç: oynandı, sıra (1., 2., ...), genel skor, oyuncu sayısı.
- Oyun başına: oynandı, mini skor, birincilik, oyuna özel rekor (ör. Kule'de kusursuz sayısı, Kör Kronometre'de en yakın fark).
Profil ekranı: toplam maç, galibiyet, galibiyet oranı, en sevilen oyun, oyun başına en iyi sonuçlar, rozetler,
en çok birlikte oynanan arkadaşlar.

## Rozetler
Kalıcı başarımlar, sunucuda maç sonunda değerlendirilir; yeni kazanılanlar sonuç ekranında "Yeni rozet!" olarak görünür.
İlk küme (örnek): İlk maç, 10/50/100 maç, İlk galibiyet, 10 galibiyet, 10 farklı oyunda birincilik, Kâhin ×10,
Kule'de 5 kusursuz, 8 kişilik maçı kazanmak, Arkadaşınla 10 maç, Gizli rozetler (kazanınca açılır).
Rozet görselleri sonra ChatGPT'yle üretilir; o zamana dek simge + ad.

## Arkadaşlar
- Kullanıcı adıyla istek → kabul/ret; istek ve liste en çok 200 kişi.
- Liste: çevrimiçi / lobide / maçta durumu (yalnız arkadaşlar görür).
- **Hızlı davet:** lobideyken "Arkadaş davet et" → arkadaş uygulamadaysa anında kart, değilse web bildirimi.
  Davet 10 dk geçerli, tek dokunuşla odaya katılır.
- **Arkadaşın lobisine katıl:** arkadaş lobideyse ve oda katılıma açıksa listede "Katıl" düğmesi.
- Engelleme: arkadaşlıktan çıkarma ve istek göndermeyi engelleme.

## Arkadaş sıralaması
Sen + arkadaşların. Sekmeler: **Bu hafta** (pazartesi sıfırlanır) ve **Tüm zamanlar**.
Ölçüler: galibiyet, toplam genel skor, maç sayısı; oyun başına rekorlar ayrı listede.

## KVKK
Kayıtta kısa aydınlatma metni; Ayarlar'da "Verimi indir" (JSON) ve "Hesabımı sil" (oturumlar, arkadaşlıklar,
istatistikler silinir; anonim tablolar zaten kişisel veri içermez).

## Veri modeli (SQLite, yeni göçler)
`accounts(id, username, username_lc, email, email_verified, pass_hash, google_sub, created_at)`,
`sessions(id_hash, account_id, created_at, last_seen)`, `email_tokens(kind, token_hash, account_id, expires_at)`,
`friends(a, b, state, created_at)`, `account_matches(account_id, ended_at, place, score, players)`,
`account_games(account_id, game_id, ended_at, mini_score, won, record)`, `badges(account_id, badge_id, earned_at)`.

## Sıra
H1 → H4 → H5 → H7 → H8 → H9 → H6 → H10; H2 ve H3, sahipten anahtarlar gelince araya girer.
