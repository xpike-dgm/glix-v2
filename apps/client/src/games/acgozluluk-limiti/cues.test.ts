import { type AcgozlulukState, createRng, acgozlulukLimiti as g, isRejected } from "@glix/engine";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { acgozlulukCues } from "./cues.js";
import { parseAcgozlulukView } from "./view.js";

const IDS = ["p0", "p1", "p2", "p3"];
const ctx = (now: number) => ({ now, rng: createRng(3), connected: IDS });

/** Her tur herkes 3 seçer (12 ≥ 10–12 bandı: taşabilir de sığabilir de). */
function game(): AcgozlulukState {
  let s = g.setup(IDS, ctx(0));
  for (const round of s.rounds) {
    for (const id of IDS) {
      const r = g.reduce(s, id, { kind: "choose", value: 3 }, ctx(round.startAt + 500));
      if (!isRejected(r)) s = r;
    }
  }
  return s;
}

/** Ekrandaki gibi: görünüm her saniye yeniden ayrıştırılır (yeni nesne), saat her karede ilerler. */
function run(viewer: string | null, from: number, to: number, step = 50) {
  const state = game();
  const viewAt = (t: number) =>
    parseAcgozlulukView(g.publicView(state, ctx(t)), g.view(state, viewer, ctx(t)));
  const [now, setNow] = createSignal(from);
  const [view, setView] = createSignal(viewAt(from));
  const calls: string[] = [];
  const dispose = createRoot((d) => {
    acgozlulukCues(view, now, () => false, {
      gear: (secs) => calls.push(`gear${secs}`),
      peek: (r) => calls.push(`peek${r}`),
      lid: (r) => calls.push(`lid${r}`),
      strip: (r, i) => calls.push(`strip${r}.${i}`),
      heart: (r) => calls.push(`heart${r}`),
      verdict: (r) => calls.push(`verdict${r}`),
    });
    return d;
  });
  for (let t = from; t <= to; t += step) {
    setNow(t);
    if (t % 1_000 === 0) setView(viewAt(t));
  }
  dispose();
  return { calls, state };
}

const count = (calls: string[], prefix: string) => calls.filter((c) => c.startsWith(prefix)).length;

describe("Açgözlülük Limiti sesleri", () => {
  it("her tur: kapak, 4 şerit ve karar birer kez; son 5 sn dişlisi saniyede bir kez", () => {
    const { calls } = run("p1", 0, 54_000);
    for (const r of [1, 2, 3]) {
      expect(count(calls, `lid${r}`)).toBe(1);
      expect(count(calls, `verdict${r}`)).toBe(1);
      expect(calls.filter((c) => c.startsWith(`strip${r}.`))).toEqual(
        [0, 1, 2, 3].map((i) => `strip${r}.${i}`),
      );
      expect(count(calls, `heart${r}`)).toBeLessThanOrEqual(1);
    }
    expect(count(calls, "gear")).toBe(15);
    for (const s of [5, 4, 3, 2, 1]) expect(count(calls, `gear${s}`)).toBe(3);
  });

  it("Gözcü bakışı yalnız Gözcü'de ve tur başına bir kez çalar", () => {
    const state = game();
    const scouts = state.rounds.map((r) => r.scoutId);
    for (const id of IDS) {
      const { calls } = run(id, 0, 54_000);
      const expected = scouts.flatMap((s, i) => (s === id ? [`peek${i + 1}`] : []));
      expect(calls.filter((c) => c.startsWith("peek"))).toEqual(expected);
    }
    expect(run(null, 0, 54_000).calls.filter((c) => c.startsWith("peek"))).toEqual([]);
  });

  it("açılışın ortasında açılan ekranda geçmiş şerit, kapak ve karar sesleri çalmaz", () => {
    const state = game();
    const r1 = state.rounds[0];
    if (!r1) throw new Error("tur yok");
    const { calls } = run("p1", r1.endsAt + 3_000, r1.revealEndsAt - 50);
    expect(calls).toEqual([]);
  });
});
