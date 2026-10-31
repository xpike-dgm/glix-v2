import { describe, expect, it } from "vitest";
import { flightAt, OPENING } from "./timeline.js";
import {
  flightPlan,
  outcomeOf,
  parseSizmaView,
  questionSuffix,
  reasonLine,
  runoffQuestion,
  scoreLine,
  turnInfo,
  wordSize,
} from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  phase: "clue",
  order: ["b", "c", "a"],
  startedAt: 100,
  phaseStartedAt: 100,
  phaseEndsAt: 300_100,
  turn: 1,
  turnStartedAt: 2_000,
  turnEndsAt: 17_000,
  runoff: null,
  ready: [],
  reveal: null,
};
const priv = { word: "ÇAY", myVote: null, myNotice: null, locked: false };
const final = {
  commonWord: "ÇAY",
  infiltratorWord: "KAHVE",
  guess: "ÇAYI",
  stole: false,
  scores: { a: 1, b: 0, c: 0 },
  rightVoters: ["a", "b"],
};
const reveal = {
  infiltrator: "c",
  votes: { a: "c", b: "c" },
  tally: { a: 0, b: 0, c: 2 },
  caught: true,
  runoff: null,
  selfNoticed: false,
  openedAt: 50_000,
  guessOpensAt: 57_000,
  guessEndsAt: 72_000,
  finalAt: 72_000,
  finishAt: 77_000,
  final,
};

