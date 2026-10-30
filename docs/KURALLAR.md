# GLIX — Mini Oyun Kural Formu

Bu dosya, Glix'teki bütün mini oyunların yeni sürüm kurallarını ve ilk görsel
sunum kararlarını tek yerde toplar. Kullanıcı cevapları ile asistanın açıkça
tasarladığı alanlar birlikte kilitlenir; kodlama bu kural seti üzerinden yapılır.

## Dosya kullanım notu

- `KİLİTLİ` yazan 1-24 arasındaki oyunların kural seti uygulama için hazırdır.
  Bir değişiklik istenirse ilgili oyunun maddesi güncellenir ve proje hafızasına
  değişiklik kaydı eklenir.
- Eski Glix'ten çıkarılan özetler yalnızca kaynak davranıştır; yeni sürüm için
  istediğin kuralı yazabilirsin.
- Süreleri saniye olarak yaz. Örnek: `30 saniye`.
- Her oyunda genel üst sınır 8 oyuncudur. Oyuna özel farklı bir üst sınır
  istemiyorsan maksimum oyuncuya `8` yaz.
- Oyun kuralları bu dosyada açıkça belirtilmeden kodlama yapılmayacak.

## Projenin değişmeyen genel çerçevesi

- Dil: Türkçe.
- Hedef cihaz: telefon PWA.
- Oda: katılım kodu, yalnızca takma ad, 2–8 oyuncu.
- Maç sürerken odaya katılım (KİLİTLİ, Ekim 2026): oda yöneticisi lobide "Oyun sırasında katılım" ayarını seçer:
  - **İzleyici olarak** (varsayılan): maç sürerken gelen kişi odaya izleyici olarak girer; yalnız herkese açık
    görünümü görür, hiçbir oyuna katılmaz, puan almaz, oylara ve seçimlere sayılmaz. Maç bitip oda lobiye dönünce
    normal oyuncu olur. İzleyici de bir yer tutar: oyuncular + izleyiciler en fazla 8 kişidir; oda doluysa katılamaz.
  - **Kapalı**: maç sürerken yeni kimse giremez; "Oyun sürüyor, bitince tekrar dene" mesajı görür.
  - Maç sırasında bağlantısı kopup aynı oturumla geri dönen oyuncu bu ayardan etkilenmez; kendi yerine döner.
- Oda yöneticisi oyunları manuel seçebilir veya rastgele oyun sayısı belirleyebilir.
- Site yöneticisi (yönetim paneli) bir oyunu geçici olarak **kapatabilir** (lobide seçilemez, rastgele seçime girmez, lobide
  seçiliyse seçimden çıkarılır ve odadakilere söylenir; süren maç normal biter) ve oyunun **rastgele havuz** üyeliğini
  değiştirebilir: bu ayar oyun tanımındaki `randomPool` varsayılanını iki yönde de ezer (havuz dışı bir oyunu havuza ekleyebilir,
  havuzdakini dışarı alabilir). Oyunun kendi kuralları değişmez (`docs/ADMIN.md`).
- Aynı maçta aynı mini oyun tekrar etmez.
- **Erken bitiş genel kuralı (sahip onayı):** Her etkin oyuncunun bir şey göndermesi gereken ve "herkes gönderdi" sorusunun
  net cevabı olan aşamalarda (çizim, yazı, cevap, oy, teklif, kesim, kilitleme), **bağlı bütün katılımcılar gönderdiğinde
  aşama 1 saniye sonra erken biter** (son gönderen onayı görsün diye). Bağlantısı kopan oyuncu ve izleyici beklenmez; bağlı
  kimse yoksa erken bitiş olmaz. Gönderim geri alınamıyorsa ya da kilitleme düğmesi varsa "gönderdi" = kilitledi. Erken
  bitiş aşamanın yalnız süresini kısaltır; puanlamayı ve gizli bilginin ne zaman açıldığını değiştirmez. **Zamanlama oyunları
  ve bekleme/blöf stratejisi olan aşamalar kapsam dışıdır** (Butona Bas, Kör Kronometre süresi, Kule Ustası, Aşırı Yükleme,
  Kör Bomba, Zaman Bombası Hafızası, Rus Ruleti). Oyun bazlı döküm: `docs/ONERI-KURAL.md`.
- **Geç gelen eylem payı (KİLİTLİ, sahip onayı):** Süre dolmadan gönderilip ağ gecikmesiyle sunucuya en fazla **250 ms** geç ulaşan eylem kabul edilir; süreye bağlı bitiş (faz geçişi, sonuç, gizli bilginin açılması) bu kadar gecikir, ekrandaki sayaç özgün bitişi gösterir. Pay yeni bir süre değildir: sunucu oyun saatini 250 ms geriden verir (`GameDefinition.graceMs`, oyun `setup` gerçek anda çalışır). **Yalnız Zehirli Kadeh, Yazı Yaz ve Sözlük Blöfü'nde** geçerlidir; zamanlama/tepki oyunları (Son Kişi, Butona Bas, Kör Kronometre, Kule Ustası, Aşırı Yükleme, Kör Bomba, Zaman Bombası Hafızası, Rus Ruleti ve diğerleri) kapsam dışıdır ve bitişten 1 ms sonraki eylemi eskisi gibi reddeder.
- **Yazılı cevap eşleşmesi genel kuralı (sahip onayı):** Oyuncuların yazdığı kelime/cevabın **eşleşip eşleşmediğine** bakılan her
  yerde karşılaştırma klavyeden bağımsızdır: büyük/küçük harf, ç/c, ğ/g, ı/İ/i/I, ö/o, ş/s, ü/u ve noktalama farkı yok
  sayılır (İngilizce klavyeyle yazan Türkçe klavyeyle yazanla eşleşir). Ekranda her zaman oyuncunun yazdığı biçim gösterilir.
  Kopya/yasak denetimi gibi kelimeleri **birleştirmemesi gereken** yerlerde (yönetici içerik havuzlarının tekrar denetimi) katı
  anahtar kullanılır: "göl" ile "gol" ayrı kelimedir.
- Sonuç ekranı (KİLİTLİ, Ekim 2026, sahip onayı): her mini oyundan sonra gösterilir. **Bağlı bütün katılımcılar "Devam"a
  basınca** hemen (1 saniye sonra) kapanır; basmayan olursa **30 saniye** sonra kendiliğinden kapanır (eskisi 7 saniyeydi).
  Bağlantısı kopan oyuncu beklenmez. Podyumda sıra numarası yazmaz; sıra altın/gümüş/bronz bloklar ve madalya ile gösterilir.
  Sonuç ve final ekranlarında taç yalnız kazanana verilir (ev sahibi tacı bu ekranlarda gösterilmez).
- Kartlar (KİLİTLİ, Ekim 2026): her 3. mini oyundan sonra kart seçimi, anlatımda kart oynama ve oyun sonu puan etkileri için bkz. "0. Maç düzeyi kuralları: Kartlar".
- Bot bulunmaz.
- Maç verileri maç bitince kalıcı olarak saklanmaz.
- Her mini oyundan önce yaklaşık 10 saniyelik görsel/animasyonlu öğretici ekran
  gösterilir.
- Tema neon arcade, yüksek kaliteli 2.5D sahne ve en fazla 8 farklı karakterdir.
- Her oyunun kendi mini oyun puanı ve genel skora aktarım kuralı olabilir.
- Aşağıda “genel skor” denilen puan, maçın toplam skor tablosuna eklenen puandır.

---

# 0. Maç düzeyi kuralları: Kartlar (KİLİTLİ, Ekim 2026)

Kartlar tek bir mini oyuna değil bütün maça aittir. Mini oyunun kendi kuralları değişmez; kartlar yalnız oyun bitince
**genel skora giden puanları** (`awards`) değiştirir. Mini oyun puanı (`miniScores`), mini oyun sıralaması, podyum ve
istatistikteki mini oyun sırası kartlardan etkilenmez. Bu bölüm kanoniktir; arayüz buradan kural icat etmez.

## K1. Genel akış

1. **Ne zaman:** Maçın 3., 6., 9. … mini oyunu bittikten ve sonuç ekranı kapandıktan sonra **Kart seçimi** aşaması gelir.
   Maçın **son** oyunundan sonra gelmez (sıradaki aşama final). "Son oyun", Veto/Oyunu Seç uygulandıktan sonraki güncel listeye göre belirlenir.
2. **Kimler:** Maça katılan oyuncular (izleyiciler değil). İzleyiciler ve TV "Oyuncular kart seçiyor" ekranını görür; kimin seçimini bitirdiği
   herkese açıktır, seçenekler ve seçimler değildir.
3. **Süre:** 25 saniye (önce kartı incelemek, sonra onaylamak için). Bağlı bütün katılımcılar seçimini bitirince aşama 1 saniye sonra erken biter. Süre dolduğunda (ya da erken bitişte)
   seçmemiş her oyuncuya (bağlantısı kopuk olanlar dahil) kendi seçenekleri arasından **rastgele** biri verilir.
4. **Kapalıysa:** Lobideki Kartlar ayarı kapalıysa ya da hiçbir kart etkin değilse aşama hiç gelmez, maç kartsız oynanır.
5. **Sıfırlama:** Bütün kart durumu (el, bekleyen kötü kartlar, bayraklar) maçla birlikte başlar ve biter. Maç bitince eldeki kartlar yanar;
   yeni maç herkes için boş elle başlar. Maç sırasında odaya giren izleyicinin kartı yoktur; maç bitip oyuncu olunca sonraki maça boş elle girer.

## K2. Seçenekler ve çekiliş

1. Her oyuncu **kendi** seçeneklerini gizlice görür: **3 kart** (önceki aşamada bir sonraki seçim için Geniş Seçim oynadıysa **4**).
   Seçenekler sunucuda, maçın tohumundan türetilen rastgelelikle, oyuncudan bağımsız çekilir (iki oyuncu aynı kartları görebilir).
   Bir oyuncunun kendi seçenekleri arasında aynı kart iki kez çıkmaz.
2. **Gizli olasılıklar** (oyunculara hiçbir yerde gösterilmez). Her seçenek yuvası için önce kötü mü iyi mi olduğu belirlenir:
   - Kötü kart olasılığı: **%30**; oyuncu üst yarıdaysa **%35**, alt yarıdaysa **%25**.
   - Kötü değilse nadirlik: **sıradan %70 / nadir %25 / efsanevi %5**; alt yarıdaki oyuncu için **%60 / %32 / %8**.
   - Seçilen sınıf içinde kart, o sınıfın **etkin** ve bu oyuncunun seçeneklerinde henüz olmayan kartları arasından eşit olasılıkla seçilir.
   - Bir sınıfta (kötü ya da bir nadirlik) çekilebilir kart kalmadıysa o sınıf elenir ve kalan olasılıklar yeniden normalleştirilir.
     Hiç kart kalmadıysa o oyuncunun seçenek sayısı azalır (en az bir kart varsa aşama yine yapılır).
3. **Üst/alt yarı** (oyuncu sayısı n, güncel **toplam skor**ları): bir oyuncu, kendinden **kesin yüksek** puanlı oyuncu sayısı n/2'den azsa **üst yarıdadır**;
   kendinden **kesin düşük** puanlı oyuncu sayısı n/2'den azsa **alt yarıdadır**. İkisi birden doğruysa (ortadaki oyuncu, tek sayıda oyuncuda; ya da
   berabere kalan oyuncular) oyuncu **nötr**dür: kötü kart %30, nadirlik 70/25/5. Maçın ilk aşamasında herkes 3 oyun puanı almıştır, yani tablo normal hesaplanır.
4. **Lanetli Hediye** bayrağı olan oyuncunun bir sonraki çekilişinde nadir ve efsanevi ağırlıkları **iki katına** çıkarılır (sıradan ağırlığı aynı kalır) ve
   üç nadirlik yeniden normalleştirilir. Bayrak o çekilişte tüketilir.
5. **Kör Seçim** bayrağı olan oyuncu kartları görmeden seçer: yalnız kart sırtlarını görür, seçince kartı öğrenir. **Kumarbaz** bayrağı olan oyuncu
   aynı aşamada sırayla **2 kart** seçer (ikincisini ilk seçtiği kart dışında kalan seçeneklerden). **Sessizlik** bayrağı olan oyuncu o aşamayı kaçırır:
   seçenek almaz, "Bu turu kaçırdın" görür ve diğer bayrakları (Geniş Seçim, Kör Seçim, Kumarbaz, Lanetli Hediye) **bekler**, yani sonraki aşamaya kalır.
   Bayraklar aşama **açılırken** okunur ve tüketilir; aşama içinde çekilen yeni bayraklar bir sonraki aşamaya aittir.

## K3. El, iyi ve kötü kartlar

1. **İyi kart** (sıradan, nadir, efsanevi) oyuncunun **eline** girer. El en çok **2** kart tutar.
2. El doluyken iyi kart seçilirse aynı 25 saniyenin içinde bir **değiştirme adımı** gelir: oyuncu elindeki 2 karttan birini atar ya da yeni kartı atar.
   Süre dolarsa **yeni kart atılır** (eldeki kartlar korunur). Atılan kart yanar.
3. **Kötü kart** ele girmez; seçilir seçilmez etkisi başlar:
   - **Sonraki mini oyuna** işleyenler: Talihsizlik, Ağır Yük, Hayırsever, Açık Hedef, Kumarbaz (−2 kısmı), Lanetli Hediye (−1 kısmı).
   - **Hemen** işleyen: Boş El (elindeki rastgele bir kart yanar; el boşsa etkisiz).
   - **Sonraki kart seçimine** işleyenler: Kör Seçim, Sessizlik, Kumarbaz (2 kart kısmı), Lanetli Hediye (şans kısmı).
   Bekleyen bir kötü kart yalnız **bir** mini oyunun hesabında işler ve sonra silinir; aynı oyuna birden çok kötü kart bekliyorsa hepsi işler.
4. Kötü kartlar aşama bitince herkese açık duyurulur: "<oyuncu> kötü kart çekti: Talihsizlik". Duyuru, o kartın işlediği oyunun sonucuna kadar ekranda kalır.
5. Eldeki kartlar herkese kapalıdır; yalnız **kaç kart** tuttuğu herkese açıktır.

## K4. Kart oynamak

1. **Ne zaman:** bir mini oyunun **anlatım** (briefing) ekranında, oyuna katılan her oyuncu elinden **en çok 1** kart oynayabilir. Hedefli kart oynanırken
   hedef (ya da Veto/Oyunu Seç için oyun) o anda seçilir. Oynanan kart elden hemen çıkar; anlatım bitmeden **geri alınabilir** (kart ele döner).
   Anlatım bitince (herkes hazır ya da 40 sn doldu) seçimler **kesinleşir**.
2. **Hedef:** hedef, aynı oyuna katılan **başka** bir oyuncudur (izleyici olmaz). Koruma kendine de oynanabilir. Tahmin ve diğer hedefli kartlar kendine oynanamaz.
3. **Açıklama:** kesinleşen kartlar oyunun başında (geri sayım ekranı) **herkese açık** gösterilir (telefonlar ve TV): "Elif, Mert'e Çelme oynadı".
   **İstisna:** Ayna ve Koruma gizli kalır; tetiklenince (sonuç ekranında) açılır. Hiç tetiklenmeyen Ayna/Koruma hiç açıklanmaz; kart yine de yanmıştır.
4. **Kapsam:** oynanan kart yalnız o mini oyunun `awards` hesabını etkiler; metni başka bir şey söylüyorsa (Geniş Seçim, Veto, Oyunu Seç, Kart Çal) o kadarını.
   Oynanan kart (etkisi olsun olmasın) **yanar**; elde kalmaz.
