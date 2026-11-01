/**
 * Kozmetik mağaza kuralları ve günün fırsatı (saf). Sunucu (satın alma, kuşanma, fiyat) ve istemci (görünüm,
 * geri sayım) aynı tabloyu kullanır. Sahip kararları: `docs/YOL-HARITASI.md` U18, ayrıntı `docs/HESAP.md`.
 *
 * Ürünler kodda değil, `katalog/magaza.json` dosyasındadır (MG-1; doğrulama `shopCatalog.ts`). Türler ve ürün
 * satırının biçimi `cosmeticTypes.ts`'tedir. Yeni bir tür eklemek: `COSMETIC_TYPES`'a satır, `Cosmetics`'e anahtar,
 * katalog dosyasına ürünler; istemcide türün çizicisi.
 *
 * Giysi yuvaları: şapka, üst, alt, ayakkabı, aksesuar ve tam kostüm (`GIYSI_SIRASI`). Boş yuva (katalogda ürünü
 * olmayan tür) arayüzde gösterilmez. Kostüm kuşanılınca kapladığı yuvaların giysisi çıkar (`covers`, bkz. `lookRules`).
 *
 * Renk seçeneği: her giysi beş neon renkle giyilir (`CLOTHING_COLOURS`; çizimin camgöbeği varsayılandır). Kuşanılan
 * değer `kimlik` (varsayılan renk) ya da `kimlik~renk`tir; `cosmetic_equipped.item_id` metindir, şema değişmez.
 * Renk yalnız giysinin neon vurgusunu boyar (istemci süzgeci). Sahiplik kuralı `COLOUR_MODE` ile tek yerden seçilir.
 *
 * Satış (MG-3): `satista: false` ya da çıkış tarihi (`cikis`) gelmemiş ürün mağazada görünmez ve satın alınamaz
 * (`isOnSale`); sahibi kuşanmaya devam eder (kimlik doğrulaması tüm katalogla yapılır).
 */
import {
  COSMETIC_TYPES,
  type CosmeticItem,
  type Cosmetics,
  type CosmeticType,
  type CosmeticTypeId,
} from "./cosmeticTypes.js";
import { createRng } from "./rng.js";
import { SHOP_CATALOG_ITEMS } from "./shopCatalog.js";

export * from "./cosmeticTypes.js";

/** Bütün ürünler (satıştan kalkanlar dahil: sahipleri kullanmaya devam eder), katalog dosyası sırasıyla. */
export const COSMETIC_ITEMS: readonly CosmeticItem[] = SHOP_CATALOG_ITEMS;

const BY_ID: ReadonlyMap<string, CosmeticItem> = new Map(COSMETIC_ITEMS.map((i) => [i.id, i]));

/**
 * Önizleme katmanı: Üretim Merkezi'nden gelen taslak ürün satırları kataloğun üstüne bellekte eklenir, böylece oyunun
 * gerçek bileşenleri taslağı çizebilir. İki yerde kullanılır:
 * - istemcinin `onizleme.html` sayfası (yalnız çizim);
 * - oyun alanı (`GLIX_ORTAM=test2`): sunucu ve istemci taslak katmanını (`oyunAlani.ts`) buraya koyar; taslak ürünler
 *   sahte hesaplarla satın alınıp kuşanılabilir. Canlıda ve test'te hiç çağrılmaz: katman boştur ve satın alma,
 *   kuşanma yalnız katalog dosyasıyla doğrulanır.
 */
let previewItems: ReadonlyMap<string, CosmeticItem> | null = null;

/** Taslak satırları önizleme katmanına koyar (`null` temizler). Yalnız önizleme sayfası çağırır. */
export function setPreviewItems(items: readonly CosmeticItem[] | null): void {
  previewItems = items && items.length > 0 ? new Map(items.map((i) => [i.id, i])) : null;
}

export function cosmeticItem(id: string): CosmeticItem | undefined {
  return previewItems?.get(id) ?? BY_ID.get(id);
}

export function cosmeticType(id: CosmeticTypeId): CosmeticType {
  const t = COSMETIC_TYPES.find((x) => x.id === id);
  if (!t) throw new Error(`bilinmeyen kozmetik türü: ${id}`);
  return t;
}

