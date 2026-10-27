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
  **Tek ad:** hesaplı oyuncunun oyundaki adı kullanıcı adıdır (ayrı takma ad yok; lobide takma ad düzenleme gizli, sunucu
  hesaplıdan `rename`'i `account_name` ile reddeder). Odalarda, arkadaş listelerinde ve davetlerde kullanıcı adı görünür.
  Misafir takma adını eskisi gibi seçer/değiştirir. **Değiştirme:** `POST /api/auth/username`, 7 günde bir; ilk değişiklik
  hesap açılışından sayılmaz, hemen serbest (Google ile açılanlar dahil). Kilitliyken "Kullanıcı adını <tarih> tarihinde tekrar
  değiştirebilirsin." Değişince odadaki ad yayınlanır, arkadaşlara `friendsChanged` gider (`username_changed_at`, göç 4).
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
- Rozetler aşağıda "Rozetler" bölümünde; oyuna özel rekorlar henüz yok.

### Profil ucu
`GET /api/profile` (oturum şart; yoksa 401) tam profili döner; ayrıntı `docs/PROTOKOL.md`. `GET /api/profile/<kullanıcı>`
yalnız toplamlar, favori oyun ve oyun başına sonuçları döner; **kullanıcının kendisi ve kabul edilmiş arkadaşları için** çalışır, başkası ve
bilinmeyen hesap aynı 404'ü alır.
Profil ekranı (ana sayfada sol üstteki ad rozetine dokununca; rozette bekleyen istek sayısı görünür; ekranda "Arkadaşlar" ve "Kullanıcı adını değiştir" girişleri vardır): üyelik tarihi; Maç / Galibiyet / Galibiyet oranı / Favori oyun kutuları;
oyun listesi (kart görseli, oynama, birincilik, en iyi); son 10 maç; en çok birlikte oynadığın 5 kişi. Yeni hesapta
"Henüz maç yok — bir oda kur!". Misafire final'de "Rozet ve istatistik için hesap aç" daveti ve Kayıt ol düğmesi çıkar
(kayıt ekranı oda dışında olduğundan düğme önce odadan çıkmayı onaylatır).
Rozetler profilde gösterilir. Arkadaşın profili (Arkadaşlar > arkadaş > Profilini gör) aynı ekranda, yalnız toplamlar, oyunlar ve kazanılan rozetlerle açılır.

## Rozetler (H6; uygulandı)
Kalıcı başarımlar. Tanımlar tek modülde: `apps/server/src/badges.ts` (kimlik, Türkçe ad ve açıklama, `secret`, `check(istatistik, maç bağlamı)`).
Kimlikler veritabanına yazıldığı için asla yeniden adlandırılmaz.
- **Değerlendirme:** maç satırı `account_matches`'a yazıldıktan sonra, aynı kayıtçı yolunda (`createAccountRecorder`) ve **ayrı hata yalıtımıyla**
  (rozet hatası maç kaydını ya da oyun akışını bozmaz) hesaplı her oyuncu için SQL toplamlarından (`badgeStats`) değerlendirilir. Yeni rozetler
  `badges(account_id, badge_id, earned_at)`'e `INSERT OR IGNORE` ile yazılır: aynı rozet ikinci kez verilmez, bildirim yalnız ilk kazanışta gider.
- **Bildirim:** yeni kimlikler hesabın canlı (TV olmayan) bağlantılarına `badgesEarned {ids}` olarak maç final'e varınca gider (`docs/PROTOKOL.md`).
  İstemci final'de "Yeni rozet!" kartını gösterir (hareket azaltma ayarına uyar); bağlantısı o sırada kopuk olan kartı kaçırır ama rozet profilde durur.
- **Profil:** kendi profilinde ızgara: kazanılan parlak ve adlı, kazanılmamış açık rozet sönük ve açıklamalı, kazanılmamış gizli rozet "???" / "Gizli rozet"
  (gerçek kimlik ve ad sunucudan çıkmaz). Arkadaşın profilinde yalnız kazanılanlar görünür.
- **Görsel:** görsel dosya yok; satır içi SVG madalyon. Şekil rozet ailesini söyler (daire: maç sayısı, altıgen: galibiyet, kare: diğer, baklava: gizli) ve içinde sayı ya da simge vardır; ad her zaman yazıyla yanındadır (renk körü güvenli).
- **Rozetler (15):** İlk Adım (1 maç), Alışıyorum (10), Müdavim (50), Efsane Oyuncu (100); İlk Zafer (1 galibiyet), Kazanmayı Biliyor (10), Şampiyon (25);
  Çok Yönlü (10 farklı oyunda birincilik); Kalabalığın Şampiyonu (8 kişilik maçı kazan); Can Dost (kabul edilmiş arkadaşla 10 maç, `account_coplay` + `friends`);
  Seri Galip (son 3 maç galibiyet); **gizli:** Gece Kuşu (maç İstanbul 02:00–05:00 arası bitti), Hepsi Bir Arada (rastgele havuzdaki `randomPool !== false` her oyun en az bir kez oynandı).
- **Motor sayaçları (rozet muhasebesi):** `GameResult.stats?` (oyuncu -> sayaç adı -> değer) **yalnız sunucu içindir**; `sharedMatchSnapshot`
  (`match.ts`, `publicResult`) sonucu istemciye `miniScores`/`awards` ile sınırlar, bu yüzden oyuncu, TV/sahne ve izleyici yüklerinde `stats` yoktur.
  Oyun bitince hesaplı oyuncunun sayaçları `account_game_stats(account_id, game_id, ended_at, key, value)`'e yazılır (göç; sıfır ve geçersiz değer yazılmaz,
  hesap silinince gider, "Verimi indir"de `stats.game_stats` olarak yer alır). Rus Ruleti `kahin: 1` (Kâhin unvanı, zaten sonuç ekranında herkese açık), Kule Ustası `perfects: n` yazar.
