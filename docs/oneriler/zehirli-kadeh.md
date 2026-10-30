# Zehirli Kadeh — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **ZK-M1**). Cevabını tek satırda verebilirsin:

> ZK-M1 evet, ZK-M2 hayır, ZK-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Önceki kararlarına uyum: **eksi puan yok** (en düşük 0), sonuç ekranı herkes **"Devam et"** deyince geçer (en çok
60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel** diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 2–8 oyuncu, herkesin önünde bir kadeh. Bazıları zehirli (2–3 kişide 1, 4–5'te 2, 6–8'de 3).
- **Kimse hiçbir kadehin zehirli olup olmadığını bilmez**, kendi kadehi dahil.
- Herkesin **tek takas hakkı** var: bir arkadaşının kadehiyle kendininkini değiştirir. Takaslar herkese açık.
- 20 sn, her takas +5 sn. Süre bitince temiz kadeh +1, zehirli 0.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Oyun tamamen yazı-tura.** Kimse hiçbir şey bilmediği için takas etmek ile etmemek arasında hiçbir fark yok:
   her kadeh aynı olasılıkla zehirli. Takas bir karar değil, rastgele bir hareket. Oyuncunun yaptığı hiçbir şey
   sonucu "akıllıca" değiştiremez.
2. **Blöf ve okuma yok.** Takaslar herkese açık ama bir anlamı yok; kimin neden takas ettiğinden bir şey
   çıkarılamaz, çünkü takas edenin de bilgisi yok.
3. **Gerilim yalnız sonda ve o da kısa.** Ortadaki büyük süre halkasına bakarak beklemekten başka bir şey yok.

**Arayüz**
4. **Asıl sahne olan kadehler küçük ve ekranın altına sıkışmış;** ekranın yarısını sayaç kaplıyor.
5. **Takas hissi zayıf.** Seçili kadeh zor seçiliyor (ince çerçeve), takas anı tek satır yazı.
6. **Sonuç açılışı yok denecek kadar kısa:** ekran doğrudan genel puan sahnesine geçiyor; kadehler orada küçük bir
   satır olarak görünüyor. "Kim zehri içti?" anı yaşanmıyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### ZK-M1 · Kendi kadehini bil: "Zehri başkasına geçir" — **önerim: EVET**
**Ne:** Oyun başında **herkes yalnız kendi kadehinin** zehirli olup olmadığını gizlice görür. Takasla eline yeni
kadeh geçerse onun durumunu da hemen (yalnız sen) görürsün. Başkalarının kadehlerini kimse görmez.
**Neden:** Sorun 1 ve 2'yi kökten çözer. Oyun "sıcak patates"e döner:
- Zehirli kadehi olan, onu birine geçirmek ister.
- Temiz kadehi olan, takas hakkını **savunma** için saklar: biri ona zehir geçirirse geri kaçırabilir.
- Herkes takasları izleyip çıkarım yapar: "Mert ilk saniyede takas etti, demek zehirliydi, şimdi Elif'te zehir var."
- Blöf doğar: temiz kadehi olan biri, zehirliymiş gibi davranıp takas ederek kafa karıştırabilir.
**Ayrıntılar:**
- Kendi kadehinin durumu yalnız senin kişisel görünümünde; ortak görünümde, izleyicide ve TV'de yine yok.
- Takas hakkı yine kişi başı 1; hedef olmak hakkını harcamaz (bugünkü gibi).
- Zehirli kadeh sayısı herkese açık (bugünkü gibi).
- Puan değişmez: süre sonunda temiz +1, zehirli 0.
- Bugünkü "herkes takas ettiyse 1 sn sonra biter" kuralı aynen kalır.

### ZK-M2 · Koklama (ZK-M1'in alternatifi) — **önerim: HAYIR (M1 seçilmezse EVET)**
**Ne:** Kendi kadehin yerine, oyun başında **rastgele bir başka oyuncunun** kadehini gizlice koklarsın (zehirli mi
değil mi öğrenirsin). Kendi kadehini yine bilmezsin.
**Neden:** Bilgi yine oyuna girer ama dolaylı: "Kaan'ın kadehi temiz, onunla takas edeyim" ya da "Elif'inki
zehirli, ona söylemeyeyim, belki biri onunla takas eder". Konuşma ve yalan söyleme anı yaratır.
**Neden M1'i öneriyorum:** M1 daha basit anlaşılır ("benimki zehirli, kurtulmalıyım") ve her oyuncuya bir hedef verir.
M2'de oyuncuların yarısı yine kendi kaderini bilmeden oynar. İkisi birlikte açılmaz.

### ZK-M3 · Altın kadeh — **önerim: EVET**
**Ne:** 4 ve üstü oyuncuda zehirli kadehlerin yanında **bir altın kadeh** olur: süre sonunda elinde altın kadeh olan
**+2** alır. Altın kadeh de yalnız sahibine görünür (ZK-M1 ile).
**Neden:** Temiz oyuncuya da bir "kaybedecek şey" verir. Altın kadeh sahibi takas edilmekten korkar, sessiz durmaya
çalışır; zehirliler de "belki altın kadehe denk gelirim" diye takas eder. Oyuna açgözlülük katmanı ekler.
**Ayrıntılar:**
- 2–3 oyuncuda altın kadeh yok (zaten 1 zehir var, denge bozulmasın).
- Altın kadeh zehirli olamaz; zehir sayısı bugünkü gibi kalır.
- Puanlar: altın +2, temiz +1, zehirli 0. Eksi yok.
- Maç kartlarında "birinci" = en yüksek puanı alanlar (altın varsa yalnız altın sahibi; yoksa tüm temizler).

### ZK-M4 · Son yudum: takaslar son 5 sn'de gizlenir — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Son 5 saniyede yapılan takaslar kimin kiminle takas ettiğini göstermez ("Biri takas etti!" yazar), sonuçta
açılır.
**Neden:** Son anda kaos ve "kim bana geçirdi?!" anı.
**Neden önermiyorum:** M1 ile oyunun asıl zevki takasları okuyup çıkarım yapmak; son 5 saniyeyi körleştirmek
bu zevki tam en heyecanlı anda alır. Oynandıktan sonra gerekirse eklenir.

### ZK-M5 · Kurallar ve kodun eşitlenmesi — **önerim: EVET**
Bugün kodda olup kural dosyasında yazmayan iki şey kurala eklenir: takas hedefinin o anda bağlı olması şartı ve
"herkes takas ettiyse son takastan 1 sn sonra biter" davranışı. (Oyun değişmez, yalnız belge.)

---

## 4. Arayüz ve his önerileri

### ZK-U1 · Ziyafet masası sahnesi — **önerim: EVET** · 🎨 Görsel
- Ekranın ortasında **uzun bir ziyafet masası**, kadehler masanın üstünde **büyük**; her kadehin arkasında sahibinin
  avatarı ve adı.
- Bugünkü dev süre halkası küçülür ve ekranın üstüne **yanan bir mum** olarak taşınır (mum eriyerek kalan süreyi
  gösterir; her takasta mum biraz uzar ve alev parlar).
- Seçili kadeh belirgin: kadeh hafifçe yükselir, altında amber halka, üstünde ok.
- 🎨 Gereken: ziyafet masası arka planı, mum (eriyen 3–4 aşama ya da tek görsel + CSS kırpma).

### ZK-U2 · Kendi kadehin önde (ZK-M1 ile) — **önerim: EVET** · 🎨 Görsel
- Kendi kadehin ekranın altında **büyük ve önde** durur. İçindeki sıvı yalnız sana görünür:
  - **Zehirli:** yeşil-mor köpüren sıvı, üstünde kabarcıklar ve hafif duman, "Kadehin zehirli! Birine geçir."
  - **Temiz:** berrak kırmızı şarap, "Kadehin temiz. Takas hakkını sakla."
  - **Altın (ZK-M3):** parlayan altın sıvı, "Altın kadeh! Kimse almasın."
- Durum değişince (biri seninle takas edince) sıvı değişimi animasyonla olur ve telefon titrer.
- Kenarda küçük "Yalnız sen görüyorsun 👁" etiketi (masadakiler görmesin diye ekranı kapatma hatırlatması).
- 🎨 Gereken: kadeh görseli 3 sıvı durumuyla (boş kadeh + ayrı sıvı katmanı olarak da üretilebilir).

### ZK-U3 · Takas anı — **önerim: EVET**
- Takasta iki kadeh masanın üstünden **yay çizerek yer değiştirir**, kadeh tıngırtısı sesi.
- Ekranın üstünde büyük bir an şeridi: "**Mert ⇄ Elif**" (2 sn), ardından masanın altındaki **takas geçmişine**
  ok olarak eklenir (Mert → Elif).
- Takas hakkını kullananın avatarının üstünde küçük "kullandı" işareti; hakkı duranlarınkinde parlayan bir takas
  simgesi (kimin hâlâ "savunması" olduğu herkesçe bilinir, çıkarımı besler).

### ZK-U4 · Sonuç: "Şerefe!" açılışı — **önerim: EVET**
Genel puan sahnesine geçmeden önce oyunun kendi açılışı oynar:
1. **Şerefe (0–1,5 sn):** tüm kadehler kalkar, ortada kadeh tokuşturma, "Şerefe!" sesi.
2. **Tek tek açılış (1,5 sn–):** kadehler rastgele sırayla tek tek açılır. Zehirli kadehte avatar yeşile döner, mor
   duman ve öksürük sesi, "0". Temiz kadehte altın parıltı, "+1". Altın kadehte büyük parlama, "+2".
3. Kendi kadehin en son açılır (gerilim), başlık "Kadehin temiz!" / "Zehri sen içtin!" olur.
4. Takas geçmişi altta oklarla kalır: kim zehri kime geçirdi herkes görür ("Mert zehri Elif'e geçirmiş!").
- Süre: genel karara bağlı ("Devam et" ile geçilir, en çok 60 sn).

### ZK-U5 · Son 5 saniye gerilimi — **önerim: EVET**
Mum titrer ve kısalır, kalp atışı sesi, her saniye hafif titreşim, masa hafifçe kararır.

### ZK-U6 · İzleyici ve TV — **önerim: EVET**
Ziyafet masası büyük; takaslar canlı yay animasyonuyla; takas geçmişi okları. Zehir/altın bilgisi yine **sonuca
kadar gösterilmez**.

### ZK-U7 · Ses ve titreşim seti — **önerim: EVET**
Kadeh tıngırtısı (takas), kaynayan zehir (zehirli kadeh elindeyken hafif fon), şerefe, öksürük, altın parıltı,
mum cızırtısı, son 5 sn kalp atışı.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### ZK-AI1 · Saray kâhini yorumu — **önerim: İSTEĞE BAĞLI**
Oyun sonunda tek cümlelik esprili özet: "Mert zehri üç saniyede Elif'e geçirdi, Elif hâlâ neden öksürdüğünü
anlamadı." Kontrol Paneli'ndeki bomba uzmanı yorumuyla aynı altyapı (API anahtarı bağlanınca açılır; hata olursa
yorum görünmez, oyun beklemez, yasaklı kelime süzgeci). Modele yalnız takas geçmişi ve sonuç gider.

