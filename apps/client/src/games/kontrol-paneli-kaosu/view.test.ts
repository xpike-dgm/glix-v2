import { describe, expect, it } from "vitest";
import {
  clockDigits,
  clueText,
  conditionText,
  cutText,
  outcomeOf,
  parseClue,
  parseKontrolView,
  remainingMs,
  waveCleared,
  waveName,
} from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  stage: "play",
  wave: 0,
  waves: 3,
  wires: 4,
  startedAt: 100,
  endsAt: 25_100,
  nextAt: 25_100,
  finishAt: 86_100,
  done: [],
  jumps: 0,
  lastJumpAt: null,
  results: [],
  reveal: null,
};
const clue = {
  wave: 1,
  wires: 4,
  conditions: [
    { kind: "at", position: 1, color: "blue" },
    { kind: "at", position: 3, color: "yellow" },
  ],
  cut: { kind: "color", color: "blue" },
};
const priv = { panel: ["blue", "green", "yellow", "red"], clue, myCut: null };
const row = (cut: string | null, correct: boolean, carrier: string) => ({
  panel: ["blue", "green", "yellow", "red"],
  cut,
  answer: "blue",
  correct,
  carrier,
  clue,
});
const result = {
  wave: 0,
  rows: { a: row("blue", true, "b"), b: row(null, false, "c"), c: row("red", false, "a") },
  scores: { a: 1, b: 1, c: 0 },
};

