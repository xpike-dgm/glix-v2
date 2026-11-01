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
  Kör Bomba, Zaman Bombası Hafızası, Rus Ruleti). Oyun bazlı döküm: `docs/ONERI-KURAL.md`. Kör Kronometre'nin kendi erken
  kapanışı bu genel kuralın dışındadır ve §9'da tanımlıdır (her elde **bütün** katılımcılar —bağlantıdan bağımsız— basınca el
  1 sn sonra kapanır).
- **Geç gelen eylem payı (KİLİTLİ, sahip onayı):** Süre dolmadan gönderilip ağ gecikmesiyle sunucuya en fazla **250 ms** geç ulaşan eylem kabul edilir; süreye bağlı bitiş (faz geçişi, sonuç, gizli bilginin açılması) bu kadar gecikir, ekrandaki sayaç özgün bitişi gösterir. Pay yeni bir süre değildir: sunucu oyun saatini 250 ms geriden verir (`GameDefinition.graceMs`, oyun `setup` gerçek anda çalışır). **Yalnız Zehirli Kadeh, Yazı Yaz ve Sözlük Blöfü'nde** geçerlidir; zamanlama/tepki oyunları (Son Kişi, Butona Bas, Kör Kronometre, Kule Ustası, Aşırı Yükleme, Kör Bomba, Zaman Bombası Hafızası, Rus Ruleti ve diğerleri) kapsam dışıdır ve bitişten 1 ms sonraki eylemi eskisi gibi reddeder.
- **Yazılı cevap eşleşmesi genel kuralı (sahip onayı):** Oyuncuların yazdığı kelime/cevabın **eşleşip eşleşmediğine** bakılan her
  yerde karşılaştırma klavyeden bağımsızdır: büyük/küçük harf, ç/c, ğ/g, ı/İ/i/I, ö/o, ş/s, ü/u ve noktalama farkı yok
  sayılır (İngilizce klavyeyle yazan Türkçe klavyeyle yazanla eşleşir). Ekranda her zaman oyuncunun yazdığı biçim gösterilir.
  Kopya/yasak denetimi gibi kelimeleri **birleştirmemesi gereken** yerlerde (yönetici içerik havuzlarının tekrar denetimi) katı
  anahtar kullanılır: "göl" ile "gol" ayrı kelimedir.
- Sonuç ekranı (KİLİTLİ, Ekim 2026, sahip onayı): her mini oyundan sonra gösterilir. **Bağlı bütün katılımcılar "Devam"a
  basınca** hemen (1 saniye sonra) kapanır; basmayan olursa **60 saniye** sonra kendiliğinden kapanır (eskisi 30, ondan önce
  7 saniyeydi; Ekim 2026 sahip kararı).
  Bağlantısı kopan oyuncu beklenmez. Podyumda sıra numarası yazmaz; sıra altın/gümüş/bronz bloklar ve madalya ile gösterilir.
  Sonuç ve final ekranlarında taç yalnız kazanana verilir (ev sahibi tacı bu ekranlarda gösterilmez).
