import { describe, expect, it } from "vitest";
import { clockFractions, cupColor, gridColumns, parseZehirliKadehView, secondsLeft } from "./view.js";

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
    const v = parseZehirliKadehView(pub, { role: "player" });
    expect(v?.pub.holdings.a).toBe(1);
    expect(v?.pub.swaps[0]?.to).toBe("b");
    expect(v?.priv.role).toBe("player");
  });
  it("sonucu okur", () => {
    const v = parseZehirliKadehView(
      { ...pub, ended: true, result: { clean: ["a"], poisoned: ["b", "c"], poisonedCups: [0, 2] } },
      { role: "spectator" },
    );
    expect(v?.pub.result?.poisonedCups).toEqual([0, 2]);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseZehirliKadehView(null, { role: "player" })).toBeNull();
    expect(parseZehirliKadehView(pub, { role: "x" })).toBeNull();
    expect(parseZehirliKadehView({ ...pub, holdings: { a: "1" } }, { role: "player" })).toBeNull();
    expect(parseZehirliKadehView({ ...pub, swaps: [{ seq: 1 }] }, { role: "player" })).toBeNull();
    expect(parseZehirliKadehView({ ...pub, swapped: [1] }, { role: "player" })).toBeNull();
    expect(parseZehirliKadehView({ ...pub, ended: "evet" }, { role: "player" })).toBeNull();
    expect(
      parseZehirliKadehView(
        { ...pub, result: { clean: [], poisoned: [], poisonedCups: ["x"] } },
        { role: "player" },
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
    expect(gridColumns(2)).toBe(2);
    expect(gridColumns(5)).toBe(3);
    expect(gridColumns(8)).toBe(4);
    expect(cupColor(0)).toBe("#2EF2FF");
    expect(cupColor(9)).toBe("#FF2BD6");
  });
});
