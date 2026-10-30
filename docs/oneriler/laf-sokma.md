# Laf Sokma Düellosu — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **LS-M2**). Cevabını tek satırda verebilirsin:

> LS-M1 evet, LS-M2 hayır, LS-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Oyuncu sayısı kadar düello var; her soru iki oyuncuya verilir, herkes iki soruya cevap yazar (60 sn).
- Her düello sırayla oylanır (10 sn): iki isimsiz kart, cevap sahibi olmayanlar daha komiğe oy verir. Açılış 7 sn.
- Aldığın her oy +1; düellonun bütün oylarını (en az 2) alırsan **Laf Ustası** +1.
- Final: herkes aynı soruya cevap yazar (45 sn), herkes kendi dışındakine oy verir (20 sn), açılış 12 sn; her oy +1.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Puan aralığı çok geniş.** Bir düelloda +5 (4 oy + Laf Ustası), finalde 7 oy alınabiliyor; tek oyun +12'yi
   geçebiliyor. Diğer oyunlar en çok +2 veriyor; bu oyun genel sıralamayı tek başına belirleyebilir.
2. **3 kişide oylama zayıf.** Her düelloda oy verecek tek kişi kalıyor; Laf Ustası (en az 2 oy) hiç olamıyor,
   düellolar tek kişinin zevkine kalıyor.
3. **Oy anında kesinleşiyor.** Karta dokunmak oyu hemen veriyor; yanlışlıkla dokunulan karta oy gidiyor.
4. **Düello hissi zayıf.** İki kart alt alta duruyor; "iki rakip karşı karşıya" ve kazananın ilan edilmesi anı yok.
   Laf Ustası küçük bir etiket olarak geçiyor.

**Arayüz**
5. **Yazma ekranında soru değiştirmek gizli.** İki soru küçük "1 / 2" düğmeleriyle değişiyor; birçok oyuncu ikinci
   soruyu fark etmeden "Tamam" diyor. Ekranın ortası boş.
6. **Telefon klavyesi açılınca** cevap alanı ve Tamam düğmesi klavyenin altında kalabiliyor (dikey ekranda alan
   yukarıda değil ortada duruyor).
7. **Açılışta oylar bir anda beliriyor;** "oylar sayılıyor" gerilimi yok. Finalde kazanan için bir kutlama yok.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### LS-M1 · Puanı sıralamaya çevir — **önerim: EVET**
**Ne:** Oylar ve Laf Ustası bugünkü gibi toplanır (oyun içi **"kahkaha puanı"**). Oyun sonunda mini puan:
**en yüksek +2, ikinci +1, diğerleri 0.**
**Neden:** Sorun 1. Diğer oyunlarla aynı aralık (0…+2); eksi yok.
**Ayrıntılar:** birincide eşitlik varsa hepsi +2, sonraki farklı toplam +1; toplamı 0 olan ödül almaz; herkesin
toplamı aynı ve 0'dan büyükse herkes +1. Kahkaha puanı oyun boyunca ekranda görünür.

### LS-M2 · Final iki kat — **önerim: EVET**
**Ne:** Final sorusunda alınan her oy **2 kahkaha puanı** sayılır.
**Neden:** Sondaki herkesin yarıştığı soru gerçekten "final" olur; geride kalan biri finalle öne geçebilir.
**Ayrıntılar:** Final açılışında "×2" rozeti; düello puanları değişmez.

### LS-M3 · Önce dokun, sonra onayla — **önerim: EVET**
**Ne:** Oylamada karta dokunmak kartı seçer (büyür, çerçevesi parlar); altta **"BU DAHA KOMİK"** ile onaylanır.
Seçim onaydan önce değiştirilebilir; onaydan sonra kesin.
**Neden:** Sorun 3.

### LS-M4 · 3 kişide seyirci oyu — **önerim: EVET**
**Ne:** 3 oyuncuda (oy veren tek kişi kalınca) **odadaki izleyiciler de oy verebilir**; oyları normal oy gibi sayılır.
İzleyici yoksa Laf Ustası eşiği 3 kişide **1 oy** olur (tek oy verenin oyu da "ustalık" sayılır).
**Neden:** Sorun 2. Küçük grupta oyun anlamsızlaşmasın.
**Ayrıntılar:** izleyici oyu yalnız 3 oyunculu oyunda açılır; 4+ oyuncuda bugünkü gibi yalnız oyuncular oy verir.
İzleyiciler puan almaz.

### LS-M5 · Seyirci oyu her zaman — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Her oyuncu sayısında izleyiciler oy verir; izleyici oyları ayrı "seyirci" sayacında görünür, kazanana +1
seyirci bonusu.
**Neden önermiyorum:** Kalabalık izleyici oyuncuların oyunu belirlemeye başlar; arkadaş grubu oyunu için gereksiz.

---

## 4. Arayüz ve his önerileri

### LS-U1 · Düello sahnesi: Kırmızı köşe – Mavi köşe — **önerim: EVET** · 🎨 Görsel
- Oylamada iki kart **karşı karşıya**: üstte kırmızı köşe, altta mavi köşe, ortada büyük **"VS"**; soru üstte
  ring tabelası gibi.
- Arka planda iki spot ışığı her iki karta düşer.
- 🎨 Gereken: "VS" amblemi ve ring/köşe süsü (isteğe bağlı; CSS ile de yapılabilir).