describe("Kontrol Paneli Kaosu görünümü", () => {
  it("oyun görünümünü okur", () => {
    const v = parseKontrolView(pub, priv);
    expect(v?.stage).toBe("play");
    expect(v?.wave).toBe(0);
    expect(v?.panel).toEqual(["blue", "green", "yellow", "red"]);
    expect(v?.clue?.conditions).toHaveLength(2);
    expect(v?.myCut).toBeNull();
  });
  it("izleyici (boş) ve ipucusuz görünümü okur", () => {
    expect(parseKontrolView(pub, { panel: [], clue: null, myCut: null })?.clue).toBeNull();
    expect(parseKontrolView(pub, { panel: [], myCut: null })?.clue).toBeNull();
  });
  it("dalga 3: 5 kablo ve mor okunur", () => {
    const five = { panel: ["purple", "blue", "green", "red", "yellow"], clue: null, myCut: "purple" };
    const v = parseKontrolView({ ...pub, wave: 2, wires: 5 }, five);
    expect(v?.panel).toHaveLength(5);
    expect(v?.myCut).toBe("purple");
  });
  it("ara, dalga sonuçları ve oyun sonu okunur", () => {
    const b = parseKontrolView(
      { ...pub, stage: "break", results: [result], jumps: 2, lastJumpAt: 9_000 },
      priv,
    );
    expect(b?.results[0]?.rows.a?.correct).toBe(true);
    expect(b?.jumps).toBe(2);
    const r = parseKontrolView(
      {
        ...pub,
        stage: "reveal",
        wave: 2,
        results: [result, result, result],
        reveal: { totals: { a: 3 }, awards: { a: 2 } },
      },
      priv,
    );
    expect(r?.reveal?.awards.a).toBe(2);
    const { reveal: _r, ...rest } = pub;
    expect(parseKontrolView(rest, priv)?.reveal).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseKontrolView(null, priv)).toBeNull();
    expect(parseKontrolView(pub, null)).toBeNull();
    expect(parseKontrolView({ ...pub, stage: "x" }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, wave: 3 }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, wires: 9 }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, done: [1] }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, endsAt: "x" }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, lastJumpAt: "x" }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, jumps: -1 }, priv)).toBeNull();
    expect(parseKontrolView(pub, { ...priv, panel: ["blue", "turuncu"] })).toBeNull();
    expect(parseKontrolView(pub, { ...priv, myCut: "turuncu" })).toBeNull();
    expect(parseKontrolView(pub, { ...priv, clue: { ...clue, conditions: [] } })).toBeNull();
    expect(
      parseKontrolView(pub, {
        ...priv,
        clue: { ...clue, conditions: [{ kind: "at", position: 5, color: "red" }] },
      }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, {
        ...priv,
        clue: { ...clue, conditions: [{ kind: "at", position: 1.5, color: "red" }] },
      }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, {
        ...priv,
        clue: { ...clue, conditions: [{ kind: "near", a: "red", b: "blue" }] },
      }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, {
        ...priv,
        clue: { ...clue, conditions: [{ kind: "above", a: "red", b: "red" }] },
      }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, { ...priv, clue: { ...clue, cut: { kind: "color", color: "x" } } }),
    ).toBeNull();
    expect(
      parseKontrolView(pub, { ...priv, clue: { ...clue, cut: { kind: "position", position: 7 } } }),
    ).toBeNull();
    expect(
      parseKontrolView({ ...pub, results: [{ wave: 0, rows: { a: { panel: [] } }, scores: {} }] }, priv),
    ).toBeNull();
    expect(parseKontrolView({ ...pub, results: [{ ...result, scores: { a: "x" } }] }, priv)).toBeNull();
    expect(parseKontrolView({ ...pub, reveal: { totals: {}, awards: { a: "x" } } }, priv)).toBeNull();
    expect(parseClue("x")).toBeNull();
  });
  it("ipucu Türkçe cümleye çevrilir: her tür, belirtme ve ayrılma hâli renge göre", () => {
    expect(clueText(parseClue(clue) as never)).toBe("1. kablo mavi ve 3. kablo sarıysa maviyi kes");
    const c = (conditions: unknown[], cut: unknown, wires = 4) => {
      const p = parseClue({ wave: 2, wires, conditions, cut });
      if (!p) throw new Error("ipucu okunmadı");
      return clueText(p);
    };
    expect(
      c(
        [
          { kind: "notAt", position: 2, color: "red" },
          { kind: "at", position: 4, color: "yellow" },
        ],
        { kind: "color", color: "blue" },
      ),
    ).toBe("2. kablo kırmızı değil ve 4. kablo sarıysa maviyi kes");
    expect(c([{ kind: "adjacent", a: "blue", b: "yellow" }], { kind: "color", color: "green" })).toBe(
      "Mavi ile sarı yan yanaysa yeşili kes",
    );
    expect(c([{ kind: "at", position: 1, color: "green" }], { kind: "position", position: 4 })).toBe(
      "1. kablo yeşilse en alttaki kabloyu kes",
    );
    expect(c([{ kind: "above", a: "red", b: "blue" }], { kind: "color", color: "yellow" })).toBe(
      "Kırmızı maviden yukarıdaysa sarıyı kes",
    );
    expect(
      c(
        [
          { kind: "at", position: 2, color: "purple" },
          { kind: "notAt", position: 5, color: "red" },
          { kind: "above", a: "yellow", b: "purple" },
        ],
        { kind: "color", color: "purple" },
        5,
      ),
    ).toBe("Sarı mordan yukarıda, 2. kablo mor ve 5. kablo kırmızı değilse moru kes");
    expect(cutText({ kind: "position", position: 1 }, 5)).toBe("en üstteki kabloyu");
    expect(cutText({ kind: "position", position: 5 }, 5)).toBe("en alttaki kabloyu");
    expect(conditionText({ kind: "above", a: "green", b: "red" })).toBe("yeşil kırmızıdan yukarıda");
    // Şart eki ünlü uyumuyla: maviyse, yeşilse, kırmızıysa, sarıysa, morsa; değilse, yan yanaysa, yukarıdaysa.
    const at = (color: "blue" | "green" | "red" | "yellow" | "purple") =>
      conditionText({ kind: "at", position: 1, color }, true);
    expect(["blue", "green", "red", "yellow", "purple"].map((c) => at(c as never))).toEqual([
      "1. kablo maviyse",
      "1. kablo yeşilse",
      "1. kablo kırmızıysa",
      "1. kablo sarıysa",
      "1. kablo morsa",
    ]);
    expect(conditionText({ kind: "notAt", position: 2, color: "red" }, true)).toBe(
      "2. kablo kırmızı değilse",
    );
    expect(conditionText({ kind: "adjacent", a: "blue", b: "red" }, true)).toBe(
      "mavi ile kırmızı yan yanaysa",
    );
    expect(conditionText({ kind: "above", a: "red", b: "purple" }, true)).toBe("kırmızı mordan yukarıdaysa");
    // İpucu metni teknik kelime içermez.
    expect(c([{ kind: "at", position: 1, color: "red" }], { kind: "color", color: "red" })).not.toMatch(
      /notAt|adjacent|above|position/,
    );
  });
  it("kendi sonucum: dalgadaki kesim ve taşıdığım ipucunun sonucu; tamamen imha", () => {
    const r = parseKontrolView({ ...pub, stage: "break", results: [result] }, priv)?.results[0];
    if (!r) throw new Error("yok");
    expect(outcomeOf(r, "a")).toEqual({ own: true, carried: false, points: 1 });
    expect(outcomeOf(r, "b")).toEqual({ own: null, carried: true, points: 1 });
    expect(outcomeOf(r, "c")).toEqual({ own: false, carried: false, points: 0 });
    expect(waveCleared(r)).toBe(false);
    expect(
      waveCleared({ ...r, rows: { a: { ...(r.rows.a as NonNullable<typeof r.rows.a>), correct: true } } }),
    ).toBe(true);
  });
  it("bomba saati: SS.cc basamakları, kalan süre 0'ın altına inmez, dalga adları", () => {
    expect(clockDigits(25_000)).toBe("2500");
    expect(clockDigits(9_870)).toBe("0987");
    expect(clockDigits(0)).toBe("0000");
    expect(clockDigits(-5)).toBe("0000");
    expect(clockDigits(500_000)).toBe("9999");
    expect(remainingMs(1_000, 2_000)).toBe(0);
    expect(remainingMs(3_000, 2_000)).toBe(1_000);
    expect([waveName(0), waveName(1), waveName(2)]).toEqual(["Isınma", "Karmaşa", "Kaos"]);
  });
});
