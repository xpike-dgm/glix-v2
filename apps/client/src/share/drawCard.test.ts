import { describe, expect, it } from "vitest";
import { CARD_H, CARD_W, type CardEnv, FOOTER_TEXT, renderMomentCard, wrapLines } from "./drawCard.js";
import type { Moment } from "./momentCards.js";

/** Çizim çağrılarını kaydeden sahte 2B bağlam. */
function fakeEnv() {
  const texts: string[] = [];
  const canvases: { w: number; h: number }[] = [];
  const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
    canvases.push({ w, h });
    const grad = { addColorStop() {} };
    const ctx = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "measureText") return (t: string) => ({ width: t.length * 20 });
          if (prop === "fillText") return (t: string) => texts.push(t);
          if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => grad;
          if (prop === "canvas") return { width: w, height: h };
          return () => {};
        },
        set: () => true,
      },
    );
    return {
      width: w,
      height: h,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["jpg"], { type: "image/jpeg" })),
    } as unknown as HTMLCanvasElement;
  };
  const env: CardEnv = { makeCanvas, loadImage: async () => null, fontsReady: async () => {} };
  return { env, texts, canvases };
}

const winner: Moment = {
  id: "kazanan",
  kind: "winner",
  title: "Kazanan",
  world: null,
  people: [
    { nickname: "Elif", avatar: 0, rank: 1, caption: "9 puan" },
    { nickname: "Can", avatar: 1, rank: 2, caption: "7 puan" },
  ],
  lines: ["Blöf kralı"],
};

describe("renderMomentCard", () => {
  it("1080x1920 tuval, PNG blob, alt bilgi metni ve takma adlar çizilir", async () => {
    const { env, texts, canvases } = fakeEnv();
    const blob = await renderMomentCard(winner, env);
    expect(blob.type).toBe("image/jpeg");
    expect(canvases[0]).toEqual({ w: CARD_W, h: CARD_H });
    expect(texts).toContain(FOOTER_TEXT);
    expect(texts).toContain("Elif");
    expect(texts).toContain("Kazanan");
  });

  it("çizim kartı ayrı bir tahta tuvali kullanır", async () => {
    const { env, canvases } = fakeEnv();
    await renderMomentCard(
      { ...winner, kind: "drawing", title: "En iyi çizim", strokes: [[10, 10, 500, 500] as never] },
      env,
    );
    expect(canvases.length).toBe(2);
  });
});

describe("wrapLines", () => {
  const m = { measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics };
  it("kelime sınırında böler ve fazlasını kırpar", () => {
    expect(wrapLines(m, "bir iki üç dört", 80, 5)).toEqual(["bir iki", "üç dört"]);
    expect(wrapLines(m, "bir iki üç dört", 40, 2)).toEqual(["bir", "iki…"]);
  });
});
