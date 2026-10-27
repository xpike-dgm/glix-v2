import { describe, expect, it } from "vitest";
import { bondPattern, flowsOf, parseIttifakView, promiseRows, ringPosition, togglePromise } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  phase: "talk",
  startedAt: 100,
  talkEndsAt: 60_100,
  voteEndsAt: 75_100,
  finishAt: 83_100,
  ready: [],
  reveal: null,
};
const priv = { myVote: null, myPromises: [], locked: false };
const reveal = {
  votes: { a: "b", b: "a", c: "a" },
  scores: { a: 2, b: 1, c: 0 },
  promises: {
    a: [
      { to: "b", kept: true },
      { to: "c", kept: false },
    ],
    c: [{ to: "a", kept: true }],
  },
};

describe("İttifak görünümü", () => {
  it("pazarlık ve oylama görünümünü okur", () => {
    expect(parseIttifakView(pub, priv)?.phase).toBe("talk");
    expect(parseIttifakView({ ...pub, phase: "vote" }, { ...priv, myVote: "b" })?.myVote).toBe("b");
  });
  it("hazır olanları ve kendi kilidini okur", () => {
    const v = parseIttifakView({ ...pub, ready: ["a", "c"] }, { ...priv, myVote: "b", locked: true });
    expect(v?.ready).toEqual(["a", "c"]);
    expect(v?.locked).toBe(true);
  });
  it("açılmış görünümü okur", () => {
    const v = parseIttifakView({ ...pub, phase: "reveal", reveal }, priv);
    expect(v?.reveal?.scores.a).toBe(2);
    expect(v?.reveal?.votes.c).toBe("a");
  });
  it("söz işaretlerini okur; bozuğunu reddeder", () => {
    expect(parseIttifakView(pub, { ...priv, myPromises: ["b", "c"] })?.myPromises).toEqual(["b", "c"]);
    expect(parseIttifakView(pub, { myVote: null, locked: false })?.myPromises).toEqual([]);
    expect(parseIttifakView(pub, { ...priv, myPromises: [1] })).toBeNull();
    expect(parseIttifakView(pub, { ...priv, myPromises: "b" })).toBeNull();
    const v = parseIttifakView({ ...pub, phase: "reveal", reveal }, priv);
    expect(v?.reveal?.promises.a).toEqual([
      { to: "b", kept: true },
      { to: "c", kept: false },
    ]);
    expect(
      parseIttifakView({ ...pub, reveal: { ...reveal, promises: { a: [{ to: "b", kept: "evet" }] } } }, priv),
    ).toBeNull();
    expect(parseIttifakView({ ...pub, reveal: { ...reveal, promises: { a: "b" } } }, priv)).toBeNull();
    const { promises: _p, ...noPromises } = reveal;
    expect(parseIttifakView({ ...pub, reveal: noPromises }, priv)?.reveal?.promises).toEqual({});
  });
  it("sözler katılım sırasıyla, kendi sözlerin önde sıralanır; bilinmeyen alıcı atılır", () => {
    const rows = promiseRows(reveal, ["a", "b", "c"], "c");
    expect(rows.map((r) => `${r.from}>${r.to}${r.kept ? "+" : "-"}`)).toEqual(["c>a+", "a>b+", "a>c-"]);
    expect(promiseRows({ ...reveal, promises: { a: [{ to: "zzz", kept: true }] } }, ["a", "b"], "a")).toEqual(
      [],
    );
  });
  it("söz koy/kaldır: en çok 2, doluyken yenisi eklenmez", () => {
    expect(togglePromise([], "b", 2)).toEqual(["b"]);
    expect(togglePromise(["b"], "c", 2)).toEqual(["b", "c"]);
    expect(togglePromise(["b", "c"], "d", 2)).toBeNull();
    expect(togglePromise(["b", "c"], "b", 2)).toEqual(["c"]);
  });
  it("reveal alanı yoksa kapalı sayılır", () => {
    const { reveal: _drop, ...rest } = pub;
    expect(parseIttifakView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseIttifakView(null, priv)).toBeNull();
    expect(parseIttifakView(pub, null)).toBeNull();
    expect(parseIttifakView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, talkEndsAt: "x" }, priv)).toBeNull();
    expect(
      parseIttifakView({ ...pub, reveal: { votes: { a: 3 }, scores: {}, promises: {} } }, priv),
    ).toBeNull();
    expect(
      parseIttifakView({ ...pub, reveal: { votes: {}, scores: { a: "x" }, promises: {} } }, priv),
    ).toBeNull();
    expect(parseIttifakView(pub, { ...priv, myVote: 3 })).toBeNull();
    expect(parseIttifakView(pub, { myVote: null })).toBeNull();
    expect(parseIttifakView({ ...pub, ready: [1] }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, ready: undefined }, priv)).toBeNull();
  });
  it("oy akışı geçersiz ve kendine giden oyları atar", () => {
    const flows = flowsOf({ votes: { a: "b", b: "b", c: "zzz" }, scores: {}, promises: {} }, ["a", "b", "c"]);
    expect(flows).toEqual([{ from: "a", to: "b" }]);
  });
  it("bağlar yalnız geçerli, tekrarsız çiftlerdir", () => {
    for (let n = 3; n <= 8; n++) {
      const bonds = bondPattern(n);
      expect(bonds.length).toBeGreaterThan(0);
      const keys = new Set(bonds.map((b) => `${b.a}-${b.b}`));
      expect(keys.size).toBe(bonds.length);
      for (const b of bonds) {
        expect(b.a).not.toBe(b.b);
        expect(b.a).toBeGreaterThanOrEqual(0);
        expect(b.b).toBeLessThan(n);
      }
    }
  });
  it("halka yerleşimi ilk oyuncuyu üste koyar", () => {
    const p = ringPosition(0, 4);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(50);
  });
});
