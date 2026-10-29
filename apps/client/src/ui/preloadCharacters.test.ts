import { afterEach, describe, expect, it, vi } from "vitest";

describe("preloadCharacters", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("oturum başına yalnız bir kez, boşta çalışacak şekilde kurulur", async () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("location", { search: "" });
    const { preloadCharacters } = await import("./preloadCharacters.js");
    preloadCharacters();
    preloadCharacters();
    expect(idle).toHaveBeenCalledTimes(1);
  });

  it("geliştirme önizlemesinde (?mock=) hiçbir şey kurmaz", async () => {
    const idle = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("location", { search: "?mock=final" });
    const { preloadCharacters } = await import("./preloadCharacters.js");
    preloadCharacters();
    expect(idle).not.toHaveBeenCalled();
  });

  it("takım bir kez kurulur; giysi katmanları tekil, yalnız yenileri istenir", async () => {
    vi.stubGlobal("requestIdleCallback", (f: () => void) => f());
    vi.stubGlobal("location", { search: "" });
    const ensureLayers = vi.fn(async () => undefined);
    const loadKit = vi.fn(async () => ({ ensureLayers }));
    vi.doMock("../character/kit.js", () => ({ loadKit, loadDance: async () => ({}) }));
    vi.doMock("../fx/pixiLoad.js", () => ({ loadPixi: async () => ({}) }));
    const { preloadCharacters } = await import("./preloadCharacters.js");
    preloadCharacters(["sapka", "ceket"]);
    await vi.waitFor(() => expect(ensureLayers).toHaveBeenCalledTimes(1));
    expect(ensureLayers).toHaveBeenLastCalledWith(["sapka", "ceket"]);
    preloadCharacters(["sapka", "ceket"]);
    preloadCharacters(["pelerin"]);
    await vi.waitFor(() => expect(ensureLayers).toHaveBeenCalledTimes(2));
    expect(ensureLayers).toHaveBeenLastCalledWith(["sapka", "ceket", "pelerin"]);
    vi.doUnmock("../character/kit.js");
    vi.doUnmock("../fx/pixiLoad.js");
  });
});
