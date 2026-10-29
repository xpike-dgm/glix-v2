/**
 * Oyuncu listesi ve hesap dökümü için saf kurallar (biçimleme, gruplama, doğrulama); ekran bunları kullanır.
 * Kural icat etmez: sunucu yine her şeyi doğrular.
 */
import type { AdminAccountDetail, AdminPlayerFilter, AdminPlayerRole, AdminPlayerSort } from "@glix/engine";
import { COSMETIC_TYPES, cosmeticItem } from "@glix/engine";

export const FILTER_OPTIONS: readonly { id: AdminPlayerFilter; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "online", label: "Şu an çevrimiçi" },
  { id: "suspended", label: "Askıda" },
  { id: "admin", label: "Yönetici" },
];

export const SORT_OPTIONS: readonly { id: AdminPlayerSort; label: string }[] = [
  { id: "seen", label: "Son görülme" },
  { id: "created", label: "Kayıt tarihi" },
  { id: "glix", label: "Glix bakiyesi" },
  { id: "name", label: "Ad" },
];

/** Her sıralamanın ilk yönü: tarih ve Glix için yeniden eskiye/çoktan aza, ad için A'dan Z'ye. */
export const defaultDir = (sort: AdminPlayerSort): "asc" | "desc" => (sort === "name" ? "asc" : "desc");

export const ROLE_LABEL: Record<AdminPlayerRole, string> = {
  host: "Oda sahibi",
  player: "Oyuncu",
  spectator: "İzleyici",
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Askının kalan süresi: "süresiz", "2 gün 3 sa kaldı", "45 dk kaldı", "1 dk'dan az kaldı". */
export function fmtRemaining(until: number | null, now: number): string {
  if (until === null) return "süresiz";
  const left = until - now;
  if (left <= 0) return "süresi doldu";
  if (left >= DAY) {
    const d = Math.floor(left / DAY);
    const h = Math.floor((left % DAY) / HOUR);
    return h > 0 ? `${d} gün ${h} sa kaldı` : `${d} gün kaldı`;
  }
  if (left >= HOUR) {
    const h = Math.floor(left / HOUR);
    const m = Math.floor((left % HOUR) / MIN);
    return m > 0 ? `${h} sa ${m} dk kaldı` : `${h} sa kaldı`;
  }
  if (left >= MIN) return `${Math.floor(left / MIN)} dk kaldı`;
  return "1 dk'dan az kaldı";
}

/** Canlı durum metni: "Çevrimdışı", "Çevrimiçi", "Odada: ABCD (Oda sahibi)". */
export function liveText(live: AdminAccountDetail["live"]): string {
  if (!live.online) return "Çevrimdışı";
  if (!live.room) return "Çevrimiçi";
  return `Odada: ${live.room.code} (${ROLE_LABEL[live.room.role]})`;
}

/** Kuşanılan değer `kimlik` ya da giysilerde `kimlik~renk`; kimlik kısmı. */
export const wornItemId = (value: string): string => value.split("~")[0] ?? value;

export interface OwnedGroup {
  slot: string;
  label: string;
  /** Bu türde kuşanılı değer (renk eki dahil); yoksa null. */
  worn: string | null;
  items: { itemId: string; name: string; equipped: boolean; acquiredAt: number; pricePaid: number }[];
}

/** Sahip olunan ürünleri tür sırasıyla gruplar; kuşanılanı işaretler. Katalogda olmayan ürün "Diğer" grubuna düşer. */
export function groupOwned(cosmetics: AdminAccountDetail["cosmetics"]): OwnedGroup[] {
  const groups = new Map<string, OwnedGroup>();
  for (const o of cosmetics.owned) {
    const item = cosmeticItem(o.itemId);
    const slot = item?.type ?? "diger";
    let g = groups.get(slot);
    if (!g) {
      const type = COSMETIC_TYPES.find((t) => t.id === slot);
      const worn = cosmetics.equipped[slot] ?? null;
      g = { slot, label: type?.plural ?? "Diğer", worn, items: [] };
      groups.set(slot, g);
    }
    g.items.push({
      itemId: o.itemId,
      name: item?.name ?? o.itemId,
      equipped: g.worn !== null && wornItemId(g.worn) === o.itemId,
      acquiredAt: o.acquiredAt,
      pricePaid: o.pricePaid,
    });
  }
  const order = COSMETIC_TYPES.map((t) => t.id as string);
  return [...groups.values()].sort((a, b) => {
    const ia = order.indexOf(a.slot);
    const ib = order.indexOf(b.slot);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
}

/** Kuşanılı olup sahipliği listede görünmeyen (çıkarılabilir) türler: yalnız kuşanılanlar. */
export const equippedSlots = (cosmetics: AdminAccountDetail["cosmetics"]): string[] =>
  Object.keys(cosmetics.equipped);

/** "Bakiyeyi ayarla" alanı: 0..10 000 000 tamsayı; değilse null. */
export function parseBalanceTarget(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,8}$/.test(t)) return null;
  const n = Number(t);
  return n <= 10_000_000 ? n : null;
}
