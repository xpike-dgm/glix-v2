import { describe, expect, it } from "vitest";
import { crewColumns, parseRusRuletiView, riskFraction, stageOf } from "./view.js";

const shot = { seq: 2, shooter: "a", target: "b", auto: false, exploded: true, risk: 26, at: 5000 };
const pub = {
  startedAt: 100,
  players: ["a", "b", "c", "d"],
  alive: ["a", "c", "d"],
  eliminated: ["b"],
  holder: "c",
  risk: 16,
  shots: 2,
  last: shot,
  openAt: 7500,
  deadline: 25500,
  over: false,
  result: null,
};

describe("Rus Ruleti görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseRusRuletiView(pub, { role: "alive" });
    expect(v?.pub.holder).toBe("c");
    expect(v?.pub.last?.exploded).toBe(true);
    expect(v?.priv.role).toBe("alive");
  });

  it("son atış ve sonuç boş olabilir; bitişte deadline null", () => {
    const v = parseRusRuletiView(
      { ...pub, last: null, over: true, deadline: null, result: { survivors: ["a"], eliminated: ["b"] } },
      { role: "out" },
    );
    expect(v?.pub.last).toBeNull();
    expect(v?.pub.deadline).toBeNull();
    expect(v?.pub.result?.survivors).toEqual(["a"]);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseRusRuletiView(null, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView(pub, null)).toBeNull();
    expect(parseRusRuletiView(pub, { role: "boss" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, alive: [1] }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, risk: "16" }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, holder: 3 }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, deadline: "x" }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, last: { ...shot, exploded: "evet" } }, { role: "alive" })).toBeNull();
    expect(parseRusRuletiView({ ...pub, last: 5 }, { role: "alive" })).toBeNull();
    expect(
      parseRusRuletiView({ ...pub, result: { survivors: [1], eliminated: [] } }, { role: "alive" }),
    ).toBeNull();
    expect(parseRusRuletiView({ ...pub, over: 1 }, { role: "alive" })).toBeNull();
  });

  it("evre: açılışta sonuç, sonra karar, bitişte over", () => {
    expect(stageOf(pub, 7000)).toBe("result");
    expect(stageOf(pub, 7500)).toBe("deciding");
    expect(stageOf({ ...pub, last: null }, 0)).toBe("deciding");
    expect(stageOf({ ...pub, over: true }, 0)).toBe("over");
  });

  it("yardımcılar", () => {
    expect(riskFraction(16)).toBeCloseTo(0.16);
    expect(riskFraction(-4)).toBe(0);
    expect(riskFraction(140)).toBe(1);
    expect(crewColumns(2)).toBe(2);
    expect(crewColumns(3)).toBe(3);
    expect(crewColumns(4)).toBe(4);
    expect(crewColumns(8)).toBe(4);
  });
});
