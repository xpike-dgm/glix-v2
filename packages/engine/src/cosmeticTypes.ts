/**
 * Kozmetik türleri ve ürün satırının biçimi (saf, bağımlılıksız). Katalog (`katalog/magaza.json`), doğrulayıcı
 * (`shopCatalog.ts`) ve kurallar (`cosmetics.ts`) bu dosyayı paylaşır; döngüsel içe aktarma olmasın diye ayrıdır.
 */
import type { EffectRecipe } from "./efekt.js";

export type CosmeticRarity = "siradan" | "nadir" | "efsanevi";

/** MG-2 öncesi nadirliğe göre sabit fiyat (Glix); bugünkü ürünler bu fiyatlarda kaldı. Yeni ürün kendi fiyatını taşır. */
export const COSMETIC_PRICES: Readonly<Record<CosmeticRarity, number>> = {
  siradan: 150,
  nadir: 400,
  efsanevi: 1000,
};

/** Oyunculara görünen kuşanılmış kozmetikler; yalnız dolu olanlar yazılır. Anahtarlar tür tablosundadır. */
export interface Cosmetics {
  title?: string;
  nameFx?: string;
  frame?: string;
  /** Kürsü dansı (`dans` türü); kuşanılmadıysa varsayılan dans. */
  dance?: string;
  /** Giysi yuvaları (kürsü karakteri); değer `kimlik` ya da `kimlik~renk`. */
  hat?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  accessory?: string;
  /** Tam kostüm: kapladığı yuvaların giysisini ezer. */
  costume?: string;
  /** Kart arkası (`kart-arkasi` türü); kuşanılmadıysa klasik sırt. */
  cardBack?: string;
  /** Zafer kutlaması (`zafer` türü); kazanan kuşandıysa final ekranında herkese oynar. */
  celebration?: string;
  /** Lobi giriş efekti (`giris` türü); lobiye girişte koltukta oynar. */
  entry?: string;
}
export type CosmeticKey = keyof Cosmetics;

export type CosmeticTypeId =
  | "unvan"
  | "ad-efekti"
  | "cerceve"
  | "dans"
  | "sapka"
  | "ust"
  | "alt"
  | "ayakkabi"
  | "aksesuar"
  | "kostum"
  | "kart-arkasi"
  | "zafer"
  | "tepki"
  | "giris";

/** Varsayılan kürsü dansı (ücretsiz, kuşanılmadığında oynar). Dans dosyası `karakter/dans/<kimlik>.json`. */
export const DEFAULT_DANCE = "sevinc";
/** İkinci ve üçüncü için selam hareketi; satılmaz. */
export const PLACE_DANCE = "selam";

export interface CosmeticType {
  id: CosmeticTypeId;
  /**
   * `Cosmetics` içindeki anahtar. `null`: tür kuşanılmaz, sahip olmak yeter (tepki paketleri); sunucu kuşanmayı
   * reddeder ve oyunculara kuşanılan olarak gitmez.
   */
  key: CosmeticKey | null;
  /** Tekil ad ("Lakap"), çoğul ad (sekme: "Lakaplar") ve ücretsiz temel seçeneğin adı. */
  name: string;
  plural: string;
  none: string;
  /** Mağazada aynı sekmeyi paylaşan türler ("giysi"); yoksa tür kendi sekmesidir. */
  group?: "giysi";
}

/** Kuşanılabilir mi (tek yuvalı)? Tepki paketleri değildir: alınan paket hep kullanılabilir. */
export const isEquippable = (type: CosmeticType): boolean => type.key !== null;

