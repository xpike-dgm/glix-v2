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
Mail servisi gelene kadar hesaplar doğrulanmamış açılır; şifre sıfırlama mail gelince açılır (bkz. "E-posta (H2, uygulandı)").

## Misafir
- Misafir oda **kuramaz**; ana sayfada "Kodla katıl" ve "Giriş yap / Kayıt ol" görür.
- Misafir oyunda her şeyi yapar ama hiçbir şey kaydedilmez; maç sonunda "Rozet ve istatistik için hesap aç" daveti.
- TV/sahne modu kodla bağlandığı için değişmez.

## İstatistik (yalnız hesaplılar, H5 uygulandı)
Yalnız hesaplı **oyuncular** için yazılır; misafir ve izleyici (maça katılmayan) hiçbir şey kaydettirmez.
Yazma oyun akışının dışında, bitişte tek işlemde (küçük toplu yazma) yapılır; hata olursa günlüğe düşer, oyun etkilenmez.
- **Oyun bitince** (`account_games`): oyun kimliği, oyuncu sayısı, mini skor, mini sıra (mini skora göre; eşit skor aynı sırayı
  paylaşır: 1, 1, 3; sıralamaya misafirler de girer), `won` = sıra 1. Sonuç ekranında sıralanan oyuncular (mini skoru olanlar) yazılır.
- **Maç final'e varınca** (`account_matches`): oyuncu sayısı, oyun sayısı, genel skor, yer (genel skora göre, eşitler paylaşır),
  `won` = yer 1. Yarıda kalan/çöken maçlar maç olarak yazılmaz (biten oyunlar yazılmış olur).
- **Birlikte oynama** (`account_coplay`): biten her maçta hesaplı oyuncu çiftleri için iki yönlü sayaç artar (misafirler yok).
- Maç sırasında odadan çıkan oyuncunun kaydı o noktadan sonra yazılmaz (oyuncu kaydı odadan silinmiştir).
- Rozet ve oyuna özel rekorlar H6'dadır.

### Profil ucu
`GET /api/profile` (oturum şart; yoksa 401) tam profili döner; ayrıntı `docs/PROTOKOL.md`. `GET /api/profile/<kullanıcı>`
yalnız toplamlar, favori oyun ve oyun başına sonuçları döner; **şimdilik yalnız kullanıcının kendisi için** çalışır, başkası ve
bilinmeyen hesap aynı 404'ü alır. Arkadaşlar (H7) gelince arkadaşlara açılacak.
Profil ekranı (ana sayfada kullanıcı adına dokununca): üyelik tarihi; Maç / Galibiyet / Galibiyet oranı / Favori oyun kutuları;
oyun listesi (kart görseli, oynama, birincilik, en iyi); son 10 maç; en çok birlikte oynadığın 5 kişi. Yeni hesapta
"Henüz maç yok — bir oda kur!". Misafire final'de "Rozet ve istatistik için hesap aç" daveti ve Kayıt ol düğmesi çıkar
(kayıt ekranı oda dışında olduğundan düğme önce odadan çıkmayı onaylatır).
Rozetler, arkadaş listesi ve sıralama sonraki adımlarda profile eklenecek.

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
`friends(a, b, state, created_at)`, `badges(account_id, badge_id, earned_at)`.
İstatistik tabloları (göç 2, uygulandı; hepsinde `account_id` → `accounts` `ON DELETE CASCADE`):
`account_games(account_id, game_id, ended_at, players, mini_score, rank, won)`,
`account_matches(account_id, ended_at, players, games, score, place, won)`,
`account_coplay(account_id, other_account_id, matches, last_at)` (PK ikisi); `(account_id, ended_at)` dizinleri.
`deleteAccountData(accountId)` bu üç tablodaki satırları (karşı taraftaki sayaçlar dahil) siler; hesap silme (H10) çağıracak.

## Sıra
H1 → H4 → H5 → H7 → H8 → H9 → H6 → H10; H2 ve H3, sahipten anahtarlar gelince araya girer.

