import { createRoot, createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import { cockCue, HOLD_BAND_MS, holdBandOn } from "./cues.js";

describe("Rus Ruleti sesleri", () => {
  it('"SİLAH SENDE!" çek-çek sesi bant açıldıkça bir kez (bant boyunca her karede değil)', () => {
    const [now, setNow] = createSignal(0);
    // Her durum güncellemesinde yeni nesne; iki karar penceresi.
    const [pub, setPub] = createSignal({ shots: 1, handoff: null, startedAt: 0, openAt: 5_000 });
    let cocks = 0;
    const dispose = createRoot((d) => {
      cockCue(
        () => holdBandOn(pub(), now()),
        () => cocks++,
      );
      return d;
    });
    for (let t = 0; t < 5_500; t += 20) {
      setNow(t);
      setPub({ ...pub() });
    }
    expect(cocks).toBe(1);
    setPub({ shots: 2, handoff: null, startedAt: 0, openAt: 9_000 });
    for (let t = 5_500; t < 9_500; t += 20) setNow(t);
    expect(cocks).toBe(2);
    expect(holdBandOn(pub(), 9_000 - HOLD_BAND_MS)).toBe(true);
    dispose();
  });
});
