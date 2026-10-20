import { describe, expect, it } from "vitest";
import { clueText, outcomeOf, parseClue, parseKontrolView } from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "play",
  startedAt: 100,
  endsAt: 60_100,
  finishAt: 68_100,
  done: [],
  reveal: null,
};
const clue = {
  conditions: [
    { position: 1, color: "blue" },
    { position: 3, color: "yellow" },
  ],
  cut: "blue",
};
const priv = { panel: ["blue", "green", "yellow", "red"], clue, myCut: null };
const row = (cut: string | null, correct: boolean, carrier: string) => ({
  panel: ["blue", "green", "yellow", "red"],
  cut,
  correct,
  carrier,
  clue,
});
const reveal = {
  rows: { a: row("blue", true, "b"), b: row(null, false, "c"), c: row("red", false, "a") },
  scores: { a: 1, b: 1, c: 0 },
};

describe("Kontrol Paneli Kaosu görünümü", () => {
  it("oyun görünümünü okur", () => {
    const v = parseKontrolView(pub, priv);
    expect(v?.stage).toBe("play");
    expect(v?.panel).toEqual(["blue", "green", "yellow", "red"]);
    expect(v?.clue?.conditions).toHaveLength(2);
    expect(v?.myCut).toBeNull();
  });
  it("izleyici (boş) ve ipucusuz görünümü okur", () => {
    expect(parseKontrolView(pub, { panel: [], clue: null, myCut: null })?.clue).toBeNull();
    expect(parseKontrolView(pub, { panel: [], myCut: null })?.clue).toBeNull();
  });
  it("sonucu okur; reveal yoksa kapalı sayılır", () => {
    const v = parseKontrolView({ ...pub, stage: "reveal", reveal }, { ...priv, myCut: "blue" });
    expect(v?.reveal?.rows.a?.correct).toBe(true);
    const { reveal: _r, ...rest } = pub;
    expect(parseKontrolView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseKontrolView(null, priv)).toBeNull();
    expect(parseKontrolView(pub, null)).toBeNull();
    expect(parseKontrolView({ ...pub, stage: "x" }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, done: [1] }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, endsAt: "x" }, priv)).toBeNull();
    expect(parseKontrolView(pub, { ...priv, panel: ["blue", "mor"] })).toBeNull();
    expect(parseKontrolView(pub, { ...priv, myCut: "mor" })).toBeNull();
    expect(parseKontrolView(pub, { ...priv, clue: { conditions: [], cut: "blue" } })).toBeNull();
    expect(
      parseKontrolView(pub, { ...priv, clue: { conditions: [{ position: 5, color: "red" }], cut: "red" } }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, { ...priv, clue: { conditions: [{ position: 1.5, color: "red" }], cut: "red" } }),
    ).toBeNull();
    expect(parseKontrolView(pub, { ...priv, clue: { conditions: clue.conditions, cut: "mor" } })).toBeNull();
    expect(parseKontrolView({ ...pub, reveal: { rows: { a: { panel: [] } }, scores: {} } }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, reveal: { ...reveal, scores: { a: "x" } } }, priv)).toBeNull();
    expect(parseClue("x")).toBeNull();
  });
  it("ipucu Türkçe cümleye çevrilir (belirtme hâli renge göre)", () => {
    expect(clueText({ conditions: clue.conditions as never, cut: "blue" })).toBe(
      "1. kablo mavi ve 3. kablo sarı ise maviyi kes",
    );
    expect(
      clueText({
        conditions: [
          { position: 2, color: "green" },
          { position: 3, color: "red" },
          { position: 4, color: "blue" },
        ],
        cut: "yellow",
      }),
    ).toBe("2. kablo yeşil, 3. kablo kırmızı ve 4. kablo mavi ise sarıyı kes");
    expect(clueText({ conditions: [{ position: 1, color: "red" }], cut: "green" })).toBe(
      "1. kablo kırmızı ise yeşili kes",
    );
    expect(clueText({ conditions: [{ position: 1, color: "red" }], cut: "red" })).toBe(
      "1. kablo kırmızı ise kırmızıyı kes",
    );
  });
  it("kendi sonucum: kesim ve taşıdığım ipucunun sonucu", () => {
    const r = parseKontrolView({ ...pub, reveal }, priv)?.reveal;
    if (!r) throw new Error("yok");
    expect(outcomeOf(r, "a")).toEqual({ own: true, carried: false, points: 1 });
    expect(outcomeOf(r, "b")).toEqual({ own: null, carried: true, points: 1 });
    expect(outcomeOf(r, "c")).toEqual({ own: false, carried: false, points: 0 });
  });
});
