import { PERF_LIMITS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  createPerfCollector,
  MAX_PENDING_ACKS,
  medianOf,
  nextReloadCount,
  percentile,
  platformGroup,
} from "./perf.js";

function setup() {
  let t = 1000;
  const c = createPerfCollector(() => t);
  return {
    c,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("yüzdelik ve medyan", () => {
  it("en yakın sıra yöntemi; boşsa 0", () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([5], 0.95)).toBe(5);
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 0.5)).toBe(50);
    expect(percentile(v, 0.95)).toBe(95);
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("performans toplayıcı", () => {
  it("eylem->onay gecikmesini seq başına ölçer", () => {
    const { c, advance } = setup();
    c.actionSent(1);
    c.actionSent(2);
    advance(40);
    c.actionAcked(1);
    advance(60);
    c.actionAcked(2);
    c.actionAcked(2); // ikinci onay yok sayılır
    c.actionAcked(99); // bilinmeyen seq yok sayılır
    const s = c.sample();
    expect(s).toMatchObject({ ackN: 2, ackP50: 40, ackP95: 100 });
  });

  it("RTT son örneklerin medyanıdır; bozuk örnekler atılır", () => {
    const { c } = setup();
    for (const ms of [30, 500, 40, 50, -5, Number.NaN]) c.addRtt(ms);
    c.actionSent(1);
    c.actionAcked(1);
    expect(c.sample()?.rttMs).toBe(45);
  });

  it("yavaş dokunma ve uzun görevleri sayar", () => {
    const { c } = setup();
    for (const d of [48, 120, 201, 400]) c.interaction(d);
    c.longTask(80);
    c.longTask(120.4);
    expect(c.sample()).toMatchObject({ slowTaps: 2, tapP95: 400, longTasks: 2, longTaskMs: 200, ackN: 0 });
  });

  it("sinyal yoksa örnek null", () => {
    const { c } = setup();
    expect(c.sample()).toBeNull();
    c.addRtt(30);
    expect(c.sample()).toBeNull();
  });

  it("reset sayaçları sıfırlar ama RTT'yi korur", () => {
    const { c, advance } = setup();
    c.addRtt(70);
    c.actionSent(1);
    advance(10);
    c.actionAcked(1);
    c.interaction(300);
    c.longTask(60);
    c.actionSent(2); // reset sonrası gelen onay eşleşmemeli
    c.reset();
    expect(c.sample()).toBeNull();
    c.actionAcked(2);
    c.actionSent(3);
    advance(25);
    c.actionAcked(3);
    expect(c.sample()).toEqual({
      rttMs: 70,
      ackP50: 25,
      ackP95: 25,
      ackN: 1,
      slowTaps: 0,
      tapP95: 0,
      longTasks: 0,
      longTaskMs: 0,
      reconnects: 0,
    });
  });

  it("bekleyen eylem tablosu sınırlıdır (en eski atılır)", () => {
    const { c, advance } = setup();
    for (let i = 1; i <= MAX_PENDING_ACKS + 10; i++) c.actionSent(i);
    advance(5);
    c.actionAcked(1); // atılmıştı
    c.actionAcked(MAX_PENDING_ACKS + 10);
    expect(c.sample()?.ackN).toBe(1);
  });

  it("değerler yuvarlanır ve protokol sınırlarına kırpılır", () => {
    const { c, advance } = setup();
    c.actionSent(1);
    advance(10 ** 7);
    c.actionAcked(1);
    c.longTask(10 ** 9);
    const s = c.sample();
    expect(s?.ackP95).toBe(PERF_LIMITS.ackP95);
    expect(s?.longTaskMs).toBe(PERF_LIMITS.longTaskMs);
  });
});

describe("platform grubu", () => {
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  it("iPhone ve iPad (Macintosh görünümlü dokunmatik) ios", () => {
    expect(platformGroup({ userAgent: iphone })).toBe("ios");
    expect(
      platformGroup({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
  });
  it("iOS üzerindeki Chrome da ios (aynı motor)", () => {
    expect(platformGroup({ userAgent: iphone.replace("Version/17.4", "CriOS/123.0") })).toBe("ios");
  });
  it("Android android; masaüstü ve Mac diger", () => {
    expect(
      platformGroup({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36" }),
    ).toBe("android");
    expect(
      platformGroup({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("diger");
    expect(platformGroup({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0" })).toBe("diger");
  });
});

describe("kopma ve yenileme sayıları", () => {
  it("yeniden bağlanma tek başına örnek üretir ve reset sıfırlar", () => {
    const { c } = setup();
    c.reconnect();
    c.reconnect();
    expect(c.sample()).toMatchObject({ reconnects: 2 });
    c.reset();
    expect(c.sample()).toBeNull();
  });
  it("sayfa yenileme: yenile ya da bellekten atılma sayılır, normal açılış sayılmaz", () => {
    expect(nextReloadCount(0, "navigate", false)).toBe(0);
    expect(nextReloadCount(0, "reload", false)).toBe(1);
    expect(nextReloadCount(1, "back_forward", true)).toBe(2);
  });
});
