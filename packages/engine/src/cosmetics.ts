/**
 * Kozmetik mağaza kataloğu ve günün fırsatı (saf). Sunucu (satın alma, kuşanma, fiyat) ve istemci (görünüm,
 * geri sayım) aynı tabloyu kullanır. Sahip kararları: `docs/YOL-HARITASI.md` U18, ayrıntı `docs/HESAP.md`.
 *
 * Yeni bir tür eklemek: `COSMETIC_TYPES`'a satır, `Cosmetics`'e anahtar, `ITEMS`'a ürünler; istemcide türün çizicisi.
 * M2'de yalnız kodla çizilen üç tür var (unvan, ad efekti, çerçeve). M4'te kürsü karakteri gelir: `dans` (tek yuva) ve
 * her giysi yuvası kendi türüdür (`sapka`, `ust`; ileride alt, ayakkabı, aksesuar). Giysi türlerinin `group` alanı
 * `"giysi"`dir: mağaza hepsini tek "Giysiler" sekmesinde toplar, dolap yuva başına bölüm gösterir.
 *
 * Renk seçeneği (sonradan): kuşanılan değer ürün kimliğidir; renkli sürüm `kimlik~renk` biçimiyle aynı alanlara
 * sığar (`cosmetic_equipped.item_id` metindir), şema değişmez. Bugün hiçbir ürünün rengi yok.
 */
import { createRng } from "./rng.js";

export type CosmeticRarity = "siradan" | "nadir" | "efsanevi";

/** Nadirliğe göre fiyat (Glix). */
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
  /** Şapka ve üst giysi (kürsü karakteri). */
  hat?: string;
  top?: string;
}
export type CosmeticKey = keyof Cosmetics;

export type CosmeticTypeId = "unvan" | "ad-efekti" | "cerceve" | "dans" | "sapka" | "ust";

/** Varsayılan kürsü dansı (ücretsiz, kuşanılmadığında oynar). Dans dosyası `karakter/dans/<kimlik>.json`. */
export const DEFAULT_DANCE = "sevinc";
/** İkinci ve üçüncü için selam hareketi; satılmaz. */
export const PLACE_DANCE = "selam";

export interface CosmeticType {
  id: CosmeticTypeId;
  /** `Cosmetics` içindeki anahtar. */
  key: CosmeticKey;
  /** Tekil ad ("Lakap"), çoğul ad (sekme: "Lakaplar") ve ücretsiz temel seçeneğin adı. */
  name: string;
  plural: string;
  none: string;
  /** Mağazada aynı sekmeyi paylaşan türler ("giysi"); yoksa tür kendi sekmesidir. */
  group?: "giysi";
}

export const COSMETIC_TYPES: readonly CosmeticType[] = [
  { id: "unvan", key: "title", name: "Lakap", plural: "Lakaplar", none: "Yok" },
  { id: "ad-efekti", key: "nameFx", name: "Ad efekti", plural: "Ad efektleri", none: "Yok" },
  { id: "cerceve", key: "frame", name: "Çerçeve", plural: "Çerçeveler", none: "Yok" },
  // Dansın "yok" seçeneği varsayılan dans Sevinç'tir (ücretsiz; katalogda ürün olarak yer almaz).
  { id: "dans", key: "dance", name: "Dans", plural: "Danslar", none: "Sevinç" },
  { id: "sapka", key: "hat", name: "Şapka", plural: "Şapkalar", none: "Yok", group: "giysi" },
  { id: "ust", key: "top", name: "Üst", plural: "Üstler", none: "Yok", group: "giysi" },
];

export interface CosmeticItem {
  id: string;
  type: CosmeticTypeId;
  rarity: CosmeticRarity;
  /** Liste fiyatı (Glix); nadirlikten türer. Fırsat indirimi `dailyDeals` ile ayrıca hesaplanır. */
  price: number;
  name: string;
  description: string;
  /**
   * Karakter varlığı: `dans` için dans dosyasının kimliği (`karakter/dans/<asset>.json`), giysi için `rig.json`
   * `wardrobe` katmanının adı (şapka `sapka`, ceket `ceket`).
   */
  asset?: string;
}

