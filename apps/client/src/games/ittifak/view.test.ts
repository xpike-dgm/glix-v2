import { describe, expect, it } from "vitest";
import {
  allyBadgeSpot,
  arrowPath,
  awardText,
  CARD_LEAD_MS,
  CARD_MS,
  CARD_NAME_MS,
  cardAt,
  cardVerdict,
  finalAt,
  flowsOf,
  genitive,
  labelsOf,
  parseIttifakView,
  promiseRows,
  readingOrder,
  ringPosition,
  storyOf,
  summaryLine,
  togglePromise,
  voteOpensAt,
} from "./view.js";

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
  awards: { a: 2, b: 1, c: 0 },
  random: [] as string[],
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
    const flows = flowsOf(
      { votes: { a: "b", b: "b", c: "zzz" }, scores: {}, awards: {}, random: [], promises: {} },
      ["a", "b", "c"],
    );
    expect(flows).toEqual([{ from: "a", to: "b" }]);
  });
  it("ödül ve zar listesini okur; eski görünümde ödül oy sayısından hesaplanır (IT-M1, IT-M3)", () => {
    const v = parseIttifakView({ ...pub, phase: "reveal", reveal: { ...reveal, random: ["c"] } }, priv);
    expect(v?.reveal?.awards).toEqual({ a: 2, b: 1, c: 0 });
    expect(v?.reveal?.random).toEqual(["c"]);
    const { awards: _a, random: _r, ...old } = reveal;
    const w = parseIttifakView({ ...pub, phase: "reveal", reveal: old }, priv);
    expect(w?.reveal?.awards).toEqual({ a: 2, b: 1, c: 0 });
    expect(w?.reveal?.random).toEqual([]);
    expect(parseIttifakView({ ...pub, reveal: { ...reveal, random: [1] } }, priv)).toBeNull();
    expect(parseIttifakView({ ...pub, reveal: { ...reveal, awards: { a: "x" } } }, priv)).toBeNull();
  });
  it("oylama geçiş bandından sonra açılır (IT-U8)", () => {
    expect(voteOpensAt({ talkEndsAt: 1000 })).toBe(2000);
  });
  it("oy okuma sırası: en az oy alana gidenler önce, liderler en son ve karışık (IT-U5)", () => {
    const r = {
      votes: { a: "b", b: "a", c: "a", d: "b", e: "c" },
      scores: { a: 2, b: 2, c: 1, d: 0, e: 0 },
      awards: { a: 2, b: 2, c: 1, d: 0, e: 0 },
      random: [],
      promises: {},
    };
    const order = readingOrder(r, ["a", "b", "c", "d", "e"]);
    expect(order.map((f) => `${f.from}>${f.to}`)).toEqual(["e>c", "b>a", "a>b", "c>a", "d>b"]);
  });
  it("kart zamanlaması: önce '…', 0,4 sn sonra hedef; sonra son tablo", () => {
    expect(cardAt(0, 3)).toEqual({ index: -1, named: false });
    expect(cardAt(CARD_LEAD_MS, 3)).toEqual({ index: 0, named: false });
    expect(cardAt(CARD_LEAD_MS + CARD_NAME_MS, 3)).toEqual({ index: 0, named: true });
    expect(cardAt(CARD_LEAD_MS + CARD_MS, 3)).toEqual({ index: 1, named: false });
    expect(cardAt(finalAt(3), 3)).toEqual({ index: 3, named: false });
    // 8 kişide kartlar en az gösterim süresinin (3 + 0,9 × 8 sn) içinde biter, son tabloya ≥ 2,5 sn kalır.
    expect(finalAt(8)).toBeLessThanOrEqual(3_000 + 900 * 8 - 2_500);
  });
  it("kart söz denetimi: tuttu (ötekine de söz vermişti), ihanet, zar, sözsüz", () => {
    const r = {
      votes: { a: "b", b: "c", c: "a", d: "a" },
      scores: {},
      awards: {},
      random: ["d"],
      promises: {
        a: [
          { to: "b", kept: true },
          { to: "c", kept: false },
        ],
        b: [{ to: "a", kept: false }],
        d: [{ to: "b", kept: false }],
      },
    };
    expect(cardVerdict(r, "a")).toEqual({ kind: "kept", others: ["c"] });
    expect(cardVerdict(r, "b")).toEqual({ kind: "betray", others: ["a"] });
    expect(cardVerdict(r, "c")).toEqual({ kind: "plain", others: [] });
    expect(cardVerdict(r, "d")).toEqual({ kind: "dice", others: [] });
    expect(labelsOf(r, ["a", "b", "c", "d"])).toEqual({ a: "cifte", b: "hain", d: "zar" });
    expect(summaryLine(1, labelsOf(r, ["a", "b", "c", "d"]))).toBe("1 ittifak · 1 hain · 1 çifte oyun");
    expect(summaryLine(0, {})).toBe("");
  });
  it("kendi hikâyen: oy verenler, söz verenler (✓/✗), kendi oyun ve ödül (IT-U7)", () => {
    const s = storyOf(reveal, ["a", "b", "c"], "a");
    expect(s.voters).toEqual(["b", "c"]);
    expect(s.promisers).toEqual([{ from: "c", kept: true }]);
    expect(s.myVote).toBe("b");
    expect(s.myPromise).toBe("kept");
    expect(s.award).toBe(2);
    expect(storyOf(reveal, ["a", "b", "c"], "b").promisers).toEqual([{ from: "a", kept: true }]);
    expect(storyOf(reveal, ["a", "b", "c"], "c").myPromise).toBe("kept");
  });
  it("ödül metni", () => {
    expect(awardText(reveal, "a")).toBe("+2 · en çok oy");
    expect(awardText(reveal, "b")).toBe("+1 · ikinci");
    expect(awardText(reveal, "c")).toBe("+0");
    expect(awardText({ ...reveal, awards: { a: 1, b: 1, c: 1 } }, "c")).toBe("+1 · herkes eşit");
  });
  it("karşılıklı oklar yana kayar, tek yönlü ok merkez çizgide kalır", () => {
    const a = { x: 10, y: 50 };
    const b = { x: 90, y: 50 };
    expect(arrowPath(a, b, 5, 0).y1).toBe(50);
    expect(arrowPath(a, b, 5, 1.6).y1).toBe(51.6);
    expect(arrowPath(b, a, 5, 1.6).y1).toBe(48.4);
  });
  it("Türkçe tamlayan eki", () => {
    expect(genitive("Mert")).toBe("Mert'in");
    expect(genitive("Kaan")).toBe("Kaan'ın");
    expect(genitive("Defne")).toBe("Defne'nin");
    expect(genitive("Ayşe")).toBe("Ayşe'nin");
    expect(genitive("Burak")).toBe("Burak'ın");
    expect(genitive("Ufuk")).toBe("Ufuk'un");
    expect(genitive("Gül")).toBe("Gül'ün");
    expect(genitive("Elif")).toBe("Elif'in");
  });
  it("halka yerleşimi ilk oyuncuyu üste koyar", () => {
    const p = ringPosition(0, 4);
    expect(Math.round(p.x)).toBe(50);
    expect(p.y).toBeLessThan(50);
  });
});

describe("allyBadgeSpot", () => {
  it("orta noktayı masanın merkezine doğru kaydırır, merkezi aşmaz", () => {
    const s = allyBadgeSpot({ x: 90, y: 40 }, { x: 90, y: 60 });
    expect(s.y).toBeCloseTo(50);
    expect(s.x).toBeCloseTo(66);
    expect(allyBadgeSpot({ x: 45, y: 50 }, { x: 55, y: 50 })).toEqual({ x: 50, y: 50 });
  });
});
