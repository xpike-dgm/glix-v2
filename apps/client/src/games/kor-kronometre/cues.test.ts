import { createRng, korKronometre } from "@glix/engine";
import { createMemo, createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { korKronometreCues } from "./cues.js";
import { clockAt, parseKorKronometreView } from "./view.js";

const IDS = ["p0", "p1", "p2"];
const ctx = (now: number) => ({ now, rng: createRng(1), connected: IDS });

/** Ekrandaki gibi: görünüm her "sunucu güncellemesinde" yeniden ayrıştırılır, saat her karede yeniden hesaplanır. */
function run(from: number, to: number, step: number) {
  const state = korKronometre.setup(IDS, ctx(0));
  const viewAt = (t: number) =>
    parseKorKronometreView(korKronometre.publicView(state, ctx(t)), korKronometre.view(state, "p0", ctx(t)));
  const [now, setNow] = createSignal(from);
  const [view, setView] = createSignal(viewAt(from));
  const go: number[] = [];
  const ready: number[] = [];
  const dispose = createRoot((d) => {
    const clock = createMemo(() => {
      const v = view();
      return v ? clockAt(v, now()) : null;
    });
    korKronometreCues(clock, now, { ready: (c) => ready.push(c.hand), go: (c) => go.push(c.hand) });
    return d;
  });
  for (let t = from; t <= to; t += step) {
    setNow(t);
    // Her saniye aynı durum yeniden gelir (yeni nesne).
    if (t % 1_000 === 0) setView(viewAt(t));
  }
  dispose();
  return { go, ready, hands: state.hands };
}

describe("Kör Kronometre sesleri", () => {
  it('"BAŞLA!" gongu her elde bir kez çalar (saat her karede ilerlese de)', () => {
    const state = korKronometre.setup(IDS, ctx(0));
    const last = state.hands.at(-1);
    if (!last) throw new Error("el yok");
    const { go, ready } = run(0, last.endsAt + 3_000, 50);
    expect(go).toEqual(state.hands.map((_, i) => i));
    expect(ready).toEqual(state.hands.map((_, i) => i));
  });

  it("sayma ortasında açılan ekranda gong çalmaz", () => {
    const state = korKronometre.setup(IDS, ctx(0));
    const h = state.hands[0];
    if (!h) throw new Error("el yok");
    const { go } = run(h.goAt + 2_000, h.endsAt - 100, 50);
    expect(go).toEqual([]);
  });
});
