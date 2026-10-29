import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyMerge, diffMerge } from "./mergePatch.js";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("diffMerge / applyMerge: örnekler", () => {
  it("aynı değer için boş yama", () => {
    expect(diffMerge({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual({});
  });
  it("iç içe nesnede yalnız değişen alanı taşır", () => {
    const prev = { a: 1, b: { c: 2, d: 3 }, e: "x" };
    const next = { a: 1, b: { c: 2, d: 4 }, e: "x" };
    expect(diffMerge(prev, next)).toEqual({ b: { d: 4 } });
  });
  it("silinen alan null ile gider", () => {
    expect(diffMerge({ a: 1, b: 2 }, { a: 1 })).toEqual({ b: null });
    expect(applyMerge({ a: 1, b: 2 }, { b: null })).toEqual({ a: 1 });
  });
  it("diziler bütün olarak değişir; dizi içindeki null korunur", () => {
    const prev = { l: [1, 2, 3] };
    const next = { l: [1, null, 3, { x: null }] };
    const patch = diffMerge(prev, next);
    expect(patch).toEqual({ l: [1, null, 3, { x: null }] });
    expect(applyMerge(prev, patch)).toEqual(next);
  });
  it("null olan alan değişmediyse yamada yoktur", () => {
    expect(diffMerge({ m: null, n: 1 }, { m: null, n: 2 })).toEqual({ n: 2 });
  });
  it("null'dan nesneye geçiş yamalanır", () => {
    const prev = { match: null, rev: 1 };
    const next = { match: { round: 0, view: { a: 1 } }, rev: 2 };
    const patch = diffMerge(prev, next);
    expect(patch).toEqual({ match: { round: 0, view: { a: 1 } }, rev: 2 });
    expect(applyMerge(prev, patch)).toEqual(next);
  });
  it("değerin null'a dönmesi ifade edilemez: null döner (tam snapshot gerekir)", () => {
    expect(diffMerge({ match: { a: 1 } }, { match: null })).toBeNull();
    expect(diffMerge({ t: 5 }, { t: null })).toBeNull();
    expect(diffMerge({}, { t: null })).toBeNull();
    expect(diffMerge({ a: { b: 1 } }, { a: { b: null } })).toBeNull();
  });
  it("yeni yazılan nesnenin içinde null varsa ifade edilemez", () => {
    expect(diffMerge({ m: null }, { m: { x: null } })).toBeNull();
    expect(diffMerge({}, { m: { y: { x: null } } })).toBeNull();
  });
  it("nesne olmayan girdi ve __proto__ ifade edilemez", () => {
    expect(diffMerge(null, {})).toBeNull();
    expect(diffMerge([], {})).toBeNull();
    expect(diffMerge({}, JSON.parse('{"__proto__":{"x":1}}'))).toBeNull();
  });
  it("applyMerge girdiyi değiştirmez ve değişmeyen kısmı paylaşır", () => {
    const target = { a: { x: 1 }, b: { y: 2 } };
    const frozen = clone(target);
    const out = applyMerge(target, { a: { x: 9 } }) as typeof target;
    expect(target).toEqual(frozen);
    expect(out.a.x).toBe(9);
    expect(out.b).toBe(target.b);
  });
  it("applyMerge __proto__ anahtarını yok sayar", () => {
    const out = applyMerge({}, JSON.parse('{"__proto__":{"polluted":1},"a":1}'));
    expect(out).toEqual({ a: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("yama nesne değilse yamanın kendisidir (RFC)", () => {
    expect(applyMerge({ a: 1 }, [1])).toEqual([1]);
    expect(applyMerge({ a: 1 }, 5)).toBe(5);
  });
});

// JSON benzeri rastgele değerler (undefined yok). Nesne alanları küçük bir anahtar kümesinden gelir ki
// iki değer arasında çakışma (iç içe birleşme) sık olsun.
const key = fc.constantFrom("a", "b", "c", "d");
const leaf = fc.oneof(
  fc.integer({ min: -3, max: 3 }),
  fc.boolean(),
  fc.constantFrom("x", "y"),
  fc.constant(null),
);
const jsonValue = fc.letrec((tie) => ({
  v: fc.oneof(
    { depthSize: "small" },
    leaf,
    fc.array(tie("v"), { maxLength: 3 }),
    fc.dictionary(key, tie("v"), { maxKeys: 4 }),
  ),
})).v;
const jsonObject = fc.dictionary(key, jsonValue, { maxKeys: 4 });

describe("diffMerge: eşitlik", () => {
  it("tanımsız alanlar yok sayılır, iç içe diziler ve nesneler değer olarak karşılaştırılır", () => {
    expect(diffMerge({ a: [{ x: 1, y: undefined }] }, { a: [{ x: 1 }] })).toEqual({});
    expect(diffMerge({ a: { x: 1, y: [1, { z: 2 }] } }, { a: { x: 1, y: [1, { z: 2 }] } })).toEqual({});
    expect(diffMerge({ a: [1, 2] }, { a: [1, 2, 3] })).toEqual({ a: [1, 2, 3] });
    expect(diffMerge({ a: [{ x: 1 }] }, { a: [{ x: 2 }] })).toEqual({ a: [{ x: 2 }] });
    expect(diffMerge({ a: [{ x: 1 }] }, { a: [{ x: 1, y: 2 }] })).toEqual({ a: [{ x: 1, y: 2 }] });
    expect(diffMerge({ a: [{ x: 1, y: 2 }] }, { a: [{ x: 1 }] })).toEqual({ a: [{ x: 1 }] });
    expect(diffMerge({ a: [{ x: 1, y: undefined }] }, { a: [{ x: 1, z: undefined }] })).toEqual({});
  });
});

describe("diffMerge / applyMerge: özellikler", () => {
  it("diff üretildiyse apply(prev, diff) === next", () => {
    fc.assert(
      fc.property(jsonObject, jsonObject, (prev, next) => {
        const patch = diffMerge(prev, next);
        if (patch === null) return true;
        expect(applyMerge(prev, patch)).toEqual(next);
        return true;
      }),
      { numRuns: 2000 },
    );
  });
  it("null içermeyen nesne ağaçlarında yama her zaman üretilir ve doğrudur", () => {
    const noNull = fc.letrec((tie) => ({
      v: fc.oneof(
        { depthSize: "small" },
        fc.integer({ min: -3, max: 3 }),
        fc.constantFrom("x", "y"),
        fc.array(fc.oneof(fc.constant(null), fc.integer()), { maxLength: 3 }),
        fc.dictionary(key, tie("v"), { maxKeys: 4 }),
      ),
    })).v;
    const obj = fc.dictionary(key, noNull, { maxKeys: 4 });
    fc.assert(
      fc.property(obj, obj, (prev, next) => {
        const patch = diffMerge(prev, next);
        expect(patch).not.toBeNull();
        expect(applyMerge(prev, patch)).toEqual(next);
      }),
      { numRuns: 2000 },
    );
  });
  it("kendisiyle fark boştur", () => {
    fc.assert(
      fc.property(jsonObject, (o) => {
        expect(diffMerge(o, clone(o))).toEqual({});
      }),
    );
  });
  it("prev değişmez", () => {
    fc.assert(
      fc.property(jsonObject, jsonObject, (prev, next) => {
        const copy = clone(prev);
        const patch = diffMerge(prev, next);
        applyMerge(prev, patch);
        expect(prev).toEqual(copy);
      }),
    );
  });
});
