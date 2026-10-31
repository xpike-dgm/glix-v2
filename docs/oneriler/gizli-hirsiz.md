# Gizli Hırsız — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **GH-M2**). Madde kodlarının öneki **GH** (Gizli Hırsız).
Cevabını tek satırda verebilirsin:

> GH-M1 evet, GH-M2 hayır, GH-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, tek aşama, **30 sn**. Herkesin ekranında karanlık bir kasa ("güvenlik çekirdeği") ve kırmızı **ÇAL**
  düğmesi var. Her oyuncu en çok **bir kez** basabilir ya da hiç basmaz; basış geri alınmaz.
- Kimin bastığı süre bitene kadar hiçbir ekrana gitmez (ne kimlik, ne sayı, ne sıra). Basan yalnız kendi ekranında
  "Parmak izin kayıtta" ve kasada parmak izi görür; düğme "BASTIN" olur.
- **Basma zamanı sonucu etkilemez**; yalnız basıp basmadığın önemlidir.
- Sonuç: **tam bir kişi** bastıysa o **+1**; **iki ya da daha çok** kişi bastıysa basanların her biri **−1**;
  basmayan her zaman **0**; kimse basmadıysa herkes 0. Puan genel skora doğrudan gider (eksi dahil).
- Bütün katılımcılar basarsa (bağlantıya bakmadan) son basıştan 1 sn sonra biter; yoksa 30 sn dolar.
- Oyunun kendi açılış ekranı yok: sonuç, genel puan tablosunun üstündeki küçük şeritte (kasa + başlık + hırsız
  avatarları ve +1/−1) gösteriliyor.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **"Doğru anı bekle" diyor ama doğru an yok.** Zaman sonucu hiç etkilemiyor; karar ilk birkaç saniyede veriliyor,
   kalan ~25 sn herkes hareketsiz bir kasaya bakıyor. Anlatımdaki ilk madde de bunu vaat ediyor.
2. **Kalabalıkta en sık sonuç "Kimse çalmadı".** −1 korkusu herkesi geri tutuyor. Dengede (herkes akıllıca oynarsa)
   5 kişide oyunların ~%42'si, 8 kişide ~%45'i kimse basmadan bitiyor: 30 sn bekleyip "boş kasa" sesi. En çok
   oynanacak kalabalık odalarda oyunun yarısı antiklimaks.
3. **Gizli hamle telefonun dışından ele veriyor.** Basınca telefon titriyor ve tık sesi çıkıyor; ekran kırmızı
   "ÇAL"dan camgöbeği "BASTIN"a ve büyük camgöbeği "Parmak izin kayıtta" yazısına dönüyor. Yan yana oturan biri
   uzaktan bile kimin bastığını görüyor/duyuyor; basmayanın ekranı ise hiç değişmiyor. Gizli bilgi masada sızıyor.
4. **Blöf için ekranda hiçbir dayanak yok.** Oyun tamamen "sözlü blöf" oyunu ama ekranda diğer oyuncular bile yok
   (hiç avatar görünmüyor); söz verme, ima etme, yeminleşme için bir araç yok.
5. **Erken bitiş ters çalışıyor.** Yalnız herkes BASINCA erken biter; "basmayacağım" diye karar veren herkesi 30 sn
   bekletir. Üstelik bitiş öne çekilince süre çubuğu sıçrıyor ve "herkes bastı" anlaşılıyor (wiki bilinen sorun).
6. **Yanlışlıkla basmak çok kolay.** Düğme `pointerdown` ile anında tetikleniyor, geri alınamıyor ve −1 riski taşıyor;
   ekranı kaydırırken ya da telefonu tutarken değen parmak hamle sayılıyor.

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390; mock `gizli-*`, `gizli-pressed&sonuc=1`)**
7. **Oyunun en önemli anı ekranda yok.** Süre dolunca oyun ekranı aynen kalıyor: basan "Parmak izin kayıtta ·
   Sonucu sonda göreceksin" + "BASTIN", basmayan "Doğru anı bekle · Yalnız bir kez basabilirsin" + soluk "ÇAL"
   görüyor ve altına "Devam et" geliyor. Yani oyuncular sonucu görmeden "Devam et"e basıyor; sonuç ancak genel
   tabloda çıkıyor.
