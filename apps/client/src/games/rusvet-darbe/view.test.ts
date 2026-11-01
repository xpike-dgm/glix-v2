import type { RusvetReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  addToken,
  coupRuleLine,
  handOutcome,
  handStrip,
  joinNames,
  loyaltyOf,
  ofName,
  parseRusvetView,
  randomSummary,
  removeToken,
  replayReason,
  revealScene,
  seatRows,
  storyLine,
  tokenMap,
  tokensToAllocations,
  tokenTotal,
  toName,
} from "./view.js";

const base = {
  players: ["a", "b", "c"],
  phase: "vote",
  startedAt: 1,
  phaseStartedAt: 1,
  phaseEndsAt: 20_001,
  president: null,
  budget: null,
  ready: [],
  duel: null,
  coup: null,
  reveal: null,
};
const priv = { myVote: null, mySign: null, myTokens: null, myCoup: null, canCoup: false, locked: false };
const hand = { candidates: ["a", "b"], signs: { a: "tas", b: "makas" }, advance: ["a"], replay: false };
const duel = {
  hand: 2,
  candidates: ["a", "b"],
  signStartedAt: 1,
  signEndsAt: 8_001,
  revealEndsAt: 10_501,
  signs: null,
  history: [hand],
};
const reveal = {
  votes: { a: "b", b: "a", c: "a" },
  counts: { a: 2, b: 1, c: 0 },
  tokens: { a: 0, b: 2, c: 0 },
  scores: { a: 1, b: 2, c: 0 },
  duelHands: [hand],
  coup: null,
};