- Oyun içi sonuç ekranı (KİLİTLİ, Ekim 2026, sahip kararı: "sonuç ekranı tüm oyuncuların devam et tarzı bir butona
  bastıktan sonra geçilsin; süre fazlaca artsın, örnek 60 sn; neyin ne olduğu tam görülsün"): her mini oyunun kendi son
  açılışı (sonuçların, kartların, kepengin, panellerin… açıldığı ekran; açılışı olmayan oyunda oyunun bittiği andaki son
  ekran) **"Devam et"** düğmesiyle geçilir. Açılış animasyonu her zaman sonuna kadar oynar (eskiden oyunun bittiği süre
  artık "en az gösterim" süresidir); düğmeye animasyon bitmeden basılabilir ve sayılır ama animasyonu kesmez. Bağlı bütün
  katılımcılar basınca oyun (animasyon bittiyse) 1 saniye sonra biter; basmayan olursa açılış başından **en geç 60 saniye**
  sonra biter. Bağlantısı kopan oyuncu ve izleyiciler beklenmez; kimin bastığı avatarlarla gösterilir. Düğme açılışın ilk
  1,5 saniyesinde pasiftir (yanlışlıkla geçilmesin). Puanlar, kurallar ve gizlilik değişmez; yalnız bitiş zamanı değişir.
  Ardından genel sonuç ekranı (puan tablosu) gelir. Ayrıntı: `docs/ERKEN-BITIS.md` "Oyun içi sonuç ekranı".
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

**Durum: KİLİTLİ** (Ekim 2026 sahip onayı: YY-M1 … YY-M7, YY-U1 … YY-U8, YY-AI2; ayrıntı
`docs/oneriler/yazi-yaz.md`)

- Amaç: İki yazanın herkese açık bir konudan gizlice birer kelime yazdığı, diğer
  oyuncuların `MASUM` yazarak doğal görünmeye çalıştığı ve sonrasında yazan/kelime
  tahminlerinin yapıldığı sosyal çıkarım oyunu. Yazan bulunmamaya çalışır.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Yazma aşamasında tam **iki yazan** bulunur; maç tohumuyla rastgele seçilir.
- **Konu:** her oyunda herkese açık bir konu çıkar (ör. MEYVE). Liste yönetici
  panelindeki "Yazı Yaz konuları" içerik havuzundadır; sahip yazar, yapay zekâyla
  üretilmez. Yerleşik listede 100 konu vardır (sahibin isteğiyle hazırlandı; panelden kapatılıp düzenlenebilir); panelden `SERBEST` eklenirse o çıkınca oyun konusuz oynanır.
  Konu maç tohumuyla seçilir; aynı odada son 10 oyunda çıkan konu, havuz yetiyorsa
  tekrar gelmez. İki yazan aynı konuyu alır; konuya uymak zorunlu değildir (sistem
  denetleyemez), konu dışı kelime kural ihlali sayılmaz.
- Rol, yazma aşamasının başında ters duran rol kartına basılı tutulunca görünür;
  kart bir kez çevrilene kadar pano kapalıdır. Basılı tutmayan biri için iki kart
  aynıdır.
- Diğer oyuncular girişe `masum` yazar. Giriş otomatik büyük harfe çevrilir;
  küçük/büyük harf farkı oynanışı etkilemez.
- **Yazan MASUM yazamaz:** yazan MASUM yazıp Tamam derse yalnız kendi ekranında
  uyarı çıkar ve kilitlenmez; süre dolduğunda MASUM bırakan yazan "kelime
  yazmadı" sayılır.
- **Unutkan masum:** boş "Tamam" diyen masumun girişi MASUM olur ve kilitlenir;
  hiç yazmayan masum süre dolunca MASUM sayılır.
- Pano gizlidir: yazılan her harf kısa süre görünür, sonra ● olur; basılı tutunca
  kelimenin tamamı görünür.
- Aşamalar: **30 saniye yazma → 60 saniye sözlü tartışma → 30 saniye tahmin**.
- Yazma aşamasında kimin "Tamam" dediği gösterilmez; yalnız hazır sayısı
  ("3/6 hazır") görünür. Tartışmada ve tahminde kimin hazır olduğu görünür.
- **Harf ipucu:** tartışma başlarken iki kelimenin harf sayısı, kimin olduğu
  söylenmeden, küçükten büyüğe gösterilir ("5 harf · 7 harf"); yalnız harf ve
  rakam sayılır, boşluk sayılmaz. Kelime yazmamış yazan için "yazılmadı". İpucu
  tartışma ve tahmin boyunca görünür; başka ipucu (ilk harf vb.) verilmez.
- Masum oyuncu yalnızca **bir yazanı ve o yazanın kelimesini** tahmin eder.
- Her yazan, diğer yazanı ve diğer yazanın kelimesini tahmin eder.
- Oyun içi **dedektif puanı:** doğru yazan tahmini **+1**, doğru kelime tahmini
  **+1** (yalnız kişi doğruysa), **"İz bırakmadın" +1:** hiçbir masumun seçmediği,
  kelime yazmış yazan. Diğer yazanın seçmesi bu ödülü bozmaz; hiçbir masum seçim
  yapmadıysa kelime yazmış iki yazan da +1 alır. Yazanın en yüksek dedektif puanı 3,
  masumun 2'dir.
- Kelime eşleşmesi klavyeden bağımsızdır; **6 ve daha uzun** kelimelerde, harf sayısı
  aynıysa **tek harf farkı** da doğru sayılır (eksik/fazla harf kabul edilmez).
- Genel skora **sıralama** gider: en yüksek dedektif puanı **+2**, sonraki farklı
  toplam **+1**, diğerleri 0. Birincide eşitlikte hepsi +2; toplamı 0 olan ödül
  almaz; herkesin toplamı aynı ve 0'dan büyükse herkes +1; herkes 0 ise kimse puan
  almaz. Eksi puan yoktur.
- Tahmin göndermeyen oyuncu eksi almaz; yalnızca artı puan alamaz.
- Kelimeler oyuncular tarafından yazılır; iki yazanın aynı kelimeyi yazmasına
  izin verilir.
- Bağlı herkes hazırsa aşama 1 sn sonra biter; son eksik oyuncu bağlantısını
  yitirirse de bu yeniden denetlenir.
- Sonuç ("Yazanlar…" açılışı, en az 8 sn): yazan kartları döner, kelimeler daktilo
  gibi yazılır, bulanların avatarları kartlara uçar, "n kişi buldu" ya da
  "İZ BIRAKMADI" damgası; ardından herkesin satırı (dedektif puanı ve +2/+1/0).
  Ekran "Devam et" ile geçer (en çok 60 sn). İsteğe bağlı tek cümlelik spiker
  yorumu (yapay zekâ bağlıysa; gelmezse görünmez, oyun beklemez).
- Görsel: ters rol kartı (YAZAN: daktilo ve kalem / MASUM: boş kâğıt), daktiloya
  takılı kâğıtta konu, gizli neon pano, portre halkası; sonuçta doğru seçim yeşil,
  yanlış kelime kısa kırmızı titreme.

## 2. Kendim — `kendim`

**Durum: KİLİTLİ** (Ekim 2026 sahip onayı: KN-M1 … KN-M4, KN-U1 … KN-U7; ayrıntı `docs/oneriler/kendim.md`)

- Amaç: Herkesin konu kartına göre kendisini anlatan bir kelime yazması ve
  karıştırılan kelime kartlarını doğru oyuncularla eşleştirmesi.
- Minimum oyuncu: **3**.
- Maksimum oyuncu: **8**.
- Aşamalar: **30 saniye kelime yazma → eşleştirme (3–5 oyuncuda 30 saniye,
  6–8 oyuncuda 40 saniye) → kart kart açılış**.
- **Konu:** her oyunda bir konu kartı çekilir (ör. "Hayvan olsaydın?"); herkes
  kendini o konuyla tek kelimeyle anlatır. Liste yönetici panelindeki "Kendim
  konuları" içerik havuzundadır (her satır: konu ve yazı kutusundaki ipucu);
  yerleşik listede 100 konu vardır (ilki bugünkü konu: "Kendini anlat", ipucu
  "Ben…"); panelden kapatılır, düzenlenir, eklenir. Panelde liste boşsa ya da
  geçersizse yerleşik liste kullanılır. Konu
  maç tohumuyla seçilir; aynı odada son 5 oyunda çıkan konu tekrar seçilmez
  (liste 5'ten kısaysa yalnız bir önceki tekrar edilmez). Konu yazma ekranında
  büyük, eşleştirme ve sonuçta üstte küçük görünür.
- Her oyuncu kendisini anlatan **tek bir kelime** yazar: boşluk kabul edilmez
  (boşluk tuşu çalışmaz, yapıştırılan boşluklu yazı bitişik hâle getirilir;
  sunucu boşluklu yazıyı reddeder). Tire (-) serbesttir; sınır 24 harftir.
- Kelimeler kart olarak karıştırılır; kartın sahibi doğrudan gösterilmez.
- Tüm kartları eşleştirmek zorunlu değildir.
- Oyuncu kendi kelimesini kendisiyle eşleştiremez.
- Aynı kelimeyi birden fazla oyuncu yazabilir; birbirinin yerine geçer.
- **Tanıma puanı:** doğru eşleştirme **+1**, yanlış eşleştirme **0** (ceza yok),
  boş bırakılan kart **0**.
- Bir kelimeyi yalnızca bir oyuncu doğru sahibine eşleştirirse kelime sahibi
  tanıma puanına **+1 bonus** alır. İki ya da daha fazla oyuncu bulursa ya da
  kimse bulamazsa bonus yoktur. Hiç eşleştirme yapmayan oyuncu da bonusu alır
  (sessiz oyuncu kuralı yoktur). Kelime yazmayan oyuncu eşleyip puan toplar ama
  kartı olmadığı için bonus alamaz.
- **Genel skor:** en yüksek tanıma puanı **+2**, sonraki farklı toplam **+1**,
  diğerleri 0. Birincide eşitlik varsa hepsi +2 alır ve sonraki farklı toplam +1
  alır. Tanıma puanı 0 olan ödül almaz; herkesin toplamı aynı ve 0'dan büyükse
  herkes +1, hepsi 0 ise kimse almaz.
- Kartlarda "birinci" en yüksek tanıma puanı, "sonuncu" en düşüktür; herkes
  eşitse kimse sonuncu değildir.
- Bağlı herkes Tamam derse yazma ve eşleştirme aşamaları 1 sn sonra biter.
- Eşleştirmeden itibaren kelime kartları sahipsiz olarak izleyiciye ve TV'ye de
  görünür; kimin kimi seçtiği açılışa kadar kimseye görünmez, yalnız kimin Tamam
  dediği görünür.
- **Açılış (kart kart):** her kart 3 sn: kart ortada büyür ve kelime okunur →
  kimin kimi tahmin ettiği görünür → kart döner, sahibi açılır, doğru bilenler
  yanar → kartı tek kişi bulduysa "TEK BULAN" şeridi. Kartlar karışık sırayla,
  oyuncunun kendi kartı en son ("Seni kim tanıdı?"; izleyicide en son kart
  rastgele). Aynı kelimeyi yazanların kartlarında "İkiz kelime!" etiketi.
  Açılış süresi = kart sayısı × 3 sn + 3 sn; ardından özet ekranı ve "Devam et"
  (en çok 60 sn, açılış kesilmez).
- Tutorial/görsel ayrıntıları:
  1. Konu kartına göre kendini tek kelimeyle anlat (aynaya yaz).
  2. Karışık kelime kartlarını oyuncu portreleriyle eşleştir.
  3. Doğru eşleme +1, yanlış ceza yok.
  Görsel: buğulu, gotik mor-altın çerçeveli ayna; havada duran hologram kelime
  kartları, portrelere bağlanan neon ipler ve kart kart açılış.

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

**Değişiklik (Ekim 2026, sahip onayı: SZ-M1 … SZ-M6; ayrıntı `docs/oneriler/sizma.md`) — yukarıdaki cevapların önüne geçer:**

- **Konuşma sırası uygulamada ilerler.** Ekranda "TUR 1 / 2" ve konuşan oyuncu vurgulanır. Konuşan, ipucunu söyleyince
  kendi ekranındaki **"Söyledim"** düğmesine basar; sıra bir sonrakine geçer. Her konuşma hakkı en çok **15 saniyedir**;
  dolarsa sıra kendiliğinden geçer (ceza yok). "Söyledim"e yalnız sırası gelen basabilir. Bağlantısı kopuk oyuncunun
  sırası atlanır. Sıra iki turda da aynıdır. İki tur bitince **3 saniyelik geri sayımla** oylama kendiliğinden başlar.
  "Oylamaya geç" erken çıkış olarak kalır: bağlı herkes basarsa kalan sıralar atlanır, oylama 1 sn sonra başlar.
  İpucu aşamasının 5 dakikalık teknik üst sınırı değişmez. Uygulama ipucunun içeriğini denetlemez (yazılı ipucu yok).
- **Bağlantısı kopan oyuncuya da oy verilebilir.** Oyun başında oyuncu olan herkes oylanabilir; kopan oyuncu oy
  veremez, cevap veremez ve bekleme sayımlarında beklenmez.
- **Eşitlikte ikinci oylama.** İlk oylamada en çok oyu alanlar eşitse (en az bir oy verilmişse), yalnız eşit adaylar
  arasında **15 saniyelik** tek bir ikinci oylama yapılır. İlk oylamanın oyları silinir; herkes (adaylar dahil, kendine
  de) yeniden oy verir. Ekranda yalnız adayların adları görünür, oy sayıları gösterilmez. Sızma adaylar arasında olmasa
  da ikinci oylama yapılır. İkinci oylamada da eşitlik olursa ya da kimse oy vermezse sızma kurtulur. İlk oylamada hiç
  oy yoksa ikinci oylama olmaz. Herkes "Oyumu ver" derse 1 sn sonra biter.
- **"Sızma sen miydin?" süresi 10 saniyedir** ve artık bedava değildir: **Evet diyen ama sızma olmayan oyuncu yakalama
  puanını alamaz.** Sızmanın Evet bonusu (+1) aynen kalır. Cevap vermeyen Hayır sayılır. Diğer oyuncuların cevapları
  hiçbir zaman açılmaz; yalnız kendi sonucun ("Evet dedin, yakalama puanı alamadın") sana gösterilir.
- **Puan:** sızma tek başına en çok oyu alırsa (ikinci oylama olduysa onda) yakalanır. Yakalanırsa **yalnız sızmaya oy
  veren** (sayılan oylamanın son geçerli oyu) ve Evet demeyen sızma olmayan oyuncular **+1**, diğerleri 0; sızma kendine
  oy verse de bu puanı almaz. Kurtulursa sızma **+2**, diğerleri 0. Puan aralığı 0…+3, eksi yok; +2/+1/0 sıralamaya
  çevrilmez. Kartlarda "birinci" en yüksek puanlılar, "sonuncu" en düşüklerdir.
- **Son şans:** yakalanan sızmanın maskesi düşer ve **15 saniye** içinde **ortak kelimeyi yazarak** tek bir tahmin
  yapar. Bu sırada ortak kelime kimsenin ekranında görünmez (sızma yalnız kendi kelimesini görür). Karşılaştırmada
  Türkçe büyük harf kullanılır; baştaki/sondaki boşluk ve noktalama atılır; şapkalı harf düz sayılır (Â = A). Ek almış
  hâl (ÇAYI) doğru sayılmaz. Bilirse "KELİMEYİ ÇALDI!" ve sızma **+1**; yakalayanların puanı değişmez. Süre dolar ya da
  sızmanın bağlantısı koparsa tahmin yok sayılır. Kurtulan sızmaya bu aşama gelmez. Tahminden sonra iki kelime açılır;
  sonuç ekranının "Devam et" düğmesi bu aşama bitince açılır.
- Tutorial adımları: 2 "İki turda sırayla sesli ipucu ver"; 3 "Sızmayı oyla; eşitlikte yeniden oylanır".

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

**Değişiklik (SB, Kasım 2026, sahip onayı; `docs/oneriler/sozluk-blofu.md`, `KARARLAR-15-OYUN.md`) — yukarıdaki
cevapların önüne geçer:**

- **Puan (SB-M1):** Oyun içinde **blöf puanı** bugünkü gibi toplanır (gerçeği bulmak +1, blöfünü seçen her kişi +1;
  eksi yok); bu mini oyun puanıdır. Genel skora blöf puanı değil **sıralama ödülü** gider: en yüksek blöf puanı **+2**
  (birincide eşitlikte hepsi +2), sonraki farklı toplam **+1**, diğerleri 0. Blöf puanı 0 olan ödül almaz; herkesin
  toplamı aynı ve 0'dan büyükse herkes +1, hepsi 0 ise kimse. Kartlarda "birinci" en yüksek, "sonuncu" en düşük blöf
  puanıdır (herkes eşitse kimse sonuncu değildir).
- **Tekrar (SB-M2):** Aynı odada son **40** Sözlük Blöfü oyununda çıkan kelime tekrar gelmez. Süzgeç yerleşik havuza da
  uygulanır; süzülünce kalan girdi havuzun alt sınırının (10) altına düşerse süzgeç uygulanmaz. Hafıza yalnız bellektedir,
  oda kapanınca sıfırlanır.
- **Tür (SB-M3):** Kelimenin altında sözlükteki gibi küçük italik tür satırı görünür: **isim**, **sıfat**, **fiil** ya
  da **zarf** (yazma, seçme, açılış ve TV). Tür havuzda zorunlu alandır (yönetici formunda açılır liste); türü girilmemiş
  eski girdide satır görünmez.
- **Gerçek tanım biçimi (SB-M6):** Gerçek tanımlar tek cümle, en çok **70** karakterdir; noktalı virgül, parantez ve
  "ör." içermez, ikinci anlam eklenmez. Yönetici panelinde yeni eklenen ve düzenlenen girdilere uygulanır; kurala uymayan
  yerleşik tanımlar anlamı korunarak sadeleştirildi. Oyuncunun blöfünde bu kısıtlar yoktur (100 karakter aynen).
- **"Bu kelimeyi önceden biliyordum" (SB-M7):** Açılış ekranında, açılışın ilk 1,5 sn'sinden sonra etkin bir düğme.
  Oyuncu başına bir kez sayılır, geri alınabilir; **puana etkisi yoktur**. Kim bastığı kimseye gösterilmez ve saklanmaz;
  havuz istatistiğine kelime başına yalnız iki sayı yazılır (kaç oyunda çıktı, kaç "biliyordum" geldi). Yönetici
  panelinde kelime başına **bilinirlik %** görünür. En az 10 oyunda çıkmış ve oranı %40'ı aşan kelimenin çekiliş
  ağırlığı yarıya iner; %60'ı aşan panelde "kapatma önerisi" olarak işaretlenir.
- **Açılış (SB-U5):** Önce sahte kartlar azdan çoğa kandırana doğru tek tek açılır, en son "Gerçek anlam…" ve gerçek
  kart mühürlenir ("SÖZLÜKTE"); ardından tek bir özel damga: gerçeği kimse bulamadıysa **SÖZLÜK KAZANDI**, tek bir en
  çok kandıran varsa **BLÖF USTASI**, seçen herkes gerçeği bulduysa **HERKES BİLDİ** (öncelik bu sırada). Damgalar puan
  vermez. Açılış en az 12 sn'ye sığar.
- **Anlatım (SB-U16):** (1) "Garip kelimeye inandırıcı sahte bir anlam yaz", (2) "Karışık anlamlardan gerçeğini seç:
  bulursan +1", (3) "Senin blöfünü seçen her kişi +1 kazandırır; en çok puanlayan +2".
- Değişmeyenler: 3–8 oyuncu, tek kelime, 50 sn yazma + 30 sn seçme + en az 12 sn açılış, 100 karakter sınırı, tek
  seferlik gönderim, kendi kartını seçememe, gerçeğin birebir aynısının reddi, puan kalemleri, eksi puan yok, kart
  sırasının herkes için aynı olması, 250 ms geç eylem payı, erken bitiş kuralları. İki oyuncunun aynı blöfü yine iki
  ayrı kart olur (SB-M4 onaylanmadı); küçük masada yem kart yoktur (SB-M5 onaylanmadı).

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

**Değişiklik (CG, Kasım 2026, sahip onayı; `docs/oneriler/cagrisim-agi.md`, `KARARLAR-15-OYUN.md`) — yukarıdaki
cevapların önüne geçer:**

- **Üç kelimelik seri (CG-M2):** Oyun tek kelime yerine **üç kelime** üst üste oynanır. Her kelimede **20 sn** cevap,
  ardından **4 sn**'lik mini açılış (yalnız o kelimenin ağları; dokunarak geçilmez); üçüncü kelimeden sonra büyük açılış
  (en az **8 sn**, "Devam et" ile geçilir). En uzun hâli 76 sn. Erken bitiş her kelimede ayrı çalışır: bağlı herkes
  gönderince 1 sn sonra o kelimenin açılışı başlar. Her kelimede oyuncu tek cevap yazar, gönderilen cevap kesindir.
  Yazmayan o kelimede 0 alır; bağlantısı kopan sonraki kelimede dönerse oynamaya devam eder. Ağ puanları üç kelimede
  toplanır. Üç kelime aynı oyunda birbirinin aynısı olamaz.
- **Genel skor (CG-M1):** Ağ puanı (ağdaki kişi sayısı) mini oyun puanıdır. Genel skora üç kelimenin **toplam** ağ
  puanına göre sıralama ödülü gider: en yüksek toplam **+2** (eşitlikte hepsi +2), sonraki farklı toplam **+1**,
  diğerleri 0. Ağ puanı 0 olan ödül almaz. Herkesin toplamı aynı ve 0'dan büyükse herkes **+1**; hiç ağ yoksa kimse.
  2 oyuncuda hep eşleşirseniz ikiniz de +1. Kartlarda "birinci" en yüksek, "sonuncu" en düşük toplam ağ puanıdır.
- **Eşleşme (CG-M3):** Klavye toleransına ek olarak (1) **boşluk ve tire** yok sayılır ("deniz kenarı" =
  "denizkenarı" = "deniz-kenarı"); (2) sondaki **-lar / -ler** çoğul eki, kalan kök en az 3 harfse yok sayılır
  ("dalgalar" = "dalga"; "dolar", "kiler" dokunulmaz); (3) **6 harf ve üstü** cevaplarda harf sayısı aynı ve yalnız
  **bir harf** farklıysa aynı sayılır ("kumsal" = "kumsak"); 5 harf ve altında tam eşleşme gerekir. Gruplama iki
  adımlıdır: önce (1)–(2) ile kesin gruplar kurulur, sonra tek kalan cevap ya da daha küçük grup, bir harf uzaktaki **en
  büyük** gruba katılır; zincirleme yoktur. Eşit büyüklükte iki grup bir harf uzaksa birleşir. Anlamca eş cevaplar
  ("araba" / "otomobil") birleşmez. Ekranda **oyuncunun yazdığı biçim** gösterilir (küçük harfe çevrilmez); grupta
  birden çok yazılış varsa Türkçe harf içeren, eşitlikte ilk cevap verenin yazılışı. Birleşen farklı yazılışlar ağ
  kutusunun altında küçük yazıyla görünür: "(dalgalar, dalga)".
- **Tekrar (CG-M4):** Aynı odada son **60** kelime (yaklaşık 20 oyun) tekrar gelmez. Süzgeç yerleşik havuza da
  uygulanır; süzülünce kalan kelime havuz alt sınırının (10) altına düşerse süzgeç uygulanmaz. Hafıza yalnız bellektedir,
  oda kapanınca sıfırlanır.
- **Zorluk (CG-M5):** Havuzdaki her kelime **kolay** (tek baskın çağrışım), **orta** (iki-üç güçlü çağrışım) ya da
  **zor** (dağınık) etiketi taşır; etiketsiz kelime orta sayılır. Seri **kolay → orta → zor** sırasıyla çekilir; bir
  zorlukta kelime kalmazsa komşu zorluktan çekilir. Zorluk yönetici havuz formunda isteğe bağlı açılır listedir.
- **Kelime karnesi (CG-M6):** Oyun bitince oynanan her kelime için havuz istatistiğine yalnız iki oran yazılır: en büyük
  ağdaki kişi / cevap veren ve tek kalan / cevap veren (kimse yazmadıysa yazılmaz). Cevap metni, oyuncu adı, oda kodu
  saklanmaz. Yönetici panelinde kelime başına "kaç oyunda çıktı · ortalama en büyük ağ % · tek kalan %". En az 8 oyundan
  sonra: ortalama en büyük ağ ≥ %80 → "kolay önerisi"; ≤ %30 ve tek kalan ≥ %60 → "zor önerisi"; hiç ağ kurulmadıysa
  "kapatma önerisi". Öneriler sahip onayına gider, kendiliğinden uygulanmaz.
- **Açılış (CG-U5, CG-U6, CG-U7, CG-U8):** Büyük açılışta küre ortada, oyuncular çevresinde halka: herkesin kartı ters
  belirir, tek kalanlar tek tek söner, ağlar küçükten büyüğe neon çizgilerle küreye bağlanır, en büyük ağ en son
  ("EN BÜYÜK AĞ"); ardından liste, seri özeti ve toplamlar. Üstte "n kişilik ağ" (ağ puanı) ve genel skor rozeti
  (+2 / +1). İki özel damga (puan etkisi yok): herkes aynı ağdaysa **TEK YÜREK**; 4+ oyuncuda biri hariç herkes aynı
  ağdaysa **KARA KOYUN** (dışarıdaki "bu sefer farklı düşündü"). Ağ kutularında kısa isimler; yazmayanlar "Yazmadı" ve
  "Bağlantı koptu" diye ayrılır.
- **İzleyici (CG-U12):** İzleyici cevap aşamasında "Sen de dene (sayılmaz)" alanına yazabilir; yazdığı sunucuya gitmez,
  hazır sayısına girmez, açılışta yalnız kendi ekranında hangi ağa düşeceği gösterilir.
- **Ağ spikeri (CG-AI2):** Büyük açılışta tek cümlelik yorum (ortak yorum altyapısı): modele kelimeler, ağlar ve tek kalan
  cevaplar "Oyuncu1…N" adlarıyla gider; saklanmaz, puanı etkilemez, gelmezse hiç görünmez.
- **Anlatım (CG-U14):** (1) "Ortadaki kelimeyi gör", (2) "Çoğunluk ne yazar? Tek bir cevap yaz", (3) "Aynısını
  yazanlarla ağ kur: üç kelime, puanlar toplanır"; görselde küçük not: "Cevabını yüksek sesle söyleme! Küçük yazım
  hataları sayılmaz."
- Değişmeyenler: 2–8 oyuncu, kelime başına tek cevap ve gönderilen cevabın kesinliği, ağın en az iki kişi olması, ağ
  puanının ağdaki kişi sayısı olması, tek kalanın ve yazmayanın 0 alması, eksi puan yok, klavyeden bağımsız eşleşme,
  60 karakter teknik sınır, erken bitiş kuralı, cevapların açılışa kadar gizli kalması. Gönderdikten sonra düzeltme
  yoktur (CG-M8 onaylanmadı); tema serisi yoktur (CG-M7 onaylanmadı); anlamca eş cevapları yapay zekâ birleştirmez
  (CG-AI1 onaylanmadı).

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

**Değişiklik (BB öneri paketi, Kasım 2026, sahip onayı: BB-M1…M5) — yukarıdakilerin önüne geçer:**

- **Dolum (BB-M1):** Sayılan her basıştan sonra buton **1 saniye dolar**; bu sürede gelen basış sunucuda **sessizce yok
  sayılır** (ceza yok, pencere açmaz). Bekleme yalnız sayılan basıştan başlar ve dokunma anlarına göre ölçülür; ara 3 sn
  olduğundan her tur "dolu" başlar. Bir turda en çok 15, oyunda en çok 45 sayılan basış. Aynı pencerede tekrar basış bu
  yüzden zaten sayılmaz.
- **Kayan pencere (BB-M3):** Pencereler turun başından sabit dilimlerle sayılmaz. Bir basış geldiğinde bir pencere açılır
  ve turun pencere süresi kadar (300 / 200 / 120 ms) açık kalır; bu sürede basan herkes o pencereye girer. Pencere
  kapanınca sonraki basış yeni pencere açar; aynı anda iki pencere açık olmaz, zincir uzamaz (süre ilk basıştan ölçülür).
  Pencere tur bitişini geçemez. Açılış anı penceredeki ilk basışın (dokunma) anıdır.
- **Dokunma anı (BB-M4):** İstemci basışla birlikte dokunma anını (sunucu saatine göre) gönderir. Sunucu bu anı, turun
  içindeyse ve kendi aldığı andan **en çok 250 ms** eskiyse kabul eder; yoksa (eski, turdan önce ya da gelecekten) kendi
  aldığı anı kullanır. Pencereler dokunma anlarına göre kurulur; geç ulaşan ama daha erken dokunulmuş basış pencerenin
  açılışını öne çeker. Hileye karşı her pencere kapanıştan **250 ms sonra** (en geç tur sonunda) puanlanır ve yayınlanır.
  Turun bitişinden sonra gelen basış eskisi gibi reddedilir (geç eylem payı yok; yalnız ölçüm düzelir).
- **Kalabalık bonusu (BB-M2):** Bir pencerede basanların sayısı, pencereyi açan basış anındaki bağlı katılımcı sayısının
  **yarısından fazlaysa** basanların her biri +1 yerine **+2** alır ("KALABALIK!"; bağlı herkes bastıysa "TAM EKİP!", yine
  +2). Yalnız **4 ve üstü bağlı katılımcıda** geçerlidir (eşik: 4 kişide 3, 5'te 3, 6'da 4, 7'de 4, 8'de 5); 2–3 kişide
  eşleşme hep +1. Kopan oyuncu eşiği zorlaştırmaz. Tek basış −1, normal eşleşme +1 aynen kalır.
- **Genel skor (BB-M5):** Ödül yalnız toplamı **0'dan büyük** olanlara verilir: tek lider (> 0) +2, sıradaki farklı toplam
  (> 0) +1; liderler eşitse (> 0) hepsi +1, +2 verilmez. Herkesin toplamı ≤ 0 ise kimse ödül almaz. Kartlar değişmez.
- **Değişmeyenler:** 2–8 oyuncu; 3 tur × 15 sn, 3 sn ara (51 sn); pencere süreleri 300 / 200 / 120 ms; eşleşme +1, tek
  basış −1, kimse basmazsa değişmez; genel skor oyun sonunda bir kez; gizli bilgi yok; sonuç ekranı "Devam et" ile geçer.
- **Anlatım (BB-U15):** 1) "Birlikte bas: aynı anda basanlar +1, tek kalan −1" 2) "Bastıktan sonra buton 1 sn dolar; yüksek
  sesle '3, 2, 1, BAS!' deyin" 3) "3 tur: pencere her turda daralır (300, 200, 120 ms)". Oyun ekranında ms yazılmaz;
  pencere "Geniş / Dar / İğne ucu" ve butonun çevresindeki halkanın kalınlığıyla anlatılır.
