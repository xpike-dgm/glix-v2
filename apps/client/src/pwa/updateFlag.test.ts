import { describe, expect, it } from "vitest";
import { consumeUpdated, markUpdated } from "./updateFlag.js";

function fakeStore() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("güncelleme bayrağı", () => {
  it("bir kez okunur", () => {
    const s = fakeStore();
    expect(consumeUpdated(s)).toBe(false);
    markUpdated(s);
    expect(consumeUpdated(s)).toBe(true);
    expect(consumeUpdated(s)).toBe(false);
  });
  it("depolama atarsa ya da yoksa sessizce düşer", () => {
    const boom = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => undefined,
    };
    expect(() => markUpdated(boom)).not.toThrow();
    expect(consumeUpdated(boom)).toBe(false);
    expect(consumeUpdated(null)).toBe(false);
    expect(() => markUpdated(null)).not.toThrow();
  });
});