describe("Sızma görünümü", () => {
  it("ipucu görünümünü okur (konuşma sırası alanlarıyla)", () => {
    const v = parseSizmaView(pub, priv);
    expect(v?.phase).toBe("clue");
    expect(v?.turn).toBe(1);
    expect(v?.turnEndsAt).toBe(17_000);
    expect(v?.word).toBe("ÇAY");
  });
  it("kişisel görünüm yoksa (TV) izleyici görünümü kullanılır", () => {
    expect(parseSizmaView(pub, null)?.word).toBeNull();
    expect(parseSizmaView(pub, undefined)?.locked).toBe(false);
  });
  it("ikinci oylama, son şans ve son açılış görünümlerini okur", () => {
    expect(parseSizmaView({ ...pub, phase: "runoff", runoff: ["a", "b"] }, priv)?.runoff).toEqual(["a", "b"]);
    const g = parseSizmaView(
      { ...pub, phase: "guess", reveal: { ...reveal, final: null } },
      { ...priv, word: null },
    );
    expect(g?.reveal?.final).toBeNull();
    expect(g?.word).toBeNull();
    const r = parseSizmaView({ ...pub, phase: "reveal", reveal }, priv);
    expect(r?.reveal?.final?.guess).toBe("ÇAYI");
    expect(r?.reveal?.final?.rightVoters).toEqual(["a", "b"]);
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseSizmaView(null, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, turn: "1" }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, runoff: [1] }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, players: [1] }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, caught: "yes" } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, votes: { a: 3 } } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, guessOpensAt: "x" } }, priv)).toBeNull();
    expect(parseSizmaView({ ...pub, reveal: { ...reveal, final: { ...final, stole: 1 } } }, priv)).toBeNull();
    expect(
      parseSizmaView({ ...pub, reveal: { ...reveal, final: { ...final, scores: { a: "x" } } } }, priv),
    ).toBeNull();
    expect(parseSizmaView(pub, { word: 3, myVote: null, myNotice: null, locked: false })).toBeNull();
    expect(parseSizmaView(pub, { ...priv, myNotice: "evet" })).toBeNull();
    expect(parseSizmaView(pub, { word: "A", myVote: null, myNotice: null })).toBeNull();
  });
  it("konuşma özeti: tur, konuşan, sıradaki, bu turda konuşanlar", () => {
    const order = ["a", "b", "c"];
    expect(turnInfo(order, 0)).toEqual({
      round: 1,
      rounds: 2,
      speaker: "a",
      next: "b",
      spoken: [],
      done: false,
    });
    expect(turnInfo(order, 2)).toMatchObject({ round: 1, speaker: "c", next: "a", spoken: ["a", "b"] });
    expect(turnInfo(order, 4)).toMatchObject({ round: 2, speaker: "b", spoken: ["a"] });
    expect(turnInfo(order, 5).next).toBeNull();
    expect(turnInfo(order, 6)).toMatchObject({ done: true, speaker: null, round: 2 });
  });
  it("oyların uçuş sırası: az oy alandan çok alana; oy vermeyen uçmaz", () => {
    const plan = flightPlan(["a", "b", "c", "d"], { a: "c", b: "c", c: "a", d: "c" });
    expect(plan.map((f) => `${f.from}>${f.to}`)).toEqual(["c>a", "a>c", "b>c", "d>c"]);
    expect(plan.map((f) => f.index)).toEqual([0, 1, 2, 3]);
    expect(flightPlan(["a", "b"], { a: "zz" })).toEqual([]);
  });
  it("uçuşlar açılış süresine sığar ve hükümden önce biter", () => {
    for (const n of [1, 2, 8]) {
      expect(flightAt(n - 1, n) + OPENING.flyMs).toBeLessThanOrEqual(OPENING.verdictAt);
      expect(flightAt(0, n)).toBe(OPENING.flyFrom);
    }
    expect(OPENING.badgeAt).toBeLessThan(OPENING.caughtEnd);
    expect(OPENING.scoreAt).toBeLessThan(OPENING.escapedEnd);
  });
  it("puan satırı: doğru oy, Evet yanığı, sızmanın kazancı, puan yok", () => {
    const r = { ...reveal, final };
    expect(scoreLine(r, "a", false)).toBe("+1 · Doğru oy");
    expect(scoreLine(r, "b", true)).toBe("Evet dedin, yakalama puanı alamadın");
    expect(scoreLine(r, "c", null)).toBe("Bu sefer puan yok");
    const esc = { ...r, caught: false, selfNoticed: true, final: { ...final, scores: { a: 0, b: 0, c: 3 } } };
    expect(scoreLine(esc, "c", true)).toBe("+3 · Kurtuldun · Fark ettin");
    expect(outcomeOf(r, "a")).toBe("win");
    expect(outcomeOf(r, "c")).toBe("lose");
  });
  it("neden satırı: eşitlik, kimse oy vermedi, başka biri en çok oy aldı", () => {
    const name = (id: string) => ({ a: "Elif", b: "Mert" })[id] ?? "?";
    expect(reasonLine({ ...reveal, caught: false, tally: { a: 1, b: 1, c: 0 } }, name)).toBe(
      "Oylar eşit: sızma kurtuldu",
    );
    expect(
      reasonLine({ ...reveal, caught: false, runoff: ["a", "b"], tally: { a: 1, b: 1, c: 0 } }, name),
    ).toBe("İkinci oylamada da eşitlik: sızma kurtuldu");
    expect(reasonLine({ ...reveal, caught: false, tally: { a: 0, b: 0, c: 0 } }, name)).toBe(
      "Kimse oy vermedi: sızma kurtuldu",
    );
    expect(reasonLine({ ...reveal, caught: false, tally: { a: 2, b: 1, c: 0 } }, name)).toBe(
      "En çok oyu Elif aldı: sızma kurtuldu",
    );
    expect(reasonLine(reveal, name)).toBe("En çok oyu tek başına aldı");
  });
  it("eşitlik sorusu Türkçe soru ekiyle", () => {
    expect(questionSuffix("Elif")).toBe("mi");
    expect(questionSuffix("Kaan")).toBe("mı");
    expect(questionSuffix("Burak")).toBe("mı");
    expect(questionSuffix("Okul")).toBe("mu");
    expect(questionSuffix("Gül")).toBe("mü");
    expect(runoffQuestion(["Elif", "Zeynep"])).toBe("Elif mi, Zeynep mi?");
  });
  it("kelime boyu uzadıkça küçülür", () => {
    expect(wordSize("ÇAY")).toBeGreaterThan(wordSize("TELEVİZYON"));
  });
});
