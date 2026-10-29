import { describe, expect, it } from "vitest";
import { createMetrics, TICK_BUCKETS_MS } from "./metrics.js";

describe("metrics: birikimli tick histogramı", () => {
  it("süreler kova üst sınırlarına yerleşir; en büyük değer saklanır", () => {
    const m = createMetrics();
    m.recordTick(0.1);
    m.recordTick(0.25);
    m.recordTick(0.26);
    m.recordTick(3.5);
    m.recordTick(5000);
    const h = m.tickHistogram();
    expect(h.counts).toHaveLength(TICK_BUCKETS_MS.length + 1);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(5);
    expect(h.counts[0]).toBe(2); // <= 0.25
    expect(h.counts[1]).toBe(1); // <= 0.5
    expect(h.counts[TICK_BUCKETS_MS.indexOf(4)]).toBe(1);
    expect(h.counts.at(-1)).toBe(1); // sonsuz kova
    expect(h.maxMs).toBe(5000);
  });

  it("p95 son pencereye bakmaya devam eder", () => {
    const m = createMetrics();
    for (let i = 1; i <= 100; i++) m.recordTick(i);
    expect(m.tickMsP95()).toBe(95);
  });
});
