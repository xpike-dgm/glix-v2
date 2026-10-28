# Güvenlik taraması (savunma amaçlı, kendi uygulamamız)

Kapsam: sunucu (`apps/server`), protokol/motor (`packages/engine`), istemcide metin gösterimi. Öncelik: para (Glix, mağaza) ve hesaplar.
Yöntem: kod okuma + her gerçek bulgu için önce başarısız test, sonra en küçük düzeltme.

## Düzeltilen bulgular

| # | Bulgu | Risk | Düzeltme |
|---|-------|------|----------|
| 1 | Oturum iptal edilince (çıkış, şifre değişimi, şifre sıfırlama) o oturumla açılmış WebSocket hesap kimliğiyle çalışmaya devam ediyordu (Glix/istatistik yazımı, davet, kullanıcı adıyla odada görünme). Çalınmış oturumu şifre sıfırlamak canlı soketi düşürmüyordu. | Orta | Bağlantı oturum özetini taşır (`Connection.sessionHash`). `Social.sessionsRevoked` ilgili bağlantıları misafire çevirir: çıkışta yalnız o oturum, şifre değişiminde değiştiren dışındakiler, sıfırlamada hepsi. Test: `oturum-iptal.test.ts`. |
| 2 | Hatalı şifre sınırı girişte yazılan metne bağlıydı: aynı hesaba kullanıcı adı, e-posta ve büyük/küçük harf yazımlarıyla ayrı ayrı hak açılıyordu. | Düşük-orta | Bilinen hesapta kova `pw:<hesapId>` (şifre değiştirme/silme ile ortak); bilinmeyen girişte eskisi gibi yazıma göre. Yanıtlar aynı kaldı (hesap varlığı sızmaz). Test: `oturum-iptal.test.ts`. |
| 3 | "Verimi indir" dökümünde hesabın kendi gönderdiği oyuncu bildirimleri (not metni) yoktu (KVKK erişim hakkı eksiği). | Düşük | `reports_filed` eklendi (tarih, sebep, not). Hedef kişi ve yönetici notu başkasına ait olduğu için dökülmez. Test: `kvkk-bildirim.test.ts`. |
| 4 | Geri bildirim metni biçim (Cf) karakterlerini ayıklamıyordu (bidi geçersiz kılma, yönetici panelinde görsel yanıltma). Bildirim notu zaten ayıklıyordu. | Düşük | `sanitizeFeedbackText` bildirim notuyla aynı sınıfları ayıklar. Test: `protocol.test.ts`. |

## İncelenip sorun bulunmayanlar (kod eklenmedi)

