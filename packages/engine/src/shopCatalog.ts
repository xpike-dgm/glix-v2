/**
 * Mağaza kataloğu dosyası (MG-1): ürünler `katalog/magaza.json` içindedir, kod değildir. Dosya yüklenirken
 * `validateShopCatalog` ile doğrulanır; hatalı bir satır modülün yüklenmesini durdurur (testler ve derleme düşer,
 * hatalı katalog canlıya çıkamaz). Biçim ve kurallar: `docs/uretim/SOZLESME.md` bölüm 2, `docs/uretim/MAGAZA-KATALOG.md`.
 *
 * Üretim Merkezi aynı doğrulayıcıları kullanır (`validateShopCatalog`, `validateShopItem`, `SHOP_PRICE_RANGES`).
 */
import {
  COSMETIC_TYPES,
  type CosmeticItem,
  type CosmeticRarity,
  type CosmeticTypeId,
} from "./cosmeticTypes.js";
import { type EffectRecipe, validateEffectRecipe } from "./efekt.js";
import RAW_CATALOG from "./katalog/magaza.json" with { type: "json" };

/** Katalog dosyasının biçim sürümü. */
export const SHOP_CATALOG_VERSION = 1;

/** Nadirliğe göre izinli fiyat aralığı (Glix, iki uç dahil). Bugünkü sabit fiyatlar: 150, 400, 1000. */
export const SHOP_PRICE_RANGES: Readonly<Record<CosmeticRarity, readonly [number, number]>> = {
  siradan: [100, 250],
  nadir: [300, 600],
  efsanevi: [800, 1500],
};

/** Ad ve açıklamanın en çok uzunluğu (karakter); koleksiyon adı. */
export const SHOP_NAME_MAX = 24;
export const SHOP_DESCRIPTION_MAX = 90;
export const SHOP_COLLECTION_MAX = 32;

/** Efekt tarifi zorunlu olan türler (bugün kodla/tarifle çizilenler). */
export const EFFECT_REQUIRED_TYPES: readonly CosmeticTypeId[] = ["ad-efekti", "cerceve"];
/**
 * Tarifin ek katman olarak çizildiği türler (görselleri yine zorunlu): giriş efekti lobide, zafer final ekranında.
 * Kart arkası ve tepki paketi için motorlar tanımlı (EFFECT_ENGINES) ama oyun henüz çizmiyor; tarif kabul edilmez.
 */
export const EFFECT_OPTIONAL_TYPES: readonly CosmeticTypeId[] = ["giris", "zafer"];

/** Görsel/karakter varlığı (`asset`) zorunlu türler. */
const ASSET_TYPES: ReadonlySet<CosmeticTypeId> = new Set<CosmeticTypeId>([
  "dans",
  "sapka",
  "ust",
  "alt",
  "ayakkabi",
  "aksesuar",
  "kostum",
  "kart-arkasi",
  "zafer",
  "tepki",
  "giris",
]);
const COVERABLE: readonly CosmeticTypeId[] = ["sapka", "ust", "alt", "ayakkabi"];
const ROW_KEYS = new Set([
  "id",
  "type",
  "rarity",
  "price",
  "name",
  "description",
  "asset",
  "covers",
  "satista",
  "koleksiyon",
  "cikis",
  "efekt",
]);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const ASSET = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RARITIES: readonly CosmeticRarity[] = ["siradan", "nadir", "efsanevi"];