export const COSMETIC_TYPES: readonly CosmeticType[] = [
  { id: "unvan", key: "title", name: "Lakap", plural: "Lakaplar", none: "Yok" },
  { id: "ad-efekti", key: "nameFx", name: "Ad efekti", plural: "Ad efektleri", none: "Yok" },
  { id: "cerceve", key: "frame", name: "Çerçeve", plural: "Çerçeveler", none: "Yok" },
  // Dansın "yok" seçeneği varsayılan dans Sevinç'tir (ücretsiz; katalogda ürün olarak yer almaz).
  { id: "dans", key: "dance", name: "Dans", plural: "Danslar", none: "Sevinç" },
  { id: "sapka", key: "hat", name: "Şapka", plural: "Şapkalar", none: "Yok", group: "giysi" },
  { id: "ust", key: "top", name: "Üst", plural: "Üstler", none: "Yok", group: "giysi" },
  { id: "alt", key: "bottom", name: "Alt", plural: "Altlar", none: "Yok", group: "giysi" },
  { id: "ayakkabi", key: "shoes", name: "Ayakkabı", plural: "Ayakkabılar", none: "Yok", group: "giysi" },
  { id: "aksesuar", key: "accessory", name: "Aksesuar", plural: "Aksesuarlar", none: "Yok", group: "giysi" },
  { id: "kostum", key: "costume", name: "Kostüm", plural: "Kostümler", none: "Yok", group: "giysi" },
  // Kart arkasının "yok" seçeneği klasik sırttır (ücretsiz, katalogda ürün olarak yer almaz).
  { id: "kart-arkasi", key: "cardBack", name: "Kart arkası", plural: "Kart arkaları", none: "Klasik" },
  // Zaferin "yok" seçeneği her finaldeki klasik konfetidir.
  {
    id: "zafer",
    key: "celebration",
    name: "Zafer kutlaması",
    plural: "Zafer kutlamaları",
    none: "Klasik konfeti",
  },
  // Paketler kuşanılmaz: sahip olunan her paketin çıkartmaları tepki yelpazesine eklenir.
  { id: "tepki", key: null, name: "Tepki paketi", plural: "Tepki paketleri", none: "Yok" },
  { id: "giris", key: "entry", name: "Giriş efekti", plural: "Giriş efektleri", none: "Yok" },
];

export interface CosmeticItem {
  id: string;
  type: CosmeticTypeId;
  rarity: CosmeticRarity;
  /**
   * Liste fiyatı (Glix), ürün başına (MG-2); nadirliğin aralığında olmalı (`SHOP_PRICE_RANGES`). Fırsat indirimi
   * `dailyDeals` ile bu fiyattan hesaplanır. Fiyat değişikliği ileriye dönüktür (önceki alımlara dokunmaz).
   */
  price: number;
  name: string;
  description: string;
  /**
   * Karakter varlığı: `dans` için dans dosyasının kimliği (`karakter/dans/<asset>.json`), giysi için `rig.json`
   * `wardrobe` katmanının adı (şapka `sapka`, ceket `ceket`). Resimli türlerde `public/assets/shop/` altındaki
   * dosya öneki: kart arkası `kart-arkasi/<asset>.webp`, zafer `zafer/<asset>-1..4.webp`, tepki paketi
   * `tepki/<asset>-1..6.webp` (paket kimliği de budur), giriş `giris/<asset>-zemin|isik.webp`.
   */
  asset?: string;
  /**
   * Yalnız kostüm: kapladığı giysi yuvaları. Kuşanılınca bu yuvalardaki giysiler çıkar (kostüm onların yerini
   * tutar). Parçalarının kemiklerinden türer (`coveredSlots`); katalog testi rig.json ile eşitliği denetler.
   */
  covers?: readonly CosmeticTypeId[];
  /**
   * Satışta mı (MG-3). `false`: mağazada görünmez ve satın alınamaz; sahibi kuşanmaya ve kullanmaya devam eder.
   */
  satista: boolean;
  /** Koleksiyon adı (ör. "Neon Gece"); aynı koleksiyondan iki ve üstü ürün satıştaysa mağazada şerit olur. */
  koleksiyon?: string;
  /** Çıkış tarihi `YYYY-MM-DD` (İstanbul günü): o günden önce mağazada görünmez ve satın alınamaz. */
  cikis?: string;
  /** Efekt tarifi (MG-4): ad efekti ve çerçeve gibi kodla çizilen türlerin görünümü (`EFFECT_ENGINES`). */
  efekt?: EffectRecipe;
}
