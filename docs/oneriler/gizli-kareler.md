# Gizli Kareler — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **GK-M2**). Madde kodlarının öneki **GK** (Gizli Kareler).
Cevabını tek satırda verebilirsin:

> GK-M1 evet, GK-M2 hayır, GK-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu. Izgara 2–4 oyuncuda **3×3**, 5–8 oyuncuda **4×4**. Mayın yok.
- **1. aşama (20 sn):** herkes gizlice bir kare seçer; "Tamam"a kadar değiştirebilir. Bağlı herkes Tamam derse 1 sn
  sonra biter. Seçmeyen **pasif** (puan yok, çakışmaya girmez).
- **Açılış (4 sn):** kareyi **tek başına** seçen **+1** alır ve 2. aşamaya geçer; aynı kareyi seçenler çakışır ve
  elenir. Kimse tek kalmazsa oyun puansız biter; **tek kişi** kalırsa "rakipsiz" sayılır, otomatik **+1 daha** alır
  (toplam +2), 2. aşama oynanmaz.
- **2. aşama (20 sn):** yalnız 1. aşamada tek kalanlar aynı büyüklükteki ızgarada yeniden seçer. Tek kalan **+1**.
  Sunucunun gizlice seçtiği **ödül karesini tek başına** seçen ayrıca **+2** (O10). Ödül karesi 2. aşamanın sonucuna
  kadar hiçbir yerde yok; ekranda yalnız "Gizli ödül karesi var" yazıyor.
- **Son açılış (5 sn):** ödül karesi parlar; altında "Devam et".
- Puan genel skora **doğrudan** gider: 0, 1, 2 (iki aşama ya da rakipsiz) ya da 4 (iki aşama + ödül).
- Herkese açık olan yalnız kimin "Tamam" dediğidir; seçimler aşama bitince açılır.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Karar neredeyse yok, şans çok.** Bilgi olmadan "rastgele bir kare" seçiliyor. Rastgele seçimde tek kalma şansı
   2 kişide ~%89, 4 kişide ~%70, 8 kişide ~%64; yani çoğu kişi düşünmeden +1 alıyor.
2. **Ödül karesi saf piyango ve oyunun en büyük puanı.** +2, iki aşamanın toplamı kadar; ama 1/9 ya da 1/16 şansla,
   hiçbir ipucu olmadan bulunuyor. Oyunun sonucunu çoğu zaman bu zar belirliyor.
3. **2. aşama 1. aşamadan kolay.** Kalan az kişi aynı büyüklükteki ızgarada yarışıyor: 8 kişilik oyunda ~5 kişi
   16 karede, tek kalma ~%77. Final aşamasında gerilim düşüyor.
4. **Elenenler 2. aşamada boş bakıyor.** Ekranlarında "Elendin" ve kapalı ızgara; 20 sn hiçbir şey yapamıyorlar.
5. **Rakipsiz bitiş antiklimaks.** Tek kalan otomatik +1 alıyor, ödül karesine hiç şans tanınmıyor; oyun "bir +1
   daha" ile 25 sn'de kapanıyor.
6. **Puan ölçeği diğer oyunlardan farklı.** Genel skora doğrudan 0–4 gidiyor; 8 kişide çoğu zaman 4–5 kişi +2 alıyor.
   Senin genel kararın oyun içi puanın +2 / +1 / 0 sıralamayla gitmesi.
7. **Seçim yapmayan bağlı oyuncu herkesi bekletiyor.** "Tamam" seçim olmadan pasif; diğerleri Tamam dese de aşama
   erken bitmiyor (wiki bilinen sorun).
8. **Sözlü blöfe dayanak yok.** Kareler adsız ("şu soldan ikinci, üstten üçüncü"), 2. aşamada 1. aşamanın izleri
   yok; "Ben B3'e gidiyorum!" gibi masa blöfü ekranla desteklenmiyor.

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390; mock `kareler-*`)**
9. **Seçimin yan koltuktan görünüyor.** Seçtiğin kare camgöbeği çerçeveyle parlıyor ve içinde kendi avatarın
   duruyor; ızgaranın geri kalanı koyu. Gizli seçim bir bakışta okunuyor.
