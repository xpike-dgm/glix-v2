import { describe, expect, it } from "vitest";
import {
  candleLeft,
  clockFractions,
  cupColor,
  cupSeats,
  hashSeed,
  isTense,
  parseZehirliKadehView,
  revealPlan,
  seatLayout,
  secondsLeft,
  ZK_REVEAL,
} from "./view.js";

const pub = {
  startedAt: 0,
  endsAt: 25_000,
  players: ["a", "b", "c"],
  holdings: { a: 1, b: 0, c: 2 },
  swapped: ["a"],
  swaps: [{ seq: 1, from: "a", to: "b", at: 3000 }],
  poisonCount: 1,
  ended: false,
  result: null,
};

describe("Zehirli Kadeh görünümü", () => {
  it("geçerli görünümleri okur", () => {
    const v = parseZehirliKadehView(pub, { role: "player", check: null });
    expect(v?.pub.holdings.a).toBe(1);
    expect(v?.pub.swaps[0]?.to).toBe("b");
    expect(v?.priv.role).toBe("player");
  });
  it("sonucu okur", () => {
    const v = parseZehirliKadehView(
      { ...pub, ended: true, result: { clean: ["a"], poisoned: ["b", "c"], poisonedCups: [0, 2] } },
      { role: "spectator", check: null },
    );
    expect(v?.pub.result?.poisonedCups).toEqual([0, 2]);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseZehirliKadehView(null, { role: "player", check: null })).toBeNull();
    expect(parseZehirliKadehView(pub, { role: "x" })).toBeNull();
    expect(
      parseZehirliKadehView({ ...pub, holdings: { a: "1" } }, { role: "player", check: null }),
    ).toBeNull();
    expect(
      parseZehirliKadehView({ ...pub, swaps: [{ seq: 1 }] }, { role: "player", check: null }),
    ).toBeNull();
    expect(parseZehirliKadehView({ ...pub, swapped: [1] }, { role: "player", check: null })).toBeNull();
    expect(parseZehirliKadehView({ ...pub, ended: "evet" }, { role: "player", check: null })).toBeNull();
    expect(
      parseZehirliKadehView(
        { ...pub, result: { clean: [], poisoned: [], poisonedCups: ["x"] } },
        { role: "player", check: null },
      ),
    ).toBeNull();
  });
  it("yardımcılar", () => {
    expect(secondsLeft(10_000, 8_001)).toBe(2);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
    const f = clockFractions(0, 25_000, 1, 5_000);
    expect(f.left).toBeCloseTo(0.8);
    expect(f.bonus).toBeCloseTo(0.2);
    expect(clockFractions(0, 20_000, 0, 30_000).left).toBe(0);
    expect(cupColor(0)).toBe("#2EF2FF");
    expect(cupColor(9)).toBe("#FF2BD6");
  });
});

describe("Zehirli Kadeh kontrol görünümü", () => {
  it("kontrol sonucunu okur; eski biçimi (check yok) boş sayar", () => {
    expect(
      parseZehirliKadehView(pub, { role: "player", check: { cup: 2, poisoned: true } })?.priv.check,
    ).toEqual({
      cup: 2,
      poisoned: true,
    });
    expect(parseZehirliKadehView(pub, { role: "player" })?.priv.check).toBeNull();
  });
  it("bozuk kontrolü ve izleyicideki kontrolü reddeder", () => {
    for (const check of [
      { cup: "2", poisoned: true },
      { cup: 2, poisoned: "evet" },
      { cup: -1, poisoned: false },
      { cup: 1.5, poisoned: false },
      [],
      7,
    ]) {
      expect(parseZehirliKadehView(pub, { role: "player", check })).toBeNull();
    }
    expect(parseZehirliKadehView(pub, { role: "spectator", check: { cup: 1, poisoned: false } })).toBeNull();
  });
});

describe("Zehirli Kadeh masası", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])(
    "%i oyuncu: herkese bir koltuk, kadehler masada, koltuklar çakışmaz",
    (n) => {
      const seats = seatLayout(n);
      expect(seats).toHaveLength(n);
      const keys = new Set(seats.map((s) => `${Math.round(s.cx)}:${Math.round(s.cy)}`));
      expect(keys.size).toBe(n);
      for (const s of seats) {
        expect(s.cx).toBeGreaterThan(20);
        expect(s.cx).toBeLessThan(80);
        expect(s.cy).toBeGreaterThan(0);
        expect(s.cy).toBeLessThan(100);
        expect(s.ay).toBeLessThanOrEqual(100);
      }
      // Tek sayıda oyuncuda sonuncu masanın başında.
      expect(seats[n - 1]?.side).toBe(n % 2 === 1 ? "head" : "r");
    },
  );
  it("kadehin koltuğu, elinde tutanın koltuğudur", () => {
    const m = cupSeats(["a", "b", "c"], { a: 2, b: 0, c: 1 });
    expect(m.get(2)).toBe(0);
    expect(m.get(0)).toBe(1);
    expect(m.get(1)).toBe(2);
  });
  it("mum kalan süreyle erir, takasla uzar; son 5 sn gerilimi", () => {
    expect(candleLeft(0, 20_000, 10_000)).toBeCloseTo(0.5);
    expect(candleLeft(0, 25_000, 10_000)).toBeCloseTo(0.6);
    expect(isTense(20_000, 15_001, false)).toBe(true);
    expect(isTense(20_000, 14_000, false)).toBe(false);
    expect(isTense(20_000, 15_001, true)).toBe(false);
    expect(isTense(20_000, 20_000, false)).toBe(false);
  });
});

describe("Zehirli Kadeh açılışı", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  it("senin kadehin en son açılır; sıra tohuma göre belirli ve rastgele", () => {
    const p = revealPlan(ids, "c", 42);
    expect(p.order).toHaveLength(8);
    expect(p.order.at(-1)).toBe("c");
    expect(new Set(p.order).size).toBe(8);
    expect(revealPlan(ids, "c", 42).order).toEqual(p.order);
    const orders = new Set(Array.from({ length: 20 }, (_, s) => revealPlan(ids, "c", s + 1).order.join()));
    expect(orders.size).toBeGreaterThan(5);
  });
  it("şerefe önce gelir; zaman sırası artar; tamamı bugünkü sonuç süresine sığar", () => {
    const p = revealPlan(ids, "a", 7);
    const times = p.order.map((id) => p.at[id] as number);
    expect(times[0]).toBe(ZK_REVEAL.cheersMs);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1] as number);
    expect(p.doneMs).toBeLessThan(10_000);
  });
  it("izleyicide herkes sırayla açılır", () => {
    const p = revealPlan(["a", "b"], "", 3);
    expect([...p.order].sort()).toEqual(["a", "b"]);
    expect(hashSeed("x")).toBe(hashSeed("x"));
    expect(hashSeed("x")).not.toBe(hashSeed("y"));
  });
});
