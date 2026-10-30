# Bozuk Telefon — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **BT-M2**). Cevabını tek satırda verebilirsin:

> BT-M1 evet, BT-M2 hayır, BT-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn). Yeni görsel gerektiren maddeler **🎨 Görsel**
diye işaretli.

---

## 1. Bugünkü oyun (özet)

- 3–8 oyuncu. Herkes bir cümle yazar ve kendi zincirini başlatır. Zincirler her adımda el değiştirir:
  yaz (25 sn) → çiz (60 sn) → yaz → çiz …, en çok 6 adım. Herkes yalnız bir önceki adımı görür.
- Sonunda her zincir sırayla açılır (adım başına 3 sn). Ardından 10 sn oylama: "en komik adım" (kendi adımına oy
  yok). 3 sn zincir sonucu.
- Puan: aldığın her oy +1. Zincir "sağlam" kalırsa (ilk cümle ile son yazı yarı yarıya aynı kelimeler) o zincirde
  adımı olan herkes +1.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Oyun çok uzun.** 6 oyuncuda yazma/çizme kısmı ~4,5 dakika, ardından her zincir için gösteri (18 sn) + oylama
   (10 sn) + sonuç (3 sn) = 6 × 31 sn ≈ 3 dakika daha. Toplam 7–8 dakika; maçtaki diğer oyunlar 1–2 dakika.
2. **Oylar arkadaşlığa kayıyor.** Oylamada her kartta yazarın avatarı görünüyor; insanlar çoğu zaman en komiğe değil
   en yakın arkadaşına oy veriyor.
3. **Puan aralığı çok geniş.** Oy başına +1 olduğundan 8 kişide bir oyuncu tek oyunda +8'e çıkabilir; diğer
   oyunlar en çok +2 veriyor. Bu oyun genel sıralamayı tek başına belirleyebilir.
4. **İlk cümle anı tıkanıyor.** Boş bir kutuya "komik bir cümle yaz" demek çoğu kişiyi donduruyor; zincir zayıf
   başlıyor.

**Arayüz**
5. **Gösteri bir ızgara, hikâye değil.** Zincir küçük kartlar ve "?" kutularıyla açılıyor. Bu oyunun en eğlenceli
   anı olan "cümle nasıl bu hâle geldi" akışı, okunması zor bir tabloya dönüşüyor.
6. **Kelime ortadan bölünüyor:** "DEV KAPLUMBAĞ / A BİSİKLET SÜRÜYOR". Uzun kelimeler kartta hecesiz kırılıyor.
7. **Çizim gösteride bir anda beliriyor.** Çizimin çizilişini görmek (kim nereden başladı, neyi sildi) oyunun en çok
   güldüren kısmı olabilirdi.
8. **Komik zincir saklanamıyor.** Gecenin en komik zincirini telefona kaydetmenin ya da paylaşmanın yolu yok.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### BT-M1 · Daha hızlı akış — **önerim: EVET**
**Ne:** Süreler kısalır, gösteri ve oylama birleşir.
**Ayrıntılar:**
- Yazma 25 sn → **20 sn**; çizme 60 sn → **45 sn** (erken bitiş aynen: herkes Tamam derse 1 sn sonra).
- Adım sayısı en çok 6 → **en çok 5** (7–8 kişide de 5 adım).
- Gösteride adım aralığı 3 sn → **2 sn**.
- **Oylama gösteri sırasında açılır:** zincirin son adımı görünür görünmez oy verilebilir; zincir başına oylama
  10 sn → **6 sn**, sonuç 3 sn → **2 sn**.
- 6 oyuncuda toplam süre ~7,5 dakikadan **~5 dakikaya** iner.