8. **Genel tablodaki kasa açılışı küçük ve isimsiz.** Kasa ~60 px; hırsızlar yalnız avatar (ad ekran okuyucuya
   saklı). Çoklu basışta podyumda basmayanlar "0" ile taçlı duruyor, −1 alan hırsızlar podyumda yok. 360×640'ta
   "Alarm! Birden çok hırsız" iki satıra taşıp "3 hırsız birbirini yakalattı" satırının üstüne biniyor.
9. **"Parmak izi" Wi-Fi simgesine benziyor:** dört yarım halka, kasa kolunun tam üstünde; ilk bakışta "bağlantı" gibi.
10. **Ekranın ortası ölü.** Kasa ile düğme arasında ~170 px boşluk; 30 sn boyunca ekranda hiçbir şey değişmiyor.
    Son saniyelerde de bir gerilim işareti yok (yalnız üstteki süre çubuğu).
11. **İzleyici ekranı bilgisiz:** "Kasayı izliyorsun" ve kasa; kim var, kaç kişi karar verdi, hiçbir şey yok.
12. **Anlatım eksik ve yanıltıcı:** "Doğru anı bekle" (zaman önemsiz), "kimse basmazsa 0", "basmayan hiç kaybetmez"
    yazmıyor. Anlatım görseli güzel ama yalnız tek basışı gösteriyor, çoklu basışın alarmını değil.
