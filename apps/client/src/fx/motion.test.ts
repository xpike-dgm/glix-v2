import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveReducedMotion } from "./motion.js";

describe("resolveReducedMotion", () => {
  it("Açık her zaman azaltır, Kapalı hiç azaltmaz", () => {
    expect(resolveReducedMotion("reduce", false)).toBe(true);
    expect(resolveReducedMotion("full", true)).toBe(false);
  });
  it("Cihaza göre sistem tercihini izler", () => {
    expect(resolveReducedMotion("auto", true)).toBe(true);
    expect(resolveReducedMotion("auto", false)).toBe(false);
  });
});

describe("reducedMotion (ayar + sistem)", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function load(system: boolean) {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: system }) });
    const settings = await import("../settings/settings.js");
    const motion = await import("./motion.js");
    return { settings, motion };
  }
  it("ayar sistem tercihini ezer", async () => {
    const { settings, motion } = await load(true);
    expect(motion.reducedMotion()).toBe(true);
    settings.setMotion("full");
    expect(motion.reducedMotion()).toBe(false);
    settings.setMotion("auto");
    expect(motion.reducedMotion()).toBe(true);
  });
  it("sistem hareket istiyorsa Açık yine azaltır", async () => {
    const { settings, motion } = await load(false);
    expect(motion.reducedMotion()).toBe(false);
    settings.setMotion("reduce");
    expect(motion.reducedMotion()).toBe(true);
  });
});