5. **Oyunu iptal / oyuncu ayrılması:** oyun hatası maçı bitirir (ayrı bir "oyun iptali" yoktur): bütün kart durumu maçla birlikte silinir, oynanan kartlar **kaybolur**,
   puan değişmez. Oyuncu odadan ayrılırsa: kendi kartı etkisiz kalır, hedefi olduğu kartlar etkisiz kalır (kart yanar, satırda "etkisiz" yazar), ayrılan oyuncunun puanı
   zaten hesaba katılmaz. Bağlantısı yalnız koptuysa (odada duruyorsa) katılımcı sayılmaya devam eder.

## K5. Kartlar

Sıradan (turkuaz çerçeve, 1 elmas):

| Kimlik | Ad | Metin | Tür |
|---|---|---|---|
| kalkan | Kalkan | Eksiye düşersen 0 sayılır | |
| sigorta | Sigorta | Sonuncu olursan +1 | |
| takviye | Takviye | Oyun sonunda +1 | |
| kendine-guven | Kendine Güven | Birinci olursan +2, olamazsan −1 | |
| tahmin | Tahmin | Bir oyuncu seç; o birinci olursa +2 | hedef |
| ortaklik | Ortaklık | Seçtiğin oyuncuyla bu oyundaki puanlarınızın toplamı ikinize eşit bölünür | hedef |
| koruma | Koruma | Seçtiğin oyuncuya (ya da kendine) bu oyunda saldırı kartı işlemez | hedef (kendin dahil), gizli |
| ayna | Ayna | Sana oynanan ilk saldırı saldırana döner | gizli |
| vergi | Vergi | Seçtiğin oyuncu puan alırsa 1 puanı sana geçer | hedef, saldırı |
| celme | Çelme | Seçtiğin oyuncu −1 | hedef, saldırı |
| veto | Veto | Sıradaki oyunlardan birini listeden çıkar | oyun seç |
| genis-secim | Geniş Seçim | Bir sonraki kart seçiminde 4 kart görürsün | |

Nadir (mor çerçeve, 2 elmas):

| Kimlik | Ad | Metin | Tür |
|---|---|---|---|
| cift-puan | Çift Puan | Puanın ×2 (eksi de ×2) | |
| takas | Takas | Oyun sonunda seçtiğin oyuncuyla bu oyunun puanlarınızı değiştirin | hedef |
| oyunu-sec | Sıradaki Oyunu Seç | Bir sonraki mini oyunu sen belirlersin | oyun seç |
| lanet | Lanet | Seçtiğin oyuncu bu oyundan artı puan alamaz | hedef, saldırı |
| hirsiz | Hırsız | Bu oyunun birincisinden 1 puan al | saldırı |
| kart-cal | Kart Çal | Seçtiğin oyuncunun elindeki rastgele bir kartı al | hedef, saldırı |

Efsanevi (altın çerçeve, 3 elmas):

| Kimlik | Ad | Metin | Tür |
|---|---|---|---|
| altin-dokunus | Altın Dokunuş | Puanın ×3 (eksi etkilenmez) | |
| ters-kose | Ters Köşe | Bu oyunun sıralaması tamamen tersine döner | |

Kötü (kırmızı çerçeve, kırık elmas işareti; ayrı olasılık, ele girmez):

| Kimlik | Ad | Etki |
|---|---|---|
| talihsizlik | Talihsizlik | Sonraki oyunda −1 |
| agir-yuk | Ağır Yük | Sonraki oyunda puanın yarıya iner |
| hayirsever | Hayırsever | Sonraki oyunda puan alırsan 1'i sonuncuya gider |
| acik-hedef | Açık Hedef | Sonraki oyunda sana oynanan saldırılar iki kat etkili |
| bos-el | Boş El | Elindeki rastgele bir kart yanar (hemen) |
| kor-secim | Kör Seçim | Bir sonraki seçimde kartlar ters gelir, görmeden seçersin |
| sessizlik | Sessizlik | Bir sonraki kart seçimini kaçırırsın |
| kumarbaz | Kumarbaz | Sonraki oyunda −2, ama bir sonraki seçimde 2 kart alırsın |
| lanetli-hediye | Lanetli Hediye | Sonraki oyunda −1, ama bir sonraki seçimde nadir ve efsanevi kart çıkma şansın artar |

**Saldırı kartları** (⚔): Vergi, Çelme, Lanet, Hırsız, Kart Çal. Oynandıklarında herkese açıktır; Koruma, Ayna ve Açık Hedef yalnız bunlarla etkileşir.

## K6. Hesaplama sırası (kesin)

Oyun bitince sunucu, oyunun ham `awards` değerinden başlar ve aşağıdaki adımları **bu sırayla** uygular. Her adım bir önceki adımın çıktısı üzerinde çalışır.
Aynı türden birden çok kart varsa **oynanma sırasıyla** (kart oynayanlar arasında anlatım sırasında kim önce oynadıysa) işlenir.
Bekleyen kötü kartlar, oyuncunun kendi adımında kart gibi işler ("sahip" oyuncudur).

**Sıralama tanımı.** "Birinci", mini oyun puanı (`miniScores`) en yüksek olan oyuncu(lar)dır; "sonuncu", puanı en düşük olan oyuncu(lar)dır. Berabere kalanlar sırayı paylaşır
(hepsi birinci / hepsi sonuncu). Herkesin puanı eşitse herkes birincidir ve kimse sonuncu değildir. Yalnız oyuna katılanlar sayılır.

0. **Etkisiz kartlar:** sahibi (ya da hedefi, ortağı) odadan ayrılmış kart etkisizdir ve aşağıdaki adımlarda atlanır.
1. **Ters Köşe:** katılımcılar mini oyun puanına göre dizilir (yüksekten düşüğe; eşitler tek grup). Her oyuncu, kendi sırasının **aynadaki sırasının**
   ham ödülünü alır (n oyuncuda r. sıradaki, n+1−r. sıradakinin ödülünü). Beraberlik grubunun toplam ödülü, aynadaki sıraların ödüllerinin toplamıdır ve grup içinde
   eşit bölünür; bölümden artan puanlar (alt tamsayıya yuvarlanmış bölümün kalanı) katılım sırasındaki ilk üyelerden başlayarak +1 verilir (toplam korunur). Birden çok Ters Köşe oynanırsa her biri tekrar tersler (çift sayıda eski haline döner).
2. **Takas:** sahip ile hedef, o ana kadarki ödüllerini değiştirir.
3. **Ortaklık:** sahip ile hedefin ödülleri toplanır ve ikiye bölünür. Toplam tekse tek puan **mini oyun puanı yüksek olana** (eşitse kartı oynayana) gider;
   yani tek puan iyi oynayana kalır; eksi toplamda da iyi oynayan daha az kaybeder (−3 → iyi taraf −1, kötü taraf −2). Toplam korunur.
4. **Çarpanlar:** her oyuncuya sırayla: Ağır Yük (puan ikiye bölünür, sıfıra doğru yuvarlanır: 3→1, −3→−1, 1→0), Çift Puan (×2, eksi de ×2), Altın Dokunuş (×3, yalnız pozitif puanda).
5. **Sabit eklemeler** (her oyuncuya, hepsi birlikte): Takviye +1; Sigorta: sonuncuysa +1; Kendine Güven: birinciyse +2 değilse −1; Tahmin: hedefi birinciyse +2;
   Talihsizlik −1; Kumarbaz −2; Lanetli Hediye −1.
6. **Saldırılar**, oynanma sırasıyla, her biri o anki ödüller üzerinde:
   - **Koruma:** hedefi (kim korursa korusun, bir oyuncuya birden çok Koruma da olabilir) koruyan bir Koruma varsa saldırı **işlemez**; Koruma açılır ("korundu").
   - **Ayna:** hedefte Ayna varsa ve henüz tetiklenmediyse saldırı, roller değişerek **saldırana** uygulanır (Ayna sahibi saldıran, saldıran da hedef rolünü alır); Ayna açılır ve tüketilir.
     Yansıyan saldırı yeniden yansıtılamaz; saldıranın Koruması varsa yansıyan saldırı da işlemez.
   - **Açık Hedef:** saldırıdan etkilenen oyuncunun Açık Hedef'i varsa sayısal etki iki katıdır (Çelme −2, Vergi 2 puan, Hırsız 2 puan). Lanet ve Kart Çal'ı etkilemez.
   - **Çelme:** hedef −1. **Lanet:** hedefin ödülü 0'dan büyükse 0 olur. **Vergi:** hedefin ödülü 0'dan büyükse 1 puan (Açık Hedef ile 2, ödülü aşamaz) sahibine geçer.
     **Hırsız:** oyunun birincisinden 1 puan (Açık Hedef ile 2) sahibine geçer; birinci birden çoksa sahibi dışındaki birinciler arasında o ana kadarki ödülü **en yüksek** olandan alınır
     (eşitse katılım sırasındaki ilkinden); sahibi tek birinciyse etkisizdir. Hırsız puanı eksiye de düşürebilir. **Kart Çal:** hedefin elindeki rastgele bir kart sahibinin eline geçer
     (hedefin eli boşsa etkisiz). Sahibin elinde yer yoksa çalınan kart yanar. Rastgelelik maç tohumundan türetilir.
7. **Hayırsever:** ödülü 0'dan büyük olan Hayırsever sahibi, 1 puanı sonuncuya verir (sahibinin kendisi sonuncuysa ya da kimse sonuncu değilse etkisiz; sonuncu birden çoksa
   o ana kadarki ödülü en düşük, eşitse katılım sırasındaki ilk oyuncu).
8. **Kalkan (en son):** Kalkan sahibinin ödülü 0'ın altındaysa 0 olur.

Sonuç ekranı, her oynanan ya da işleyen kart için bir **etki satırı** gösterir: "Çift Puan: +2 → +4" gibi (önceki → sonraki ödül), ya da "korundu" / "yansıdı" / "etkisiz".
Oyuncunun genel skoru bu sonuçlarla artar; hesap istatistiğindeki maç puanı kartların etkisini içerir.

## K7. Maç listesini değiştiren kartlar

1. **Veto:** oynayan, henüz oynanmamış sonraki oyunlardan birini seçer. Yalnız **sonra en az 2 oyun kalıyorsa** oynanabilir (Veto asla şimdiki oyunu son oyun yapmaz).
   Kesinleşirken oynanma sırasıyla uygulanır; seçilen oyun artık listede değilse ya da çıkarınca 1'den az oyun kalacaksa etkisiz (kart yanar). Liste kısalır, "Oyun x / y" güncellenir.
2. **Sıradaki Oyunu Seç:** yalnız sonraki bir oyun varsa oynanabilir. Seçilebilen oyunlar: kapalı olmayan, bu maçta henüz **oynanmamış**, o anki bağlı oyuncu sayısına uyan ve rastgele
   havuzda olan (ya da zaten bu maçın listesinde bulunan) oyunlar. Seçilen oyun listede **sonraki** sıraya gelir: listede başka bir yerdeyse oradan çıkarılıp öne alınır
   (liste uzunluğu aynı), listede yoksa şimdiki sıradaki **sonraki** oyunun yerini alır. Aynı anlatımda birden çok Oyunu Seç oynanırsa **ilk oynanan** geçerlidir, ötekiler etkisizdir.
3. Manuel seçimde host'un lobideki listesi korunur: liste değişiklikleri yalnız bu maçı etkiler, lobiye dönünce host'un seçimi geri gelir.

## K8. Lobi ayarı: Kartlar

- Host, lobide **Kartlar** ayarını açar: ana anahtar (varsayılan **açık**) ve her kart için ayrı anahtar (hepsi varsayılan **açık**; iyi ve kötü kartlar dahil istediğini kapatabilir).
- Ayar odada kalır (maç bitip lobiye dönünce korunur); misafirler ayarı yalnız **okur**. Ayar yalnız lobide değişir; maç başlarken sabitlenir.
- Ana anahtar kapalıysa ya da hiçbir kart etkin değilse Kart seçimi aşaması yoktur.
- Kapatılan kart çekilişe girmez; elde zaten bulunan bir kart maç içinde kapatılamaz (ayar maç başında sabitlenir).

---

# A. Daha önce kilitlenen oyunlar

## 1. Yazı Yaz — `yazi-yaz`

**Durum: KİLİTLİ**

- Amaç: İki yazanın kendi kelimelerini gizlice yazdığı, diğer oyuncuların
  `MASUM` yazarak doğal görünmeye çalıştığı ve sonrasında yazan/kelime
  tahminlerinin yapıldığı sosyal çıkarım oyunu.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Yazma aşamasında tam **iki yazan** bulunur; her yazan kendi gizli kelimesini
  yazar.
- Diğer oyuncular girişe `masum` yazar. Giriş otomatik büyük harfe çevrilir;
  küçük/büyük harf farkı oynanışı etkilemez.
- Aşamalar: **30 saniye yazma → 60 saniye sözlü tartışma → 30 saniye tahmin**.
- Masum oyuncu yalnızca **bir yazanı ve o yazanın kelimesini** tahmin eder.
- Her yazan, diğer yazanı ve diğer yazanın kelimesini tahmin eder.
- Doğru kelime tahmini genel skora **+1**.
- Doğru yazan tahmini genel skora **+1**.
- Yazan oyuncu da diğer yazanın kişisini ve kelimesini doğru bilirse aynı
  `+1 kelime / +1 yazan` mantığıyla puan alır.
- Tahmin göndermeyen oyuncu eksi almaz; yalnızca artı puan alamaz.
- Kelimeler oyuncular tarafından yazılır; iki yazanın aynı kelimeyi yazmasına
  izin verilir.
- Ayrı bir beraberlik veya final bonusu yoktur; puanlar genel skora doğrudan
  eklenir.
- Tutorial/görsel ayrıntıları:
  1. İki oyuncunun gizli yazan rozeti yanar; diğer oyuncular `MASUM` kartını
     doldurur.
  2. Neon yazı panoları kapanır ve herkes sözlü tartışmaya geçer.
  3. Oyuncular bir yazanı ve onun kelimesini seçer; doğru kişi ve doğru kelime
     ayrı ayrı parlayan puan jetonlarına dönüşür.
  Görsel: Ortada iki kilitli neon yazı makinesi, çevrede sekiz karakter portresi;
  sonuçta doğru kartta yeşil tarama, yanlış kartta kısa kırmızı glitch kullanılır.

## 2. Kendim — `kendim`

**Durum: KİLİTLİ**

- Amaç: Herkesin kendisini anlatan bir kelime yazması ve karıştırılan kelime
  kartlarını doğru oyuncularla eşleştirmesi.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Aşamalar: **30 saniye kelime yazma → 30 saniye eşleştirme**.
- Her oyuncu kendisini anlatan tek bir kelime yazar.
- Kelimeler kart olarak karıştırılır; kartın sahibi doğrudan gösterilmez.
- Tüm kartları eşleştirmek zorunlu değildir.
- Oyuncu kendi kelimesini kendisiyle eşleştiremez.
- Aynı kelimeyi birden fazla oyuncu yazabilir.
- Doğru eşleştirme mini oyun puanına **+1**.
- Her yanlış eşleştirme mini oyun puanına **-1**.
- Boş bırakılan veya eşleştirilmeyen kart **0**.
- Bir kelimeyi yalnızca bir oyuncu doğru sahibine eşleştirirse kelime sahibi
  mini oyun puanına **+1 bonus** alır.
- Aynı kelimeyi iki veya daha fazla oyuncu doğru eşleştirirse kelime sahibi
  bonus alamaz. Kimse bulamazsa da bonus alamaz.
- Hiç tahmin yapmayan oyuncu **0** mini oyun puanı alır; eksi veya artı almaz.
- Mini oyun puanı en yüksek olan oyuncu/oyuncular genel skorda **+1** alır.
- En yüksek mini oyun puanı eşitse, eşit olanların tamamı genel skorda **+1**
  alır.
