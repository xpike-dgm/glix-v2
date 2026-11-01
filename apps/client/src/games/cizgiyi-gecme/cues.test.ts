import { type CizgiState, createRng, cizgiyiGecme as g, isRejected } from "@glix/engine";
import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { cizgiCues } from "./cues.js";
import { parseCizgiView } from "./view.js";

const IDS = ["p0", "p1", "p2", "p3"];
const ctx = (now: number) => ({ now, rng: createRng(3), connected: IDS });
/** Her tur: p0 ve p1 aynı platform (çarpışma), p2 ve p3 tek. */
const VALUES = [44, 47, 72, 15];

function game(): CizgiState {
  let s = g.setup(IDS, ctx(0));
  for (const round of s.rounds) {
    IDS.forEach((id, i) => {
      const r = g.reduce(s, id, { kind: "choose", value: VALUES[i] ?? 0 }, ctx(round.startAt + 500));
      if (!isRejected(r)) s = r;
    });
  }
  return s;
}

/** Ekrandaki gibi: görünüm her saniye yeniden ayrıştırılır (yeni nesne), saat her karede ilerler. */
function run(from: number, to: number, step = 50) {
  const state = game();
  const viewAt = (t: number) => parseCizgiView(g.publicView(state, ctx(t)), g.view(state, "p0", ctx(t)));
  const [now, setNow] = createSignal(from);
  const [view, setView] = createSignal(viewAt(from));
  const calls: string[] = [];
  const dispose = createRoot((d) => {
    cizgiCues(
      view,
      now,
      () => false,
      () => IDS,
      {
        last: (secs, r) => calls.push(`last${r}.${secs}`),
        radar: (r) => calls.push(`radar${r}`),
        climb: (r, p) => calls.push(`climb${r}.${p.id}`),
        seat: (r, p) => calls.push(`seat${r}.${p.id}`),
        crash: (r, z) => calls.push(`crash${r}.${z}`),
        launch: (r) => calls.push(`launch${r}`),
        points: (r) => calls.push(`points${r}`),
      },
    );
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

describe("Çizgiyi Geçme sesleri (CZ-U14): her olay bir kez", () => {
  it("iki tur: radar, son 5 sn tiki, tırmanma/oturma, çarpışma, fırlatma ve puan birer kez", () => {
    const { calls } = run(0, 72_000);
    for (const r of [1, 2]) {
      expect(count(calls, `radar${r}`)).toBe(1);
      for (const s of [5, 4, 3, 2, 1]) expect(count(calls, `last${r}.${s}`)).toBe(1);
      for (const id of IDS) {
        expect(count(calls, `climb${r}.${id}`)).toBe(1);
        expect(count(calls, `seat${r}.${id}`)).toBe(1);
      }
      expect(calls.filter((c) => c.startsWith(`crash${r}.`))).toEqual([`crash${r}.4`]);
      expect(count(calls, `launch${r}`)).toBe(1);
      expect(count(calls, `points${r}`)).toBe(1);
    }
    expect(count(calls, "last")).toBe(10);
  });

  it("tırmanış sırası küçükten büyüğe", () => {
    const { calls } = run(30_000, 34_900);
    expect(calls.filter((c) => c.startsWith("seat"))).toEqual([
      "seat1.p3",
      "seat1.p0",
      "seat1.p1",
      "seat1.p2",
    ]);
  });

  it("açılışın ortasında açılan ekranda geçmiş anların sesi çalmaz; radar geç gelirse sessiz", () => {
    expect(run(33_000, 34_900).calls).toEqual([]);
    expect(run(18_000, 20_000).calls).toEqual([]);
  });
});
