# İnceleme 2 — Oyuncuya görünen metinler ve erişilebilirlik

## Bulgular

- Arayüz metinleri (JSX, `aria-label`, `title`, `placeholder`, toast) taranarak İngilizce sözcük, teknik terim, "undefined/null", yer tutucu ve TODO metni aranmadı bulunmadı; metinler Türkçe ve tutarlı.
- Terimler: mağazada tür adı "Lakap", maç sonu ödülleri "Unvanlar" (bilinçli ayrım); "Dolabım" tek ad olarak kullanılıyor. "Glix" her yerde büyük harfle, ek alırken kesme işaretiyle ("Glix'e").
- Asıl boşluk hata metinlerindeydi:
  - Mağaza hata tablosunda `unknown_colour`, `invalid_input`, `forbidden`, `not_found`, `method_not_allowed`, `server_error` yoktu; bunlar genel mesaja düşüyordu.
  - Hesap, arkadaş ve dışa aktarma çağrıları sunucunun `message` alanını doğrulamadan gösteriyordu. Alan boş, ham kod ("unknown_item") ya da "500/null" gibi gelirse oyuncu bunu görebilirdi.
  - Oda (WebSocket) hatalarında da sunucu mesajı olduğu gibi gösteriliyordu.
- Tutarsızlık: "Doğrulama maili" ile "E-posta" bir arada kullanılıyordu.
- Erişilebilirlik: ikon düğmelerin tamamında Türkçe `aria-label` var; dekoratif görseller `alt=""`; `BottomSheet` `role="dialog"`, `aria-modal`, ad, odak tuzağı ve kapanınca odağı açana geri verme içeriyor; toast kutusu `role="status"` + `aria-live="polite"`; final ve sonuç ekranlarında Glix kazanımı için `sr-only` canlı bölge var; nadirlik renkle birlikte metin etiketiyle ("Sıradan/Nadir/Efsanevi") veriliyor.
- Açık kalan: mağazada satın alma başarılı olunca ayrıca sesli duyuru yok (başarı yalnız ekran durumunun değişmesiyle görünüyor). `screens/Shop.tsx` ve `net/shop.ts` başka bir dalda değiştiği için bu dalda dokunulmadı; o dal birleştikten sonra `buyItem` başarısında `toast("… satın alındı", "success")` eklenmesi yeterli.

## Değişiklikler

- Yeni `apps/client/src/net/errorText.ts`: tüm sunucu/protokol hata kodları için tek Türkçe tablo, `looksTechnical` (ham kod, sayı, "null/undefined", İngilizce hata) ve `playerErrorText(kod, sunucuMesajı)`: mesaj temizse onu, değilse kodun karşılığını, o da yoksa genel mesajı verir.
- `shopRules.shopErrorText` artık bu tabloyu kullanıyor.
- `account.ts`, `friends.ts`, `client.ts` hata gösterimleri `playerErrorText` üzerinden geçiyor; yinelenen ağ hatası sabitleri tek yere toplandı.
- "Doğrulama maili gönderildi" yerine "Doğrulama e-postası gönderildi".
- Testler: `net/errorText.test.ts` (tüm mağaza/genel kodların karşılığı, bilinmeyen kod, teknik metin süzme, Türkçe mesajın korunması).
