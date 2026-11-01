import { BUTONA_BAS_DURATION_MS } from "@glix/engine";
import { createMemo, createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { butonaBasCues } from "./cues.js";
import { roundClockAt } from "./view.js";

function run(from: number, to: number) {
  const startedAt = 0;
  const endsAt = BUTONA_BAS_DURATION_MS;
  const [now, setNow] = createSignal(from);
  // Görünüm her durum güncellemesinde yeniden gelir: yeni nesne.
  const [view, setView] = createSignal({ startedAt, endsAt });
  const calls: string[] = [];
  const dispose = createRoot((d) => {
    const clock = createMemo(() => roundClockAt(view().startedAt, view().endsAt, now()));
    butonaBasCues(clock, now, {
      play: (c) => calls.push(`gong:${c.round}`),
      gap: (c) => calls.push(`vuus:${c.round}`),
      over: () => calls.push("fanfar"),
    });
    return d;
  });
  for (let t = from; t <= to; t += 50) {
    setNow(t);
    if (t % 500 === 0) setView({ startedAt, endsAt });
  }
  dispose();
  return calls;
}

describe("Butona Bas sesleri", () => {
  it("tur başı gongu, ara vuuşu ve fanfar her anda bir kez", () => {
    const calls = run(0, BUTONA_BAS_DURATION_MS + 4_000);
    expect(calls.filter((c) => c.startsWith("gong"))).toEqual(["gong:0", "gong:1", "gong:2"]);
    expect(calls.filter((c) => c === "fanfar")).toEqual(["fanfar"]);
    expect(new Set(calls).size).toBe(calls.length);
  });

  it("oyun bitmiş açılan ekran sessizdir", () => {
    expect(run(BUTONA_BAS_DURATION_MS + 100, BUTONA_BAS_DURATION_MS + 3_000)).toEqual([]);
  });
});