---

## 6. Önerilen paket

**ZK-M1, ZK-M3, ZK-M5 ve ZK-U1 … ZK-U7 hepsi.** (ZK-M2, M1'in alternatifidir; M4 ve yapay zekâ pakete dahil değil.)

Bu paketle oyun şöyle akar: herkes kendi kadehine gizlice bakar → zehirliler hemen geçirecek kurban arar, temizler
susar, altın kadehli dua eder → ilk takaslar başlar, masada "sen zehirliydin!" suçlamaları → takası alan zehri
görür ve hakkı varsa geri kaçırır → son 5 saniye mum titrer → "Şerefe!" ve kadehler tek tek açılır.

**Değişen kurallar (paket onaylanırsa):** herkes kendi kadehinin durumunu görür (yalnız kendisi); 4+ oyuncuda bir
altın kadeh (+2); kural dosyası kodla eşitlenir. `docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu, zehir sayıları, tek takas hakkı, takasların herkese açık olması, 20 sn + takas başına
5 sn, temiz +1 / zehirli 0, eksi puan yok.

**🎨 Yeni görsel gerekenler (paket):** ziyafet masası arka planı, mum, kadeh (boş) + 3 sıvı katmanı (zehir, şarap,
altın), zehirlenmiş avatar efekti için duman (CSS ile de yapılabilir).