/** Bir türün ürünleri (katalog sırasıyla; satıştan kalkanlar dahil). Önizleme taslakları sona eklenir. */
export function itemsOfType(type: CosmeticTypeId): CosmeticItem[] {
  const base = COSMETIC_ITEMS.filter((i) => i.type === type).map((i) => previewItems?.get(i.id) ?? i);
  if (!previewItems) return base;
  for (const p of previewItems.values()) if (p.type === type && !BY_ID.has(p.id)) base.push(p);
  return base;
}

// ---- Satış, çıkış tarihi ve koleksiyon (MG-3) ----

/** Çıkış gününün başladığı an: o İstanbul gününün gece yarısı (UTC ms). */
export function releaseAt(cikis: string): number {
  const [y, m, d] = cikis.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - ISTANBUL_OFFSET_MS;
}

/** Ürün `ms` anında mağazada mı (satışta ve çıkış günü gelmiş)? Satın alma da bu kuralla sınırlıdır. */
export function isOnSale(item: CosmeticItem, ms: number): boolean {
  return item.satista && (item.cikis === undefined || ms >= releaseAt(item.cikis));
}

/** Mağazada görünen ürünler (katalog sırasıyla). */
export function shopItemsOfType(type: CosmeticTypeId, ms: number): CosmeticItem[] {
  return itemsOfType(type).filter((i) => isOnSale(i, ms));
}

export interface ShopCollection {
  /** Koleksiyon adı (katalogdaki gibi). */
  name: string;
  items: CosmeticItem[];
}

/** En az iki ürünü satışta olan koleksiyonlar (ilk ürünlerinin katalog sırasıyla). */
export function shopCollections(ms: number): ShopCollection[] {
  const groups = new Map<string, CosmeticItem[]>();
  for (const t of COSMETIC_TYPES)
    for (const it of shopItemsOfType(t.id, ms)) {
      if (it.koleksiyon === undefined) continue;
      const g = groups.get(it.koleksiyon);
      if (g) g.push(it);
      else groups.set(it.koleksiyon, [it]);
    }
  const order = (items: CosmeticItem[]): number =>
    Math.min(...items.map((i) => COSMETIC_ITEMS.findIndex((c) => c.id === i.id) >>> 0));
  return [...groups.entries()]
    .filter(([, items]) => items.length >= 2)
    .sort((a, b) => order(a[1]) - order(b[1]))
    .map(([name, items]) => ({ name, items }));
}

// ---- Giysi yuvaları, kemik eşlemesi, kostüm kuralı ----

/** Giysi türü mü (şapka, üst, alt, ayakkabı, aksesuar, kostüm)? */
export const isClothingType = (type: CosmeticTypeId): boolean => cosmeticType(type).group === "giysi";

/**
 * Giysi yuvalarının çizim sırası (arkadan öne), AYNI kemiğe bağlı parçalar arasında: kostüm en altta, sonra alt,
 * ayakkabı, üst; aksesuar üstün ÜSTÜNDE, şapka en üstte. (Farklı kemiklerde sıra gövdenin çizim sırasıdır;
 * `arka` katmanı her yuvada gövdenin arkasına çizilir.)
 */
export const GIYSI_SIRASI: readonly CosmeticTypeId[] = [
  "kostum",
  "alt",
  "ayakkabi",
  "ust",
  "aksesuar",
  "sapka",
];

/** Kemik adı -> o kemikteki giysinin yuvası. Kostümün kapladığı yuvalar parçalarının kemiklerinden türer. */
export function slotOfBone(bone: string): CosmeticTypeId | null {
  if (bone === "head") return "sapka";
  if (bone === "torso" || /_(upper_arm|forearm|hand)$/.test(bone)) return "ust";
  if (/_(thigh|shin)$/.test(bone)) return "alt";
  if (/_foot$/.test(bone)) return "ayakkabi";
  return null;
}

/** Kemik listesinin kapladığı yuvalar (`GIYSI_SIRASI` sırasıyla, tekil). Aksesuar hiç kaplanmaz. */
export function coveredSlots(bones: readonly string[]): CosmeticTypeId[] {
  const set = new Set(bones.map(slotOfBone));
  return GIYSI_SIRASI.filter((t) => set.has(t));
}

// ---- Giysi renkleri ----