export interface ShopCheck {
  ok: boolean;
  errors: string[];
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const chars = (s: string): number => Array.from(s).length;
/** Görünmez/denetim karakteri ya da HTML açısı içermeyen, kırpılmış metin. */
const cleanText = (s: string): boolean => s === s.trim() && !/[\p{Cc}\p{Cf}<>]/u.test(s);

/** `YYYY-MM-DD` geçerli bir takvim günü mü. */
export function isCatalogDate(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = DATE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 2024;
}

function catalogRows(catalog: unknown): readonly unknown[] {
  if (Array.isArray(catalog)) return catalog;
  if (isRec(catalog) && Array.isArray(catalog.urunler)) return catalog.urunler;
  return [];
}

/**
 * Tek ürün satırını doğrular. `catalog` (satır listesi ya da `{ urunler }`) tekrar denetimi içindir: başka bir satırda
 * aynı kimlik ya da aynı türde aynı ad varsa hata. Satırın kendisi (aynı nesne) listede olabilir.
 */
export function validateShopItem(item: unknown, catalog: unknown = []): ShopCheck {
  const errors: string[] = [];
  if (!isRec(item)) return { ok: false, errors: ["ürün satırı bir nesne olmalı"] };
  for (const k of Object.keys(item)) if (!ROW_KEYS.has(k)) errors.push(`bilinmeyen alan: ${k}`);
  const { id, type, rarity, price, name, description, asset, covers, satista, koleksiyon, cikis, efekt } =
    item;
  if (typeof id !== "string" || id.length > 64 || !ID.test(id))
    errors.push("id: küçük harf, rakam ve tireyle en az iki parça olmalı (örn. cerceve-neon-gece)");
  const typeId = COSMETIC_TYPES.find((t) => t.id === type)?.id;
  if (typeId === undefined)
    errors.push(`type: bilinmeyen tür (${COSMETIC_TYPES.map((t) => t.id).join(", ")})`);
  const rar = RARITIES.find((r) => r === rarity);
  if (rar === undefined) errors.push("rarity: siradan, nadir ya da efsanevi olmalı");
  if (typeof price !== "number" || !Number.isInteger(price)) errors.push("price: tam sayı olmalı");
  else if (rar !== undefined) {
    const [lo, hi] = SHOP_PRICE_RANGES[rar];
    if (price < lo || price > hi) errors.push(`price: ${rar} için ${lo}-${hi} Glix arası olmalı`);
  }
  if (typeof name !== "string" || chars(name) < 1 || chars(name) > SHOP_NAME_MAX || !cleanText(name))
    errors.push(`name: 1-${SHOP_NAME_MAX} karakter, başında/sonunda boşluk yok`);
  if (
    typeof description !== "string" ||
    chars(description) < 1 ||
    chars(description) > SHOP_DESCRIPTION_MAX ||
    !cleanText(description)
  )
    errors.push(`description: 1-${SHOP_DESCRIPTION_MAX} karakter`);
  if (typeof satista !== "boolean") errors.push("satista: true ya da false olmalı");
  if (
    koleksiyon !== undefined &&
    (typeof koleksiyon !== "string" ||
      chars(koleksiyon) < 1 ||
      chars(koleksiyon) > SHOP_COLLECTION_MAX ||
      !cleanText(koleksiyon))
  )
    errors.push(`koleksiyon: 1-${SHOP_COLLECTION_MAX} karakter`);
  if (cikis !== undefined && !isCatalogDate(cikis))
    errors.push("cikis: YYYY-MM-DD biçiminde geçerli bir gün");
  if (typeId !== undefined) {
    if (ASSET_TYPES.has(typeId)) {
      if (typeof asset !== "string" || asset.length > 40 || !ASSET.test(asset))
        errors.push("asset: bu türde zorunlu (küçük harf, rakam, tire)");
    } else if (asset !== undefined) errors.push("asset: bu türde kullanılmaz");
    if (typeId === "kostum") {
      if (
        !Array.isArray(covers) ||
        covers.length === 0 ||
        !covers.every((c) => COVERABLE.some((t) => t === c)) ||
        new Set(covers).size !== covers.length
      )
        errors.push(`covers: kostümde zorunlu; ${COVERABLE.join(", ")} yuvalarından tekrarsız liste`);
    } else if (covers !== undefined) errors.push("covers: yalnız kostümde");
    if (EFFECT_REQUIRED_TYPES.includes(typeId) && efekt === undefined)
      errors.push("efekt: bu türde zorunlu (efekt tarifi)");
    if (efekt !== undefined) {
      if (!EFFECT_REQUIRED_TYPES.includes(typeId) && !EFFECT_OPTIONAL_TYPES.includes(typeId))
        errors.push("efekt: bu türde oyun henüz tarif çizmiyor (kod isteği gerekir)");
      else for (const e of validateEffectRecipe(efekt, typeId).errors) errors.push(`efekt: ${e}`);
    }
  }
  // Tekrar denetimi: aynı kimlik ya da aynı türde aynı ad (büyük/küçük harf duyarsız).
  if (typeof id === "string" || typeof name === "string") {
    const folded = typeof name === "string" ? name.toLocaleLowerCase("tr-TR") : null;
    for (const other of catalogRows(catalog)) {
      if (other === item || !isRec(other)) continue;
      if (typeof id === "string" && other.id === id) errors.push(`id: "${id}" katalogda zaten var`);
      if (
        folded !== null &&
        other.type === type &&
        typeof other.name === "string" &&
        other.name.toLocaleLowerCase("tr-TR") === folded
      )
        errors.push(`name: aynı türde "${String(name)}" adlı ürün zaten var`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Katalog dosyasının tamamını doğrular: biçim, sürüm ve her satır (satır numarası ve kimlikle). */
export function validateShopCatalog(json: unknown): ShopCheck {
  if (!isRec(json)) return { ok: false, errors: ["katalog bir nesne olmalı: { surum, urunler }"] };
  const errors: string[] = [];
  for (const k of Object.keys(json))
    if (k !== "surum" && k !== "urunler") errors.push(`bilinmeyen alan: ${k}`);
  if (json.surum !== SHOP_CATALOG_VERSION) errors.push(`surum: ${SHOP_CATALOG_VERSION} olmalı`);
  if (!Array.isArray(json.urunler) || json.urunler.length === 0) {
    errors.push("urunler: boş olmayan bir liste olmalı");
    return { ok: false, errors };
  }
  json.urunler.forEach((row: unknown, i: number) => {
    const label = isRec(row) && typeof row.id === "string" ? `urunler[${i}] (${row.id})` : `urunler[${i}]`;
    for (const e of validateShopItem(row, json.urunler).errors) errors.push(`${label}: ${e}`);
  });
  return { ok: errors.length === 0, errors };
}

/**
 * Oyun alanında (test2) taslak olarak yüklenebilen türler: görünümü yalnız görsel dosyalarından ve efekt tarifinden
 * oluşanlar. Dans ve giysiler karakter varlığı (dans dosyası, `rig.json` katmanı) gerektirir; onlar taslak katmanına
 * henüz girmez (kod isteği ile).
 */
export const DRAFT_SHOP_TYPES: readonly CosmeticTypeId[] = [
  "unvan",
  "ad-efekti",
  "cerceve",
  "kart-arkasi",
  "zafer",
  "tepki",
  "giris",
];

/** Doğrulanmış satırı ürüne çevirir (alanlar kopyalanır; dondurulmaz). */
function toItem(row: Record<string, unknown>): CosmeticItem {
  const it: CosmeticItem = {
    id: row.id as string,
    type: row.type as CosmeticTypeId,
    rarity: row.rarity as CosmeticRarity,
    price: row.price as number,
    name: row.name as string,
    description: row.description as string,
    satista: row.satista as boolean,
  };
  if (typeof row.asset === "string") it.asset = row.asset;
  if (Array.isArray(row.covers)) it.covers = (row.covers as CosmeticTypeId[]).slice();
  if (typeof row.koleksiyon === "string") it.koleksiyon = row.koleksiyon;
  if (typeof row.cikis === "string") it.cikis = row.cikis;
  if (isRec(row.efekt)) it.efekt = row.efekt as unknown as EffectRecipe;
  return it;
}

/** Tek satırı (tekrar denetimi olmadan) doğrular ve ürüne çevirir; geçersizse null (önizleme taslakları). */
export function parseShopItem(row: unknown): CosmeticItem | null {
  return isRec(row) && validateShopItem(row, []).ok ? toItem(row) : null;
}

/** Katalog JSON'unu doğrular ve ürün listesine çevirir; geçersizse bütün hatalarla birlikte fırlatır. */
export function loadShopCatalog(json: unknown): CosmeticItem[] {
  const check = validateShopCatalog(json);
  if (!check.ok)
    throw new Error(`mağaza kataloğu geçersiz (katalog/magaza.json):\n  ${check.errors.join("\n  ")}`);
  return (json as { urunler: Record<string, unknown>[] }).urunler.map(toItem);
}

/** Katalog dosyasındaki ürünler (dosya sırasıyla). Yükleme anında doğrulanır. */
export const SHOP_CATALOG_ITEMS: readonly CosmeticItem[] = loadShopCatalog(RAW_CATALOG as unknown);
