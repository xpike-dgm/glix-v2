import { describe, expect, it } from "vitest";
import { parseRusRuletiPrivateView, parseRusRuletiPublicView } from "./view.js";

describe("rus-ruleti tahmin görünümü", () => {
  it("elenen görünümü tahmini ve sonucu taşır; bozuk alan reddedilir", () => {
    expect(
      parseRusRuletiPrivateView({
        role: "out",
        turn: 3,
        prediction: false,
        lastResult: { turn: 2, correct: true },
      }),
    ).toEqual({ role: "out", turn: 3, prediction: false, lastResult: { turn: 2, correct: true } });
    expect(parseRusRuletiPrivateView({ role: "out", turn: 3, prediction: "x", lastResult: null })).toBeNull();
    expect(parseRusRuletiPrivateView({ role: "out", prediction: null, lastResult: null })).toBeNull();
    expect(parseRusRuletiPrivateView({ role: "alive" })).toEqual({ role: "alive" });
  });
  it("kâhin listesi yalnız sonuçta gelir; eksikse boş", () => {
    const base = {
      startedAt: 1,
      players: ["a", "b"],
      alive: ["a"],
      eliminated: ["b"],
      holder: "a",
      risk: 16,
      shots: 1,
      last: null,
      openAt: 1,
      deadline: null,
      over: true,
    };
    const withBadge = parseRusRuletiPublicView({
      ...base,
      result: { survivors: ["a"], eliminated: ["b"], kahinler: ["b"] },
    });
    expect(withBadge?.result?.kahinler).toEqual(["b"]);
    expect(
      parseRusRuletiPublicView({ ...base, result: { survivors: ["a"], eliminated: ["b"] } })?.result
        ?.kahinler,
    ).toEqual([]);
  });
});
