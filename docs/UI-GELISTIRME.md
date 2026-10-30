# Oyun hissi geliştirmesi: karar defteri

Sahiple oyun oyun konuşulan, kabul edilen arayüz önerileri ve kural değişiklikleri. Tüm oyunlar konuşulduktan sonra
yapıma geçilir; o zamana kadar kod değişmez. Kural değişiklikleri yapılırken `docs/KURALLAR.md` ve wiki içeriği de
güncellenir.

## Aşırı Yükleme

### Kural değişikliği (sahip isteği)

- Bar 100'ü geçtikten sonra basan **herkes** patlar ve ceza alır; ceza tek kişiye (yalnız ilk aşana) verilmez.
  Bugünkü kural: 100'ü aşan ilk tık patlatır ve tur o anda biter.
- Oyun sırasında toplam basılan sayı yine **gösterilmez** (kimse doluluğu bilmez).

Sahibin kararları:
1. **Tur akışı:** bar 100'e ulaşınca gizli tehlike penceresi (3 sn) başlar ve tur ilk aşan tıkta bitmez; pencere
   sonuna kadar sürer. Pencerede (100'ü geçtikten sonra) basan herkes patlar.
2. **Patlama cezası:** 100'den sonra en çok basan tek kişi -2, diğer patlayanlar -1. Yalnız bir kişi 100'den
   sonra bastıysa o kişi -1 alır. 100'den sonra en çok basanlar eşitse hepsi -1 alır (kimse -2 almaz).
3. **Sıralama ödülü:** yalnız patlamayanlar sıralanır; sayılan, 100'ü geçmeden (bar dolana kadar) yapılan
   tıklamalardır. Tek lider +2, ikinci +1, diğerleri 0. Liderler eşitse hepsi +1 alır (bugünkü kuraldaki gibi bu
   durumda +2 ve ikinci sıra ödülü verilmez). Hiç tıklamayan ödül almaz.
4. **Patlayanlar sıralamaya girmez:** 100'den önce ne kadar basmış olursa olsun yalnız patlama cezasını alır.
5. **Kimse 100'ü geçmezse:** eksi puan yok (bugünkü "en az tıklayana -1" cezası tamamen kalkar). Bar hiç dolmadan
   süre biterse de sıralama ödülü aynı şekilde verilir.
6. Oyun sırasında toplam yine gösterilmez; toplam yalnız sonuç ekranında (sıralı açılışta) görünür.

### Kabul edilen arayüz önerileri

**Dokunma anı**
- **Çekirdek tepki versin:** her dokunuşta çekirdek kısa bir an içe çöküp geri esner; halkalar dokunulan yönden
  dalgalanır.
- **Dokunulan yerden çekirdeğe enerji aksın:** parmağın değdiği noktadan çekirdeğe küçük ışık parçacıkları çekilir
  ("ben besliyorum" hissi).
- **Kendi hızına göre yükselen ses:** hızlı bastıkça vınlama sesi inceleşir, durunca söner. Yalnız oyuncunun kendi
  hızını yansıtır, barı değil. Kısa bir seri olunca küçük bir "ritim" efekti çıkar.
- **Titreşim:** yavaş basışta yumuşak, seride daha sert vuruşlar.
- **Arka plan yaşasın:** üstteki reaktör tüpünde borular nabız gibi parlar, ara ara buhar fışkırır, uyarı lambaları
  döner. Hepsi zamana bağlıdır, doluluğu göstermez.

**Patlama ve sonuç**
- **Patlama sahnesi:** beyaz flaş, çekirdek parçalara ayrılır, ekranı kaplayan şok dalgası, güçlü sarsıntı, çok
  kısa yavaş çekim, derin patlama sesi (bugün yalnız beyaz parlama ve hafif sarsıntı var).
- **Sonuçlar sırayla açılsın:** önce toplam sayaç 0'dan gerçek toplama hızla yükselir (herkes doluluğu ilk kez
  burada görür); sonra oyuncular tek tek gelir; patlayan(lar) en son, avatarın üstünde çatlak efekti ve
  "PATLATTI" damgasıyla açılır.
- **Kendi satırın parlasın:** puan, ekranın üstündeki puan yazısına uçarak eklenir.

### Not edilen, karar bekleyen

- Tehlike başladığında ekranda hâlâ "Çekirdeğe hızlıca dokun!" yazıyor; o anda dokunmak patlatıyor. Yeni kuralda
  da çelişkili kalır. Önerilen: tehlikede yazı kırmızı ve titreyen "DOKUNMA!" ya da "AŞIRI YÜK!" olur.
- Sıralı sonuç açılışı ve patlama sahnesi bugünkü 5 sn sonuç süresine sığmayabilir (7-8 sn gerekebilir).
- Kabul edilmeyenler (şimdilik): tehlike anı efektleri (siren, çatlama, kalp atışı), geri sayımın reaktör
  ateşlemesine dönmesi, izleyici ekranı, diğer oyuncuların kıvılcımları, yanıltıcı uyarılar.