describe("Rüşvet ve Darbe görünümü", () => {
  it("seçim, düello, dağıtım ve sonuç görünümlerini okur", () => {
    expect(parseRusvetView(base, { ...priv, myVote: "b" })?.myVote).toBe("b");
    const d = parseRusvetView({ ...base, phase: "duel", duel }, { ...priv, mySign: "tas" });
    expect(d?.duel?.history[0]?.advance).toEqual(["a"]);
    expect(d?.mySign).toBe("tas");
    const g = parseRusvetView(
      { ...base, phase: "give", president: "a", budget: 3 },
      { ...priv, myTokens: [{ to: "b", n: 2 }] },
    );
    expect(g?.budget).toBe(3);
    expect(g?.myTokens).toEqual([{ to: "b", n: 2 }]);
    const r = parseRusvetView({ ...base, phase: "reveal", president: "a", budget: 2, reveal }, priv);
    expect(r?.reveal?.scores.b).toBe(2);
  });
  it("darbe aşamasını ve sonucunu okur, bozuğunu reddeder", () => {
    const c = parseRusvetView(
      {
        ...base,
        phase: "coup",
        president: "a",
        budget: 2,
        coup: { tokens: { a: 0, b: 2, c: 0 }, eligible: ["c"] },
        ready: ["c"],
      },
      { ...priv, canCoup: true, myCoup: true },
    );
    expect(c?.coup?.eligible).toEqual(["c"]);
    expect(c?.coup?.tokens.b).toBe(2);
    expect(c?.canCoup).toBe(true);
    expect(c?.myCoup).toBe(true);
    const r = parseRusvetView(
      {
        ...base,
        phase: "reveal",
        president: "a",
        budget: 2,
        reveal: { ...reveal, coup: { eligible: ["c"], yes: 1, success: true } },
      },
      priv,
    );
    expect(r?.reveal?.coup).toEqual({ eligible: ["c"], yes: 1, success: true });
    expect(
      parseRusvetView({ ...base, phase: "coup", coup: { tokens: { a: "x" }, eligible: [] } }, priv),
    ).toBeNull();
    expect(parseRusvetView({ ...base, coup: { tokens: {}, eligible: [1] } }, priv)).toBeNull();
    expect(
      parseRusvetView(
        { ...base, reveal: { ...reveal, coup: { eligible: [], yes: "1", success: true } } },
        priv,
      ),
    ).toBeNull();
    expect(parseRusvetView(base, { ...priv, myCoup: "evet" })).toBeNull();
    expect(parseRusvetView(base, { ...priv, canCoup: 1 })).toBeNull();
  });
  it("hazır olanları ve kilidi okur, bozuğunu reddeder", () => {
    const v = parseRusvetView({ ...base, ready: ["a", "c"] }, { ...priv, locked: true });
    expect(v?.ready).toEqual(["a", "c"]);
    expect(v?.locked).toBe(true);
    expect(parseRusvetView({ ...base, ready: [1] }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, ready: undefined }, priv)).toBeNull();
    expect(parseRusvetView(base, { myVote: null, mySign: null, myTokens: null })).toBeNull();
    expect(parseRusvetView(base, { ...priv, locked: "x" })).toBeNull();
  });
  it("eksik alanları boş sayar", () => {
    const { president: _p, budget: _b, duel: _d, reveal: _r, ...rest } = base;
    const v = parseRusvetView(rest, { myVote: null, locked: false });
    expect(v?.president).toBeNull();
    expect(v?.mySign).toBeNull();
    expect(v?.myTokens).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseRusvetView(null, priv)).toBeNull();
    expect(parseRusvetView(base, null)).toBeNull();
    expect(parseRusvetView({ ...base, phase: "x" }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, players: [1] }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, budget: "3" }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, duel: { ...duel, signs: { a: "rock" } } }, priv)).toBeNull();
    expect(
      parseRusvetView({ ...base, duel: { ...duel, history: [{ ...hand, replay: 1 }] } }, priv),
    ).toBeNull();
    expect(parseRusvetView({ ...base, reveal: { ...reveal, tokens: { a: "x" } } }, priv)).toBeNull();
    expect(parseRusvetView(base, { ...priv, mySign: "rock" })).toBeNull();
    expect(parseRusvetView(base, { ...priv, myTokens: [{ to: "b" }] })).toBeNull();
    expect(parseRusvetView(base, { ...priv, myVote: 3 })).toBeNull();
  });
  it("jeton yardımcıları", () => {
    expect(
      tokenMap([
        { to: "b", n: 2 },
        { to: "c", n: 1 },
      ]),
    ).toEqual({ b: 2, c: 1 });
    expect(tokenMap(null)).toEqual({});
    expect(tokenTotal({ b: 2, c: 1 })).toBe(3);
    expect(tokensToAllocations({ b: 2, c: 0, d: 1 }, ["a", "b", "c", "d"])).toEqual([
      { to: "b", n: 2 },
      { to: "d", n: 1 },
    ]);
  });
  it("RD-U3: dokunma +1, sınırda ya da bütçe bitince aynı kalır (2 → 0 döngüsü yok); '−' bir geri alır", () => {
    expect(addToken(0, 3)).toBe(1);
    expect(addToken(1, 2)).toBe(2);
    expect(addToken(2, 1)).toBe(2);
    expect(addToken(1, 0)).toBe(1);
    expect(addToken(0, 0)).toBe(0);
    expect(addToken(0, 3, false)).toBe(0);
    expect(removeToken(2)).toBe(1);
    expect(removeToken(0)).toBe(0);
  });
  it("el sonucu motorun kuralıyla bulunur", () => {
    expect(handOutcome(["a", "b"], { a: "tas", b: "makas" })?.advance).toEqual(["a"]);
    expect(handOutcome(["a", "b"], { a: "tas" })).toBeNull();
    expect(handOutcome(["a", "b", "c"], { a: "tas", b: "kagit", c: "makas" })?.replay).toBe(true);
  });

  it("yeni alanları okur (vaat, taç anı, ikinci oylama, kura, defter, rastgele işaretler)", () => {
    const v = parseRusvetView(
      {
        ...base,
        phase: "runoff",
        pledges: { a: "voters", b: "all" },
        runoff: { candidates: ["a", "b", "c", "d"] },
      },
      { ...priv, myVote: "b" },
    );
    expect(v?.pledges).toEqual({ a: "voters", b: "all" });
    expect(v?.runoff?.candidates).toHaveLength(4);
    const g = parseRusvetView(
      { ...base, phase: "give", president: "a", budget: 2, crown: { startedAt: 1, endsAt: 1_501 } },
      { ...priv, ledger: { voters: ["b"], random: ["c"] }, myVoteRandom: true },
    );
    expect(g?.crown?.endsAt).toBe(1_501);
    expect(g?.ledger).toEqual({ voters: ["b"], random: ["c"] });
    expect(g?.myVoteRandom).toBe(true);
    const d = parseRusvetView({ ...base, phase: "duel", duel: { ...duel, lottery: "b" } }, priv);
    expect(d?.duel?.lottery).toBe("b");
    const r = parseRusvetView(
      {
        ...base,
        phase: "reveal",
        reveal: {
          ...reveal,
          randomVoters: ["c"],
          randomTokens: { b: 1 },
          runoffVotes: { a: "b" },
          offlineRefill: true,
          pledge: { pledge: "all", kept: false, timedOut: true },
        },
      },
      priv,
    );
    expect(r?.reveal?.randomVoters).toEqual(["c"]);
    expect(r?.reveal?.randomTokens).toEqual({ b: 1 });
    expect(r?.reveal?.runoffVotes).toEqual({ a: "b" });
    expect(r?.reveal?.pledge).toEqual({ pledge: "all", kept: false, timedOut: true });
    // Eski biçim (yeni alanlar yok) boş sayılır.
    const old = parseRusvetView({ ...base, phase: "reveal", reveal }, priv);
    expect(old?.reveal?.randomVoters).toEqual([]);
    expect(old?.pledges).toEqual({});
    // Bozuklar reddedilir.
    expect(parseRusvetView({ ...base, pledges: { a: "hepsi" } }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, crown: { startedAt: "x", endsAt: 1 } }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, runoff: { candidates: [1] } }, priv)).toBeNull();
    expect(parseRusvetView({ ...base, duel: { ...duel, lottery: 3 } }, priv)).toBeNull();
    expect(parseRusvetView(base, { ...priv, ledger: { voters: [1], random: [] } })).toBeNull();
    expect(
      parseRusvetView(
        { ...base, reveal: { ...reveal, pledge: { pledge: "all", kept: "x", timedOut: false } } },
        priv,
      ),
    ).toBeNull();
  });

  const nameOf = (id: string) => ({ a: "Elif", b: "Mert", c: "Zeynep", d: "Kaan" })[id] ?? "?";
  const full: RusvetReveal = {
    votes: { a: "b", b: "a", c: "a", d: "a" },
    counts: { a: 3, b: 1, c: 0, d: 0 },
    randomVoters: ["d"],
    runoffVotes: null,
    tokens: { a: 0, b: 2, c: 0, d: 1 },
    randomTokens: { d: 1 },
    offlineRefill: false,
    scores: { a: 2, b: 2, c: 0, d: 1 },
    duelHands: [],
    coup: { eligible: ["c"], yes: 0, success: false },
    pledge: null,
  };

  it("RD-U10: kendi hikâyen ve sadakat etiketleri", () => {
    expect(storyLine(full, "a", "b", nameOf)).toBe("Elif'e oy verdin, sana 2 jeton verdi");
    expect(storyLine(full, "a", "c", nameOf)).toBe("Elif'e oy verdin, eli boş döndün");
    expect(storyLine(full, "a", "d", nameOf)).toBe("Oyun rastgele Elif'e gitti · Elif yine de 1 jeton verdi");
    expect(storyLine(full, "a", "a", nameOf)).toBe("3 oyla başkan · darbe 0/1 · +2");
    const hit = {
      ...full,
      coup: { eligible: ["c"], yes: 1, success: true },
      scores: { ...full.scores, a: 0 },
    };
    expect(storyLine(hit, "a", "a", nameOf)).toBe("Tahtın devrildi · +0");
    const other = { ...full, votes: { ...full.votes, c: "d" } };
    expect(storyLine(other, "a", "c", nameOf)).toBe("Kaan'a oy verdin · jeton gelmedi");
    // Zarla düşen oy sayılmaz: d etiket almaz.
    expect(loyaltyOf(full, "a")).toEqual({ b: "paid", c: "ingrate" });
  });

  it("RD-U2: el şeridi ve sonuçsuz elin nedeni", () => {
    const three = {
      candidates: ["a", "b", "c"],
      signs: { a: "tas", b: "kagit", c: "makas" } as const,
      advance: ["a", "b", "c"],
      replay: true,
    };
    const same = {
      candidates: ["a", "b"],
      signs: { a: "tas", b: "tas" } as const,
      advance: ["a", "b"],
      replay: true,
    };
    const won = {
      candidates: ["a", "b", "c"],
      signs: { a: "tas", b: "tas", c: "makas" } as const,
      advance: ["a", "b"],
      replay: false,
    };
    expect(replayReason(three)).toBe("Üç işaret de çıktı");
    expect(replayReason(same)).toBe("Herkes TAŞ dedi");
    expect(handStrip([three, won], nameOf)).toEqual([
      "1. el · sonuç yok (üç işaret)",
      "2. el · Elif ve Mert devam",
    ]);
    expect(joinNames(["Elif", "Mert", "Kaan"])).toBe("Elif, Mert ve Kaan");
    expect(["Elif", "Kaan", "Ayşe", "Burak", "Onur", "Ümüt"].map(toName)).toEqual([
      "Elif'e",
      "Kaan'a",
      "Ayşe'ye",
      "Burak'a",
      "Onur'a",
      "Ümüt'e",
    ]);
    expect(["Elif", "Kaan", "Ayşe", "Burak", "Onur", "Ümüt"].map(ofName)).toEqual([
      "Elif'in",
      "Kaan'ın",
      "Ayşe'nin",
      "Burak'ın",
      "Onur'un",
      "Ümüt'ün",
    ]);
  });

  it("RD-U1: son satır ortalanır (5 → 3+2, 8 → 3+3+2, 4 → 2+2, 7 → 3+2+2)", () => {
    expect(seatRows(3)).toEqual([2, 1]);
    expect(seatRows(4)).toEqual([2, 2]);
    expect(seatRows(5)).toEqual([3, 2]);
    expect(seatRows(6)).toEqual([3, 3]);
    expect(seatRows(7)).toEqual([3, 2, 2]);
    expect(seatRows(8)).toEqual([3, 3, 2]);
  });

  it("RD-U9: açılış sahneleri sırayla; RD-U6 kural satırı; RD-M5 rastgele özeti", () => {
    expect(revealScene(0)).toBe("votes");
    expect(revealScene(2_600)).toBe("throne");
    expect(revealScene(4_000)).toBe("coins");
    expect(revealScene(6_100)).toBe("coup");
    expect(revealScene(8_600)).toBe("pledge");
    expect(revealScene(10_000)).toBe("scores");
    expect(coupRuleLine("Elif")).toBe("Çoğunluk Darbe derse Elif'in +2'si gider");
    expect(randomSummary(full, nameOf)).toBe("Zarla oy: Kaan · Süre doldu, rastgele: Kaan 1 jeton");
    expect(randomSummary({ ...full, offlineRefill: true, randomVoters: [] }, nameOf)).toBe(
      "Başkan kopuktu, seçmenlerine: Kaan 1 jeton",
    );
    expect(randomSummary({ ...full, randomVoters: [], randomTokens: {} }, nameOf)).toBe("");
  });
});
