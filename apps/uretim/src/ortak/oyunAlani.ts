/**
 * Oyun alanı (test2.glix) bağlantısının ortak tanımları (sunucu ve arayüz; sözleşme bölüm 13). Teslimler ön
 * kontrolden geçince test2'ye kendiliğinden yüklenir; sahip orada dener, Üretim Merkezi'nde kabul eder.
 */
import type { AlanId } from "./alanlar.js";

/** Bugün test2'ye kendiliğinden yüklenen alanlar: içerik havuzu satırları ve mağaza ürünleri. */
export const OYUN_ALANI_ALANLARI: readonly AlanId[] = ["icerik", "magaza"];
export const oyunAlaniAlaniMi = (alan: AlanId): boolean => OYUN_ALANI_ALANLARI.includes(alan);

/** Yapay zekâ isteminde ve talimatında kodla eklenen satır (model ya da talimat düzenlemesi çıkaramaz). */
export const OYUN_ALANI_SATIRI =
  "Teslimin test2'ye (oyun alanı: test2.glix.dgmcraft.online) kendiliğinden yüklenir; sahip orada dener.";

/** Öğenin test2 durumu. `bekliyor`: yüklenecek (bağlantı yok ya da sıradaki eşitleme). */
export type Test2Durumu = "yuklu" | "hata" | "geri_alindi" | "bekliyor";

export interface Test2Bilgisi {
  durum: Test2Durumu;
  /** "12 satır yüklendi" gibi kısa özet. */
  ozet: string;
  hata: string | null;
  zaman: number | null;
  /** test2'de açılacak adres (mağaza için mağaza sayfası). */
  baglanti: string;
}

export interface Test2Durum {
  /** URETIM_TEST2_URL ve anahtarı ayarlı mı. */
  ayarli: boolean;
  calisiyor: boolean;
  revision: string | null;
  /** Katman kimliği (gece sıfırlamasında değişir). */
  katman: string | null;
  sonDenetim: number | null;
  sonSifirlama: number | null;
  /** test2'deki taslak ürün sayısı (sunucunun bildirdiği). */
  taslak: number;
  yuklu: number;
  hata: number;
  baglanti: string;
  /** Son denetimde ulaşılamadıysa neden (Türkçe). */
  sorun: string | null;
}
