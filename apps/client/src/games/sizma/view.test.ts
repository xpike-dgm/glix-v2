import { describe, expect, it } from "vitest";
import { outcomeOf, parseSizmaView, tallyPlan, wordSize } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  phase: "clue",
  order: ["b", "c", "a"],
  startedAt: 100,
  clueEndsAt: 300_100,
  voteEndsAt: 330_100,
  finishAt: 338_100,
  ready: [],
  reveal: null,
};
const priv = { word: "ÇAY", myVote: null, myNotice: null, locked: false };
const reveal = {
  infiltrator: "c",
  commonWord: "ÇAY",
  infiltratorWord: "KAHVE",
  votes: { a: "c", b: "c" },
  tally: { a: 0, b: 0, c: 2 },
  caught: true,
  selfNoticed: false,
  scores: { a: 1, b: 1, c: 0 },
};

describe("Sızma görünümü", () => {
  it("ipucu ve oylama görünümünü okur", () => {
    const v = parseSizmaView(pub, priv);
    expect(v?.phase).toBe("clue");
    expect(v?.order).toEqual(["b", "c", "a"]);
    expect(v?.word).toBe("ÇAY");
    expect(parseSizmaView({ ...pub, phase: "vote" }, { ...priv, myVote: "c" })?.myVote).toBe("c");
  });
  it("izleyici görünümü (kelime yok) geçerlidir", () => {
    expect(parseSizmaView(pub, { word: null, myVote: null, locked: false })?.word).toBeNull();
  });
  it("hazır olanları ve kendi kilidini okur", () => {
    const v = parseSizmaView({ ...pub, ready: ["a", "c"] }, { ...priv, locked: true });
    expect(v?.ready).toEqual(["a", "c"]);
    expect(v?.locked).toBe(true);
  });
  it("açılmış görünümü okur", () => {
    const v = parseSizmaView({ ...pub, phase: "reveal", reveal }, priv);
    expect(v?.reveal?.infiltrator).toBe("c");
    expect(v?.reveal?.caught).toBe(true);
    expect(v?.reveal?.tally.c).toBe(2);
  });
  it("fark ettin mi aşamasını ve cevabı okur, bozuğunu reddeder", () => {
    const v = parseSizmaView(
      { ...pub, phase: "notice", noticeEndsAt: 338_100, ready: ["a"] },
      { ...priv, myNotice: true },
    );
    expect(v?.phase).toBe("notice");
    expect(v?.noticeEndsAt).toBe(338_100);
    expect(v?.myNotice).toBe(true);
    expect(parseSizmaView(pub, { word: "A", myVote: null, locked: false })?.myNotice).toBeNull();
    expect(parseSizmaView(pub, { ...priv, myNotice: "evet" })).toBeNull();
    expect(parseSizmaView({ ...pub, noticeEndsAt: "x" }, priv)).toBeNull();
    const r = parseSizmaView({ ...pub, phase: "reveal", reveal: { ...reveal, selfNoticed: true } }, priv);
    expect(r?.reveal?.selfNoticed).toBe(true);
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, selfNoticed: 1 } }, priv)).toBeNull();
  });
  it("reveal alanı yoksa kapalı sayılır", () => {
    const { reveal: _drop, ...rest } = pub;
    expect(parseSizmaView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseSizmaView(null, priv)).toBeNull();
    expect(parseSizmaView(pub, null)).toBeNull();
    expect(parseSizmaView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, order: "abc" }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, clueEndsAt: "x" }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, ready: undefined }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, caught: "yes" } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, votes: { a: 3 } } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, tally: { a: "x" } } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { infiltrator: 3 } }, priv)).toBeNull();
    expect(parseSizmaView(pub, { word: 3, myVote: null, locked: false })).toBeNull();
    expect(parseSizmaView(pub, { word: "A", myVote: 3, locked: false })).toBeNull();
    expect(parseSizmaView(pub, { word: "A", myVote: null })).toBeNull();
  });
  it("sonuç benim açımdan: puan aldıysam kazandım", () => {
    expect(outcomeOf(reveal, "a")).toBe("win");
    expect(outcomeOf(reveal, "c")).toBe("lose");
    expect(outcomeOf(reveal, "zzz")).toBe("lose");
  });
  it("kelime boyu uzadıkça küçülür", () => {
    expect(wordSize("ÇAY")).toBeGreaterThan(wordSize("TELEVİZYON"));
    expect(wordSize("GÖKKUŞAĞI")).toBeGreaterThanOrEqual(24);
  });
  it("sıralı açılış: oylar azdan çoğa gruplanır, son adım maskenin düştüğü an", () => {
    const plan = tallyPlan(["a", "b", "c", "d"], { a: 0, b: 3, c: 1, d: 0 });
    expect(plan.step).toEqual({ a: 0, d: 0, c: 1, b: 2 });
    expect(plan.finale).toBe(3);
    expect(plan.notice).toBe(4);
    expect(plan.steps).toBe(5);
  });
  it("sıralı açılış: oy yoksa tek adım + son adım", () => {
    const plan = tallyPlan(["a", "b"], {});
    expect(plan.step).toEqual({ a: 0, b: 0 });
    expect(plan.steps).toBe(3);
  });
});
