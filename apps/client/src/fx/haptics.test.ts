import { afterEach, describe, expect, it, vi } from "vitest";
import { shapePattern } from "./haptics.js";

describe("shapePattern", () => {
  it("normal harekette deseni olduğu gibi verir", () => {
    expect(shapePattern([14, 40, 14], false)).toEqual([14, 40, 14]);
    expect(shapePattern(10, false)).toEqual([10]);
  });
  it("azaltılmış harekette titreşimleri yarıya indirir, aralara dokunmaz", () => {
    expect(shapePattern([14, 40, 14], true)).toEqual([7, 40, 7]);
    expect(shapePattern(45, true)).toEqual([23]);
  });
  it("çok kısa titreşim en az 6 ms kalır", () => {
    expect(shapePattern(6, true)).toEqual([6]);
  });
});

describe("titreşim ayarı", () => {
  afterEach(() => vi.unstubAllGlobals());
  async function load(enabled: boolean) {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "glix.haptics" ? (enabled ? "1" : "0") : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    const haptics = await import("./haptics.js");
    const settings = await import("../settings/settings.js");
    return { vibrate, haptics, settings };
  }
  it("kapalıyken hiç titreşmez", async () => {
    const { vibrate, haptics } = await load(false);
    haptics.hapticTap();
    haptics.hapticFinal();
    expect(vibrate).not.toHaveBeenCalled();
  });
  it("açıkken titreşir; ayar anında kapatılınca durur", async () => {
    const { vibrate, haptics, settings } = await load(true);
    haptics.hapticTap();
    expect(vibrate).toHaveBeenCalledTimes(1);
    settings.setHaptics(false);
    haptics.hapticTap();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
