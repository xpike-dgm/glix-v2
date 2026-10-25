# A8 — Laf Sokma Düellosu: kural yorumları

Kanonik kural: `docs/KURALLAR.md` §27 (TASLAK). Aşağıdakiler kuralın söylemediği uygulama kararlarıdır.

- **Soru havuzu:** `packages/engine/src/games/laf-sokma/prompts.ts`, elle yazılmış taslak (3 ton × 110). Oyun hiçbir
  yapay zekâ ya da dış servis çağırmaz. Ton: oda/protokol henüz oyun başına ayar taşımadığından varsayılan **arkadaş**;
  `createLafSokma(tone)` fabrikası ve `LAF_TONES` hazır, ayar gelince kayıt defteri doğru tonla kurar.
- **Dağıtım:** N oyuncu için N düello soru + 1 final sorusu (hepsi farklı). Oyuncular karışık bir halkada kurulur,
  `adım` uzaklıktaki iki oyuncu bir soruyu alır (1 ≤ adım < N/2): herkes 2 soru, çift tekrar yok, 3 oyuncuda üçgen.
- **Süreler:** yazma 60 sn; düello başına oylama 10 sn + açılış 7 sn; final yazma 45 sn; final oylama 20 sn
  (kuralda yok, varsayım); final açılış 12 sn. Hiç cevabı olmayan sorunun oylaması atlanır, kısa açılış 2,5 sn.
- **Cevap:** en çok 80 karakter (temizlemeden sonra); harf büyüklüğü korunur; boş metin cevabı siler; en az bir
  harf/rakam/emoji gerekir. Moderasyon: `packages/engine/src/moderation/` (küçük Türkçe küfür/nefret listesi);
  reddedilen cevap `inappropriate` kodu alır, istemci dostça cümle gösterir.
- **Yazma:** cevaplar kilitlenene kadar (Tamam) değiştirilebilir; en az bir cevabı olan kilitler. Bağlı herkes kilitleyince
  aşama 1 sn sonra biter.
- **Oylama:** tek seferlik, değiştirilemez. Oy verebilen **bağlı** herkes verdiyse aşama 1 sn sonra biter. Cevabı olmayan
  ("Cevap yok") karta oy verilemez; tek cevaplı soruda tüm oyları alan yazar Laf Ustası olabilir. Cevap sahipleri oy
  vermez, bu yüzden oy verenler listesinden iki yazarın kim olduğu (hangisinin hangi cevap olduğu değil) çıkarılabilir;
  kuralın doğal sonucudur.
- **Final:** herkes cevap yazar; yalnız cevap yazanların kartı olur (Cevap yok kartı yok). Oy veren, kendi kartı dışında
  bir karta oy verir (cevap yazmayan da oy verebilir). Laf Ustası finalde yoktur. Aldığın her oy +1.
- **Puan:** miniScores = awards.
