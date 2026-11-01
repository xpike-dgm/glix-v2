/** Sunucu ile arayüzün paylaştığı veri biçimleri (yalnız tipler ve küçük yardımcılar). */
import type { AlanId, DosyaTuru } from "./alanlar.js";
import type { Durum, HazirNotKodu } from "./durum.js";
import type { FikirAlanlari, UygulanacakFikir } from "./fikir.js";
import type { Test2Bilgisi, Test2Durum } from "./oyunAlani.js";

export type KontrolSonucu = "gecti" | "uyari" | "kaldi";
export type SatirSonucu = KontrolSonucu | "atlandi";

export interface KontrolSatiri {
  kod: string;
  grup: "ortak" | "gorsel" | "ses" | "metin" | "alan";
  sonuc: SatirSonucu;
  mesaj: string;
  dosya?: string;
  /** Liste teslimlerinde satır sırası (0'dan). */
  satir?: number;
}

export interface KontrolRaporu {
  sonuc: KontrolSonucu;
  satirlar: KontrolSatiri[];
}

/** Satırların en kötüsü (atlandı sayılmaz). */
export function toplamSonuc(satirlar: readonly KontrolSatiri[]): KontrolSonucu {
  if (satirlar.some((s) => s.sonuc === "kaldi")) return "kaldi";
  if (satirlar.some((s) => s.sonuc === "uyari")) return "uyari";
  return "gecti";
}

export type Gorunum =
  | "fikir"
  | "gorsel"
  | "animasyon"
  | "ses"
  | "muzik"
  | "liste"
  | "kart"
  | "wiki"
  | "rapor"
  | "metin";

export interface GorselMeta {
  tur: "gorsel";
  w: number;
  h: number;
  alfa: boolean;
}
export interface SesMeta {
  tur: "ses";
  sure: number;
  kanal: number;
  ornekleme: number;
  /** 0..1 arası 160 tepe (dalga biçimi). */
  dalga: number[];
}
export interface MetinMeta {
  tur: "metin";
  satir: number;
}
export type DosyaMeta = GorselMeta | SesMeta | MetinMeta;

export interface OgeDosyasi {
  dosyaId: string;
  ozet: string;
  ad: string;
  tur: DosyaTuru;
  boyut: number;
  hedefYol: string | null;
  rol: string | null;
  meta: DosyaMeta | null;
}

export type TeslimTuru = "yeni" | "duzenleme" | "kaldirma-onerisi" | "rapor" | "fikir" | "yama";
/** Bütün bilinen türler; `DESTEKLENEN_TURLER` dışındakiler kibarca reddedilir (yama: ikinci aşama, UM-İ11). */
export const TESLIM_TURLERI: readonly TeslimTuru[] = [
  "yeni",
  "duzenleme",
  "kaldirma-onerisi",
  "rapor",
  "fikir",
  "yama",
];
export const DESTEKLENEN_TURLER: readonly TeslimTuru[] = [
  "yeni",
  "duzenleme",
  "kaldirma-onerisi",
  "rapor",
  "fikir",
];
export const TESLIM_TURU_ADI: Record<TeslimTuru, string> = {
  yeni: "Yeni",
  duzenleme: "Düzenleme",
  "kaldirma-onerisi": "Kaldırma önerisi",
  rapor: "Rapor",
  fikir: "Fikir",
  yama: "Kod yaması",
};

export interface Degisiklik {
  id: string | null;
  eski: Record<string, unknown>;
  yeni: Record<string, unknown>;
}

export interface OgeOzeti {
  id: number;
  teslimId: number;
  alan: AlanId;
  isId: number | null;
  tur: TeslimTuru;
  ad: string;
  aciklama: string;
  gerekce: string;
  durum: Durum;
  gorunum: Gorunum;
  surum: number;
  oncekiId: number | null;
  kaynak: "mcp" | "elle";
  sonuc: KontrolSonucu;
  olusturma: number;
  karar: number | null;
  /** Kademeli güvenle otomatik onaylandı (UM-F4). */
  otomatik: boolean;
  /** Otomatik onaylananlardan sahibe denetime gelen. */
  denetim: boolean;
  /** Seçenek turunun işi (UM-F2). */
  varyantIs: number | null;
  /** Bu öğenin uyguladığı fikir (fikir panosu). */
  fikirId: number | null;
  /** Yapılandırılmış fikir alanları (yalnız fikir öğesinde). */
  fikir: FikirAlanlari | null;
  /** Oyun alanı (test2) durumu; test2'ye gitmeyen öğede yok. */
  test2?: Test2Bilgisi | null;
}

