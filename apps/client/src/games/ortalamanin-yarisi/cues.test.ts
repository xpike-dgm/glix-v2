import { createRng, ortalamaninYarisi } from "@glix/engine";
import { createMemo, createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { ortalamaChooseCues, ortalamaRevealCues } from "./cues.js";
import {
  lastSeconds,
  parseOrtalamaView,
  poppedCount,
  revealStage,
  revealTimeline,
  ropesOut,
  roundPhase,
} from "./view.js";

const IDS = ["p0", "p1", "p2", "p3"];
const ctx = (now: number) => ({ now, rng: createRng(1), connected: IDS });

/** Ekrandaki gibi: görünüm her saniye yeniden ayrıştırılır (yeni nesne), saat 50 ms'de bir ilerler. */
function run(from: number, to: number, opts: { lockAt?: number } = {}) {
  let state = ortalamaninYarisi.setup(IDS, ctx(0));
  for (const [i, id] of IDS.entries()) {
    const r = ortalamaninYarisi.reduce(state, id, { kind: "choose", value: 10 + i * 7 }, ctx(1_000));
    if (!("rejected" in r)) state = r;
  }
  const viewAt = (t: number) =>
    parseOrtalamaView(
      ortalamaninYarisi.publicView(state, ctx(t)),
      ortalamaninYarisi.view(state, "p0", ctx(t)),
    );
  const [now, setNow] = createSignal(from);
  const [view, setView] = createSignal(viewAt(from));
  const [locked, setLocked] = createSignal(false);
  const log: string[] = [];
  const dispose = createRoot((d) => {
    const tl = revealTimeline(IDS.length, false);
    const reveal = createMemo(() => {
      const v = view();
      if (!v?.reveal) return null;
      const e = now() - v.endsAt;
      return {
        round: v.round,
        stage: revealStage(e, tl, v.round === v.rounds),
        popped: poppedCount(e, tl, IDS.length),
        ropesOut: ropesOut(e, tl, IDS.length),
      };
    });
    ortalamaRevealCues(reveal, {
      pop: (i) => log.push(`pop${i}`),
      stage: (s) => log.push(`evre${s}`),
      rope: (i) => log.push(`ip${i}`),
    });
    ortalamaChooseCues(
      () => {
        const v = view();
        return v
          ? {
              round: v.round,
              phase: roundPhase(v, now()),
              lastSecond: lastSeconds(v, now()),
              locked: locked(),
            }
          : null;
      },
      { card: (r) => log.push(`kart${r}`), last: (s) => log.push(`son${s}`), lock: () => log.push("kilit") },
    );
    return d;
  });
  for (let t = from; t <= to; t += 50) {
    setNow(t);
    if (opts.lockAt !== undefined && t >= opts.lockAt) setLocked(true);
    if (t % 1_000 === 0) setView(viewAt(t));
  }
  dispose();
  return { log, state };
}

const count = (log: string[], k: string) => log.filter((x) => x === k).length;

describe("Ortalamaya En Yakın sesleri (OY-U15): her olay geçişte bir kez", () => {
  it("1. tur: kart, son üç saniye ve açılış evreleri birer kez; noktalar ve ipler birer kez", () => {
    const { log, state } = run(0, state0().rounds[0]?.revealEndsAt ?? 0);
    const r0 = state.rounds[0];
    if (!r0) throw new Error("tur yok");
    expect(count(log, "kart1")).toBe(1);
    expect(["son3", "son2", "son1"].map((k) => count(log, k))).toEqual([1, 1, 1]);
    for (const s of [1, 2, 3, 4]) expect(count(log, `evre${s}`)).toBe(1);
    expect(count(log, "evre5")).toBe(0);
    // İlk nokta ekran açılışında değil, açılış geçişinde düşer: hepsi bir kez.
    for (let i = 1; i < IDS.length; i++) expect(count(log, `pop${i}`)).toBe(1);
    for (let i = 0; i < IDS.length; i++) expect(count(log, `ip${i}`)).toBeLessThanOrEqual(1);
  });

  it("kilit sesi bir kez (sinyal her karede yeniden okunsa da)", () => {
    const { log } = run(0, 5_000, { lockAt: 3_000 });
    expect(count(log, "kilit")).toBe(1);
  });

  it("açılışın ortasında açılan ekran geçmiş anların sesini çalmaz", () => {
    const s = state0();
    const end = s.rounds[0]?.endsAt ?? 0;
    const { log } = run(end + 2_500, end + 4_900);
    expect(log.filter((x) => x.startsWith("pop"))).toEqual([]);
    expect(count(log, "evre1")).toBe(0);
    expect(count(log, "evre2")).toBe(0);
    expect(count(log, "evre3")).toBe(1);
    expect(count(log, "evre4")).toBe(1);
  });

  it("son tur: üç turun tablosu evresi (5) bir kez", () => {
    const s = state0();
    const last = s.rounds[2];
    if (!last) throw new Error("tur yok");
    const { log } = run(last.endsAt - 200, last.revealEndsAt + 3_000);
    expect(count(log, "evre5")).toBe(1);
    expect(count(log, "evre4")).toBe(1);
  });
});

function state0() {
  return ortalamaninYarisi.setup(IDS, ctx(0));
}
