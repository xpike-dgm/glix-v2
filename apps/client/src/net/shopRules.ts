import {
  COSMETIC_TYPES,
  type CosmeticItem,
  type CosmeticTypeId,
  cosmeticItem,
  cosmeticType,
  currentPrice,
  dailyDeals,
} from "@glix/engine";

/** Mağaza verisi ve saf yardımcıları (ağdan gelen hiçbir şeye güvenilmez). Katalog motorda, burada yalnız durum var. */

export interface ShopState {
  balance: number;
  /** Sahip olunan ürün kimlikleri (katalogda olanlar). */
  owned: string[];
  /** Tür -> kuşanılan ürün kimliği. */
  equipped: Partial<Record<CosmeticTypeId, string>>;
  /** Sunucu saati ile yerel saat arasındaki fark (sunucu - yerel, ms): fırsat ve geri sayım sunucu gününe göre. */
  clockOffset: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonNeg(v: unknown): number | null {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

/** `GET /api/shop` yanıtını doğrular; geçersizse null. Katalogda olmayan kimlikler atılır. */
export function parseShopState(data: unknown, localNow: number): ShopState | null {
  if (!isRecord(data) || data.ok !== true) return null;
  const balance = nonNeg(data.balance);
  const serverNow = nonNeg(data.serverNow);
  if (balance === null || serverNow === null || !Array.isArray(data.owned) || !isRecord(data.equipped))
    return null;
  const owned: string[] = [];
  for (const id of data.owned.slice(0, 200)) {
    if (typeof id === "string" && cosmeticItem(id) && !owned.includes(id)) owned.push(id);
  }
  const equipped: ShopState["equipped"] = {};
  for (const t of COSMETIC_TYPES) {
    const id = data.equipped[t.id];
    if (typeof id !== "string") continue;
    const it = cosmeticItem(id);
    if (it && it.type === t.id) equipped[t.id] = id;
  }
  return { balance, owned, equipped, clockOffset: serverNow - localNow };
}

/** Sunucuya göre şimdiki an (ms). */
export const serverNow = (s: ShopState, localNow: number): number => localNow + s.clockOffset;

export interface DealView {
  item: CosmeticItem;
  price: number;
  listPrice: number;
}

/** Bugünün fırsatları (sunucuyla aynı hesap). */
export function dealViews(s: ShopState, localNow: number): DealView[] {
  const out: DealView[] = [];
  for (const d of dailyDeals(serverNow(s, localNow))) {
    const item = cosmeticItem(d.itemId);
    if (item) out.push({ item, price: d.price, listPrice: d.listPrice });
  }
  return out;
}

/** Ürünün şimdiki fiyatı (fırsattaysa indirimli). */
export function priceNow(s: ShopState, id: string, localNow: number): number {
  return currentPrice(id, serverNow(s, localNow)) ?? 0;
}

export type ItemStatus = "buy" | "owned" | "equipped";

export function itemStatus(s: ShopState, item: CosmeticItem): ItemStatus {
  if (s.equipped[item.type] === item.id) return "equipped";
  return s.owned.includes(item.id) ? "owned" : "buy";
}

/** Geri sayım: "05:12:33" (saat 99'u aşmaz; gün en çok 24 saattir). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number): string => String(n).padStart(2, "0");
  return `${p(Math.floor(total / 3600))}:${p(Math.floor((total % 3600) / 60))}:${p(total % 60)}`;
}

export const dealCountdownText = (left: number): string => `Yenilenmesine ${formatCountdown(left)}`;

/** Bakiyeyi aşan kısım; yetiyorsa 0. */
export const shortfall = (balance: number, price: number): number => Math.max(0, price - balance);

export const shortfallText = (need: number): string => `${need} Glix daha gerekli`;
export const buyText = (price: number): string => `${price} Glix'e satın al`;

export const STATUS_LABEL: Readonly<Record<ItemStatus, string>> = {
  buy: "Satın al",
  owned: "Sahipsin – Kuşan",
  equipped: "Kuşanıldı",
};

/** Sunucu hata kodlarının oyuncuya gösterilen Türkçe karşılığı. */
export function shopErrorText(code: string | null): string {
  switch (code) {
    case "unknown_item":
      return "Bu ürün artık yok.";
    case "already_owned":
      return "Bu ürüne zaten sahipsin.";
    case "insufficient_glix":
      return "Yeterli Glix yok.";
    case "not_owned":
      return "Bu ürüne sahip değilsin.";
    case "rate_limited":
      return "Çok hızlı gidiyorsun, biraz yavaşla.";
    case "login_required":
      return "Önce giriş yap.";
    case "network":
      return "Bağlantı kurulamadı, tekrar dene.";
    default:
      return "Bir sorun oluştu, biraz sonra tekrar dene.";
  }
}

/** Tür başına, katalog sırasıyla: yalnız sahip olunanlar (Dolabım). */
export function ownedOfType(
  s: ShopState,
  type: CosmeticTypeId,
  all: readonly CosmeticItem[],
): CosmeticItem[] {
  return all.filter((i) => i.type === type && s.owned.includes(i.id));
}

export const RARITY_LABEL: Readonly<Record<CosmeticItem["rarity"], string>> = {
  siradan: "Sıradan",
  nadir: "Nadir",
  efsanevi: "Efsanevi",
};

/** Fırsat indirimi etiketi ("-%30"). */
export const DISCOUNT_LABEL = "−%30";

/** Dolap bölümleri sırası: çerçeve, unvan, ad efekti, dans, şapka, üst (katalog sırasından bağımsız). */
export const SHOP_TYPES = (["cerceve", "unvan", "ad-efekti", "dans", "sapka", "ust"] as const).map((id) =>
  cosmeticType(id),
);

/** Mağaza sekmesi: tek tür ya da aynı gruptaki türler ("Giysiler": her giysi yuvası ayrı türdür). */
export interface ShopTab {
  id: string;
  label: string;
  types: CosmeticTypeId[];
}

/** Mağaza sekmeleri: çerçeve, lakap, ad efekti, dans ve tüm giysi yuvaları tek "Giysiler" sekmesinde. */
export const SHOP_TABS: readonly ShopTab[] = [
  ...(["cerceve", "unvan", "ad-efekti", "dans"] as const).map((id) => ({
    id,
    label: cosmeticType(id).plural,
    types: [id] as CosmeticTypeId[],
  })),
  {
    id: "giysi",
    label: "Giysiler",
    types: COSMETIC_TYPES.filter((t) => t.group === "giysi").map((t) => t.id),
  },
];
