import { createMemo, createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { betWonCue, blastCue } from "./cues.js";
import { parseKorBombaView } from "./view.js";

const pub = {
  startedAt: 1000,
  holder: "a",
  passes: 2,
  lastPass: { seq: 2, from: "b", to: "a" },
  trail: ["c", "b", "a"],
  lockedUntil: 4_000,
  exploded: false,
  explodedAt: null,
  correctPredictors: [],
  journey: null,
};
const watcher = (lastResult: { turn: number; correct: boolean } | null) => ({
  role: "watcher",
  explodeAt: 99,
  lastBonusMs: null,
  bet: null,
  betUsed: lastResult !== null,
  lastResult,
});

describe("Kör Bomba sesleri", () => {
  it("tutan bahis zili ve patlama her olay için bir kez (aynı durum 12 kez gelse de)", () => {
    const [raw, setRaw] = createSignal({ pub, priv: watcher(null) });
    const bells: number[] = [];
    const booms: boolean[] = [];
    const dispose = createRoot((d) => {
      const view = createMemo(() => parseKorBombaView(raw().pub, raw().priv));
      betWonCue(view, (turn) => bells.push(turn));
      blastCue(
        () => view()?.pub.exploded ?? false,
        (now, live) => {
          if (now && live) booms.push(true);
        },
      );
      return d;
    });
    for (let i = 0; i < 12; i++) setRaw({ pub, priv: watcher({ turn: 2, correct: true }) });
    for (let i = 0; i < 12; i++)
      setRaw({ pub: { ...pub, passes: 3 }, priv: watcher({ turn: 3, correct: false }) });
    const blown = { ...pub, exploded: true, explodedAt: 9_000 };
    for (let i = 0; i < 12; i++) setRaw({ pub: blown, priv: watcher({ turn: 3, correct: false }) });
    expect(bells).toEqual([2]);
    expect(booms).toEqual([true]);
    dispose();
  });

  it("ekran patlamış ya da bahis sonucuyla açılırsa sessizdir", () => {
    const blown = { ...pub, exploded: true, explodedAt: 9_000 };
    const [raw, setRaw] = createSignal({ pub: blown, priv: watcher({ turn: 2, correct: true }) });
    let sounds = 0;
    const dispose = createRoot((d) => {
      const view = createMemo(() => parseKorBombaView(raw().pub, raw().priv));
      betWonCue(view, () => sounds++);
      blastCue(
        () => view()?.pub.exploded ?? false,
        (now, live) => {
          if (now && live) sounds++;
        },
      );
      return d;
    });
    for (let i = 0; i < 12; i++) setRaw({ pub: blown, priv: watcher({ turn: 2, correct: true }) });
    expect(sounds).toBe(0);
    dispose();
  });
});
