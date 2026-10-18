import { describe, expect, it } from "vitest";
import { parseGizliHirsizView, revealHeadline } from "./view.js";

const pub = { startedAt: 100, endsAt: 30_100, finished: false, reveal: null };
const reveal = { thieves: ["a", "b"], outcome: "multi", scores: { a: -1, b: -1, c: 0 } };

describe("Gizli Hırsız görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseGizliHirsizView(pub, { pressed: true });
    expect(v).toEqual({ ...pub, pressed: true });
  });
  it("sonuç açılışını okur", () => {
    const v = parseGizliHirsizView({ ...pub, finished: true, reveal }, { pressed: false });
    expect(v?.reveal?.thieves).toEqual(["a", "b"]);
    expect(v?.reveal?.outcome).toBe("multi");
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseGizliHirsizView(null, { pressed: true })).toBeNull();
    expect(parseGizliHirsizView(pub, null)).toBeNull();
    expect(parseGizliHirsizView(pub, { pressed: 1 })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, endsAt: "x" }, { pressed: false })).toBeNull();
    expect(parseGizliHirsizView({ ...pub, finished: 0 }, { pressed: false })).toBeNull();
    expect(
      parseGizliHirsizView({ ...pub, reveal: { ...reveal, outcome: "x" } }, { pressed: false }),
    ).toBeNull();
    expect(
      parseGizliHirsizView({ ...pub, reveal: { ...reveal, thieves: [1] } }, { pressed: false }),
    ).toBeNull();
    expect(
      parseGizliHirsizView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, { pressed: false }),
    ).toBeNull();
  });
  it("sonuç başlıkları", () => {
    expect(revealHeadline({ thieves: ["a"], outcome: "solo", scores: {} })).toBe("Kasa soyuldu!");
    expect(revealHeadline({ thieves: [], outcome: "none", scores: {} })).toBe("Kimse çalmadı");
    expect(revealHeadline({ thieves: ["a", "b"], outcome: "multi", scores: {} })).toContain("Alarm");
  });
});