- **Son açılış (BB-U7, BB-AI1):** Oyun bitince herkese açık sonuca her ikilinin ortak pencere sayısı ve oyuncu başına tek
  basış sayısı eklenir ("En uyumlu ikili", "Yalnız kurt"); ortak yapay zekâ yorum altyapısı tek cümlelik "uyum spikeri"
  yorumu ekleyebilir (modele yalnız Oyuncu1…N ve sayılar gider; puana karışmaz, hata olursa görünmez).

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

**Değişiklik (RR öneri paketi, Kasım 2026, sahip onayı: RR-M1, RR-M3, RR-M4, RR-U5, RR-U8, RR-U9) — yukarıdakilerin önüne geçer:**

- **Hemen geri ateş yok (RR-M1):** Boş geçen bir atışla silah başkasından sana geldiyse, **bu ilk kararında** sana
  sıkanı hedefleyemezsin (sunucu reddeder; ekranda kilit ve "Az önce sana sıktı"). Yasak yalnız **en az 3 kişi
  hayattayken** geçerlidir ve yalnız bir karar sürer; kendine sıkmak her zaman serbesttir. Kendine sıkıp boş geçen sahip ve
  patlamadan sonra silahı alan için yasak yoktur. Süre dolunca otomatik atış da yasaklı kişiyi seçmez.
- **Son söz (RR-M3):** Patlamayla elenen (kendini vurup elenen dahil), oyun bitmiyorsa sonuç gösteriminden sonra **4 sn**
  içinde silahı hayatta olan herhangi birine verir (onu vuran dahil); seçince karar penceresi 0,5 sn sonra açılır. Seçmezse
  ya da bağlantısı kopuksa (ya da bu sürede koparsa) silah eskisi gibi **rastgele** bir hayatta oyuncuya gider. Son söz
  sürerken kimse ateş edemez; az önce elenenin "Patlar mı?" tahmini son sözünden sonra başlar (diğer elenenler verebilir).
  Seçim seçilene kadar yalnız elenenin ekranındadır; sonra herkes "Elif silahı Mert'e verdi" görür. Oyunu bitiren
  patlamada son söz yoktur.
- **Kopan oyuncu (RR-M4):** Bağlantısı kopan hayattaki oyuncu **elle de hedeflenebilir** (eski "bağlı olmalı" şartı
  kalktı). Silah bağlantısı kopuk birindeyse karar süresi **6 sn**'dir (karar sırasında koparsa kalan süre en çok 6 sn'ye
  iner); dönen oyuncu kalan süreyle karar verir. İlk silah sahibi yine bağlı oyuncular arasından seçilir.
- **Bekleme süreleri (RR-U5, RR-U9, RR-U8):** Her atıştan sonra eylem kabul edilmeyen bekleme **3,5 sn**'dir (1,2 sn tambur
  dönüşü + 2,3 sn sonuç; sonuç atış anında sunucuda belirlenir, ekran yalnız gösterimi geciktirir). Patlamada son sözle
  birlikte en çok 3,5 + 4 = **7,5 sn**. Oyunun ilk kararı "SİLAH SENDE!" bandı kadar uzun açılır (**18,8 sn**). Oyunu
  bitiren atıştan sonra oyun içi açılış en az **6 sn** gösterilir; "Devam et" kuralı değişmez.
- **Herkese açık bilgi:** Bütün atışların geçmişi (ateşleyen, hedef, risk, sonuç, otomatik mi), yasaklı hedef, bekleyen son
  söz ve silahın son sözle kime verildiği herkese açıktır; zar tohumu hiçbir yerde yoktur. Elenenin tahmin karnesi
  (kaç tahmin, kaçı tuttu, "Evet"lerin kaçı tuttu) yalnız kendisine gider.
- **Değişmeyenler:** 2–8 oyuncu; risk %16 başlangıç, +10 artış, %76 tavan, patlamada %16; yalnız sahibin ateş etmesi;
  18 sn karar süresi; süre dolunca sahip dışındaki rastgele birine otomatik atış; yarı eşiğinde bitiş; erken bitiş
  olmaması; O9 tahmin kuralları ve Kâhin eşiği; puan: hayatta kalan +1, elenen 0 (eksi yok).
- **Anlatım:** "Silah sendeyse birini ya da kendini seç; boş geçerse silah ona geçer" · "Risk %16'dan başlar, her boş
  atışta 10 artar; patlayınca sıfırlanır" · "Yarınız elenince biter: hayatta kalanlar +1".

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

**Değişiklik (GH öneri paketi, Kasım 2026, sahip onayı: GH-M1, GH-M2, GH-U5, GH-U7, GH-U15) — yukarıdakilerin önüne geçer:**

- **Herkes karar verir: ÇAL ya da ÇALMA (GH-M1):** Ekranda iki eş görünümlü düğme vardır (solda ÇALMA, sağda ÇAL).
  Her katılımcı birine **bir kez** basar; karar geri alınmaz (sonraki eylemler hata vermeden yok sayılır). Puan değişmez:
  ÇALMA = eski "basmadı" (0); hiç karar vermeyen de ÇALMA sayılır. Düğme parmak kalkınca tetiklenir; ekranı kaydıran
  dokunuş hamle sayılmaz.
- **Erken bitiş (GH-M1):** **Bağlı bütün katılımcılar** karar verince (ÇAL ya da ÇALMA) aşama 1 sn sonra biter; kopan
  oyuncu beklenmez (son eksik oyuncu koparsa da 1 sn sonra biter). Eski "bütün katılımcılar bastı (bağlantıya bakmadan)"
  erken bitişinin yerine geçer.
- **Herkese açık bilgi (GH-M1):** Yalnız **kimlerin karar verdiği** (ne seçtiği değil) herkese açıktır. ÇAL/ÇALMA ayrımı,
  sayı ve zaman damgası süre bitene kadar hiçbir görünüme gitmez; oyuncu yalnız kendi kararını görür.
- **Kasada kıpırtı (GH-M2):** **3 ve daha çok** oyuncuda, oyunun **15. saniyesinde** herkese aynı ortak işaret verilir:
  o ana kadar en az bir kişi ÇAL dediyse **"Kasada kıpırtı var!"**, demediyse **"Kasa sessiz"**. Sayı ve kimlik yoktur.
  İşaret yalnız 15. saniyedeki durumu söyler ve oyun sonuna kadar öyle kalır; ÇALMA kararları etkilemez. **2 oyuncuda
  işaret yoktur** (kimliği ele verirdi). Bağlı herkes 15. saniyeden önce karar verdiyse oyun erken biter ve işaret verilmez.
- **Açılış (GH-U5):** Süre bitince (ya da erken bitişte) oyun ekranında kasa açılır: önce parmak izi sayısı, sonra
  hırsızlar ÇAL sırasıyla adları ve ÇAL saniyeleriyle, sonra damga; altında 0–30 sn zaman şeridi (GH-U6). Bu anda çalanlar,
  ÇAL anları ve 15. saniyeden önce çalanların "kıpırtı" simgesi herkese açılır; ÇALMA kararları hiç gösterilmez. Açılış en
  az **4,5 sn** gösterilir; "Devam et" kuralı değişmez.
- **Ses ve titreşim (GH-U7, GH-U15):** Karar anında ses yoktur; titreşim herkesin çevirebildiği oyalama kadranının
  tıkırtısıyla aynıdır. Son 5 sn'de herkesin telefonu (karar vermiş olsun olmasın) saniyede bir kısa titrer.
- **Değişmeyenler:** 2–8 oyuncu; 30 sn; oyuncu başına tek, geri alınmaz karar; kimin çaldığının süre bitene kadar hiçbir
  yere gitmemesi; tek hırsız +1, çoklu ÇAL'da her hırsıza −1, çalmayana 0, kimse çalmazsa herkese 0; genel skora doğrudan
  aktarım; geç gelen eylem payı yok. Reddedilenler: geç ganimet (GH-M3), gizli bekçi (GH-M4), yemin (GH-M5), üç soygun
  (GH-M6), eksisiz puanlama (GH-M7), 20 sn (GH-M8).
- **Anlatım:** "Çal ya da çalma: bir kez karar ver, geri alamazsın" · "15. saniyede kasa kıpırtıyı ele verir: erken çalan
  önce davranır" · "Tek hırsız +1, iki ve daha çok hırsız −1".

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

**Değişiklik (KR öneri paketi, Kasım 2026, sahip onayı: KR-M1…M5) — yukarıdakilerin önüne geçer:**

- **Üç el (KR-M3):** Oyun **3 el**dir. Her elin hedefi 7–13 arası rastgele tam saniyedir ve **eller arasında tekrar etmez**
  (tohumlu RNG). Her elde herkes **bir kez** basar.
- **"Hazır ol – BAŞLA!" (KR-M2):** Her el önce **"Hazır ol"** ile başlar (1. elde **3 sn**, 2. ve 3. elde **2 sn**): hedef dev
  rakamla görünür, basış kapalıdır; bu sırada basmak hiçbir şey yapmaz ve hak yakmaz. Ardından bütün telefonlarda aynı anda
  (sunucu saatine göre) **"BAŞLA!"** flaşı, tek gong ve titreşim. **Sayma ve basış anı "BAŞLA!" anından ölçülür.** Elin
  basış süresi "BAŞLA!"dan **hedef + 8 sn**dir.
- **Dokunma anı (KR-M1):** İstemci basışla birlikte dokunma anını (sunucu saatine göre, ping ortancasıyla düzeltilmiş)
  gönderir. Sunucu bu anı, kendi aldığı andan **en çok 400 ms** eskiyse kabul eder; daha eskiyse ya da bildirilmemişse kendi
  aldığı anı kullanır; gelecekten gelen an sunucunun aldığı ana çekilir; "BAŞLA!"dan önceki an reddedilir (hak yanmaz).
  **Süre sınırı değişmez:** basış sunucuya elin basış süresi bitmeden ulaşmalıdır; bitişten sonra gelen basış eskisi gibi
  reddedilir (geç eylem payı yok). Bir el kapanmadan o elin hiçbir basışı kimseye açılmaz.
- **Erken kapanış (el başına):** Bir elde **bütün katılımcılar** (bağlantıdan bağımsız) basarsa el, son basışın sunucuya
  ulaştığı andan **1 sn sonra** kapanır; sonraki eller buna göre öne kayar.
- **El arası:** Her el kapanınca **3 sn** kısa açılış (kendi sonucun, elin kazananı, 2. elden itibaren kendi eğilimin),
  ardından sıradaki elin "Hazır ol"u. Son elin kapanışı oyunun **son açılışıdır** (6 sn, ardından ortak "Devam et").
- **El puanı:** Her elde en yakın basan **2**, ikinci en yakın **1**, diğerleri 0 el puanı alır; eşit uzaklık aynı derece,
  sonraki derece atlanır; basmayan sıralanmaz ve puan almaz.
- **Tam isabet (KR-M5):** Hedefe **0,05 sn (50 ms) ya da daha yakın** basan, o elde derecesinden bağımsız **+1 ek el puanı**
  alır ("TAM İSABET!"); bir elde birden çok kişi alabilir. Ölçüm dokunma anıyladır; 50 ms dahildir.