- **Glix/mağaza:** Tüm bakiye işlemleri tek SQLite işleminde ve eşzamanlı çalışmayan `node:sqlite` üzerinde; satın alma `bakiye >= fiyat`, sahiplik ve fiyat (fırsat dahil) kontrolünü aynı işlemde yapar, istemciden fiyat alınmaz. Fiyatı 0 ya da bilinmeyen ürün satın alınamaz; sahip olunmayan ürün kuşanılamaz; geri alma kuşanmayı da düşürür (işlem içinde). Yönetici düzeltmesi `isSafeInteger`, `GLIX_ADJUST_MAX` ve bakiye >= 0 ile sınırlı. Günlük sınır defterden (maç satırları) hesaplanır; aynı hesap bir maçta iki oyuncu olsa tek sayılır; maç kaydı yalnız `final` geçişinde bir kez yazılır; rozet ödülü `INSERT OR IGNORE` ile yalnız yeni rozette ödenir.
- **Oturum/çerez:** `HttpOnly; SameSite=Lax; Secure` (TLS ya da güvenilir vekil), oturum belirteci 256 bit, veritabanında yalnız SHA-256 özeti; her girişte yeni belirteç (oturum sabitleme yok); şifre sıfırlanınca tüm oturumlar düşer; sıfırlama/doğrulama belirteçleri tek kullanımlık (`DELETE ... RETURNING`) ve süreli (1 sa / 24 sa); sıfırlama isteği hesap varlığını sızdırmaz; bilinmeyen kullanıcıda da scrypt yapılır (süre farkı yok); askı bilgisi yalnız doğru şifreden sonra söylenir.
- **Google:** `state` + PKCE (S256) + `nonce`, akış sunucuda, tek kullanımlık, 10 dk; `iss`/`aud`/`exp`/`email_verified` denetlenir; dönüş yolu aynı kaynakla sınırlı; e-posta eşleşmesiyle otomatik birleştirme yok.
- **Yönetici:** Her uç oturum + yönetici listesi + e-posta kodu (5 deneme, 10 dk, tek kullanım, oturuma bağlı) ister; yönetici olmayan 404 alır; POST'larda Origin denetimi + `SameSite=Strict` çerez; her değiştiren işlem `admin_audit`'e yazılır; yedek ayrıca "taze giriş" ve günlük sınır ister.
- **HTTP:** Gövde sınırları (512 B - 4 KB), JSON hatası = geçersiz istek, tam anahtar kümesi doğrulaması, Origin denetimi, güvenlik başlıkları (CSP, nosniff, DENY, HSTS Caddy'de), statik sunumda `resolve` + kök önek denetimi (yol gezintisi yok), SQL her yerde parametreli.
- **WebSocket:** Her mesaj `parseClientMessage` ile tam doğrulanır; 8 KiB sınırı, soket başına hız sınırı + ardışık ihlalde kapanış, IP başına soket/oda/başarısız katılma sınırları; `view(state, id)` yalnız katılımcıya özel; izleyici ve sahne `view(state, null)` alır; sahne salt okunur; tepki hız sınırlı ve yalnız lobi/sonuç/final.
- **XSS:** İstemcide `innerHTML`/`dangerouslySetInnerHTML`/`eval` kullanımı yok; kullanıcı metinleri (ad, geri bildirim, bildirim notu) JSX metni olarak yazılır. E-posta şablonlarına kullanıcı metni girmez.
- **KVKK silme:** Hesap silinince oturum, belirteç, istatistik, rozet, Glix defteri, kozmetik (yabancı anahtar `CASCADE`, `foreign_keys=ON`), arkadaşlık, engel, bildirim aboneliği gider; canlı bağlantılar misafire döner.

## Sahibe bırakılanlar / bilinçli kararlar

- **Glix çiftlemesi:** Maç ödülü için asgari iki bağlı oyuncu gerekir ama iki oyuncu aynı kişinin hesap + misafiri (ya da iki hesabı) olabilir. Günlük sınır (300) etkiyi sınırlar; daha sıkı kural (en az iki farklı hesap/IP, asgari maç süresi) ürün kararıdır, eklenmedi.
- **Kayıtta e-posta/kullanıcı adı sorgulanabilir:** `email_taken` yanıtı hesap varlığını ele verir (kayıt UX'i için gerekli); IP başına hız sınırı var. Kullanıcı adları zaten herkese açık.
- **Şifre sıfırlama/doğrulama bağlantısı GET:** doğrulama bağlantısını açan e-posta tarayıcıları belirteci tüketebilir (kullanılabilirlik, güvenlik değil).
- **Silinen hesabın bildirim kayıtları:** `reports` satırlarında hedef takma adı ve kanıt metni 180 gün kalır (hesap bağı kopar). Moderasyon meşru menfaati olarak bırakıldı; KVKK aydınlatma metninde belirtilmeli.
- **Yönetici Glix düzeltme notu:** `glix_ledger.ref` yönetici notunu taşır ve kullanıcının "Verimi indir" dökümünde görünür; içeride kullanılacak not yazılmamalı.
- **Hesap başına kilit:** Hatalı şifre sınırı hesap başınadır; saldırgan bilinen bir kullanıcı adını geçici kilitleyebilir (8 deneme, sonra 30 sn'de 1). Kabul edilen takas.
