import { describe, expect, it } from "vitest";
import { latestGate } from "./latestGate.js";

describe("latestGate", () => {
  it("yalnız son açılan istek geçerlidir", () => {
    const begin = latestGate();
    const a = begin();
    expect(a()).toBe(true);
    const b = begin();
    expect(a()).toBe(false);
    expect(b()).toBe(true);
  });

  it("eski yavaş sonuç, yeni hızlı sonucun üstüne yazmaz", async () => {
    const begin = latestGate();
    let shown = "";
    const run = async (name: string, ms: number): Promise<void> => {
      const current = begin();
      await new Promise((r) => setTimeout(r, ms));
      if (current()) shown = name;
    };
    await Promise.all([run("eski", 20), run("yeni", 0)]);
    expect(shown).toBe("yeni");
  });
});
