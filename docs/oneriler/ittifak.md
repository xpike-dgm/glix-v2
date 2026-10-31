# İttifak — geliştirme önerileri

Bu dosya onay içindir. Madde kodlarının öneki **IT** (İTtifak). Her maddenin bir kodu var (ör. **IT-M2**).
Cevabını tek satırda verebilirsin:

> IT-M1 evet, IT-M2 hayır, IT-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn; zaten var). Yeni görsel gerektiren maddeler
**🎨 Görsel**, yeni ses gerektirenler **🔊 Ses** diye işaretli (ilgili yapay zekâ alanlarınca üretilir; dosya
gelene kadar bugünkü sentez ses / CSS çizimi kullanılır).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/ittifak/`).

- 3–8 oyuncu. **Pazarlık (60 sn):** uygulama dışında, sesli. Uygulamada tek eylem: kendin dışında **en çok 2
  kişiye** gizli **"söz" işareti** koymak/kaldırmak. İşaret puansızdır, oyu bağlamaz; sonuç açılana kadar yalnız
  sözü veren görür (alıcı dahil kimse görmez). Bağlı herkes "Oylamaya geç" derse pazarlık 1 sn sonra biter.
- **Gizli oylama (15 sn):** kendin dışında **bağlı** bir oyuncuya tek oy; Tamam'a kadar değiştirilebilir. Vermeyenin
  oyu kendisi dışındaki rastgele birine gider. Bağlı herkes Tamam derse 1 sn sonra biter.
- **Açılış (8 sn):** oyuncular halkada; her oy, verenin renginde bir iple hedefe akar; portrelerde "+n" çipleri;
  altta sözler listesi ("Cihad → Elif ✓", "Cihad → Mert ✗"). Rastgele atanan oy da söz denetiminde sayılır.
  Sonra "Devam et".
- **Puan:** aldığın her oy **doğrudan** genel skora +1 (sıralamaya çevrilmez). 8 kişide tek oyuncu en çok +7
  alabilir; masaya her oyunda toplam oyuncu sayısı kadar puan dağılır. Eksi yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**

1. **Puan ölçeği diğer oyunlardan kopuk.** Onayladığın düzen +2 / +1 / 0; burada 8 kişide bir oyuncu +4…+7
   alabiliyor (mock'taki 8 kişilik sonuçta Elif +4). Tek bir İttifak oyunu maçın kaderini belirliyor; 3 kişide ise
   herkes çoğu zaman +1 alıp oyun hiçbir şeyi değiştirmiyor.
2. **İki söz + tek oy = en az bir "bozuldu" garanti.** İki söz koyan herkes sonuçta mutlaka bir ✗ alıyor. 8 kişilik
   örnekte "1 tutuldu, 15 bozuldu": sayı ihaneti değil kuralı ölçüyor. "İki tarafa söz verip birini tutan" ile
   "tek söz verip başkasına oy veren gerçek hain" aynı ✗'i alıyor.
3. **3–4 kişide söz işareti bilgi taşımıyor.** 3 kişide iki söz = diğer iki kişinin ikisine birden söz; işaret hiçbir
   şey söylemiyor ama sonuçta yine bir ✗ üretiyor.
4. **Söz işareti oylama ekranında kayboluyor.** İşaretin varlık sebebi "hatırlatma"; ama tam oy verirken (oylama
   ekranı) görünmüyor.
5. **Rastgele oy ihanet gibi görünüyor.** Oy vermeyenin oyu rastgele; açılışta hiçbir işaret yok ve söz denetiminde
   "bozuldu" diye sayılıyor. Telefonu masada kalan oyuncu "hain" ilan ediliyor.
6. **Kopan oyuncuya oy verilemiyor.** Pazarlıkta oy sözü alan Elif'in telefonu oylamada koparsa ona söz verenler
   zorla başkasına oy veriyor ve sözleri "bozuldu" görünüyor; Elif pazarlıkta kazandığını kaybediyor.
7. **60 sn sabit.** 3 kişide üç çiftin konuşması 20–30 sn'de tükeniyor; 8 kişide 28 olası ikili var ve 60 sn
   herkesle konuşmaya yetmiyor.
8. **İttifak anı yok.** Oyunun adı "İttifak" ama iki kişinin birbirine oy vermesi (gerçek ittifak) ekranda tek
   çizgi; kutlanmıyor. Kurallarda yazan "söz bozulunca karakterin kısa şaşkın tepkisi" (KURALLAR §16 madde 13)
   oyunda yok.

**Arayüz (ekran görüntülerine bakarak: 390x844, 360x640, 844x390)**

9. **Sahte bağlar ve sahte "•••" balonları.** Pazarlıkta portreler arasında süs neon bağlar var ve **her oyunda aynı
   çiftler** (1.–2. oyuncu, 3.–4. oyuncu: Cihad–Elif, Zeynep–Mert) bağlanıyor; portrelerde sırayla "yazıyor"
   balonu çıkıyor. İttifak oyununda bunlar gerçek bir ittifak/mesaj işareti gibi okunuyor (Yazı Yaz'da da aynı
   sorunu yaşadık).
10. **Pazarlık ekranının alt üçte biri boş** (halka ile ipucu arası ~120–150 px). "söz" etiketi ~20 px'lik küçük
    rozet; kaldırmak için aynı portreye yeniden dokunulduğu yazmıyor; ortadaki el sıkışma görseli ~30 px süs.
11. **Oylama ekranı Rüşvet'le aynı:** son satır sola yaslı (5 kişide Zeynep–Kaan, 8 kişide Burak–Ayşe), seçtiğin
    kişinin ✓'i ile Tamam diyenlerin ✓'i aynı yeşil; başlıkta seçilen ad dev harflerle (yandaki oyuncu gizli oyunu
    bir bakışta okur).
12. **Açılış okunmuyor.** Çizgilerde yön yok (kim kime?); karşılıklı oylar üst üste binip tek çizgi oluyor; 8 kişide
    örümcek ağı. Söz listesi 8 kişide ekrandan taşıyor (satırlar kesik), 360x640'ta "Sözler" başlığı Kaan'ın adına
    biniyor. Her şey aynı anda beliriyor; gerilim yok.
13. **Kendi hikâyen yok.** Başlıkta "+2 · 2 oy aldın · Oyun: Elif" var; sana **kimin** oy verdiği, **sana söz verip**
    bozanın kim olduğu 16 satırlık listenin içinde kayboluyor.
14. **Yatay ekranda** halkanın en alttaki portresi (Kaan) "Oylamaya geç" düğmesinin altında kalıyor; alt yazı ve
    ipucu kayboluyor.
15. **İzleyici ve TV için özel görünüm yok:** izleyici sahte bağları izliyor; TV'de telefon sütunu büyütülüyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### IT-M1 · Puan sıralamaya: +2 / +1 / 0 — **önerim: EVET**
**Ne:** Alınan oy oyun içi puandır; genel skora **en çok oy alan +2, ikinci +1, diğerleri 0** gider.
**Neden:** Sorun 1. Ödül diğer oyunlarla aynı olur; tek bir İttifak maçı kilitlemez.
**Ayrıntılar:**
- Birincide eşitlik varsa hepsi +2, sonraki farklı oy sayısı +1. **Herkesin oyu eşitse herkes +1** (ör. 8 kişi
  zincirleme birer oy). **0 oy alan hiçbir zaman ödül almaz.**
- Örnekler: 3 kişi 2-1-0 → +2/+1/0; 3 kişi 1-1-1 → herkes +1; 8 kişi 3-2-1-1-1-0-0-0 → +2/+1/0…;
  5 kişi 2-2-1-0-0 → +2/+2/+1/0/0.
- Açılışta portrelerde hem oy sayısı ("3 oy") hem genel skora giden ödül ("+2") görünür.
- Maç kartlarında "birinci" = en çok oy alanlar, "sonuncu" = en az oy alanlar (bugünkü genel hesap).

### IT-M2 · Kopan oyuncuya da oy verilebilsin — **önerim: EVET**
**Ne:** Oyun başında katılımcı olan herkes, bağlantısı kopmuş olsa da oylanabilir (portresi soluk ama seçilebilir).
**Neden:** Sorun 6. Pazarlıkta kazanılan oy, telefon kapandı diye kaybolmaz; söz veren zorla "hain" olmaz.
**Ayrıntılar:** kopan oyuncu oy veremez (oyu bugünkü gibi rastgele atanır, IT-M3 ile işaretli); erken bitişte
beklenmez (bugünkü gibi). Söz işareti zaten kopan oyuncuya da konabiliyor; değişmez.

### IT-M3 · Rastgele oy görünür olsun — **önerim: EVET**
**Ne:** Oy vermediği için sunucuca atanan oy açılışta **🎲** ile ve kesikli iple gösterilir: "Kaan oy vermedi, oyu
zarla Mert'e gitti". Söz denetimi O4 kararındaki gibi bu oyu da sayar, ama ✗'in yanında **"oy vermedi"** notu çıkar
ve IT-U6'daki "Hain" etiketi bu oyuncuya verilmez.
**Neden:** Sorun 5. Telefonu masada kalan oyuncu ile bilerek ihanet eden ayrılır; sahibin O4 kuralı (sayılır)
değişmez, yalnız bilgi açılır.
**Ayrıntılar:** sonuç görünümüne "rastgele oy verenler" listesi eklenir; yalnız açılışta herkese açık (oylar zaten
açılışta açık).

### IT-M4 · Pazarlık süresi oyuncu sayısına göre — **önerim: EVET**
**Ne:** Pazarlık **3–4 oyuncuda 45 sn, 5–6 oyuncuda 60 sn, 7–8 oyuncuda 75 sn**. Oylama 15 sn kalır.
**Neden:** Sorun 7. Az kişide konuşma tükenip ekran bekletmiyor; kalabalıkta herkes birkaç kişiyle konuşabiliyor.
**Ayrıntılar:** "Oylamaya geç" erken çıkışı aynen (bağlı herkes derse 1 sn sonra). Anlatımdaki "60 saniye" ifadesi
"Süre boyunca" olur; sayaç gerçek süreyi gösterir.

### IT-M5 · Söz sınırı oyuncu sayısına göre — **önerim: EVET**
**Ne:** En çok söz işareti **3–4 oyuncuda 1, 5–8 oyuncuda 2**.
**Neden:** Sorun 3. 3 kişide iki söz "herkese söz" demek; tek söz bir seçim olur ve sonuçtaki ✓/✗ anlam taşır.
**Ayrıntılar:** sınır dolunca başka portreye dokunmak bugünkü gibi reddedilir ("En çok 1 söz işareti"); önce mevcut
söz kaldırılır. Sonuçtaki söz sınıflaması (IT-U6) bu sınıra göre çalışır.

### IT-M6 · Nabız yoklaması (ara eğilim) — **önerim: İSTEĞE BAĞLI**
**Ne:** Pazarlıkta **son 25 sn'ye girilince** 6 sn'lik bir pencere açılır: herkes isterse bir portreye dokunup gizli
bir **"eğilim"** bırakır. Pencere kapanınca her portrenin altında yalnız **sayı** görünür ("Elif · 3 eğilim");
kimin kime eğilim verdiği **hiçbir zaman** açılmaz. Eğilim bağlamaz, puansızdır.
**Neden:** Pazarlığın ortasına somut bir bilgi düşer: "Kim bana eğilim vermedi?", "Elif'in 3'ü var, onu
durdurmalıyız" konuşması başlar. Sorun 7'deki tükenen konuşmayı canlandırır; ek süre istemez.
**Neden isteğe bağlı:** Oyunu bir adım karmaşıklaştırır; bazı masalar pazarlığın tamamen sözlü kalmasını sever.
**Ayrıntılar (onaylanırsa):** eğilim vermeyen sayılmaz (rastgele atanmaz); kendine eğilim yok; 3 kişide de aynı.
Sayılar oylama ve açılışta kaybolur (gerçek oylarla karışmasın). Gizlilik testi: eğilim kimlikleri hiçbir
görünüme girmez, yalnız sayılar.

### IT-M7 · Göz kırpma (gizli işaret) — **önerim: İSTEĞE BAĞLI** · 🔊 Ses
**Ne:** Pazarlıkta bir portreye **basılı tutunca** (0,5 sn) o kişiye gizli bir **göz kırpma** gider: yalnız onun
telefonu kısa titrer ve onun ekranında **senin** portrende 1,5 sn "😉" belirir. Başka kimse kimin kime göz
kırptığını görmez; sonuçta da
açılmaz. Kişi başı pazarlık boyunca en çok 3 göz kırpma.
**Neden:** Aynı odada herkes her şeyi duyuyor; gizli ittifak kurmanın tek yolu kulağa fısıldamak. Göz kırpma masanın
öbür ucundaki biriyle sessiz bir "seninleyim" anı yaratır, ama içeriği yok: blöf de olabilir (üç kişiye birden
kırpılabilir). Pazarlığı ekranla destekler, konuşmanın yerini almaz.
**Neden isteğe bağlı:** KURALLAR §16 "uygulama içinde teklif, söz veya anlaşma nesnesi oluşturulmaz" diyor. Göz
kırpma bir anlaşma değil, içeriksiz bir sinyal; yine de bu çizgiye yakın, karar senin.
**Ayrıntılar (onaylanırsa):** kısa dokunuş bugünkü gibi söz mührü koyar, basılı tutmak göz kırpar (iki hareket
karışmasın diye basılı tutarken portrenin çevresinde dolan halka); kendine yok; kopan oyuncuya gider ama o görmez;
oylamada yok. Gizlilik: yalnız alıcının `view`'una "son göz kırpan" kimliği 1,5 sn için girer; sayı ve geçmiş
saklanmaz.

### IT-M8 · Söze puan bağlamak (ittifak bonusu / ihanet cezası) — **önerim: HAYIR**
**Ne:** Karşılıklı oy veren ikiliye +1 bonus ya da sözünü bozana ceza.
**Neden önermiyorum:** Senin kuralın ("güvene dayalı oyun, cezası yok") oyunun ruhu. Bonus, herkesin ikili kurduğu
tek bir "doğru stratejiyi" ödüllendirir (8 kişide dört ikili = herkes eşit) ve blöfü öldürür; ceza ise eksi puan
ya da puan kesintisi demek. İhaneti puanla değil sahneyle (IT-U5, IT-U6) büyütmeyi öneriyorum.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### IT-U1 · Pazarlık masası — **önerim: EVET** · 🎨 Görsel
- Sahte neon bağlar ve "•••" balonları **kalkar** (sorun 9). Yerine yalnız gerçek bilgi: **senin** söz verdiğin
  portrelere senden çıkan ince altın ip (yalnız sende görünür) ve "Oylamaya geç" diyenlerin portresinde ✓.
- Portreler ortadaki yuvarlak bir müzakere masasının çevresinde; sayaç masanın ortasında büyük. Halka çapı boş alt
  alanı kullanacak kadar büyür (390x844'te portre 64 → 76 px).
- Altta "Söz verdiklerin: Elif · Mert" şeridi; boşsa "Portreye dokun: gizli söz işareti".
- 🎨 yuvarlak müzakere masası (üstten görünüş, gotik salonla uyumlu).

### IT-U2 · Söz mührü — **önerim: EVET** · 🎨 Görsel · 🔊 Ses
- Söz konunca portreye büyük bir **balmumu mühür** basılır ("tak" sesi, kısa titreşim); kaldırınca mühür kırılıp
  düşer. Portre köşesindeki küçük "söz" rozeti yerine 28 px mühür.
- İlk söz konduğunda bir kez küçük not: "Tekrar dokun: sözü geri al".
- Sınır dolunca (IT-M5) boş portreye dokunmak hafif sallanma + "Önce bir sözü geri al".
- 🎨 balmumu mühür (tam ve kırık hâli).

### IT-U3 · Oylama ekranında söz hatırlatması — **önerim: EVET**
- Söz verdiğin portrelerde aynı mühür görünür (sorun 4); başlık altında "Söz verdin: Elif, Mert".
- Izgaranın son satırı **ortalanır**; seçili portre büyür ve parlar, diğerleri söner. Tamam diyenler portre dışında,
  alt şeritte (sorun 11'deki ✓ karışıklığı biter).
- Söz verdiğin biri dışındakini seçince yalnız senin ekranında küçük satır: **"Elif'e söz vermiştin"** (uyarı değil,
  hatırlatma; seçim serbest).
- Başlıkta seçilen ad dev harflerle yazmaz: "Oyun hazır" + küçük ad; Tamam'dan sonra **"Oyun mühürlendi"** (göz
  atma koruması, sorun 11).

### IT-U4 · Oylama ekranı durum satırı — **önerim: EVET**
Oylamada başlık altında kısa durum: "Oyun: Elif · değiştirebilirsin" → Tamam'dan sonra "Mühürlendi · 3/5 hazır".
Oy hiç seçilmemişse son 5 sn'de "Oy vermezsen zar atılacak 🎲" (IT-M3 ile tutarlı). Bugün oy vermeyen oyuncu
oyunun rastgele gideceğini hiç görmüyor.

### 4b. Açılış / sonuç anı ve gerilim

### IT-U5 · "Oylar okunuyor": tek tek açılış — **önerim: EVET** · 🔊 Ses
Açılış bir yarışma programındaki oy okuma gibi olur (en az gösterim 8 sn → **3 + 0,9 × oyuncu sayısı sn**:
3 kişide 5,7, 8 kişide 10,2 sn):
- Ortada bir oy kartı açılır: **"Mert'in oyu…"** (0,4 sn bekleme) **"→ ELİF"**; kartın verenden hedefe uzanan
  **oklu** ipi çizilir, hedefin sayacı bir artar.
- Sıra: önce en az oy alanlara gidenler, en son lider(ler)e gidenler; lider eşitliği son karta kadar belli olmaz.
- Kart açılırken söz denetimi o anda yapılır: veren hedefe söz verdiyse **"SÖZ TUTULDU ✓"**; başka birine söz verip
  buna oy verdiyse **"İHANET!"** damgası ve ihanete uğrayanın portresi şaşkın yüz yapar (KURALLAR §16'daki tepki);
  🎲 oylarda "zar attı". İki söz verip birine oy veren için kart "SÖZ TUTULDU ✓" der, altında küçük "(Mert'e de
  söz vermişti)"; Mert'in portresine şaşkın yüz yine gelir.
- Bütün kartlar bitince halka tam görünüm: oklar, sayılar, ödüller (IT-M1 ile "+2/+1").

### IT-U6 · İttifak ve ihanet etiketleri — **önerim: EVET** · 🎨 Görsel
Açılışın son tablosunda:
- **Karşılıklı oy** veren ikililer arasında çift yönlü altın bağ ve **"İTTİFAK"** rozeti (sorun 8).
- Her söz verenin portresinin altında tek etiket (sorun 2'deki ✗ enflasyonunu çözer):
  - **"Sözünün eri"**: verdiği bütün sözleri tuttu (tek söz verip tuttu);
  - **"Çifte oyun"**: iki söz verdi, birini tuttu;
  - **"Hain"**: söz verdiği hiç kimseye oy vermedi (🎲 oyu olanlara verilmez, IT-M3);
  - söz vermeyenlerde etiket yok.
- Alttaki uzun söz listesi yerine bu etiketler; tam liste "Bütün sözler" düğmesiyle açılan alt sayfada.
- Başlık özeti: "2 ittifak · 1 hain · 3 çifte oyun".
- 🎨 İTTİFAK rozeti ve kırık mühür damgası (CSS ile de yapılabilir).

### IT-U7 · Kendi hikâyen kartı — **önerim: EVET**
Başlıktaki "+2 · 2 oy aldın" yerine (sorun 13):
- **"Sana oy verenler: Elif, Kaan"** (avatarlarıyla), oy yoksa "Kimse sana oy vermedi".
- **"Sana söz verenler: Elif ✓ · Mert ✗"** — alıcı, kendisine verilen sözleri ilk kez burada görür (O4 kuralı:
  sonuçta açılır). Bozan varsa adı kırmızı ve küçük kırık mühür.
- "Senin oyun: Elif · sözünü tuttun ✓" (söz verdiysen).
- IT-M1 ile genel skora giden ödül büyük: "+2 · en çok oy".

### IT-U8 · Son saniyeler — **önerim: EVET** · 🔊 Ses
- Pazarlığın son 10 sn'sinde sayaç kırmızıya döner ve büyür, tik sesi; masa kenarı kızarır; "Son 10 saniye ·
  sözler kilitleniyor".
- Pazarlık bitince 1 sn'lik geçiş: mühürler mumla kapanır, **"PAZARLIK BİTTİ · OYLAR GİZLİ"** bandı (masada
  konuşmayı kesen bir an; oylama süresi bandın ardından işler).
- Oylamanın son 5 sn'sinde süre çubuğu nabız atar, tik; Tamam demeyenin telefonu bir kez titrer.

### 4c. Telefon ergonomisi ve okunurluk

### IT-U9 · Küçük ekran ve yatay düzen — **önerim: EVET**
- 360x640'ta halka çapı ekran yüksekliğine göre küçülür, adlar portrenin altına sığar; "Sözler" başlığı ve
  etiketler halkaya binmez (bugün Kaan'ın adına biniyor).
- 8 kişide liste taşmaz: IT-U6 ile liste yerine portre etiketleri, tam liste alt sayfada.
- Yatay ekranda halka solda, başlık/hikâye/etiketler sağda; en alttaki portre düğmenin altında kalmaz (sorun 14).
- Portre dokunma alanı en az 56 px (söz koymak için hızlı dokunuş).

### IT-U10 · Pazarlıkta ekran koruması — **önerim: EVET**
Pazarlıkta telefonlar masada açık duruyor; söz mühürleri (yalnız sana görünür bilgi) yan taraftan okunabiliyor.
Masa görünümünde mühürler konduktan 3 sn sonra soluklaşır (yandan bakan hangi portrede olduğunu seçemez); alttaki
"Söz verdiklerin" şeridi de adları değil yalnız sayıyı gösterir ("2 söz"); şeride **basılı tutunca** mühürler ve
adlar tam görünür (portreye basılı tutmak IT-M7'ye ayrılmıştır). Oylama ekranındaki hatırlatma (IT-U3) da aynı:
adlar basılı tutunca. Bu madde onaylanmazsa IT-U1 ve IT-U3'teki adlar açık yazılır.
(Sızma'da onayladığın gözetleme korumasıyla aynı mantık.)

### 4d. İzleyici, kopan oyuncu ve TV

### IT-U11 · İzleyici ekranı — **önerim: EVET**
- Pazarlıkta: masa, büyük sayaç, "Oylamaya hazır: 3/5"; sahte bağ yok, söz bilgisi yok (gizli).
- Oylamada: "Oylar mühürleniyor · 4/5" ve mühürleyenlerin avatarları.
- Açılışta oy okuma tam ekran (IT-U5); izleyicinin kendi hikâye kartı yerine "En çok oy: Elif · 2 ittifak".
- Kopan oyuncu her ekranda "bağlantı yok" etiketiyle; IT-M2 ile oylanabilir. Geri dönünce: "Döndün · 23 sn kaldı ·
  söz işaretlerin duruyor".

### IT-U12 · İzleyici tahmini — **önerim: İSTEĞE BAĞLI**
İzleyici pazarlık boyunca bir portreye dokunup **"En çok oyu kim alır?"** tahmini bırakır (değiştirilebilir, oylama
başlayınca kilitlenir). Açılışta izleyicinin ekranında "Tahminin: Elif ✓". Puan yok, oyunculara görünmez. İzleyiciye
bir uğraş verir; isteğe bağlı çünkü izleyici sayısı çoğu oyunda 0–1.

### IT-U13 · TV ekranı — **önerim: EVET** · 🎨 Görsel
TV'ye özel yatay görünüm (`StageView`): ortada müzakere masası ve çevresinde büyük portreler, masanın ortasında dev
sayaç; solda oyuncu sütunu (ad, genel skor, "hazır" işareti). Oylamada mühürleyenler; açılışta oy okuma tam ekran:
kart ortada, oklar masada, İTTİFAK bağları ve İHANET damgaları büyük. Söz işaretleri ve oylar açılışa kadar TV'de
yok. 🎨 masanın 16:9 geniş hâli.

### 4e. Ses, titreşim ve hareket

### IT-U14 · Ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
Mühür basma "tak", mühür kırma "çıt", son 10 sn tik, pazarlık bitişi gong, oy kartı çevirme "kâğıt hışırtısı" (her
kartta), hedef sayacı "tık", **SÖZ TUTULDU** çan, **İHANET** cam çatlaması + kısa org akoru, **İTTİFAK** kristal
çınlama, kendi adın okununca kısa titreşim ve "ding". Müzik alanından: pazarlık için alçak, mırıltılı "entrika" döngüsü
(konuşmayı bastırmayacak düzeyde), oy okuma için davul rulosu.

### 4f. İlk kez oynayan için öğretme

### IT-U15 · Anlatım metni ve canlı örnek — **önerim: EVET** · 🎨 Görsel
- Adımlar (tek satırlık): 1 "Sesli pazarlık: oy iste, söz ver" · 2 "Tek gizli oy; kendine veremezsin" ·
  3 "Oylar tek tek okunur: kim sözünü tuttu?". IT-M1 ile amaç satırı: "En çok oyu topla!".
- Anlatım görseli 4 sn döngü: iki avatar konuşur → biri diğerine mühür basar → oy kartı açılır → "SÖZ TUTULDU" ya da
  "İHANET!".
- Pazarlığın ilk 3 sn'sinde herkese bir kez balon: "Portreye dokun: gizli söz işareti · yalnız sen görürsün";
  3 sn sonra ya da ilk dokunuşta kaybolur.

### 4g. Erişilebilirlik

### IT-U16 · Renk körü, hareket, yazı, ekran okuyucu — **önerim: EVET**
- Oklar yalnız verenin renginde değil, ihanet oyu **kesikli**, ittifak **çift çizgi**, 🎲 noktalı; etiketlerde ✓/✗
  ile birlikte yazı ("tuttu", "bozdu").
- Hareket azaltma: oy okuma kartları kayma/dönme olmadan sırayla belirir (sıra ve gerilim korunur), oklar anında
  çizilir.
- Büyük yazı: etiketler tek kelime, adlar en çok 8 harf + …; kendi hikâye kartı alt alta satırlara döner.
- Ekran okuyucu: oy okuma sırayla `aria-live` ile duyurulur ("Mert, Elif'e oy verdi. Söz tutuldu."); pazarlıkta
  söz koyma/kaldırma "Elif'e söz işareti kondu" diye.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### IT-AI1 · İhanet muhabiri — **önerim: EVET**
Oy okumanın sonunda tek cümlelik esprili yorum: "Oyuncu3 iki kişiye söz verdi, ikisini de bekletip oyunu üçüncüye
verdi; Oyuncu1 ile Oyuncu4'ün ittifakı ise taş gibi sağlam." Ortak yapay zekâ yorum altyapısıyla
(`aiCommentGames.ts`; API anahtarı bağlıyken açılır, hata olursa hiç görünmez, oyun beklemez, yasaklı kelime
süzgeci). Modele gerçek ad değil **Oyuncu1…N**, kim kime oy verdi (🎲 işaretli), sözler ve tutulup tutulmadığı,
ittifak ikilileri gider. Puanı yapay zekâ belirlemez. Bu oyun tamamen sosyal ihanet üstüne kurulu; yorumun en çok
malzemesi olan oyunlardan biri.

### IT-AI2 · Sesli pazarlığı dinleyip özetlemek — **önerim: HAYIR**
Mikrofonla masadaki pazarlığı dinleyip "kim ne vaat etti" özetini çıkarmak. Önermiyorum: mikrofon izni ve ses
kaydı gizlilik açısından ağır, gürültülü masada güvenilmez, ve oyunun zevki tam da uygulamanın bilmemesinde.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Görsel (🎨):** yuvarlak müzakere masası (üstten, gotik; IT-U1) ve 16:9 hâli (IT-U13); balmumu mühür tam ve
  kırık (IT-U2, IT-U6); İTTİFAK rozeti (CSS ile de olur); anlatım 4 karesi (IT-U15); karakterin "şaşkın" yüz
  ifadesi (avatar sisteminde yoksa küçük bir "!" balonu ile CSS karşılığı). Görev dosyası CLAUDE.md'deki akışla.
- **Ses efektleri (🔊):** mühür basma/kırma, kâğıt hışırtısı (2–3 varyasyon), sayaç tıkı, gong, çan, cam çatlaması
  + org akoru, kristal çınlama, son saniye tiki. Ses olay haritasında `ittifak.*` anları.
- **Müzik:** pazarlık için alçak "entrika" döngüsü (sözsüz, konuşmayı bastırmayan), oy okuma davul rulosu katmanı.
- **Efekt dokuları:** mühür damgası, cam çatlağı, altın bağ parıltısı.
- **İçerik havuzu:** yok (etiket metinleri sabit; değişirse sahip yazar).
- **Wiki/kurallar:** `docs/KURALLAR.md` §16 (O4 bölümü dahil), `docs/wiki/oyunlar/ittifak.json` (süre, puan).

---

## 7. Önerilen paket

**EVET:** IT-M1, IT-M2, IT-M3, IT-M4, IT-M5 · IT-U1 … IT-U11, IT-U13 … IT-U16 · IT-AI1.
**İSTEĞE BAĞLI:** IT-M6 (nabız yoklaması), IT-M7 (göz kırpma), IT-U12 (izleyici tahmini).
**HAYIR:** IT-M8 (söze puan), IT-AI2 (pazarlığı dinlemek).

Bu paketle oyun şöyle akar: anlatım "Oylar tek tek okunur" der → müzakere masasında (3–4 kişide 45, 7–8 kişide
75 sn) sesli pazarlık; söz verdiğin portreye mühür basarsın, yalnız sen görürsün → son 10 sn kırmızı, "PAZARLIK
BİTTİ" gongu → oylamada mühürler hatırlatır ("Elif'e söz vermiştin") → oylar tek tek okunur: "Mert'in oyu… ELİF!",
SÖZ TUTULDU çanı ya da İHANET damgası ve şaşkın yüz → son tabloda İTTİFAK bağları, "Hain / Çifte oyun / Sözünün eri"
etiketleri, kendi hikâye kartın ("Sana söz verenler: Elif ✓ · Mert ✗") → en çok oy +2, ikinci +1.

**Değişen kurallar (paket onaylanırsa):**
- Genel skor: alınan oya göre +2 / +1 / 0 (birincide eşitlik hepsi +2; herkes eşitse herkes +1; 0 oy ödülsüz).
- Kopan katılımcıya da oy verilebilir.
- Rastgele atanan oylar açılışta 🎲 ile işaretli (söz denetimi O4'teki gibi yine sayar).
- Pazarlık 3–4 kişide 45 sn, 5–6 kişide 60 sn, 7–8 kişide 75 sn.
- Söz işareti sınırı 3–4 kişide 1, 5–8 kişide 2.
- Açılış en az 3 + 0,9 × oyuncu sayısı sn; pazarlık sonunda 1 sn'lik geçiş bandı (oylama süresi ardından işler).
`docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu; uygulamada teklif/anlaşma nesnesi olmaması; sözlerin yalnız sözü verene görünmesi
(alıcı dahil, sayısı bile) ve sonuçta açılması; sözün puansız ve bağlamaz olması; tek gizli oy, kendine oy yok;
oylama 15 sn ve Tamam; vermeyenin oyunun rastgele atanması; erken bitişler; eksi puan olmaması; oylar açılana kadar
kimsenin sayı görmemesi.

**🎨 Yeni görsel gerekenler (paket):** müzakere masası (telefon + 16:9), balmumu mühür (tam/kırık), İTTİFAK rozeti,
anlatım kareleri, şaşkın yüz (yoksa CSS karşılığı). Dosyalar gelene kadar CSS/SVG karşılıkları çizilir.
