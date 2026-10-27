# Yönetici paneli (U16, A1, A2 ve A3)

`/admin` sayfası, oyundan ayrı küçük bir pakettir (`admin.html`; oyun paketine ve çevrimdışı önbelleğe girmez). A1 salt
okunur sekmeler: Canlı durum, Oyun istatistikleri, Hatalar ve performans; bunlarda oyuncu adı, e-posta, IP ve oyun durumu görünmez.
A3 iki sekme daha ekler: **İçerik** (oyun anahtarları, duyuru bandı, herkese bildirim) ve **Bakım** (bakım kipi, veritabanı yedeği, son yayınlar). A2 iki sekme ekler: **Hesaplar** (toplamlar, arama, hesap ayrıntısı ve işlemler) ve **İşlem kaydı**. Kullanıcı adı yalnız bu iki sekmede,
e-posta yalnız tek hesabın ayrıntısında görünür.

## Kurulum
1. Oyunda yönetici olacak hesapla giriş yap. Hesap kimliğini bulmak için sunucuda:
   `docker exec glix-glix-1 node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/data/glix.db',{readOnly:true});console.log(d.prepare('SELECT id,username FROM accounts WHERE username_lc=?').get('kullaniciadin'))"`
   (kullanıcı adını küçük harfle yaz).
2. `/srv/glix/shared/.env` dosyasına `GLIX_ADMIN_ACCOUNT_IDS=3` (birden çoksa `3,12`) ekle ve yeniden dağıt.
   Boşsa panel kapalıdır: `/admin` ve `/api/admin/*` 404 verir. Bozuk değer sunucuyu başlatmaz.
3. Giriş kodu e-postayla gider: `GLIX_RESEND_API_KEY` ve `GLIX_MAIL_FROM` dolu olmalı (yoksa "kod gönder" 503 verir).

## Giriş akışı
Oyuna giriş -> `/admin` -> "Kod gönder" -> e-postadaki 6 haneli kodu yaz. Kod 10 dakika geçerli, tek kullanımlık, en çok
5 deneme; yeni kod en erken 60 sn sonra. Başarılı girişte `glix_admin` çerezi verilir (12 saat, hesap oturumuna bağlı;
oturum kapanınca düşer). Girişli ama yönetici olmayan hesap "Bulunamadı" görür.

## Güvenlik notları
- Kod ve çerez veritabanında yalnız özet olarak durur, günlüğe ve işlem kaydına yazılmaz.
- POST uçlarında Origin denetimi; çerez SameSite=Strict ve yalnız `/api/admin` yoluna gider.
- İşlem kaydı: `admin_audit` tablosu (işlemi yapan, hedef hesap kimliği, işlem, kısa ayrıntı). Giriş olayları ve tüm hesap işlemleri yazılır; e-posta, kod ve askı sebebi yazılmaz. **1 yıl** saklanır, günlük temizlikte silinir.
- A3'ten itibaren her değiştirici işlem panelde ayrı onay adımı ister (ekranın altına yapışan "Emin misin?" kutusu), POST + Origin denetimi + hız sınırı + işlem kaydı taşır.
- `/admin.html` ve `assets/admin-*` dosyaları kodun kendisidir, gizli veri içermez; veri uçları korumalıdır.

## Ekranlar
Örnek görüntüler: `docs/qa/admin/`. Canlı durum 5 sn'de bir yenilenir. Geri bildirim maç başına alındığından oyun puanı,
o oyunun geçtiği maçların ortalamasıdır.

## Hesaplar (A2)
- **Hesaplar sekmesi:** toplam, doğrulama oranı, giriş yöntemi dağılımı (yalnız şifre / yalnız Google / ikisi), son 7 ve 30 günde maç bitiren hesaplar,
  askıdaki sayısı, 30 günlük yeni hesap grafiği ve e-posta gönderimi (doğrulama / şifre sıfırlama / yönetici kodu: başarılı-başarısız, günlük).
  E-posta sayacı `mail.ts` gönderim sonucundan beslenir ve istatistik veritabanında yalnız gün + tür + sayı olarak durur (adres yok).
  İstatistik kaydı kapalıysa sayaç tutulmaz, panel bunu söyler.
