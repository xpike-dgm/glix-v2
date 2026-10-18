import { describe, expect, it } from "vitest";
import { formatSeconds, parseSonKisiView, pulseMs, resultHeadline } from "./view.js";

const pub = { startedAt: 100, escaped: ["a"], tension: 2, finished: false, result: null };
const result = {
  escapes: [
    { id: "a", ms: 3_000 },
    { id: "b", ms: 12_400 },
  ],
  last: ["b"],
  missed: ["c"],
  scores: { a: 0, b: 1, c: -1 },
};

describe("Son Kişi görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseSonKisiView(pub, { escaped: false });
    expect(v?.pub.tension).toBe(2);
    expect(v?.pub.escaped).toEqual(["a"]);
    expect(v?.priv.escaped).toBe(false);
  });
  it("sonucu okur", () => {
    const v = parseSonKisiView({ ...pub, finished: true, tension: 3, result }, { escaped: true });
    expect(v?.pub.result?.last).toEqual(["b"]);
    expect(v?.pub.result?.escapes[1]?.ms).toBe(12_400);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseSonKisiView(null, { escaped: true })).toBeNull();
    expect(parseSonKisiView(pub, null)).toBeNull();
    expect(parseSonKisiView(pub, { escaped: "x" })).toBeNull();
    expect(parseSonKisiView({ ...pub, tension: 4 }, { escaped: true })).toBeNull();
    expect(parseSonKisiView({ ...pub, tension: "1" }, { escaped: true })).toBeNull();
    expect(parseSonKisiView({ ...pub, escaped: [1] }, { escaped: true })).toBeNull();
    expect(parseSonKisiView({ ...pub, finished: 1 }, { escaped: true })).toBeNull();
    expect(parseSonKisiView({ ...pub, result: { ...result, last: [2] } }, { escaped: true })).toBeNull();
    expect(
      parseSonKisiView({ ...pub, result: { ...result, escapes: [{ id: "a" }] } }, { escaped: true }),
    ).toBeNull();
    expect(
      parseSonKisiView({ ...pub, result: { ...result, scores: { a: "x" } } }, { escaped: true }),
    ).toBeNull();
  });
  it("süre ve başlık biçimleri", () => {
    expect(formatSeconds(12_480)).toBe("12,4 sn");
    expect(formatSeconds(-5)).toBe("0,0 sn");
    expect(resultHeadline(result)).toBe("Son kaçan");
    expect(resultHeadline({ ...result, last: ["a", "b"] })).toBe("Son kaçanlar");
    expect(resultHeadline({ escapes: [], last: [], missed: ["a"], scores: { a: -1 } })).toBe("Kimse kaçmadı");
  });
  it("nabız süresi gerilimle kısalır", () => {
    expect(pulseMs(0)).toBeGreaterThan(pulseMs(1));
    expect(pulseMs(1)).toBeGreaterThan(pulseMs(2));
    expect(pulseMs(2)).toBeGreaterThan(pulseMs(3));
  });
});
