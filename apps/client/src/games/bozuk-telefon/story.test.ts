import { describe, expect, it } from "vitest";
import { CHAIN_W, chainHeight, stepHeights } from "./chainImage.js";
import { headOf, largestFit, typedCount } from "./fit.js";
import { inkPoints, REPLAY_MAX_MS, replayFrame, replayMs } from "./replay.js";
import { cellLayout, galleryPick, robustPair } from "./story.js";
import type { ParsedRecap, ParsedStep } from "./view.js";

const ink = (n: number, color = 0): number[] => [color, 2, ...Array.from({ length: n * 2 }, (_, i) => i)];
const ERASER = 6;

describe("Bozuk Telefon yazı sığdırma", () => {
  it("sığan en büyük boyut bulunur; hiçbiri sığmazsa en küçük", () => {
    expect(largestFit((s) => s <= 23, 10, 40)).toBe(23);
    expect(largestFit(() => true, 10, 40)).toBe(40);
    expect(largestFit(() => false, 10, 40)).toBe(10);
  });

  it("daktilo: harf sayısı süreyle artar, en çok üst süre içinde tamamlanır; Türkçe harfler bölünmez", () => {
    const t = "KAPLUMBAĞA";
    expect(typedCount(t, 0, 1_200)).toBe(0);
    expect(typedCount(t, 10_000, 1_200)).toBe(10);
    expect(typedCount("Ş".repeat(60), 1_200, 1_200)).toBe(60);
    expect(typedCount("", 5, 1_200)).toBe(0);
    expect(headOf("ĞÜŞİ", 2)).toBe("ĞÜ");
  });
});

describe("Bozuk Telefon yeniden çizim", () => {
  it("süre nokta sayısıyla orantılı, en çok 1,5 sn; boş çizimde 0", () => {
    expect(replayMs([])).toBe(0);
    expect(replayMs([ink(100), ink(120), ink(120), ink(120)])).toBe(REPLAY_MAX_MS);
    expect(replayMs([ink(2)])).toBeGreaterThan(0);
    expect(replayMs([ink(2)])).toBeLessThanOrEqual(REPLAY_MAX_MS);
  });

  it("kalem darbeleri sırayla açılır; silgi baştan uygulanır (silinen mürekkep hiç görünmez)", () => {
    const strokes = [ink(10), [ERASER, 3, 0, 0, 5, 5], ink(10, 4)];
    expect(inkPoints(strokes)).toBe(20);
    const start = replayFrame(strokes, 0);
    expect(start).toEqual([[ERASER, 3, 0, 0, 5, 5]]);
    const half = replayFrame(strokes, 0.5);
    // İlk kalem darbesi tam, silgi yerinde (ilk darbeden sonra), ikinci kalem henüz yok.
    expect(half.map((s) => s[0])).toEqual([0, ERASER]);
    const part = replayFrame(strokes, 0.25);
    expect(part[0]?.length).toBe(2 + 5 * 2);
    expect(replayFrame(strokes, 1)).toEqual(strokes);
  });

  it("silgiden önce gelen mürekkep her karede silgiden önce çizilir (sıra korunur)", () => {
    const strokes = [ink(4), [ERASER, 2, 0, 0, 1, 1], ink(4, 1)];
    for (const f of [0.1, 0.3, 0.6, 0.9]) {
      const frame = replayFrame(strokes, f);
      const e = frame.findIndex((s) => s[0] === ERASER);
      expect(e).toBeGreaterThanOrEqual(0);
      for (const [i, s] of frame.entries()) if (s[0] === 1) expect(i).toBeGreaterThan(e);
    }
  });
});

describe("Bozuk Telefon gösteri yardımcıları", () => {
  const w = (text: string): ParsedStep => ({ kind: "write", author: null, text });
  const d: ParsedStep = { kind: "draw", author: null, drawing: { strokes: [], key: "0" } };

  it("sağlam zincir çifti: ilk cümle ve son yazı adımı", () => {
    expect(robustPair([w("A"), d, w("B"), d])).toEqual(["A", "B"]);
    expect(robustPair([w("A"), d, w("B"), d, w("C")])).toEqual(["A", "C"]);
    expect(robustPair([d])).toBeNull();
  });

  it("galeri: taçlı adım, taç yoksa ilk cümle", () => {
    const r = (crowned: number[]): ParsedRecap => ({
      chain: 0,
      starter: "a",
      steps: [],
      tally: [],
      robust: false,
      crowned,
    });
    expect(galleryPick(r([2, 3]))).toBe(2);
    expect(galleryPick(r([]))).toBe(0);
  });

  it("TV ızgarası en büyük kare hücreyi seçer", () => {
    const l = cellLayout(5, 1000, 600);
    expect(l.cols).toBe(3);
    expect(l.cell).toBeGreaterThan(250);
    expect(cellLayout(0, 100, 100).cell).toBe(0);
  });
});

describe("Bozuk Telefon zincir görseli", () => {
  const fake = { font: "", measureText: (_t: string) => ({ width: 0 }) as TextMetrics };
  fake.measureText = (t: string) => {
    const size = Number(/(\d+)px/.exec(fake.font)?.[1] ?? 40);
    return { width: t.length * size * 0.62 } as TextMetrics;
  };
  const ctx = fake as unknown as CanvasRenderingContext2D;
  const recap: ParsedRecap = {
    chain: 1,
    starter: "a",
    steps: [
      { kind: "write", author: "a", text: "KEDİ UZAYDA PİZZA YİYOR" },
      { kind: "draw", author: "b", drawing: { strokes: [], key: "0" } },
      { kind: "write", author: "c", text: "KAPLUMBAĞALAR GÖKDELENİN TEPESİNDE PİKNİK YAPIYOR" },
    ],
    tally: [0, 2, 1],
    robust: false,
    crowned: [1],
  };

  it("her adım bir kart; çizim kare, yazı satır sayısına göre; toplam yükseklik hepsini kapsar", () => {
    const h = stepHeights(ctx, recap);
    expect(h).toHaveLength(3);
    expect(h[1]).toBe(CHAIN_W - 120);
    expect(h[0]).toBeGreaterThanOrEqual(220);
    const total = chainHeight(h, false);
    expect(total).toBeGreaterThan(h.reduce((a, b) => a + b, 0));
    expect(chainHeight(h, true)).toBeGreaterThan(total);
  });
});