- Tutorial/görsel ayrıntıları:
  1. Herkes kendini anlatan tek kelimeyi gizlice yazar.
  2. Karıştırılmış kelime kartlarını oyuncu portreleriyle eşleştir.
  3. Doğru eşleşmeler puan ışığı yakar; yanlış seçimler tahtada kırmızı iz bırakır.
  Görsel: Havada dönen hologram kelime kartları, portrelere bağlanan neon ipler
  ve doğru bağlantıda yumuşak enerji patlamaları.

## 3. Sızma — `sizma`

**Durum: KİLİTLİ**

- Amaç: Bir sızma oyuncusunun farklı kelimesini ipuçlarından fark etmek.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Sistem geniş kelime havuzundan ortak kelime ve farklı sızma kelimesi seçer.
- Tam bir sızma bulunur; sızma farklı kelimeyi, diğerleri ortak kelimeyi görür.
- Yazılı ipucu yoktur. Aynı ortamda herkes sırayla ipucunu **sesli** söyler.
- Her oyuncu iki ipucu turunda da birer kez ipucu verir; toplam iki ipucu
  zorunludur.
- İpucu verme aşaması zamanlayıcısızdır ve sırayla ilerler.
- Herkes ekrandaki “Oylamaya geç” düğmesine bastığında oylama başlar.
- Her oyuncu raunt sonunda yalnızca **bir kişiye** oy verir.
- Kendine oy vermek serbesttir.
- Oylama süresi **30 saniye**.
- Sızma yakalanırsa normal oyuncuların her biri genel skorda **+1**, sızma
  **0** alır.
- Sızma yakalanmazsa sızma **+2**, diğerleri **0** alır.
- Yanlış oylar eksi puan doğurmaz.
- Oylar eşitse sızma kazanır; eşit adayların içinde sızma olsa da olmasa da
  sonuç sızmanın kazanmasıdır.
- Eksik ipucu veya geçiş düğmesine basmama için arkadaş grubu kullanımında
  özel ceza kuralı yoktur.
- Tutorial/görsel ayrıntıları:
  1. Çoğunluk aynı kelimeyi, bir sızma oyuncusu farklı kelimeyi görür.
  2. İki ipucu turunda sırayla yüksek sesle ipucu ver.
  3. Oylamaya geç düğmesine bas; süre bitmeden sızma oyuncusunu seç.
  Görsel: Ortak kelime kristali etrafında dönen karakter maskeleri; sızmanın
  maskesi diğerlerinden farklı bir renk sızıntısıyla kısa süreli görünür.

