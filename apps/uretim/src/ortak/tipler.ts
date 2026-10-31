/** Sunucu ile arayüzün paylaştığı veri biçimleri (yalnız tipler ve küçük yardımcılar). */
import type { AlanId, DosyaTuru } from "./alanlar.js";
import type { Durum, HazirNotKodu } from "./durum.js";

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

export type Gorunum = "gorsel" | "animasyon" | "ses" | "muzik" | "liste" | "kart" | "wiki" | "rapor" | "metin";

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

export type TeslimTuru = "yeni" | "duzenleme" | "kaldirma-onerisi" | "rapor";
export const TESLIM_TURLERI: readonly TeslimTuru[] = ["yeni", "duzenleme", "kaldirma-onerisi", "rapor"];
export const TESLIM_TURU_ADI: Record<TeslimTuru, string> = {
  yeni: "Yeni",
  duzenleme: "Düzenleme",
  "kaldirma-onerisi": "Kaldırma önerisi",
  rapor: "Rapor",
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
}

export interface OgeAyrinti extends OgeOzeti {
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
  /** Aynı öğenin diğer sürümleri (en yeni üstte). */
  surumler: { id: number; surum: number; durum: Durum; olusturma: number }[];
}

export interface NotKaydi {
  id: number;
  ogeId: number | null;
  tur: "ret" | "duzeltme" | "yorum" | "otomatik";
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
}

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
}

export interface PaketKaydi {
  id: number;
  klasor: string;
  olusturma: number;
  ogeSayisi: number;
  revizyon: string | null;
  durum: "hazir" | "oyuna_eklendi" | "canlida";
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
  anahtarlar: { id: number; onek: string; olusturma: number; iptal: number | null; sonKullanim: number | null }[];
  istatistik: { teslim: number; onay: number; ret: number; ortalamaInceleme: number | null; geriDonen: number };
  kalanlariGoster: boolean;
}