/** Köken kaydı (UM-F7). */
export interface Koken {
  alan: AlanId;
  talimatSurum: number | null;
  teslimId: number;
  isId: number | null;
  varyantIs: number | null;
  kaynak: "mcp" | "elle";
  onaylayan: string | null;
  otomatik: boolean;
  karar: number | null;
  paket: { id: number; klasor: string; revizyon: string | null } | null;
}

export interface OgeAyrinti extends OgeOzeti {
  /** Fikir teslimlerinde görünüş, renk ve hareket tarifi. */
  gorunus: string;
  dosyalar: OgeDosyasi[];
  satirlar: unknown[];
  degisiklikler: Degisiklik[];
  kaldirilacaklar: string[];
  onizleme: { ekran: string; not: string } | null;
  rapor: unknown;
  kontrol: KontrolRaporu;
  /** Onaylanan satırların sırası (liste teslimi); null = hepsi. */
  onayliSatirlar: number[] | null;
  notlar: NotKaydi[];
  koken: Koken;
  /** Aynı öğenin diğer sürümleri (en yeni üstte). */
  surumler: { id: number; surum: number; durum: Durum; olusturma: number }[];
}

export interface NotKaydi {
  id: number;
  ogeId: number | null;
  tur: "ret" | "duzeltme" | "yorum" | "otomatik" | "elestiri";
  hazir: HazirNotKodu | null;
  metin: string;
  olusturma: number;
}

export interface IsKaydi {
  id: number;
  alan: AlanId;
  baslik: string;
  aciklama: string;
  adet: number | null;
  sonTarih: string | null;
  ornek: string;
  kaynak: "sahip" | "yz" | "istek" | "benzer";
  durum: "oneri" | "acik" | "tamam" | "iptal";
  sira: number;
  olusturma: number;
  /** Görsel varyant sayısı; yalnız sahip açıkça isterse (en çok 2, UM-F2). */
  varyant: number | null;
  /** Fikir turu: önce metinle 2–3 fikir, sahip birini seçince tek üretim. */
  fikirTuru: boolean;
  secilenFikir: { ogeId: number; ad: string; aciklama: string; gorunus: string; not: string } | null;
  /** "Onaylananları uygula": işin uygulayacağı fikirler. */
  fikirler: UygulanacakFikir[];
  kisitlar: string[];
  kabul: string[];
  /** İstemde görünen kısa özet (UM-R1). */
  ozet: string;
  /** Yapay zekâ işi ilk kez okuduğunda (UM-R2 "başladı"). */
  basladi: number | null;
  teslimEdildi: number | null;
  /** İş kilidi (sözleşme bölüm 8): ham değer; 2 saat hareketsizlikte geçersiz sayılır. */
  kilit: { ad: string; zaman: number } | null;
  /** Oyun Tasarımı (bölüm 15): "gelistir" (sahibin notuyla yeni sürüm), "eleştiri" ya da sıradan iş (null). */
  isTuru: "gelistir" | "elestiri" | null;
  /** Yalnız bu anahtar görür ve alır (geliştir: kartın sahibi; eleştiri ve çoklu yapay zekâ: seçilen). */
  hedefAnahtar: { id: number; ad: string } | null;
  /** İşin ilgili kartı (geliştirilecek ya da eleştirilecek). */
  ilgiliOge: number | null;
  /** "Aynı isteği şu yapay zekâlara da ver" ile birlikte açılan işlerin grubu. */
  grup: string | null;
}

