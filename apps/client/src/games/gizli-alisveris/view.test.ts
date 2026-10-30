import { ALISVERIS_POOL, ALISVERIS_REVEAL_MS, type AlisverisPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  basketCost,
  buyersOf,
  heatLabel,
  paidPrice,
  parseAlisverisView,
  productInitials,
  productValueScaled,
  productValueText,
  ranking,
  SONUC_ZAMANI,
  sameShelf,
  sepetAcilis,
  sonucSahne,
  urunAcilis,
} from "./view.js";

/** Raf: havuzun 4..15 numaralı ürünleri (yeni ürünler dahil), taban fiyatlarıyla, ters sırada. */
const products = ALISVERIS_POOL.slice(4, 16)
  .map((p) => ({ id: p.id, name: p.name, price: p.base }))
  .reverse();
const shelfIds = products.map((p) => p.id);
const heat = Object.fromEntries(shelfIds.map((id) => [String(id), id === 7 ? 3 : 0]));
const pub: AlisverisPublicView = {
  startedAt: 1,
  endsAt: 30_001,
  ready: [],
  revealEndsAt: 38_001,
  budget: 60,
  products,
  heatAt: 15_001,
  heat: null,
  reveal: null,
};
const priv = { basket: [5, 12], remaining: 34, locked: false, coupon: 12 };
const buyers = Object.fromEntries(shelfIds.map((id) => [String(id), id === 7 ? 2 : 0]));
const reveal = {
  baskets: { a: [7], b: [7, 4], c: [] },
  buyers,
  values: { a: 10_080, b: 16_800, c: 0 },
  winners: ["b"],
  points: { a: 1, b: 2, c: 0 },
  coupons: { a: 12, b: 5, c: 13 },
};