function item(
  id: string,
  type: CosmeticTypeId,
  rarity: CosmeticRarity,
  name: string,
  description: string,
  asset?: string,
): CosmeticItem {
  return { id, type, rarity, price: COSMETIC_PRICES[rarity], name, description, ...(asset ? { asset } : {}) };
}

export const COSMETIC_ITEMS: readonly CosmeticItem[] = [
  item("unvan-parti-canavari", "unvan", "siradan", "Parti Canavarı", "Adının altında herkes görsün."),
  item("unvan-sessiz-tehlike", "unvan", "siradan", "Sessiz Tehlike", "Az konuşur, çok kazanır."),
  item("unvan-sansli", "unvan", "siradan", "Şanslı", "Zar hep senin yanında."),
  item("unvan-taktikci", "unvan", "siradan", "Taktikçi", "Her hamle hesaplı."),
  item("unvan-bluf-ustasi", "unvan", "nadir", "Blöf Ustası", "Yüzünden hiçbir şey anlaşılmaz."),
  item("unvan-son-saniyeci", "unvan", "nadir", "Son Saniyeci", "İş son saniyede biter."),
  item("unvan-efsane", "unvan", "efsanevi", "Efsane", "Masanın en büyük adı."),
  item("ad-neon-mavi", "ad-efekti", "siradan", "Neon Mavi", "Adın mavi neon gibi parlar."),
  item("ad-neon-pembe", "ad-efekti", "siradan", "Neon Pembe", "Adın pembe neon gibi parlar."),
  item("ad-gokkusagi", "ad-efekti", "nadir", "Gökkuşağı", "Adının renkleri yavaşça akar."),
  item("ad-kivilcim", "ad-efekti", "nadir", "Kıvılcım", "Adın hafifçe kıvılcım saçar."),
  item("ad-altin-parilti", "ad-efekti", "efsanevi", "Altın Parıltı", "Adın altın gibi parlar."),
  item("cerceve-camgobegi", "cerceve", "siradan", "Camgöbeği Halka", "Avatarını camgöbeği halka sarar."),
  item("cerceve-pembe", "cerceve", "siradan", "Pembe Halka", "Avatarını pembe halka sarar."),
  item("cerceve-cift", "cerceve", "nadir", "Çift Halka", "İç içe iki ince halka."),
  item("cerceve-donen-neon", "cerceve", "nadir", "Dönen Neon", "Avatarının çevresinde dönen neon."),
  item("cerceve-altin-tac", "cerceve", "efsanevi", "Altın Taç Halkası", "Taçlı altın halka."),
  item("dans-twist", "dans", "siradan", "Twist", "Kalçalar sağa sola, ayaklar yerde.", "twist"),
  item("dans-tavuk", "dans", "siradan", "Tavuk Dansı", "Kanatlar çırpılır, kuyruk sallanır.", "tavuk"),
  item("dans-mutlu", "dans", "siradan", "Neşeli Adım", "Gülümseten, hafif adımlı bir dans.", "mutlu"),
  item("dans-charleston", "dans", "nadir", "Charleston", "Eski zaman, yeni neon.", "charleston"),
  item("dans-lambada", "dans", "nadir", "Lambada", "Kalçalar dalgalanır.", "lambada"),
  item("dans-makarena", "dans", "nadir", "Makarena", "Kollar sırayla, sonra bir dönüş.", "makarena"),
  item("dans-kazacok", "dans", "efsanevi", "Kazaçok", "Çömel, tekmele, zıpla.", "kazacok"),
  item(
    "dans-cizgi-film",
    "dans",
    "efsanevi",
    "Çizgi Film Dansı",
    "Eski bir çizgi filmden fırlamış gibi.",
    "mickey",
  ),
  item("sapka-neon-kep", "sapka", "siradan", "Neon Kep", "Kürsüde başında neon bir kep.", "sapka"),
  item("ust-neon-bomber", "ust", "nadir", "Neon Bomber", "Kürsüde sırtında neon bomber ceket.", "ceket"),
];