### BT-M2 · İsimsiz oylama — **önerim: EVET**
**Ne:** Oylamada kartlarda yazarın avatarı ve adı **görünmez**; oylama bitince açılır.
**Neden:** Sorun 2. Oy, komikliğe gider. Kendi adımına oy verme engeli aynen kalır (sistem bilir, sana o kart
soluk görünür).
**Ayrıntılar:** gösteri sırasında da yazar gizlidir; sonuçta her kartın yazarı avatar ve adla açılır ("Bu çizim
Mert'inmiş!" anı).

### BT-M3 · Puanı sıralamaya çevir — **önerim: EVET**
**Ne:** Oylar ve sağlam zincir puanı bugünkü gibi toplanır (oyun içi **"kahkaha puanı"**). Oyun sonunda mini oyun
puanı bu toplama göre verilir: **en yüksek +2, ikinci +1, diğerleri 0.**
**Neden:** Sorun 3. Diğer oyunlarla aynı aralık (0…+2); eksi puan yok.
**Ayrıntılar:** birincide eşitlik varsa hepsi +2, sonraki farklı toplam +1; toplamı 0 olan ödül almaz; herkesin
toplamı aynı ve 0'dan büyükse herkes +1. Kahkaha puanı ekranda görünmeye devam eder.

### BT-M4 · Kör çizim — **önerim: HAYIR (isteğe bağlı)**
**Ne:** Her zincirde rastgele bir çizim adımı "kör" olur: çizdikçe çizgiler 1 sn sonra kaybolur, çizen ne çizdiğini
göremez.
**Neden:** Çok komik sonuçlar doğurur.
**Neden önermiyorum:** Çizen kişi için sinir bozucu olabilir ve zinciri çok erken koparır; M1–M3 ile oyunu önce
yeni hâliyle oynamak daha iyi. İstersen ilk denemede açarız.

---

## 4. Arayüz ve his önerileri

### BT-U1 · Hikâye gibi açılış + çizimin yeniden çizilmesi — **önerim: EVET**
- Gösteri, ızgara yerine **dikey bir hikâye akışı** olur (mesajlaşma gibi): her adım büyük kart olarak aşağıdan
  kayarak gelir, ekran otomatik kaydırır.
- **Çizimler çizilişleriyle oynatılır:** darbeler, çizildiği sırayla ve hızlandırılmış olarak (en çok 1,5 sn'de)
  ekranda yeniden çizilir. Silinen/geri alınan darbeler gösterilmez.
- Yazı adımları daktilo efektiyle yazılır.
- Her kartın altında küçük ok: "… sonra şuna dönüştü".

### BT-U2 · Kelime bölünmesi düzeltmesi — **önerim: EVET**
Kartlardaki yazılar kelime ortasından kırılmaz; uzun cümlede yazı boyutu kendiliğinden küçülür (kartın içine sığana
kadar). Tüm ekranlarda (yazma, gösteri, oylama, sonuç, TV) aynı kural.

### BT-U3 · Çizim tahtası iyileştirmesi — **önerim: EVET**
- Renk sayısı 6 → **10** (kırmızı, mor, kahverengi, gri eklenir).
- Kalınlık seçeneği 3 → 4 (çok kalın eklenir), seçili kalınlık kalemin ucunda önizlenir.
- Tuval ekrana sığan en büyük kare olur (bugün kenarlarda boşluk kalıyor).
- "Temizle" yine iki dokunuşla.

### BT-U4 · İlk cümle ekranı — **önerim: EVET** · 🎨 Görsel
- Boş ortada büyük bir **eski telefon / telefon kulübesi** çizimi; kutudaki örnek metin bugünkü gibi tek örnek
  kalır ("Örn. Kedi uzayda pizza yiyor").
- Yazdığın cümle, telefon kablosundan **sıradakine gidiyormuş** gibi küçük bir animasyonla "gönderilir".
- 🎨 Gereken: eski telefon / telefon kulübesi illüstrasyonu.

### BT-U5 · Oylama ekranı — **önerim: EVET**
- Kartlar büyük; bir karta dokununca tam ekran büyür (çizimi rahat görmek için), oradan "😂 EN KOMİK BU".
- Oy verince kartın üstüne "😂" damgası düşer.
- (BT-M2 ile) yazarlar gizli.

### BT-U6 · Zincir sonucu — **önerim: EVET**
- En çok oy alan adım **👑 "EN KOMİK"** tacıyla büyür; oylar karta 😂 yığını olarak düşer.
- Sağlam zincirde ilk ve son cümle yan yana getirilir ve aralarında **zincir halkası** kilitlenme animasyonu:
  "SAĞLAM ZİNCİR · herkese +1".
- (BT-M2 ile) yazarlar bu anda açılır.

### BT-U7 · Gecenin en komikleri + zinciri kaydet — **önerim: EVET**
- Tüm zincirler bitince kısa bir **"Gecenin en komikleri"** galerisi: her zincirin taçlı adımı yan yana.
- Her zincirin altında **"Zinciri kaydet"** düğmesi: zincirin tamamı tek uzun bir görsel (PNG) olarak telefona
  indirilir ya da paylaşım menüsüyle gönderilir. Görsel telefonda oluşturulur, sunucuya bir şey gitmez.

### BT-U8 · Ses ve titreşim seti — **önerim: EVET**
Kalem sürtünmesi (çizerken hafif), kâğıt kayması (adım geçişi), daktilo (yazı açılırken), çizim yeniden çizilirken
kalem sesi, oyda kahkaha efekti, sağlam zincirde zincir şakırtısı.

### BT-U9 · TV ekranı — **önerim: EVET**
TV'de gösteri tam ekran hikâye akışı (çizimler büyük ve yeniden çizilerek); oylama sırasında kartlar ızgarada,
kimin oy verdiği sayaçla; sonuçta taç ve zincir animasyonu.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### BT-AI1 · "İlham ver" düğmesi — **önerim: İSTEĞE BAĞLI**
**Ne:** İlk cümle ekranında "💡 İlham ver" düğmesi: yapay zekâ o an 3 komik, çizilebilir cümle önerir; birine
dokunursan kutuya yazılır (istersen değiştirirsin).
**Neden:** Sorun 4. Donup kalanlar için.
**Ayrıntılar:** havuz değildir, her basışta anlık üretilir; hiçbir yerde saklanmaz. Yasaklı kelime süzgeci; hata
olursa düğme "Şu an ilham yok" der. Kişi başı oyun başına en çok 3 basış.

### BT-AI2 · Sağlam zinciri anlamca değerlendir — **önerim: İSTEĞE BAĞLI**
**Ne:** "Sağlam zincir" kararı bugün kelime eşleşmesiyle veriliyor; "UZAYDA PİZZA YİYEN KEDİ" ile "KEDİ UZAYDA
PİZZA YİYOR" tutuyor ama "Astronot kedi yemek yiyor" tutmuyor. Yapay zekâ ilk ve son cümlenin **aynı anlama** gelip
gelmediğine karar verir.
**Dikkat:** Bu, puanı (+1) yapay zekânın etkilediği tek öneri. Yapay zekâ yanıt vermezse bugünkü kelime kuralı
kullanılır. İstemezsen bugünkü kural kalır.

### BT-AI3 · Zincir anlatıcısı — **önerim: İSTEĞE BAĞLI**
Her zincirin sonucunda tek cümlelik esprili yorum: "Kedi uzaya pizza yemeye gitti, iki el sonra bisikletli bir
kaplumbağa olarak döndü." Ortak yorum altyapısıyla (hata olursa görünmez, oyun beklemez).

---

## 6. Önerilen paket

**BT-M1, BT-M2, BT-M3 ve BT-U1 … BT-U9 hepsi.** (BT-M4 ve yapay zekâ maddeleri pakete dahil değil.)

Bu paketle oyun şöyle akar: ilk cümle telefon kablosundan sıradakine gider → daha kısa yazma/çizme adımları →
gösteride zincir bir hikâye gibi akar, çizimler gözünün önünde yeniden çizilir, yazarlar gizli → oy, son adım
görünür görünmez → taç, 😂 yığını, yazarlar açılır → sonda "Gecenin en komikleri" ve "Zinciri kaydet".

**Değişen kurallar (paket onaylanırsa):** yazma 20 sn, çizme 45 sn, en çok 5 adım, gösteri adımı 2 sn, oylama 6 sn
(son adım görününce açılır), sonuç 2 sn; oylamada yazarlar gizli; mini puan kahkaha puanına göre +2/+1/0.
`docs/KURALLAR.md`, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 3–8 oyuncu, zincir döngüsü, yalnız bir önceki adımı görme, kendi adımına oy yok, oy başına +1
ve sağlam zincir +1 (kahkaha puanı olarak), 60 karakter sınırı, büyük harf, çizim sınırları.

**🎨 Yeni görsel gerekenler (paket):** eski telefon / telefon kulübesi illüstrasyonu (ilk cümle ekranı).
