/**
 * Teslim paketi biçimi (sözleşme bölüm 11): SSH ile çalışan yapay zekâ `gelen/<paket>/` klasörüne dosyalarını ve
 * kökte **teslim.json** dosyasını koyar. `uretim ornek-paket` (MCP: `paket_bicimi`) alanına uygun doldurulmuş bir
 * örnek ve alan açıklamaları verir. SSH'ta dosyalar `dosya` (paketteki dosya adı) ile anılır; MCP'de önce
 * `dosya_yukle` ile yüklenir ve `dosyaId` yazılır.
 */
import { type AlanId, alanTanimi } from "./alanlar.js";
import { gorselAlaniMi } from "./gorselKurali.js";

export const TESLIM_DOSYASI = "teslim.json";

/** SSH isteminde ve talimatta kodla eklenen satır (model çıkaramaz). */
export const PAKET_SATIRI =
  "Paketin kökünde teslim.json olmalı (paket.json ya da başka ad değil); biçim için önce `uretim ornek-paket` çalıştır.";

/** Test alanında ikinci aşamaya kalanlar (talimatta ve paket biçiminde açıkça yazılır). */
export const TEST_SINIRI =
  "Test koşusu başlatma ve zamanlayıcı (ör. 12 saatte bir koşu) henüz yok; yalnız senaryo/rapor teslim edersin.";

export interface PaketBicimi {
  alan: AlanId;
  dosyaAdi: typeof TESLIM_DOSYASI;
  /** Doldurulmuş örnek (SSH biçimi: `dosya`). */
  teslimJson: Record<string, unknown>;
  alanlar: string[];
  adimlar: string[];
}

const ORTAK_ALANLAR = [
  'tur: "yeni" | "duzenleme" | "kaldirma-onerisi" | "rapor" | "fikir" (zorunlu).',
  "isId: bağlı iş kimliği (isleri-listele); işsiz teslimde yazma.",
  "arac / model: kullandığın araç ve model (isteğe bağlı, ör. Codex).",
  "ogeler: 1–50 öğe. Her öğede ad (zorunlu, ≤ 60), aciklama (≤ 500), gerekce (≤ 1000).",
  "ogeler[].dosyalar: [{ dosya, hedefYol, rol }]. dosya = paketteki dosya adı (küçük harf, rakam, . _ -); hedefYol = oyundaki yeri.",
  "ogeler[].satirlar: alanın katalog/havuz satırları (alan biçiminde nesneler).",
  "Bilinmeyen alan reddedilir. Ayrıntı: talimat-oku.",
];