- **Arama:** kullanıcı adının başı (büyük/küçük harf duyarsız) ya da tam e-posta; en çok 20 sonuç. Listede kimlik, kullanıcı adı, kayıt, doğrulama,
  giriş yöntemi, son görülme (oturum hareketinden, saat hassasiyetinde), maç sayısı ve askı durumu vardır; **e-posta yoktur**. E-postayla arama
  kaydedilir (metin yazılmaz).
- **Ayrıntı:** e-posta, toplamlar, rozet/arkadaş sayısı, açık oturum sayısı (belirteç yok), askı bilgisi ve işlemler. Ayrıntıyı açmak `account_view` kaydı yazar.
  Kullanıcı adı geçmişi tutulmadığı için gösterilmez.
- **İşlemler** (her biri panelde ayrı onay adımı ister, POST + Origin denetimi, yönetici başına hız sınırı, işlem kaydı):
  - *Kullanıcı adını değiştir:* aynı biçim/benzersizlik kuralı; **7 günlük beklemeyi aşar ve kullanıcının kendi bekleme sayacına dokunmaz**
    (yönetici değişikliği bekleme başlatmaz, sürmekte olanı bozmaz). Oyundaki ad ve arkadaş listeleri canlı güncellenir.
  - *Askıya al / Askıyı kaldır:* sebep (1-140 karakter) ve süre (1 gün / 7 gün / süresiz). Tüm oturumlar silinir, giriş kapanır, canlı soketler misafire
    döner (odada oyuna devam eder), arkadaşlar çevrimdışı görür, arkadaş isteği "bulunamadı" olur. Süre dolunca kendiliğinden açılır.
    **Kullanıcı giriş ekranında yalnız bitiş tarihini görür; sebep gösterilmez** (iç not), hesap sahibi "Verimi indir" dosyasında görür.
    İşlem kaydına sebep yazılmaz (yalnız süre), sebep hesap satırında durur ve hesapla birlikte silinir.
  - *Oturumları kapat:* tüm oturumlar silinir, canlı soketler misafire döner; hesap ve veri yerinde kalır.
  - *Hesabı sil:* KVKK silmesiyle aynı (`deleteAccount` + sosyal temizlik); yönetici kullanıcı adını yazarak onaylar.