- **Sayaç rozetleri (2):** Büyük Kâhin (`kahin-on`; Rus Ruleti'nde 10 farklı oyunda Kâhin, `SUM(kahin)` >= 10) ve Kule Ustası (`kule-ustasi`; tek oyunda 3 kusursuz bırakış, `MAX(perfects)` >= 3).
  Diğerleri gibi maç final'e varınca değerlendirilir.

## Arkadaşlar (H7, H8; uygulandı)
Yalnız hesaplılar; misafir bu özelliklerden hiçbir şey görmez. Uç ve mesaj ayrıntısı `docs/PROTOKOL.md` "Arkadaşlar".
- Kullanıcı adıyla istek (büyük/küçük harf duyarsız) → kabul/ret/geri çek. Karşı taraf zaten istemişse istek kendiliğinden kabul olur.
  En çok **200 arkadaş**, **50 bekleyen giden istek** (karşıda en çok 100 bekleyen gelen). Hata: bulunamadı, kendine, zaten arkadaş, "İstek gönderilemedi."
  (karşı taraf engellemişse ya da kotası doluysa aynı metin: engellendiğin sızmaz).
- Liste: çevrimiçi / lobide / oyunda / çevrimdışı durumu; **yalnız kabul edilmiş arkadaşlar** görür. Durum, sunucuda hesaba bağlı canlı WS
  bağlantılarından ve oda aşamasından türetilir; değişim arkadaşlara `friendStatus` ile (en çok 1 sn'de bir tarama) gider. Oda kodu liste/durumda **yoktur**.
- Engelleme: arkadaşlığı/isteği siler; engelli taraf istek atamaz, davet edemez; engel Arkadaşlar ekranından kaldırılır. Arkadaşların profil özetini (toplamlar,
  favori ve oyun başına sonuçlar; son maçlar ve birlikte oynananlar değil) görebilirsin: `GET /api/profile/<kullanıcı>`.
- **Ekran (Arkadaşlar):** ana sayfada profil düğmesinin yanında (gelen istek sayısı rozeti). Kullanıcı adıyla ekleme, gelen istekler (Kabul/Reddet),
  gönderilenler (İptal), arkadaş listesi (çevrimiçi önde; durum **şekil + yazı + renk**: halka Çevrimdışı, daire Çevrimiçi, kare Lobide, üçgen Oyunda),
  engellenenler (Engeli kaldır). Arkadaşa dokununca küçük sayfa: Lobisine katıl, Profilini gör, Arkadaşlıktan çıkar, Engelle (yıkıcı ikisi onay ister).
- **Hızlı davet (H8):** lobide hesaplı herkes "Arkadaş davet et" → çevrimiçi ve odada olmayan arkadaşlar → dokununca `invite` arkadaşın canlı bağlantılarına gider
  (uygulamada kalıcı bir kart: Katıl / Kapat, 10 dk). Canlı bağlantı yoksa hesaba bağlı web bildirimi ("<kullanıcı> seni GLIX odasına çağırıyor", tıklayınca `/?oda=KOD`).
  Başka bir odadaysan "Katıl" önce uyarır: katılmak mevcut odadan ayrılmaktır. Sınır: aynı arkadaşa 30 sn'de bir, dakikada 20.
- **Arkadaşın lobisine katıl:** listede arkadaş lobideyse (ya da maçta ve oda izleyiciye açıksa, yer varsa) "Katıl"; sunucu `joinFriend` ile kodu çözer, mevcut katılım kuralları geçerli.
- Bildirim aboneliği hesaba bağlıdır (yalnız bellekte; çıkışta, 404/410'da ve sunucu yeniden başlarken düşer): kalıcı bir bildirim adresi kaydı yoktur.

## Arkadaş sıralaması (H9; uygulandı)
Sen + kabul edilmiş arkadaşların (yalnız hesaplılar). Sekmeler: **Bu hafta** (İstanbul pazartesi 00:00'da sıfırlanır) ve **Tüm zamanlar**.
Ölçüler (çipler): **Galibiyet** (yer 1), **Puan** (genel skor toplamı), **Maç**; hepsi `account_matches`'tan tek toplu sorguyla. Eşit değer aynı sırayı paylaşır (1, 1, 3).
İkinci bölüm "Oyun liderleri": oyun başına arkadaşlar arasında en çok birincilik (`account_games`). Uç ayrıntısı `docs/PROTOKOL.md` "Arkadaş sıralaması".
Ekran: Arkadaşlar ekranından ve kendi Profilinden "Arkadaş sıralaması"; kendi satırın vurgulu (renk + sol çizgi + "Sen"), birinciye taç (değeri 0 ise yok);
satıra dokununca o kişinin profili açılır (geri: sıralama). Arkadaşın yoksa "Sıralama için arkadaş ekle" ve Arkadaşlar düğmesi.

## KVKK (H10, uygulandı)
- **Aydınlatma:** kayıt ekranındaki "Aydınlatma metni" (`Disclosure.tsx`) `/gizlilik.html` ile uyumlu özettir (veri sorumlusu e-postası, hangi veri/neden, saklama, haklar, Ayarlar yolu).
- **Verimi indir:** Ayarlar > Hesap > Verilerim. `POST /api/account/export` JSON dosyası döner (`glix-verilerim-<YYYY-MM-DD>.json`, Türkiye saati). İçerik: açıklama, hesap alanları
  (kullanıcı adı, e-posta, doğrulama, Google bağlı mı ve `sub`, şifre için "özet saklanır, dosyaya konmaz" notu, açılış ve ad değiştirme tarihi), oturumlar (yalnız açılış/son görülme; belirteç özeti yok),
  `account_games` / `account_matches` satırları, birlikte oynananlar (kullanıcı adıyla), arkadaşlar/istekler/engeller (ad + tarih), oyun sayaçları, rozetler, bildirim aboneliği var mı. Hesap başına günde 3.
  İstemci fetch + blob + bağlantıyla indirir; iOS ana ekran uygulamasında (indirmeyi tutmaz) dosya yeni sekmede açılır.
- **Hesabımı sil:** Ayarlar > Hesap'ın en altı. `POST /api/account/delete {confirm, password?}`: kullanıcı adı yazılır (büyük/küçük harf duyarsız); şifreli hesapta şifre (hatalı deneme giriş sınırına sayılır);
  yalnız Google hesabında oturum en çok 10 dk önce açılmış olmalı, değilse 403 `fresh_login_required` ("Güvenlik için çıkış yapıp tekrar giriş yap, sonra sil."). Hesap başına saatte 5 deneme.
  Silme tek işlemde ve kalıcıdır (`deleteAccount`): istatistik, rozet, birlikte oynama (karşı taraftaki sayaçlar dahil), arkadaşlık/istek/engel, oturumlar, e-posta belirteçleri, hesap satırı.
  Ardından: bekleyen Google kayıtları ve bildirim aboneliği düşer, ilişkili hesaplara `friendsChanged` gider, çerez silinir.
  **Odadaki kullanıcı:** soketi açık kalır, misafire döner; oyuncu kaydı odada mevcut adıyla durur (`accountId` null: artık istatistik yazılmaz, takma ad değiştirebilir). Odadan atılmaz (en az şaşırtıcı davranış).
  Diğer cihazlardaki soketler de misafir olur; arayüzleri bir sonraki hesap okumasında (açılış/oturum denetimi) çıkışı görür.
- Anonim tablolar (`matches`, `game_plays`, `feedback`, `perf`) hesap kimliği taşımaz; silme onlara dokunmaz (testle doğrulanır).
- Günlük: kullanıcı adı/e-posta yazan satır yoktur; yalnız kimliksiz `account_deleted` bilgi satırı eklendi.

## Yönetici hesap işlemleri (U16 A2, uygulandı)
Ayrıntı: `docs/ADMIN.md`, uçlar: `docs/PROTOKOL.md`. Yöneticiler destek ve kötüye kullanım için hesap ayrıntısını (e-posta dahil) görebilir;
her görüntüleme `account_view` olarak kaydedilir. Yönetici: kullanıcı adını zorla değiştirir, askıya alır/kaldırır, hesabı siler, oturumları kapatır.
- **Askı:** `accounts.suspended_at / suspended_until / suspend_reason` (göç 8; `suspended_at` boş = askıda değil, `suspended_until` boş = süresiz).
  Askıya alınca tüm oturumlar silinir; parolayla ve Google ile giriş (ve şifre sıfırlama sonrası oturum açma) 403 `account_suspended`:
  "Hesabın <tarih> tarihine kadar askıya alındı." / "Hesabın askıya alındı." Mesaj yalnız doğru şifre/Google kimliği kanıtlanınca verilir (varlık sızmaz).
  **Sebep kullanıcıya girişte gösterilmez** (iç not; adres parçasıyla metin taşıma/yanıltma riski yok); hesap sahibi "Verimi indir" dosyasında
  `account.suspension` altında görür. Canlı soketler silmedeki gibi misafire döner (odada kalır), arkadaşlar çevrimdışı görür, askıdaki hesaba
  arkadaş isteği atılamaz ve profili görünmez ("bulunamadı"). Askı süresi dolunca kendiliğinden biter (giriş açılır); günlük temizlik sütunları siler.
- **Ad zorla değiştirme:** aynı doğrulama ve benzersizlik; 7 günlük beklemeyi aşar ve hesabın kendi bekleme sayacına dokunmaz
  (`username_changed_at` değişmez: yönetici değişikliği bekleme başlatmaz, sürmekte olanı sıfırlamaz). Canlı etki `Social.accountRenamed`.
- **Silme:** `deleteAccount` + `Social.accountDeleted` + Google bekleyen kayıtları (KVKK silmesiyle aynı); yönetici kullanıcı adını yazar.
- **Korunma:** `GLIX_ADMIN_ACCOUNT_IDS` içindeki hesaplara bu işlemler yapılamaz.
- **İşlem kaydı:** `admin_audit` + `target_id`; e-posta, kod ve askı sebebi yazılmaz; 1 yıl, günlük temizlikte silinir.

## Veri modeli (SQLite, yeni göçler)
`accounts(id, username, username_lc, email, email_verified, pass_hash, google_sub, created_at)`,
`sessions(id_hash, account_id, created_at, last_seen)`, `email_tokens(kind, token_hash, account_id, expires_at)`,
`badges(account_id, badge_id, earned_at)`.
Arkadaşlık tabloları (göç 3, uygulandı; hepsinde `ON DELETE CASCADE`): `friends(a, b, state, requested_by, created_at, updated_at)`
(PK `(a, b)`, `a < b` kanonik çift, tek satır; `state` `pending|accepted`; `requested_by` isteği atan; `updated_at` kabul zamanı) ve
`blocks(blocker, blocked, created_at)`. `deleteAccountData` bunları da (iki yönde) siler.
İstatistik tabloları (göç 2, uygulandı; hepsinde `account_id` → `accounts` `ON DELETE CASCADE`):
`account_games(account_id, game_id, ended_at, players, mini_score, rank, won)`,
`account_matches(account_id, ended_at, players, games, score, place, won)`,
`account_coplay(account_id, other_account_id, matches, last_at)` (PK ikisi); `(account_id, ended_at)` dizinleri.
Rozetler (göç 4, uygulandı): `badges(account_id, badge_id, earned_at)`, PK `(account_id, badge_id)`, `ON DELETE CASCADE`.
`deleteAccountData(accountId)` bu üç tablodaki satırları (karşı taraftaki sayaçlar dahil) ve rozetleri siler; hesap silme (H10) `deleteAccount` içinde çağırır.

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