## Google ile giriş (H3, uygulandı)
- Ayar: `GLIX_GOOGLE_CLIENT_ID` + `GLIX_GOOGLE_CLIENT_SECRET` (ikisi birlikte) ve `GLIX_PUBLIC_URL`
  (örn. `https://glix.dgmcraft.online`; `ALLOWED_ORIGINS`'ten türetilmez). Yönlendirme adresi
  `<GLIX_PUBLIC_URL>/api/auth/google/callback` ve Google Cloud'daki kayıtla birebir aynı olmalı. Eksikse özellik kapalıdır, düğme gizlenir.
- Akış: `GET google/start` (PKCE S256, state, nonce; 10 dk `glix_oauth` çerezi yalnız sunucu belleğindeki kayda opak başvuru taşır,
  tek kullanımlık) → Google → `GET google/callback` (state denetimi, kod değişimi `client_secret_post`; `iss`, `aud`, `exp`, `nonce`,
  `email_verified` denetlenir, imza denetimi OIDC Core 3.1.3.7 gereği atlanır).
- Çözümleme: `google_sub` varsa oturum açılır; yoksa açık oturum varsa hesaba bağlanır; yoksa ve e-posta başka hesapta kayıtlıysa
  `eposta_kayitli` (otomatik birleştirme yok: önce şifreyle girilip Ayarlar > "Google hesabını bağla"); yoksa bekleyen kayıt oluşur
  ve istemci "Kullanıcı adı seç" ekranını açar (`POST google/complete`). Şifresiz hesap (`pass_hash` boş) parolayla giremez.
- Açık oturum başka hesaptaysa ve `sub` başka hesaba aitse sessiz hesap değişimi yapılmaz: `baska_hesap`.
- Dönüş: başarıda `/` (ya da güvenli `returnTo`), hatada `/#google-hata=<kod>`, yeni kullanıcıda `/#google-yeni=<belirteç>&u=<öneri>`;
  istemci işareti okuyup adres çubuğunu temizler. Hız sınırı: IP başına `takeAuth` kovası.

## E-posta: doğrulama ve şifre sıfırlama (H2, uygulandı)
- **Taşıma:** Resend HTTPS API'si (`POST https://api.resend.com/emails`, `Authorization: Bearer`, JSON `{from,to:[adres],subject,html,text}`), SMTP ve yeni bağımlılık yok.
  Ayar: `GLIX_RESEND_API_KEY`, `GLIX_MAIL_FROM` (örn. `GLIX <noreply@dgmcraft.online>`) ve bağlantılar için `GLIX_PUBLIC_URL`. Biri eksikse e-posta kapalıdır:
  kayıt çalışır (doğrulanmamış), "Şifremi unuttum" gizlenir, ilgili uçlar 404 `mail_disabled` döner (`GET me` → `providers.mail`).
  Gönderim arka planda yapılır; 2xx dışı yanıt ya da hata yalnızca genel `mail_failed` kaydı bırakır, kaydı bozmaz. Adres, belirteç ve anahtar günlüğe yazılmaz. Fetch testlerde enjekte edilir.
- **Belirteçler:** 32 rastgele bayt (base64url); yalnız sha256 özeti `email_tokens`'a yazılır, tek kullanımlık (tüketme tek SQL `DELETE ... RETURNING`).
  `verify` 24 saat, `reset` 1 saat geçerli. Yeni `reset` belirteci hesabın eskilerini geçersiz kılar.
- **Doğrulama:** kayıtta (şifreli hesap) `<GLIX_PUBLIC_URL>/api/auth/verify?t=<belirteç>` bağlantısı gider. `GET verify` → 302 `/#eposta=dogrulandi` ya da `/#eposta=gecersiz`.
  Oturumdaki doğrulanmamış kullanıcı `POST verify/resend` ile yeniden isteyebilir: hesap başına 60 sn'de 1, günde 5 (kayıttaki ilk e-posta dahil).
  Doğrulama **zorunlu değil** (oyun ve oda kurma açık); Ayarlar > Hesap'ta "E-postanı doğrula — Tekrar gönder" yumuşak uyarısı vardır. Google hesapları zaten doğrulanmıştır.
- **Şifre sıfırlama:** `POST reset/request {email}` her zaman `ok` döner (hesap var mı belli edilmez). Hesap varsa `<GLIX_PUBLIC_URL>/#sifre-sifirla=<belirteç>` gider (adres parçası sunucuya ulaşmaz).
  Hız sınırı: IP başına günde 20, e-posta başına 60 sn'de 1 / günde 5 (sınır aşılınca da yanıt aynı). `POST reset/confirm {token, password}`: şifre yazılır, belirteç tüketilir,
  hesabın **tüm** oturumları silinir, e-posta doğrulanmış sayılır (bağlantıya e-postadan ulaşıldı) ve yeni oturumla giriş yapılır.
  **Yalnız Google'la açılmış (şifresiz) hesap** da bu yolla ilk şifresini belirleyebilir; sonra şifreyle de girebilir.
- **Şifre değiştirme:** `POST password {current, password}` (oturum şart; hatalı mevcut şifre `login` ile aynı hesap-başı kovaya sayılır). Mevcut oturum kalır, diğer oturumlar silinir.
  Şifresiz Google hesabı için 409 `no_password`; arayüz düğmeyi gizler ve "Şifremi unuttum"a yönlendirir.
- **İstemci:** Giriş'te "Şifremi unuttum" (yalnız `mail` açıksa) → e-posta ekranı → "Bağlantı gönderildi"; `#sifre-sifirla=` ile "Yeni şifre" ekranı; açılışta adres parçası temizlenir.
- **Mail içeriği:** Türkçe, düz metin + sade koyu temalı satır içi biçemli HTML (görsel, izleme yok); konular "GLIX — E-postanı doğrula" ve "GLIX — Şifre sıfırlama";
  geçerlilik süresi ve "Bu isteği sen yapmadıysan bu e-postayı yok say." yer alır.
- **Kurulum (sahip):** Resend hesabı, `dgmcraft.online` için SPF/DKIM kayıtları, tek DMARC kaydı, anahtarı `/srv/glix/shared/.env`'e `GLIX_RESEND_API_KEY` olarak yazmak.
