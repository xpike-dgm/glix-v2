import {
  type Cosmetics,
  type CosmeticTypeId,
  cleanEquipped,
  cosmeticsFromEquipped,
  currentPrice,
} from "@glix/engine";
import { createSignal } from "solid-js";
import { ownedPacks, parseShopState, type ShopState, shopErrorText } from "./shopRules.js";

export type ShopLoad = "loading" | "ready" | "error";

const [shop, setShop] = createSignal<ShopState | null>(null);
const [shopLoad, setShopLoad] = createSignal<ShopLoad>("loading");
const [shopError, setShopError] = createSignal<string | null>(null);

export { shop, shopError, shopLoad };

/** Kendi kuşandıkların (önizleme için); mağaza yüklenmediyse boş. */
export const ownCosmetics = (): Cosmetics | undefined => {
  const s = shop();
  return s ? cosmeticsFromEquipped(s.equipped) : undefined;
};

/** Sahip olunan tepki paketleri; mağaza yüklenmediyse (misafir dahil) boş. */
export const ownPacks = () => ownedPacks(shop());

/** Hesaplı oyuncu bir odadayken tepki paketlerini bilmek için mağaza durumu bir kez yüklenir. */
export function ensureShopLoaded(): void {
  if (shop() === null && shopLoad() !== "error") void loadShop();
}

/** Yalnız geliştirme önizlemesi: durum sabitlenir, ağ kullanılmaz; satın alma/kuşanma yerelde uygulanır. */
let frozen = false;
export function freezeShop(next: ShopState): void {
  frozen = true;
  setShop(next);
  setShopLoad("ready");
}

let seq = 0;

async function call(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`/api/shop${path}`, {
    method,
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // gövde okunamadı
  }
  return { status: res.status, data };
}

function codeOf(data: unknown): string | null {
  return typeof data === "object" && data !== null && typeof (data as { code?: unknown }).code === "string"
    ? (data as { code: string }).code
    : null;
}

/** Mağaza durumunu yükler (bakiye, sahip olunanlar, kuşanılanlar, sunucu saati). */
export async function loadShop(): Promise<void> {
  if (frozen) return;
  const mine = ++seq;
  if (shop() === null) setShopLoad("loading");
  try {
    const { status, data } = await call("", "GET");
    if (mine !== seq) return;
    const parsed = status === 200 ? parseShopState(data, Date.now()) : null;
    if (parsed) {
      setShop(parsed);
      setShopLoad("ready");
      setShopError(null);
    } else {
      setShopError(shopErrorText(status === 401 ? "login_required" : null));
      if (shop() === null) setShopLoad("error");
    }
  } catch {
    if (mine !== seq) return;
    setShopError(shopErrorText("network"));
    if (shop() === null) setShopLoad("error");
  }
}

export function resetShop(): void {
  seq++;
  if (frozen) return;
  setShop(null);
  setShopLoad("loading");
  setShopError(null);
}

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Satın alır. Fiyatı sunucu belirler; yanıttaki bakiye esastır. */
export async function buyItem(itemId: string): Promise<ActionResult> {
  const s = shop();
  if (frozen && s) {
    const price = currentPrice(itemId, Date.now() + s.clockOffset) ?? 0;
    if (s.owned.includes(itemId)) return { ok: false, message: shopErrorText("already_owned") };
    if (s.balance < price) return { ok: false, message: shopErrorText("insufficient_glix") };
    setShop({ ...s, balance: s.balance - price, owned: [...s.owned, itemId] });
    return { ok: true };
  }
  try {
    const { status, data } = await call("/buy", "POST", { itemId });
    if (status === 200) {
      await loadShop();
      return { ok: true };
    }
    // Bakiye ya da sahiplik eskimiş olabilir: durumu tazele.
    void loadShop();
    return { ok: false, message: shopErrorText(codeOf(data)) };
  } catch {
    return { ok: false, message: shopErrorText("network") };
  }
}

let equipChain: Promise<unknown> = Promise.resolve();

/**
 * Kuşanır; `itemId` null ise o türde temel (yok) seçilir. Kuşanmalar sırayla gönderilir: art arda dokunuşlar
 * (renk topları, dolap karoları) sunucuda ters sırayla işlenip son dokunuşu ezmesin.
 */
export function equipItem(type: CosmeticTypeId, itemId: string | null): Promise<ActionResult> {
  const job = equipChain.then(() => equipNow(type, itemId));
  equipChain = job.catch(() => undefined);
  return job;
}

async function equipNow(type: CosmeticTypeId, itemId: string | null): Promise<ActionResult> {
  const s = shop();
  if (frozen && s) {
    const equipped = { ...s.equipped };
    const clean = itemId === null ? null : cleanEquipped(type, itemId);
    if (clean === null) delete equipped[type];
    else equipped[type] = clean;
    setShop({ ...s, equipped });
    return { ok: true };
  }
  try {
    const { status, data } = await call("/equip", "POST", { type, itemId });
    if (status === 200) {
      await loadShop();
      return { ok: true };
    }
    void loadShop();
    return { ok: false, message: shopErrorText(codeOf(data)) };
  } catch {
    return { ok: false, message: shopErrorText("network") };
  }
}
