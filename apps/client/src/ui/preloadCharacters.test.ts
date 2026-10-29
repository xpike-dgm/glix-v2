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
});