export interface IstekKarti {
  id: number;
  acanAlan: AlanId;
  istenenAlan: AlanId;
  ne: string;
  neden: string;
  sonTarih: string | null;
  durum: "bekliyor" | "onaylandi" | "reddedildi" | "tamam";
  isId: number | null;
  sonucOgeId: number | null;
  olusturma: number;
}

export interface KodIstegi {
  id: number;
  alan: AlanId;
  baslik: string;
  gerekce: string;
  ornek: string;
  etki: string;
  durum: "bekliyor" | "onaylandi" | "reddedildi" | "yapildi";
  olusturma: number;
}

export interface AlanKarti {
  alan: AlanId;
  bekleyen: number;
  sonTeslim: number | null;
  onayOrani7g: number | null;
  geriDonen24s: number;
  havuzda: number;
  /** Son gelen (geri dönmemiş) teslimin küçük önizlemesi. */
  son: { id: number; ad: string; durum: Durum; olusturma: number; kucuk: Kucuk | null } | null;
}

export type Kucuk =
  | { tur: "gorsel"; ogeId: number; ozet: string }
  | { tur: "dalga"; dalga: number[] }
  | { tur: "satirlar"; satirlar: string[] }
  | { tur: "metin"; metin: string };

export interface Uyari {
  seviye: "kirmizi" | "sari";
  metin: string;
  alan?: AlanId;
}

export interface Pano {
  alanlar: AlanKarti[];
  uyarilar: Uyari[];
  istekKartlari: IstekKarti[];
  kodIstekleri: KodIstegi[];
  talimatOnerileri: { alan: AlanId; hazir: HazirNotKodu; sayi: number }[];
  havuz: { toplam: number; tekTik: number; paketlenecek: number };
  geriDonen24s: number;
  kota: { kullanilan: number; sinir: number };
  bugun: { gelen: number; onaylanan: number; reddedilen: number; geriDonen: number };
  denetimBekleyen: number;
  ai: { acik: boolean; bugun: number; sinir: number };
  /** Oyun alanı (test2) bağlantısı: çalışıyor mu, sürüm, son sıfırlama. */
  test2?: Test2Durum;
}

export interface PaketKaydi {
  id: number;
  klasor: string;
  olusturma: number;
  ogeSayisi: number;
  revizyon: string | null;
  durum: "hazir" | "oyuna_eklendi" | "testte" | "canlida";
}

export interface AktarimKaydi {
  id: number;
  ogeId: number;
  tur: "havuz-ekle" | "havuz-kapat" | "moderasyon-ekle";
  hedef: string;
  oyunAktarimId: string;
  ozet: string;
  olusturma: number;
  geriAlindi: boolean;
}

export interface AlanSayfasi {
  alan: AlanId;
  bekleyenler: OgeOzeti[];
  isler: IsKaydi[];
  talimat: { surum: number; metin: string; olusturma: number } | null;
  talimatSurumleri: { surum: number; olusturma: number }[];
  anahtarlar: {
    id: number;
    onek: string;
    olusturma: number;
    iptal: number | null;
    sonKullanim: number | null;
    ad: string;
    kanal: string;
  }[];
  istatistik: {
    teslim: number;
    onay: number;
    ret: number;
    ortalamaInceleme: number | null;
    geriDonen: number;
  };
  kalanlariGoster: boolean;
  uygulama: { not: string; baglanti: "mcp" | "ssh" };
  araclar: { arac: string; kanal: string; teslim: number; onay: number; oran: number | null }[];
  sinir: {
    bekleyenTavan: number;
    gunlukKota: number;
    haftalikUst: number | null;
    bugun: number;
    hafta: number;
  };
  guven: {
    tur: TeslimTuru;
    acik: boolean;
    engel: string | null;
    oran: number | null;
    karar: number;
    uygun: boolean;
  }[];
  /** Oyun alanı (test2) bağlantısı; alan test2'ye yükleme yapmıyorsa yok. */
  test2?: Test2Durum;
}

export interface ZevkOrnegi {
  id: number;
  ogeId: number;
  tur: "onay" | "ret";
  ad: string;
  not: string;
  onemli: boolean;
  olusturma: number;
  kucuk: Kucuk | null;
}
