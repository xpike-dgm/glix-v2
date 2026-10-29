# İnceleme 1: son 30 saatin kodu (kürsü karakteri, mağaza, dolap, klip, görevler)

Kapsam: karakter sahnesi/afiş, kutlama, dans klibi, Mağaza/Dolabım, mağaza ağ katmanı, sunucu mağaza ve görev uçları.
Her bulgu kodda okunarak doğrulandı; düzeltmeler en küçük değişikliktir ve testlidir.

## Düzeltilen bulgular

1. **Çıkış yapınca önceki hesabın mağaza durumu kalıyordu (orta).**
   - Bulgu: `resetShop()` hiçbir yerden çağrılmıyordu. Çıkış, hesap silme ya da aynı sekmede başka hesaba giriş sonrası `shop()` eski hesabın bakiye, sahip olunanlar ve kuşanılanlarıyla duruyordu.
   - Etki: Tepki yelpazesi (`EmojiFan`) eski hesabın çıkartma paketlerini gösteriyordu (misafire ya da yeni hesaba; sunucu sessizce atıyordu); `ensureShopLoaded` durum dolu sandığı için tazelemiyordu; önizlemelerde eski kuşanılanlar görünüyordu.
   - Düzeltme: `refreshAccount` (hesapsız), `logout`, `deleteAccount` ve `enter` (giriş/kayıt) `resetShop()` çağırır. Uçuştaki yanıt `seq` ile düşürülür. Test: `net/shop.test.ts`.

2. **Kuşanma istekleri sıra dışı işlenebiliyordu (orta).**
   - Bulgu: Dolap karolarına ve renk toplarına art arda dokunmak eşzamanlı `POST /equip` gönderiyordu; sunucu ters sırayla işlerse son dokunuş ezilirdi (ekran, sunucunun son durumuna dönerdi).
   - Düzeltme: `equipItem` istekleri tek sırada gönderir; bir istek ağ hatasıyla düşse de sıradaki çalışır. Test: `net/shop.test.ts`.

3. **Afiş çizim bağlamı bir kez bozulunca oturum boyunca bozuk kalıyordu (orta).**
   - Bulgu: `poster.ts` ortak `Application` açılış sözünü saklıyordu; WebGL açılışı bir kez başarısız olursa reddedilmiş söz kalıyor, sonraki bütün mağaza/dolap afişleri avatarda takılıyordu (yeniden deneme yok). Yarım kalan uygulama da yıkılmıyordu; kapanış zamanlayıcısı reddedilmiş sözde işlenmemiş ret üretebilirdi. Çizim/resme çevirme hata verirse karakter sahnede ve bellekte kalıyordu.
   - Düzeltme: Açılış hatasında söz saklanmaz, uygulama yıkılır; karakter `finally` ile temizlenir. Test: `character/posterOpen.test.ts`.

4. **`CharacterPoster` eski yanıtla yenisini ezebiliyordu (düşük-orta).**
   - Bulgu: Özellikler (renk, ürün) hızla değişince yavaş çizilen eski afiş, önbellekten anında dönen yeni afişten sonra gelip üstüne yazıyordu; çizim hatasında da önceki ürünün afişi kalıyordu.
   - Düzeltme: "son istek kazanır" kapısı (`ui/latestGate.ts`); hatada afiş temizlenir, avatar görünür. Test: `ui/latestGate.test.ts`.

5. **Pixi başlatma hatasında GPU bağlamı ve tuval sızıyordu (düşük).**
   - Bulgu: `mountCharacterStage` ve `playCelebration` içinde `app.init` ya da `createContext` hata verirse `Application` yıkılmıyordu (klip kaydı ve kürsü tekrar tekrar denenirse bağlam sayısı artar).
   - Düzeltme: Hata yolunda `app.destroy(APP_VIEW_ONLY, …)` ve hata yeniden fırlatılır; çağıranlar zaten avatara/başarısız durumuna düşer.

6. **Dolabım yükleme hatasında "Yükleniyor"da takılıyordu (düşük).**
   - Bulgu: Hata metni vardı ama yeniden deneme düğmesi yoktu (Mağaza'da vardı).
   - Düzeltme: Hata mesajı + "Tekrar dene" düğmesi.

7. **Mağaza satın alma sayfasında geç sonuç başka ürüne yazılıyordu (düşük).**
   - Bulgu: Kuşanma sürerken sayfa kapatılıp başka ürün açılırsa sonuç iletisi yeni ürüne yazılıyor, başarıda yeni sayfa kapanıyordu.
   - Düzeltme: Sonuç yalnız aynı ürün hâlâ açıksa sayfaya yazılır; değilse hata bildirimi (toast) olur.

8. **Klip kaydında işlenmemiş ret (düşük).** `MediaRecorder.onerror` döngü sürerken reddi beklenmeden bırakıyordu; ret şimdi yutulur, sonuç yine sonda beklenir.

## Doğrulanıp sorun bulunmayanlar

- Sunucu: kuşanma sahiplik/renk/tür denetimi, geri alınan (revoke) ürünün kuşanımdan düşmesi ve odadaki görünümün tazelenmesi, görev günü sınırı (İstanbul 00:00, `endedAt` ile), çıkartma tepkisi hız sınırı ve sahiplik denetimi doğru.
- İstemci protokol doğrulaması: `questsDone`, `glixEarned`, kozmetik ve çıkartma kimlikleri katalog/biçim denetiminden geçiyor.

## Notlar (düzeltilmedi)

- `parseShopState` sahip olunanları 200 ile kırpıyor; katalog ~160 ürün, katalog 200'ü aşarsa sınır artırılmalı.
- Afiş nesne URL'leri oturum boyunca bırakılmıyor (farklı anahtar sayısıyla sınırlı, küçük).
- `CharacterStage` hareket azaltma tercihini bağlanırken bir kez okur; ayar canlı değişirse ekran yenilenene dek eski kalır.
