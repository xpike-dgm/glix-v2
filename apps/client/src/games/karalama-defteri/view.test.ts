import { describe, expect, it } from "vitest";
import { parseKaralamaPrivateView, parseKaralamaPublicView, parseKaralamaView, parseStroke } from "./view.js";

const pub = {
  phase: "vote",
  drawEndsAt: 100,
  voteEndsAt: 200,
  players: ["a", "b"],
  drawings: { a: [[0, 2, 0, 0, 10, 10]], b: [] },
  voted: ["a"],
  drawDoneIds: ["b"],
  lockedIds: ["a"],
  reveal: null,
};
const priv = {
  word: "elma",
  near: false,
  strokes: {},
  pointsLeft: 6000,
  myVote: null,
  drawDone: false,
  locked: false,
};

describe("Karalama Defteri görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseKaralamaView(pub, priv);
    expect(v?.phase).toBe("vote");
    expect(v?.drawings?.a?.strokes).toEqual([[0, 2, 0, 0, 10, 10]]);
    expect(v?.drawings?.b?.strokes).toEqual([]);
    expect(v?.word).toBe("elma");
  });

  it("kilit alanlarını okur ve bozuksa reddeder", () => {
    const v = parseKaralamaView(pub, { ...priv, drawDone: true, locked: true });
    expect(v).toMatchObject({ drawDoneIds: ["b"], lockedIds: ["a"], drawDone: true, locked: true });
    expect(parseKaralamaPublicView({ ...pub, lockedIds: [1] })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, drawDoneIds: undefined })).toBeNull();
    expect(parseKaralamaPrivateView({ ...priv, locked: "x" })).toBeNull();
    expect(parseKaralamaPrivateView({ ...priv, drawDone: undefined })).toBeNull();
  });

  it("çizim süresince drawings null, kendi darbeler numaraya göre sıralanır", () => {
    const v = parseKaralamaView(
      { ...pub, phase: "draw", drawings: null },
      { ...priv, strokes: { "10": [1, 1, 0, 0, 5, 5], "2": [0, 2, 1, 1, 2, 2], x: [0, 1, 0, 0, 1, 1] } },
    );
    expect(v?.drawings).toBeNull();
    expect(v?.strokes.map((s) => s[0])).toEqual([0, 1]);
  });

  it("izleyici görünümü (kelime yok) geçerli", () => {
    expect(parseKaralamaPrivateView({ ...priv, word: null })?.word).toBeNull();
  });

  it("sonuç açılışını okur", () => {
    const reveal = {
      outsider: "b",
      mainWord: "elma",
      nearWord: "armut",
      votes: { a: "b" },
      tally: { a: 0, b: 1 },
      caught: true,
    };
    expect(parseKaralamaPublicView({ ...pub, phase: "done", reveal })?.reveal).toEqual(reveal);
    expect(parseKaralamaPublicView({ ...pub, reveal: { ...reveal, caught: "evet" } })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, reveal: { ...reveal, votes: { a: 1 } } })).toBeNull();
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseKaralamaView(null, priv)).toBeNull();
    expect(parseKaralamaView(pub, null)).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, phase: "bitti" })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, drawEndsAt: "x" })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, players: [1] })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, drawings: [] })).toBeNull();
    expect(parseKaralamaPublicView({ ...pub, drawings: { a: "x" } })).toBeNull();
    expect(parseKaralamaPrivateView({ ...priv, near: 1 })).toBeNull();
    expect(parseKaralamaPrivateView({ ...priv, strokes: [] })).toBeNull();
    expect(parseKaralamaPrivateView({ ...priv, myVote: 3 })).toBeNull();
  });

  it("bozuk darbeleri atar, koordinatları ızgaraya sıkıştırır", () => {
    expect(parseStroke([0, 2, 0, 0])).toBeNull();
    expect(parseStroke([0, 2, 0, 0, 1])).toBeNull();
    // Ortak kalem dizini: 0..10 (6 silgi), kalınlık 1..4; dışı atılır.
    expect(parseStroke([11, 2, 0, 0, 1, 1])).toBeNull();
    expect(parseStroke([-1, 2, 0, 0, 1, 1])).toBeNull();
    expect(parseStroke([0, 5, 0, 0, 1, 1])).toBeNull();
    expect(parseStroke([10, 4, 0, 0, 1, 1])).toEqual([10, 4, 0, 0, 1, 1]);
    expect(parseStroke([0, 2, 0, 0, "1", 1])).toBeNull();
    expect(parseStroke([6, 3, -50, 2000, 1.4, 1])).toEqual([6, 3, 0, 1000, 1, 1]);
    const v = parseKaralamaPublicView({ ...pub, drawings: { a: [[0, 2, 0, 0, 10, 10], "x", [9]] } });
    expect(v?.drawings?.a?.strokes).toHaveLength(1);
  });

  it("çizim anahtarı çizim değişince değişir", () => {
    const a = parseKaralamaPublicView(pub)?.drawings?.a?.key;
    const more = parseKaralamaPublicView({
      ...pub,
      drawings: {
        a: [
          [0, 2, 0, 0, 10, 10],
          [1, 1, 5, 5, 9, 9],
        ],
        b: [],
      },
    })?.drawings?.a?.key;
    expect(a).toBeDefined();
    expect(more).not.toBe(a);
  });
});