- **Korunma:** `GLIX_ADMIN_ACCOUNT_IDS` içindeki hesaplara (kendisi dahil) ad değiştirme, askı, silme ve oturum kapatma yapılamaz.
- **İşlem kaydı sekmesi:** yeniden eskiye sayfalı (50'şer), okunur Türkçe etiketlerle: zaman, işlem, hedef hesap kimliği, yönetici, ayrıntı.
- **Gizlilik:** `docs/HESAP.md` "Yönetici hesap işlemleri" ve `gizlilik.html` güncellendi.

## İçerik ve bakım (A3)
- **Oyun anahtarları (İçerik sekmesi):** her oyun için *Açık / Kapalı* ve *Rastgele seçimde / Dışında*. Ayar `server_settings` tablosundadır (`key='games'`, JSON, yalnız varsayılandan farklı olanlar) ve yeniden başlatmada kalır; kod değişikliği gerekmez.
  - *Kapalı:* oyun lobi kataloğundan ve rastgele seçimden çıkar; yeni seçimde reddedilir (`invalid_games`). Lobide seçiliyse seçimden çıkarılır ve odadakilere Türkçe bildirim gider ("X şu an kapalı, seçimden çıkarıldı."). **Süren maç normal biter**; maç bitince lobiye dönerken seçimden düşer. Açık lobiler yeni kataloğu canlı alır.
  - *Rastgele havuz:* ayar oyun tanımındaki `randomPool` varsayılanını **iki yönde** ezer — varsayılanı "dışında" olan oyunu havuza ekleyebilirsin, havuzdakini dışarı alabilirsin. Ayar motor varsayılanına eşitlenirse saklanmaz ("değiştirildi" işareti kalkar). Havuz dışı oyun elle her zaman seçilebilir (kapalı değilse). Rastgele seçim, yönetici ayarıyla süzülmüş etkin kataloğun havuzundan yapılır.
- **Duyuru bandı:** ≤140 karakter düz metin (`<` `>` ve denetim karakteri yok), tür *Bilgi / Uyarı*, isteğe bağlı bitiş (≤ 30 gün). Ana sayfada (misafir dahil herkese) ve lobide (küçük) görünür; bağlanınca `welcome` ile gelir, değişince canlı güncellenir, süresi dolunca kendiliğinden kalkar. Kullanıcı bandı kapatabilir; kapatma duyuru kimliğiyle `localStorage`'da tutulur (yeni duyuru yeniden görünür). Metin işlem kaydına yazılmaz.
- **Herkese bildirim:** başlık ≤40, metin ≤120, isteğe bağlı site içi yol. Hedef: veritabanındaki hesap abonelikleri (`account_push`, kalıcı) + açık odalardaki misafir abonelikleri (bellek), uç noktaya göre tekilleştirilir. Saniyede 20 gönderim; 404/410 abonelik silinir; **saatte en çok 1 gönderim** (sunucu yeniden başlasa da geçerli). Sonuç özeti panelde (gitti / gitmedi / abonelik silindi). Bildirimi Ayarlar'dan kapatan abone değildir. Bildirim gönderimi için VAPID anahtarları şart (yoksa düğme kapalı).
- **Bakım kipi:** açıkken `createRoom` ve `startMatch` "Kısa bir bakım yapıyoruz, birazdan tekrar dene." ile reddedilir (`maintenance`); süren maçlar biter, odaya katılım sürer; ana sayfada ve lobide otomatik bant görünür. Sekme **süren maç sayısını 5 sn'de bir** gösterir: 0 olunca yeniden başlatmak güvenlidir (`deploy.sh` zaten `activeMatches` bekler, değişmedi). Ayar kalıcıdır; yeniden dağıtımdan sonra da açık kalır, işin bitince kapat.
- **Veritabanı yedeği:** Bakım sekmesi > "Yedeği indir". **Dosya e-posta adresleri içerir** (arayüz de uyarır). Biçim: tek bir **`.tar`** (elle yazılmış ustar, bağımlılık yok; zip için kütüphane gerekirdi). İçinde `glix.db` (hesap ve istatistik tek dosyada, üretim) ya da `glix-hesap.db` + `glix-istatistik.db`. Her dosya `VACUUM INTO` ile alınmış tutarlı SQLite kopyasıdır (sunucu çalışırken güvenli; `node:sqlite` `backup()` kullanılmadı çünkü eşzamanlı ve basit olan yeterli). Kopyalar `os.tmpdir()` altında (`/tmp`, konteynerde bellek diski) geçici klasöre alınır, tar olarak akıtılır ve akış bitince ya da bağlantı kopunca silinir. Açmak: `tar -xf glix-yedek-….tar` ve `sqlite3 glix.db`.
  Koşullar: giriş kodu en çok **30 dk önce** girilmiş olmalı (değilse panel "kodu yeniden gir" der), son 24 saatte **en çok 3** yedek (tüm yöneticiler toplamı, işlem kaydından sayılır), aynı anda tek yedek. Her yedek `db_backup` olarak kaydedilir.
- **Son yayınlar:** konteyner dağıtım geçmişini göremediği için sunucu her başlangıcı `server_starts(revision, version, started_at, stopped_at)` tablosuna yazar (revizyon `GIT_SHA`, yoksa `REVISION`, yoksa `dev`) ve temiz kapanışta `stopped_at` yazar. Panel son 20 kaydı süreyle gösterir; kapanış kaydı olmayan satır çökme/zorla durdurma demektir ve süresi en geç sonraki başlangıçtır. En çok 200 kayıt tutulur.
- **İşlem kaydı:** `game_switch`, `announcement_set`/`announcement_clear`, `push_broadcast`/`push_broadcast_done`, `maintenance_on`/`maintenance_off`, `db_backup`/`db_backup_denied`/`db_backup_failed`.