export type ClothingColourId = "camgobegi" | "pembe" | "altin" | "yesil" | "mor";

export interface ClothingColour {
  id: ClothingColourId;
  name: string;
  /** Oyunun neon renk jetonu (`tokens.css`): camgöbeği, magenta, amber, lime, violet. */
  hex: string;
}

export const CLOTHING_COLOURS: readonly ClothingColour[] = [
  { id: "camgobegi", name: "Camgöbeği", hex: "#2EF2FF" },
  { id: "pembe", name: "Pembe", hex: "#FF2BD6" },
  { id: "altin", name: "Altın", hex: "#FFC23B" },
  { id: "yesil", name: "Yeşil", hex: "#B6FF3B" },
  { id: "mor", name: "Mor", hex: "#8B5CFF" },
];

/** Çizildiği gibi renk: kuşanılan değerde yazılmaz (`kimlik`). */
export const DEFAULT_COLOUR: ClothingColourId = "camgobegi";

/**
 * Renk iş kuralı (sahip kararı bekliyor): "free" = ürüne sahip olmak tüm renkleri açar, renk Dolabım'da ücretsiz
 * seçilir. "paid" = varsayılan dışındaki her renk ayrı satın alınır (sahip olunan `kimlik~renk` ürünü). Yalnız
 * `colourUnlocked` bu sabite bakar; "paid"e geçmek için ek olarak mağazaya renk ürünleri eklenmelidir.
 */
export type ColourMode = "free" | "paid";
export const COLOUR_MODE: ColourMode = "free";

export const clothingColour = (id: string): ClothingColour | undefined =>
  CLOTHING_COLOURS.find((c) => c.id === id);

/** Kuşanılan değer: `kimlik` ya da `kimlik~renk`. */
export interface Equipped {
  id: string;
  colour: ClothingColourId;
}

/** Değeri ayırır; rengi bilinmiyorsa ya da biçim bozuksa null (kimliğin katalogda olması burada aranmaz). */
export function splitEquipped(value: string): Equipped | null {
  const i = value.indexOf("~");
  if (i < 0) return value.length > 0 ? { id: value, colour: DEFAULT_COLOUR } : null;
  const id = value.slice(0, i);
  const colour = clothingColour(value.slice(i + 1));
  return id.length > 0 && colour ? { id, colour: colour.id } : null;
}

/** Kuşanılan değerin kanonik yazımı: varsayılan renk yazılmaz. */
export const equippedValue = (id: string, colour: ClothingColourId = DEFAULT_COLOUR): string =>
  colour === DEFAULT_COLOUR ? id : `${id}~${colour}`;

/**
 * Bir yuvaya yazılacak/okunan değeri doğrular ve kanonik biçime getirir. Ürün katalogda ve bu türde olmalı; renk
 * yalnız giysi türlerinde ve bilinen renklerden olabilir. Geçersizse null.
 */
export function cleanEquipped(type: CosmeticTypeId, value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const e = splitEquipped(value);
  if (!e) return null;
  const it = cosmeticItem(e.id);
  if (!it || it.type !== type) return null;
  if (value.includes("~") && !isClothingType(type)) return null;
  return equippedValue(e.id, e.colour);
}

/** Bu renk bu hesapta açık mı? `owns(kimlik)`: ürüne sahiplik. "free": ürüne sahip olmak yeter. */
export function colourUnlocked(
  owns: (itemId: string) => boolean,
  id: string,
  colour: ClothingColourId,
): boolean {
  if (!owns(id)) return false;
  if (colour === DEFAULT_COLOUR || COLOUR_MODE === "free") return true;
  return owns(`${id}~${colour}`);
}

