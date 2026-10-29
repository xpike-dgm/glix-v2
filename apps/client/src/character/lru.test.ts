import { describe, expect, it } from "vitest";
import { Lru } from "./lru.js";

describe("Lru", () => {
  it("sınırı aşınca en eski kaydı çıkarır ve haber verir", () => {
    const out: string[] = [];
    const c = new Lru<string, number>(2, (k) => out.push(k));
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    expect(c.size).toBe(2);
    expect(c.get("a")).toBeUndefined();
    expect(out).toEqual(["a"]);
  });

  it("get kaydı en yeni yapar", () => {
    const out: string[] = [];
    const c = new Lru<string, number>(2, (k) => out.push(k));
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(out).toEqual(["b"]);
    expect(c.get("a")).toBe(1);
  });

  it("delete çıkarma haberi vermez; uzun döngüde boyut sınırlı kalır", () => {
    const out: number[] = [];
    const c = new Lru<number, number>(5, (k) => out.push(k));
    c.set(1, 1);
    c.delete(1);
    expect(out).toEqual([]);
    for (let i = 0; i < 1000; i++) c.set(i, i);
    expect(c.size).toBe(5);
    expect(out.length).toBe(995);
  });
});