const BY_ID: ReadonlyMap<string, CosmeticItem> = new Map(COSMETIC_ITEMS.map((i) => [i.id, i]));

export function cosmeticItem(id: string): CosmeticItem | undefined {
  return BY_ID.get(id);
}

export function cosmeticType(id: CosmeticTypeId): CosmeticType {
  const t = COSMETIC_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`bilinmeyen kozmetik türü: ${id}`);
  return t;
}

/** Bir türün ürünleri (katalog sırasıyla). */
export function itemsOfType(type: CosmeticTypeId): CosmeticItem[] {
  return COSMETIC_ITEMS.filter((i) => i.type === type);
}

/** Kuşanılanları oyunculara giden `Cosmetics` alanına çevirir; bilinmeyen/yanlış türdeki kimlik atlanır. */
export function cosmeticsFromEquipped(equipped: Readonly<Record<string, string>>): Cosmetics | undefined {
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    const id = equipped[t.id];
    if (id === undefined) continue;
    const it = BY_ID.get(id);
    if (it && it.type === t.id) out[t.key] = id;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Ağdan gelen `cosmetics` alanını doğrular: yalnız katalogda olan ve doğru türdeki kimlikler kalır, gerisi atılır.
 * Hiçbir şey kalmadıysa `undefined`.
 */
export function parseCosmetics(raw: unknown): Cosmetics | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    const id = rec[t.key];
    if (typeof id !== "string") continue;
    const it = BY_ID.get(id);
    if (it && it.type === t.id) out[t.key] = id;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---- Günün fırsatı ----

const DAY_MS = 24 * 3600 * 1000;
const ISTANBUL_OFFSET_MS = 3 * 3600 * 1000;

/** Fırsattaki ürün sayısı ve indirim oranı (yüzde). */
export const DEAL_COUNT = 2;
export const DEAL_DISCOUNT_PERCENT = 30;

/** İstanbul takvim günü numarası (1970-01-01 = 0). Türkiye yıl boyu UTC+3. */
export function istanbulDayNumber(ms: number): number {
  return Math.floor((ms + ISTANBUL_OFFSET_MS) / DAY_MS);
}

/** Sonraki İstanbul gece yarısı (UTC ms); fırsat o ana kadar geçerlidir. */
export function nextIstanbulMidnight(ms: number): number {
  return (istanbulDayNumber(ms) + 1) * DAY_MS - ISTANBUL_OFFSET_MS;
}

/** İndirimli fiyat: liste fiyatının %70'i, en yakın 5'e yuvarlanır. */
export function dealPrice(listPrice: number): number {
  return Math.round((listPrice * (100 - DEAL_DISCOUNT_PERCENT)) / 100 / 5) * 5;
}

export interface DailyDeal {
  itemId: string;
  /** İndirimli fiyat. */
  price: number;
  /** Liste fiyatı (üstü çizili gösterilir). */
  listPrice: number;
}

/**
 * O İstanbul gününün fırsatları: ücretli ürünlerden gün numarasıyla tohumlanan karıştırmadan ilk `DEAL_COUNT`
 * tanesi (farklı). Aynı gün her yerde aynı sonucu verir.
 */
export function dailyDeals(ms: number): DailyDeal[] {
  const paid = COSMETIC_ITEMS.filter((i) => i.price > 0);
  const rng = createRng(Math.imul(istanbulDayNumber(ms), 0x9e3779b1) ^ 0x51ed270b);
  return rng
    .shuffle(paid)
    .slice(0, DEAL_COUNT)
    .map((i) => ({ itemId: i.id, price: dealPrice(i.price), listPrice: i.price }));
}

/** Ürünün o anda geçerli fiyatı (fırsattaysa indirimli); ürün yoksa null. */
export function currentPrice(itemId: string, ms: number): number | null {
  const it = BY_ID.get(itemId);
  if (!it) return null;
  return dailyDeals(ms).find((d) => d.itemId === itemId)?.price ?? it.price;
}
