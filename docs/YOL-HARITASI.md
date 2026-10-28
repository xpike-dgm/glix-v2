# GLIX — Yol Haritası: UI/UX, Oyun İyileştirmeleri, Yapay Zekâ (6 aşama)

Durum: 24 oyun önizlemede, erken bitiş yayında. Bu belge sonraki büyük işin planıdır; kural değiştiren her madde
`KURALLAR.md`'ye işlenmeden uygulanmaz (sahip onayı). İş kolları: **U** (UI/UX), **O** (oyun iyileştirmeleri),
**Y** (yapay zekâ — ayrıntılı plan: `docs/YAPAY-ZEKA.md`; içerik üretimi yapay zekâ ile yapılmaz, sağlayıcı OpenAI'nin ucuz bir modeli). Altta 6 aşamalı uygulama planı.

---

## U — UI/UX iş kolu

### U1. Ortak oyun kabuğu (GameShell)
- [x] Tek üst şerit: sol oyun adı + "2/5", orta süre bileşeni, sağ ses/çıkış. Oyunlar yalnız orta alanı çizer.
- [x] **Süre bileşeni (`<Clock>`):** ince çubuk; son 5 sn kalınlaşır, kırmızıya döner, sayı belirir, tik sesi + hafif titreşim.
  Erken bitişte çubuk yumuşak kapanır (bugünkü sıçrama biter).
- [x] **Durum cümlesi (`<Status>`):** her an tek büyük cümle: "Seç!", "Bekle…", "Sıra Mert'te", "Açılıyor!".
- [x] **Hazır şeridi:** "n/m hazır" + avatar noktaları her oyunda aynı yerde (TamamBar ile birleşir).
- [x] **Maç yolu:** üstte 5 noktalı ilerleme (oyun simgeleri), geçilen yeşil, şu anki nabız atar.
- [x] Kabul: 24 oyunun hepsi kabuğa taşınmış; `ui:check`'e "kabuk tutarlılığı" denetimi (şerit yüksekliği, süre konumu).

### U2. Lobi yeniden düzeni
- 5+ oyuncuda 4 sütun küçük avatar ızgarası; boşalan yere yatay **oyun kartları şeridi** (rastgele modda dönen "?" kartlar).
- "Minigame Seçimi" → "Oyunlar". Oyun kartında süre, oyuncu aralığı, tür etiketi (Hız / Blöf / Çizim / Sayı / Sosyal).
- **QR ile katılma** (oda kodunun yanında, dokununca büyür) — bağımlılıksız küçük QR üreticisi ya da gerekçeli tek bağımlılık.
- Host olmayanlar için: avatar değiştirme, "hazırım" işareti, avatara dokununca tepki animasyonu.
- Kabul: 8 oyuncu + oyun şeridi 320×568'de kaydırmasız; QR telefon kamerasıyla okunuyor (gerçek cihaz testi).

#### U2 ek — lobi geri bildirimi (Ekim 2026, tek kişilik oda ekran görüntüsü)
Gözlem: yalnızken 7 boş "+" dairesi ekranı kaplıyor ve tıklanınca bir şey yapmıyor; alttaki "Bu oyuncu sayısıyla
oynanabilecek oyun yok" hata gibi okunuyor; oyun ayarları bu durumda görünmüyor; davet tek "Paylaş" düğmesine bağlı.
Sırayla yapılacak:

**A. Hızlı kazanımlar**
- [x] QR ile katılma (yukarıdaki madde; "QR göster" → büyük QR, okutan doğrudan odaya girer).
- [x] Oda koduna dokununca kopyalama + "Kopyalandı" bildirimi.
- [x] Boş "+" daireleri davet düğmesi olur (dokununca paylaş/QR); en fazla 3 boş daire + "+N yer daha".
- [x] Oyuncu sayacı: "1/8 oyuncu · en az 2 gerekli".
- [x] Başlat altındaki metin olumlu dile: "Bir arkadaş daha gelince başlayabilirsin" (en küçük oyunun alt sınırına göre).

**B. Yalnızken sıcak ekran**
- [x] Tek kişiyken özel yerleşim: büyük "oda boş" maskotu ortada, altında büyük QR ve "Arkadaşlarını çağır"; ikinci kişi gelince normal ızgara.
- [x] Katılma anı: avatar kayarak/zıplayarak girer, kısa ses + titreşim.

**C. Bekleme süresini değerli yap**
- [x] Oyun seçimi (kartlı liste) ve tur ayarları oyuncu sayısından bağımsız baştan görünür; yetersiz sayıdaki oyunlar soluk + "en az N kişi". (Başlık "Oyunlar"; host için açılır panel, diğerleri için salt okunur özet.)
- [x] Avatara dokun → düzenle: renk, ifade, takma ad. (Karakter + takma ad; ifade yalnız oyun olaylarıyla değişen bir tepki olduğundan seçilmez.)
- [x] Emoji tepkileri: lobide herkes emoji atar, avatarın üstünde uçar (hız sınırlı, sunucu doğrular).
- [x] "Hazırım" işareti; herkes hazırsa Başlat parlar.

**D. Ev sahibi kontrolleri**
- [x] Oyuncuya basılı tut → "Odadan çıkar" / "Ev sahipliğini devret".
- [x] Oda kilidi: oyun başlayınca yeni giriş yalnız izleyici olarak (ya da kapalı) — "Oyun sırasında katılım" lobi ayarı (İzleyici / Kapalı) olarak uygulandı; kural KURALLAR.md'de kilitli.

**E. Görsel**
- [x] Lobiye dünya arka planı: tek "lobi salonu" görseli (dikey + yatay), Aşama 4 stilinde ChatGPT ile üretilir.
- [x] Seçilen oyunlar alt kısımda küçük kart şeridi: "Bu gece: N oyun". (Rastgele modda en çok 8 "?" kartı; 320×568'de 5+ oyuncuyla kaydırmasız sığma için şerit yalnız orada gizlenir.)

Kabul (ek): tek kişilik oda 320×568–430×932'de kaydırmasız; boş daireye dokunma davet açar; `ui:check`'e lobi-solo,
lobi-2, lobi-8, lobi-qr, lobi-picker durumları eklendi.

### U3. Anlatım (briefing) 2.0
- Metin yerine **3 karelik otomatik mini animasyon** (oyun başına `BriefingDemo`), metin altta tek satır.
- "Biliyorum" düğmesi (oyunu daha önce oynayan anında hazır; cihazda oynanan oyunlar listesi).
- "2 kişi ilk kez oynuyor" bilgisi; hazır avatar tekrarı kaldırılır (tek sıra).
- Kabul: anlatımda ortalama bekleme (stats) %40 azalır.

### U4. Sonuç ve final ekranı
- [x] Sıralama değişimi animasyonu (↑2 yeşil ok, satırlar kayar), puan jetonları avatardan tabloya uçar.
- [x] **Tur özeti satırı:** oyunun `result`'ından türeyen tek cümle ("Elif 3 eşleşme ile turun yıldızı") — oyun başına
  `summarize(result)` saf fonksiyonu (engine), Y5 ile zenginleşir.
- [x] "Sıradaki: Kör Kronometre" kartı + **"Devam" (herkes basınca 7 sn beklenmez)** — sunucu `results` aşamasına erken bitiş.
- [x] Final: podyum + unvanlar + "Tekrar oyna" (paylaşım kartı U7'de).

### U5. Canlılık (juice)
- [x] **Tepki yağmuru:** sonuç/final ekranında 😂 😱 🔥 👏; sunucuda hız sınırlı yeni mesaj `react`, herkese yayın. (Lobi, sonuç, final açık; oyun sırasında kapalı.)
- [x] **Avatar ifadeleri:** 4 durum (bekliyor-nefes, sevinç, elendi-çatlak, düşünüyor) — mevcut avatar SVG'lerine katman.
- [x] **Geçiş perdesi:** briefing → countdown → oyun → sonuç arasında tutarlı ışık süpürmesi.
- [x] **Ses katmanı:** lobi döngüsü, oyun içi gerilim ritmi (süre bileşenine bağlı), tek ana ses + müzik/efekt ayrı düzey.
  - Gerçek telefonda dinlenip ayarlanacak: müzik havası/düzeyi, gerilim nabzı hızı (`fx/musicScheduler.ts`).

### U6. Erişilebilirlik ve ayarlar
- Ayarlar sayfası: büyük yazı, titreşim aç/kapa, müzik/efekt ayrı, hareket azaltma (sistem ayarına ek), **renk körü modu**
  (Zaman Bombası, Kontrol Paneli, avatarlarda renk + desen/şekil kodu zorunlu). [x] Renk körü modu yapıldı (U12): Zaman Bombası
  şekilleri sönük tuşta da tam görünür; Kontrol Paneli kabloları şekil + desen + ad, ipucu şeması aynı şekillerle; avatarlar
  32 px ve üstünde kendi simgesini taşır; kazanan ★, doğru ✓, yanlış ✗ işaretleri.
- Başparmak bölgesi kuralı: birincil eylemler alt %40'ta; `ui:check`'e konum denetimi.

### U7. Paylaşılabilir anlar
- [x] Maç sonunda 9:16 kartlar (kazanan, en iyi çizim, oyun başına en yüksek tur ödülü + özet cümlesi, büyük dönüş),
  istemcide canvas ile üretilir (sunucuya görüntü gitmez). Web Share API (dosyalı); yoksa indir. (`apps/client/src/share/`)
- [x] Kartta "Sen de oyna: glix.dgmcraft.online" — yalnız takma ad ve avatar, başka kişisel veri yok.
  - Gerçek telefonda denenecek: iOS/Android'de dosyalı Web Share, yazı tipi yüklenmesi, kart üretim süresi.

### U8. Büyük ekran / TV (sahne) modu
- [x] Yeni rol **sahne** (`joinStage`): koltuk tutmaz, 8 sınırına girmez (odada en çok 2), oyuncu listesinde görünmez, kimlik almaz;
  `publicView` + `view(durum, null)` (izleyiciyle aynı güvenlik sınıfı; `izleyici-gizlilik.test.ts` 27 oyunda sahneyi de denetler).
  Yalnız `hello`/`ping`/`resync`/`leaveRoom` gönderebilir, eylem reddedilir. Bkz. `docs/PROTOKOL.md` "Sahne (TV) rolü".
- [x] `/tv` (ya da `/tv?oda=KOD`): büyük kod girişi (kumanda uyumlu), lobide dev kod + QR + gelen oyuncular; 1920x1080 ve 1280x720.
- [x] Her oyun için genel TV görünümü (`apps/client/src/stage/`): oyun dünyası, ad/tur/kabuk saati, oyun ekranı izleyici kipinde büyütülmüş,
  sağda oyuncu listesi; anlatım, sonuç podyumu ve final büyük.
- [x] Oyuna özel `StageView` (kayıt defterinde `StageView`): Zaman Bombası Hafızası (dev renk tuşları), Karalama Defteri (dev çizim duvarı).
  Diğer 25 oyun genel görünümle çalışır; özel görünüm ekledikçe `registry.ts`'e `StageView` yazılır.
- [x] Sahne varken telefonda küçük "TV'de oynanıyor" rozeti (`RoomSnapshot.stageCount`); oyun arayüzleri değişmedi.
- [x] Tablet/masaüstü (>= 1024 px): iki sütun (sol oyun, sağ oyuncular/puan), yalnız kabukta.

### U9. iOS uyumu
Zaten var: dvh yükseklik, safe-area, klavye alanı (visualViewport), iOS "Ana Ekrana Ekle" ipucu, dokunuşla ses açma.
**App Store / yerel uygulama sarmalı: KARAR YOK** — sahibi "yapalım" diyene kadar gündemde değil.

**1. Oyun sırasında kopma ve kararma (öncelik)**
- [x] Ekran Uyanık Tutma (Wake Lock) oyun ve lobi sırasında; sekme geri gelince yeniden alınır.
- [x] Arka plandan dönüşte (`visibilitychange`, `pageshow`/bfcache) anında yeniden bağlanma + tek seferde güncel durum; bayat oda görüntüsü yok.
- [x] Dönüşte kısa "Tekrar bağlandın — şu an X turundayız" bildirimi.

**2. Ses**
- [ ] Sessiz düğmesi: `navigator.audioSession` tercihi hazır (`fx/audioSession.ts`, `glix.sessizdeCal`); Ayarlar'daki anahtar U12'de.
- [x] Kilit/arka plan sonrası askıya alınan sesin ilk dokunuşta kendiliğinden açılması + denetimi.
- [x] Seslerin önceden ve küçük parçalar hâlinde yüklenmesi (ilk ses gecikmesiz).

**3. Titreşim**
- [x] iOS'ta `navigator.vibrate` yok: iOS 18 Safari anahtar (switch) dokunuş yolunun önemli anlarda (bomba, eleme) denenmesi (`hapticPress`, yalnız kullanıcının kendi dokunuşunda; **gerçek iPhone'da doğrulanmalı**).
- [x] Titreşimsiz cihazda telafi: ekran sarsıntısı/parlama biraz güçlenir.

**4. Ana ekrana ekleme**
- [x] iPhone açılış görselleri (apple-touch-startup-image, cihaz boyutlarına göre; maskotlu, ChatGPT ile).
- [x] Kurulum ipucu ilk oyun bittikten sonra, adımları görselli ("Paylaş → Ana Ekrana Ekle").
- [ ] Not: eklenmemiş sitelerde iOS 7 gün kullanılmayan veriyi silebilir; ekleme kalıcılık sağlar.
- [x] Web bildirimleri (iOS 16.4+, yalnız ana ekrana eklenmişse): isteğe bağlı; maç başlayınca, sıra sende ve yeni maç için (arka plandaki oyuncuya, 20 sn'de en çok bir). VAPID anahtarları yoksa kapalı (`deploy/README.md`). **Gerçek iPhone'da doğrulanmalı.**

**5. Dokunma ve ekran**
- [x] Uzun basma menüsü ve metin seçimi tüm oyun alanlarında kapalı (her oyun denetlenir).
- [x] Kenar kaydırma / çift dokunma yakınlaştırma oyun ekranlarında kapalı; çizim oyunlarında Safari "geri" hareketi çizimi bozmaz.
- [x] Yatay ekranda Dynamic Island/alt çizgi düğmelerin üstüne gelmez (tüm oyunlar).
- [x] Tüm yazı kutularında yazı boyutu ≥16px (iOS otomatik yakınlaştırma yok).

**6. Performans**
- [x] Düşük Güç Modu (30 fps): zamanlama oyunları kare sayısıyla değil gerçek saatle ölçer — denetim.
- [x] Eski iPhone bellek: görsel bellekten temizleme, Pixi bağlamını tek oluşturup yeniden kullanma.
- [x] Telemetride iOS ayrı grup: tıklama gecikmesi, kopma sayısı, sayfa yeniden yüklenmesi.

**7. Paylaşma**
- [x] Paylaşılan bağlantıya önizleme kartı (Open Graph görseli) — WhatsApp/iMessage'da görsel çıkar.
- [x] QR ile katılma (U2-A) iOS kamerasıyla doğrudan açılır.

**8. Test**
- [ ] `ui:check`'in WebKit (Safari motoru) ile de koşması.
- [ ] Gerçek iPhone 10 dakikalık kontrol listesi: kilitle-aç, arka plan-dön, sessiz mod, yatay, ana ekrandan açma.

### U10. Lobide karakter seçimi
- [x] Lobide karakter seçim ekranı: 8 karakter (mevcut `avatar` 0–7); alınmış olanlar soluk + sahibinin adı.
- [x] Sunucu tek otorite: `chooseAvatar` mesajı, odada benzersizlik sunucuda doğrulanır; aynı anda iki kişi aynı karakteri isterse ilk gelen alır, diğerine kibar uyarı.
- [x] Giren oyuncuya boş bir karakter otomatik atanır (bugünkü gibi), istediği an değiştirebilir; oyun başlayınca kilitlenir.
- [x] Cihaz son seçimi hatırlar; boşsa yeni odada önce onu dener.
- [ ] Oyunların içinde renkler karaktere bağlı kalır (kadeh, nişangâh vb. zaten avatar rengini kullanıyor).

### U11. Logo
- [x] Ana giriş sayfasında yazı yerine GLIX logo görseli (neon, maskotla uyumlu); ChatGPT ile üretim, harflerin kusursuzluğu elle denetlenir.
- [x] Aynı logodan: uygulama simgesi, açılış görseli (U9-4), paylaşım önizleme kartı (U9-7).
- [x] Logoya hafif giriş animasyonu (azaltılmış hareket tercihinde yok).

### U12. Ana menüde Ayarlar
- [x] Ana menüye "Ayarlar" ekranı (dişli simgesi, `screens/Settings.tsx`). İçerik:
  - [x] Ses: tek "Ses düzeyi" (ayrı müzik yok), sessize alma, "Sessiz modda da çal" (yalnız `navigator.audioSession` olan cihazda).
  - [x] Titreşim aç/kapa (desteklemeyen cihazda soluk + açıklama); `fx/haptics.ts` ayarı gözetir.
  - [x] Hareketi azalt (Açık / Kapalı / Cihaza göre; tek yardımcı `fx/motion.ts`, CSS `data-motion`), yazı boyutu (Normal / Büyük).
  - [x] Renk körlüğü dostu mod (Görünüm): kökte `data-cb="1"`; renkle verilen bilgiye şekil/desen/yazı biner (`ui/cbShapes.ts`, `ui/CbMarker.tsx`, `ui/CbState.tsx`, `styles/colorblind.css`). Geliştirmede `&cb=1`.
  - [x] Veri tasarrufu: görselleri atla (`worldAllowed()` okur). [x] "Yalnız Wi-Fi'de indir" (varsayılan açık).
  - [x] Profil: takma ad (motorun `normalizeNickname` doğrulaması), varsayılan karakter salt okunur.
  - [x] Depolama: kullanılan yer, "Önbelleği temizle". [x] "Tüm içeriği indir" (satır içi ilerleme; depolama tahmini yenilenir).
  - [x] Anonim performans ölçümü aç/kapa (gönderimi kapatır).
  - [x] Sürüm bilgisi, "Güncellemeleri denetle" (`checkForUpdate` in `pwa/pwa.ts`).
- [x] Ayarlar cihazda saklanır; oyun içi üst şerit sessiz düğmesi aynı ayarı okur/yazar.

### U13. İçeriği önceden indirme (iOS + Android)
Bugün: uygulama kabuğu önceden indiriliyor; görseller (≈16 MB) ilk görüldüğünde indirilip kalıcı önbellekte tutuluyor.
- [x] Ana ekrandan ilk açılışta animasyonlu "Hazırlanıyor" ekranı: tüm görsel ve sesler ilerleme çubuğuyla indirilir.
- [x] Link/QR ile odaya katılan misafir **beklemez**: önce küçük kabukla hemen oyuna girer, kalan içerik arka planda iner.
- [x] Mobil veride sorar ("Wi-Fi'yi bekle / Şimdi indir"); veri tasarrufu açıksa indirmez.
- [x] Güncellemede yalnız değişen dosyalar iner (dosya adında içerik özeti; Workbox bunu destekliyor).
- [x] iOS depolama sınırı ve silinmeye karşı: `navigator.storage.persist()` istenir, eksik dosya bir sonraki açılışta tamamlanır.

### U14. Güncelleme akışı
Bugün: yeni sürüm hazır olunca bekliyor (`registerType: prompt`), kullanıcı yenileyince geçiyor.
- [x] Oyun ortasında asla zorla güncelleme yok; güncelleme yalnız güvenli anda (ana sayfa, lobi, maç arası) uygulanır.
- [x] Küçük güncellemeler: güvenli anda sormadan kendiliğinden yenilenir (kısa "Yeni sürüm yüklendi" bildirimi).
- [x] Uyumsuz güncellemeler (`protocolVersion` değişti): tam ekran "Güncelleme gerekli → Güncelle"; güncellemeden oyuna girilemez.
- [x] Sunucu güncellemesi (deploy) sırasında açık maçlar biter veya sürer (draining), sonra herkes yeni sürüme geçer.

### U15. Hesaplar, arkadaşlar, istatistik ve rozetler
Ayrıntılı tasarım: `docs/HESAP.md`. Sahip kararları (Ekim 2026): misafirin istatistiği tutulmaz; misafir yalnız kodla
katılıp oynar. Giriş: Google ya da kendi hesabı. Sıralama yalnız arkadaşlar arasında.
- [x] H1 Hesap çekirdeği: kayıt (kullanıcı adı + e-posta + şifre), giriş/çıkış, oturum çerezi, WS bağlantısında kimlik.
- [x] H2 E-posta: doğrulama ve şifre sıfırlama (Resend HTTPS API; anahtar ve alan adı kayıtları sahipte, yoksa özellik kapalı).
- [x] H3 Google ile giriş (OAuth; sahibin Google Cloud'da açacağı istemci kimliğiyle).
- [x] H4 Misafir sınırı: oda kurmak hesap ister; misafir kodla katılır, istatistiği tutulmaz.
- [x] H5 İstatistik: yalnız hesaplılar için maç/oyun sonuçları; profil ekranı.
- [x] H6 Rozetler: kalıcı başarımlar, maç sonunda "Yeni rozet!". (Kâhin ve Kule Ustası rozetleri motor verisi gerektirdiğinden dışarıda; `docs/HESAP.md` "Rozetler".)
- [x] H7 Arkadaşlar: kullanıcı adıyla istek, kabul/ret, liste, çevrimiçi/lobide durumu.
- [x] H8 Lobiye hızlı davet (uygulama içi + web bildirimi) ve arkadaşın lobisine tek dokunuşla katılma.
- [x] H9 Arkadaş sıralaması: sen + arkadaşların; bu hafta / tüm zamanlar; galibiyet, puan, maç; oyun liderleri.
- [x] Arayüz düzeni: sol üst ad rozeti tek giriş (girişliyse Profil; rozette istek sayısı), Arkadaşlar/Kullanıcı adı Profil'de,
  Çıkış yap Ayarlar'ın en altında (onaylı), tek kullanıcı adı (7 günde bir değişir), Ayarlar kategori listesi
  (Oyuncu, Cihaz, Bildirimler, Hesap, Hakkında) ve her kategori için ayrıntı sayfası.
- [x] H10 KVKK: aydınlatma metni, hesabı silme, verimi indirme (uygulandı; bkz. docs/HESAP.md "KVKK").

### U16. Yönetici paneli
`/admin`; yalnız yönetici işaretli hesap, girişte e-postaya tek kullanımlık kod, her işlem kayıt altında. Oyuncuların
gizli bilgileri (rol, cevap) panelde de görünmez; e-posta yalnız tek hesap aranırken görünür.
- [x] A1 Canlı durum: oda/oyuncu/maç/TV sayıları, sunucu sağlığı (bellek, işlemci, gecikme, veri), açık odalar listesi (içeriksiz), sürüm ve son yayın.
- [x] A1 Oyun istatistikleri: günlük/haftalık maç ve oyuncu sayısı, oyun başına oynanma/süre/yarıda bırakılma, maç sonu puanları ve geri bildirimler, rastgele seçim dağılımı.
- [x] A1 Hatalar ve performans: gruplanmış istemci hataları, iOS/Android ayrı kopma-gecikme-yavaş dokunuş, çöken oyun kayıtları.
- [x] A2 Hesaplar: toplam/yeni kayıt, doğrulama oranı, giriş yöntemi dağılımı; kullanıcı adıyla arama; kullanıcı adını zorla değiştirme; askıya alma/silme; mail gönderim durumu; işlem kaydı.
- [x] A3 İçerik ve ayarlar: oyunu geçici kapatma / rastgele havuzdan çıkarma, ana sayfa duyuru bandı, herkese web bildirimi.
- [x] A3 Bakım: yeni maçı durdurup mevcutları bitirme (boşaltma), veritabanı yedeği indirme, son yayınlar.
- [x] A4 Moderasyon: oyuncuya "bildir" düğmesi ve inceleme kuyruğu, yasaklı kelime listesi, odayı kapatma, oyuncu atma.
- [x] A4 Kelime ve soru havuzlarını görüntüleme ve düzenleme.

### U17. Kart sistemi
Maç düzeyinde kartlar (kurallar: docs/KURALLAR.md "0. Maç düzeyi kuralları: Kartlar"; protokol: docs/PROTOKOL.md "Kartlar"; protokol sürümü 3).
- [x] Kurallar kanonik belgede yazıldı: kart seçimi aşaması (her 3. oyundan sonra, son oyun hariç, 15 sn), gizli olasılıklar, el sınırı 2, kötü kartlar, anlatımda oynama, kesin hesaplama sırası, Veto / Oyunu Seç, lobi ayarı.
- [x] Motor: `packages/engine/src/cards/` (katalog, çekiliş, hesaplama, olay tabanlı durum makinesi, kayıt/tekrar oynatma, görünümler) ve birim testleri (istatistiksel olasılık dahil).
- [x] Sunucu: `cards` aşaması, `playCard` / `pickCard` / `discardCard` / `setCards`, oyun sonu hesabı, yeniden bağlanma, izleyici/TV gizliliği, kart kaydı; akış testleri (`kartlar.test.ts`).
- [x] İstemci: kart seçimi ekranı, el çekmecesi ve hedef seçici, oyun başı açıklama (telefon + TV), kötü kart duyurusu, sonuç etki satırları, lobi Kartlar ayarı; `kart-` önizlemeleri `scripts/ui-check.mjs`'te.
- [ ] Kart görselleri (`/assets/cards/<kimlik>.webp`): şimdilik CSS çerçeve + elmas işareti; görseller sonra eklenecek (bkz. docs/GORSEL-URETIM.md).
- [ ] Oyun içi (oynanış sırasında) küçük "oynanan kartlar" şeridi: şimdilik kartlar geri sayımda ve sonuç satırlarında görünür.

### U18. Glix ve kozmetik mağaza
Sahip kararları (Ekim 2026). Yalnız görünüş satılır, oyunda avantaj yok; gerçek parayla satış yok.
- **Para birimi "Glix"**, yalnız hesaplı oyunculara. Kazanç: tamamlanan maç 10; sıralama eki 1. +15, 2. +10, 3. +5;
  günün ilk maçı ×2; yeni rozet kademesine göre 25 / 50 / 100. Maçlardan günlük üst sınır 300 Glix (rozet ödülü sınır dışı).
  Misafire maç sonunda "hesap açsaydın N Glix kazanırdın".
- **Fiyatlar:** sıradan 150, nadir 400, efsanevi 1000 Glix.
- **Düzen:** her zaman açık katalog + günün fırsatı (her gün indirimli 1–2 ürün). Ana menüde "Mağaza", profilde "Dolabım".
- **İlk sürüm ürünleri:** avatar çerçevesi, ad efekti, kart arkası, zafer kutlaması, unvan, tepki paketi, lobi giriş
  efekti; kürsü karakteri için dans ve giysi (parçalı karakter denemesi onaylanırsa; bkz. `docs/gorsel/KARAKTER.md`).
  Her türün ücretsiz bir temel ürünü olur.
- Uygulama sırası (öneri): M1 Glix bakiyesi, kazanç kuralları, hareket kaydı, maç sonu "+N Glix", yönetici düzeltmesi,
  KVKK dışa aktarma/silme → M2 Mağaza + Dolabım, satın alma ve kuşanma (sunucu doğrular), kuşanılanların diğer
  oyunculara görünmesi → M3 ürün görselleri (ChatGPT) ve görünüş türleri → M4 kürsü karakteri, dans ve giysiler.
- **Kürsü karakteri yöntemi (sahip onayı):** ChatGPT'nin tek ana çiziminden kesilmiş parçalar, PixiJS `MeshSimple` ile
  tek parça esneyen karakter olarak çizilir (eklemde dikiş yok); danslar CMU hareket kayıtlarından (`bvh2dance.py`,
  ticari kullanıma açık) dönüştürülür. Deneme: `tools/karakter-deneme/`.
- [x] M1  - [x] M2 (mağaza + Dolabım; kodla çizilen unvan, ad efekti, çerçeve — resimli türler M3/M4'te)  - [ ] M3  - [ ] M4

---

## O — Oyun iyileştirmeleri iş kolu

**Kural değiştirenler (sahip onayı → KURALLAR.md güncellemesi → uygulama):**

| # | Oyun | Değişiklik | Durum |
|---|---|---|---|
| O1 | Zaman Bombası | 90 sn toplam sınır; 60 sn sonra ani ölüm (+2 renk); oynatma 600→350 ms; giriş 1,5 sn + 1 sn/renk | ✓ uygulandı |
| O2 | Zehirli Kadeh | Her oyuncuya 1 "koklama": seçtiği kadehin durumu yalnız ona açılır | reddedildi |
| O3 | Rüşvet ve Darbe | Gerçek darbe: pay almayanların ortak darbe oyu, çoğunlukta başkanın +1'i iptal | ✓ uygulandı |
| O4 | İttifak | Pazarlıkta puansız "söz" işaretleri; sonda tutulan/bozulan sözler açılır | ✓ uygulandı |
| O5 | Ortalamaya En Yakın | 3 kısa tur, çarpan her tur değişir (½, ⅔, ¾), önceki ortalama görünür | ✓ uygulandı |
| O6 | Kör Kronometre | Hedef 7–13 sn arası rastgele, başta gösterilir; basmayan sıralamaya girmez | ✓ uygulandı |
| O7 | Aşırı Yükleme | En az tıklayan da −1 (risksiz pasifliği kırar) — sahip kararı | ✓ uygulandı |
| O8 | Butona Bas | 3 tur, pencere 300→200→120 ms | ✓ uygulandı |
| O9 | Kör Bomba / Rus Ruleti | İzleyen tahmini ("patlar mı?") doğru +1 (Rus Ruleti'nde rozet) | ✓ uygulandı |
| O10 | Gizli Kareler | 2. aşamada bir "ödül karesi" (+2) | ✓ uygulandı |
| O11 | Sızma | Sonda "fark ettin mi?" — kendini fark eden sızmaya +1 | ✓ uygulandı |
| O12 | Çizgiyi Geçme | Bölge genişliği oyuncu sayısına göre | ✓ uygulandı |

**Kural değiştirmeyen cilalar (onaysız yapılabilir):**
- [x] Karalama: renk paleti + kalınlık (zaten vardı: 6 renk + silgi, 3 kalınlık), oylamada çiziliş tekrarı, maç sonu galeri.
- Gizli Alışveriş: gerçek ürün ikon seti (12 SVG).
- [x] Kontrol Paneli: ipucunu metin yerine mini panel çizimiyle göster (metin alt yazı olarak kaldı).
- [x] Sözlük Blöfü / Çağrışım / Sızma: sıralı dramatik açılış (en çok kandıran en son). (`fx/sequence.ts`; Sızma: oylar azdan çoğa, son adımda maske düşer)
- Yazı Yaz: puansız "şüphe göstergesi". [x] Kendim: sürükle-bırak eşleştirme.
- [x] Çapraz Ateş / Açgözlülük: sinematik açılış sahneleri.
- [x] Tüm oyunlar: `summarize(result)` (U4 tur özeti).

**Kabul (her O maddesi):** kural senaryo testleri + invariants + sızıntı testleri + sunucu testi + `ui:check`; oyun
karnesinde (stats) ortalama puan ve süre önce/sonra karşılaştırılır.

---

## Y — Yapay zekâ iş kolu

### Mimari ilkeleri
1. **Sunucu tarafı tek kapı:** `apps/server/src/ai/` modülü (`AiGateway`): tek istemci, zaman aşımı, yeniden deneme,
   oda başına ve global bütçe, devre kesici. İstemci (telefon) yapay zekâya asla doğrudan bağlanmaz; anahtar yalnız
   sunucuda (ortam değişkeni / VDS sırrı).
2. **Her özelliğin yedeği:** API yoksa/geç kalırsa oyun aynen oynanır (şablon anlatıcı, kural tabanlı eşleşme, havuz).
3. **Determinizm:** canlı yapay zekâ çıktısı oyun durumunu etkiliyorsa (hakem kararı, bot hamlesi) **eylem olarak**
   `GameLog`'a yazılır; `replay` aynı sonucu üretir. `tick` yapay zekâ çağırmaz.
4. **Gecikme gizleme:** canlı çağrılar yalnız doğal bekleme anlarında (açılış penceresi, briefing, results) ve
   önceden tetiklenir (prefetch); en kötü durumda yedek kullanılır, oyun beklemez.
5. **Gizlilik:** takma ad yerine "Oyuncu A/B" etiketleri gönderilir; çizim/metin yalnız ilgili özellik açıkken ve
   aydınlatma metniyle. İçerik kalıcı saklanmaz.
6. **Yapılandırılmış çıktı:** tüm çağrılar JSON şemalı (`output_config.format`), sunucuda tekrar doğrulanır
   (CLAUDE.md: ağdan gelen her veri doğrulanır — yapay zekâ çıktısı da "ağdan gelen veri"dir).

### Model seçimi
- Varsayılan: **Claude Opus 5.5** (`claude-opus-5-5`) — çevrimdışı içerik üretimi, doğrulama, analiz için.
- Canlı ve gecikmeye duyarlı yollar (anlatıcı, hakem, moderasyon, bot) için ölçüm sonrası sahip kararıyla daha hızlı
  bir model (Claude Sonnet 5.5 / Claude Haiku 5.5) ya da Opus 5.5 düşük effort değerlendirilir. Karar, Y0'daki küçük
  değerlendirme setinde gecikme + kalite + maliyet ölçülerek verilir; varsayım yok.
- Çevrimdışı toplu işler **Message Batches API** ile (≈%50 daha ucuz, eşzamansız).
- Sabit sistem talimatları + kelime kılavuzu **prompt caching** ile önbelleğe alınır (değişken içerik sona).

### Özellikler

| # | Özellik | Tür | Nerede | Yedek |
|---|---|---|---|---|
| Y1 | İçerik fabrikası: tema paketleri, zorluk etiketleri, Sızma/Çağrışım/Karalama/Kontrol ipuçları | Çevrimdışı, batch | `scripts/content/` + insan onay ekranı | Mevcut havuzlar |
| Y2 | Sözlük doğrulama + 500 kelime | Çevrimdışı | aynı | 88'lik havuz |
| Y3 | Moderasyon: takma ad, blöf, kelime, hikâye, geri bildirim | Canlı, hızlı | `ai/moderate.ts` (yerel kara liste önce) | Yalnız yerel liste |
| Y4 | Hakem: anlamsal eşleşme (Çağrışım, Yazı Yaz), host itirazı | Canlı, açılış penceresinde | engine'e "hakem eylemi" | Kural tabanlı normalize eşleşme |
| Y5 | Anlatıcı: tur arası espri, tur özeti zenginleştirme, TV'de seslendirme (TTS opsiyonel) | Canlı, prefetch | results/briefing | Şablon cümleler |
| Y6 | Bot oyuncu (Sızma, Sözlük, İttifak, Çağrışım) — "Bot" etiketli | Canlı | Oda'ya sanal katılımcı | Mevcut test botları (kural tabanlı) |
| Y7 | Karalama: yapay zekâ tahmini ("YZ bile bilemedi") + galeri başlıkları | Canlı, açılışta | Karalama açılışı | Özellik gizlenir |
| Y8 | Yeni YZ oyunları: Makine Kim?, Prompt Düellosu, Savunma Avukatı, Hikâye Zinciri | Oyun | `games/<id>/` | Oyun katalogdan gizlenir |
| Y9 | Analist: haftalık geri bildirim özeti, denge raporu, hata kümeleri | Çevrimdışı, zamanlanmış | `stats` + rapor | Ham istatistik |

### Maliyet ve güvenlik kontrolleri
- Oda başına çağrı sınırı (ör. maç başına ≤ 20 canlı çağrı), günlük global bütçe, aşılırsa otomatik yedek.
- Çıktı uzunluğu sınırlı (`max_tokens` küçük canlı yollar), önbellek isabet oranı izlenir (`cache_read_input_tokens`).
- Kayıt: model, gecikme, token, yedeğe düşme oranı → `/health` metrikleri ve stats.
- Değerlendirme seti (Y0): her canlı özellik için 50–100 örnek; model/effort değişikliği bu setle ölçülür.

---

## 6 aşamalı uygulama planı

Her aşama: lint, typecheck, test, build + e2e + `ui:check` + pwa:check yeşil, önizlemede yayın, kısa oyun gecesi.
Ajan düzeni: en çok 2 eşzamanlı ajan, her oyun/özellik sonrası commit.

### Aşama 1 — Temel ve hızlı kazançlar (1 hafta)
- O1 Zaman Bombası kısaltma (onaylı).
- U2 lobi yeniden düzeni + "Oyunlar" + QR.
- [x] U4'ün sunucu kısmı: results "Devam" erken bitişi.
- Y0 altyapısı: `AiGateway` iskeleti (anahtar, bütçe, devre kesici, metrik), değerlendirme seti formatı — henüz
  oyuncuya görünür yapay zekâ yok.
- Kapı: lobi 8 oyuncu 320 px kaydırmasız; Zaman Bombası ort. süre ≤ 90 sn (stats).

### Aşama 2 — Ortak kabuk ve sonuç deneyimi (2 hafta)
- U1 GameShell + Clock + Status + maç yolu; 24 oyunun kabuğa taşınması (iki ajan, 12'şer oyun).
- U4 sıralama animasyonu, tur özeti (`summarize`), sıradaki oyun kartı.
- Kural değiştirmeyen cilaların ilk yarısı (Karalama paleti/tekrar, Alışveriş ikonları, sıralı açılışlar).
- Kapı: kabuk tutarlılık denetimi 24/24; oyun gecesinde "ne yapacağımı anladım" ≥ 4/5.

### Aşama 3 — Oyun derinliği (2 hafta)
- O2–O12 içinden sahibin onayladıkları (öneri sırası: O2 koklama, O3 darbe, O4 söz, O5 çok tur, O6 kronometre, O8).
- Kalan cilalar (Kontrol görsel ipucu, Kendim sürükle-bırak, Yazı Yaz şüphe göstergesi).
- Kelime havuzlarının elle genişletilmesi (yapay zekâ ile değil); Sözlük tanımlarının TDK'dan elle doğrulanması.
- Kapı: değişen her oyunun karne puanı önceki sürümden düşük değil.

### Aşama 4 — His ve paylaşım (2 hafta)
- U3 animasyonlu anlatım + "Biliyorum" (24 BriefingDemo; iki ajan).
- U5 tepki yağmuru, avatar ifadeleri, geçiş perdesi, ses katmanı.
- U6 ayarlar + renk körü modu; U7 paylaşım kartları.
- Y3 moderasyon (serbest metin oyunları + takma ad), yerel liste + yapay zekâ, yedekli.
- Kapı: anlatım bekleme süresi −%40; paylaşım kartı açılma ≥ %10 (beta grubunda).

### Aşama 5 — Canlı yapay zekâ (3 hafta)
- Y4 hakem (Çağrışım, Yazı Yaz) + host itirazı; `GameLog` hakem eylemi; replay testi.
- Y5 anlatıcı (metin; TTS opsiyonel, TV ile).
- Y6 bot oyuncular (önce Sızma ve Sözlük), Y7 Karalama tahmini.
- Model/effort kararı Y0 setinde ölçülerek; bütçe ve yedeğe düşme metrikleri izlenir.
- Kapı: canlı çağrıların p95 gecikmesi açılış penceresi içinde; yedeğe düşme < %5; maç başına maliyet hedefin altında.

### Aşama 6 — Sahne ve yeni nesil oyunlar (3–4 hafta)
- U8 TV/sahne modu: sahne rolü, `/tv`, 24 oyuna StageView (iki ajan), telefonun kumanda moduna geçmesi.
- Y8 yeni YZ oyunları (önce Makine Kim? ve Savunma Avukatı), Y9 haftalık analist raporu.
- A7: gerçek alan adına geçiş ve canlıya alma (glix.lynrax.com).
- Kapı: TV + 6 telefonla tam maç (e2e'ye sahne istemcisi eklenir); oyun gecesi ortalama ≥ 4,3/5.

---

## Sahip kararları
- **Kalite düşürülmez (Ekim 2026):** performans ve boyut iyileştirmeleri görsel kaliteyi, animasyonu ya da oynanışı
  düşürmeden yapılır. Görsel yeniden kodlama yalnız gözle ayırt edilemeyecek düzeydeyse (önce/sonra karşılaştırmasıyla)
  uygulanır; efektler kaldırılmaz, aynı görünüm daha ucuz yöntemle yeniden yapılır.
- **Ton kaldırıldı:** lobideki içerik tonu (Aile / Arkadaş / Ofis) sahip kararıyla silindi. Laf Sokma üç listeyi tekilleştirip
  tek havuzda (`laf-sokma/sorular`, 330 soru) topladı; `setTone` kaldırıldı (eski istemci için sessizce yok sayılır), yönetici
  havuzları göçle birleştirildi. Ayrıntı: `docs/PROTOKOL.md` "İçerik havuzları", `docs/ADMIN.md`.

## Ölçütler (her aşama sonunda)
- Linkten ilk oyuna süre, maç tamamlama oranı, oyun başına ortalama puan ve süre (stats), terk oranı.
- Yapay zekâ: çağrı sayısı, p95 gecikme, yedeğe düşme oranı, maç başına maliyet, moderasyon yanlış pozitif oranı.
- Teknik: tick p95, bellek, `ui:check` sayısı, e2e süresi.
