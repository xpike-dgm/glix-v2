# GLIX Beta — Oyun Gecesi Kontrol Listesi

Amaç: otomatik testlerin göremediği şeyleri gerçek telefonlarda görmek. Kısa notlar yeterli; ekran görüntüsü çok değerli.

## Hazırlık (5 dk)
- [ ] 3–8 kişi, karışık cihazlar: en az bir iPhone, en az bir orta/düşük seviye Android.
- [ ] Herkes adresi açsın ve **Ana ekrana ekle** desin; uygulamayı ana ekrandaki simgeden açsın.
- [ ] Ses açık, sessiz mod kapalı (titreşimi de denemek için).
- [ ] Bir kişi Wi-Fi, bir kişi mobil veri kullansın.

## Akış
- [ ] Host **ODA KUR**; diğerleri kodla ve **Paylaş** bağlantısıyla katılsın (ikisini de deneyin).
- [ ] Lobide host bir kişiyi çıkarsın, o kişi geri katılsın.
- [ ] Önce **Rastgele 5** ile bir maç; sonra **Ben seçeyim** ile kalan oyunları seçip ikinci maç.
- [ ] Maç sonunda herkes **Nasıldı?** sorusunu puanlasın, bir cümle yazsın.

## Her oyunda bakılacaklar
| Soru | Not |
|---|---|
| Anlatım ekranını okuyup 10 sn içinde ne yapacağını anladın mı? | |
| Ana dokunuş hemen tepki verdi mi (gecikme, kaçan dokunuş)? | |
| Ekranda taşan, üst üste binen, okunamayan bir şey oldu mu? | |
| Ses ve titreşim yerinde mi, rahatsız edici mi? | |
| Sonuç/puan adil ve anlaşılır geldi mi? | |
| Tekrar oynamak ister misin? (1–5) | |

Oyuna özel:
- **Butona Bas:** "aynı anda" basışlar eşleşiyor mu? Bağlantısı yavaş olan geride kalıyor mu?
- **Kör Bomba (yatay):** telefonu çevirme ekranı doğru mu? Taşıyıcı süreyi hiçbir şekilde görebildi mi?
- **Karalama Defteri:** çizim akıcı mı, avuç içi yanlış çizgi bırakıyor mu? Oylamada çizimler yeterince büyük mü?
- **Çağrışım Ağı:** klavye açılınca ekran bozuluyor mu? Türkçe karakterli cevaplar doğru eşleşti mi?
- **Zaman Bombası:** dizi oynatması takip edilebilir hızda mı? Renk + simge ayırt edilebiliyor mu?
- **Çapraz Ateş / Açgözlülük:** seçim gizli kaldı mı, açılış anlaşılır mı?

## Dayanıklılık (oyun ortasında birer kez)
- [ ] Bir kişi uygulamayı arka plana alıp 10 sn sonra dönsün.
- [ ] Bir kişi uçak modunu 5 sn açıp kapatsın.
- [ ] Host telefonunu kilitleyip 15 sn sonra açsın (host kalmalı).
- [ ] Bir kişi sayfayı tamamen kapatıp yeniden açsın (oyuna geri dönmeli).

## Sonra
Notları ve ekran görüntülerini paylaş; geri bildirimler ve hatalar zaten sunucuda anonim olarak toplanıyor
(`docker exec glix-glix-1 node dist/stats.js`).