- **Genel skor (KR-M3):** 3 elin el puanları toplamına göre, oyun sonunda bir kez: birinci **+2**, sonraki **+1**, diğerleri 0.
  **Toplamı 0 olan ödül almaz.** Eşitlik: toplam eşitse **daha çok elde basan** önde; o da eşitse **bastığı ellerdeki
  ortalama uzaklığı küçük** olan önde; o da eşitse aynı derece. Birincide eşitlikte hepsi +2, sonraki grup +1; **bütün
  katılımcılar** eşit ve toplam > 0 ise herkes +1. Mini oyun puanı toplam el puanıdır. Kartların "birinci/sonuncu" kararı
  toplam el puanına göredir (genel kart kuralı, K6: eşit toplam aynı derece; ikinci ve üçüncü eşitlik bozucuları kartlara
  uygulanmaz).
- **Kopan oyuncu:** Koptuğu elde basmamışsa o elde sıralanmaz; döndüğünde süren elde yine basabilir ya da sonraki elde oynar.
- **Kadran (KR-M4):** Kadranın nabzı düzensizdir (her vuruş arası 0,6–2,2 sn, her telefonda ayrı rastgele; yalnız görsel,
  ses ve titreşim yok); hareket azaltmada hiç yoktur. Sayarken müzik, ortam sesi ve tik yoktur (her ritimli ses metronomdur).
- **Değişmeyenler:** 2–8 oyuncu; hedef 7–13 arası tam saniye ve herkese açık; gerçek sayaç tamamen gizli; elde tek basış;
  basış süresi hedef + 8 sn; herkes basınca 1 sn sonra kapanış; basmayan sıralanmaz ve puan almaz; eşit uzaklıkta aynı
  derece; süre dolmadan kimin bastığının kimseye (izleyici ve TV dahil) gösterilmemesi; bitişten sonra gelen basışın reddi;
  eksi puan yok; sonuç ekranı "Devam et" ile geçer.
- **Anlatım (KR-U15):** 1) "Sayaç görünmez; hedef yazılı (7–13 sn)" 2) "'BAŞLA!' ile içinden say, tek kez bas" 3) "3 el: her
  elde en yakın 2, ikinci 1 puan". İpucu: "Sesli saymak serbest — yanlış sayıp arkadaşlarını şaşırtmak da."
- **İzleyici (KR-U9):** İzleyici puansız deneyebilir ("Sen de dene"); basışı yalnız kendi telefonunda ölçülür, sunucuya gitmez.

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

**Değişiklik (BM öneri paketi, Kasım 2026, sahip onayı: BM-M1, BM-M2, BM-M3) — yukarıdakilerin önüne geçer:**

- **Fitil tutuşuyor (BM-M1):** Bombayı alan **1,5 sn** pas veremez (oyunun ilk taşıyıcısı dahil; sunucu bu sürede gelen
  pası reddeder, bomba onda kalır). Kilit süre değildir: fitil işlemeye devam eder, kilitteyken patlarsa bomba onda patlar.
  Kopan taşıyıcı döndüğünde kilit yeniden başlamaz.
- **Hemen geri pas yok (BM-M1):** Taşıyıcı, bombayı **az önce kendisine atana** geri atamaz. Yasak yalnız bir el sürer
  (sonraki elde o kişi yine seçilebilir). Atan dışında bağlı kimse yoksa (2 oyuncu ya da diğerleri kopuk) geri pas serbesttir.
- **Azalan ek süre ve tavan (BM-M2):** Pasın fitile eklediği süre: **1.–3. pas** rastgele **1–4 sn**, **4.–6. pas** rastgele
  **0,5–2 sn**, **7. pas ve sonrası 0**. Fitil hiçbir durumda oyunun başından **45 sn**'yi geçemez (ek süre buna göre kırpılır).
  Eklenen süre yine yalnız süreyi görenlere gider; 0 eklenince kıvılcım çıkmaz.
- **Tek kurşun (BM-M3):** O9'un el başına "Patlar / Patlamaz" tahmini kalkar. Yerine bombayı taşımayan her katılımcının oyun
  boyunca **tek bir "PATLAR!" bahsi** vardır. Bahis verildiği andaki taşıyıcının **eline** bağlanır: bomba o elde patlarsa
  bahisçi **+1** alır; pas olursa bahis **yanar** (0, eksi yok) ve hak geri gelmez. Bahis yalnız **fitilde en az 3 sn varken**
  kabul edilir; daha geç gelen bahis reddedilir ve **hak yanmaz**. Bahis düğmesi zamana göre açılıp kapanmaz (sınırı yalnız
  zaten süreyi gören bilir). Bombayı taşırken bahis verilemez; hakkını kullanmamış taşıyıcı pas verdikten sonra kullanabilir.
  Bahisler gizlidir: kimin bahis yaptığı patlamaya kadar kimseye açılmaz, taşıyıcı hiç görmez; patlamada tutanların adı herkese
  açılır, yananlarınki açılmaz. Doğru bahis oyun başına en çok +1'dir; taşıyıcı −1 aynen.