10. **Enerji çekirdeklerinin parlaklığı karede kareye farklı.** Çapraz bir dalga bazı kareleri belirgin parlak
    gösteriyor; "ödül karesi burada mı?" diye ipucu gibi okunabiliyor (değil).
11. **Sonuçta isim yok, çakışanlar okunmuyor.** Hücrelerde yalnız avatarlar; çakışma hücresinde 2–4 avatar gri ve
    ~20 px. Kimin kiminle çakıştığını ancak avatar rengini hatırlayan anlıyor.
12. **Başlıklar kendiyle çelişiyor.** 2. aşamada çakışan dev kırmızı "**Elendin**" görüyor ama altında "Toplam +1"
    yazıyor; ödül karesini bulan "**+3**" görüyor ama gerçek toplamı **+4** (1. aşamanın +1'i söylenmiyor);
    rakipsiz kalan "+2" görüyor ve bu toplam. Başlık bazen aşama puanını, bazen toplamı gösteriyor.
13. **Ödül karesi açılışı sönük.** Kimse bulamadıysa köşede neredeyse görünmeyen turuncu bir ışıltı kalıyor;
    bulunduğunda altın "tek kalan" hücresinden farkı yok, yıldız simgesi seçilmiyor. Oyunun en büyük anı fark edilmiyor.
14. **Aşama geçişi uyarısız.** 1. aşama sonucundan 4 sn sonra ızgara birden boşalıyor; "2. aşama başlıyor" sayacı
    yok. 2. aşamada yarışan kişiye rakiplerinin kim olduğu gösterilmiyor (yalnız elenene "Yarışanlar" şeridi).
15. **360×640'ta 8 kişide** hazır avatar şeridi TAMAM düğmesinin altına biniyor; "x/8 hazır" yazısı görünmüyor.
16. **Yatay ekranda (844×390)** aşama etiketi ve alt yazı kayboluyor; yalnız "Karen hazır" ve ızgara kalıyor.
17. **İzleyici başlığı** "Herkes gizlice seçiyor" iki satıra taşıp üst bilgiye yaklaşıyor; izleyici 2. aşamada da
    kimin yarıştığını adıyla görmüyor.
18. **Oyunun son ekranı yalnız 2. aşama ızgarası.** İki aşamanın özeti (kim 1. aşamada tek kaldı, kim toplam kaç)
    hiçbir yerde yok.
19. **Anlatım eksik:** ızgaranın oyuncu sayısıyla büyüdüğü, 2. aşamaya yalnız tek kalanların geçtiği, seçmeyenin pasif
    kaldığı, ödül karesinin yalnız 2. aşamada olduğu söylenmiyor.
20. **TV'de özel düzen yok:** telefon ekranı büyütülüyor (wiki).

---

## 3. Oyunu değiştiren öneriler (mekanik)

### GK-M1 · Ödül pusulası: herkese özel, doğru bir ipucu — **önerim: EVET**
**Ne:** 2. aşama başlarken yarışan her oyuncu **yalnız kendine** görünen bir ipucu kartı alır: "Pusulan: ödül karesi
**köşede değil**", "… **üst yarıda**", "… **C sütununda değil**" gibi. İpuçları her zaman doğrudur.
**Neden:** Sorun 2 ve 8. Ödül karesi piyango olmaktan çıkar; masada "benim ipucum sol tarafı gösteriyor… ya da
göstermiyor" blöfü başlar. İpucunu herkes takip ederse aynı bölgeye yığılıp çakışırlar: bilgi ile risk dengelenir
(Kara Borsa'daki kişiye özel ipucu fikrinin karelere uyarlanmışı).
**Ayrıntılar:**
- İpucu türleri: "X satırında / sütununda değil", "köşede" / "köşede değil", "kenarda" / "içeride" (4×4'te iç 4
  kare; 3×3'te yalnız orta kare içeridir), 4×4'te "üst / alt / sol / sağ yarıda".
- Her ipucu karelerin **en az dörtte birini** eler ama tek başına **en az 3 kareye** izin verir (bu yüzden 3×3'te
  "içeride" ipucu hiç verilmez; tek kareyi gösterirdi). Oyunculara mümkün olduğunca **farklı** ipucu verilir
  (tohumlu, sunucuda); 8 yarışanda tür sayısı yetmezse aynı ipucu iki kişiye gidebilir.
- İpucu yalnız 2. aşamaya geçenlerin `view`ına girer; ortak görünümde ve TV'de hiç yok. Açılışta (GK-U7) herkesin
  ipucu sırayla gösterilir ("Elif'in pusulası: köşede değil") — blöfün açığa çıktığı an.
- Rakipsiz durumda (GK-M2 yoksa) ipucu verilmez. GK-M3 onaylanırsa ipuçları yalnız açık kareler için hesaplanır.
- Kart üstte, ızgaranın hemen üstünde; dokunup **basılı tutunca** elediği kareler senin ekranında kararır
  (gözetleme koruması: bırakınca geri gelir).

### GK-M2 · Hayaletler: elenenler 2. aşamada kare tutar — **önerim: EVET**
**Ne:** 1. aşamada tek kalamayanlar (çakışan ya da pasif) 2. aşamada **hayalet** olur: onlar da gizlice bir kare
seçer. Bir yarışan, bir **hayaletle aynı kareye** düşerse "hayalete çarptı" sayılır: 2. aşama puanını ve ödülü
alamaz. Hayaletler puan almaz.
**Neden:** Sorun 3, 4 ve 5. Elenenler 2. aşamanın ortağı olur ("senin köşene geleceğim!" sözlü tehdidi), 2. aşama
kolaylaşmak yerine zorlaşır, rakipsiz bitiş de gerçek bir düelloya döner.
**Ayrıntılar:**
- Hayalet seçimi isteğe bağlıdır; seçmeyen hayaletin etkisi yoktur. Hayaletler arası aynı kare önemsizdir.
- Hayalet ödül karesinde tek başına dursa da ödül kimseye gitmez; ödül karesinde bir yarışanla dursa yarışan ödülü
  kaybeder.
- **Rakipsiz durum:** 1. aşamadan tek kişi kaldıysa ve en az bir **bağlı** hayalet varsa 2. aşama oynanır (otomatik
  +1 yok; tek kalırsa +1 ve ödül şansı). Bağlı hayalet yoksa bugünkü rakipsiz kural (+1) geçerli.
- Erken bitiş: bağlı yarışanların hepsi Tamam dedi **ve** bağlı hayaletlerin hepsi Tamam ya da "Pas" dedi (GK-M5).
- Hayaletlerin seçimleri 2. aşama bitene kadar hiçbir yere gitmez (yarışanlarınki gibi); açılışta yarı saydam
  hayalet avatarlarıyla gösterilir.
- 8 kişilik örnek: 5 yarışan + 3 hayalet, 16 kare → bir yarışanın temiz kalma şansı (rastgele seçimde) ~%64.
- Puan değişmez: hayalet 0 (1. aşama puanı zaten 0). Rozet alanına "Hayalet" önerisi (bir yarışanı düşüren hayalet).

### GK-M3 · Daralan alan: 2. aşamada kareler kapanır — **önerim: İSTEĞE BAĞLI**
**Ne:** 2. aşamada ızgaranın bir kısmı **kapanır** (taş kapakla örtülür). Önce 1. aşamada çakışma olan kareler
("yanık kareler"), gerekirse tohumlu rastgele başka kareler kapanır. Ödül karesi açık kareler arasından seçilir.
**Neden:** Sorun 3. Final aşaması gerçekten dar ve gergin olur; 1. aşamanın izi 2. aşamaya taşınır.
**Neden isteğe bağlı:** GK-M2 (hayaletler) aynı sorunu daha sosyal biçimde çözüyor; ikisi birlikte 2. aşamayı çok
sertleştirebilir. Önerim: önce GK-M2, gerekirse bu.
**Ayrıntılar (onaylanırsa):** açık kare sayısı = yarışan + 3 (GK-M2 ile yarışan + hayalet + 2), en az 4, en çok
toplam kare. Örnek: 5 yarışan, 4×4 → 8 açık kare; 2 yarışan, 3×3 → 5 açık kare. Ödül karesi 2. aşama başında açık
kareler arasından tohumlu seçilir (yine 2. aşama sonuna kadar gizli). Kapalı kareye dokunulamaz (`closed_cell`).

### GK-M4 · Açık bayrak — **önerim: İSTEĞE BAĞLI**
**Ne:** Her aşamada her oyuncu isterse bir kareye herkesin göreceği bir **bayrak** diker ("Buraya gidiyorum!").
Bayrak bağlayıcı değildir; gizli seçimin bayraktan bağımsızdır. Tamam'a kadar taşınabilir.
**Neden:** Sorun 8. Blöf ekrana taşınır: "Bayrağım A1'de ama ben D4'teyim". Uzaktan bağlanan ya da sesli konuşmayan
oyuncu da blöf yapabilir.
**Neden isteğe bağlı:** 8 kişide ızgara kalabalıklaşır; GK-U1'deki koordinatlarla aynı blöf sözlü de yapılabiliyor.
Masada konuşan gruplarda gereksiz.
**Ayrıntılar (onaylanırsa):** bayrak, hücrenin köşesinde küçük renkli avatar iğnesi (en çok 4 tanesi görünür, fazlası
"+2"); ortak görünüme açık bir alan olarak girer; açılışta "bayrağının yerinde miydi?" işareti (✓ / "blöf!").

### GK-M5 · "Pas" ile kilitle — **önerim: EVET**
**Ne:** Tamam düğmesinin yanında küçük "**Pas geç**" bağlantısı: kare seçmeden kilitlenirsin (pasif kalırsın).
**Neden:** Sorun 7. Seçmek istemeyen oyuncu herkesi 20 sn bekletmez; erken bitiş kuralı tam çalışır.
**Ayrıntılar:** puan bugünkü pasif kuralıyla aynı (0, 2. aşamaya geçemez; GK-M2 ile hayalet olur). Pas geri alınmaz.
Erken bitiş: bağlı herkes Tamam ya da Pas dediyse 1 sn sonra. Bağlı olup hiçbir şey yapmayan yine süre sonunu
bekletir (bugünkü gibi).

### GK-M6 · Genel skora +2 / +1 / 0 sıralamayla — **önerim: İSTEĞE BAĞLI**
**Ne:** Oyun içi "kare puanı" (0–4) aynen kalır ve ekranda görünür; genel skora en yüksek kare puanı **+2**, ikinci
farklı puan **+1**, diğerleri **0** gider.
**Neden:** Sorun 6. Genel ölçek diğer oyunlarla aynı olur; tek bir şanslı ödül karesi genel sıralamayı +4 ile
uçurmaz.
**Neden isteğe bağlı:** O10'da ödül karesine doğrudan +2'yi yakın zamanda onayladın. Ayrıca kare puanı kaba
(çoğunlukla 0/1/2) olduğu için eşitlikler sık: 8 kişide yine 4–5 kişi birlikte +2 alabilir. Fayda ölçek birliği;
bedel, ödül karesinin "büyük ikramiye" hissinin azalması.
**Ayrıntılar (onaylanırsa):** birincide eşitlik varsa hepsi +2, sonraki farklı puan +1 (Gizli Alışveriş GA-M4 gibi);
kare puanı 0 olan ödül almaz; herkes eşit ve 0'dan büyükse herkes +1. Kartlar kare puanına göre birinci/sonuncu bulur.

### GK-M7 · Rakipsiz şans atışı — **önerim: İSTEĞE BAĞLI** (yalnız GK-M2 onaylanmazsa)
**Ne:** Tek kalan oyuncu otomatik +1'ini alır, ardından 8 sn'lik "**Şans karesi**" seçer; ödül karesine denk gelirse
**+2** daha.
**Neden:** Sorun 5. Rakipsiz bitiş de bir an olur; masa "hangisi?" diye bağırır.
**Ayrıntılar:** ödül karesi bu durumda da tohumlu ve gizli; açılış GK-U7 ile aynı. Seçmezse şans atışı yok.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### GK-U1 · Koordinatlı ızgara — **önerim: EVET**
**Ne:** Izgaranın üstünde sütun harfleri (A–D), solunda satır numaraları (1–4); her karenin köşesinde soluk "B3".
**Neden:** Sorun 8 ve 11. "B3'e gidiyorum!" blöfü, "C2'de çakıştık" konuşması ve ekran okuyucu aynı dili kullanır
(bugünkü erişilebilirlik etiketi zaten "A1 … D4").
**Ayrıntılar:** harfler 13 px, `--text-dim`; 360 px'te kare içindeki etiket gizlenir, kenar etiketleri kalır.

### GK-U2 · Gözetleme koruması — **önerim: EVET**
**Ne:** Seçtiğin kare uzaktan **sıradan bir kare gibi** görünür: yalnız ince bir iç kenar ve küçük nokta; kendi
avatarın ve camgöbeği parlama yok. Seçimi net görmek için ızgaranın altındaki 👁 düğmesine **basılı tutarsın**.
**Neden:** Sorun 9.
**Ayrıntılar:** dokunduğun an 0,3 sn'lik küçük bir onay parlaması olur (yalnız dokunan anda), sonra söner. Ayarlarda
"Seçimimi her zaman göster" açılırsa bugünkü görünüm kalır (yalnız oynayanlar için).

### GK-U3 · Çekirdekler eşit nabız atsın — **önerim: EVET**
**Ne:** Kare içindeki enerji çekirdekleri hepsi **aynı parlaklıkta**, rastgele fazla ve yavaş nabız atar; çapraz
dalga kalkar.
**Neden:** Sorun 10. Hiçbir kare "özel" görünmez; ödül karesi ipucu sanılmaz.

### GK-U4 · 2. aşamada rakipler ve 1. aşama izleri — **önerim: EVET**
**Ne:** 2. aşama başlığının altında "**Rakiplerin:** Elif · Kaan · Mert" şeridi (GK-M2 ile ayrıca "Hayaletler: …").
Izgarada 1. aşamada kimin nerede tek kaldığı soluk, küçük avatar izi olarak durur (seçimi engellemez).
**Neden:** Sorun 8 ve 14. "Elif hep köşeye gidiyor" okuması yapılabilir; yarışan kime karşı oynadığını bilir.
**Ayrıntılar:** izler herkese açık 1. aşama sonucundan gelir (yeni bilgi değil). 360 px'te izler gizlenir, şerit kalır.

### GK-U5 · Aşama geçişi: "2. AŞAMA" bandı — **önerim: EVET**
**Ne:** 1. aşama açılışının sonunda 1 sn'lik bant: "**2. AŞAMA · Gizli bir ödül karesi saklandı**"; ızgaranın
üstünden bir ışık süpürür, kareler sıfırlanır. GK-M1 ile pusula kartı bu bantla birlikte açılır.
**Neden:** Sorun 14.
**Ayrıntılar:** 1. aşama sonrası ara **4 → 6 sn** (5 sn açılış, GK-U6 + 1 sn bant). 2. aşamanın 20 sn'si bandın
bitişiyle başlar.

### 4b. Açılış/sonuç anı ve gerilim

### GK-U6 · Kareler tek tek açılır — **önerim: EVET** · 🔊 Ses
**Ne:** Açılışta bütün avatarlar aynı anda inmek yerine kareler **tek tek ters döner** (her biri 0,15 sn): önce boş
kareler hızla, sonra tek kalanlar altın sütunla, **en son çakışmalar** (avatarlar çarpışıp kırmızı glitch) ve en en
son **kendi karen**.
**Neden:** Sorun 11 ve 14. "Benimki nerede, benimki…" beklemesi oluşur; çakışma anı ayrı bir vuruş olur.
**Ayrıntılar:** 1. aşama açılışı 4 sn'den 5 sn'ye çıkar (GK-U5). Hareket azaltmada hepsi aynı anda açılır (bugünkü gibi).

### GK-U7 · Ödül karesi anı — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
**Ne:** 2. aşama kareleri açıldıktan sonra ayrı bir vuruş: ekran kararır, bir **ışık huzmesi** ızgarada gezinip ödül
karesinde durur (1,5 sn), kare **altın sandığa** dönüşür. Sonra: tek bulan varsa "**ÖDÜL KARESİ! Elif +2**" ve
konfeti; çakışma varsa sandık kırılır "**Ödülde çakıştınız: ödül yok**"; kimse yoksa sandık kapanır "**Ödül
karesini kimse bulamadı**". GK-M1 ile ardından herkesin pusulası sırayla açılır.
**Neden:** Sorun 13. Oyunun en büyük puanı en büyük an olur.
**Ayrıntılar:** son açılış (en az gösterim) **5 → 8 sn**. Ödül karesi kenarı kalın altın + ⭐ simgesi 24 px (renk
körü modunda çizgili). 🎨 küçük altın sandık simgesi (kapalı/açık; şeffaf PNG; gelmezse CSS ⭐).

### GK-U8 · Başlık: aşama sonucu ve toplam ayrı — **önerim: EVET**
**Ne:** Başlık iki katmanlı olur: büyük satır **bu aşamanın** sonucu ("Tek kaldın · +1", "C2'de Elif'le çakıştın",
"Ödül karesi! +1 +2"), altında her zaman aynı yerde "**Toplam: +4**". 2. aşamada çakışan için kırmızı "Elendin"
yerine sakin "2. aşamada çakıştın" (1. aşama +1'i duruyorsa toplam yeşil).
**Neden:** Sorun 12.
**Ayrıntılar:** hücredeki rozet her zaman o hücrenin **bu aşama** kazancını gösterir ("+1", ödülde "+1 +2"); toplam
yalnız başlıkta ve özet tablosunda (GK-U9).

### GK-U9 · Oyun içi özet tablosu — **önerim: EVET**
**Ne:** Son açılıştan sonra ızgaranın altında (ya da üzerine açılan bir sayfada) herkesin satırı: avatar + ad ·
1. aşama (✓ tek / ✕ çakıştı / – pasif) · 2. aşama (✓ / ✕ / 👻 hayalet) · ⭐ ödül · **toplam**. Kendi satırın
vurgulu, en üstte toplamı en yüksek olan.
**Neden:** Sorun 18. "Devam et"ten önce kim neyi neden aldı tam görünür.
**Ayrıntılar:** 8 kişide satır yüksekliği 36 px, kaydırmasız sığar (390×844); 360×640'ta ızgara %70'e küçülür.

### GK-U10 · Son 5 saniye — **önerim: EVET** · 🔊 Ses
**Ne:** Seçim aşamalarının son 5 sn'sinde ızgaranın çerçevesi kırmızı nabız atar, tik sesi; henüz seçmemiş oyuncunun
TAMAM'ı titrer ve "Seçmezsen pasif kalırsın" yazısı belirir.
**Neden:** Pasif kalmalar azalır.
**Ayrıntılar:** seçmemiş olmanın göstergesi yalnız kendi ekranında; telefon titreşimi herkese aynı (yalnız
seçmeyenlere titreşim, yan koltuğa "henüz seçmedi" sızdırır).

### 4c. Telefon ergonomisi ve okunurluk

### GK-U11 · Sonuçta adlar: dokun-gör — **önerim: EVET**
**Ne:** Açılıştan sonra bir kareye dokununca altında küçük kart: "C2 · Elif, Mert · çakıştı". Tek kalan karelerde
avatarın altında kısa ad (en çok 6 harf); çakışma karesinde avatarlar en az 28 px, 4'ten fazlaysa "+2".
**Neden:** Sorun 11.

### GK-U12 · Küçük ve yatay ekran düzeni — **önerim: EVET**
**Ne:** 360×640'ta 8 kişide hazır şeridi TAMAM'ın **üstüne** alınır ve "x/8 hazır" görünür; ızgara kareleri 64 px'e
iner. 844×390'da ızgara solda, aşama etiketi + başlık + alt yazı + TAMAM sağda.
**Neden:** Sorun 15 ve 16.

### 4d. İzleyici, kopan oyuncu ve TV

### GK-U13 · Elenen ve izleyici ekranı — **önerim: EVET**
**Ne:** GK-M2 onaylanırsa elenenin 2. aşama ekranı **hayalet ekranıdır**: soluk mor tema, "👻 Hayaletsin: bir kare
tut, rakibini düşür", hayalet avatarlı ızgara ve Tamam/Pas. Onaylanmazsa: elenen ödül karesini **tahmin eder**
(puansız; açılışta yalnız kendisine "Bildin!"). Maça katılmayan izleyici: başlık tek satır "Gizli seçim sürüyor",
yarışanların adları ve hazır sayısı.
**Neden:** Sorun 4 ve 17.
**Ayrıntılar:** izleyici hiçbir seçimi, pusulayı ya da hayalet seçimini görmez.

### GK-U14 · TV ekranı — **önerim: EVET**
**Ne:** Ortada büyük koordinatlı ızgara, solda oyuncu sütunu (ad, aşama durumu, Tamam ✓, toplam), sağda aşama ve
süre. Açılışlar (GK-U6, GK-U7) ve özet tablosu (GK-U9) tam ekran. Bayraklar (GK-M4) TV'de de görünür; pusula ve
seçimler asla.
**Neden:** Sorun 20.

### GK-U15 · Kopan oyuncu — **önerim: EVET**
**Ne:** Açılışta kopuk ve seçmemiş oyuncu "Seçmedi" şeridinde **"bağlantı yok"** simgesiyle, bilerek seçmeyenden
(ya da Pas'tan) ayrı gösterilir. Dönen oyuncuya "Döndün · 2. aşama · 9 sn" bandı.

### 4e. Ses, titreşim ve hareket

### GK-U16 · Ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
**Ne:** Kare seçme sesi (**her kare için aynı ton**; kareye göre değişen ses yan koltuğa seçimi duyurur), kilit
"klak", kare dönüşü tıkırtısı, tek kalan için yükselen altın nota, çakışma "bzzt" + cam kırılması, hayalet uğultusu
(GK-M2), ışık huzmesi süpürmesi ve ödül sandığı açılışı (GK-U7), son 5 sn tik.
**Ayrıntılar:** titreşim: seçimde 10 ms (her kare aynı), kendi çakışmanda 300 ms, ödülü bulunca uzun-kısa-uzun.
Dosyalar gelene kadar bugünkü ortak sesler (`tap`, `fail`, `match`, `fanfare`).

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### GK-U17 · Anlatım: iki aşamanın tamamı — **önerim: EVET**
**Ne:** Amaç: "Kimseyle çakışmayan karede tek başına kal!". Üç madde:
1. "Gizlice **bir** kare seç (bu oyunda {3×3 | 4×4}). Seçmezsen pasif kalırsın."
2. "Aynı kareyi seçenler elenir; **tek kalanlar +1** alır ve 2. aşamaya geçer."
3. "2. aşamada tek kalan yine +1; gizli **ödül karesi +2**." (GK-M1 ile: "Pusulan ödül karesini gösterir")
GK-M2 onaylanırsa 2. maddeye: "Elenenler hayalet olur".
**Neden:** Sorun 19. Izgara boyutu anlatım ekranında oyuncu sayısına göre yazılır (anlatım kurulumdan önce
gösterildiği için oyuncu sayısından hesaplanır).

### GK-U18 · İlk seçim koçu — **önerim: EVET**
**Ne:** Cihazda ilk oyunda ızgaranın üstünde iki küçük balon: "1. Bir kareye dokun", "2. Emin olunca TAMAM";
2. aşamada bir kez "Ödül karesi bu aşamada gizli".
**Ayrıntılar:** süreyi durdurmaz; tercih yerel olarak hatırlanır.

### 4g. Erişilebilirlik

### GK-U19 · Ekran okuyucu, renk körü, hareket azaltma, yazı boyutu — **önerim: EVET**
**Ne:**
- **Ekran okuyucu:** kare etiketi "B3, boş" / "B3, seçimin"; açılış canlı bölgeden ("C2: Elif ve Mert çakıştı. B3:
  sen tek kaldın, artı bir"); pusula kartı okunur; özet tablosu tablo olarak işaretlenir.
- **Renk körü modu:** tek kalan ✓, çakışma ✕ (bugünkü `CbState`), ödül ⭐ 24 px ve çizgili altın kenar, hayalet
  👻 simgesi; renk tek başına anlam taşımaz.
- **Hareket azaltma:** kare dönüşü, ışık huzmesi ve glitch yerine anlık geçiş; sandık sabit simge.
- **Yazı boyutu:** büyük yazıda başlık iki satır, koordinat etiketleri ≥ 13 px, özet tablosunda ad kısaltılır.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### GK-AI1 · Kare spikeri yorumu — **önerim: İSTEĞE BAĞLI**
Özet tablosunun (GK-U9) altında tek cümle: "Oyuncu2 ve Oyuncu5 aynı köşeye koşup birbirini sildi; Oyuncu1 ise
pusulasına güvenip ödül sandığını tek başına açtı." Ortak yorum altyapısıyla: modele yalnız açılmış sonuçlar gider
(Oyuncu1…N, kareler, çakışmalar, ödül; pusulalar yalnız açılıştan sonra), puanı yapay zekâ belirlemez, hata olursa
ya da anahtar yoksa yorum görünmez, oyun beklemez.

Not: Ödül karesinin yerini ya da pusula ipuçlarını yapay zekâya seçtirmeyi **önermiyorum**: ipucunun her zaman doğru
olması ve `replay` aynı sonucu vermesi kurallı, tohumlu hesapla garanti edilir.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri (🔊):** GK-U16 seti (tek tip seçim sesi, kilit, kare dönüşü, altın nota, çakışma + cam, hayalet
  uğultusu, ışık süpürmesi, sandık açılışı/kırılması, tik). "Kareye göre değişen ses yok" kuralı ses haritasında yazılı.
- **Müzik:** sakin, gizemli bir seçim teması; 2. aşamada bir katman yükselir; son 5 sn tempo.
- **Görsel (🎨, CLAUDE.md akışıyla: görev dosyası + ChatGPT):** küçük altın sandık simgesi, kapalı ve açık (GK-U7);
  isteğe bağlı taş kapak dokusu (GK-M3) ve hayalet avatar örtüsü (GK-M2; CSS ile de yapılabilir).
- **Efekt Dokuları:** ışık huzmesi, altın sütun, hayalet sisi, konfeti; hareket azaltma sürümleri.
- **Rozet:** "Hayalet" (2. aşamada bir yarışanı düşürmek), "Pusula ustası" (ödül karesini bulmak) önerileri.
- **Moderasyon ve Wiki:** KURALLAR §14 ve `docs/wiki/oyunlar/gizli-kareler.json` güncellemesi.
- **İçerik Havuzu:** havuz yok; pusula ipucu türleri kodda sabit, sahip metinlerini onaylar. İş düşmez.

## 7. Önerilen paket

**EVET:** GK-M1, GK-M2, GK-M5 · GK-U1 … GK-U19.
**İSTEĞE BAĞLI:** GK-M3 (daralan alan), GK-M4 (açık bayrak), GK-M6 (+2/+1/0 sıralama), GK-M7 (rakipsiz şans
atışı; yalnız GK-M2 onaylanmazsa), GK-AI1 (kare spikeri).
**HAYIR:** — (bu oyunda reddedilmesini önerdiğim madde yok; isteğe bağlılar bilinçli tercih).

Bu paketle oyun şöyle akar: anlatım iki aşamayı, ödül karesini ve hayaletleri söyler → koordinatlı ızgarada herkes
gizlice bir kare seçer ("B3'e gidiyorum!" blöfü), seçim uzaktan görünmez; istemeyen "Pas" der → kareler tek tek
döner, en son çakışmalar ve kendi karen → "2. AŞAMA · Gizli bir ödül karesi saklandı", yarışanlar kendi pusulasını
görür ("köşede değil"), elenenler hayalet olup kare tutar → son 5 sn → kareler açılır, hayalete çarpanlar düşer →
ışık huzmesi ödül karesinde durur: "ÖDÜL KARESİ! Elif +2", pusulalar açılır → özet tablosu (1. aşama, 2. aşama,
ödül, toplam) → Devam et.

**Değişen kurallar (paket onaylanırsa):** 2. aşamada yarışanlara kişiye özel doğru ipucu; 1. aşamada tek
kalamayanlar 2. aşamada hayalet (yarışanla aynı kare = yarışan o aşamanın puanını ve ödülü alamaz; hayalet 0);
tek kişi kaldıysa ve bağlı hayalet varsa 2. aşama oynanır; "Pas" ile seçimsiz kilit ve erken bitişte sayılması;
1. aşama sonrası ara 4 → 6 sn, son açılış 5 → 8 sn. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; 3×3 / 4×4 kuralı; tek kare; 20 sn'lik iki aşama; seçimlerin aşama bitene kadar gizli
olması; aynı karede çakışanların elenmesi; tek kalana her aşamada +1; ödül karesinin tohumlu, gizli ve yalnız
2. aşamada olması, tek başına bulana +2, çakışmada kimseye; genel skora doğrudan aktarım (GK-M6 onaylanmazsa);
eksi puan yok; herkes Tamam deyince 1 sn sonra erken bitiş.

**🎨 Yeni görsel gerekenler (paket):** küçük altın sandık simgesi, kapalı ve açık (GK-U7). Diğer her şey CSS/SVG ile.
