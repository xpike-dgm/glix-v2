import { afterEach, describe, expect, it, vi } from "vitest";
import { iosSwitchSupported, mayUseSwitch, pickHapticPath, shapePattern } from "./haptics.js";

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

describe("titreşim yolu seçimi", () => {
  it("ayar kapalıysa hiçbir yol yok", () => {
    expect(pickHapticPath({ enabled: false, hasVibrate: true, iosSwitch: true })).toBe("none");
  });
  it("vibrate varsa o; yoksa iOS anahtarı; ikisi de yoksa hiç", () => {
    expect(pickHapticPath({ enabled: true, hasVibrate: true, iosSwitch: true })).toBe("vibrate");
    expect(pickHapticPath({ enabled: true, hasVibrate: false, iosSwitch: true })).toBe("ios-switch");
    expect(pickHapticPath({ enabled: true, hasVibrate: false, iosSwitch: false })).toBe("none");
  });
  it("anahtar yolu yalnız iPhone ve switch desteğiyle", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    const ipad =
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
    expect(iosSwitchSupported(iphone, true)).toBe(true);
    expect(iosSwitchSupported(iphone, false)).toBe(false);
    expect(iosSwitchSupported(ipad, true)).toBe(false);
    expect(iosSwitchSupported("Mozilla/5.0 (Linux; Android 14) Chrome/124", true)).toBe(false);
  });
  it("etkin dokunuş yokken anahtar denenmez", () => {
    expect(mayUseSwitch(false)).toBe(false);
    expect(mayUseSwitch(true)).toBe(true);
    expect(mayUseSwitch(undefined)).toBe(true);
  });
});