**Değişiklik (O11, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Oylama bitince sızma açıklanmadan önce kısa bir **"fark ettin mi?" aşaması** (**8 saniye**) gelir. Her oyuncu, sızmanın kim olduğunu
  ele vermemek için **herkese birden** gizlice "Sızma sen miydin?" sorusunu **Evet / Hayır** diye yanıtlar. Cevap tek seferliktir.
  Cevap vermeyen "Hayır" sayılır. Herkes cevap verince aşama erken biter.
- **Sızma "Evet" dediyse genel skorda ek +1 alır** (yakalansın ya da yakalanmasın; yakalanırsa 0+1, kurtulursa 2+1).
  Sızma olmayanlar hangi cevabı verirse versin puan almaz, kaybetmez.
- Cevaplar sızma açıklandıktan sonra açılır, yalnız sızmanın cevabı gösterilir: **"Sızma kendini fark etti!"** ya da
  **"Sızma kendini fark etmedi"**. Diğer oyuncuların cevapları hiçbir zaman açılmaz.
- Tutorial adımı 3: "Oylamaya geç, sızmayı bul; sonda 'Sızma sen miydin?' sorusunu yanıtla."

## 4. Sözlük Blöfü — `sozluk-blofu`

**Durum: KİLİTLİ**

- Amaç: Garip bir kelimenin gerçek tanımını sahte tanımlar arasından bulmak ve
  diğer oyuncuları kandırabilmek.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Bu oyuna özel geniş bir kelime/tanım havuzu bulunur.
- Sistem bir kelime ve gerçek tanım seçer.
- Her oyuncu bir sahte tanım yazar; sahte tanım yazmak zorunludur.
- Tanımlar serbest metindir ve **100 karakter** sınırı vardır.
- Aşamalar: **50 saniye sahte tanım yazma → 30 saniye tanım seçme**.
- Gerçek tanım ve tüm sahte tanımlar tamamen karıştırılmış şekilde gösterilir.
- Her oyuncu yalnızca bir tanım seçer.
- Oyuncu kendi yazdığı blöfü seçemez.
- Gerçek tanımı seçen oyuncu mini oyun puanına **+1** alır.
- Yanlış seçim **0** puandır; eksi yoktur.
- Bir oyuncunun blöfü seçildiğinde blöf sahibi, her seçim için ayrı ayrı **+1**
  mini oyun puanı alır.
- Ayrı final/beraberlik bonusu tanımlanmadı; mini oyunun kendi puanı sonuçta
  genel skora aktarılacaktır.
- Tutorial/görsel ayrıntıları:
  1. Ekrandaki garip kelimeyi ve gerçek tanımın biçimini incele.
  2. Kendi sahte tanımını kısa ve inandırıcı yaz.
  3. Karıştırılmış tanımlardan birini seç; kandıran blöfler jeton toplar.
  Görsel: Ortada dönen sözlük küresi, çevresinde mühürlü tanım kartları ve
  seçilen kartın arkasından çıkan mavi/amber mürekkep efekti.

## 5. Çağrışım Ağı — `cagrisim-agi`

**Durum: KİLİTLİ**

- Amaç: Ortak ana kelimeye aynı veya benzer çağrışımı vererek bir grup
  oluşturmak.
- Minimum oyuncu: **2**.
- Maksimum oyuncu: **8**.
- Bu oyuna özel geniş çağrışım/ana kelime havuzu bulunur.
- Sistem herkesin gördüğü ortak bir ana kelime seçer.
- Her oyuncu yalnızca **bir** çağrışım yazar.
- Çağrışım yazmak zorunludur; serbest metindir ve karakter sınırı yoktur.
- Faz süresi **30 saniye**.
- Türkçe büyük/küçük harf ve fazla boşluk normalizasyonu aynı cevapları adil
  biçimde gruplamak için teknik olarak uygulanır.
- En az iki kişinin aynı normalleştirilmiş cevabı vermesi grup oluşturur.
- Grup üyelerinin her biri, grubun oyuncu sayısı kadar mini oyun puanı alır.
- Tek kalan cevap **0** puandır.
- Yanlış cevap diye ayrı bir durum yoktur; negatif puan yoktur.
- Birden fazla çağrışım gönderilemez.
- Tutorial/görsel ayrıntıları:
  1. Ortak ana kelimeyi gör.
  2. Aklına gelen tek çağrışımı zorunlu olarak gönder.
  3. Aynı çağrışımı verenlerle ağ oluştur; tek kalan cevap puan alamaz.
  Görsel: Ana kelimeden yayılan elektrikli bir merkez ve oyuncu portrelerini
  bağlayan neon düğümler; aynı cevaplar aynı renkte kümelenir.

**Değişiklik (sahip onayı, Ekim 2026):** Gruplama klavyeden bağımsızdır (kaşık = kasik = KASIK). Bir grupta
farklı yazılışlar varsa açılışta **Türkçe harf içeren yazılış** (kaşık) gösterilir; eşitlikte ilk cevap veren.

## 6. Butona Bas — `butona-bas`

**Durum: KİLİTLİ**

- Amaç: Oyuncuların aynı anda büyük kırmızı butona basarak eşleşme yakalaması.
- Minimum oyuncu: **2**.
- Maksimum oyuncu: **8**.
- Toplam süre **45 saniye**.
- Zaman pencereleri **0,3 saniye** uzunluğundadır.
- Aynı pencerede iki veya daha fazla farklı oyuncu basarsa, o penceredeki
  basanların her biri mini oyun puanına **+1** alır.
- Bir pencerede yalnızca tek oyuncu basarsa o oyuncu **-1** alır.
- Hiç kimse basmazsa puan değişmez.
- Aynı oyuncunun aynı pencere içindeki tekrar basışları tek oyuncu sayılır.
- Puanlama 45 saniye boyunca bütün pencerelerde devam eder.
- Mini oyun puanı sıralamasında tek lider varsa lider genel skorda **+2**,
  sonraki sıradaki oyuncu **+1** alır.
- En yüksek mini oyun puanı eşitse, en yüksek puanı paylaşanların tamamı
  genel skorda **+1** alır; bu durumda liderlere +2 verilmez.
- Örneğin dört oyuncunun da mini oyun puanı 5 ise dördü de genel skorda +1 alır.
- Tutorial/görsel ayrıntıları:
  1. Büyük kırmızı butonu hazırla.
  2. Aynı kısa zaman penceresinde arkadaşlarınla basış yakalamaya çalış.
  3. Grup basışı yeşil enerji verir; tek basış geri teper ve puan düşürür.
  Görsel: Ortada ağır, parlak kırmızı arcade butonu; her basışta 0,3 saniyelik
  halka dalgası görünür, eşleşen avatarlar aynı ritimde parlar.

**Değişiklik (O8, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Oyun **3 turdan** oluşur. Pencere uzunluğu turdan tura daralır: **1. turda 300 ms, 2. turda 200 ms, 3. turda 120 ms.**
  Ekranda "Tur 1/3" gibi tur numarası ve 2. ile 3. turun başında "Pencere daralıyor" uyarısı görünür.
- Her tur **15 saniye** sürer (3 tur = toplam 45 saniye oyun süresi, eskisi gibi); turlar arasında 3 saniyelik ara vardır
  ve ara sırasında basışlar sayılmaz. Pencereler her turun başından itibaren sayılır.
- Her tur mevcut tur mantığıyla puanlanır: eşleşen pencerede basanların her biri +1, tek başına basan −1, kimse basmazsa
  değişmez, aynı pencerede tekrar basış tek sayılır. Bu puanlar **mini oyun puanına turlar boyunca toplanır**.
- **Genel skor yalnız oyun sonunda bir kez**, 3 turun mini toplamına göre ve mevcut dönüşümle verilir (tek lider +2,
  sonraki sıradaki +1; en yüksek toplam eşitse paylaşanların hepsi +1 ve +2 verilmez). Tur başına genel skor yazılmaz;
  böylece 3 tur genel skoru şişirmez.
- Tutorial adım 3: "3 tur oynanır; pencere 300, 200, 120 ms diye daralır."

## 7. Rus Ruleti — `rus-ruleti`

**Durum: KİLİTLİ**

- Amaç: Silahın patlama riskini göze alarak hedef seçmek ve mini oyun sonunda
  hayatta kalmak.
- Minimum oyuncu: **2**.
- Maksimum oyuncu: **8**.
- Tur başında bütün oyuncular hayattadır ve silahın ilk sahibi rastgele seçilir.
- Yalnızca silahı tutan oyuncu ateş edebilir.
- Silahı tutan oyuncu kendisini veya hayatta olan başka bir oyuncuyu hedefleyebilir.
- Patlama riski **%16** ile başlar.
- Atış patlamazsa silah doğrudan hedefe geçer; kişi kendisini hedeflediyse
  silah aynı kişide kalır.
- Her patlamayan atışta risk **10** artar ve en fazla **%76** olur.
- Atış patlarsa hedef elenir, risk **%16** değerine döner ve oyun devam
  ediyorsa silah rastgele hayatta kalan birine verilir.
- Hayatta kalan sayısı başlangıç oyuncu sayısının yarısına veya altına
  düştüğünde oyun biter.
- Her karar süresi **18 saniye**.
- Süre dolarsa mümkünse silah sahibini hedeflemeyen rastgele bir hayatta
  oyuncuya otomatik ateş edilir.
- Elenen oyuncular mini oyun bitene kadar yalnızca izleyicidir.
- Oyun sonunda hayatta kalanların her biri genel skorda **+1**, elenenler **0**
  alır.
- Sabit tur sayısı yoktur; yarı eşiğine ulaşılana kadar sürer.
- Tutorial/görsel ayrıntıları:
  1. Silah rastgele bir oyuncunun panelinde belirir.
  2. Silah sahibi hayatta olan bir hedef seçer; risk her güvenli atışta yükselir.
  3. Patlama hedefi eler, silah el değiştirir; sonunda hayatta kalanlar puan alır.
  Görsel: Dönen neon tabanca, risk yüzdesini taşıyan kırmızı halka ve patlamada
  kısa kamera sarsıntısı; elenen karakterler yarı saydam izleyici kartına geçer.

**Değişiklik (O9, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Elenen oyuncular (mini oyun bitene kadar izleyici) **her atıştan önce** o atış için tek bir tahmin verebilir:
  **"Patlar mı?" — Evet / Hayır**. Atış başına tek tahmin; verilen tahmin değiştirilemez. Hayatta olanlar ve oyuna
  katılmayan izleyiciler tahmin veremez.
- Tahmin **puan vermez**. Mini oyun sonunda **"Kâhin"** rozeti, en az bir kez **"Evet, patlar" deyip bilen** ve
  **"Evet" tahminlerinin en az yarısı doğru çıkan** elenene verilir ("Hayır" tahminleri rozete sayılmaz; çoğu atış zaten
  boş geçer). Rozet yalnız mini oyun sonuç ekranında, herkese açık gösterilir. (Eşik güncellemesi, Ekim 2026, sahip onayı.)
- Tahminler ve doğru sayıları mini oyun bitene kadar yalnız sahibinin ekranındadır (sahibi her atıştan sonra yalnız
  "Bildin!" / "Bilemedin" görür); başkalarına ve herkese açık görünüme geçmez. Tahmin atışın sonucunu etkilemez.
- Genel skor değişmez: hayatta kalanlar +1, elenenler 0.

---

# B. Toplu formdan kilitlenen oyunlar

Aşağıdaki eski kaynak özetleri yeni kural değildir. Her oyunun altındaki alanları
doldururken eski fikri aynen koruyabilir, değiştirebilir veya tamamen yeniden
tanımlayabilirsin.

## 8. Gizli Hırsız — `gizli-hirsiz`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Herkes ortak kasayı görür ve doğru anı bekler. Yalnızca
bir kişi hamle yaparsa o oyuncu +1 alır; birden fazla kişi hamle yaparsa hamle
yapanlar ceza alır. Eski faz 15 saniyelik tek hamle aşamasıdır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Oyunun amacı ve kazanma koşulu: [Kasanın içindekileri çalmak hedef ama 1 kişi çalabilir , 1 den fazla kişi çalmaya çalışırsa çalmaya çalışanlar ceza olarak -1 puan alır]
3. Başlangıçta ne olur; kasa veya hedef nasıl hazırlanır?: [kasa veya hedef yok herkesin ekranında ÇAL butonu olur ve diğer oyuncuların basıp basmadığı gözükmez]
4. Oyuncunun yaptığı ana hamle nedir?: [Çalmak]
5. Her oyuncu kaç kez hamle yapabilir; tekrar hamle serbest mi?: [1 kez hamle yapılır , Hayır oyunun amacını üst sorularda cevap verdim]
6. Hamleler tur bitene kadar gizli mi, anlık görünür mü?: [tur sonuna kadar gizli]
7. Aşamalar ve her aşamanın süresi: [tek bir aşaam ve 30 saniye]
8. Süre dolunca veya oyuncu hamle yapmayınca ne olur?: [puanında değişiklik olmaz]
9. Mini oyun puanı; tek kişi, çok kişi, kimse ve yanlış hamle puanları: [tek kişi çalmaya karar verirse +1 puan , birden fazla kişi çalmaya çalışırsa onlara -1 puan , çalmaya çalışmayanlar puan almaz , yanlış hamle diye birşey yok]
10. Mini oyun puanı genel skora nasıl aktarılır?: [yukarda ki puanlamalar zaten direkt genel puana etki edecek puanlar]
11. Beraberlik ve eşit puan davranışı: [beraberlik olayı yok oyunda]
12. Turun kesin bitiş koşulu: [süre dolması]
13. 10 saniyelik tutorialda gösterilecek üç kısa adım:
    1. Gizli `ÇAL` butonunu bekle.
    2. İstediğin anda yalnızca bir kez bas.
    3. Tek kalan oyuncu +1 alır; birden fazla hırsız -1 alır.
14. Sahne, karakter, kasa, ışık ve animasyon fikirleri: Ortada içi görünmeyen
    holografik bir kasa yerine karanlık bir “güvenlik çekirdeği” bulunur.
    Oyuncu butona basınca kendi ekranında sessiz bir parmak izi belirir; diğer
    ekranlarda hiçbir tepki görünmez. Sonuçta çekirdek açılır, tek basış yeşil
    ışıkla ödüllenir, çoklu basış kırmızı alarm ve kısa glitch ile gösterilir.
15. Özel durumlar veya istemediğin davranışlar: Sunucu her oyuncunun ilk
    geçerli basışını zaman damgasıyla kaydeder; ikinci basış yok sayılır. Basış
    sonucu tur bitene kadar hiçbir oyuncuya açılmaz. Süre dolduğunda kimse
    basmadıysa bütün oyuncular 0 alır.

## 9. Kör Kronometre — `kor-kronometre`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Gerçek sayaç görünmez. Oyuncu içinden sayarak hedeflenen
10. saniyede basmaya çalışır. Eski kaynakta hedefe en yakın oyuncu +2, ikinci
en yakın oyuncu +1 alır; tek faz 18 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Hedef süre kaçıncı saniye veya milisaniye?: [10]
3. Oyuncu hangi butona veya hamleye ne zaman basar?: [ekranında ki butona istediği zaman basar amaç 10.saniyeye en yakın basmak]
4. Gerçek sayaç tamamen gizli mi; ekranda hangi görsel ipuçları olabilir?: [tamamen gizli]
5. Oyuncu bir kez mi, birden fazla kez mi basabilir?: [1 kez basabilir]
6. Aşamalar ve toplam süre: [18 saniye ve tek aşama]
7. Süre dolunca basmayan oyuncunun zamanı nasıl kabul edilir?: [18 olarak kabul edilir]
8. Hedefe en yakın oyuncu/oyuncuların mini oyun puanı: [direkt genel puana eklenir en yakın basana +2 ikinci yakın basana +1]
9. Eşit uzaklıkta puan nasıl paylaşılır?: [eşit uzaklık zor milisaniye farkı illa olur]
10. Genel skora aktarım ve final bonusu: [8.soruda cevapladım]
11. Turun bitiş koşulu: [süre dolması]
12. Tutorialda gösterilecek üç adım:
    1. Sayaç ve hedef zaman ekranda görünmez.
    2. İçinden 10 saniyeyi say.
    3. Tek basışını doğru anda yap; en yakın +2, ikinci yakın +1 alır.
13. Kronometre, neon ekran ve karakter animasyonu fikirleri: Karanlık bir
    kronometre kadranında yalnızca tek bir neon nabız görülür; gerçek rakamlar
    yerine oyuncunun çevresindeki halka yavaşça dolar. Basış anında halka
    donar, sonuçta hedefe uzaklık çizgileri bütün oyuncuların kartlarına düşer.
14. Özel durumlar: Hiç basmayan oyuncu teknik olarak 18. saniyede basmış kabul
    edilir. Sunucu zamanı esas alınır; oyun süresinden sonra gelen istek kabul
    edilmez. Eşit mesafe olağan dışı biçimde oluşursa aynı dereceyi paylaşanlar
    aynı ödülü alır, sonraki derece atlanır.

**Değişiklik (O6, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Hedef süre her turda **7 ile 13 saniye arasında rastgele bir tam saniye** seçilir ve oyun başında herkese
  gösterilir ("Hedef: 11 saniye"). Gerçek sayaç yine tamamen gizlidir.
- Aşama süresi **hedef + 8 saniye**dir (hedef 10 iken eskisi gibi 18 saniye).
- **Hiç basmayan oyuncu sıralamaya girmez**, puan almaz ve hedefe en yakın sayılamaz (eski "18. saniyede basmış
  kabul edilir" kuralı kalkar). Ödüller yalnız basanlar arasında dağıtılır: en yakın +2, ikinci en yakın +1.
  Tek kişi bastıysa yalnız o +2 alır; kimse basmadıysa kimse puan almaz.
- Tutorial adımı 2: "İçinden hedef süreyi say."

## 10. Kör Bomba — `kor-bomba`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Bomba bir oyuncuda başlar. Bombayı taşıyan kişi gerçek
patlama süresini göremez; diğerleri gerçek kalan süreyi görür ve sözlü olarak
doğruyu söyleyebilir veya yanıltabilir. Bomba sahibinin pas vererek başka bir
oyuncuya devretmesi eski akışta mümkündür. Eski aşama 16 saniyedir ve sürede
bomba kimdeyse o oyuncu 0, diğerleri +1 alır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Bomba başlangıçta kime veya nasıl verilir?: [rastgele kişiye]
3. Gerçek patlama süresi hangi aralıktan seçilir?: [ilk verildiğinde 15-20 saniye arası patlama süresi]
4. Bombayı taşıyan ve diğer oyuncular tam olarak ne görür?: [Bomba sahibi
   patlama anını ve kalan sayacı göremez. Diğer oyuncular gerçek patlama zamanını
   ve kalan süreyi görür. Taşıyıcıda yalnızca bombanın tehlikeli ışığı bulunur.]
5. Bomba sahibi kime, ne zaman ve kaç kez pas verebilir?: [Başka bir hayatta
   olan oyuncuya istediği anda ve sınırsız kez pas verebilir; kendisine pas
   veremez. Pas yalnızca o anki bomba sahibinin ekranından yapılır.]
6. Pas hamlesi anında mı gerçekleşir; pas sonrası süre değişir mi?: [Pas anında
   gerçekleşir. Her başarılı pas, patlamaya kalan süreye rastgele 1-4 saniye
   ekler; böylece taşıyıcı süreyi ezberleyemez.]
7. Oyuncuların sözlü yönlendirmesi dışında ekranda yazılı bilgi var mı?: [yok]
8. Aşamalar ve süreler: [raunt bomba patlayana kadar devam eder]
9. Süre dolunca bomba kimdeyse ne olur?: [o kişi -1 puan alır diğer oyuncular 0 puan alır bu oyunda + puan yok]
10. Mini oyun puanı; bomba sahibi, diğerleri ve eksik katılım: [9.soruda cevapladım]
11. Genel skora aktarım ve beraberlik: [beraberlik yok 9.soruda puanlamayı anlattım]
12. Elenen veya sadece puansız kalan oyuncu var mı?: [bomba tek seferlik sonra diğer minigame e geçilir]
13. Tutorialda gösterilecek üç adım:
    1. Bomba rastgele bir oyuncuda başlar.
    2. Taşıyıcı zamanı görmez; konuşarak kandırabilir veya ikna edebilirsin.
    3. Pas ver, süreyi uzat; bomba kimde patlarsa o oyuncu -1 alır.
14. Bomba, ışık, geri sayım ve patlama animasyonu fikirleri: Bomba taşıyıcının
    ekranında opak siyah bir çekirdek ve kırmızı nabız olarak, diğer ekranlarda
    ise üstünde gerçek kalan süre bulunan parlak bir küre olarak görünür. Her
    pas kablo üzerinden ışık akışı ve kısa bir “tak” sesiyle aktarılır; eklenen
    süre sarı bir kıvılcım olarak gösterilir. Patlamada yalnız taşıyıcının
    avatarı kısa süreli beyaz silüete dönüşür.
15. Özel durumlar: Patlama ile aynı ana denk gelen pas sunucu sırasına göre
    değerlendirilir; patlama önce işlenirse pas geçersizdir. Pas veren ve alan
    oyuncu bağlantısı koparsa geçerli son sunucu durumu korunur. Bomba tek kez
    patladıktan sonra sonuç ekranı açılır ve bir sonraki mini oyuna geçilir.

**Değişiklik (O9, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Bombayı o an **taşımayan** her katılımcı, bombanın **her taşıyıcı eli** için tek bir tahmin verebilir:
  **"Bu elde patlar"** ya da **"Patlamaz"**. Bu oyunda eleme yoktur; taşıyıcı olmayan herkes hak sahibidir. El başına tek
  tahmin; verilen tahmin değiştirilemez. Bombayı yeni alan oyuncu o elde tahmin veremez; pas verince hak yeni elle döner.
- **"Patlar" tahmini doğruysa** (bomba o taşıyıcının elinde patlarsa) tahminci genel skorda **+1** alır. Bu ödül oyun başına
  oyuncu başına **en çok +1**'dir; yan bahis olarak kalır. "Patlamaz" tahmini ve yanlış tahmin puan almaz/kaybettirmez.
  Bomba sahibi yine −1 alır.
- Tahminler **patlayana ya da pasa kadar gizlidir**; yalnız sahibi kendi tahminini görür. Taşıyıcı hiçbir tahmini öğrenmez,
  böylece blöfünü tahminlere göre ayarlayamaz. Pas olunca her tahminci yalnız kendi sonucunu görür ("Bildin!" /
  "Bilemedin"); patlamada puan alanların adı herkese açılır ("Elif bildi!").
- Gizli patlama süresi gizli kalır: tahmin düğmeleri süreye bağlı değildir (kalan süreye göre açılmaz, kapanmaz, değişmez)
  ve tahmin sunucu tarafında süreden bağımsız işlenir. Tahmin, patlama anından sonra kabul edilmez.

## 11. Rüşvet ve Darbe — `rusvet-darbe`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Gizli oylamayla bir başkan seçilir. Eski kaynakta başkan
 +1 alır ve aldığı oy sayısı kadar dağıtılabilir puan elde eder; tek bir kişiye
en fazla 2 puan verebilir. Eski fazlar 20 saniye başkan seçimi ve 24 saniye
puan dağıtımıdır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Başkan nasıl seçilir; herkes kaç oy verir?: [en çok oy alan başkan seçilir , herkes başkanlık seçiminde 1 oy kullanabilir]
3. Kendine oy vermek serbest mi?: [hayır]
4. Başkan seçimi aşaması ve süresi: [tek aşama , 20 saniye başkan seçimi]
5. Başkanın sahip olduğu dağıtılabilir puan nasıl hesaplanır?: [başkanlık seçiminde kaç oyla başkan olduysa o kadar puan dağatabilir]
6. Başkan puanları kime, kaç puan ve hangi sınırlarla verebilir?: [kendi dışında istediği kişiye , bir kişiye en fazla 2 puan olacak şekilde dağıtması lazım ]
7. Başkan kendi puanını artırabilir mi; dağıtılmayan puan ne olur?: [tüm puanları dağıtmak zorunda kendine veremez , süre sonunda dağıtılmayan puan olursa o puanlar rastgele dağıtılır]
8. Dağıtım aşaması ve süresi: [tek aşama , 25 saniye]
9. Eksik oy veya eksik dağıtımda ne olur?: [başkanlık seçiminde oy vermek zorunlu vermeyen kişilerin oyu rastgele bir kişiye gider ]
10. Başkanın, dağıtılan puanın ve diğer oyuncuların mini oyun puanları: [başkan seçilen kişi direkt +1 genel puan alır ve başkanın dağıttığı puanlarda genel puan olarak işenir]
11. Oylama eşitliği veya başkanlık beraberliği: [Eşit kalan adaylar arasında
    aynı anda taş-kağıt-makas oynanır. Üç adaylı durumda üçü aynı elde işaret
    verir; tek bir işaret diğer iki işareti yeniyorsa o işareti veren adaylar
    devam eder. Üç işaretin de bulunduğu veya herkesin aynı işareti verdiği
    elde sonuç yok sayılır ve yeni el oynanır. İki aday kalırsa normal iki
    kişilik taş-kağıt-makas uygulanır; kazanan başkan olur.]
12. Genel skora aktarım ve final bonusu: [diğer sorularda cevaplandı]
13. Turun bitiş koşulu: [sürelerin dolması]
14. Tutorialda gösterilecek üç adım:
    1. Gizli oyunu ver ve başkanlığı almaya çalış.
    2. Başkan, aldığı oy kadar rüşvet jetonunu başkalarına dağıtır.
    3. Süre bitince başkan +1, dağıtılan jetonlar sahiplerine genel skor olarak
       yansır.
15. Başkanlık koltuğu, rüşvet jetonları ve darbe animasyonları: Seçim ekranında
    sekiz karakterin çevresinde karanlık oy mühürleri döner. Başkanın koltuğu
    seçilince sahneye yükselir; her dağıtılan puan neon bir jeton olarak koltuktan
    ilgili avatara uçar. Eşitlikte kısa bir “darbe düellosu” kartı açılır ve
    taş-kağıt-makas işaretleri aynı anda çarpışır.

**Değişiklik (O3, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Dağıtım bittikten sonra jeton dağılımı açılır ve kısa bir **darbe oylaması** (**10 saniye**) başlar. Başkan dışında, bu raundda
  **hiç jeton almamış (0 jeton)** her oyuncu oy hakkına sahiptir: **"Darbe"** ya da **"Darbe yok"**. Oy gizlidir ve tek seferliktir;
  oy vermeyen "Darbe yok" sayılır. Hak sahibi olanların hepsi oy verince aşama erken biter. **(sahip onayı):** yalnız bağlı hak sahipleri beklenir; kopuk hak sahibi beklenmez. Aynı şekilde düellodaki işaret aşamasında bağlı adayların hepsi işaret verince açılış hemen başlar.
- Hak sahiplerinin **kesin çoğunluğu** (yarıdan fazlası; eşitlik çoğunluk değildir) "Darbe" derse **başkanın bu raunda ait kendi ödülü
  (+1) iptal olur**. Dağıtılan jetonlar etkilenmez. Başkanlığı kaybettirmez, yalnız +1'i siler.
- Hak sahibi yoksa (herkes jeton aldı) bu aşama atlanır.
- Oylar hiçbir zaman açılmaz; yalnız sayı açılır ("Darbe: 3/4"). Hak sahibi olmayanlar aşama sürerken yalnızca
  "Darbe oylaması sürüyor" görür.
- Tutorial adımı 3: "Süre bitince başkan +1 alır (darbe olmazsa), jetonlar sahiplerine yansır. Jeton alamayanlar darbe yapabilir."

## 12. Açgözlülük Limiti — `acgozluluk-limiti`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Her oyuncu 0 ile oyuncu sayısı arasında bir sayı seçer.
Ortak bir limit vardır. Seçimlerin toplamı limiti aşmazsa herkes seçtiği kadar
puan alır; limit aşılırsa eski akışta puan çıkmaz. Eski faz 18 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Oyuncular hangi aralıktan sayı seçer?: [0-oyuncu sayısı]
3. Ortak limit nasıl ve ne zaman belirlenir; herkes aynı limiti görür mü?:
   [Limit oyun başında oyuncu sayısına göre sabit tablodan belirlenir ve herkes
   aynı limiti görür. İlk sürüm dengesi: 3 oyuncu 6, 4 oyuncu 11, 5 oyuncu 17,
   6 oyuncu 24, 7 oyuncu 33, 8 oyuncu 43.]
4. Sayı seçimi gizli mi, seçimler ne zaman açılır?: [sayı seçimi gizli]
5. Aşamalar ve süreler: [tek aşama , 20 saniye]
6. Oyuncu seçim yapmazsa hangi değer kabul edilir?: [0 kabul edilir]
7. Toplam limitin altında kalırsa puanlama: [herkes yazdığı kadar puan alır]
8. Limit aşılırsa puanlama veya ceza: [Toplam seçim ortak limiti aşarsa herkes
   bu mini oyunda 0 alır. En yüksek seçim yapanların tamamı -1 alma şeklindeki
   eski taslak kural uygulanmaz; aşım sonucu tek ve net olarak herkese 0'dır.]
9. Eşitlik ve genel skora aktarım: [Toplam limit aşılmadığında herkes yazdığı
   sayı kadar doğrudan genel skora puan alır. Limit aşımında herkes 0 alır.]
10. Turun bitiş koşulu: [sürenin dolması]
11. Tutorialda gösterilecek üç adım:
    1. Gizli olarak 0 ile oyuncu sayısı arasında bir sayı seç.
    2. Ortak limit barının altında kalmaya çalış.
    3. Toplam limit aşılırsa herkes 0 alır; aşılmazsa seçtiğin sayı kadar puan
       kazanırsın.
12. Ortak enerji/limit barı ve taşma animasyonları: Ortada ortak bir neon
    hazne, her oyuncunun seçimi gizli olduğu için içeri akan jetonların üstü
    kapalı görünür. Sonuç anında hazne açılır; limit çizgisi aşılmamışsa altın
    ışık, aşılmışsa kırmızı çatlak ve kısa “overload” sarsıntısı oynar. Oyuncu
    sayısına göre limit çizgisi ve sayı etiketleri otomatik ölçeklenir.
13. Özel durumlar: Seçim göndermeyen oyuncunun değeri 0'dır. Süre sonunda tüm
    seçimler aynı anda açılır; toplam hesaplanmadan hiçbir oyuncunun seçimi
    diğerine sızmaz. Limit tablosu ilk sürümde sabit tutulur ve maç içinde
    değişmez.

## 13. Ortalamaya En Yakın — `ortalamanin-yarisi`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncular 0–100 arasında sayı seçer. Tur sonunda sayıların
ortalaması hesaplanır ve ortalamaya en yakın seçimler değerlendirilir. Eski
arayüz/kodda en yakın +2, ikinci en yakın +1 alır. Eski faz 18 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Sayı aralığı ve sayıların tam sayı/ondalık olma durumu: [0-100 , tam sayı]
3. Hedef gerçek ortalama mı, ortalamanın yarısı mı, başka bir değer mi?: [hedef ortalamanın yarısı]
4. Seçimler gizli mi; sonuçlar ne zaman görünür?: [gizli oyun sonunda gözükür]
5. Aşamalar ve süreler: [tek aşama , 20 saniye]
6. Oyuncu sayı göndermezse hangi değer veya ceza uygulanır?: [onun yerine 0-100 arası rastgele bir sayı verilir normal oyun akışında devam eder]
7. En yakın oyuncu/oyuncuların mini oyun puanı: [en yakın oyuncu +2 , ikinci yakın +1 puan direkt geneş puana eklenir bunlar]
8. Eşit mesafede puan paylaşımı: [ikinci yakın puanı olmaz ve eşit mesafede en yakın oyuncuların hepsine +1 puan]
9. Genel skora aktarım ve final bonusu: [puanlar direkt genel puana eklenir]
10. Turun bitiş koşulu: [sürenin bitmesi hesaplanması ve puanlanıp bitmesi]
11. Tutorialda gösterilecek üç adım:
    1. Gizli bir sayı seç; hedef doğrudan görünmez.
    2. Sistem sayıların ortalamasının yarısını hesaplar.
    3. Hedefe en yakın +2, ikinci yakın +1 alır; en yakınlar eşitse her biri +1
       alır ve +2 uygulanmaz.
12. Sayı ekranı, ortalama çizgisi ve sonuç animasyonları: Oyuncuların seçtiği
    sayılar sonuçtan önce kapalı neon kapsüller olarak durur. Önce ortalama
    çizgisi, ardından onun yarısını gösteren ikinci bir hedef ışını oluşur;
    oyuncu kapsülleri hedefe uzaklık sırasıyla hedefe bağlanır. En yakın kartlar
    aynı anda altın, ikinci kart mavi ışıkla parlar.
13. Özel durumlar: Cevap göndermeyen oyuncuya sunucu tarafından 0-100 arasında
    rastgele tam sayı atanır ve bu sayı sonuç ekranında normal seçim gibi
    gösterilir. En yakınlık eşitliğinde eşit oyuncuların tamamı +1 alır ve
    ikinci sıra ödülü verilmez; diğer derecelerde eşitlik varsa aynı dereceyi
    paylaşanlar aynı ödülü paylaşır.

**Değişiklik (O5, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Oyun **3 kısa turdan** oluşur. Hedef her turda *o turun ortalaması × çarpan*dır; çarpan sırasıyla **½, ⅔, ¾**
  (1. tur ortalamanın yarısı, 2. tur üçte ikisi, 3. tur dörtte üçü). Çarpan her turun başında herkese gösterilir.
  Sayı aralığı (0-100, tam sayı), seçimlerin süre bitene kadar gizli olması ve göndermeyene sunucunun rastgele sayı
  ataması her tur için aynen geçerlidir (atanan sayı her tur ayrı çekilir).
- **2. turdan itibaren önceki turun ortalaması ve hedefi** seçim ekranında görünür.
- **Seçim süresi** her turda **10 saniyedir** (eski 20 saniyenin yarısı; alt sınır 10 saniye). Tur sonucu turlar
  arasında 5 saniye, son turda 7 saniye ekranda kalır.
- Her tur mevcut yakınlık mantığıyla puanlanır (en yakın tek ise +2, ikinci yakın +1; en yakınlar eşitse hepsi +1 ve
  +2 verilmez) ve bu puanlar **mini oyun puanına turlar boyunca toplanır**. Tur başına genel skor yazılmaz.
- Bu oyunda ayrı bir mini→genel dönüşüm olmadığından **genel skor yalnız oyun sonunda bir kez**, 3 turun mini toplamına
  göre verilir: en yüksek toplam +2, ikinci +1; en yüksek toplam eşitse paylaşanların hepsi +1 (+2 verilmez); ikinci
  sırada eşitlik varsa paylaşanların hepsi +1. Negatif kural yoktur. Böylece 3 tur genel skoru şişirmez (en çok +2).
- **Erken bitiş** her tur için ayrı uygulanır: bağlı herkes kilitlediğinde o turun seçimi 1 saniye sonra kapanır ve
  sonraki tur erken başlar.
- Tutorial adım 2: "Hedef her tur değişir: ortalamanın yarısı, üçte ikisi, dörtte üçü." Adım 3: "Turlardaki puanlar
  toplanır; toplamı en yüksek +2, ikinci +1 alır."

## 14. Gizli Kareler — `gizli-kareler`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Gizli 4×4 alanda her oyuncu bir kare seçer. Kimseyle
çakışmayan kareler puan getirir; aynı kareyi paylaşanlar puan alamaz. Eski
faz 18 saniyelik tek kare seçimidir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Alan boyutu 4×4 olarak kalacak mı?: [2-4 oyuncuda 3x3 5-8 oyuncu da 4x4 e çıksın]
3. Mayınlar gerçekten var mı; kaç tane ve nasıl yerleştirilir?: [Mayın yoktur.
   Eski adı Mayın Tarlası yerine bu sürümde oyun `Gizli Kareler` olarak geçer.]
4. Oyuncu bir kare mi, birden fazla kare mi seçebilir?: [tek kare seçicek]
5. Seçimler gizli mi; başka oyuncunun seçtiği kare görülebilir mi?: [seçimler gizli]
6. Aşamalar ve süreler: [2 aşama - her aşama 20 saniye]
7. Aynı kareyi seçen oyuncuların sonucu: [o minigame de elenirler]
8. Mayına basan oyuncunun sonucu: [Uygulanmaz; oyunda mayın veya rastgele
   patlayan hücre bulunmaz.]
9. Güvenli/tek kalan karelerin mini oyun puanı: [1.aşama ve 2.aşamada da tek kalırlarsa +1 genel puana eklenir]
10. Boş seçim, geç seçim ve beraberlik davranışı: [Boş veya geç seçim yapan
    oyuncu o aşamada pasif sayılır, kare çakışmasına dahil edilmez ve puan
    alamaz. Aynı hücreyi seçen canlı oyuncular birlikte elenir; tek kalanlar
    puan alır.]
11. Genel skora aktarım: [direkt genel skor puanı]
12. Turun bitiş koşulu: [2 aşamanın bitmesi]
13. Tutorialda gösterilecek üç adım:
    1. Gizli 3×3 veya 4×4 karelerden yalnızca birini seç.
    2. Aynı kareye basan arkadaşlarınla çakışırsan mini oyundan elenirsin.
    3. Her aşamada tek kalanlar +1 alır; ikinci aşama sonunda sonuç açılır.
14. Kare, mayın, patlama ve kamera animasyonları: Mayın kullanılmaz. Kareler
    koyu bir neon ızgara ve içlerinde titreşen boş enerji çekirdekleri olarak
    görünür. Sonuçta aynı hücreye giden avatarlar kısa bir hologram çakışmasıyla
    silinir; güvenli tek hücreler altın sütunla yükselir. 3×3 ve 4×4 düzen,
    telefon ekranına göre otomatik yakınlaştırılır.
15. Özel durumlar: İlk aşamada bütün oyuncular aynı kareyi seçerse sonuç hemen
    açıklanır ve oyun biter; kimse puan almaz. Bir oyuncu ilk aşamadan sonra
    tek başına kalırsa ikinci aşamada rakipsiz kabul edilir, otomatik olarak +1
    genel skor alır ve mini oyun kapanır. Geçersiz seçimler nedeniyle hiç canlı
    oyuncu kalmazsa oyun puansız kapanır.

**Değişiklik (O10, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- **2. aşamada** sunucu tohumlu rastgelelikle gizlice bir kareyi **"ödül karesi"** seçer. Kare hiçbir oyuncuya ya da ekrana
  2. aşamanın sonucu açılana kadar bildirilmez; 2. aşamada yalnız "Gizli bir ödül karesi var" denir.
- 2. aşamada ödül karesini **tek başına** seçen oyuncu, aşamadaki +1'e **ek olarak genel skorda +2** alır. Ödül karesini birden fazla
  oyuncu seçtiyse **kimse ödül almaz** (çakışanlar zaten elenir). Kimse seçmediyse ödül verilmez.
- 2. aşamanın sonucu açılırken ödül karesi parlama efektiyle gösterilir. 2. aşama hiç oynanmazsa (bkz. özel durumlar) ödül karesi yoktur.

## 15. Karalama Defteri — `karalama-defteri`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Çoğu oyuncu ortak kelimeyi bilir, bir oyuncu kelimeyi
bilmeden çizimlere uyum sağlamaya çalışır. Çizimlerden sonra oylama yapılır.
Eski fazlar 26 saniye çizim ve 20 saniye oylamadır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Kelimeyi bilen ve bilmeyen oyuncu sayısı nasıl belirlenir?: [rastgele 1 kişi gelimeyi bilmez]
3. Bilgisiz oyuncu kelimeyi hiç mi görmez; hangi bilgiyi görür?: [o kelimeye yakın bir kelime çıkar çizimi yakın olan birşey örnek elma, armut]
4. Sistem ortak kelimeyi hangi havuzdan seçer?: [bu minigame özel hazırlanmış kelime havuzu yapılır ordan çekilir]
5. Çizim süresi ve çizim araçları: [çizim süresi 75 saniye - kalem ve 6 renk paleti - silgi ]
6. Her oyuncu tek çizim mi yapar; çizim sonradan düzenlenebilir mi?: [tek çizim yapar süre dolana kadar düzenleyebilir]
7. Çizimler herkese aynı anda mı açılır?: [evet]
8. Oylama süresi ve herkesin oy sayısı: [oylama süresi 20 saniye herkes 1 oy hakkı var]
9. Doğru kişiyi bulanların mini oyun puanı: [genel oylama olur sonda oylama da bilgisiz oyuncu bulunursa diğer oyuncular +1 puan alır eğer oylama sonunda en çok oyu bilgisiz oyuncu almazsa bilgisiz oyuncu +1 puan alır herhangi - puan yok , bunlar direkt genel puana eklenir]
10. Bilgisiz oyuncu yakalanırsa veya kurtulursa puanlama: [9.soruda yazıldı]
11. Oy eşitliği davranışı: [bilgisiz oyuncu kazanmış sayılır]
12. Genel skora aktarım: [direkt genel skora eklenir 9.sorunun cevabında yazıyor]
13. Turun bitiş koşulu ve eksik oy: [oylamalar bitince  - eksik oy rastgele atılmaz oylamaya eklenmez sadece]
14. Tutorialda gösterilecek üç adım:
    1. Çoğunluk ana kelimeyi, bilgisiz oyuncu ona yakın kelimeyi görür.
    2. Kelimeyi anlatan tek çizimini süre bitene kadar düzenle.
    3. Çizimler açılınca bilgisiz oyuncuyu oylamaya çalış.
15. Çizim tahtası, kalem, kelime ve karakter animasyonları: Her oyuncunun
    telefonunda aynı koyu çizim tahtası, kalın neon kalem, altı canlı renk ve
    silgi bulunur. Bilgisiz oyuncunun yakın kelimesi ekranda kısa süreli sarı
    bir “yakın sinyal” etiketiyle gösterilir, ana kelimeyi bilenlerde bu etiket
    görünmez. Çizimler sonuçta büyük bir sergi duvarına asılır; oylama kartları
    seçilen portreye doğru kıvrılan ışık izleri bırakır.
16. Özel durumlar: Oyuncu kendine oy veremez. Eksik oylar kura ile doldurulmaz
    ve sonucu değiştirmez. En yüksek oyda bilgisiz oyuncu ile başka oyuncu eşitse
    bilgisiz oyuncu kurtulmuş sayılır.

## 16. İttifak — `ittifak`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncular bir ikna/ittifak aşamasından sonra gizli oy
verir. Alınan oylar puana dönüşür. Eski aşamalar 60 saniye ittifak ve 22 saniye
oylamadır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. İttifak aşamasının amacı ve oyuncunun yaptığı hamle: [herkes ortamda birbirinden puan ister her oyunucun bir oy hakkı var mesela başka oyuncuya gitti ve dedi ki sen bana oy at bende sana atıcam isterse atmayadabilir kandırabilir oyunculardan oy toplamaya çalışacak]
3. Oyuncular ittifak teklifini kime veya kaç kişiye yapabilir?: [1.soruda cevapladım sesli dönücek aynı ortamda oldugumuz için]
4. İttifaklar gizli mi, açık mı; teklifler görülebilir mi?: [ittifak oyunun temelinde sistemde yok sadece oyunun ismi o 1.soruda cevap oalrak anlattım oyunu]
5. İttifak aşaması ve süresi: [1 aşama - 60 saniye ]
6. Oylamada herkes kaç oy verir; kendine oy serbest mi?: [kendine oy veremez ve herkes 1 oy hakkı var]
7. Oylama süresi: [15 saniye]
8. Alınan oyların mini oyun puanına dönüşümü: [alınan oylar direkt genel puana eklenir]
9. Sözünü tutmama, tek taraflı ittifak veya oy vermeme sonucu: [güvene dayalı oyun bunun cezası yok , en az bir kişiye oy vermek zoundalar vermezlerse rastgele bir kişiye oy gider]
10. Oy eşitliği ve genel skora aktarım: [oy eşitliği sorun değil çünkü oyuncular aldığı oy kadar genel puana ekleniliyor]
11. Turun bitiş koşulu: [oy aşamasının bitmesi]
12. Tutorialda gösterilecek üç adım:
    1. 60 saniye boyunca arkadaşlarından oy iste ve vaatlerde bulun.
    2. Herkesin yalnızca bir gizli oy hakkı olduğunu unutma.
    3. Sözünü tutup tutmadığını sonuç ekranındaki oy akışından gör.
13. İttifak kartları, bağlar, el sıkışma ve ihanet animasyonları: Pazarlık
    sırasında oyuncu portreleri arasında geçici neon bağlar ve konuşma balonu
    izleri görünür; sistem bunları gerçek bir anlaşma olarak kaydetmez. Oylama
    başlayınca bağlar kilitlenir, oylar açılırken her bir oy ince bir enerji
    ipiyle hedef portrenin skor sayacına akar. Verilen söz bozulduğunda sistem
    ceza animasyonu oynatmaz; yalnızca karakterin kısa şaşkın tepkisi gösterilir.
14. Özel durumlar: İttifak sistemi yalnızca sözlü pazarlık temasını temsil eder;
    uygulama içinde teklif, söz veya anlaşma nesnesi oluşturulmaz. Oyuncu oy
    vermezse sunucu kendisi dışındaki rastgele bir rakibe oy verir. Oylama
    sonuçları açılana kadar hiç kimse alınan oy sayısını göremez.

**Değişiklik (O4, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Pazarlık aşamasında her oyuncu kendi dışında **en çok 2 kişiye** gizlice **"söz" işareti** koyabilir ("sana oy vereceğim").
  İşaret yalnız bir hatırlatma ve itibar ölçüsüdür; **puanı yoktur**, oyu bağlamaz. Pazarlık bitince işaretler kilitlenir.
- **Söz işaretleri sonuç açılana kadar yalnız sözü verene görünür. Alıcı da dahil kimse görmez** (sayısını bile). Böylece
  söz hâlâ sözlü pazarlıkta verilir, işaret kimseyi rahatlatan açık bir sinyal olmaz ve blöf oyunu korunur.
- Sonuç açılışında her söz, gerçek oyla karşılaştırılarak **tutuldu (✓)** ya da **bozuldu (✗)** diye gösterilir. Oy vermeyenin
  sunucuca atanan oyu da sayılır. Cezası yoktur.
- Puanlama değişmez: alınan her oy genel skora +1.
- Tutorial adımı 3: "İstersen gizlice söz işareti koy; sonuç ekranında kimin sözünü tuttuğunu gör."

## 17. Son Kişi — `son-kisi`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncular gizli bitiş zamanından önce kaçış butonuna
basar. Süre dolmadan basanlar arasında son basan oyuncu +1 alır; hiç basmayan
veya geç kalanlar eski akışta -1 alır. Eski faz 24 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Oyuncunun beklediği gizli olay veya bitiş ne?: [sistemde bir süre belirlenir rastgele 10-20 arasında ve bu sayı oyuncuya hiç söylenmez oyun başladığında arka planda oyuncular görmediği bir şekilde süre başlar ve belirlenen rastegele sayı saniye ye kadar artar sonra raunt biter]
3. Kaçış butonuna basmak neyi tetikler?: [tıkladığında kaçarsın ve kaçtığın süre kaydedilir]
4. Gizli bitiş zamanı hangi aralıkta seçilir?: [10-20]
5. Oyuncu bir kez mi basabilir; erken basış geçerli mi?: [bir kez basabilir ve istediği zaman basabilir]
6. Aşamalar ve toplam süre: [tek aşama , belirnen rastgele sayı kadar sürer]
7. Son basan oyuncunun mini oyun puanı: [rastgele süre dolmadan son basan +1 puan alır genel oyun puanına direkt eklenir]
8. İlk basanlar, hiç basmayanlar ve geç basanların puanı: [ilk basan değil sadece son basanlar puan alır basamayanlar süre dolunca -1 puan alır]
9. Aynı anda basış veya zaman eşitliği: [milisaniyeler ile ölçülür aynı olması zor ama olursa en son basan puanlar eşitse +1 puan alırlar]
10. Genel skora aktarım ve final bonusu: [direkt genel puana eklenir]
11. Turun bitiş koşulu: [rastgele sayının dolması]
12. Tutorialda gösterilecek üç adım:
    1. Bitiş zamanını göremezsin; alarmı bekle.
    2. İstediğin anda bir kez kaçış butonuna bas.
    3. Son kaçan +1 alır; hiç kaçmayan oyuncu -1 alır.
13. Kaçış butonu, gizli sayaç, alarm ve karakter animasyonları: Ekranda büyük
    bir kaçış kolu ve sakin bir neon koridor bulunur; sayaç hiç çizilmez,
    yalnızca karakterin gölgesi arada bir titreşir. Gizli son ana yaklaşınca
    titreşim ve ışık frekansı artar. Basan avatar koridorda kaybolur; gerçek
    bitişte alarm flaşıyla son basanların kartı altın renkte donar.
14. Özel durumlar: Sunucu bitiş zamanından sonra gelen basışları kabul etmez.
    Aynı zaman damgası oluşursa bütün son basanlar +1 alır. Hiç kimse kaçmazsa
    herkes -1 alır. Erken kaçanlar, son kaçan değilse 0 alır.

## 18. Çizgiyi Geçme — `cizgiyi-gecme`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncular 0–100 arasında bir risk seçer. Aynı onluk
bölgeye yığılanlar kalabalığa yakalanır ve puan alamaz. Tek kalanlar arasında
en yüksek seçim +2, sonraki +1 alır. Eski faz 22 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Risk aralığı ve tam sayı/ondalık seçimi: [0-100 , tam sayı]
3. Oyuncunun hedefi en yüksek riske çıkmak mı, çizgiyi aşmamak mı?: [0-100 arasından en yüksek sayıyı seçmek ama seçtiğin sayının ondalık diliminde başkası varsa puan da alamzsın]
4. Aynı onluk bölge kuralı korunacak mı; bölge genişliği kaç?: [ondalık bölgeler korunacak örnek 0-9,10-19,20-29...]
5. Seçimler gizli mi; aşamalar ve süreler nedir?: [gizli , tek aşama , 30 saniye]
6. Aynı bölgeye düşenlerin mini oyun puanı/cezası: [sadece değerlendirilmezler direkt o minigamede pasif kalırlar cezası yok]
7. Tek kalanların puan sıralaması: [tek kalanlar arasından en yüksek sayıyı yazan +2 ikinci yüksek sayıyı yazan +1]
8. En yüksek veya ikinci sırada eşitlik: [eşitlik olma ihtimali yok bu oyunda aynı sayıyı direkt yazarlarsa pasife düşerler zaten]
9. Boş veya geç seçim: [boş seçimde direkt pasif olurlar]
10. Genel skora aktarım ve final bonusu: [söylediğim puanlar direkt genel puana eklenir]
11. Turun bitiş koşulu: [sürenin bitmesi]
12. Tutorialda gösterilecek üç adım:
    1. 0-100 arasında gizli bir tam sayı seç.
    2. Yüksek sayıya çık ama arkadaşlarınla aynı onluk bölgeye girme.
    3. Tek kalan bölgelerde en yüksek +2, ikinci yüksek +1 alır.
13. Risk çizgisi, bölgeler ve patlama/kaçış animasyonları: 0-100 yolu onluk
    neon platformlara ayrılır. Her oyuncunun seçimi gizli bir enerji pimi olarak
    kendi telefonunda yükselir; sonuçta aynı platformdaki pinler birbirine
    çarpıp sönerek pasif kalır. Benzersiz en yüksek pin fırlatma efektiyle +2,
    ikinci pin mavi jeton efektiyle +1 alır.
14. Özel durumlar: Bölgeler `0-9`, `10-19` ... `90-99` ve `100` olarak
    değerlendirilir; 100 tek elemanlı son bölgedir. Boş veya geç seçim yapan
    oyuncu pasif sayılır ve bölge değerlendirmesine girmez. Aynı bölgedeki
    oyuncuların hiçbiri puan alamaz; ayrı bir negatif puan yoktur.

**Değişiklik (O12, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- **Bölge genişliği oyuncu sayısına göre belirlenir.** Bölge, `⌊sayı ÷ genişlik⌋` ile hesaplanır (0-9, 10-19 ... yerine
  genişliğe göre 0-24, 25-49 ... gibi); sayı aralığı 0-100 aynı kalır, 100 son bölgeye düşer.
- Tablo (oyuncu sayısı → bölge genişliği): **2 → 25, 3 → 14, 4 → 10, 5 → 7, 6 → 6, 7 → 5, 8 → 4.**
- Gerekçe: amaç, seçimler dağılırken bir oyuncunun başkasıyla aynı bölgeye düşme olasılığını oyuncu sayısından bağımsız
  olarak kabaca %25'te tutmaktır (çarpışma anlamlı, ama kesin değil). Oyuncu arttıkça çarpışma ihtimali artacağı için
  bölge **daraltılır**; az oyuncuda hiç çarpışma olmayacağı için bölge **genişletilir**. 4 oyuncuda genişlik eski
  değer olan 10'dur.
- Tek kalanlar arasında en yüksek +2, ikinci +1; aynı bölgedekiler pasif (ceza yok); seçmeyen pasif — hepsi eskisi gibi.
  Tek turlu oyundur, genel skora aktarım değişmez (puanlar doğrudan genel skora eklenir).
- Ekranda bölgeler oyuncu sayısına göre çizilir ve bölge aralığı yazılır; tutorial adım 2: "Aynı bölgeye düşme; bölge
  genişliği oyuncu sayısına göre değişir."

## 19. Gizli Alışveriş — `gizli-alisveris`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncular sınırlı bütçeyle marketten ürün seçer. Bir ürünü
kaç kişinin aldığına göre ürünün oyuncuya sağladığı değer değişir. Eski faz
34 saniyelik sepet kurma aşamasıdır.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Her oyuncunun başlangıç bütçesi: [Her oyuncuya 60 kredi verilir. Kredi
   gerçek para değildir; yalnızca bu mini oyunun gizli alışveriş bütçesidir.]
3. Ürün havuzu, ürün fiyatları ve ürün sayısı nasıl belirlenir?: [İlk sürümde
   bütün oyuncuların gördüğü sabit 12 ürünlük havuz kullanılır; ürün sırası her
   maçta karıştırılır. Fiyatlar kombinasyon bırakacak şekilde belirlenmiştir:]

   | Ürün | Fiyat (kredi) |
   |---|---:|
   | Hologram Sticker | 8 |
   | Enerji İçeceği | 10 |
   | Neon Rozet | 12 |
   | Retro Kartuş | 15 |
   | Mini Hoparlör | 18 |
   | Arcade Eldiveni | 20 |
   | Piksel Kamera | 22 |
   | Jet Çanta | 24 |
   | Kristal Kulaklık | 26 |
   | Holo Kask | 28 |
   | Mini Drone | 32 |
   | Gizli Sandık | 36 |
4. Her oyuncu kaç ürün seçebilir; aynı üründen birden fazla alınabilir mi?: [bütcesi dahilinde istediği kadar ürün alabilir bir üründen sadece bir kez alabilir]
5. Alışverişler gizli mi; ürün seçimleri ne zaman açılır?: [gizli , tur sonunda]
6. Ürün değeri alıcı sayısına göre tam olarak nasıl hesaplanır?: [bir ürünü kaç kişi seçtiyse değeri o seçilen sayıya bölünür örnek : 30 tl ye bir ürün var 2 kişi bu ürünü seçmiş değeri artık 15 oldu]
7. Aşamalar ve süreler: [tek aşama - 30 saniye]
8. Bütçeyi aşma veya sepet göndermeme sonucu: [bütçe aşılamaz - sepet göndermezse sepetinin değeri direkt 0 olarak kabul edilir]
9. Mini oyun puanı ve en değerli sepet eşitliği: [en yüksek değerde ki sepet +1 puan alır - en değerli sepetler de birden fazla aynı varsa bunların hepsi +1 alır]
10. Genel skora aktarım ve final bonusu: [direkt genel puana eklenir]
11. Turun bitiş koşulu: [sürenin dolması]
12. Tutorialda gösterilecek üç adım:
    1. 60 kredilik gizli bütçeni gör.
    2. İstediğin ürünleri sepetine koy; aynı üründen bir tane alabilirsin.
    3. Az kişinin seçtiği pahalı ürünler daha değerli olur; en değerli sepet +1.
13. Neon market, ürün kartları, kasa ve sepet animasyonları: Telefon ekranında
    yatay kaydırılabilir neon raflar, her üründe fiyat ve kapalı alıcı rozeti
    bulunur. Sepete eklenen ürünler küçük kredi jetonlarıyla kasaya akar. Tur
    bitince raf kepengi açılır; her ürünün fiyatı kaç kişi aldıysa ona bölünür,
    sepet değerleri hesaplanırken ürün kartları ilgili oyunculara ışınlanır.
14. Özel durumlar: Sepet bütçe aşımına izin vermez; son geçerli sepet sunucuda
    tutulur. Sepet göndermeyen veya hiç ürün almayan oyuncunun sepet değeri 0
    kabul edilir. En yüksek toplam değer eşitse o oyuncuların tamamı +1 alır;
    ürün değerleri tam olmayan sayılarda iki ondalık basamakla hesaplanır ancak
    sıralama yuvarlanmamış sunucu değeriyle yapılır.

## 20. Aşırı Yükleme — `asiri-yukleme`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Ortak enerji barı tıklamalarla dolar. Kapasite aşılırsa
taşmayı oluşturan son tıklamayı yapan oyuncu patlar. Eski kaynakta patlamayan
oyuncular arasında en çok tıklayan +2, ikinci +1; patlayan oyuncu -1 alır.
Eski faz 18 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Bar kapasitesi ve her tıklamanın doldurduğu miktar: [100 , her tıklama 1]
3. Tıklama hangi ortak hamleyi temsil eder; herkes istediği kadar tıklayabilir mi?: [herkes istediği kadar tıklar tıkladıkca ortak enerji barı dolar]
4. Tıklamalar anlık görünür mü, toplam sayı gizli mi?: [gizli tur sonunda gözükür]
5. Aşamalar ve süreler: [süre yok enerji barı 100 olana kadar devam eder 100 olduktan sonra arkaplanda oyunculara gözükmicek şekilde 3 saniye daha bekelnir (amaç yanlışlıkla birisi barı patlatabilir) 3 saniye dolduktan sonra tur biter]
6. Kapasiteyi aşan son tıklamada ne olur?: [tur direkt biter ]
7. Patlayan oyuncunun mini oyun puanı: [-1 puan]
8. Patlamayan oyuncuların sıralama ve puanlama kuralı: [en çok tıklayan oyuncu +2 ikinci +1]
9. Aynı tıklama sayısında eşitlik: [+2 almazlar direkt +1 alırlar]
10. Bar hiç taşmadan süre biterse ne olur?: [Bar 100'e ulaştıktan sonraki
    gizli 3 saniye içinde hiçbir tıklama kapasiteyi aşmazsa tur normal şekilde
    kapanır ve patlamayan oyuncuların tıklama sayıları sıralanır.]
11. Genel skora aktarım: [direkt genel puana eklenir]
12. Tutorialda gösterilecek üç adım:
    1. Ortak enerji barını gizlice tıklayarak doldur.
    2. Bar 100'e ulaştıktan sonra görünmeyen 3 saniyelik tehlike başlar.
    3. 100'ü aşan son tıkı atan patlar; diğerleri tıklama sırasına göre puan alır.
13. Bar, uyarı, titreşim, kıvılcım ve patlama animasyonları: Ortak bar büyük
    bir reaktör çekirdeği olarak görünür; tıklamalar oyuncunun kendi ekranında
    küçük elektrik kıvılcımları bırakır, toplam tıklama sayısı gizli kalır.
    100'e ulaşınca ekranın kenarı kırmızıya döner fakat görünür sayaç başlamaz.
    Aşan tıkta çekirdek beyaz parlar, ilgili avatarın ekranı kısa sarsılır ve
    patlama gerçekleşir.
14. Özel durumlar: 100'e ulaşan tıklama turu bitirmez; yalnızca gizli 3 saniye
    penceresini başlatır. Bu pencerede kapasiteyi aşan ilk sunucu sıralı tık
    patlamayı belirler. Patlayan oyuncu sıralamaya girmez. Patlamayanlar içinde
    tıklama liderleri eşitse liderlerin tamamı +1 alır ve +2 verilmez; ikinci
    sıra yalnızca tek lider olduğunda +1 alır.

**Değişiklik (O7, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- Patlamayan oyuncular arasında **en az tıklayan** oyuncu(lar) ayrıca **−1** alır (hiç tıklamayan da en az sayılır).
  Eşitlikte en az sayıda tıklayanların **hepsi** −1 alır. Patlamayan herkesin tıklama sayısı aynıysa **kimse bu cezayı
  almaz**.
- Patlayan oyuncu bu cezaya girmez ve ikinci bir −1 almaz (yalnız kendi −1'ini alır).
- Bu −1, mevcut puanlara eklenir (örneğin ikinci sırada +1 alan ve aynı zamanda en az tıklayan oyuncu toplamda 0 alır).
  Tıklamalar eskisi gibi tur sonuna kadar gizlidir; değişiklik yalnız tur sonu puanlamasını etkiler.
- Tek turlu oyundur ve mini→genel dönüşümü değişmez: puanlar doğrudan genel skora eklenir.
- Tutorial adım 3: "100'ü aşan son tıkı atan patlar (−1); diğerlerinde en çok tıklayan +2, ikinci +1, en az tıklayan −1."

## 21. Kontrol Paneli Kaosu — `kontrol-paneli-kaosu`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Her oyuncuya renkli paneller ve sözel bir tarif içeren
kişisel görev verilir. Oyuncu tarifine göre doğru renk/paneli seçmeye çalışır.
Eski kaynakta doğru seçim +1, yanlış veya boş seçim 0 ve faz süresi 45 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Her oyuncunun gördüğü panel düzeni aynı mı, farklı mı?: [herkesin kendine has bir paneli var 
örnek 3 oyuncu her oyuncuda 4 farklı renkte kablo var ama herkesin ekranında farklı sırayla yerleştirilmişler bu oyunun kenel kuralı 4 farklı renk kablo herkste farklı ve kabloların altında başka rastgele bir oyuncunun hangi kabloyu kesceğine dair ipucu var ,
şimdi senaryo çizelim 1. oyuncu da yukardan aşağıya doğru sırayla mavi yeşil kımızı sarı kablo var ve altında not kağıdında bir ipucu var notta da en şu yazıyor "en üstte ki kablo mavi 3. sırada ki kablo sarı ise maviyi kes"
2.oyuncu da sırayla sarı mavi yeşil kırmızı kablolar olsun altında da not kağıdında da ipucu olarak notta "2.sırada yeşil 3.sırada kırmızı kablo varsa sarıyı kes" 
3.oyuncu da sırayla mavi kırmızı sarı yeşil olsun altında ki not kağıdında da "3. kablo yeşil 4.kablo kırmızı ise maviyi kes"

yani birbirlerinin ne yapcağı birbirinde yazıyor birbirlerinde çözümü almaya almaya çalışıyorlar , herkesin tek 1 kablo kesme hakkı var]
3. Oyuncuya verilen sözel/görsel talimat nedir?: [2.soruda cevap verildi]
4. Renk ve panel sayısı: [2.soruda cevap verildi]
5. Oyuncu bir seçim mi yapar; seçim değiştirilebilir mi?: [2.soruda oyun anlatıldı]
6. Görevler ve cevaplar diğer oyunculardan gizli mi?: [2.soruda cevap verildi]
7. Aşamalar ve süreler: [tek aşama 60 saniye]
8. Doğru, yanlış, boş ve geç seçim puanları: [doğru kabloyu kesersen +1 puan alırsın ve senin ipucun kimdeyse o da +1 puan alır bunun dışında puanlama yok]
9. Aynı anda bitirme veya eşitlik davranışı: [süre rekabeti yok]
10. Genel skora aktarım: [direkt genel puana eklenir]
11. Turun bitiş koşulu: [sürenin dolması]
12. Tutorialda gösterilecek üç adım:
    1. Her telefonda dört renk kablo farklı sıradadır.
    2. Kendi panelini hangi ipucunun anlattığını bilmezsin; konuşarak ipucunu
       taşıyan kişiyi ve koşulu çöz.
    3. Kendi panelindeki tek bir kabloyu kes; doğru kabloyu kesen ve ilgili
       ipucunu taşıyan oyuncu +1 alır.
13. Kontrol panelleri, kablolar, ışıklar ve kaos animasyonları: Dört kablo
    `mavi`, `yeşil`, `kırmızı`, `sarı` olarak metalik neon kanallarda görünür.
    Her panelin sırası oyuncuya özel ve mümkün olduğunca benzersizdir. Not
    kağıdı kabloların altında yalnızca ipucu sahibine görünür. Kesme anında
    kablo kopar ve kıvılcım çıkar; doğru/yanlış bilgisi dalga sonucunda açılır
    (doğruysa yeşil, yanlışsa kırmızı). Yanlış kesimin tek anlık tepkisi ortak
    bomba saatinin 5 sn atlamasıdır (aşağıdaki dalga değişikliği).
14. Özel durumlar: Her oyuncu kendi paneli hakkında ipucunun kimde olduğunu
    bilmez. Her ipucu, başka bir oyuncunun panelindeki dizilimi tarif eder ve
    kesilecek kablo rengini söyler; ipucu metni hedef oyuncunun adını doğrudan
    göstermez. Sunucu oyuncular arasında kendini hedeflemeyen tek yönlü bir
    döngü kurar; böylece her panel için bir ipucu sahibi olur. Doğru kabloyu
    kesen oyuncu +1, o panelin ipucunu taşıyan oyuncu da +1 alır. Yanlış veya
    boş kesim 0'dır ve oyuncu kesimini değiştiremez.

**Değişiklik (sahip onayı, Ekim 2026):** Kesim tek seferlik ve gizli olduğundan, **bağlı bütün katılımcılar
kestiğinde** oyun 1 saniye sonra erken biter; bağlantısı kopan oyuncu beklenmez (eskiden kopuk oyuncu da beklenirdi). Kopuk
oyuncunun kesimi yoksa o oyuncu için sonuç süre bitmiş gibi hesaplanır (kesmemiş = puan yok).

**Değişiklik (sahip onayı, Ekim 2026 — üç dalga, KP-M1…M5):** Bu bölüm yukarıdaki tek aşama, süre ve puan
cevaplarının yerine geçer; geri kalanı (2–8 oyuncu, ipucu zinciri, gizlilik, renk körlüğü modu) aynen geçerlidir.

1. **Üç dalga:** Dalga 1 "Isınma" 25 sn (4 kablo, 2 koşullu "N. kablo R ise" ipucu), dalga 2 "Karmaşa" 25 sn
   (4 kablo, yeni ipucu türleri), dalga 3 "Kaos" 20 sn (**5 kablo**, 5. renk **mor**; üç koşullu ya da karma ipucu).
   Her dalgada yeni paneller (her oyuncuda farklı dizilim; dalga 1 ve 2 dizilimleri de birbirinden farklı) ve
   yeniden karıştırılmış ipucu zinciri gelir: 3+ oyuncuda hiçbir taşıyıcı önceki dalgada taşıdığı kişinin notunu
   taşımaz (2 oyuncuda tek döngü olduğundan eşleşme aynı kalır).
2. **Kesim:** Her dalgada herkesin **tek ve geri alınamaz** bir kesim hakkı vardır; yeni dalgada hak yenilenir. 4
   kablolu dalgada mor kesilemez. Dalga bittikten sonra (arada ya da sonda) gelen kesim reddedilir; bir dalga için
   gönderilip sonraki dalgada ulaşan kesim de yeni dalgaya sayılmaz.
3. **Dalga başına erken bitiş:** Bağlı bütün katılımcılar o dalgada kestiyse dalga 1 sn sonra biter; kopuk oyuncu
   beklenmez.
4. **Ara:** Dalga 1 ve 2'den sonra 4 sn'lik kısa sonuç: herkesin o dalgadaki kesimi (renk, ✓/✗), ipucu taşıyıcısı ve
   o dalganın imha puanı. Biten dalganın panelleri ve ipuçları bu andan itibaren herkese açıktır.
5. **Yeni ipucu türleri (dalga 2 ve 3):** olumsuz ("2. kablo kırmızı değil ve 4. kablo sarıysa maviyi kes"),
   komşuluk ("Mavi ile sarı yan yanaysa yeşili kes"), konum hedefi ("1. kablo yeşilse en alttaki kabloyu kes";
   en üstteki ya da en alttaki), sıra ("Kırmızı maviden yukarıdaysa sarıyı kes"). Dalga 2'de bu dört türden biri,
   dalga 3'te üç "N. kablo R" koşulu ya da en az bir yeni türü içeren 2–3 koşullu karma ipucu rastgele seçilir;
   dalga 3'te ipuçlarının yaklaşık üçte biri konum hedeflidir. Her ipucu hedef panelde doğrudur ve o dalganın
   panelleri arasında **yalnız hedef paneli** tanımlar (üretimde denetlenir). İstenen tür bunu sağlayamazsa
   daha basit türe düşülür ("N. kablo R" koşulları ve renk hedefi). Doğru kablo sistemce kesin hesaplanır (konum
   hedefinde o konumdaki kablonun rengi). İpucu oyuncu adı içermez.
6. **Ortak bomba saati:** Dalganın süresi herkesin gördüğü bomba saatidir. **Yanlış kesim saatten herkes için 5 sn
   düşer**; saat 3 sn'nin altına inmez (kalan 3 sn ya da daha azken gelen yanlış kesim süre düşürmez). Hangi
   kablonun yanlış olduğu söylenmez; herkes yalnız saat atlamasını görür. Doğru/yanlış bilgisi kesen kişiye de
   dalga sonucuna kadar gösterilmez; saat atlaması herkese göründüğü için kesen kişi dolaylı anlayabilir (kabul
   edilmiş durum). Saat sıfıra inince dalga biter; kesmeyenler kesmemiş sayılır. Ceza süre olduğundan eksi puan yoktur.
7. **Puan:** Her dalgada imha puanı toplanır: doğru kesen +1, o panelin ipucunu taşıyan +1. Oyun sonunda mini oyun
   puanı (genel skora eklenen) toplam imha puanından verilir: en yüksek toplam **+2**, ikinci farklı toplam **+1**,
   diğerleri 0. Birincide eşitlikte hepsi +2 ve sonraki farklı değer +1. Toplamı 0 olan ödül almaz. Herkesin
   toplamı aynı ve 0'dan büyükse **herkes +1** alır. Eksi puan yoktur.
8. **Zaman çizelgesi:** 25 + 4 + 25 + 4 + 20 sn ve sonda 8 sn sonuç açılışı (en çok 86 sn; erken bitiş ve saat
   atlamaları sonraki dalgaları öne çeker). Sonuç açılışında üç dalganın kesimleri, toplam imha puanı ve ödül
   görünür; oyun bu 8 sn'nin sonunda biter.
9. **Kartlar:** Kart hesabı mini oyun puanına (+2 / +1 / 0) bakar: "birinci" +2 alanlardır (herkes +1 aldıysa ya
   da herkes 0 ise herkes birincidir), "sonuncu" en düşük mini puanlılardır (genellikle 0 alanlar; toplamı 0'dan
   büyük ama ödül almayanlar da dahil). Herkes eşitse kimse sonuncu sayılmaz.
10. Eski "doğru koşul sesli söylenince kablo nabız atar" maddesi kaldırıldı (sistem konuşmayı duymaz); yerine
    6. maddedeki saat tepkisi geçer.

## 22. Zehirli Kadeh — `zehirli-kadeh`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Oyuncuların kadehlerinden bazıları zehirlidir. Oyuncular
tek takas hakkıyla kadehini başka oyuncuyla değiştirmeye çalışır. Eski akışta
her takas anında olur ve süreye 5 saniye eklenir. Süre bittiğinde zehirli kadehi
olmayanlar +1, zehirli kadehi olan oyuncu 0 alır; eski faz 30 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Kaç zehirli kadeh vardır; başlangıçta nasıl dağıtılır?: [2-3 oyuncu da 1 tane 4-5 oyuncuda 2 tane 6-8 oyuncuda 3 tane zehirli kadeh vardır]
3. Her oyuncu kendi kadehinin zehirli olup olmadığını görür mü?: [yok göremez]
4. Takas kime yapılabilir; kendinle takas mümkün mü?: [kendinle nasıl takas yapıcan akıllı]
5. Her oyuncunun kaç takas hakkı vardır?: [1 takas hakkı var]
6. Takas anında mı gerçekleşir; herkes takas geçmişini görür mü?: [takas anlık olarak yapılır süre bitmeden]
7. Takas süreyi uzatır mı; uzatıyorsa kaç saniye?: [5 saniye uzatır]
8. Aşamalar ve süreler: [tek aşama 20 saniye sürer her takas 5 saniye daha uzatır]
9. Zehirli/temiz kadeh sahibinin mini oyun puanı: [minigame sonu temiz kadehler +1 diğerleri 0 puan alır]
10. Takas yapmayan veya eksik kalan oyuncunun sonucu: [takas zorunlu değil]
11. Genel skora aktarım ve beraberlik: [bu oyunda beraberlik yok temiz kadehi olan herkes puan alır]
12. Turun bitiş koşulu: [sürenin bitmesi]
13. Tutorialda gösterilecek üç adım:
    1. Hangi kadehin zehirli olduğunu göremezsin.
    2. İstersen bir arkadaşınla tek takas hakkını kullan.
    3. Süre bittiğinde temiz kadeh +1, zehirli kadeh 0 alır.
14. Kadeh, zehir, takas, ışık ve patlama animasyonları: Oyuncuların önünde
    renkli sıvıyla dolu, dışı aynalı neon kadehler durur; kadehin içindeki
    zehirli durum hiçbir oyuncuya görsel ipucu vermez. Takas düğmesinde iki
    kadeh arasında kısa bir ışık tüneli oluşur ve her takas sonrası sahne
    saatinin çevresine 5 saniyelik amber halka eklenir. Sonuçta temiz kadehler
    altın, zehirliler mor-siyah dumanla işaretlenir.
15. Özel durumlar: Takas anında sunucu tarafından tek işlem olarak uygulanır;
    aynı anda gelen iki takasta sunucu sırası geçerlidir. Her oyuncu en fazla
    bir kez takas yapabilir ve takas zorunlu değildir. Başlangıç süresi 20
    saniyedir; toplam süre takaslarla uzar ve süre bitince sonuç hemen açılır.

## 23. Çapraz Ateş — `capraz-ates`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Her oyuncu gizlice başka bir oyuncuyu hedefler. Eski
puanlamada hedefine ateş edip kimse tarafından hedeflenmeyen oyuncu +1 alır;
hedeflenen ama karşılıklı ateş olmayan oyuncu -1 alır; iki oyuncu karşılıklı
hedefleşirse mermiler çarpışır ve iki taraf 0 alır. Eski faz 20 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Oyuncu kendisini hedefleyebilir mi?: [hayır]
3. Her oyuncu kaç hedef seçer; hedef değiştirilebilir mi?: [1 hedef seçebilir]
4. Hedef seçimleri gizli mi, ne zaman açılır?: [gizli süre dolunca gözükür]
5. Aşamalar ve süreler: [25 saniye]
6. Hedefine ateş edip kimse tarafından hedeflenmeyen oyuncunun puanı: [+1]
7. Hedeflenen oyuncunun puanı/cezası: [-1]
8. Karşılıklı hedefleşme sonucu: [0 puan]
9. Bir oyuncuyu birden fazla kişi hedeflerse ne olur?: [sadece -1 alır]
10. Boş veya geç hedef seçiminde ne olur?: [boşa sıkmış olur]
11. Genel skora aktarım ve beraberlik: [beraberlik diye birşey yok herkes puan alabilir , puanlar direkt genel puana eklenir]
12. Turun bitiş koşulu: [sürenin bitmesi]
13. Tutorialda gösterilecek üç adım:
    1. Kendin dışındaki bir oyuncuyu gizlice hedefle.
    2. Hedefler süre bitene kadar görünmez; kimin seni seçtiğini bilemezsin.
    3. Karşılıklı hedeflerde mermiler çarpışır; hedeflenmeyen saldırgan +1,
       hedeflenen oyuncu -1 alır.
14. Lazer nişangâhı, mermi, çarpışma ve karakter tepkileri: Her oyuncunun
    ekranında portrelerin çevresinde hareket eden ince lazer nişangâhları
    bulunur. Hedef seçilince nişangâh kısa süre kilitlenir ama diğer oyunculara
    gösterilmez. Sonuçta mermiler hedefler arasında neon izler bırakır;
    karşılıklı izler merkezde çarpışıp iki oyuncunun skorunu 0'a kilitler.
15. Özel durumlar: Oyuncu hedef göndermese de başkalarının hedefi olabilir ve
    hedeflenirse -1 alır. Bir oyuncu birden fazla kişi tarafından hedeflenirse
    yalnızca bir kez -1 alır. Karşılıklı hedefleşme iki taraf için 0 kuralını
    geçersiz kılar; boşa sıkmış oyuncu kendi saldırısından puan alamaz ancak
    başka biri tarafından hedeflenmişse hedeflenme kuralı uygulanır.

## 24. Zaman Bombası Hafızası — `zaman-bombasi-hafizasi`

**Durum: KİLİTLİ**

**Eski kaynak özeti:** Renklerden oluşan bir dizi gösterilir. Aktif oyuncu diziyi
aynı sırayla tekrarlar. Doğru cevap verilirse sıra sonraki oyuncuya geçer ve
dizi bir renk uzar. Yanlış cevapta aktif oyuncu -1, diğerleri +1 alır. Eski
kaynakta aktif oyuncu dışındakiler bekler; faz başlangıçta 22 saniye olsa da
doğru cevaplarla tur uzayabilir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Kullanılacak renk veya sembol sayısı: [4 farklı renk]
3. İlk dizi kaç elemanlı ve nasıl oluşturulur?: [İlk dizi 2 renklidir. Dört
   renkten rastgele seçilir; aynı renk art arda gelebilir.]
4. Diziyi hangi oyuncu görür; aktif oyuncuya ne kadar süre gösterilir?: [ilk oyuncuya ilk dizi gösterilir diğerleri bir önceki oyunucuyu izleyerek ezberlemeye çalışır]
5. Aktif oyuncu diziyi nasıl tekrarlar; giriş sırasında önizleme var mı?: [örnek 3. oyuncu var diyelim 1.oyuncu sırayla mavi-sarı yandı söndü 1.oyuncu sırayla mavi ye sonra sarıya basarak doğru yaptı sonra 2.oyuncuya geçti onda da bir kez bir önce ki ışıkların sıralaması değişmeden bir tane eklenerek yancak mesela sırayla mavi-sarı-sarı yandı söndü 2.oyuncunun zamanı başladı sırayla doğru sırayla tıklaması lazım her oyuncuda bir tane daha artarak devam eder yanlıs tıklayan oyuncu pasife düşer oyun baştan başlar oyuncuların yarısı elenene kadar oyun baştan başlar elenen oyuncular bir daha giremez elenenler -1 geri kalanlar +1 alır]
6. Doğru cevapta sıra hangi kuralla sonraki oyuncuya geçer?: [rastgele seçer ama tüm oyuncular seçildikten sonra sırayı kaybetmez mesela 4 oyunculu bir oyunda a-c-b-d olarak sırayla seçti bu şöyle devam eder a-c-b-d-a-c-b-d-a-c-b-d]
7. Doğru cevapta dizi kaç eleman uzar?: [1]
8. Yanlış cevapta oyuncu ve diğerlerinin puanı: [Yanlış cevap veren oyuncu
   pasife düşer ve -1 genel skor alır; o sıradaki diğer aktif oyuncuların her
   biri +1 genel skor alır.]
9. Yanlış cevapta bomba/oyun hemen biter mi, yoksa devam eder mi?: [Oyun
   hemen bitmez. Aktif oyuncuların dizisi başlangıç uzunluğu olan 2 renge geri
   döner ve sıra, elenmeyen oyuncularla aynı döngü düzeninde devam eder.]
10. Her oyuncunun tur başına veya sıra başına süre sınırı: [renk uzunlugu * 3  ... örnek mavi-yeşil-sarı ya basması gerekiyorsa 9 saniyesi var]
11. Hiç cevap gelmezse ne olur?: [elenir]
12. Genel skora aktarım ve final bitiş koşulu: [elenenler -1 kalanlar +1 , oyuncuların yarısı elenene kadar]
13. Tutorialda gösterilecek üç adım:
    1. İlk iki renkli ışık dizisini dikkatle ezberle.
    2. Sıra sana geldiğinde aynı renkleri aynı sırayla bas.
    3. Doğru cevapta dizi bir renk uzar; yanlışta pasif kalır ve dizi 2 renge
       sıfırlanır.
14. Renk dizisi, hafıza ışıkları, hata ve bomba animasyonları: Dört renk,
    koyu bir hafıza panelinde tek tek yanıp sönen yükseltilmiş tuşlar olarak
    gösterilir. İlk iki ışıkta sahne yavaş ve belirgin, dizi uzadıkça geçişler
    daha ritmik olur. Doğru girişte oyuncunun panelinden yeşil iz çıkar; yanlış
    tuşta panel kırmızı çatlar, avatar pasif moda geçer ve dizinin iki başlangıç
    ışığı yeniden yanar.
15. Özel durumlar: Oyuncu sırası maç başında bir kez karıştırılır ve sonra aynı
    çevrim tekrarlanır. Aktif oyuncunun giriş süresi `dizi uzunluğu × 3` saniyedir;
    cevap gelmezse yanlış cevapla aynı sonuç uygulanır. Elenen oyuncu yeniden
    sıraya girmez. Başlangıç oyuncu sayısının yarısı elenince oyun biter; son
    hata sonucu yarı eşiği aşarsa sonuç o hatadan hemen sonra açılır.

**Değişiklik (O1, Ekim 2026, sahip onayı) — aşağıdaki cevapların önüne geçer:**

- **Toplam süre sınırı 90 saniye.** Oyun, başlangıç oyuncularının yarısı elenince ya da 90 saniye dolunca (hangisi
  önce olursa) biter. Süre dolduğunda giriş yapmakta olan oyuncunun sırası iptal edilir, cezası olmaz. Bitişte
  puanlama değişmez: elenenler −1, kalanlar +1.
- **Ani ölüm:** 60. saniyeden sonra her yeni sırada dizi bir yerine **iki** renk uzar.
- **Dizi gösterimi hızlanır:** her renk yaklaşık 350 ms yanar (önceki daha yavaş gösterim yerine).
- **Giriş süresi:** `1,5 saniye + dizi uzunluğu × 1 saniye` (önceki `dizi uzunluğu × 3` yerine). Süre içinde cevap
  gelmezse yanlış cevapla aynı sonuç uygulanır.
- Ekranda kalan toplam süre görünür; son 30 saniye ("ani ölüm") ayrıca belirtilir.

## 25. Kusursuz Denge — `kusursuz-denge`

**DURUM: KAPSAM DIŞI — BU OYUN EKLENMEYECEK**

---

# C. Yeni oyunlar (A8)

## 26. Bozuk Telefon — `bozuk-telefon`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`)

- Amaç: Bir cümlenin çizim ve tahmin zincirinde nasıl bozulduğunu izleyip gülmek; zinciri sağlam tutmak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Her oyuncu bir **zincir** başlatır: ilk adımda kısa bir cümle yazar (en çok 60 karakter, 25 sn).
- Zincirler her adımda bir sonraki oyuncuya geçer (sabit, karıştırılmış döngü; kimse kendi zincirine dönmeden
  önce herkesten geçer). Adımlar sırayla **çiz** (60 sn) ve **yaz** (25 sn: gördüğün çizimi tek cümleyle anlat).
- Adım sayısı: oyuncu sayısı (en çok 6) — 3 oyuncuda 3 adım (yaz→çiz→yaz), 6+ oyuncuda 6 adım.
- Her adımda oyuncu **yalnız bir önceki adımı** görür; zincirin geri kalanı sonuna kadar gizlidir.
- Süre dolduğunda: boş çizim "boş tuval", boş yazı "…" olarak zincire geçer. Herkes "Tamam" derse adım erken biter.
- Gösteri: zincirler tek tek baştan sona açılır (her adım ~3 sn). Her zincirden sonra 10 sn içinde herkes o zincirin
  **en komik adımına** oy verir (kendi adımına veremez).
- Puan: en komik adım seçilen her oy için adımın sahibine **+1**. Zincirin ilk cümlesi ile son yazı adımı aynı
  anlamdaysa (Türkçe normalize edilmiş kelimelerin en az yarısı ortak) o zincirdeki herkes **+1** ("sağlam zincir").
- Genel skora: mini puanlar doğrudan.

## 27. Laf Sokma Düellosu — `laf-sokma`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`)

- Amaç: Aynı soruya rakibinden daha komik cevap verip oyları toplamak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Sistem tek soru havuzundan (elle hazırlanmış; ton seçimi yok) sorular seçer; her soru tam
  **iki** oyuncuya verilir ve her oyuncu **iki** soru alır (eşleşmeler kendini tekrar etmeyecek şekilde dağıtılır).
- Yazma: 60 sn; her cevap en çok 80 karakter. Cevaplar sunucuda temizlenir ve moderasyon filtresinden geçer.
- Oylama: her soru sırayla gösterilir; iki cevap yan yana, **isimsiz**. Cevabı olmayan iki oyuncu 10 sn içinde
  birine oy verir (cevap sahipleri oy vermez). Oylar ve cevap sahipleri o soru açılınca görünür.
- Cevap yazmayan: "Cevap yok" kartı gösterilir, otomatik 0 oy.
- Puan: bir soruda aldığın oy sayısı kadar **+1**; tüm oyları alırsan (en az 2 oy) ek **+1** ("Laf Ustası").
- **Final sorusu:** son turda herkes aynı soruya cevap yazar (45 sn); herkes kendisi dışında bir cevaba oy verir;
  aldığın her oy **+1**.
- Genel skora: mini puanlar doğrudan.

## 28. Kara Borsa — `kara-borsa`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`)

- Amaç: Gizli değerli kutuları blöf ve ipuçlarıyla doğru fiyata almak; en zengin olmak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Herkes **100 jetonla** başlar. **5 tur**; her turda bir gizemli kutu.
- Kutunun gerçek değeri gizli: 0–60 arası tam sayı, ya da **%15 olasılıkla lanetli** (değer −20).
- Her turda her oyuncu **yalnız kendine özel bir ipucu** alır (ör. "değeri 30'dan büyük", "çift sayı",
  "lanetli değil", "değeri 10'un katı değil"). İpucu her zaman doğrudur; sözlü blöf serbesttir.
- Teklif: 20 sn, gizli, **tek seferlik** (0 ile mevcut jeton arası; 0 = geç). Bağlı herkes teklif verince erken biter (sahip onayı): bağlantısı kopan oyuncu beklenmez (teklifi 0 sayılır); eskiden kopuk oyuncu da beklenirdi.
- En yüksek teklif kutuyu alır ve teklifini öder; eşitlikte önce teklif veren kazanır. Kimse teklif vermezse kutu
  kimseye gitmez. Teklifler ve kutunun değeri tur sonunda açılır (5 sn).
- Mini puan: kalan jeton + aldığı kutuların değerleri toplamı.
- Genel skora: en yüksek **+2**, ikinci **+1**, üçüncü **+1** (eşitlikte aynı derece aynı ödülü alır).

## 29. Kule Ustası — `kule-ustasi`

**Durum: KİLİTLİ** (Ekim 2026; sahip "yap" dedi, testler geçti; ayrıntılar asistan önerisi — sahip itiraz ederse güncellenir)

**Fikir:** Herkes sırayla ortak bir kuleye blok bırakır. Blok, kulenin üstünde sağa sola kayar; oyuncu doğru anda
dokunup bırakır. Alttaki bloğun dışına taşan kısım kesilip düşer, kule daralır. Hiç üstüne denk getiremeyen kuleyi
düşürür ve oyundan çıkar.

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Sıra: maç başında bir kez karıştırılır, çıkan oyuncular atlanarak aynı çevrim tekrarlanır.
3. Sırası gelen oyuncunun ekranında blok, kulenin üstünde **sabit hızla sağa-sola gidip gelir**; oyuncu **bir kez
   dokunarak** bırakır. Konum sunucu saatine bağlı bir fonksiyondur (herkes aynı hareketi görür). Diğerleri izler.
4. Bırakma anı: istemci dokunduğu anı sunucu saatiyle gönderir; sunucu, sıranın başlangıcından önceki ya da 400 ms'den
   eski anları kabul etmez (gecikme hilesine karşı). Sıra süresi **6 saniye**; dokunmayan oyuncu süre dolduğu anda
   bırakmış sayılır.
5. **Kesme:** Bırakılan bloğun alttaki bloğun dışına taşan kısmı kesilir; kalan genişlik yeni bloğun genişliğidir.
   **Kusursuz:** taşma bloğun genişliğinin %4'ünden azsa kesilmez, blok tam oturur ve "Kusursuz!" sayılır.
6. **Iska:** Blok alttakinin üstüne hiç denk gelmezse kule yıkılır: o oyuncu **çıkar**, kule **başlangıç genişliğine
   sıfırlanır** (yeni taban) ve sıra kalanlarla sürer.
7. **Hız:** Her başarılı katta kayma hızı %6 artar (en çok başlangıcın 2,5 katı). Kule sıfırlanınca hız da sıfırlanır.
8. **Bitiş:** Başlangıç oyuncularının yarısı çıkınca ya da **90 saniye** dolunca (hangisi önce gelirse). Süre dolarken
   sırası gelmiş oyuncunun bırakışı iptal edilir, cezası olmaz.
9. **Puan (genel skor):** Çıkanlar **−1**, kalanlar **+1**. En çok "Kusursuz" yapan oyuncu(lar) ek **+1** (en az 1
   kusursuz gerekir; eşitlikte hepsi alır).
10. Gizli bilgi yoktur; her şey herkese açıktır.
11. Tutorialda gösterilecek üç adım:
    1. Blok kulenin üstünde kayar; sıran gelince dokunup bırak.
    2. Taşan kısım kesilir, kule daralır; tam oturtursan "Kusursuz!"
    3. Iskalayan kuleyi yıkar ve çıkar (−1); kalanlar +1.
12. Rastgele seçime girer (Ekim 2026: testler çalıştırıldı ve geçti; o zamana dek `randomPool: false` ile yalnız
    elle seçilebiliyordu). Bayrak genel olarak duruyor: yeni bir oyun onay bekleyecekse aynı yolla havuz dışında
    tutulur (`pickRandomGames` havuza almaz, katalogda `GameInfo.randomPool` görünür).

---

## Kural seti kilitleme kontrol listesi

- Her oyunun kural, süre, puan ve özel durum alanı dolduruldu.
- Süreleri, minimum oyuncu sayılarını ve maksimum oyuncu sayılarını belirttim.
- Her oyunda tur bitişini ve eksik/geç katılımı belirttim.
- Mini oyun puanı ile genel skor aktarımını birbirinden ayırdım.
- Beraberlik durumlarını yazdım.
- Tutorial ve görsel/animasyon fikrini ekledim.
- Eski kaynak özetiyle değişen kurallar yeni sürüm alanlarında açıkça yazıldı.


## Asistan tasarım notu

Tutorial metinleri, yüksek kaliteli 2.5D sahne fikirleri, animasyonlar ve
kullanıcının karar vermeyi asistana bıraktığı teknik kenar durumlar ilk sürüm
uygulama sözleşmesi olarak dolduruldu. İleride değişiklik istenirse ilgili
oyunun alanı güncellenir ve proje hafızasına ayrıca işlenir.
