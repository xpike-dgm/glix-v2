# Çizgiyi Geçme — geliştirme önerileri

Bu dosya onay içindir. Her maddenin bir kodu var (ör. **CZ-M2**). Madde öneki **CZ** (Çizgiyi Geçme; CG Çağrışım
Ağı'nda kullanıldığı için CZ). Cevabını tek satırda verebilirsin:

> CZ-M1 evet, CZ-M2 hayır, CZ-U3 evet …

ya da yalnız **"önerilen paket evet"** dersen sondaki paket uygulanır. Her maddenin "Ayrıntılar" bölümü onaylarsan
nasıl yapılacağını kesinleştirir; ek soru sormam gerekmez. Beğenmediğin ayrıntı varsa yalnız onu yaz.

Not: Sonuç ekranı herkes **"Devam et"** deyince geçer (en çok 60 sn); bu zaten var, burada yeniden önerilmiyor.
Yeni görsel gerektiren maddeler **🎨 Görsel**, ses alanına iş açan maddeler **🔊 Ses** diye işaretli (sesleri ses
yapay zekâsı üretir; dosya gelene kadar bugünkü sentez sesleri çalar).

---

## 1. Bugünkü oyun (özet)

Koddan doğrulandı (`packages/engine/src/games/cizgiyi-gecme/`, `apps/client/src/games/cizgiyi-gecme/`; O12 değişikliği
uygulanmış hâli).

- 2–8 oyuncu, **tek tur**. Herkes gizlice 0–100 arası bir tam sayı ("pin") seçer; seçim **30 sn**, sonuç 7 sn.
- 0–100 yolu oyuncu sayısına göre genişlikte **platformlara** bölünür: 2→25, 3→14, 4→10, 5→7, 6→6, 7→5, 8→4 (bölge
  = ⌊sayı ÷ genişlik⌋). Son platform genişliğe göre değişiyor: 2, 4, 7, 8 kişide **100 tek başına**, 3 ve 5 kişide
  **98–100**, 6 kişide **96–100**.
- Aynı platforma iki ya da daha fazla kişi düşerse **hepsi pasif** (puan yok, ceza yok). Seçmeyen pasif.
- Tek kalanların **en yükseği +2, ikincisi +1**; diğer tek kalanlar 0. Puan doğrudan genel skora gider. Eşitlik yok
  (tek kalanlar farklı platformlarda).
- Herkes Tamam derse 1 sn sonra biter.
- Ekran: üstte "GİZLİ PİNİN · PLATFORM GENİŞLİĞİ N", büyük sayı, "X–Y platformundasın"; ortada platform kulesi (üstte
  100), pin avatarın seçtiğin platformda; altta kaydırma çubuğu (ilk dokunuşta 50'den başlar) ve −10/−1/+1/+10, Tamam.
  Sonuçta pinler platformlara iner (1,7 sn), aynı platformdakiler söner, tek kalanlar yükselir (3,2 sn), puan (4,4 sn).
  TV'de özel görünüm yok.

## 2. Gördüğüm sorunlar

**Oyun tasarımı**
1. **Tek atış, bilgi sıfır: sonuç büyük ölçüde şans.** 30 sn boyunca hiçbir bilgi gelmiyor; kimin nereye gideceğini
   tahmin etmenin dayanağı yok. Çarpışma olasılığı %25 hesabı (O12) seçimlerin **düzgün dağıldığı** varsayımına
   dayanıyor; gerçekte herkes yükseğe gider (botlar bile çoğunlukla 50–99 seçiyor), üst platformlarda çarpışma çok
   daha sık, alttakiler ise neredeyse hep tek. "Biraz aşağıda kal" tek optimal stratejiye dönüşüyor.
2. **30 sn ölü süre.** Seçim birkaç saniyede bitiyor; geri kalan 25 saniye kimse bir şey yapmıyor, masada konuşacak
   konu da yok (kimse bilgi vermeyeceği için).
3. **"Tek kaldım ama 0" kötü hissettiriyor.** 8 kişide çoğu tek kalan 0 alıyor ve ekranda çarpışanla aynı sönük
   görünüyor; "kurtuldum" ile "elendim" ayırt edilmiyor.
4. **Son platform tutarsız.** 100 bazen tek başına bir "zirve" (2, 4, 7, 8 kişi), bazen 98–100 ya da 96–100 içinde.
   Oyuncu "100 ayrı mıydı?" diye her seferinde kulenin tepesine bakmak zorunda; 100 en doğal odak noktası olduğu için
   bu fark sonucu doğrudan etkiliyor.
5. **Adı ve oyun uyuşmuyor.** Adı "Çizgiyi Geçme" ama oyunda geçilmeyecek bir çizgi yok; risk "kalabalık", çizgi değil.
   Arka planda damalı bir bitiş kapısı var ama oyunda karşılığı yok.
6. **2 kişide oyun incecik.** İki kişi aynı platforma düşmezse (%75) biri +2, öteki +1 alır; tek gerçek risk %25'lik
   çarpışma. Düşük sayı yazan neredeyse hep +1 alıyor.

**Arayüz (ekran görüntülerine bakarak: 390×844, 360×640, 844×390, 2/5/6/8 oyuncu, izleyici)**
7. **8 kişide kule okunmuyor.** Genişlik 4'te 26 platform var; 390×844'te satırlar ~12 px, 360×640'ta ~7 px, etiketler
   yalnız her üç platformda bir ("96–99, 84–87…"). Kendi platformunu ancak üstteki yazıdan okuyabiliyorsun; kule bir
   çizgili desen gibi duruyor.
8. **Pin kuleyle değil çubukla seçiliyor.** Asıl görsel (kule) dokunulmaz; sayıyı alttaki ayrı bir çubuk ve düğmelerle
   seçiyorsun, göz ikisi arasında gidip geliyor. Çubuk ilk dokunuşta 50'den başlıyor: aceleci oyuncular 50 civarında
   kalıyor (çapa etkisi).
9. **"Platform genişliği 7" teknik ve soyut.** Oyuncu için anlamı "her platform 7 sayı"; ama hangi sayıların yan
   platforma geçtiği (48 mi 49 mu) ancak kuleye bakıp çıkarılıyor.
10. **Sonuçta ekranın %60'ı boş.** 5 kişide yalnız 4 dolu platform görünüyor, boş platformlar gizlendiği için **yükseklik
    hissi kayboluyor**: 12 ile 72 arasındaki mesafe ekranda 12 ile 38 arasındakiyle aynı.
11. **Sonuçta adlar yok, sönenler tanınmıyor.** Çiplerde yalnız avatar ve sayı; çarpışanların avatarı soluklaştırıldığı
    için kim olduğu seçilmiyor (kalabalık örnekte beş sönük avatar).
12. **Sayılar açılışın ilk anında belli.** Pinler "iniyor" derken çiplerin üstünde bütün sayılar zaten yazıyor; ilk
    bakışta kimin tek kaldığı görülüyor, 1,7 sn'lik "söndü" anı sürpriz değil.
13. **Kilitten sonra ekran aynı.** Tamam'dan sonra kule ve sönük çubuk yerinde; "X–Y platformunda kesinleştin" küçük
    yazı. 25 sn bakacak bir şey yok.
14. **Yatay ekranda üst yazı iki satıra kırılıyor** ("GİZLİ PİNİN · / PLATFORM GENİŞLİĞİ 6") ve oyun adı "Çizgiyi /
    Geçme" bölünüyor; kule dar bir sütun.
15. **Anlatımda örnek yok;** "aynı bölgeye düşen elenir" doğru ama 5 kişide bölgelerin 0–6, 7–13… olduğu ve "tek kalıp
    üçüncü olan 0 alır" bilgisi yok. TV'de özel düzen yok; izleyici telefon ekranı küçültülüp gösteriliyor.

---

## 3. Oyunu değiştiren öneriler (mekanik)

### CZ-M1 · İki tur: keşif ve final — **önerim: EVET**
**Ne:** Oyun **iki tur** olur. Her tur aynı platform düzeniyle oynanır ve sonunda herkesin pini açılır. Tur puanları
(+2 / +1) toplanır; oyun sonunda toplamı en yüksek **+2**, ikinci **+1** genel puan alır.
**Neden:** Sorun 1 ve 2. İlk turdan sonra masa herkesin eğilimini görür: "Elif 95'e gitti, Mert hep ortada" — ikinci
tur şans değil, insan okuma olur ("bu sefer Elif yine tepeye gider, ben bir altına…"). Geçen turu bilmek tek optimal
stratejiyi de kırar: herkesin "biraz aşağı" gittiğini gören tekrar yukarı çıkar.
**Ayrıntılar:**
- Süre: her tur **15 sn** seçim (CZ-M2), 1. turdan sonra **5 sn** kısa açılış, 2. turdan sonra **7 sn** açılış ve
  ortak "Devam et". Toplam en çok 15 + 5 + 15 + 7 = **42 sn** (bugün 37 sn). Erken bitiş tur başına (son Tamam'dan 1 sn
  sonra; sonraki tur o kadar öne çekilir).
- Genel ödül ortak sıralama kuralıyla (`rankAwards`, yalnız toplamı 0'dan büyükler): tek lider +2, sonraki toplamı
  paylaşanların hepsi +1; **liderler eşitse hepsi +1**, ikinci ödül yok. Eksi yok.
- 2 kişide örnek: 1. tur A +2, B +1; 2. tur B +2, A +1 → 3–3 eşit → ikisi de +1.
- Seçim her turun başında boşalır. Seçmeyen o turda pasif.
- Platform genişliği iki turda aynı.

### CZ-M2 · Seçim süresi 30 sn → 15 sn — **önerim: EVET**
**Ne:** Bir turun seçim süresi 15 sn olur (CZ-M1 onaylanmazsa tek tur **20 sn**).
**Neden:** Sorun 2. Bir sayı seçmek 30 sn sürmüyor; ölü süre gerilimi öldürüyor.
**Ayrıntılar:** CZ-M3 radarı 15 sn'lik turda **8. saniyede**, 20 sn'lik turda **11. saniyede** çıkar. Son 5 sn uyarısı
(CZ-U14) iki sürede de aynı.

### CZ-M3 · Kalabalık radarı — **önerim: EVET** · 🔊 Ses
**Ne:** Turun ortasında (15 sn'lik turda **8. saniye**) kuledeki platformlardan **o an iki ya da daha fazla pin bulunanlar**
herkesin ekranında 🔥 ile yanar. Kimin orada olduğu ve kaç kişi olduğu yazmaz. Radar o anın fotoğrafıdır, sonra
güncellenmez; herkes seçimini değiştirebilir.
**Neden:** Sorun 1 ve 2. Masaya ortak bir bilgi ve büyük bir kaos anı getirir: "95 yanıyor! Kim orada?!", "ben
kaçıyorum" — ama herkes kaçınca yeni kalabalıklar oluşur. Matematik bilmeyen için de sezgisel: "ateşli yere gitme."
Gizli Alışveriş'te onayladığın vitrin fısıltısıyla (GA-M3) aynı ruhta.
**Ayrıntılar:**
- Hesap, o ana kadar **gönderilmiş** seçimlerden yapılır (kilitli ya da değil). Seçmemiş oyuncu hesaba girmez.
- Herkese aynı bilgi (publicView'da yalnız yanan platform numaraları listesi). Kendi pininin bulunduğu platform yanıyorsa
  senin ekranında ek olarak "Burada yalnız değilsin!" yazar (bu bilgi zaten listeden çıkarılabilir; yeni sızıntı yok).
- Kilitlemiş oyuncu radarı görür ama artık kaçamaz (kilit = kesin). Bu, erken kilidin bedelidir.
- Herkes radar anından önce kilitlerse radar çıkmaz (tur zaten 1 sn sonra biter).
- 2 kişide radar yalnız tek bir platformu yakabilir; yanarsa ikisi de aynı yerdedir — 2 kişide bu bilgi çok güçlü
  olduğu için **2 kişide radar yoktur**.

### CZ-M4 · Zirve: 100 her zaman tek başına platform — **önerim: EVET**
**Ne:** 100, her oyuncu sayısında **ayrı, tek sayılık "ZİRVE" platformu** olur. Altındaki platformlar bugünkü
genişlikle; son platform kısa kalabilir (6 kişide 96–99, 3 ve 5 kişide 98–99).
**Neden:** Sorun 4. "100 tek başına mı?" sorusu her masada aynı cevabı alır; zirve herkesin bildiği, herkesin korktuğu
tek odak noktası olur ("100'e kim çıkacak?").
**Ayrıntılar:**
- Kural: değer 100 ise bölge "Zirve", değilse ⌊değer ÷ genişlik⌋. 2, 4, 7, 8 kişide bugünkü durumla aynı (değişiklik
  yalnız 3, 5, 6 kişide).
- Çarpışma olasılığı hesabı (O12'deki ~%25, düzgün dağılımda) pratikte değişmez: 3 kişide %25,2 → %25,1, 5 kişide
  %24,6 → %24,4, 6 kişide %26,2 → %25,8; testteki aralık denetimi bu değerlerle güncellenir.
- Zirvede tek kalan zaten en yüksek tek kalan olduğu için +2 alır; ayrıca ödül yok.

### CZ-M5 · Gizli çizgi: sisin içindeki sınır — **önerim: İSTEĞE BAĞLI**
**Ne:** Her tur kulenin üst bölümünde gizli bir **çizgi** çekilir (75 ile 100 arasında bir sayı). Çizginin **üstündeki**
pinler "çizgiyi geçti" sayılır ve pasif kalır. Kulenin 75–100 arası seçim sırasında sisli görünür; çizgi açılışta
sisin içinden belirir.
**Neden:** Sorun 5. Oyun adını gerçekten taşır; "yüksek ama çizgiyi geçme" riski kalabalıktan bağımsız ikinci bir
gerilim olur ve açılışta güçlü bir "ne olurdu" anı verir ("çizgi 88'deymiş, 90 yazmıştım!").
**Neden isteğe bağlı:** Şans payı ekler ve KURALLAR'daki "oyuncunun hedefi en yüksek sayıyı seçmek" cevabını
değiştirir; 8 kişide çarpışma + çizgi birlikte bazen kimseyi tek bırakmayabilir. CZ-M1 ve CZ-M3 ile oynandıktan sonra
eklenmesini öneririm.
**Ayrıntılar (onaylanırsa):**
- Çizgi 75–100 arası tam sayı, sunucu rastgeleliğiyle, tur başına ayrı; tur açılana kadar hiçbir görünümde yok.
  Çizgiye **eşit** sayı geçmemiş sayılır.
- Çizgiyi geçenler platform sayımına **girmez** (kimseyi düşürmez).
- Çizgi 100 ise Zirve (CZ-M4) güvenlidir; değilse Zirve her zaman geçmiş sayılır.
- Anlatımın 2. maddesi: "Tepede sisin içinde gizli bir çizgi var; geçen yanar."

### CZ-M6 · Erken bayrak: önce kilitleyen platformu kapar — **önerim: HAYIR**
**Ne:** Aynı platformdakilerden **ilk kilitleyen** kurtulur, diğerleri söner.
**Neden önermiyorum:** Oyunu refleks yarışına çevirir: herkes saniyesinde 100'e kilitlenir, en hızlı parmak kazanır.
Risk ve okuma kaybolur; bağlantısı yavaş olan haksızlığa uğrar.

### CZ-M7 · Çarpışana eksi puan — **önerim: HAYIR**
**Ne:** Aynı platformda kalanlar −1 alır.
**Neden önermiyorum:** KURALLAR'da "ceza yok, pasif kalır" açıkça seçildi; senin kalıcı kararın da eksisiz. Çarpışmanın
acısı CZ-U6'daki "ÇARPIŞTI" gösterisiyle verilir.

### CZ-M8 · 6–8 kişide üçüncü tek kalana +1 — **önerim: İSTEĞE BAĞLI**
**Ne:** 6 ve daha fazla oyuncuda, tek kalanların **üçüncüsü** de tur puanı olarak +1 alır (CZ-M1 ile mini puan).
**Neden:** Sorun 3. 8 kişide tek kalanların çoğu boşa gidiyor; "kurtuldum" anının küçük bir karşılığı olur ve alt
platformlar da anlam kazanır.
**Neden isteğe bağlı:** CZ-M1 olmadan genel skora doğrudan üç kişiye puan gider (+2/+1/+1); senin +2/+1/0 düzenine
uymaz. Yalnız CZ-M1 ile anlamlı; yine de tur puanları sıklaşınca toplamda eşitlik artar.
**Ayrıntılar (onaylanırsa):** yalnız 6–8 oyuncuda; 2–5 oyuncuda bugünkü +2/+1.

---

## 4. Arayüz ve his önerileri

### 4a. Ana ekranlar ve akış

### CZ-U1 · Dokunulan kule: pini doğrudan tırmandır — **önerim: EVET**
**Ne:** Kule seçimin kendisi olur: kulenin herhangi bir yerine dokunup yukarı-aşağı sürükleyince pin o yüksekliğe
çıkar. Sürüklerken parmağın yanında **büyüteç**: bulunduğun platform ve bir altı/bir üstü büyük yazılı ("49–52 · senin
platformun", altında 45–48, üstünde 53–56). Alttaki çubuk kalkar; −1/+1/−10/+10 düğmeleri ince ayar için kalır.
**Neden:** Sorun 7 ve 8. Göz ve parmak aynı yerde; platform sınırını (48 mi 49 mu) büyüteç gösterir. Kule dolu dolu
kullanılan bir oyun alanı olur.
**Ayrıntılar:**
- **Başlangıç çapası kalkar:** seçim yapılmamışken pin yok, kulenin dibinde "Dokun ve tırman"; ilk dokunuş o noktayı seçer
  (bugün 50'den başlıyor).
- Platform sınırını geçerken kısa titreşim (her platform değişiminde 8 ms), Zirve'ye çıkınca daha güçlü.
- Büyüteç parmağı kaldırınca 0,6 sn sonra kaybolur. Seçim gönderimi bugünkü gibi (sürüklerken seyreltilmiş, bırakınca
  kesin).
- Erişilebilirlik için kule klavyeyle/ekran okuyucuyla "kaydırıcı" olarak da çalışır (CZ-U16).

### CZ-U2 · Kalabalık kulede okunur platformlar — **önerim: EVET**
**Ne:** 26 ince satır yerine kule **onluk kuşaklara** ayrılır: her 0–9, 10–19 … kuşağı hafif farklı tonda; kuşak içindeki
platformlar ince çizgilerle bölünür. Etiket her platforma değil kuşağa yazılır ("90'lar"), **kendi platformunun
etiketi** ise her zaman tam ("48–51"). Zirve en üstte ayrı, taçlı küçük bir platform.
**Neden:** Sorun 7 ve 9. 8 kişide kule desen gibi görünüyor; kuşaklar göze tutunacak yer verir.
**Ayrıntılar:** platform satırı en az 9 px (360×640, 8 kişi); yetmezse kule büyüteçle kullanılır (CZ-U1). 2–4 kişide
platform az olduğu için kuşak gerekmez, bugünkü düzen kalır.

### CZ-U3 · Üst bilgi: "her platform 4 sayı" — **önerim: EVET**
**Ne:** "GİZLİ PİNİN · PLATFORM GENİŞLİĞİ 4" yerine iki satır: büyük sayın ve altında **"48–51 platformundasın · her
platform 4 sayı"**. Kulenin yanında küçük not: "8 kişisiniz: platformlar dar."
**Neden:** Sorun 9. "Genişlik" teknik bir kelime; "4 sayı" ve neden dar olduğu hemen anlaşılır.
**Ayrıntılar:** 2 kişide "geniş", 3–4 kişide "orta", 5+ kişide "dar" kelimesi.

### CZ-U4 · Kilitten sonra: radar bekleyişi — **önerim: EVET**
**Ne:** Tamam'a basınca düğmeler aşağı kayarak kaybolur, pin platformuna **bayrak diker** (kilit simgesi), altında
"Kilitlendin · 72". CZ-M3 ile radara kadar geri sayım: "Radar 4 sn sonra…"; radar çıkınca "Senin platformun: sakin ✓" ya
da "Senin platformun: 🔥 kalabalık — artık kaçamazsın!".
**Neden:** Sorun 13. Kilitten sonraki boşluğu beklenecek bir anla doldurur; erken kilidin riskini hissettirir.
**Ayrıntılar:** radar yoksa (CZ-M3 reddi ya da 2 kişi) yalnız bayrak ve "Diğerleri seçiyor · 3/5".

### CZ-U5 · Radar anı — **önerim: EVET (CZ-M3 ile)** · 🔊 Ses
**Ne:** 8. saniyede kule bir an kararır, aşağıdan yukarı bir **radar taraması** geçer; yanan platformlar 🔥 ve turuncu
nabızla kalır (tur sonuna kadar). Üstte bant: **"RADAR: 2 platform kalabalık!"** (ya da "RADAR: kimse yan yana değil").
**Neden:** CZ-M3'ü masanın ortak "aaa!" anına çevirir.
**Ayrıntılar:** ses kısa sonar "biip"; titreşim yalnız kendi platformu yananlara (iki kısa). Hareket azaltmada tarama
yok, platformlar doğrudan yanar.

### 4b. Açılış/sonuç anı ve gerilim

### CZ-U6 · Aşağıdan yukarı yükselen pinler — **önerim: EVET** · 🔊 Ses
**Ne:** Açılış yeniden kurgulanır (sorun 12):
1. **0,0 sn** — Kule tam boy (boş platformlar dahil) ekrana gelir, pinlerin üstünde sayı yok.
2. **0,3 sn'den** — Pinler **en düşükten en yükseğe** tek tek kuleye tırmanır (pin başı 0,35 sn; 8 kişide ~2,8 sn).
   Tırmanırken sayı sayaç gibi akar, platformuna oturunca durur.
3. Bir pin dolu bir platforma oturursa iki pin **çarpışır**: kıvılcım, ikisine "ÇARPIŞTI" damgası, sönme.
4. Son pin oturunca en yüksek tek kalan **fırlar** (kulenin tepesinden yukarı kısa bir sıçrama) "+2", ikinci "+1".
**Neden:** Gerilim en yüksek sayılara kadar biriker: "Elif hâlâ tırmanıyor… 90'lar… 95… Mert de 94'te! ÇARPIŞTI!"
**Ayrıntılar:**
- Toplam süre 8 kişide ~4,2 sn; 7 sn'lik son açılışa ve (CZ-M1 ile) 5 sn'lik ara açılışa sığar (ara açılışta pin başı
  0,25 sn).
- Eşit değerde (aynı sayı) sıra katılım sırasıdır; ikisi aynı anda oturur.
- Geç açılan ekran kaldığı yerden devam eder (bugünkü `skew`).
- Hareket azaltmada tırmanma yok: pinler yerlerinde belirir, çarpışmalar 0,4 sn sonra metinle işaretlenir.

### CZ-U7 · Sonuç: tam kule ve isimler — **önerim: EVET**
**Ne:** Sonuçta boş platformlar gizlenmez; kule ekran boyu kalır (bugün boş kalan alt %60 dolar), dolu platformlarda
çiplerin yanında **kısa ad**. Çarpışanların çipi soluk değil, kırmızı çerçeveli ve çapraz çizgili; ad okunur kalır.
Tek kalıp puan alamayanlar sakin yeşil çerçeve ve küçük "tek kaldı" etiketi.
**Neden:** Sorun 3, 10, 11. Yükseklik farkı gerçekten görünür; kim çarpıştı, kim kurtuldu ad adına okunur.
**Ayrıntılar:** 8 kişide (26 platform) kule kuşaklı çizilir (CZ-U2), çip yüksekliği 26 px; bir platformda 3+ çip varsa
yan yana sıkışır, ad yerine yalnız baş harf. 360×640'ta adlar 6 harfe kısaltılır.

### CZ-U8 · "Ne olurdu?" satırı — **önerim: EVET**
**Ne:** Puan aşamasında başlığın altında **sana özel** tek satır:
- Çarpıştıysan: **"Bir platform aşağıda (84–90) tek kalırdın: +2."** ya da en iyi sonuç +1 ise "… +1".
- Tek kalıp 0 aldıysan: **"73–83 arası yazsaydın birinci olurdun."**
- Kazandıysan: **"Üstündeki ilk boş platform 91–97'ydi; biraz daha cesur olabilirdin."** ya da "Daha iyisi yoktu."
- Seçmediysen: "Seçmedin, pasif kaldın."
**Neden:** Tek atışlık oyunun en tatlı anı "az kalsın"; çarpışanı da güldürür, bir sonraki tura (CZ-M1) sezgi verir.
**Ayrıntılar:**
- Hesap istemcide, açılmış seçimlerle: 0–100 arası her X için senin seçimin X olsaydı sonucu (çarpışmalar ve
  sıralama yeniden hesaplanarak; senin uzaklaşmanla çarpıştığın kişinin tek kalabileceği de dahil) bulunur; en iyi
  puanı veren X'lerden **kendi sayına en yakın kesintisiz aralık** yazılır.
- İzleyici ve TV'de kişisel satır yerine: "En yüksek boş platform: 91–97."
- CZ-M1 ile ara turda da gösterilir (bir sonraki tura ders).

### CZ-U9 · Sonuç başlığı: herkesin hikâyesi tek bakışta — **önerim: EVET**
**Ne:** Başlıkta yalnız "+2" ya da "puan yok" yerine iki satır: büyük **kendi sonucun** ("ÇARPIŞTIN" / "TEK KALDIN"
/ "+2 ZİRVEDEN!") ve altında masanın özeti: **"3 çarpışma · 2 tek kalan · en yüksek tek: Cihad 72"**.
**Neden:** Sorun 3 ve 11. Herkesin kendi durumunu ve masanın durumunu ayrı ayrı anında okur.
**Ayrıntılar:** "+2 ZİRVEDEN!" yalnız Zirve'de (100) tek kalan için. Kimse tek kalmazsa: "Herkes çarpıştı! Kimse puan
alamadı."

### 4c. Telefon ergonomisi ve okunurluk

### CZ-U10 · Yatay ve küçük ekran — **önerim: EVET**
**Ne:**
- **Yatay (844×390):** solda kule yüksekliğin tamamı, ortada büyük sayı ve platform yazısı **tek satır**, sağda ince ayar
  düğmeleri ve Tamam. Oyun adı kelime ortasından bölünmez.
- **360×640:** kule en az 300 px; sayı 56 px; ince ayar düğmeleri tek satırda kalır; "Tamam" 56 px.
**Neden:** Sorun 7 ve 14.
**Ayrıntılar:** üst yazı sığmazsa "her platform N sayı" ikinci satıra değil, kulenin yanına taşınır.

### CZ-U11 · Puanların yeri: kendi platformun hep görünür — **önerim: EVET**
**Ne:** Seçim sırasında kendi platformun kulede kalın kenarlı, avatarınla; seçili değilken kule ortadaki "Dokun ve
tırman" çağrısıyla. Sonuçta kendi çipin her zaman ekranda kalır (kule kaydırılması gerekirse otomatik kayar).
**Neden:** Sorun 7 ve 10. 26 platformda kendini kaybetmemek.
**Ayrıntılar:** yalnız sonuç ekranında ve yalnız 8 kişide kule ekrana sığmazsa kaydırma; 2–7 kişide kaydırma yok.

### 4d. İzleyici, kopan oyuncu ve TV

### CZ-U12 · İzleyici ve TV: büyük kule — **önerim: EVET**
**Ne:**
- **İzleyici:** "?" yerine tam kule, kimin kilitlediği avatarlarla yan şeritte, radar (CZ-M3) aynen; sonuçta CZ-U6
  açılışı.
- **TV (`StageView`):** ortada ekran boyu kule (TV yüksekliğinde 26 platform rahat okunur), solda oyuncu sütunu
  (avatar, ad, kilit, CZ-M1 ile toplam), sağda büyük süre ve "Tur 1/2". Radar taraması ve açılıştaki tırmanma TV'de en
  güçlü hâliyle; çarpışmalarda ekran kısa sarsılır.
**Neden:** Sorun 15. Tırmanma ve çarpışma uzaktan izlenecek bir yarış.
**Ayrıntılar:** açılıştan önce TV/izleyici hiçbir pini görmez; radar herkese açık bilgi olduğu için görünür.

### CZ-U13 · Kopan ve seçmeyen oyuncu — **önerim: EVET**
**Ne:** Sonuçta "Seçmedi" şeridi alt köşede küçük değil, kulenin dibinde gri bir zemin satırı: avatar + ad + "pasif".
Seçim sırasında kopan oyuncunun bayrağı (kilitlediyse) gri; seçimi varsa sonuçta normal yer alır.
**Neden:** Bugün "Seçmedi" 20 px'lik avatarlarla zor görülüyor.
**Ayrıntılar:** kopan oyuncu beklenmez (erken bitiş kuralı aynen).

### 4e. Ses, titreşim ve hareket

### CZ-U14 · Tırmanış ses ve titreşim seti — **önerim: EVET** · 🔊 Ses
**Ne:** Pin sürüklerken yüksekliğe göre tizleşen hafif ton (yükseldikçe ince), her platform sınırında "tık" ve 8 ms
titreşim, Zirve'de çan; kilitte bayrak "fırt"; son 5 sn'de kule ışıkları nabız atar, tik hızlanır ve seçmemiş oyuncunun
telefonu her saniye titrer ("Seçmezsen pasif kalırsın!"); radar sonar "biip"; açılışta tırmanan pinlerde yükselen
"vııı", oturma "tak", çarpışmada elektrik "bzzt" ve sönme, birinci fırlarken roket "fşşuu", +1'de jeton.
**Neden:** Bugün yalnız genel "fail / tick / fanfare" sesleri var; yükseklik hissini ses taşır.
**Ayrıntılar:** `cizgi.*` olay adlarıyla ses haritasına; dosya gelene kadar sentez. Hareket azaltmada nabız ve sarsıntı
yok.

### 4f. İlk kez oynayan için öğretme (anlatım ekranı dahil)

### CZ-U15 · Anlatım: masanın platformlarıyla örnek — **önerim: EVET**
**Ne:** Anlatım maddeleri masanın gerçek sayılarıyla:
1. "Gizlice 0–100 arası bir sayı seç. 5 kişisiniz: **her platform 7 sayı** (0–6, 7–13 … 91–97, 98–99, **100 Zirve**)."
2. "Biriyle aynı platforma düşersen ikiniz de **çarpışır**, puan yok. **Örnek: 95 ve 94 → çarpıştı.**"
3. "Tek kalanların en yükseği +2, ikincisi +1; tek kalıp üçüncü olan 0." (CZ-M1 ile "İki tur; toplam kazanır.")
CZ-M3 ile ikinci maddeye: "Turun ortasında radar kalabalık platformları yakar."
**Neden:** Sorun 15. "Bölge" ve "genişlik" soyut; masanın gerçek platformları ve bir çarpışma örneği akılda kalır.
**Ayrıntılar:** sayılar oyuncu sayısından üretilir (genişlik tablosu + CZ-M4 Zirve). Anlatım görseli (platformlar,
çarpışan iki pin, yükselen pin) bu metne zaten uygun.

### CZ-U16 · Ad ve tema uyumu — **önerim: İSTEĞE BAĞLI**
**Ne:** CZ-M5 (gizli çizgi) onaylanmazsa adı oyuna yaklaştıran küçük dokunuşlar: kulenin tepesinde arka plandaki
damalı bitiş kapısıyla aynı desende bir **"çizgi"** (Zirve'nin üstü), anlatım hedefi "Çizgiye en yakın tek sen ol!".
Ya da oyunun görünen adı **"Tek Kal"** / **"Kalabalığa Karışma"** olur.
**Neden:** Sorun 5. Bugün adında olan çizgi oyunda yok.
**Neden isteğe bağlı:** Ad senin tercihin; wiki, rozet ve maç kartı metinleri de değişir.

### 4g. Erişilebilirlik

### CZ-U17 · Renk körü, hareket azaltma, yazı, ekran okuyucu — **önerim: EVET**
**Ne:**
- **Renk körü:** çarpışma yalnız kırmızıyla değil çapraz çizgi deseni + ✗ ile; tek kalan ✓, birinci ★ (bugün `CbState`
  var, CZ-U7 ile avatar soluklaşmadığı için okunur). Radar 🔥 simgesi + "kalabalık" yazısıyla, yalnız turuncu değil.
- **Hareket azaltma:** tırmanma, radar taraması, sarsıntı ve fırlatma kapanır; adımlar 0,4 sn arayla metinle.
- **Yazı boyutu:** platform etiketleri en az 13 px (bugün kalabalık kulede daha küçük), kendi platform etiketin 15 px.
- **Ekran okuyucu:** kule "kaydırıcı, değer 72, platform 70–76" olarak okunur, ok tuşlarıyla 1'er, sayfa tuşlarıyla
  10'ar değişir. Radar duyurusu: "Radar: 91–97 ve 98–99 kalabalık." Açılış sonunda tek duyuru: "Sen 72, tek kaldın,
  birinci, +2. Elif ve Mert 91–97'de çarpıştı."
**Neden:** Bugün sonuç yalnız görsel; çarpışanların soluk avatarları ayırt edilmiyor.

---

## 5. Yapay zekâ (AI) ile yapılabilecekler

### CZ-AI1 · Yarış spikeri — **önerim: HAYIR**
Oyun sonunda tek cümle: "Oyuncu4 iki turda da zirveye koştu, ikisinde de birine çarptı; Oyuncu2 ise sessizce 72'de
kazandı." Ortak yorum altyapısıyla; modele "Oyuncu1…N" ve açılmış seçimler gider, puanı belirlemez.
**Neden önermiyorum:** Oyun 40 sn'lik bir sayı seçimi; söylenecek şeyi CZ-U8 ("bir platform aşağıda tek kalırdın") ve
CZ-U9 (masa özeti) kurala dayalı, anında ve her zaman doğru söylüyor. Yapay zekâ cümlesi gecikme ve maliyet ekler,
yeni bir şey katmaz.

---

## 6. İçerik ve üretim ekibine düşen işler

- **Ses Efektleri yapay zekâsı (🔊):** `cizgi.*` seti — yüksekliğe göre tizleşen sürükleme tonu, platform sınırı "tık",
  Zirve çanı, bayrak "fırt", son 5 sn tiki, radar sonarı, tırmanma "vııı" (yükselen), oturma "tak", çarpışma "bzzt",
  roket fırlatma, +1 jeton (CZ-U5, U6, U14).
- **Efekt Dokuları yapay zekâsı:** çarpışma kıvılcımı, radar tarama ışığı, fırlatma izi (hepsi CSS/SVG ile de yapılır).
- **Arayüz İkon ve Süsleri yapay zekâsı:** bayrak (kilit), 🔥 kalabalık işareti, "ÇARPIŞTI" damgası, Zirve tacı.
- **Görsel (🎨, ChatGPT akışı):** paket için gerekmiyor. CZ-M5 onaylanırsa isteğe bağlı "sis bandı" dokusu; CZ-U16'da
  damalı çizgi mevcut arka plandan kesilebilir.
- **Moderasyon ve Wiki yapay zekâsı:** wiki ve oyun kartı (iki tur, radar, Zirve, yeni anlatım).
- **Test, Hata ve Performans yapay zekâsı:** bot senaryoları: "herkes 90+", "herkes radardan sonra kaçar", 2 kişide
  radarın çıkmaması, 8 kişide açılışın 5 sn'lik ara süreye sığması; Zirve kuralının 3/5/6 kişideki etkisi.
- **İçerik Havuzu:** iş yok.

---

## 7. Önerilen paket

**EVET:** CZ-M1, CZ-M2, CZ-M3, CZ-M4; CZ-U1 … CZ-U15, CZ-U17.
**İSTEĞE BAĞLI:** CZ-M5 (gizli çizgi), CZ-M8 (6–8 kişide üçüncüye +1), CZ-U16 (ad ve tema).
**HAYIR:** CZ-M6 (erken bayrak), CZ-M7 (çarpışana eksi), CZ-AI1 (yarış spikeri).

Bu paketle oyun şöyle akar: anlatım "5 kişisiniz, her platform 7 sayı, 100 Zirve; 95 ile 94 çarpışır" der → 1. tur:
kuleye dokunup pinini tırmandırırsın, büyüteç platformunu gösterir → 8. saniyede radar taraması: "91–97 kalabalık!",
masa bağırır, birkaç kişi kaçar → kilitleyen bayrağını diker → pinler aşağıdan yukarı tırmanır, 90'larda iki pin
çarpışır, 72'deki fırlar "+2" → "Bir platform aşağıda tek kalırdın" → 2. tur: herkes Elif'in yine tepeye gideceğini
düşünür… → iki turun toplamına göre +2 / +1 / 0.

**Değişen kurallar (paket onaylanırsa):** oyun iki tur (her tur 15 sn seçim; 5 sn ara, 7 sn son açılış; erken bitiş tur
başına); tur puanları (+2/+1) toplanır, genel skor sonda `rankAwards` ile +2 / +1 / 0 (liderler eşitse hepsi +1);
turun 8. saniyesinde o an 2+ pin bulunan platformlar herkese 🔥 ile gösterilir (2 kişide radar yok); 100 her oyuncu
sayısında ayrı "Zirve" platformu. `docs/KURALLAR.md` §18, wiki ve testler buna göre güncellenir.

**Değişmeyenler:** 2–8 oyuncu; 0–100 tam sayı; oyuncu sayısına göre platform genişliği (25, 14, 10, 7, 6, 5, 4);
aynı platformdakilerin pasif kalması (ceza yok); seçmeyenin pasif olması; tek kalanların en yükseği +2, ikincisi +1
(tur içinde); seçimlerin tur sonuna kadar gizli olması; kilit ve erken bitiş (son kilitten 1 sn sonra); kopan oyuncunun
beklenmemesi; eksi puan olmaması.

**🎨 Yeni görsel gerekenler (paket):** yok. Kule kuşakları, büyüteç, bayrak, radar, kıvılcım ve Zirve tacı CSS/SVG ile
çizilir. (CZ-M5 onaylanırsa isteğe bağlı sis dokusu.)
