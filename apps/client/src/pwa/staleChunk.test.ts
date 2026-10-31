import { beforeEach, describe, expect, it, vi } from "vitest";
import { isStaleChunkError, recoverFromStaleChunk } from "./staleChunk.js";

describe("eski sürüm parçası", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });

  it("tarayıcıların parça yükleme hatalarını tanır, diğerlerini tanımaz", () => {
    expect(isStaleChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(
      isStaleChunkError(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")),
    ).toBe(true);
    expect(isStaleChunkError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });

  it("bir kez yeniler; 60 sn içinde ikinci kez yenilemez", () => {
    const reload = vi.fn();
    expect(recoverFromStaleChunk(reload)).toBe(true);
    expect(recoverFromStaleChunk(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
