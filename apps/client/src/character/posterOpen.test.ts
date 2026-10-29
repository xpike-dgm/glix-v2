import { afterEach, describe, expect, it, vi } from "vitest";

const loadPixi = vi.fn();
vi.mock("../fx/pixiLoad.js", () => ({
  APP_VIEW_ONLY: { removeView: true },
  loadPixi: () => loadPixi(),
}));
vi.mock("./kit.js", () => ({
  loadKit: async () => ({}),
  loadDance: async () => {
    throw new Error("dans yok");
  },
}));

afterEach(() => {
  vi.resetModules();
  loadPixi.mockReset();
});

describe("afiş çizim bağlamı", () => {
  it("açılış bir kez başarısız olursa sonraki afiş yeniden dener (hata kalıcı olmaz)", async () => {
    loadPixi.mockRejectedValueOnce(new Error("webgl yok")).mockRejectedValueOnce(new Error("yine yok"));
    const { renderPoster } = await import("./poster.js");
    const req = { layers: [], dance: null, hue: 0, focus: "full" } as const;
    await expect(renderPoster(req)).rejects.toThrow("webgl yok");
    await expect(renderPoster({ ...req, hue: 90 })).rejects.toThrow("yine yok");
    expect(loadPixi).toHaveBeenCalledTimes(2);
  });

  it("başarısız afiş önbelleğe girmez: aynı istek yeniden denenir", async () => {
    loadPixi.mockRejectedValue(new Error("webgl yok"));
    const { renderPoster } = await import("./poster.js");
    const req = { layers: [], dance: null, hue: 0, focus: "head" } as const;
    await expect(renderPoster(req)).rejects.toThrow();
    await expect(renderPoster(req)).rejects.toThrow();
    expect(loadPixi).toHaveBeenCalledTimes(2);
  });
});