13. **Yatay ekranda (844×390) alt yazı kayboluyor;** yalnız "Doğru anı bekle" ve kasa kalıyor.
14. **TV'de özel düzen yok:** telefon ekranı büyütülüyor (wiki); büyük ekranda kasa küçük, oyuncular hiç görünmüyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### GH-M1 · Herkes karar verir: ÇAL ya da ÇALMA — **önerim: EVET**
**Ne:** Ekranda iki eş görünümlü düğme olur: **ÇAL** ve **ÇALMA**. Herkes birine bir kez basar; karar geri alınmaz.
İkisine basınca da ekran **aynı** "Kararın kasaya kilitlendi" görünümüne geçer, aynı kısa titreşim olur.
**Neden:** Sorun 3 ve 5. Herkes bir kez dokunduğu için dokunmak ele vermez; "kim dokundu" değil "ne seçti" gizli
kalır. Herkes karar verince oyun erken biter (genel erken bitiş kuralı gibi); 30 sn ölü bekleme kısalır.
**Ayrıntılar:**
- Puan değişmez: ÇALMA = bugünkü "basmadı" (0). Hiç karar vermeyen de ÇALMA sayılır.
- Erken bitiş: **bağlı bütün katılımcılar** karar verince 1 sn sonra biter (kopan oyuncu beklenmez; bugünkü "herkes
  bastı" erken bitişinin yerine geçer). Süre çubuğu yine sıçrar ama artık yalnız "herkes karar verdi" der, ne
  seçtiklerini değil.
- Ortak görünümde yalnız **karar verenlerin listesi** olur (Gizli Kareler'deki "Tamam diyenler" gibi); ÇAL/ÇALMA
  ayrımı hiçbir yere gitmez. Sunucu testine "karar listesi seçimi sızdırmaz" sızıntı testi eklenir.
- Düğme sırası her oyuncuda aynı (solda ÇALMA, sağda ÇAL); renkleri eş tonda (ikisi de koyu, kenar ışığı farklı).

### GH-M2 · Kasada kıpırtı: 15. saniyede ortak işaret — **önerim: EVET**
**Ne:** 15. saniyede herkesin ekranındaki kasa tek bir işaret verir: **"Kasa sessiz"** (o ana kadar kimse ÇAL
demedi) ya da **"Kasada kıpırtı var!"** (en az bir kişi ÇAL dedi). Sayı ve kimlik yok.
**Neden:** Sorun 1 ve 2. "Doğru an" gerçek olur: erken çalan kör risk alır ama kasaya ilk el koyar ve diğerlerini
caydırır; bekleyen bilgi kazanır ama başkalarıyla aynı anda saldırma riski artar. "Kimse çalmadı" sıklığı düşer,
masada "kıpırtı varmış, kim o?" konuşması başlar.
**Ayrıntılar:**
- İşaret yalnız 15. saniyedeki durumu söyler ve oyun sonuna kadar öyle kalır (sonraki ÇAL'lar değiştirmez).
- **2 oyuncuda işaret yoktur:** "kıpırtı var" deyince basmayan kişi diğerinin bastığını kesin bilir (kimlik sızar).
  3+ oyuncuda kıpırtının kimden geldiği bilinmez.
- GH-M1 ile: ÇALMA kararları işareti etkilemez. Herkes 15. saniyeden önce karar verdiyse oyun erken biter, işaret
  gösterilmez.
- Sunucu tarafında işaret ortak görünüme 15. saniyede eklenen tek bir doğru/yanlış alandır; öncesinde hiçbir ipucu yok.
- Açılışta (GH-U5) kimin işarete sebep olduğu (15. saniyeden önce basanlar) "kıpırtı" simgesiyle gösterilir.

### GH-M3 · Geç ganimet: işaretten sonra tek çalana +2 — **önerim: İSTEĞE BAĞLI**
**Ne:** Tek hırsız 15. saniyeden **sonra** ÇAL dediyse **+2**, önce dediyse **+1** alır. Çoklu basış bugünkü gibi −1.
**Neden:** GH-M2'nin gerilimini büyütür: erken çalan küçük ama "güvenli" bir pay alır, geç çalan bilgiyle daha büyük
ganimete oynar. "Kasa sessiz" görünce herkes +2 için atılırsa alarm çalar; masada en sert "ben de basacağım!" blöfü
burada olur.
**Neden isteğe bağlı:** Puan aralığı bu oyunda +2'ye çıkar (diğer oyunlarla aynı tavan) ama çoklu basıştaki −1 ile
birlikte oyunun ağırlığı artar. Önce GH-M1 + GH-M2 ile denemek daha temkinli. Yalnız GH-M2 onaylanırsa geçerlidir.
**Ayrıntılar:** sınır 15. saniye dahil "sonra" sayılır (≥ 15.000 ms); 2 oyuncuda (işaret yok) +1 kalır.

### GH-M4 · Gizli bekçi — **önerim: İSTEĞE BAĞLI**
**Ne:** 4+ oyuncuda biri gizlice **bekçi** seçilir (yalnız kendisi bilir). Bekçinin düğmeleri **ALARM KUR** /
**BEKLE** olur. Bekçi alarm kurduysa ve **tek** hırsız varsa hırsız +1 alamaz (0), bekçi **+1** alır. Çoklu basışta
bugünkü −1 geçerli, bekçi 0. Kimse çalmadıysa alarm boşa gider (0).
**Neden:** Sözlü blöfü katlar: "Ben bekçiyim, çalmayın!" diyen gerçekten bekçi mi, yoksa rakipleri korkutup tek
başına çalmak mı istiyor? Kalabalıkta oyuna ikinci bir rol ve tartışma getirir.
**Neden isteğe bağlı:** Kural sayısını artırır; anlatım 3 maddeye sığmaz (4. madde gerekir). 2–3 oyuncuda kapalıdır.
**Ayrıntılar:** bekçi rastgele, tohumlu; kimliği yalnız onun `view`ına girer, açılışta herkese açılır ("Bekçi:
Elif"). Bekçi ÇAL diyemez; GH-M1 ile görünümü diğerleriyle aynıdır (iki düğme, aynı düzen). GH-M2 işaretine bekçinin
alarmı **sayılmaz**. Bekçi kartlarda normal oyuncudur.

### GH-M5 · Yemin: "Ben çalmayacağım" sözü — **önerim: EVET**
**Ne:** Oyunun ilk 10 saniyesinde herkes isterse ekrandaki **"Yemin et"** düğmesine basar; avatarının yanında herkesin
görebileceği 🤞 belirir ("Elif yemin etti"). Yemin bağlayıcı değildir; açılışta yemin edip çalanlar
**"YEMİNİNİ BOZDU!"** damgasıyla gösterilir.
**Neden:** Sorun 4. Masadaki sözlü blöfü ekrana taşır, hiçbir puanı değiştirmeden. "Yemin ettin ama yüzün kızardı"
anları ve açılışta ayrı bir kahkaha anı doğar.
**Ayrıntılar:**
- Puan etkisi yok; yemin bozmak ceza getirmez. Yemin geri alınmaz. 10. saniyeden sonra yemin edilemez.
- Yemin herkese açık bir listedir (gizli değer değil). GH-M1'deki karar ile ilişkisi açılışa kadar hiçbir yere gitmez.
- İzleyici ve TV de yeminleri görür. Rozet alanına "Yalancı" / "Sözünün eri" rozet önerisi (istek kartı).

### GH-M6 · Üç soygun, büyüyen kasa — **önerim: İSTEĞE BAĞLI**
**Ne:** Oyun **3 kısa tur** olur (her biri 12 sn + 3 sn ara açılış). Kasa **1** ile başlar; bir turda kimse
çalmazsa sonraki turun kasası **+1 büyür** (en çok 3); biri tek başına çalarsa kasa değerini alır ve kasa 1'e döner.
Çoklu basışta basanlar −1, kasa büyümez ve aynı kalır.
**Neden:** Sorun 2'nin kökten çözümü: "kimse çalmadı" artık boşa geçmez, kasayı büyütür ve gerilimi taşır. Turlar
arası açılış masada itibar ("Mert hep çalıyor") ve intikam doğurur.
**Neden isteğe bağlı:** Oyunun "tek an, tek karar" sadeliği gider; süre ~45 sn'ye çıkar; GH-M2/M3 ile birlikte çok
kural olur. Toplam puan −3…+3 aralığına çıkabileceği için genel skora giderken **−2…+2 ile sınırlanır**. Ya GH-M2
ya GH-M6 seçilmesini öneririm.
**Ayrıntılar (onaylanırsa):** her turda bir basış hakkı; GH-M1'in ÇAL/ÇALMA'sı her tur yenilenir; tur açılışı 3 sn
(yalnız hırsız sayısı ve kimlikleri); son tur kasası anlatımda "son kasa en büyük olabilir" diye söylenir.

### GH-M7 · Eksisiz puanlama ("alarmda dürüstlere +1") — **önerim: HAYIR**
**Ne:** Çoklu basışta hırsızlar 0, basmayanlar +1 alır; eksi kalkar.
**Neden önermiyorum:** Bu oyunda −1 caydırıcının kendisi (oyunun özü). Eksisiz hâlinde 8 kişide çoklu basış olunca
**hiçbir şey yapmayan 5–6 kişi +1** alır; Kara Borsa'da "hiçbir şey yapmamak ödül getiriyor" diye düzelttiğimiz
sorunun aynısı doğar. Çapraz Ateş'te de eksiyi korudun; burada da korunmasını öneririm.

### GH-M8 · Süre 30 → 20 sn — **önerim: İSTEĞE BAĞLI**
**Ne:** Aşama 20 sn olur; GH-M2 işareti 10. saniyeye kayar (GH-M3 sınırı da 10 sn).
**Neden:** Sorun 1 ve 10. GH-M1 erken bitişi getirse de kararsız kalan bir kişi herkesi 30 sn tutabilir.
**Neden isteğe bağlı:** GH-M2 onaylanırsa işaretten sonraki "bekle-gör" bölümü masa konuşmasıyla doluyor; 30 sn
o zaman anlamlı. Yalnız GH-M2 onaylanmazsa 20 sn'yi öneririm.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### GH-U1 · Kasa etrafında masa: kimler var — **önerim: EVET**
**Ne:** Kasanın çevresinde, yarım daire biçiminde bütün katılımcıların avatarları ve kısa adları durur (kopanlar
gri). Basış bilgisi **hiç** yok; GH-M5 onaylanırsa yalnız 🤞 yemin işareti, GH-M1 onaylanırsa yalnız "karar verdi"
küçük kilit simgesi (ne seçtiği değil).
**Neden:** Sorun 4 ve 10. Blöfün kime yapılacağı ekranda görünür, boşluk dolar.
**Ayrıntılar:** 2–4 kişide avatarlar 56 px, 5–8 kişide 44 px; "Sen" en altta. 360×640'ta kasa %80'e küçülür.

### GH-U2 · Doğru yazılar — **önerim: EVET**
**Ne:** Başlıklar zamanın rolüne göre yazılır:
- Bugünkü kuralla: "**Çal ya da bekle**" · "Kimin çaldığı süre bitince belli olur". Basınca: "Kararın kayıtlı".
- GH-M2 ile: ilk 15 sn "Erken çalan kasaya ilk el koyar", 15. saniyeden sonra "Kasa sessiz" / "Kasada kıpırtı var!".
- Süre bitince (GH-U5'ten önce 0,5 sn): "Süre doldu! Kasa açılıyor…" (bugünkü "Sonucu sonda göreceksin" kalkar).
**Neden:** Sorun 1, 7 ve 12.

### GH-U3 · Oyalama kadranı — **önerim: EVET**
**Ne:** Kasanın ön yüzündeki şifre kadranı herkes için **her zaman** çevrilebilir: parmakla döndürünce tıkırdar,
hafif titrer. Hiçbir etkisi yoktur; karar verdikten sonra da çevrilebilir.
**Neden:** Sorun 3 ve 10. Telefonla oynamak artık ele vermez (herkes kadranı kurcalar), ölü süre dolar, gergin
parmaklar bir şey yapar.
**Ayrıntılar:** kadranın tıkırtı titreşimi ÇAL/ÇALMA titreşimiyle aynı; ses çok kısık. Kadran hiçbir eylem göndermez
(ağ trafiği yok, sızıntı yok). Hareket azaltmada döner ama yaylanmaz.

### GH-U4 · Gizli kayıt görünümü — **önerim: EVET**
**Ne:** Karar verdikten sonra ekran **uzaktan bakınca değişmez**: düğme yerinde koyu bir "Kararın kayıtlı" şeridi
(ÇAL da ÇALMA da aynı), büyük renkli başlık yok. Ne seçtiğini görmek için şeridin sağındaki 👁 simgesine **basılı
tutarsın**; parmağını kaldırınca gizlenir. Parmak izi kasada yalnız basılı tutarken görünür.
**Neden:** Sorun 3. Bugünkü kırmızı → camgöbeği dönüşümü ve büyük "Parmak izin kayıtta" yazısı yan koltuktan okunuyor.
**Ayrıntılar:** GH-M1 onaylanmazsa da uygulanır: ÇAL'a basınca düğme ÇAL rengiyle aynı tonda "kayıtlı" olur, basmayan
oyuncunun düğmesiyle uzaktan ayırt edilemeyecek kadar benzer (yalnız yazı farklı, küçük). Basış sesi kaldırılır
(GH-U15).

### 4b. Açılış/sonuç anı ve gerilim

### GH-U5 · Oyun içi kasa açılışı — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** Süre bitince oyun ekranında, "Devam et"ten önce açılış oynar:
1. **0 sn** lazerler söner, ekran kararır, "SÜRE DOLDU".
2. **0,6 sn** kasa kolu döner, kapı aralanır.
3. **1,2 sn** sayaç: "**Kasada … 0 · 1 · 2 · 3 parmak izi**" (önce yalnız sayı; masa "kim?!" diye bağırır).
4. **2,0 sn** hırsızlar **basış sırasıyla** tek tek, adıyla ve basış saniyesiyle gelir (her biri 0,4 sn).
5. Sonra damga: tek hırsızda kapı tam açılır, altın ışık ve "**SOYULDU! Mert +1**"; çoklu basışta kırmızı siren,
   kelepçe ve "**ALARM! −1**" her hırsıza; kimse yoksa toz bulutu ve "**Kasa sağlam kaldı**".
**Neden:** Sorun 7. Oyunun bütün gerilimi bu anda; bugün oyuncular bunu görmeden Devam et'e basıyor.
**Ayrıntılar:**
- Toplam süre en çok ~4,5 sn (8 hırsızda); oyunun "en az gösterim" süresi bitiş + 4,5 sn olur. Devam et kuralı aynı.
- GH-M5 ile yemin bozan hırsızda ayrıca "YEMİNİNİ BOZDU!" damgası; GH-M4 ile bekçi en son açılır ("Bekçi: Elif ·
  alarm kurmuştu"); GH-M2 ile 15. saniyeden önce basanların yanında "kıpırtı" simgesi.
- 🎨 Gereken: açık kasa (içi altın/para dolu) görseli; kelepçe simgesi CSS/SVG ile.

### GH-U6 · Zaman şeridi: kim ne zaman bastı — **önerim: EVET**
**Ne:** Açılışın altında 0–30 sn'lik yatay şerit; hırsızların avatarları bastıkları saniyeye konur ("Mert 3. sn",
"Elif 28. sn"). GH-M2 varsa 15. saniyede "işaret" çizgisi.
**Neden:** Masa konuşmasının en tatlı kısmı: "Sen son saniyede mi bastın?!". Bilgi süre bitince herkese açık;
sızıntı değil.
**Ayrıntılar:** saniye tam sayıya yuvarlanır; ÇALMA kararları şeritte gösterilmez (GH-M1 ile de gizli kalır).

### GH-U7 · Son 5 saniye gerilimi — **önerim: EVET** · 🔊 Ses
**Ne:** Son 5 sn'de lazerler hızlanır, kasa halkası kırmızı nabız atar, tik sesi; **herkesin** telefonu saniyede
bir kısa titrer (karar vermiş olsun olmasın).
**Neden:** Sorun 10. Herkes için birebir aynıdır. Titreşimi yalnız kararsızlara vermek, yandakine "bu kişi hâlâ
çalmadı" bilgisini sızdırırdı; bu yüzden ayrım yapılmaz.

### GH-U8 · Genel tablodaki şerit: isimli ve doğru — **önerim: EVET**
**Ne:** Genel sonuç ekranının üstündeki kasa şeridinde hırsızların **adları** yazılır; çoklu basışta "Basmayan
kazanır" alt satırı; başlık 360 px'te tek satıra sığar ("ALARM! 3 hırsız"), altındaki özet satırıyla çakışmaz.
**Neden:** Sorun 8.

### GH-U9 · İşaret anı (GH-M2 onaylanırsa) — **önerim: EVET** · 🔊 Ses
**Ne:** 15. saniyede kasa kısa bir "dinleme" animasyonu yapar (stetoskop dalgası, 0,6 sn), sonra "Kasa sessiz"
(yeşil, sakin nota) ya da "**Kasada kıpırtı var!**" (amber, kısa kalp çarpıntısı sesi). Herkeste aynı anda.
**Ayrıntılar:** işaret başlığın altında oyun sonuna kadar kalır.

### 4c. Telefon ergonomisi ve okunurluk

### GH-U10 · Kaydırarak çal — **önerim: İSTEĞE BAĞLI**
**Ne:** ÇAL tek dokunuşla değil, düğmenin üstünde **soldan sağa kaydırma** ile verilir (kilit açma hareketi);
yarıda bırakılırsa geri kayar. GH-M1 ile ÇALMA da aynı hareketle.
**Neden:** Sorun 6. Yanlışlıkla −1 riski kalkar; kaydırma sesi/titreşimi kadranla (GH-U3) aynı olduğu için ele vermez.
**Neden isteğe bağlı:** Kontrol Paneli'nde "basılı tutarak kes"i istememiştin; kaydırma da benzer bir ek hareket.
Kabul edilmezse en azından `pointerdown` yerine **parmak kalkınca** (click) tetiklenir ve kaydırma hareketi
tetiklemez (bunu ayrıca EVET olarak uygularım, GH-U11'e dahil).

### GH-U11 · Küçük ve yatay ekran düzeni — **önerim: EVET**
**Ne:** 844×390'da kasa solda, başlık + alt yazı + düğmeler sağda (alt yazı kaybolmaz); 360×640'ta masa avatarları
(GH-U1) tek satıra iner. Düğme parmak kalkınca tetiklenir; ekranı kaydıran dokunuş hamle sayılmaz.
**Neden:** Sorun 6 ve 13.

### 4d. İzleyici, kopan oyuncu ve TV

### GH-U12 · İzleyici ekranı — **önerim: EVET**
**Ne:** İzleyici kasayı ve masayı (GH-U1) görür; GH-M1 ile "**4/6 karar verdi**", GH-M5 ile yeminler, GH-M2 ile
işaret. Başlık "Kasayı izliyorsun · Kim çalacak?".
**Neden:** Sorun 11. Hiçbir gizli bilgi eklenmez (yalnız oyunculara da açık olanlar).

### GH-U13 · TV ekranı — **önerim: EVET**
**Ne:** Ortada büyük kasa ve lazerler, çevresinde oyuncular (ad + yemin + karar kilidi), üstte büyük süre;
açılış (GH-U5) ve zaman şeridi (GH-U6) tam ekran. Telefon ekranının büyütülmüş hâli kalkar.
**Neden:** Sorun 14.

### GH-U14 · Kopan oyuncu — **önerim: EVET**
**Ne:** Kopan oyuncunun avatarı masada gri; dönen oyuncu kararını verdiyse "Kararın kayıtlı" ekranına, vermediyse
kalan süreyle karar ekranına döner (bugünkü gibi) ve 1 sn'lik "Döndün · 12 sn kaldı" bandı görür.
**Ayrıntılar:** GH-M1 erken bitişi kopan oyuncuyu beklemez (genel kural).

### 4e. Ses, titreşim ve hareket

### GH-U15 · Ses ve titreşim seti (ele vermeyen) — **önerim: EVET** · 🔊 Ses
**Ne:** Oyun boyu alçak alarm uğultusu ve lazer vızıltısı (herkeste aynı), kadran tıkırtısı (GH-U3), son 5 sn tik,
işaret sesleri (GH-U9), açılışta kasa mekanizması, parmak izi sayacının her rakamında "tık", soygunda para şıkırtısı
ve altın yağmuru, alarmda siren + kelepçe, boş kasada rüzgâr. **Karar anında ses yok**; titreşim kadranla aynı.
**Neden:** Sorun 3: bugünkü basış sesi (`prick`) yandaki oyuncuya kimin bastığını duyuruyor.
**Ayrıntılar:** dosyalar gelene kadar bugünkü sentez sesleri (`vaultOpen`, `alarm`, `hollow`) açılışta kalır.

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### GH-U16 · Anlatım: kuralın tamamı, üç madde — **önerim: EVET** · 🎨 Görsel (isteğe bağlı)
**Ne:** Amaç: "Kasayı yalnız bir kişi soyabilir!". Bugünkü kuralla:
1. "Çal ya da çalma: **bir kez** karar ver, geri alamazsın."
2. "Kimin çaldığı **süre bitince** belli olur. Çalmayan hiç kaybetmez."
3. "**Tek hırsız +1**, iki ve daha çok hırsız **−1**." 
GH-M2 ile 2. madde: "15. saniyede kasa kıpırtıyı ele verir: erken çalan önce davranır."
Görsel: tek parmak izi → yeşil kasa, iki parmak izi → kırmızı alarm (iki kareli döngü).
**Neden:** Sorun 12.
**Ayrıntılar:** 🎨 isteğe bağlı; mevcut illüstrasyon + CSS ile iki kare yapılabilir.

### GH-U17 · Kalabalık ipucu — **önerim: EVET**
**Ne:** Oyun ekranında başlığın altında, oyuncu sayısına göre tek satır: 2 kişide "İkiniz de çalarsanız ikiniz de
yanarsınız", 5+ kişide "Kalabalıkta tek kalmak zor: kimse çalmazsa kasa boş kalır".
**Neden:** İlk oynayanın "herkes çalar mı?" sezgisini kurar; strateji vermez, durumu anlatır.

### 4g. Erişilebilirlik

### GH-U18 · Ekran okuyucu, renk körü, hareket azaltma, yazı boyutu — **önerim: EVET**
**Ne:**
- **Ekran okuyucu:** düğmeler "Çal, tek seferlik, geri alınamaz" / "Çalma"; karar sonrası "Kararın kayıtlı" (ne
  seçtiğini sesli söylemez; 👁 basılı tutulunca söyler, kulaklıkla dinleyen için). Açılış canlı bölgeden: "Kasada 2
  parmak izi. Mert ve Elif. Alarm, ikisi de eksi bir".
- **Renk körü modu:** soygun ✓ ve altın ışık, alarm ✕ ve çizgili kırmızı; +1/−1 her zaman yazıyla.
- **Hareket azaltma:** glitch, siren yanıp sönmesi ve lazer hızlanması yerine sabit renk değişimi.
- **Yazı boyutu:** büyük yazıda başlık iki satıra izin verir, alt yazı kesilmez; düğme yazısı ≥ 24 px.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### GH-AI1 · Kasa dedektifi yorumu — **önerim: HAYIR**
Oyunun tek bir olayı var (kim çaldı, kaç kişi); bugünkü kural tabanlı özet ("3 hırsız birbirini yakalattı")
bunu zaten söylüyor. Yapay zekâ yorumu ekleyecek malzeme bulamaz, maliyete değmez. GH-M6 (üç soygun) onaylanırsa
turlar arası hikâye oluşur; o zaman ortak yorum altyapısıyla (Oyuncu1…N, yalnız açılmış sonuçlar, puanı
belirlemez, hata olursa görünmez) İSTEĞE BAĞLI olarak eklenebilir.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri (🔊):** GH-U15 seti (uğultu, lazer, kadran, tik, işaret sesleri, kasa mekanizması, sayaç tıkı,
  para + altın, siren + kelepçe, rüzgâr); karar anında ses olmaması ses haritasında kural olarak yazılmalı.
- **Müzik:** alçak, döngüsel "soygun" gerilim teması; son 5 sn tempo katmanı.
- **Görsel (🎨, CLAUDE.md akışıyla: görev dosyası + ChatGPT):** açık kasa, içi altın/para dolu (GH-U5). İsteğe
  bağlı: daha net bir parmak izi simgesi (sorun 9; SVG ile de çizilebilir).
- **Efekt Dokuları:** altın yağmuru, siren ışığı, toz bulutu, stetoskop dalgası; hareket azaltma sürümleri.
- **Rozet:** "Yalancı" (yemin edip çalmak) ve "Sözünün eri" önerileri (GH-M5 onaylanırsa).
- **Moderasyon ve Wiki:** KURALLAR §8 ve `docs/wiki/oyunlar/gizli-hirsiz.json` güncellemesi; wiki'deki "erken
  bitişte çubuk sıçrıyor" bilinen sorunu GH-M1 ile değişir.
- **İçerik Havuzu:** bu oyunda havuz yok; iş düşmez.

## 7. Önerilen paket

**EVET:** GH-M1, GH-M2, GH-M5 · GH-U1 … GH-U9, GH-U11 … GH-U18.
**İSTEĞE BAĞLI:** GH-M3 (geç ganimet), GH-M4 (gizli bekçi), GH-M6 (üç soygun; GH-M2 yerine), GH-M8 (20 sn;
yalnız GH-M2 onaylanmazsa), GH-U10 (kaydırarak çal).
**HAYIR:** GH-M7 (eksisiz puanlama), GH-AI1.

Bu paketle oyun şöyle akar: anlatım "çal ya da çalma, tek hırsız +1, çok hırsız −1"i söyler → kasanın etrafında
herkes görünür, ilk 10 sn'de isteyen "Yemin et" der → herkes ÇAL ya da ÇALMA'ya bir kez dokunur, ekran uzaktan
hiç değişmez, parmaklar kadranı kurcalar → 15. saniyede kasa dinler: "Kasada kıpırtı var!" → son 5 sn lazerler
hızlanır → herkes karar verince ya da süre bitince kasa açılır: "Kasada 2 parmak izi" … Mert (3. sn), Elif (28. sn)
"YEMİNİNİ BOZDU!" → ALARM, ikisine −1 → zaman şeridi → Devam et.

**Değişen kurallar (paket onaylanırsa):** ÇAL/ÇALMA iki düğme (ÇALMA = basmamak, puan aynı); bağlı herkes karar
verince 1 sn sonra erken bitiş (bugünkü "herkes bastı" erken bitişinin yerine); 3+ oyuncuda 15. saniyede herkese
"Kasa sessiz / Kasada kıpırtı var" işareti; bağlayıcı olmayan açık yemin (ilk 10 sn); karar anında ses yok; oyunun
kendi açılışı (en az gösterim bitiş + 4,5 sn). `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; 30 sn; oyuncu başına tek, geri alınmaz karar; kimin çaldığının süre bitene kadar
hiçbir yere gitmemesi; tek hırsız +1, çoklu basışta her hırsıza −1, basmayana 0, kimse çalmazsa herkese 0; genel
skora doğrudan aktarım; zamanlama/blöf oyunu olarak geç gelen eylem payının olmaması.

**🎨 Yeni görsel gerekenler (paket):** açık kasa (içi altın/para dolu) (GH-U5). Diğerleri mevcut kasa görseli ve
CSS/SVG ile.
