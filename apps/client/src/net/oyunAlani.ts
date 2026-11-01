/**
 * Oyun alanı (test2.glix) taslak katmanı (sözleşme `docs/uretim/SOZLESME.md` bölüm 13). Üretim Merkezi'nin yüklediği
 * taslak mağaza ürünleri sunucudan (`GET /api/oyun-alani/magaza`) okunur ve motorun önizleme katmanına
 * (`setPreviewItems`) konur; görselleri `assetOverride` tablosuyla sunucunun veri klasöründen gelir. Mağaza onları
 * "TASLAK" etiketiyle gösterir; satın alma ve kuşanma sunucuda aynı katmanla doğrulanır.
 *
 * Yalnız oyun alanında çalışır: sunucu test2'de ana sayfaya `data-glix-ortam="test2"` şeridini ekler. Canlıda ve
 * test'te şerit yoktur (ya da `test`tir), bu modül hiçbir istek atmaz ve hiçbir şey değiştirmez.
 */
import { COSMETIC_ITEMS, type CosmeticItem, parseShopItem, setPreviewItems } from "@glix/engine";
import { createSignal } from "solid-js";
import { normalizeGamePath, setAssetOverrides } from "../ui/assetOverride.js";

/** Bir katmandaki en çok taslak ürün (sunucuyla aynı). */
export const TASLAK_EN_COK = 100;

const [taslakIdleri, setTaslakIdleri] = createSignal<ReadonlySet<string>>(new Set());
/** Katman her değiştiğinde artar (mağaza listesi yeniden hesaplanır). */
const [katmanSurumu, setKatmanSurumu] = createSignal(0);

export { katmanSurumu };

/** Ürün oyun alanı taslağı mı ("TASLAK" etiketi). Canlıda hep false. */
export const taslakMi = (id: string): boolean => taslakIdleri().has(id);

/** Oyun alanında taslaklar sekmenin başında görünür (sahip ilk bakışta bulsun); sıra başka türlü değişmez. */
export function taslakOnce<T extends { id: string }>(items: T[]): T[] {
  const taslak = items.filter((i) => taslakMi(i.id));
  return taslak.length ? [...taslak, ...items.filter((i) => !taslakMi(i.id))] : items;
}

/** Sayfa oyun alanında mı açıldı (sunucunun eklediği şerit). */
export function oyunAlaniMi(doc: Pick<Document, "querySelector"> | undefined = globalThis.document): boolean {
  return doc?.querySelector('[data-glix-ortam="test2"]') != null;
}

/** Taslak görsel adresi: yalnız sunucunun kendi taslak dosya ucu (aynı kaynak). */
const TASLAK_ADRES = /^\/api\/oyun-alani\/dosya\/[0-9a-f]{64}\.(?:webp|png)$/;

/** `GET /api/oyun-alani/magaza` yanıtını doğrular (ağdan gelen veri); geçersiz satır ve adres atılır. */
export function parseTaslakKatmani(
  data: unknown,
): { urunler: CosmeticItem[]; dosyalar: Map<string, string> } | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.ok !== true || !Array.isArray(d.urunler)) return null;
  const urunler: CosmeticItem[] = [];
  for (const row of d.urunler.slice(0, TASLAK_EN_COK)) {
    const it = parseShopItem(row);
    // Katalogdaki bir ürünü ezemez (sunucu da reddeder).
    if (it && !COSMETIC_ITEMS.some((c) => c.id === it.id) && !urunler.some((u) => u.id === it.id))
      urunler.push(it);
  }
  const dosyalar = new Map<string, string>();
  if (typeof d.dosyalar === "object" && d.dosyalar !== null && !Array.isArray(d.dosyalar))
    for (const [yol, adres] of Object.entries(d.dosyalar as Record<string, unknown>)) {
      const p = normalizeGamePath(yol);
      if (p?.startsWith("/assets/shop/") && typeof adres === "string" && TASLAK_ADRES.test(adres))
        dosyalar.set(p, adres);
    }
  return { urunler, dosyalar };
}

let yukleniyor: Promise<void> | null = null;

/** Oyun alanındaysa taslak katmanını yükler (yenilemek için yeniden çağrılır); değilse hiçbir şey yapmaz. */
export function taslaklariYukle(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!oyunAlaniMi()) return Promise.resolve();
  if (yukleniyor) return yukleniyor;
  yukleniyor = (async () => {
    try {
      const r = await fetchImpl("/api/oyun-alani/magaza", { credentials: "same-origin", cache: "no-store" });
      const k = parseTaslakKatmani(r.ok ? await r.json() : null);
      if (!k) return;
      setPreviewItems(k.urunler);
      setAssetOverrides(k.dosyalar);
      setTaslakIdleri(new Set(k.urunler.map((u) => u.id)));
      setKatmanSurumu((n) => n + 1);
    } catch {
      // Ağ hatası: katman olduğu gibi kalır (taslaklar bir sonraki açılışta gelir).
    } finally {
      yukleniyor = null;
    }
  })();
  return yukleniyor;
}
