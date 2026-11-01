/** Oyun Tasarımı örnek kartları (paket_bicimi / ornek-paket ve testler; sözleşme bölüm 15). */
export const ORNEK_TASARIM: readonly Record<string, unknown>[] = [
  {
    ad: "Fısıltı Zinciri",
    ozet: "Herkes gizlice bir kelimeyi bir sonraki kişiye ipucuyla aktarır; zincirin sonu ilk kelimeyi tahmin eder.",
    kategori: "Yeni oyun",
    etki: "yuksek",
    zahmet: "orta",
    gerekce: "Bozuk Telefon'un çizimsiz, hızlı ve sesli güldüren kardeşi; 3 dakikada biter.",
    tasarim: {
      tur: "yeni-oyun",
      oyuncu: { enAz: 4, enCok: 8 },
      sureDk: 3,
      oyunTuru: ["yazi", "parti"],
      kurallar: [
        "İlk oyuncuya gizli bir kelime gelir.",
        "Her oyuncu önceki ipucunu görür ve 2 kelimelik yeni bir ipucu yazar (20 sn).",
        "Son oyuncu ilk kelimeyi tahmin eder.",
        "Zincir sonda baştan sona herkese gösterilir.",
      ],
      eglence: "Zincirin nerede koptuğunu görmek; 'bunu nasıl yazdın!' anı.",
      ekranlar: [
        "Sıradakine: önceki ipucu ve iki kelimelik yazı alanı.",
        "Sırası gelmeyene: zincirin ilerlediği hareketli çizgi.",
        "Sonda: zincir kart kart açılır.",
      ],
      tv: "Zincir TV'de soldan sağa açılır; izleyici kopma noktasına oy verir.",
      puanlama: "Doğru tahminde zincirdeki herkes +1; zinciri koparan ipucu (oyla) 0.",
      riskler: "Kırıcı ipucu: moderasyon süzgeci; ipucuna kelimenin kendisi yazılamaz.",
      fark: "Bozuk Telefon çizim ve yazıyı dönüştürür; burada yalnız kısa ipucu ve tek tahmin var.",
      benzerOyunlar: ["bozuk-telefon"],
    },
  },
  {
    ad: "Seri Bonusu",
    ozet: "Üst üste iki oyunda ilk üçe giren oyuncu bir sonraki oyunda küçük bir avantaj kartı seçer.",
    kategori: "Sistem",
    etki: "orta",
    zahmet: "orta",
    gerekce: "Kart sistemini oyun içi başarıya bağlar; geride kalanlar için yakalama kartıyla dengelenir.",
    tasarim: {
      tur: "sistem",
      kapsam: { tur: "tum", oyunlar: [] },
      nasil: [
        "Sunucu her oyun sonunda ilk üçü sayar.",
        "İki oyun üst üste ilk üçe giren 'seride' olur; adının yanında alev görünür.",
        "Seri bir sonraki kart seçiminde bir iyi kart seçeneği ekler; seri bozulunca kaybolur.",
      ],
      ornekAn:
        "Ayşe iki oyun üst üste ikinci; kart ekranında alevli ek seçenek açılıyor, masa 'yine mi!' diyor.",
      eglence: "Maç boyunca süreklilik ve rekabet hissi; seriyi bozmak da bir hedef olur.",
      etkilesim: "Kart sistemine (K2 seçenekleri) bir seçenek ekler; genel puan, Glix ve rozetlere dokunmaz.",
      denge: "Önde olanı daha öne itebilir: geride kalan üç oyuncuya da 'yakalama' seçeneği verilir.",
      uygulama: "Maç düzeyi sayaç + kart seçenek havuzu; oyun kodları değişmez.",
    },
  },
];
