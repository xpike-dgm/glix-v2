import { ALISVERIS_CATALOG, type AlisverisPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  basketCost,
  parseAlisverisView,
  productInitials,
  productValueScaled,
  productValueText,
  ranking,
} from "./view.js";

const products = ALISVERIS_CATALOG.map((p) => ({ ...p })).reverse();
const pub: AlisverisPublicView = {
  startedAt: 1,
  endsAt: 30_001,
  revealEndsAt: 38_001,
  budget: 60,
  products,
  reveal: null,
};
const priv = { basket: [3, 5], remaining: 25 };
const buyers = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i), i === 7 ? 2 : 0]));
const reveal = {
  baskets: { a: [7], b: [7, 0], c: [] },
  buyers,
  values: { a: 10_080, b: 16_800, c: 0 },
  winners: ["b"],
};

describe("Gizli Alışveriş görünümü", () => {
  it("geçerli görünümü okur", () => {
    expect(parseAlisverisView(pub, priv)).toMatchObject({ budget: 60, remaining: 25, basket: [3, 5] });
    expect(parseAlisverisView({ ...pub, reveal }, priv)?.reveal?.winners).toEqual(["b"]);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseAlisverisView(null, priv)).toBeNull();
    expect(parseAlisverisView(pub, null)).toBeNull();
    expect(parseAlisverisView({ ...pub, budget: 0 }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, products: products.slice(1) }, priv)).toBeNull();
    expect(parseAlisverisView({ ...pub, products: products.map((p) => ({ ...p, id: 1 })) }, priv)).toBeNull();
    expect(
      parseAlisverisView({ ...pub, products: products.map((p) => ({ ...p, price: 1.5 })) }, priv),
    ).toBeNull();
    expect(parseAlisverisView(pub, { basket: [3, 3], remaining: 25 })).toBeNull();
    expect(parseAlisverisView(pub, { basket: [12], remaining: 25 })).toBeNull();
    expect(parseAlisverisView(pub, { basket: [], remaining: 61 })).toBeNull();
    expect(parseAlisverisView(pub, { basket: [], remaining: -1 })).toBeNull();
    const bad = (r: object) => parseAlisverisView({ ...pub, reveal: r }, priv);
    expect(bad({ ...reveal, winners: ["zzz"] })).toBeNull();
    expect(bad({ ...reveal, values: { a: 1, b: 2 } })).toBeNull();
    expect(bad({ ...reveal, buyers: { "0": 1 } })).toBeNull();
    expect(bad({ ...reveal, baskets: { ...reveal.baskets, a: [99] } })).toBeNull();
    expect(bad({ ...reveal, values: { ...reveal.values, a: 0.5 } })).toBeNull();
    expect(parseAlisverisView({ ...pub, reveal: 3 }, priv)).toBeNull();
  });

  it("sepet toplamı, ürün değeri ve sıralama", () => {
    expect(basketCost([0, 11], products)).toBe(44);
    expect(basketCost([], products)).toBe(0);
    expect(productValueScaled(24, 2)).toBe(12 * 840);
    expect(productValueText(24, 2)).toBe("12,00");
    expect(productValueText(10, 3)).toBe("3,33");
    expect(productValueText(36, 0)).toBe("36,00");
    expect(ranking(reveal, ["c", "a", "b"])).toEqual(["b", "a", "c"]);
    expect(ranking({ ...reveal, values: { a: 5, b: 5, c: 5 } }, ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("ürün kısaltması Türkçe büyük harfli", () => {
    expect(productInitials("Hologram Sticker")).toBe("HS");
    expect(productInitials("Enerji İçeceği")).toBe("Eİ");
    expect(productInitials("Neon")).toBe("NE");
    expect(productInitials("ışık")).toBe("IŞ");
  });
});