- **Patlama anı (BM-U5):** Sunucu patlamayı fitilin bittiği anda işler ve yayınlar (100 ms'lik adımı beklemez). Puan ve pas
  kuralı değişmez.
- **Patlamadan sonra açılan bilgi (BM-U6):** Bombanın yolculuğu (her elin taşıyıcısı ve tuttuğu süre), başlangıç fitili, her
  pasın eklediği süre ve toplam yalnız patlamadan sonra herkese açılır. Patlamadan önce herkese açık olan yalnız taşıyıcı, pas
  sayısı ve pas zinciridir (kimden kime).
- **Anlatım 3. adımı:** "Pas ver, süreyi uzat; patlayan −1. Bir kez 'PATLAR!' de: o elde patlarsa +1".
- **Değişmeyenler:** 2–8 oyuncu; yatay ekran; bombanın rastgele bağlı oyuncuda başlaması; ilk fitil 15–20 sn; taşıyıcının süreyi
  hiç görmemesi; diğer katılımcıların gerçek süreyi görmesi; kendine ve kopuk oyuncuya pas yok; patlama anında gelen pasın
  reddi; patlayan −1, diğerleri 0; izleyici ve TV'de süre ve bahis olmaması; kopuk taşıyıcıda bombanın kalması; patlamadan
  sonraki 2 sn gösteri; oyunun sonuç ekranının "Devam et" ile geçmesi.

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

**Değişiklik (RD öneri paketi, Kasım 2026, sahip onayı: RD-M1…RD-M7, RD-U7, RD-U9) — yukarıdakilerin önüne geçer:**

- **Seçim süresi (RD-M7):** 3–5 oyuncuda **20 sn**, 6–8 oyuncuda **30 sn**. Herkes Tamam derse yine 1 sn sonra biter.
- **Seçim vaadi (RD-M3):** Seçim süresince her oyuncu kendi portresine isterse tek bir hazır vaat asar, değiştirir ya da
  indirir: **"Oy verene jeton"** (bana kendi eliyle oy veren herkese en az 1 jeton) ya da **"Herkese jeton"** (jetonu
  olabildiğince çok kişiye yayarım). Vaatler herkese açıktır; Tamam vaadi kilitlemez, seçim bitince kilitlenir. Başkan
  belli olunca yalnız başkanın vaadi görünür. Vaadin puanı ya da cezası yoktur; açılışta başkanın vaadi **son dağılımla**
  (süre dolunca rastgele tamamlananlar dahil) karşılaştırılır: "Oy verene jeton" başkana kendi eliyle oy veren herkes en az
  1 jeton aldıysa **TUTTU**, "Herkese jeton" jeton alan farklı kişi sayısı en küçük(bütçe, oyuncu − 1) ise **TUTTU**; aksi
  hâlde **BOZDU**. Başkan Bitti demediyse damganın yanında "süre doldu" notu çıkar.
- **Kalabalık eşitlikte ikinci oylama (RD-M4):** **4 ya da daha çok aday** eşit kalırsa önce **12 sn** ikinci oylama yapılır:
  herkes yalnız eşit adaylardan birine oy verir (aday kendine veremez; bağlı adaya; Tamam'a kadar değiştirilebilir). Oy
  vermeyenin oyu **sayılmaz** (rastgele atanmaz). Bağlı herkes Tamam derse 1 sn sonra biter. En çok oyu alan başkan olur;
  yine eşitlik varsa kalan adaylarla taş-kâğıt-makas düellosu yapılır; kimse oy vermezse bütün adaylarla düello. 2–3 aday
  eşitse doğrudan düello (eskisi gibi). Bütçe değişmez (ilk tur oy sayısı). İkinci oylamanın oyları açılışta açılır.
- **"Başkan seçildi" anı (RD-U7):** Başkan belli olunca 1,5 sn "BAŞKAN: ELİF · 3 JETON" anı oynar; **25 sn'lik dağıtım
  süresi bu anın bitiminden sayılır** (süreden yemez).
- **Başkanın defteri (RD-M1):** Dağıtım ve darbe aşamasında **yalnız başkan** kendi ekranında ilk tur oylarından kendisine
  kimin kendi eliyle oy verdiğini ve kimin oyunun rastgele düştüğünü görür. Diğer oyuncular ve izleyici görmez; oylar
  açılışta eskisi gibi herkese açılır.
- **Kopan başkan (RD-M6):** Başkan dağıtım sona erdiğinde bağlı değilse ve Bitti dememişse, kalan jetonlar önce ona
  **kendi eliyle oy verenlere** sırayla birer birer (kişi başı 2 sınırıyla), artarsa diğerlerine rastgele gider. Başkan
  bağlıysa eski kural (tamamen rastgele) aynen geçerlidir.
- **Puan (RD-M2):** Başkan, darbe tutmazsa **+2** alır (eskiden +1); darbe tutarsa başkanın ödülünün **tamamı** silinir
  (0). Aldığın her jeton +1 aynen. Puanlar doğrudan genel skora gider; kimse +2'den fazla almaz, eksi yok. Dağılan toplam
  puan = bütçe + 2 (darbe yoksa).
- **Açılış (RD-U9, RD-M5):** Oyun içi açılış en az **11 sn** sürer ("Devam et" kuralı aynen). Oy vermediği için oyu
  rastgele atananlar ve süre dolduğu (ya da başkan koptuğu) için kendiliğinden giden jetonlar açılışta işaretlenir
  (kesikli ok + zar; gümüş jeton); bu bilgi yalnız açılışta herkese açıktır.
- **En uzun süre:** 30 + 12 + 6 × 10,5 + 1,5 + 25 + 10 + 11 = **152,5 sn**.
- **Değişmeyenler:** 3–8 oyuncu, kendine oy yok, bağlı oyuncuya oy, vermeyenin ilk tur oyu rastgele, bütçe = alınan oy,
  kişi başı en çok 2 jeton ve kendine yok, dağıtım 25 sn ve Bitti, bağlı başkanda dağıtılmayanın rastgele gitmesi,
  taş-kâğıt-makas kuralı (iki işaret / tek-üç işarette tekrar, en çok 6 el, sonra kura), darbe oylaması (yalnız 0
  jetonlular, 10 sn, gizli, tek seferlik, kesin çoğunluk, oylar hiç açılmaz), erken bitişler, eksi puan olmaması.
- **Anlatım:** "Gizli oy ver: en çok oy alan başkan olur" · "Başkan, aldığı oy kadar jeton dağıtır (kişiye en çok 2)" ·
  "Jeton alamayanlar darbe yaparsa başkanın puanı gider".

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

**Değişiklik (AL öneri paketi, Kasım 2026, sahip onayı: AL-M1…M4) — yukarıdakilerin önüne geçer:**

- **Üç tur (AL-M2):** Oyun **3 tur**dur. Her tur aynı aralıkla (0…oyuncu sayısı) oynanır; seçim her turun başında boşalır,
  seçmeyen o turda 0 sayılır. Süreler: seçim **12 sn** (her tur), turlar arasında açılış **5 sn**, son açılış **7 sn**, ardından
  ortak "Devam et". Toplam en çok 3×12 + 2×5 + 7 = **53 sn**. **Erken bitiş tur başına:** bağlı herkes Tamam derse o turun seçimi
  son Tamam'dan 1 sn sonra kapanır, sonraki turlar o kadar öne çekilir. Kopan oyuncu beklenmez; kopukken geçen turlarda 0
  sayılır (koptuğu turda önceden seçtiyse seçimi geçerlidir), döndüğünde süren turdan devam eder.
- **Sisli limit (AL-M4):** Limit herkese tam sayı değil **bant** olarak gösterilir; bant tablodaki değerin çevresindedir:
  3–4 oyuncuda ±1, 5–6 oyuncuda ±2, 7–8 oyuncuda ±3 (3→5–7, 4→10–12, 5→15–19, 6→22–26, 7→30–36, 8→40–46). Her turun
  **gerçek limiti** maç başında sunucu rastgeleliğiyle bandın içinden (uçlar dahil, eşit olasılıkla) ayrı çekilir; hiçbir zaman
  1…N² dışına çıkmaz. Gerçek limit tur açılana kadar kimsenin görünümünde yoktur; açılışta bant 0,6 sn'de gerçek limit
  çizgisine daralır. Taşma kuralı gerçek limite göredir (toplam ≤ limit sığar).
- **Tur puanı:** Taşmayan turda herkes seçtiği sayı kadar **mini puan** alır; taşan turda herkes o turdan 0. Eksi puan yok
  (eski "en yüksek seçen −1" taslağı uygulanmaz). **Mini puan = üç turun toplamı.**
- **Genel skor (AL-M1):** Seçilen sayı artık doğrudan genel skora gitmez. Oyun sonunda bir kez, mini puan toplamına göre ortak
  sıralama kuralı (`rankAwards`, yalnız mini puanı 0'dan büyükler): tek lider **+2**, sonraki puanı paylaşanların hepsi **+1**;
  **lider eşitse liderlerin hepsi +1**, ikinci ödül verilmez. Mini puanı 0 olan ödül almaz; herkes 0 ise kimse almaz.
  Kartların "birinci/sonuncu" kararı mini puan toplamına göredir.
- **Gözcü (AL-M3):** Her turda bir oyuncu **Gözcü**dür. Sıra maç başında sunucu rastgeleliğiyle karıştırılan oyuncu listesinden
  gelir; 3 turda 3 farklı kişi (3 oyuncuda herkes bir kez). Tur başladığında bağlantısı kopuk olan Gözcü seçilmez, sıradaki
  bağlı oyuncuya geçer. Gözcü'nün **kim olduğu herkese açıktır**. Turun **7. saniyesinde** yalnız Gözcü'nün ekranında haznenin o
  anki durumu tek kelimeyle belirir: o ana kadar **gönderilmiş seçimlerin** toplamı (seçmeyen 0) gerçek limitin %70'i ya da
  altıysa **RAHAT**, %70'ten büyük ve limit ya da altıysa **SINIRDA**, limitin üstündeyse **TAŞIYOR**. Kimin ne seçtiği ya da sayı
  gösterilmez. Kelime o anın fotoğrafıdır, tur sonuna kadar kalır ama güncellenmez. 7. saniye gelmeden bağlı herkes kilitlerse
  Gözcü kilit anında bakar. Kelime yalnız Gözcü'nün kişisel görünümündedir; diğer oyuncular, izleyici ve TV yalnız "Gözcü
  baktı" anını görür. Gözcü kelimeyi masaya doğru da söyleyebilir, yalan da.
- **Açılış:** Seçimler aynı anda açılır; jetonlar küçükten büyüğe (eşitlerde katılım sırası) tek tek düşer. "Taşıran" damgası
  yalnız gösteridir (ceza yok): dolum sırasında toplamı limitin üstüne çıkaran ilk şerit, ondan sonrakiler ve o şeritle aynı
  sayıyı seçen herkes.
- **Değişmeyenler:** 3–8 oyuncu; 0…N aralığı; limit tablosu (bandın ortası) ve herkesin aynı bandı görmesi; seçimin gizli olması
  ve tur sonunda aynı anda açılması; seçmeyenin 0 sayılması; taşmada herkesin o turdan 0 alması; eksi puan olmaması; kilit ve
  erken bitiş kuralı (son kilitten 1 sn sonra); kopan oyuncunun beklenmemesi.
- **Anlatım (AL-U16):** 1) "3 tur: gizlice 0 ile 5 arasında bir sayı seç. Seçmezsen 0 sayılır." 2) "Toplam 15–19 arası gizli
  limiti geçmesin: herkes 3 derse 15, sığar. Gözcü hazneye bir kez bakar." 3) "Taşarsa o tur kimse puan almaz; taşmazsa en çok
  koyan kazanır." Sayılar masanın oyuncu sayısından üretilir (örnek her zaman sığan sayıdır: ⌊bant altı ÷ N⌋).

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

**Değişiklik (GK öneri paketi, Kasım 2026, sahip onayı: GK-M1, GK-M2, GK-U5, GK-U6, GK-U7) — yukarıdakilerin önüne geçer:**

- **Hayaletler (GK-M2):** 1. aşamada tek kalamayanlar (çakışan ya da seçmeyen) 2. aşamada **hayalet** olur ve onlar da
  gizlice bir kare seçebilir (isteğe bağlı; seçmeyen hayaletin etkisi yoktur). Bir yarışan **bir hayaletle aynı kareye**
  düşerse "hayalete çarptı" sayılır: **2. aşama +1'ini ve ödülü alamaz** (1. aşama puanı kalır). Hayaletler puan almaz;
  hayaletler arası aynı kare önemsizdir. Hayalet ödül karesinde tek başına dursa da ödül kimseye gitmez; ödül karesinde
  bir yarışanla dursa yarışan ödülü kaybeder. Hayalet seçimleri 2. aşama bitene kadar hiçbir yere gitmez; açılışta
  gösterilir.
- **Rakipsiz durum (GK-M2):** 1. aşamadan tek kişi kaldıysa ve 1. aşama kapandığı anda en az bir **bağlı** hayalet varsa
  2. aşama oynanır (otomatik +1 yok; tek kalırsa +1 ve ödül şansı). Bağlı hayalet yoksa eski rakipsiz kural (+1, oyun
  biter) geçerlidir. Bu karar 1. aşama kapandığı anda verilir; sonradan kopan ya da dönen değiştirmez.
- **Erken bitiş:** 2. aşamada bağlı yarışanların **ve** bağlı hayaletlerin hepsi "Tamam" dediyse 1 sn sonra biter
  ("Tamam" seçim ister; "Pas" yoktur, GK-M5 reddedildi).
- **Pusula (GK-M1):** 2. aşama başlarken (bantla birlikte) her yarışan **yalnız kendine** görünen, ödül karesi hakkında
  **her zaman doğru** bir ipucu alır: "X. satırda değil", "Y sütununda değil", "köşede" / "köşede değil"; 4×4'te ayrıca
  "kenarda" / "içeride" (iç 4 kare) ve "üst / alt / sol / sağ yarıda". Her ipucu karelerin en az dörtte birini eler ve en
  az 3 kareye izin verir (3×3'te "kenarda/içeride" ve yarılar verilmez). İpuçları sunucuda tohumlu dağıtılır, mümkün
  olduğunca farklıdır (yetmezse tekrar eder). Hayaletlere, izleyiciye ve TV'ye ipucu gitmez; rakipsiz bitişte ipucu
  yoktur. 2. aşamanın açılışında herkesin pusulası herkese açılır.
- **Süreler (GK-U5, GK-U6, GK-U7):** 1. aşama sonrası ara 4 → **6 sn** (5 sn açılış + 1 sn "2. AŞAMA" bandı); 2. aşamanın
  20 sn'si bandın bitişiyle başlar. Son açılış (en az gösterim) 5 → **8 sn** (kareler, ödül karesi anı, pusulalar, özet).
- **Değişmeyenler:** 2–8 oyuncu; 3×3 / 4×4 kuralı; tek kare; 20 sn'lik iki aşama; seçimlerin aşama bitene kadar gizli
  olması; aynı karede çakışanların elenmesi; tek kalana her aşamada +1; ödül karesinin tohumlu, gizli ve yalnız
  2. aşamada olması, tek başına bulana +2, çakışmada kimseye; genel skora doğrudan aktarım; eksi puan yok. Reddedilenler:
  daralan alan (GK-M3), açık bayrak (GK-M4), "Pas" (GK-M5), +2/+1/0 sıralama (GK-M6), rakipsiz şans atışı (GK-M7).
- **Anlatım:** amaç "Kimseyle çakışmayan karede tek başına kal!" · "Gizlice bir kare seç (bu oyunda 3×3 / 4×4). Seçmezsen
  pasif kalırsın." · "Aynı kareyi seçenler elenir; tek kalanlar +1 alır ve 2. aşamaya geçer. Elenenler hayalet olur." ·
  "2. aşamada tek kalan yine +1; gizli ödül karesi +2. Pusulan ödül karesini gösterir."

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

**Değişiklik (KD, Kasım 2026, sahip onayı; `docs/oneriler/karalama-defteri.md`, `KARARLAR-15-OYUN.md`) — yukarıdaki
cevapların önüne geçer:**

- **Puan (KD-M2):** Bilgisize **oy veren her oyuncu +1** (bilgisiz yakalansa da yakalanmasa da). Bilgisiz **tek başına
  en çok oyu almadıysa** (eşitlik ya da hiç oy) kurtulur ve **+1** alır. Yanlış oy ve oy vermemek 0; eksi yok. Puanlar
  doğrudan genel skora gider; bir oyuncu en çok +1, bilgisiz en çok +2 alır. "Yakalandı / Kurtuldu" tanımı aynıdır.
  Maç kartlarında "birinci" bu oyunda en çok puan alan(lar), "sonuncu" 0 alanlardır.
- **Son şans (KD-M1):** Oylama bitince açılış başlar (oylar uçar, bilgisiz ve onun kelimesi açılır, damga; 5 sn), sonra
  bilgisiz **12 sn** içinde **ana kelimeyi yazarak** tahmin eder; yakalansa da kurtulsa da. Doğruysa **+1**. Tek tahmin,
  Gönder kesindir; gönderince 1 sn sonra kelimeler açılır. Eşleşme klavyeden bağımsızdır; ana kelime 6+ harfliyse harf
  sayısı aynı ve tek harf farklı yazım da doğru sayılır (Yazı Yaz YY-M7 ile aynı). Bilgisizin kendi kelimesi hiçbir
  zaman doğru sayılmaz. Son şans sırasında bilgisiz bütün çizimleri görür; ipucu ve harf sayısı verilmez. Açılış ve son
  şans boyunca **ana kelime hiçbir ekranda yoktur** (çoğunluğun telefonunda da); son şans bitince açılır. Bilgisiz
  oylama bittiğinde bağlı değilse son şans hiç açılmaz, son şans sürerken koparsa 1 sn sonra biter (tahmin 0); oyun
  beklemez. Diğerleri "… kelimeyi tahmin ediyor" ve geri sayım görür; bilgisizin yazarken yazdıkları gösterilmez.
- **Kopan oyuncu (KD-M3):** Oylamada bağlantısı kopuk oyuncunun çizimine de oy verilebilir (kartında "bağlantı koptu");
  kopuk oyuncu oy veremez ve beklenmez.
- **Çift yönü (KD-M4):** Havuz alanları "Kelime 1 / Kelime 2" adını alır. Çift çekilince yön **%50** ihtimalle döner:
  bazen Kelime 1 çoğunluğun, bazen bilgisizin. Havuzda "Yön: sabit" işaretli çiftte Kelime 1 hep çoğunluğundur.
- **Tekrar (KD-M5):** Aynı odada son **50** oyunda çıkan çift tekrar gelmez; ayrıca son **10** oyunda çıkmış çiftlerin
  kelimelerinden birini içeren çift de gelmez (ör. ördek/kaz'dan sonra kuğu/ördek). Süzgeç yerleşik havuza da uygulanır;
  kelime kuralı havuzu alt sınırın (10) altına düşürürse yalnız çift kuralı uygulanır. Hafıza yalnız bellektedir.
- **Yakınlık (KD-M6):** Her çift **çok yakın / yakın / uzak** etiketi taşır (etiketsiz = yakın). 3–5 oyuncuda yalnız
  yakın, 6–8 oyuncuda %50 yakın / %50 çok yakın çift çekilir; **uzak** çift hiç çekilmez. Uygun etiketli çift kalmazsa
  etiket şartı düşer.
- **Oylama süresi (KD-M7; sahip notu: süreler daha uzun, erken bitiş ön tercih):** 3–4 oyuncuda **30 sn**, 5–6
  oyuncuda **40 sn**, 7–8 oyuncuda **50 sn**. Bağlı herkes **oyunu verince** oylama en geç **3 sn** sonra biter (arada oy
  değiştirilebilir); bağlı herkes Tamam derse 1 sn sonra. En uzun oyun 75 + 50 + 5 + 12 + 3 = 145 sn.
- **Çift karnesi (KD-M8):** Oyun bitince çift için yalnız iki sayı havuz istatistiğine yazılır: bilgisiz yakalandı mı,
  ana kelimeyi bildi mi. Çizim, ad, oda saklanmaz. Panelde çift başına "kaç oyun · yakalanma % · tahmin %"; en az 8
  oyundan sonra yakalanma ≥ %85 → "uzak önerisi", ≤ %15 → "çok yakın önerisi" (sahip onayına gider, kendiliğinden
  uygulanmaz).
- **Yazı yasağı (KD-U14):** Çizime harf ve yazı yazılmaz. Sistem denetlemez; anlatımda ve çizimin ilk 3 sn'sinde tuvalde
  "Yazı yok, yalnız çizim" notu durur. Kural ihlali puanı değiştirmez.
- **Ekran (KD-U1…U10, U12, U13):** Kelime çizim başında tam ekran ters defter kartında, **basılı tutunca** görünür
  (iki rolde kart aynı; bilgisizde "yakın sinyal" yalnız kart açıkken); sonra "Kelimeni gör" çubuğu. Tuvalde kalan
  saniye ve mürekkep çubuğu. "Bitti" deyince çizim sergiye asılır, diğerlerinin çerçeveleri örtülü bekler. Oylamada
  kendi çizimin duvarda değil, başlığın yanında küçük; isimler hep görünür; örtüler soldan sağa 0,3 sn arayla kalkar,
  Tamam ilk 3 sn pasif; büyütmede kaydırarak gezilir ve "BU KİŞİ" ile oy verilir. Açılışta oylar ışık izleriyle
  çizimlere uçar, bilgisizin çiziminde maske düşer, "Onun: armut", YAKALANDI / KURTULDU damgası; son şanstan sonra kart
  döner ve puan şeridi ("Doğru oy: … +1 · … kurtuldu +1 · … kelimeyi bildi +1"). TV aynı açılışı tam ekran gösterir;
  kelimeleri, bilgisizi ve çizimleri oylamadan önce göstermez.
- Değişmeyenler: 3–8 oyuncu, rastgele tek bilgisiz, bilgisizin yakın kelimeyi ve "yakın sinyal"i görmesi (bilgisiz
  bilgisiz olduğunu bilir; KD-M9 onaylanmadı), 75 sn çizim, 6 renk + silgi + 3 kalınlık, süre bitene kadar düzenleme,
  çizimlerin oylamada aynı anda açılması, kişi başı tek oy, kendine oy yok, eksik oyların kura ile doldurulmaması,
  eşitlikte bilgisizin kurtulması, eksi puan yok, puanların doğrudan genel skora gitmesi, "Bitti" erken bitişi. İzleyici
  tahmini (KD-U11), rol ipucu satırı (KD-U15) ve KD-U16 erişilebilirlik paketi onaylanmadı; yapay zekâ özellikleri
  (KD-AI1–AI3) yok.

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

**Değişiklik (IT öneri paketi, Kasım 2026, sahip onayı: IT-M1…IT-M5, IT-U5, IT-U6, IT-U8) — yukarıdakilerin önüne geçer:**

- **Puan (IT-M1):** Alınan oy oyun içi puandır. Genel skora **en çok oy alan(lar) +2, sonraki farklı oy sayısı +1,
  diğerleri 0** gider. Birincide eşitlik varsa hepsi +2. **Herkesin oyu eşitse herkes +1.** 0 oy alan hiçbir zaman ödül
  almaz. Örnekler: 3 kişi 2-1-0 → +2/+1/0; 1-1-1 → herkes +1; 8 kişi 3-2-1-1-1-0-0-0 → +2/+1/0…; 5 kişi 2-2-1-0-0 →
  +2/+2/+1/0/0. Maç kartlarında "birinci" en çok oy alanlar, "sonuncu" en az oy alanlardır (genel hesap). Eksi yok.
- **Kopan oyuncu (IT-M2):** Oyun başında katılımcı olan herkes, bağlantısı kopmuş olsa da oylanabilir. Kopan oyuncu oy
  veremez; oyu süre dolunca rastgele atanır. Erken bitişlerde kopan oyuncu beklenmez (eskisi gibi).
- **Rastgele oy görünür (IT-M3):** Oy vermediği için sunucuca atanan oy açılışta 🎲 ve kesikli okla gösterilir; söz
  denetimi bu oyu yine sayar (O4), ama bu oyuncuya "Hain" etiketi verilmez ("Oy vermedi" yazılır). Hangi oyların zarla
  atandığı yalnız açılışta herkese açıktır.
- **Pazarlık süresi (IT-M4):** 3–4 oyuncuda **45 sn**, 5–6 oyuncuda **60 sn**, 7–8 oyuncuda **75 sn**. Oylama 15 sn
  kalır. "Oylamaya geç" erken çıkışı aynen (bağlı herkes derse 1 sn sonra).
- **Söz sınırı (IT-M5):** En çok söz işareti **3–4 oyuncuda 1, 5–8 oyuncuda 2**. Sınır doluysa yeni söz reddedilir; önce
  mevcut söz kaldırılır.
- **Geçiş bandı (IT-U8):** Pazarlık bitince 1 sn "PAZARLIK BİTTİ · OYLAR GİZLİ" bandı oynar; **15 sn'lik oylama bandın
  ardından** sayılır.
- **Açılış (IT-U5, IT-U6):** Oylar tek tek okunur (önce en az oy alanlara gidenler, en son liderlere gidenler); en az
  gösterim **3 + 0,9 × oyuncu sayısı sn** (3 kişide 5,7, 8 kişide 10,2 sn), sonra "Devam et" (en çok 60 sn). Her kartta
  söz denetimi: söz verdiği kişiye oy veren için "SÖZ TUTULDU ✓", söz verip başkasına oy veren için "İHANET!" ve ihanete
  uğrayanın kısa şaşkın tepkisi (madde 13), zarla atanan oyda "zar attı". Son tabloda karşılıklı oy veren ikililer
  **İTTİFAK** olarak gösterilir (zarla atanan oy sayılmaz) ve söz verenlere tek etiket verilir: **Sözünün eri**
  (verdiği bütün sözleri tuttu), **Çifte oyun** (iki söz verdi, birini tuttu), **Hain** (söz verdiği kimseye oy
  vermedi), oy vermeyende **Oy vermedi**. Etiketler ve ittifaklar puansızdır.
- **En uzun süre:** 75 + 1 + 15 + 10,2 = **101,2 sn** (8 oyuncu).
- **Değişmeyenler:** 3–8 oyuncu; uygulamada teklif/anlaşma nesnesi olmaması; sözlerin yalnız sözü verene görünmesi
  (alıcı dahil, sayısı bile) ve sonuçta açılması; sözün puansız ve bağlamaz olması; tek gizli oy, kendine oy yok; oylama
  15 sn ve Tamam; vermeyenin oyunun rastgele atanması; erken bitişler; eksi puan olmaması; oylar açılana kadar kimsenin
  sayı görmemesi. Madde 13'teki süs neon bağlar ve konuşma balonları kaldırıldı (IT-U1): pazarlıkta yalnız gerçek bilgi
  (kendi sözlerin, hazır olanlar) çizilir.
- **Anlatım:** amaç "En çok oyu topla: birinci +2, ikinci +1!"; 1. adımdaki "60 saniye" ifadesi "Süre boyunca" oldu
  (sayaç gerçek süreyi gösterir).

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
3. Ürün havuzu, ürün fiyatları ve ürün sayısı nasıl belirlenir?: [20 ürünlük
   havuz. Her maçta bunlardan **12'si** rafa gelir (sunucu rastgeleliğiyle; aynı
   tohum aynı rafı verir) ve fiyatları maç başına **taban fiyatın ±%30'u** içinde
   oynar: her zaman tam sayı, **6–40** arası. Raf herkes için aynıdır (ürünler,
   fiyatlar ve sıra). **Ürün sayısı sınırı yoktur:** tek sınır bütçedir (60
   kredi) ve her üründen bir tane alınır; parası yettiği kadar ürün alınabilir.]

   | No | Ürün | Taban fiyat | Maçtaki aralık |
   |---:|---|---:|---|
   | 0 | Hologram Sticker | 8 | 6–10 |
   | 1 | Enerji İçeceği | 10 | 7–13 |
   | 2 | Neon Rozet | 12 | 9–15 |
   | 3 | Retro Kartuş | 15 | 11–19 |
   | 4 | Mini Hoparlör | 18 | 13–23 |
   | 5 | Arcade Eldiveni | 20 | 14–26 |
   | 6 | Piksel Kamera | 22 | 16–28 |
   | 7 | Jet Çanta | 24 | 17–31 |
   | 8 | Kristal Kulaklık | 26 | 19–33 |
   | 9 | Holo Kask | 28 | 20–36 |
   | 10 | Mini Drone | 32 | 23–40 |
   | 11 | Gizli Sandık | 36 | 26–40 |
   | 12 | Lazer Kalem | 11 | 8–14 |
   | 13 | Ses Kartı | 13 | 10–16 |
   | 14 | Retro Joystick | 17 | 12–22 |
   | 15 | Plazma Lamba | 19 | 14–24 |
   | 16 | Mini Robot | 23 | 17–29 |
   | 17 | Hologram Saat | 25 | 18–32 |
   | 18 | Neon Kaykay | 30 | 21–39 |
   | 19 | VR Gözlük | 34 | 24–40 |
4. Her oyuncu kaç ürün seçebilir; aynı üründen birden fazla alınabilir mi?: [bütcesi dahilinde istediği kadar ürün alabilir bir üründen sadece bir kez alabilir; yalnız raftaki ürünler alınabilir; ürün sayısı sınırı yoktur]
5. Alışverişler gizli mi; ürün seçimleri ne zaman açılır?: [gizli , tur sonunda. İstisna: 15. saniyedeki vitrin fısıltısı (madde 15) yalnız ürün başına talep seviyesini açar]
6. Ürün değeri alıcı sayısına göre tam olarak nasıl hesaplanır?: [bir ürünü kaç kişi seçtiyse değeri o seçilen sayıya bölünür örnek : 30 tl ye bir ürün var 2 kişi bu ürünü seçmiş değeri artık 15 oldu. Bölünen her zaman bu maçtaki **tam** fiyattır; kupon değeri değiştirmez]
7. Aşamalar ve süreler: [tek aşama - 30 saniye; 15. saniyede vitrin fısıltısı; ardından 8 sn sonuç açılışı]
8. Bütçe aşma veya sepet göndermeme sonucu: [bütçe aşılamaz. Ayrı bir "sepet gönderme" adımı yoktur: sepet canlı olarak sunucuda tutulur ve süre bittiğinde (ya da herkes Tamam dediğinde) sunucudaki son sepet geçerlidir. Hiç ürün almayan oyuncunun sepet değeri 0 kabul edilir]
9. Mini oyun puanı ve en değerli sepet eşitliği: [en değerli sepet **+2**, ikinci en değerli sepet **+1**, diğerleri 0; **eksi puan yoktur**. Birincide eşitlik varsa eşit olanların hepsi +2 alır ve sonraki farklı değer +1 alır; ikincide eşitlik varsa hepsi +1. Değeri 0 olan (boş sepet) ödül almaz. Herkesin sepet değeri aynıysa kimse puan almaz]
10. Genel skora aktarım ve final bonusu: [direkt genel puana eklenir]
11. Turun bitiş koşulu: [sürenin dolması]
12. Tutorialda gösterilecek üç adım:
    1. Raf ve fiyatlar her maç değişir; gizli kuponunla bir ürün yarı fiyat.
    2. Bir ürünü kaç kişi aldıysa değeri o sayıya bölünür; 15. saniyede vitrin fısıldar.
    3. En değerli sepet +2, ikinci +1 alır.
13. Neon market, ürün kartları, kasa ve sepet animasyonları: Telefon ekranında
    gerçek bir mağaza rafı: renkli ürünler, büyük görseller, her sıranın altında
    neon raf tahtası, iple asılı fiyat etiketi. Yalnız bütçenin yetmediği ürün
    soluktur. Dokunulan ürünün küçük kopyası üstteki sepet şeridine uçar, bütçe
    sayısı dönerek değişir. Son 10 saniyede süre şeridi kızarır, son 3 saniyede
    "Kasa kapanıyor!" yazısıyla kepenk biraz iner (raf kullanılabilir kalır).
    Tamam diyenin ekranında paketlenmiş poşet görünür. Tur bitince sonuç sahne
    sahne açılır: kepenk kalkar → ürün ürün alıcıların avatarları, bölünen fiyat
    ya da "TEK BAŞINA!" → sepetler en değersizden en değerliye → puanlar üstteki
    puan yazısına uçar; herkesin kuponu satırında görünür.
14. Özel durumlar: Sepet bütçe aşımına izin vermez; son geçerli sepet sunucuda
    tutulur ve süre bittiğindeki hâli geçerlidir (Tamam demek şart değildir).
    Hiç ürün almayan oyuncunun sepet değeri 0 kabul edilir ve ödül almaz. Ürün değerleri tam olmayan sayılarda iki ondalık
    basamakla gösterilir ancak sıralama yuvarlanmamış sunucu değeriyle yapılır.
15. Vitrin fısıltısı: Alışverişin **15. saniyesinde** raftaki her ürünün üstünde
    talep ateşi belirir. Seviye, o ürünü o anda sepetinde tutan oyuncuların
    oranıdır (bütün katılımcılar içinde; kendi seçimin dahil): kimse yoksa ateş
    yok, **≤%25** bir alev, **≤%50** iki alev, **>%50** üç alev. Ateş 15.
    saniyedeki sepetlere göre bir kez hesaplanır ve **donar** (sonraki
    değişikliklerle güncellenmez; tam 15. saniyede gelen eylem sayılmaz). Herkes
    (izleyici ve TV dahil) yalnız seviyeyi görür; kimin aldığı ve tam sayı asla
    gösterilmez. Herkes 15. saniyeden önce Tamam derse ateş gösterilmez.
16. Gizli kupon: Alışveriş başında her oyuncuya raftaki bir üründe **%50
    indirim** kuponu verilir; iki oyuncuya aynı ürün düşmez. Kupon yalnız
    **ödenen fiyatı** düşürür: indirimli fiyat **tam sayıya yukarı yuvarlanır**
    (15 → 8, 27 → 14) ve bütçe kontrolü bu fiyatla yapılır. Ürünün **değeri**
    yine tam fiyat ÷ alıcı sayısıdır. Kuponu kullanmak zorunlu değildir. Kupon
    yalnız sahibinin ekranında görünür; sonuçta herkesin kuponu açılır.
17. Maç kartlarıyla etkileşim (K5–K7): Mini oyun puanı ham puanla aynıdır
    (+2 / +1 / 0); "birinci" +2 alanlar, "sonuncu" 0 alanlardır (en az bir kişi
    ödül aldıysa). Herkes 0 aldıysa herkes birincidir, kimse sonuncu değildir.
    Örnekler: Çift Puan +2'yi +4, +1'i +2 yapar; Altın Dokunuş +2'yi +6 yapar;
    Kendine Güven birinciye +2 (toplam +4), ikinciye ve diğerlerine −1; Sigorta
    0 alana +1 (ikinci sonuncu sayılmaz); Ters Köşe sıralamayı tersine çevirir
    (0 alanlar +2 ve +1'in toplamını paylaşır); Lanet artı puanı 0'a çeker;
    Vergi/Hırsız 1 puan geçirir; Çelme ve kötü kartlar puanı eksiye
    düşürebilir, Kalkan bunu 0'a çeker. Oyunun kendisi eksi puan vermez. Maç
    listesi kartları (K7) bu oyundan etkilenmez.

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
4. Tıklamalar anlık görünür mü, toplam sayı gizli mi?: [gizli; oyun sırasında toplam ve sayılar hiçbir ekranda
   (kişisel, ortak, izleyici) gösterilmez, toplam yalnız sonuç ekranında açılır]
5. Aşamalar ve süreler: [görünür süre yok; enerji barı 100 olana kadar devam eder. 100 olunca oyunculara
   gözükmeyecek bir 3 saniyelik tehlike penceresi başlar (amaç: yanlışlıkla birisi barı patlatabilir). Tur, 100'ü
   aşan ilk tıkta bitmez; pencere sonuna kadar sürer, 3 saniye dolunca tur biter. Bar dolduysa pencere her zaman
   tam 3 saniye sürer. Teknik üst sınır: oyunun başından 90 sn; yalnız bar dolmadıysa uygulanır (bar 89,5. sn'de
   dolarsa pencere 92,5. sn'de biter ve 90. sn'deki tık "sonra" sayılır).]
6. Kapasiteyi aşan tıklamada ne olur?: [tur bitmez; bar 100'ü geçtikten sonra (pencerede) basan herkes patlar.
   Her oyuncunun 100'den önceki ve sonraki tık sayıları ayrı tutulur. Toplu mesajda 100'e kadar olan kısım
   "önce", aşan kısım "sonra" sayılır.]
7. Patlayan oyuncunun mini oyun puanı: [100'den sonra en çok basan tek kişi -2, diğer patlayanlar -1. Yalnız bir
   kişi patladıysa -1. 100'den sonra en çok basanlar eşitse hepsi -1 (kimse -2 almaz).]
8. Patlamayan oyuncuların sıralama ve puanlama kuralı: [yalnız patlamayanlar, 100'ü geçmeden (bar dolana kadar)
   yaptıkları tıklamalara göre sıralanır: tek lider +2, ikinci (en yüksek ikinci değer) +1, diğerleri 0. Hiç
   tıklamayan ödül almaz. Patlayanlar sıralamaya girmez; 100'den önce ne kadar basmış olursa olsun yalnız
   cezasını alır.]
9. Aynı tıklama sayısında eşitlik: [liderler eşitse hepsi +1 alır, +2 ve ikinci sıra verilmez; ikinci sırada
   eşitlik varsa eşitlerin hepsi +1]
10. Bar hiç taşmadan süre biterse ne olur?: [kimse 100'ü geçmezse eksi puan yoktur; pencere dolunca tur normal
    kapanır ve sıralama ödülü verilir. Bar hiç dolmadan 90 sn teknik sınır dolarsa da sıralama aynı şekilde
    verilir.]
11. Genel skora aktarım: [direkt genel puana eklenir]
12. Tutorialda gösterilecek üç adım:
    1. Ortak enerji barını gizlice tıklayarak doldur.
    2. Bar 100'e ulaştıktan sonra görünmeyen 3 saniyelik tehlike başlar.
    3. 100'ü aşınca basan herkes patlar (en çok basan -2, diğerleri -1); kalanlarda en çok tıklayan +2, ikinci +1.
13. Bar, uyarı, titreşim, kıvılcım ve patlama animasyonları: Ortak bar büyük bir reaktör çekirdeği olarak
    görünür; dokunuşta çekirdek içe çöküp geri esner, halkalar dokunulan yönden dalgalanır ve dokunulan yerden
    çekirdeğe ışık parçacıkları akar. Oyuncunun kendi hızına göre yükselen bir vınlama sesi ve titreşim vardır
    (barı yansıtmaz). Arka plandaki reaktör tüpü zamana bağlı canlanır (doluluğu göstermez). Toplam tıklama sayısı
    gizli kalır. 100'e ulaşınca ekranın kenarı kırmızıya döner fakat görünür sayaç başlamaz. Tur bitince patlama
    varsa beyaz flaş, çekirdeğin parçalanması, şok dalgası ve sarsıntı oynar; sonuçlar sırayla açılır (önce
    toplam, sonra oyuncular, patlayanlar en son "PATLATTI" damgasıyla).
14. Özel durumlar: 100'e ulaşan tıklama turu bitirmez; yalnızca gizli 3 saniye penceresini başlatır. Pencerede
    basan herkes patlar; tur pencere sonunda biter. Patlayanlar sıralamaya girmez. Patlamayanlar içinde tıklama
    liderleri eşitse liderlerin tamamı +1 alır ve +2 verilmez; ikinci sıra yalnızca tek lider olduğunda +1 alır.
    Herkes patlarsa sıralama ödülü verilmez.

**Değişiklik (Ekim 2026, sahip onayı) — yukarıdaki cevaplara işlendi:**

- Tur ilk aşan tıkta bitmez; pencere sonuna kadar sürer ve pencerede basan herkes patlar (eskiden yalnız aşan ilk
  tık patlatır ve tur o anda biterdi).
- Patlama cezası: 100'den sonra en çok basan tek kişi -2, diğer patlayanlar -1 (eşitlikte hepsi -1; tek patlayan -1).
- O7'deki "patlamayanlar arasında en az tıklayana -1" cezası tamamen kaldırıldı: kimse patlamazsa hiç eksi puan yok.
- Bar dolduysa tehlike penceresi her zaman tam 3 saniye sürer; 90 sn teknik sınır yalnız bar dolmadıysa uygulanır.
- Tek turlu oyundur ve mini→genel dönüşümü değişmez: puanlar doğrudan genel skora eklenir.

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
   - **Kontrol hakkı (sahip kararı, ZK-M2 değiştirilmiş):** her oyuncunun **1 kontrol hakkı** vardır. Süre
     içinde istediği an, kendisi dışındaki bir oyuncunun **o anki** kadehini seçip gizlice kontrol eder; sonuç
     (zehirli/temiz) yalnız kendisine görünür ve oyun boyunca hatırlanır. Bilgi **kadeh numarasına** bağlıdır:
     kadeh sonra takasla yer değiştirse de "bu kadeh temiz/zehirli" bilgisi doğru kalır ve kadehi izler. Kendi
     kadehini kontrol edemez. Kontrol edilen oyuncunun bağlı olması gerekmez. Kimin kimi kontrol ettiği ve kontrol
     hakkının kullanılıp kullanılmadığı hiçbir ortak görünümde, izleyicide, TV'de ya da başka oyuncuda yoktur;
     sonuçta da açılmaz. Kontrol süreyi uzatmaz, takas hakkını harcamaz; süre bitince yapılan kontrol reddedilir
     (takastaki geç gelen eylem payı burada da geçerlidir). Kendi kadehini bilmek yoktur.
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
    1. Bir arkadaşının kadehini gizlice kontrol et (1 hak).
    2. İstersen biriyle tek takas hakkını kullan; her takas süreyi uzatır.
    3. Süre bittiğinde temiz kadeh +1, zehirli kadeh 0 alır.
14. Kadeh, zehir, takas, ışık ve patlama animasyonları: Ekranın ortasında uzun
    bir ziyafet masası vardır; kadehler masanın üstünde büyük, her kadehin
    arkasında sahibinin avatarı ve adı durur. Süre, ekranın üstünde eriyen bir
    mumdur; her takasta mum biraz uzar ve alev parlar, son 5 saniyede mum
    titrer, masa kararır, kalp atışı duyulur. Kadehin içindeki zehirli durum
    hiçbir oyuncuya görsel ipucu vermez. Takasta iki kadeh masanın üstünden yay
    çizerek yer değiştirir, üstte 2 sn "Ad ⇄ Ad" şeridi çıkar ve masanın altındaki
    takas geçmişine ok olarak eklenir. Kontrolde seçilen kadeh yalnız kontrol
    edene gizlice açılır ve üstünde ona özel küçük rozet kalır. Sonuçta önce
    "Şerefe!" ile kadehler tokuşur, sonra rastgele sırayla tek tek açılır
    (temiz: altın parıltı, +1; zehirli: avatar yeşile döner, mor duman, 0);
    oyuncunun kendi kadehi en son açılır.
15. Özel durumlar: Takas anında sunucu tarafından tek işlem olarak uygulanır;
    aynı anda gelen iki takasta sunucu sırası geçerlidir. Her oyuncu en fazla
    bir kez takas yapabilir ve takas zorunlu değildir. Başlangıç süresi 20
    saniyedir; toplam süre takaslarla uzar ve süre bitince sonuç hemen açılır.
    Herkes takas hakkını kullandıysa takas süresi son takastan 1 sn sonra
    biter; kullanılmamış kontrol hakları bu erken bitişi engellemez. Süre
    bitince (erken bitişte de) oyun hemen bitmez: sabit süreli (8,5 sn)
    "Şerefe!" açılış evresi başlar, sonuç bu evrenin başında açılır, evrede
    takas ve kontrol reddedilir; oyun evrenin sonunda biter ve ardından genel
    sonuç ekranı gelir. Kontrol hakkı
    her oyuncuda en fazla bir kezdir ve zorunlu değildir.

## 23. Çapraz Ateş — `capraz-ates`

**Durum: KİLİTLİ** (2026-10-30 güncellemesi: siper ve iki tur, `docs/UI-GELISTIRME.md` Çapraz Ateş kararları)

**Eski kaynak özeti:** Her oyuncu gizlice başka bir oyuncuyu hedefler. Eski
puanlamada hedefine ateş edip kimse tarafından hedeflenmeyen oyuncu +1 alır;
hedeflenen ama karşılıklı ateş olmayan oyuncu -1 alır; iki oyuncu karşılıklı
hedefleşirse mermiler çarpışır ve iki taraf 0 alır. Eski faz 20 saniyedir.

**Yeni sürüm cevapları:**

1. Minimum oyuncu / maksimum oyuncu: [3-8]
2. Oyuncu kendisini hedefleyebilir mi?: [hayır]
3. Her oyuncu kaç hedef seçer; hedef değiştirilebilir mi?: [her turda ya 1 hedef ya da "Siper al"; süre bitene
   ya da "Ateşe hazır" (kilit) denene kadar değiştirilebilir, son seçim geçerli. Hedef ile siper birbirinin yerine
   geçer: siper alınca hedef silinir, hedef seçilince siperden çıkılır]
4. Hedef seçimleri gizli mi, ne zaman açılır?: [gizli; hedef de siper de yalnız sahibine görünür, tur süresi
   dolunca o turun hedefleri ve siperleri birden açılır. Tur 1'in hedefleri ve siperleri tur 2 boyunca herkese
   açık kalır (artık gizli değildir)]
5. Aşamalar ve süreler: [iki tur. Tur 1: 20 saniye seçim + 5 saniye kısa açılış (kim kimi vurdu, kim siperdeydi,
   tur puanı). Tur 2: 20 saniye seçim + 8 saniye final açılışı. Toplam en çok 53 saniye. Her turda bağlı bütün
   oyuncular "Ateşe hazır" derse o turun seçimi son kilitten 1 saniye sonra biter; sonraki süreler buna göre öne
   kayar (kısa açılış yine 5 sn, final açılışı yine 8 sn). Tur 2'de herkes seçimine sıfırdan başlar (hedef, siper
   ve kilit tur 1'den taşınmaz); kısa açılış sırasında seçim yapılamaz]
6. Hedefine ateş edip kimse tarafından hedeflenmeyen oyuncunun puanı: [+1 (hedefi siperde olsa da: siperdekine
   ateş eden "ateş etti" sayılır)]
7. Hedeflenen oyuncunun puanı/cezası: [-1; siperdeyse 0]
8. Karşılıklı hedefleşme sonucu: [0 puan. Siperdeki oyuncunun hedefi yoktur, bu yüzden siperdeki biriyle
   karşılıklı çift oluşmaz]
9. Bir oyuncuyu birden fazla kişi hedeflerse ne olur?: [sadece -1 alır; siperdeyse 0]
10. Boş veya geç hedef seçiminde ne olur?: [boşa sıkmış olur (hedef de siper de seçmeyen: kendi saldırısından
    puan almaz, hedeflenirse -1)]
11. Genel skora aktarım ve beraberlik: [beraberlik diye birşey yok herkes puan alabilir , puanlar direkt genel puana eklenir.
    Oyunun puanı iki turun toplamıdır (-2 ile +2 arası); eksi puan korunur]
12. Turun bitiş koşulu: [her turda sürenin bitmesi ya da bağlı herkesin "Ateşe hazır" demesi (+1 sn); oyun final
    açılışının sonunda biter]
13. Tutorialda gösterilecek üç adım:
    1. İki tur: birini hedefle ya da siper al, süre bitene kadar değiştirebilirsin.
    2. Tur 1'in hedefleri açılır; tur 2'de kim kimi vurdu bilinir.
    3. Seçilen −1, seçilmeyen atıcı +1; karşılıklı ateşte ve siperde 0.
14. Lazer nişangâhı, mermi, çarpışma ve karakter tepkileri: Seçimde portreye
    dokununca nişangâh kayarak kilitlenir; altta kendi avatarından hedefe ince
    lazer çizgisi uzanır (yalnız kendi ekranında). Siper alınca ekranın altı
    kalkanla örtülür. Her turun son 5 saniyesi düello anıdır (karartma, ıslık,
    "3 · 2 · 1 · ATEŞ!"). Final açılışında halka tam ekran büyür, 1 sn sessizlik,
    namlular aynı anda ateş alır, mermiler ağır çekimde (~2 sn) hedefe gider:
    vurulan sarsılır ("−1"), karşılıklı mermiler ortada çarpışır ("ÇARPIŞTI · 0"),
    siperdekine giden mermi kalkandan seker ("Siperde · 0"), vurulmayan atıcı
    parlar ("SAĞ KALDI · +1"); ardından "Seni vuranlar: …", "En çok hedeflenen:
    … (N kişi)" ve iki turun toplamı gösterilir. Bu sahneler kuralı değiştirmez.
15. Özel durumlar: Oyuncu hedef göndermese de başkalarının hedefi olabilir ve
    hedeflenirse -1 alır. Bir oyuncu birden fazla kişi tarafından hedeflenirse
    yalnızca bir kez -1 alır. Karşılıklı hedefleşme iki taraf için 0 kuralını
    geçersiz kılar; boşa sıkmış oyuncu kendi saldırısından puan alamaz ancak
    başka biri tarafından hedeflenmişse hedeflenme kuralı uygulanır. Siperdeki
    oyuncu ne ceza ne ödül alır (her durumda 0). Tam döngüde (A→B→C→A gibi)
    özel kural yoktur: herkes hedeflendiği için herkes -1 alır.
16. Bir turun puan tablosu (her oyuncu için yukarıdan aşağı ilk uyan satır):

    | Durum | Tur puanı |
    |---|---|
    | Siperde (hedeflenmiş ya da hedeflenmemiş) | 0 |
    | Karşılıklı çiftte (A→B ve B→A; ikisi de siperde değil) | 0 |
    | En az bir kişi seni hedefledi (karşılıklı değil, siperde değil) | -1 |
    | Kimse seni hedeflemedi ve birine (siperdekine de) ateş ettin | +1 |
    | Kimse seni hedeflemedi ve ateş etmedin | 0 |

    Oyunun puanı = tur 1 puanı + tur 2 puanı (-2…+2).
17. Kartlarla etkileşim: Kartlar oyunun toplam puanına (iki turun toplamı; `miniScores` = `awards`) genel K6
    hesabıyla uygulanır. "Birinci" toplamı en yüksek, "sonuncu" toplamı en düşük oyuncu(lar)dır; herkesin toplamı
    eşitse herkes birincidir ve kimse sonuncu değildir. Turların tek tek puanı kartlar için kullanılmaz.

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

**Değişiklik (ZB, Ekim 2026, sahip onayı; `docs/UI-GELISTIRME.md`) — yukarıdaki cevapların önüne geçer:**

- **Bombayı at (ZB-M1):** sabit sıra kalkar. İlk sıranın sahibi rastgeledir. Diziyi doğru giren oyuncu 4 saniye içinde
  bombayı kime atacağını seçer (önce renk, sonra hedef). Hedef aktif (elenmemiş) bir oyuncudur; kendine atılamaz;
  3 ve daha çok aktif oyuncu varken bombayı az önce kendisine atan kişiye hemen geri atılamaz (2 aktif oyuncuda bu
  engel yoktur). Engel yalnız bir sonraki atış içindir. Seçim yapılmazsa sunucu maç tohumundan rastgele seçer.
  Bağlantısı kopan oyuncu da hedef olabilir (sırası gelince zaman aşımıyla elenir).
- **Elenme sonrası:** dizi yeni rastgele 2 renge döner ve yeni kurbanı, elenene bombayı ATAN kişi seçer (aynı 4 sn,
  renk seçimi yok; bu seçimde "hemen geri atma" engeli yoktur). Elenene atan yoksa (ilk sıra) yeni kurban rastgeledir.
- **Rengi sen eklersin (ZB-M2):** doğru giren, diziye eklenecek rengi seçer. Ani ölümde (+2) birini oyuncu seçer,
  ikincisi rastgele eklenir. Seçilmezse rastgele. Seçilen renk hedef belli olana dek yalnız seçenin ekranındadır;
  sonra dizinin parçası olarak herkese oynatılır. Giriş evresinde dizi hiçbir görünümde yoktur.
- **Zamanlama:** doğru girişten sonra 0,9 sn "TEMİZ!" gösterimi, sonra 4 sn seçim (gösterim sırasında gelen seçim de
  kabul edilir); elenmeden sonra 1,6 sn patlama gösterimi, sonra 4 sn seçim. Hedef belli olunca 1,4 sn uyarı payı
  (bomba fırlatılır, hedefte "SIRA SENDE!") ve ardından dizi oynatılır. Bu süreler 90 sn oyun saatinden düşer.
  Toplam süre seçim sırasında dolarsa seçim iptal edilir, oyun biter.
- **Puan (ZB-M3, eksi puan yok):** biriken +1'ler kalkar. Oyun sonunda hayatta kalanlar **+2**, bütün elenenler **0**.
  Kimse elenmeden 90 sn dolarsa herkes **+1**. Süre dolduğunda giriş yapanın sırası cezasız iptal edilir; o kişi
  hayatta sayılır.

## 25. Kusursuz Denge — `kusursuz-denge`

**DURUM: KAPSAM DIŞI — BU OYUN EKLENMEYECEK**

---

# C. Yeni oyunlar (A8)

## 26. Bozuk Telefon — `bozuk-telefon`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`; Ekim 2026 güncellemesi
BT-M1/M2/M3: `docs/oneriler/bozuk-telefon.md`, `docs/UI-GELISTIRME.md`)

- Amaç: Bir cümlenin çizim ve tahmin zincirinde nasıl bozulduğunu izleyip gülmek; zinciri sağlam tutmak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Her oyuncu bir **zincir** başlatır: ilk adımda kısa bir cümle yazar (en çok 60 karakter, 20 sn).
- Zincirler her adımda bir sonraki oyuncuya geçer (sabit, karıştırılmış döngü; kimse kendi zincirine dönmeden
  önce herkesten geçer). Adımlar sırayla **çiz** (45 sn) ve **yaz** (20 sn: gördüğün çizimi tek cümleyle anlat).
- Adım sayısı: oyuncu sayısı (en çok **5**) — 3 oyuncuda 3 adım (yaz→çiz→yaz), 4'te 4, 5–8 oyuncuda 5 adım
  (yaz→çiz→yaz→çiz→yaz). 6–8 oyuncuda her zincirde 5 yazar olur; kalanlar o zincirde adım yazmaz ama oy verir.
- Her adımda oyuncu **yalnız bir önceki adımı** görür; zincirin geri kalanı sonuna kadar gizlidir.
- Süre dolduğunda: boş çizim "boş tuval", boş yazı "…" olarak zincire geçer. Bağlı herkes "Tamam" derse adım 1 sn
  sonra erken biter.
- Çizim: 10 renk (beyaz, pembe, sarı, yeşil, mavi, turuncu, kırmızı, mor, kahverengi, gri) + silgi, 4 kalınlık
  (4: çok kalın). Sınırlar aynı: en çok 150 darbe, 1 500 nokta, 400 çizim eylemi.
- Gösteri: zincirler tek tek açılır; ilk adım hemen, sonrakiler **2 sn** arayla. **Oylama, zincirin son adımı
  görünür görünmez açılır** ve **6 sn** sürer: herkes o zincirin **en komik adımına** oy verir (kendi adımına
  veremez; tek seferlik). Bağlı herkes oy verirse 1 sn sonra biter. Ardından **2 sn** zincir sonucu.
- **İsimsiz oylama:** gösteri ve oylama boyunca adımların yazarı (ve zinciri başlatan) kimseye gösterilmez; herkes
  yalnız kendi adımını "senin" olarak görür. Yazarlar zincir sonucunda açılır.
- **Kahkaha puanı** (oyun içi): en komik seçilen her oy için adımın sahibine **+1**; zincirin ilk cümlesi ile son yazı
  adımı aynı anlamdaysa (Türkçe normalize edilmiş kelimelerin en az yarısı ortak) o zincirdeki herkes **+1**
  ("sağlam zincir"). Kahkaha puanı oyun boyunca ekranda görünür; mini oyun puanı (sonuç ekranındaki sıralama) budur.
- Genel skora: kahkaha puanı sırasına göre en yüksek **+2**, ondan sonraki farklı toplam **+1**, diğerleri 0.
  Birincide eşitlik varsa hepsi +2 ve sonraki farklı toplam +1; toplamı 0 olan ödül almaz; herkesin toplamı aynı ve
  0'dan büyükse herkes +1. Eksi puan yoktur.
- Kartlar (K6): "birinci/sonuncu" kahkaha puanına göre belirlenir; çarpanlar +2/+1 ödülünü katlar (Altın Dokunuş ile en
  çok +6); eksi olmadığından Kalkan etkisizdir.
- Oyunun kendi sonuç açılışı son zincirin oylaması bitince başlar: 2 sn zincir sonucu, ardından "Gecenin en komikleri"
  (her zincirin en çok oy alan adımı) ve altta ortak "Devam et". Her zincir telefonda tek uzun görsel olarak
  kaydedilebilir (görsel cihazda oluşturulur, hiçbir yere gönderilmez).
- **"💡 İlham ver"** (yalnız ilk cümle adımında): yapay zekâ o an 3 kısa, çizilebilir, komik cümle önerir; yalnız isteyen
  oyuncu görür, dokununca kutuya yazılır (değiştirilebilir). Kişi başı oyun başına en çok 3 istek; öneriler saklanmaz,
  havuz değildir; modele kişisel bilgi gitmez; yasaklı kelime süzgecinden geçer. Hata/zaman aşımında "Şu an ilham yok";
  özellik kapalıysa düğme görünmez. Kural ve puanı etkilemez.

## 27. Laf Sokma Düellosu — `laf-sokma`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`)

- Amaç: Aynı soruya rakibinden daha komik cevap verip oyları toplamak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Sistem tek soru havuzundan (elle hazırlanmış; ton seçimi yok) sorular seçer; her soru tam
  **iki** oyuncuya verilir ve her oyuncu **iki** soru alır (eşleşmeler kendini tekrar etmeyecek şekilde dağıtılır).
- Yazma: 60 sn; her cevap en çok 80 karakter. Cevaplar sunucuda temizlenir ve moderasyon filtresinden geçer.
- Oylama: her soru sırayla gösterilir; iki cevap karşı karşıya, **isimsiz**. Cevabı olmayan iki oyuncu 10 sn içinde
  birine oy verir (cevap sahipleri oy vermez). Oylar ve cevap sahipleri o soru açılınca görünür.
- Oy verme (sahip onayı, LS-M3): karta dokunmak yalnız **seçer**; oy, altta "BU DAHA KOMİK" ile **onaylanınca**
  gider. Onaydan önce seçim değiştirilebilir; onaydan sonra oy kesindir (değiştirilemez). Finalde de aynı.
- Cevap yazmayan: "Cevap yok" kartı gösterilir, otomatik 0 oy.
- **Kahkaha puanı** (oyun içi puan): bir soruda aldığın oy sayısı kadar **+1**; tüm oyları alırsan (en az 2 oy) ek
  **+1** ("Laf Ustası"). Kahkaha puanı oyun boyunca ekranda görünür.
- **Final sorusu:** son turda herkes aynı soruya cevap yazar (45 sn); herkes kendisi dışında bir cevaba oy verir;
  aldığın her oy **+1** kahkaha (final oyları iki kat sayılmaz).
- Genel skora (sahip onayı, LS-M1): kahkaha puanı sıralaması. En yüksek toplam **+2**, sonraki farklı toplam **+1**,
  diğerleri 0. Birincide eşitlik varsa hepsi +2, sonraki farklı toplam +1. Toplamı 0 olan ödül almaz. Herkesin
  toplamı aynı ve 0'dan büyükse herkes **+1**. Eksi puan yoktur.
- Kartlar: "birinci" ve "sonuncu" kahkaha puanına göre belirlenir (K6); kartlar sıralama ödülünü (+2 / +1 / 0)
  değiştirir. Ör. kahkaha birincisinin Kendine Güven'i +2 → +4, Çift Puan +2 → +4; Ters Köşe'de 0 kahkahalılar
  +2 ve +1'i paylaşır.

## 28. Kara Borsa — `kara-borsa`

**Durum: KİLİTLİ** (sahip onayı; uygulama yorumları `docs/A8-OYUNLAR.md`, `docs/A8-LAF-SOKMA.md`; Ekim 2026
geliştirmeleri KB-M1, KB-M2, KB-M3, KB-U1…U8, KB-AI1: `docs/oneriler/kara-borsa.md`, `docs/UI-GELISTIRME.md`)

- Amaç: Gizli değerli kutuları blöf ve ipuçlarıyla ucuza almak; en çok kâr eden olmak.
- Minimum oyuncu: **3**. Maksimum oyuncu: **8**.
- Herkes **100 jetonla** başlar. **5 tur**; her turda bir gizemli kutu.
- Kutunun gerçek değeri gizli: 1–4. turda 0–60 arası tam sayı, ya da **%15 olasılıkla lanetli** (değer −20).
  **5. tur "Büyük Kutu"** (KB-M2): değer iki kat, 0–120 arası ya da %15 olasılıkla lanetli **−40**. Teklif üst sınırı
  (o anki jeton) ve süre aynı.
- Her turda her oyuncu **yalnız kendine özel iki ipucu** alır (KB-M3); ipuçları her zaman doğrudur, sözlü blöf
  serbesttir:
  - **Ana ipucu** (değeri daraltır). Lanetsiz kutuda "değeri n'den büyük", "n'den küçük" ya da "a ile b arasında"
    (eşikler gerçek değere yakın rastgele; "arasında" aralığı en çok 30 geniş). Lanetli kutuda oyuncuların **en az 1,
    en çok yarısı** (yukarı yuvarlanır) "Kutu lanetli!" görür; diğerleri doğru ama yanıltıcı "değeri n'den küçük"
    görür (n 1–40).
  - **Ek ipucu** (küçük): çift/tek, 3/5/10'un katı ya da katı değil, ya da "Kutu lanetli değil" (yalnız lanetsiz
    kutuda ve ana ipucu bunu zaten söylemiyorsa, yani ana ipucu "küçük" iken).
  - Büyük Kutu'da eşikler ölçeğe göre iki katıdır (aralık en çok 60; lanetlide n 1–80).
  - Farklı oyunculara mümkün olduğunca farklı ana (ve ek) ipucu verilir (6 deneme; seçenek kalmazsa tekrar eder).
- Teklif: 20 sn, gizli, **tek seferlik** (0 ile mevcut jeton arası; 0 = geç). Bağlı herkes teklif verince erken biter (sahip onayı): bağlantısı kopan oyuncu beklenmez (teklifi 0 sayılır); eskiden kopuk oyuncu da beklenirdi.
  Jetonu biten oyuncu teklif vermiş sayılır; ipucunu görmeye devam eder.
- En yüksek teklif kutuyu alır ve **kendi teklifini öder**; eşitlikte önce teklif veren kazanır. Kimse teklif vermezse
  kutu kimseye gitmez. Teklifler ve kutunun değeri tur sonunda açılır: **8 sn** (KB-U1; tokmak "SATILDI!", teklifler
  düşükten yükseğe tek tek, kazanan en son; kapak kalkar, değer sayarak çıkar, kazananın satırında kâr/zarar damgası).
- **Oyun içi puan kârdır** (KB-M1): (kalan jeton + aldığı kutuların değerleri) − 100. Eksi olabilir (yalnız oyun
  içi gösterge).
- Genel skora (KB-M1): yalnız **kârı 0'dan büyük** olanlar ödül alır. En yüksek kâr **+2** (eşitse hepsi), sonraki
  farklı kâr **+1** (eşitse hepsi), diğerleri 0. Kimse kâr etmediyse kimse ödül almaz. Eksi genel puan yok.
  Kartlarda "birinci" ve "sonuncu" kâra göre belirlenir.
- Oyun sonu yorumu (KB-AI1): son kutu açılınca ortak yapay zekâ altyapısıyla tek cümlelik "mezatçı" yorumu istenir
  (modele yalnız tur sonuçları ve yer tutucu adlar gider, ipuçları gitmez); gelirse son açılışta görünür, gelmezse
  hiçbir şey görünmez. Puanı etkilemez.
- Anlatım: "Her tur bir kutu gelir: 0–60 değerinde ya da lanetli (−20). Değerini yalnız sana özel ipucu anlatır. Son
  kutu iki kat!" · "Gizli bir teklif ver: en yükseği kutuyu alır ve teklifini öder" · "Kutunun değeri ödediğinden
  fazlaysa kâr edersin; en çok kâr eden kazanır".

## 29. Kule Ustası — `kule-ustasi`

**Durum: KİLİTLİ** (Ekim 2026; sahip "yap" dedi, testler geçti. 31 Ekim 2026: KU-M1 usta puanı ve KU-M3 adil kusursuz
eşiği onaylandı ve uygulandı — `docs/oneriler/kule-ustasi.md`, karar defteri `docs/UI-GELISTIRME.md`.)

**Fikir:** Herkes sırayla ortak bir kuleye blok bırakır. Blok, vinç kancasına asılı olarak kulenin bir kat yukarısında
sağa-sola kayar; oyuncu doğru anda dokunup bırakır. Alttaki bloğun dışına taşan kısım kesilip düşer, kule daralır. Hiç
üstüne denk getiremeyen kuleyi düşürür ve oyundan çıkar.

1. Minimum oyuncu / maksimum oyuncu: [2-8]
2. Sıra: maç başında bir kez karıştırılır, çıkan oyuncular atlanarak aynı çevrim tekrarlanır.
3. Sırası gelen oyuncunun ekranında blok, kulenin üstünde **sabit hızla sağa-sola gidip gelir**; oyuncu **bir kez
   dokunarak** bırakır. Konum sunucu saatine bağlı bir fonksiyondur (herkes aynı hareketi görür). Diğerleri izler.
   Blok kaymaya başlamadan önce **0,6 sn "Sıra sende!" uyarısı** vardır (vinç yeni bloğu indirir); sıra süresi bu
   uyarıdan sonra işler, uyarı sırasında bırakılamaz.
4. Bırakma anı: istemci dokunduğu anı sunucu saatiyle gönderir; sunucu, sıranın başlangıcından önceki ya da 400 ms'den
   eski anları kabul etmez (gecikme hilesine karşı). Sıra süresi **6 saniye**; dokunmayan oyuncu süre dolduğu anda
   bırakmış sayılır.
5. **Kesme:** Bırakılan bloğun alttaki bloğun dışına taşan kısmı kesilir; kalan genişlik yeni bloğun genişliğidir.
   **Kusursuz:** önce ıskaya bakılır; sonra taşma, eşikten **kesin küçükse** kesilmez, blok tam oturur ve "Kusursuz!"
   sayılır. Eşik **bloğun genişliğinin %4'ü ya da 12 birim, hangisi büyükse**; ama en çok bloğun yarısı (çok dar
   blokta yarısı kullanılır). Örnek: 400 genişlikte 15 kusursuz, 16 değil; 100 genişlikte 11 kusursuz, 12 değil;
   20 genişlikte 9 kusursuz, 10 değil.
6. **Iska:** Blok alttakinin üstüne hiç denk gelmezse kule yıkılır: o oyuncu **çıkar**, kule **başlangıç genişliğine
   sıfırlanır** (yeni taban) ve sıra kalanlarla sürer.
7. **Hız:** Her başarılı katta kayma hızı %6 artar (en çok başlangıcın 2,5 katı). Kule sıfırlanınca hız da sıfırlanır.
8. **Bitiş:** Başlangıç oyuncularının yarısı çıkınca ya da **90 saniye** dolunca (hangisi önce gelirse). Süre dolarken
   sırası gelmiş oyuncunun bırakışı iptal edilir, cezası olmaz (ayakta sayılır).
9. **Usta puanı (oyun içi puan, KU-M1):** oturttuğun her kat **+1**, kusursuz kat **+2** (+1 yerine); oyun bittiğinde
   **hâlâ oyunda olan +3** ("ayakta kaldın"). Iskalayıp çıkanın usta puanı korunur (eksiye düşmez), yalnız +3'ü
   alamaz. **Genel skora giden puan:** usta puanı sıralaması — en yüksek **+2**, ikinci **+1**, diğerleri **0**; eksi
   yok. Birincide eşitlikte hepsi +2, sonraki farklı toplam +1; usta puanı 0 olan ödül almaz; herkesin toplamı aynı ve
   0'dan büyükse herkes +1. **2 oyuncuda:** ıskalayıp çıkan, usta puanı ne olursa olsun **0**, kalan **+2**; ıska
   olmadan süre dolarsa usta puanı yüksek olan +2, diğeri +1 (eşitse ikisi de +2). Kartlarda "birinci" en yüksek usta
   puanlı(lar), "sonuncu" en düşük usta puanlı(lar)dır (ortak kural: kartlar mini puanı okur).
10. Gizli bilgi yoktur; her şey herkese açıktır.
11. Tutorialda gösterilecek üç adım:
    1. Blok kulenin üstünde kayar; sıran gelince dokunup bırak.
    2. Taşan kısım kesilir, kule daralır; tam oturtursan Kusursuz! (altın kat)
    3. Iskalayan kuleyi yıkar ve çıkar; ayakta kalan ve çok kat koyan kazanır.
12. Rastgele seçime girer (Ekim 2026: testler çalıştırıldı ve geçti; o zamana dek `randomPool: false` ile yalnız
    elle seçilebiliyordu). Bayrak genel olarak duruyor: yeni bir oyun onay bekleyecekse aynı yolla havuz dışında
    tutulur (`pickRandomGames` havuza almaz, katalogda `GameInfo.randomPool` görünür).
13. Ekranda gösterilen (kural değiştirmeyen) bilgiler: kat sayacı, bu oyunda yıkılmış en yüksek kulenin rekor çizgisi,
    hız rozeti, art arda kusursuz serisi ("SERİ ×3"); şeritte usta puanı ve ★ kusursuz sayısı. "Kule Ustası" rozeti
    (tek oyunda 3 kusursuz) aynen kalır.

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
