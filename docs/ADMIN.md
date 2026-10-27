# Yönetici paneli (U16, A1)

`/admin` sayfası, oyundan ayrı küçük bir pakettir (`admin.html`; oyun paketine ve çevrimdışı önbelleğe girmez). A1 salt
okunurdur: Canlı durum, Oyun istatistikleri, Hatalar ve performans. Oyuncu adı, kullanıcı adı, e-posta, IP ve oyun
durumu hiçbir ekranda görünmez.

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
- İşlem kaydı: `admin_audit` tablosu (1 yıl). A1'de yalnız giriş olayları yazılır; işlemler A2 ile gelir.
- `/admin.html` ve `assets/admin-*` dosyaları kodun kendisidir, gizli veri içermez; veri uçları korumalıdır.

## Ekranlar
Örnek görüntüler: `docs/qa/admin/`. Canlı durum 5 sn'de bir yenilenir. Geri bildirim maç başına alındığından oyun puanı,
o oyunun geçtiği maçların ortalamasıdır.