function ornek(alan: AlanId): Record<string, unknown> {
  const a = alanTanimi(alan);
  const onek = a.hedefOnekleri.find((o) => o.endsWith("/")) ?? "";
  const temel = { tur: "yeni", isId: 12, arac: "Codex", model: "örnek-model" };
  switch (alan) {
    case "test":
      return {
        ...temel,
        ogeler: [
          {
            ad: "Butona Bas 5 oyuncu senaryosu",
            aciklama: "Beş oyuncuyla tam bir maç; biri ortada bağlantıyı koparıp geri gelir.",
            gerekce: "Yeniden bağlanmada skor tablosu takılıyor mu görmek için.",
            dosyalar: [{ dosya: "butona-bas-5.json", hedefYol: `${onek}butona-bas-5.json`, rol: "senaryo" }],
          },
        ],
      };
    case "icerik":
      return {
        ...temel,
        ogeler: [
          {
            ad: "Okul temalı çiftler",
            gerekce: "Sızma'da okul teması az.",
            satirlar: [
              { havuz: "sizma/ciftler", alanlar: { a: "silgi", b: "kalemtıraş" } },
              { havuz: "sizma/ciftler", alanlar: { a: "teneffüs", b: "öğle arası" } },
            ],
          },
        ],
      };
    case "moderasyon":
      return {
        ...temel,
        ogeler: [
          {
            ad: "Rakamla yazılan küfürler",
            gerekce: "Süzgeci atlatıyorlar.",
            satirlar: [{ kalip: "örnek-kalıp", tur: "kufur" }],
          },
        ],
      };
    case "magaza":
      return {
        ...temel,
        uretimYontemi: "gorsel-model",
        ogeler: [
          {
            ad: "Kor Halka çerçevesi",
            aciklama: "Ağır ağır dönen kor halka.",
            gerekce: "Ateş koleksiyonunun ilk ürünü.",
            dosyalar: [{ dosya: "kor-halka.png", hedefYol: `${onek}cerceve/kor-halka.webp`, rol: "doku" }],
            satirlar: [
              {
                id: "cerceve-kor-halka",
                type: "cerceve",
                rarity: "nadir",
                price: 450,
                name: "Kor Halka",
                description: "Ağır ağır dönen kor halka.",
                satista: true,
                efekt: {
                  motor: "donen-halka",
                  parametreler: { doku: "cerceve/kor-halka.webp", donusHizi: 8 },
                },
              },
            ],
            onizleme: { ekran: "magaza-kart" },
          },
        ],
      };
    case "ses":
    case "muzik":
      return {
        ...temel,
        ogeler: [
          {
            ad: alan === "ses" ? "Tokmak sesi" : "Lobi döngüsü",
            gerekce: "Var olan ses çok sert.",
            dosyalar: [
              {
                dosya: alan === "ses" ? "tokmak.ogg" : "lobi.ogg",
                hedefYol: `${onek}${alan === "ses" ? "tokmak.ogg" : "lobi.ogg"}`,
              },
            ],
          },
        ],
      };
    case "uretim-arayuz":
    case "panel-arayuz":
      return {
        ...temel,
        ogeler: [
          {
            ad: "Toplu onay başparmak bölgesinde",
            gerekce: "Telefonda düğmeye ulaşmak zor.",
            dosyalar: [
              { dosya: "toplu-onay.md", hedefYol: `${onek}toplu-onay.md`, rol: "belge" },
              { dosya: "toplu-onay.png", hedefYol: `${onek}toplu-onay.png`, rol: "taslak" },
            ],
          },
        ],
      };
    default:
      // Görsel alanları (rozet, kartlar, ikon, efekt): görsel + (varsa) katalog satırı.
      return {
        ...temel,
        ...(gorselAlaniMi(alan) ? { uretimYontemi: "gorsel-model" } : {}),
        ogeler: [
          {
            ad: "Örnek görsel",
            aciklama: "Kısa açıklama.",
            gerekce: "Neden gerekli.",
            dosyalar: [{ dosya: "ornek.png", hedefYol: `${onek}ornek.webp` }],
          },
        ],
      };
  }
}

export function paketBicimi(alan: AlanId): PaketBicimi {
  const ozel: string[] = [];
  if (alan === "test")
    ozel.push(
      "Senaryo dosyası JSON: { oyun, oyuncu, strateji, beklenen } (oyun kimliği oyundaki gibi, oyuncu sayısı oyunun sınırında).",
      'Rapor teslimi: tur "rapor", öğede rapor nesnesi (adımlar, sıklık, etkilenen oyun, olası neden, öneri).',
      TEST_SINIRI,
    );
  if (gorselAlaniMi(alan))
    ozel.push('uretimYontemi: "gorsel-model" (görseller görsel üretim becerisiyle; "kod" reddedilir).');
  if (alan === "icerik") ozel.push("Bu alan dosya teslim etmez; yalnız satirlar.");
  return {
    alan,
    dosyaAdi: TESLIM_DOSYASI,
    teslimJson: ornek(alan),
    alanlar: [...ORTAK_ALANLAR, ...ozel],
    adimlar: [
      "SFTP ile gelen/<paket>/ klasörü aç (paket adı: küçük harf, rakam, . _ -).",
      "Dosyalarını ve kökte teslim.json'u koy (dosya adları teslim.json'daki `dosya` ile aynı).",
      "uretim on-kontrol <paket> ile denetle; geçince uretim teslim-et <paket>.",
      "MCP'de aynı biçim: dosyaları önce dosya_yukle ile yükle, `dosya` yerine dönen `dosyaId`yi yaz.",
    ],
  };
}
