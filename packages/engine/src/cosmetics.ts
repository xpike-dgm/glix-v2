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
  /** Liste fiyatı (Glix); nadirlikten türer. Fırsat indirimi `dailyDeals` ile ayrıca hesaplanır. */
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
  item(
    "kart-neon-izgara",
    "kart-arkasi",
    "siradan",
    "Neon Izgara",
    "Kart sırtında neon bir ızgara.",
    "neon-izgara",
  ),
  item(
    "kart-gece-sehri",
    "kart-arkasi",
    "siradan",
    "Gece Şehri",
    "Kartların sırtında ışıl ışıl bir şehir.",
    "gece-sehri",
  ),
  item(
    "kart-mor-girdap",
    "kart-arkasi",
    "nadir",
    "Mor Girdap",
    "Sırttaki mor girdap seni içine çeker.",
    "mor-girdap",
  ),
  item("kart-elektrik", "kart-arkasi", "nadir", "Elektrik", "Kartın sırtında elektrik akar.", "elektrik"),
  item(
    "kart-altin-kraliyet",
    "kart-arkasi",
    "efsanevi",
    "Altın Kraliyet",
    "Kraliyete yakışır altın sırt.",
    "altin-kraliyet",
  ),
  item(
    "zafer-konfeti",
    "zafer",
    "siradan",
    "Konfeti Patlaması",
    "Kazanınca renkli konfeti patlar.",
    "konfeti",
  ),
  item("zafer-balon", "zafer", "siradan", "Neon Balonlar", "Kazanınca neon balonlar yükselir.", "balon"),
  item(
    "zafer-havai-fisek",
    "zafer",
    "nadir",
    "Havai Fişek",
    "Kazanınca gökyüzü havai fişekle dolar.",
    "havai-fisek",
  ),
  item("zafer-simsek", "zafer", "nadir", "Şimşek Fırtınası", "Kazanınca şimşekler çakar.", "simsek"),
  item(
    "zafer-altin-yagmur",
    "zafer",
    "efsanevi",
    "Altın Yağmur",
    "Kazanınca altın ve yıldız yağar.",
    "altin-yagmur",
  ),
  item(
    "tepki-neon-yuzler",
    "tepki",
    "siradan",
    "Neon Yüzler",
    "Altı neon yüz ifadesi: gülen, şaşkın, sinirli…",
    "neon-yuzler",
  ),
  item("tepki-parti", "tepki", "nadir", "Parti", "Şapka, disko topu, kadeh ve daha fazlası.", "parti"),
  item(
    "tepki-efsane",
    "tepki",
    "efsanevi",
    "Efsane Tepkiler",
    "Taç, ateş topu, roket, elmas…",
    "efsane-tepkiler",
  ),
  item(
    "giris-isinlanma",
    "giris",
    "siradan",
    "Işınlanma",
    "Lobiye ışık huzmesiyle ışınlanırsın.",
    "isinlanma",
  ),
  item("giris-duman", "giris", "siradan", "Duman", "Lobiye dumanın içinden çıkarsın.", "duman"),
  item("giris-simsek", "giris", "nadir", "Şimşek", "Lobiye şimşek çakarak girersin.", "simsek"),
  item("giris-portal", "giris", "nadir", "Portal", "Lobiye bir portaldan geçersin.", "portal"),
  item(
    "giris-altin-isik",
    "giris",
    "efsanevi",
    "Altın Işık Sütunu",
    "Lobiye altın bir ışık sütunuyla inersin.",
    "altin-isik",
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
    if (t.key === null) continue;
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
    if (t.key === null) continue;
    const id = rec[t.key];
    if (typeof id !== "string") continue;
    const it = BY_ID.get(id);
    if (it && it.type === t.id) out[t.key] = id;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---- Resimli ürün dosyaları ----

/** Zafer kutlamasının parçacık görseli sayısı ve tepki paketinin çıkartma sayısı. */
export const CELEBRATION_SPRITES = 4;
export const STICKERS_PER_PACK = 6;

/** Ürünün `public/assets/shop/` altındaki tüm görselleri (göreli yol); resimsiz türlerde boş. */
export function cosmeticAssetFiles(it: CosmeticItem): string[] {
  const a = it.asset;
  if (!a) return [];
  const nth = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1);
  switch (it.type) {
    case "kart-arkasi":
      return [`kart-arkasi/${a}.webp`];
    case "zafer":
      return nth(CELEBRATION_SPRITES).map((n) => `zafer/${a}-${n}.webp`);
    case "tepki":
      return nth(STICKERS_PER_PACK).map((n) => `tepki/${a}-${n}.webp`);
    case "giris":
      return [`giris/${a}-zemin.webp`, `giris/${a}-isik.webp`];
    default:
      return [];
  }
}

/** Çıkartmaların ekran okuyucu adları (paket kimliği -> 6 ad, görsel sırasıyla). */
export const STICKER_NAMES: Readonly<Record<string, readonly string[]>> = {
  "neon-yuzler": ["Gülüyor", "Şaşkın", "Sinirli", "Ağlıyor", "Göz kırpıyor", "Uykulu"],
  parti: ["Parti şapkası", "Disko topu", "Kadeh tokuşturma", "Havai fişek", "Dans eden avatar", "Alkış"],
  "efsane-tepkiler": ["Altın taç", "Ateş topu", "Mikrofonu bırak", "Roket", "Elmas", "Şimşekli kupa"],
};

/** Tepki paketi çıkartmasının kimliği: `pack:<paketKimliği>:<1..6>` (`react` ve `reaction` mesajlarında). */
export type StickerId = `pack:${string}:${number}`;

export interface StickerRef {
  /** Paket ürünü (`tepki` türü). */
  item: CosmeticItem;
  /** 1..STICKERS_PER_PACK */
  n: number;
}

/** Çıkartma kimliğini çözer; biçim, paket ya da sıra katalogda yoksa null (ağdan gelen veri). */
export function parseStickerId(raw: unknown): StickerRef | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const m = /^pack:([a-z]+(?:-[a-z]+)*):([1-9])$/.exec(raw);
  if (!m) return null;
  const item = COSMETIC_ITEMS.find((i) => i.type === "tepki" && i.asset === m[1]);
  const n = Number(m[2]);
  return item && n >= 1 && n <= STICKERS_PER_PACK ? { item, n } : null;
}

export const stickerId = (item: CosmeticItem, n: number): StickerId => `pack:${item.asset ?? ""}:${n}`;

/** Çıkartmanın görsel yolu (`/assets/shop/` altında). */
export const stickerFile = (ref: StickerRef): string => `tepki/${ref.item.asset ?? ""}-${ref.n}.webp`;

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
