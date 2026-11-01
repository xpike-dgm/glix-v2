/**
 * Teslim paketi biçimi (sözleşme bölüm 11): SSH ile çalışan yapay zekâ `gelen/<paket>/` klasörüne dosyalarını ve
 * kökte **teslim.json** dosyasını koyar. `uretim ornek-paket` (MCP: `paket_bicimi`) alanına uygun doldurulmuş bir
 * örnek ve alan açıklamaları verir. SSH'ta dosyalar `dosya` (paketteki dosya adı) ile anılır; MCP'de önce
 * `dosya_yukle` ile yüklenir ve `dosyaId` yazılır.
 */
import { type AlanId, alanTanimi } from "./alanlar.js";
import { gorselAlaniMi } from "./gorselKurali.js";
import { ORNEK_RAPOR } from "./rapor.js";

export const TESLIM_DOSYASI = "teslim.json";

/** Bir pakette en çok dosya (teslim.json ve TAMAM hariç) ve toplam boyut. */
export const EN_COK_PAKET_DOSYASI = 200;
export const EN_COK_PAKET_MB = 45;
export const PAKET_SINIRLARI = `Paket sınırları: en çok ${EN_COK_PAKET_DOSYASI} dosya, toplam ${EN_COK_PAKET_MB} MB; öğe başına en çok 40 dosya (fazlasını birkaç öğeye böl), teslimde en çok 50 öğe; tek dosya en çok 20 MB (görsel) / 30 MB (ses) / 2 MB (metin); günde en çok 500 dosya. Alt klasör ve bağlantı (symlink) yok. on-kontrol ve teslim-et paketi tek istekte işler.`;

/** SSH isteminde ve talimatta kodla eklenen satır (model çıkaramaz). */
export const PAKET_SATIRI =
  "Paketin kökünde teslim.json olmalı (paket.json ya da başka ad değil); biçim için önce `uretim ornek-paket` çalıştır.";

/** Test alanında ikinci aşamaya kalanlar (talimatta ve paket biçiminde açıkça yazılır). */
export const TEST_SINIRI =
  "Bot koşusu: test_kosusu_baslat ile test2'de yalnız botlarla koşu başlat (oyunlar, oyuncular ör. [3,5,8], mac, strateji oyna|rastgele); bitince sonuç rapor olarak kendiliğinden teslim edilir (bulgular dahil). test_kosusu_durum ile izle, test_kosusu_iptal ile durdur (SSH: uretim test-kosusu-baslat < json, test-kosusu-durum, test-kosusu-iptal). Aynı anda tek koşu; dönemli koşuyu sahip ayarlar.";

/** Talimatın sonundaki sabit bölüm: fikir ve rapor teslim biçimi (sahibin metninden bağımsız, kodla eklenir). */
export const FIKIR_RAPOR_BOLUMU = `## Fikir ve rapor biçimi
- **Fikir** (\`tur: "fikir"\`): her öğe bir fikir; \`ad\` (başlık), \`ozet\` (tek cümle), \`kategori\`, \`etki\`
  (dusuk/orta/yuksek), \`zahmet\` (kucuk/orta/buyuk), \`gerekce\`; isteğe bağlı küçük önizleme görseli. Sahip
  fikirleri panoda süzer, onaylar ya da not yazar.
- **Onaylananları uygula**: \`is_oku\` işin \`fikirler\` listesini (fikirId, baslik, ozet, not) verir; teslimde her
  öğede uyguladığın fikrin \`fikirId\`sini yaz. Teslim kabul edilince fikir kendiliğinden ilerler.
- **Rapor** (\`tur: "rapor"\`): öğede \`rapor\` nesnesi: \`ozet\` kutucukları ({ ad, deger, birim, onceki, iyi }),
  \`seriler\` ({ ad, tur: cizgi|cubuk, etiketler, degerler, esik }), \`tablolar\` ({ ad, sutunlar, satirlar }),
  \`bulgular\` ({ baslik, onem: kritik|yuksek|orta|dusuk, oyun, adimlar, kanit, oneri }). Sahip grafikli panoda
  görür, önceki raporla karşılaştırır, bulgudan iş açar.
- Örnekler: \`paket_bicimi\` (SSH: \`uretim ornek-paket\`) → \`ornekler.fikir\`, \`ornekler.rapor\`.
`;

export interface PaketBicimi {
  alan: AlanId;
  dosyaAdi: typeof TESLIM_DOSYASI;
  /** Doldurulmuş örnek (SSH biçimi: `dosya`). */
  teslimJson: Record<string, unknown>;
  alanlar: string[];
  adimlar: string[];
  /** Fikir ve rapor teslimi örnekleri (her alanda aynı biçim). */
  ornekler: { fikir: Record<string, unknown>; rapor: Record<string, unknown> };
}

const ORTAK_ALANLAR = [
  'tur: "yeni" | "duzenleme" | "kaldirma-onerisi" | "rapor" | "fikir" (zorunlu). Fikir ve rapor örnekleri: ornekler.',
  "Fikir öğesi: ad, ozet, kategori, etki (dusuk/orta/yuksek), zahmet (kucuk/orta/buyuk), gerekce.",
  "Rapor öğesi: rapor { ozet, seriler, tablolar, bulgular } (ornekler.rapor).",
  "Onaylananları uygula işinde her öğeye fikirId (is-oku → fikirler).",
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
    alanlar: [...ORTAK_ALANLAR, PAKET_SINIRLARI, ...ozel],
    ornekler: {
      fikir: {
        tur: "fikir",
        isId: 12,
        ogeler: [
          {
            ad: "Okul koleksiyonu",
            ozet: "Teneffüs temalı 4 parçalık kozmetik seti.",
            kategori: "Koleksiyon",
            etki: "yuksek",
            zahmet: "orta",
            gerekce: "Eylül döneminde okul teması en çok aranan tema.",
          },
          {
            ad: "Rozet sesi",
            ozet: "Rozet kazanınca kısa bir zil.",
            kategori: "Ses",
            etki: "orta",
            zahmet: "kucuk",
            gerekce: "Kazanım anı sessiz kalıyor.",
          },
        ],
      },
      rapor: { tur: "rapor", ogeler: [{ ad: "Gece testi — 1 Kasım", rapor: ORNEK_RAPOR }] },
    },
    adimlar: [
      "SFTP ile gelen/<paket>/ klasörü aç (paket adı: küçük harf, rakam, . _ -).",
      "Dosyalarını ve kökte teslim.json'u koy (dosya adları teslim.json'daki `dosya` ile aynı).",
      "uretim on-kontrol <paket> ile denetle; geçince uretim teslim-et <paket>.",
      "MCP'de aynı biçim: dosyaları önce dosya_yukle ile yükle, `dosya` yerine dönen `dosyaId`yi yaz.",
    ],
  };
}