### LS-U2 · Yazma ekranı akışı — **önerim: EVET**
- "1 / 2" düğmeleri yerine **sırayla akış**: önce Soru 1 tam ekran; cevap yazıp "Sıradaki" deyince Soru 2 kayarak
  gelir; ikisi yazılınca "Tamam". Üstte iki küçük nokta hangi sorunun yazıldığını gösterir; geri dönülebilir.
- İkinci soruyu yazmadan "Tamam" denirse kısa uyarı: "2. soruyu boş bıraktın, emin misin?"
- **Klavye uyumu:** klavye açılınca soru küçülür, cevap alanı ve düğme klavyenin hemen üstüne çıkar.
- Boş alanda yazarken hafifçe sallanan bir **mikrofon** simgesi.

### LS-U3 · Oylama anı — **önerim: EVET**
- (LS-M3 ile) seçilen kart büyür, diğeri geri çekilir; "BU DAHA KOMİK" basılınca kartın üstüne 😂 damgası ve kısa
  kahkaha sesi.
- Cevap sahipleri kendi kartlarını "Senin cevabın" etiketiyle görür; ekranda "Oylar bekleniyor · 3/5".

### LS-U4 · Açılış: oylar sayılsın, kazanan ilan edilsin — **önerim: EVET**
- Kartlar dönerek yazarları açar.
- Oy veren avatarlar **tek tek** kartlara uçar (davul sesiyle sayım), her oyda kahkaha sesi biraz büyür.
- Kazanan karta spot ışığı döner, kart büyür.
- **Laf Ustası:** ekranın ortasında büyük **"LAF USTASI!"** damgası, gong sesi, konfeti; kaybeden kart "nakavt"
  sarsıntısıyla geri düşer.
- Eşitlikte iki kart birlikte parlar: "Berabere!".

### LS-U5 · Final açılışı — **önerim: EVET**
- Final kartları **en az oydan en çoğa** tek tek açılır; son açılan kart **"GECENİN EN KOMİĞİ"** tacıyla büyür,
  alkış ve konfeti.
- (LS-M2 ile) kartlarda "×2" rozeti, oylar ikişer puan olarak uçar.

### LS-U6 · Ses ve titreşim seti — **önerim: EVET**
Yazma sırasında hafif kalem tıkırtısı, oyda kahkaha (oy sayısına göre büyüyen), sayım davulu, Laf Ustası gongu,
"Berabere" zili, final alkışı.

### LS-U7 · TV — **önerim: EVET**
TV bu oyunun asıl sahnesi: soru ve iki kart büyük, ortada VS; oylama sırasında kimin oy verdiği avatarlarla
(hangi karta verdiği değil); açılış ve Laf Ustası TV'de tam ekran.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### LS-AI1 · Robot cevabı — **önerim: İSTEĞE BAĞLI**
**Ne:** Bir oyuncu soruyu boş bırakırsa "Cevap yok" kartı yerine yapay zekâ o soruya bir cevap yazar ve kart
**🤖 Robot** etiketiyle gösterilir. Robot kartına oy verilebilir ama **puan kimseye gitmez**; robot bir düelloyu
kazanırsa "Robota yenildin!" diye gösterilir.
**Neden:** Boş kartlı düellolar sıkıcı; robotun ya çok komik ya çok kötü cevabı masada ayrıca eğlence olur.
**Ayrıntılar:** havuz değildir, anlık üretilir, saklanmaz; yasaklı kelime süzgeci; yapay zekâ cevap vermezse bugünkü
"Cevap yok" kartı. Modele yalnız soru metni gider.

### LS-AI2 · Spiker yorumu — **önerim: İSTEĞE BAĞLI**
Final sonunda tek cümlelik esprili özet ("Ali bu akşam dört düellonun üçünü nakavtla kazandı."). Ortak yorum
altyapısıyla; hata olursa görünmez.

---

## 6. Önerilen paket

**LS-M1, LS-M2, LS-M3, LS-M4 ve LS-U1 … LS-U7 hepsi.** (LS-M5 ve yapay zekâ maddeleri pakete dahil değil.)

Bu paketle oyun şöyle akar: iki soru sırayla tam ekran, klavyeye uyumlu yazılır → her düello kırmızı köşe/mavi
köşe olarak gelir, seç ve onayla → oylar davul eşliğinde tek tek sayılır, "LAF USTASI!" gongu → final iki kat,
kartlar sondan başa açılır, "Gecenin en komiği" tacı → kahkaha puanına göre +2/+1/0.

**Değişen kurallar (paket onaylanırsa):** mini puan kahkaha puanına göre +2/+1/0; final oyları ×2; oylama "seç +
onayla"; 3 oyuncuda izleyiciler de oy verir (izleyici yoksa Laf Ustası eşiği 1 oy). `docs/KURALLAR.md`, wiki ve
testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, soru havuzu (elle hazırlanmış, yönetici panelinden düzenlenir), eşleşme düzeni, iki
soru/oyuncu, 80 karakter, isimsiz kartlar, kendi cevabına oy yok, Laf Ustası (en az 2 oyun hepsi tek karta), süreler.

**🎨 Yeni görsel gerekenler (paket):** isteğe bağlı "VS" amblemi ve ring/köşe süsü (CSS ile de yapılır).
