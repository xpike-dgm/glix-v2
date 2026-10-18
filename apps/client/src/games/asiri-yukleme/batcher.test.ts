import { describe, expect, it } from "vitest";
import { createTapBatcher } from "./batcher.js";

function harness(intervalMs = 80, maxBatch = 10) {
  let now = 0;
  const sent: { at: number; count: number }[] = [];
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const b = createTapBatcher({
    send: (count) => sent.push({ at: now, count }),
    now: () => now,
    setTimer: (fn, ms) => {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clearTimer: (h) => {
      timers.delete(h as number);
    },
    intervalMs,
    maxBatch,
  });
  const advance = (to: number): void => {
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= to).sort((a, c) => a[1].at - c[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = to;
  };
  return { b, sent, advance, at: () => now };
}

describe("tıklama toplayıcı", () => {
  it("boştaki ilk tıklama hemen gider", () => {
    const h = harness();
    h.b.tap();
    expect(h.sent).toEqual([{ at: 0, count: 1 }]);
  });

  it("aralık içindeki tıklamalar toplanıp pencere sonunda tek mesaj olur", () => {
    const h = harness();
    h.b.tap();
    h.advance(10);
    h.b.tap();
    h.advance(30);
    h.b.tap();
    h.advance(79);
    expect(h.sent).toHaveLength(1);
    h.advance(80);
    expect(h.sent).toEqual([
      { at: 0, count: 1 },
      { at: 80, count: 2 },
    ]);
  });

  it("saniyede 20 dokunuşta bile mesaj hızı 12,5/sn'yi aşmaz ve hiçbir tık kaybolmaz", () => {
    const h = harness();
    let taps = 0;
    for (let t = 0; t < 5_000; t += 50) {
      h.advance(t);
      h.b.tap();
      taps++;
    }
    h.advance(6_000);
    expect(h.sent.reduce((s, m) => s + m.count, 0)).toBe(taps);
    expect(h.sent.length).toBeLessThanOrEqual(Math.ceil(5_000 / 80) + 2);
    for (let i = 1; i < h.sent.length; i++) {
      expect((h.sent[i]?.at ?? 0) - (h.sent[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(80);
    }
  });

  it("bir mesaj en çok maxBatch tık taşır; fazlası sonraki pencerede gider", () => {
    const h = harness(80, 10);
    h.b.tap(); // hemen
    for (let i = 0; i < 25; i++) h.b.tap();
    h.advance(80);
    h.advance(160);
    h.advance(240);
    expect(h.sent.map((m) => m.count)).toEqual([1, 10, 10, 5]);
  });

  it("drop bekleyenleri atar ve sonradan mesaj göndermez", () => {
    const h = harness();
    h.b.tap();
    h.b.tap();
    h.b.tap();
    h.b.drop();
    h.advance(1_000);
    expect(h.sent).toEqual([{ at: 0, count: 1 }]);
    expect(h.b.pending()).toBe(0);
  });

  it("uzun bir boşluktan sonra yine ilk tıklama hemen gider", () => {
    const h = harness();
    h.b.tap();
    h.advance(5_000);
    h.b.tap();
    expect(h.sent).toEqual([
      { at: 0, count: 1 },
      { at: 5_000, count: 1 },
    ]);
  });
});
