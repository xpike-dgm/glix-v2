import { describe, expect, it } from "vitest";
import { OPENING_FRESH_MS, shouldPlayOpening } from "./opening.js";

const base = { startedAt: 10_000, now: 10_100, reduced: false, alreadyPlayed: false };

describe("shouldPlayOpening", () => {
  it("aşama yeni başladıysa oynatır", () => {
    expect(shouldPlayOpening(base)).toBe(true);
  });

  it("yeniden bağlanan (aşama eskimiş) oyuncuya oynatmaz", () => {
    expect(shouldPlayOpening({ ...base, now: 10_000 + OPENING_FRESH_MS + 1 })).toBe(false);
    expect(shouldPlayOpening({ ...base, now: 25_000 })).toBe(false);
  });

  it("hareket azaltılmışsa oynatmaz", () => {
    expect(shouldPlayOpening({ ...base, reduced: true })).toBe(false);
  });

  it("aynı aşama için ikinci kez oynatmaz", () => {
    expect(shouldPlayOpening({ ...base, alreadyPlayed: true })).toBe(false);
  });

  it("saat sapması: başlangıç biraz ilerideyse hâlâ taze sayılır, çok ilerideyse değil", () => {
    expect(shouldPlayOpening({ ...base, now: 9_700 })).toBe(true);
    expect(shouldPlayOpening({ ...base, now: 5_000 })).toBe(false);
  });
});