describe("Gizli Alışveriş görünümü", () => {
  it("kilit bilgisini okur ve bozuğunu reddeder", () => {
    expect(parseAlisverisView({ ...pub, ready: ["a"] }, { ...priv, locked: true })).toMatchObject({
      ready: ["a"],
      locked: true,
    });
    expect(parseAlisverisView({ ...pub, ready: [1] }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseAlisverisView(pub, { basket: [], remaining: 60, coupon: null })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, locked: 1 })).toBeNull();
  });

  it("geçerli görünümü okur (yeni ürünler, kupon, ateş, sonuç)", () => {
    expect(parseAlisverisView(pub, priv)).toMatchObject({
      budget: 60,
      remaining: 34,
      basket: [5, 12],
      coupon: 12,
    });
    expect(parseAlisverisView(pub, { ...priv, coupon: null })?.coupon).toBeNull();
    expect(parseAlisverisView({ ...pub, heat }, priv)?.heat?.["7"]).toBe(3);
    const r = parseAlisverisView({ ...pub, reveal }, priv)?.reveal;
    expect(r?.winners).toEqual(["b"]);
    expect(r?.points).toEqual({ a: 1, b: 2, c: 0 });
    expect(r?.coupons).toEqual({ a: 12, b: 5, c: 13 });
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseAlisverisView(null, priv)).toBeNull();
    expect(parseAlisverisView(pub, null)).toBeNull();
    expect(parseAlisverisView({ ...pub, budget: 0 }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, heatAt: undefined }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, products: products.slice(1) }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, products: products.map((p) => ({ ...p, id: 1 })) }, priv)).toBeNull();
    expect(
      parseAlisverisView({ ...pub, products: products.map((p) => ({ ...p, id: p.id + 10 })) }, priv),
    ).toBeNull();
    for (const price of [1.5, 5, 41]) {
      expect(
        parseAlisverisView({ ...pub, products: products.map((p) => ({ ...p, price })) }, priv),
      ).toBeNull();
    }
    // Sepet ve kupon yalnız raftaki ürünlerden olabilir.
    expect(parseAlisverisView(pub, { ...priv, basket: [5, 5] })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, basket: [0] })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, basket: [20] })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, coupon: 0 })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, coupon: "12" })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, coupon: undefined })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, remaining: 61 })).toBeNull();
    expect(parseAlisverisView(pub, { ...priv, remaining: -1 })).toBeNull();
    // Ateş: yalnız raftaki ürünler, 0..3 tam sayı.
    expect(parseAlisverisView({ ...pub, heat: { ...heat, "7": 4 } }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, heat: { ...heat, "7": 1.5 } }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, heat: { "7": 3 } }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, heat: [] }, priv)).toBeNull();
    const bad = (r: object) => parseAlisverisView({ ...pub, reveal: r }, priv);
    expect(bad({ ...reveal, winners: ["zzz"] })).toBeNull();
    expect(bad({ ...reveal, values: { a: 1, b: 2 } })).toBeNull();
    expect(bad({ ...reveal, buyers: { "7": 1 } })).toBeNull();
    expect(bad({ ...reveal, baskets: { ...reveal.baskets, a: [99] } })).toBeNull();
    expect(bad({ ...reveal, baskets: { ...reveal.baskets, a: [0] } })).toBeNull();
    expect(bad({ ...reveal, values: { ...reveal.values, a: 0.5 } })).toBeNull();
    expect(bad({ ...reveal, points: { ...reveal.points, a: -1 } })).toBeNull();
    expect(bad({ ...reveal, points: { ...reveal.points, a: 3 } })).toBeNull();
    expect(bad({ ...reveal, points: { a: 1, b: 2 } })).toBeNull();
    expect(bad({ ...reveal, coupons: { ...reveal.coupons, zzz: 5 } })).toBeNull();
    expect(bad({ ...reveal, coupons: { ...reveal.coupons, a: 0 } })).toBeNull();
    const { coupons: _c, ...noCoupons } = reveal;
    expect(bad(noCoupons)).toBeNull();
    expect(parseAlisverisView({ ...pub, reveal: 3 }, priv)).toBeNull();
  });

  it("sepet toplamı kuponla, ürün değeri ve sıralama", () => {
    const lazer = products.find((p) => p.id === 12);
    expect(lazer?.price).toBe(11);
    if (lazer) {
      expect(paidPrice(lazer, 12)).toBe(6); // 11'in yarısı yukarı yuvarlı
      expect(paidPrice(lazer, 5)).toBe(11);
    }
    expect(basketCost([5, 12], products, 12)).toBe(20 + 6);
    expect(basketCost([5, 12], products)).toBe(31);
    expect(basketCost([], products)).toBe(0);
    expect(productValueScaled(24, 2)).toBe(12 * 840);
    expect(productValueText(24, 2)).toBe("12,00");
    expect(productValueText(10, 3)).toBe("3,33");
    expect(productValueText(36, 0)).toBe("36,00");
    expect(ranking(reveal, ["c", "a", "b"])).toEqual(["b", "a", "c"]);
    expect(ranking({ ...reveal, values: { a: 5, b: 5, c: 5 } }, ["c", "a", "b"])).toEqual(["c", "a", "b"]);
    expect(buyersOf(reveal, ["a", "b", "c"])).toEqual({ "7": ["a", "b"], "4": ["b"] });
  });

  it("aynı raf yeniden ayrıştırılınca sameShelf eşit sayar (düğmeler yeniden kurulmaz)", () => {
    const a = parseAlisverisView(pub, priv)?.products ?? [];
    const b = parseAlisverisView({ ...pub, ready: ["a"] }, { ...priv, basket: [5] })?.products ?? [];
    expect(a).not.toBe(b);
    expect(sameShelf(a, b)).toBe(true);
    expect(
      sameShelf(
        a,
        b.map((p, i) => (i === 0 ? { ...p, price: p.price + 1 } : p)),
      ),
    ).toBe(false);
    expect(sameShelf(a, [...b].reverse())).toBe(false);
    expect(sameShelf(a, b.slice(1))).toBe(false);
  });

  it("talep ateşi adı sayı içermez", () => {
    expect([0, 1, 2, 3].map(heatLabel)).toEqual(["İlgi yok", "Biraz ilgi", "İlgi görüyor", "Kapış kapış"]);
    for (const l of [0, 1, 2, 3]) expect(heatLabel(l)).not.toMatch(/\d/);
  });

  it("sonuç zaman çizelgesi bugünkü sonuç süresine sığar ve sahneler sırayla gelir", () => {
    expect(SONUC_ZAMANI.son).toBeLessThanOrEqual(ALISVERIS_REVEAL_MS);
    expect(SONUC_ZAMANI.kepenk).toBeLessThan(SONUC_ZAMANI.cakisma);
    expect(SONUC_ZAMANI.cakisma).toBeLessThan(SONUC_ZAMANI.sepetler);
    expect(SONUC_ZAMANI.sepetler).toBeLessThan(SONUC_ZAMANI.puanlar);
    expect([0, 899, 900, 4_299, 4_300, 6_999, 7_000].map(sonucSahne)).toEqual([0, 0, 1, 1, 2, 2, 3]);
    // Ürünler çakışma sahnesinde, sepetler sepet sahnesinde açılır; son açılan en değerli satırdır.
    expect(urunAcilis(0, 12)).toBe(SONUC_ZAMANI.cakisma);
    expect(urunAcilis(11, 12)).toBeLessThan(SONUC_ZAMANI.sepetler);
    expect(sepetAcilis(0, 8)).toBe(SONUC_ZAMANI.sepetler);
    expect(sepetAcilis(7, 8)).toBeLessThan(SONUC_ZAMANI.puanlar);
    expect(sepetAcilis(7, 8)).toBeGreaterThan(sepetAcilis(6, 8));
  });

  it("ürün kısaltması Türkçe büyük harfli", () => {
    expect(productInitials("Hologram Sticker")).toBe("HS");
    expect(productInitials("Enerji İçeceği")).toBe("Eİ");
    expect(productInitials("VR Gözlük")).toBe("VG");
    expect(productInitials("Neon")).toBe("NE");
    expect(productInitials("ışık")).toBe("IŞ");
  });
});