/** Kuşanılanları oyunculara giden `Cosmetics` alanına çevirir; bilinmeyen/yanlış türdeki değer atlanır. */
export function cosmeticsFromEquipped(equipped: Readonly<Record<string, string>>): Cosmetics | undefined {
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    if (t.key === null) continue;
    const v = cleanEquipped(t.id, equipped[t.id]);
    if (v !== null) out[t.key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Ağdan gelen `cosmetics` alanını doğrular: yalnız katalogda olan ve doğru türdeki kimlikler (giysilerde bilinen
 * renkle) kalır, gerisi atılır. Hiçbir şey kalmadıysa `undefined`.
 */
export function parseCosmetics(raw: unknown): Cosmetics | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const out: Cosmetics = {};
  for (const t of COSMETIC_TYPES) {
    if (t.key === null) continue;
    const v = cleanEquipped(t.id, rec[t.key]);
    if (v !== null) out[t.key] = v;
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
  hayvanlar: [
    "Gülen kedi",
    "Şaşkın baykuş",
    "Uykucu panda",
    "Kızgın tavuk",
    "Göz kırpan tilki",
    "Ağlayan köpek",
  ],
  "oyun-ani": ["Düşünüyorum", "Ter damlası", "Kum saati", "Şans yoncası", "Zar", "Tam isabet"],
  kozmik: ["Gezegen", "Kuyruklu yıldız", "UFO", "Astronot kaskı", "Kara delik", "Yıldız patlaması"],
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
  const item =
    COSMETIC_ITEMS.find((i) => i.type === "tepki" && i.asset === m[1]) ??
    (previewItems
      ? [...previewItems.values()].find((i) => i.type === "tepki" && i.asset === m[1])
      : undefined);
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
 * Geçiş dönemi: canlıdaki eski uygulama (önbellekteki PWA) günün fırsatını kendi küçük kataloğundan hesaplar. Katalog
 * büyüdüğü için sunucu başka ürün seçerse oyuncu indirimli gördüğü ürüne tam fiyat öder. Bu tarihe dek fırsat havuzu
 * eski katalogdaki ücretli ürünlerdir (aynı sırayla); eski ve yeni istemci aynı fırsatı gösterir.
 */
export const LEGACY_DEAL_POOL: readonly string[] = [
  "unvan-parti-canavari",
  "unvan-sessiz-tehlike",
  "unvan-sansli",
  "unvan-taktikci",
  "unvan-bluf-ustasi",
  "unvan-son-saniyeci",
  "unvan-efsane",
  "ad-neon-mavi",
  "ad-neon-pembe",
  "ad-gokkusagi",
  "ad-kivilcim",
  "ad-altin-parilti",
  "cerceve-camgobegi",
  "cerceve-pembe",
  "cerceve-cift",
  "cerceve-donen-neon",
  "cerceve-altin-tac",
];
/** Geçişin bittiği an: 12 Kasım 2026 00:00 İstanbul. */
export const LEGACY_DEAL_POOL_UNTIL = Date.UTC(2026, 10, 11, 21, 0, 0);

/**
 * O İstanbul gününün fırsatları: satıştaki ücretli ürünlerden gün numarasıyla tohumlanan karıştırmadan ilk
 * `DEAL_COUNT` tanesi (farklı). Aynı gün her yerde aynı sonucu verir.
 */
export function dailyDeals(ms: number): DailyDeal[] {
  // Satışta olmayan ürün fırsata da çıkmaz (satın alınamayan ürün indirimli gösterilmesin).
  const paid =
    ms < LEGACY_DEAL_POOL_UNTIL
      ? LEGACY_DEAL_POOL.flatMap((id) => {
          const it = BY_ID.get(id);
          return it && it.price > 0 && isOnSale(it, ms) ? [it] : [];
        })
      : COSMETIC_ITEMS.filter((i) => i.price > 0 && isOnSale(i, ms));
  const rng = createRng(Math.imul(istanbulDayNumber(ms), 0x9e3779b1) ^ 0x51ed270b);
  // İndirim ürünün kendi fiyatından hesaplanır (MG-2).
  return rng
    .shuffle(paid)
    .slice(0, DEAL_COUNT)
    .map((i) => ({ itemId: i.id, price: dealPrice(i.price), listPrice: i.price }));
}

/**
 * Ürünün o anda geçerli satış fiyatı (fırsattaysa indirimli, yoksa katalog fiyatı). Ürün yoksa ya da satışta
 * değilse null. Sunucu satın almada bu fiyatı kullanır; istemciden fiyat alınmaz.
 */
export function currentPrice(itemId: string, ms: number): number | null {
  const it = cosmeticItem(itemId);
  if (!it || !isOnSale(it, ms)) return null;
  return dailyDeals(ms).find((d) => d.itemId === itemId)?.price ?? it.price;
}
