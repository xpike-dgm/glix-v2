import { describe, expect, it } from "vitest";
import { shouldSweep } from "./curtain.js";

describe("shouldSweep", () => {
  it("maç akışındaki geçişlerde süpürür", () => {
    expect(shouldSweep("briefing", "countdown")).toBe(true);
    expect(shouldSweep("countdown", "playing")).toBe(true);
    expect(shouldSweep("playing", "results")).toBe(true);
    expect(shouldSweep("results", "briefing")).toBe(true);
  });
  it("lobi, final, ilk açılış ve aynı ekranda süpürmez", () => {
    expect(shouldSweep(undefined, "briefing")).toBe(false);
    expect(shouldSweep("lobby", "briefing")).toBe(false);
    expect(shouldSweep("results", "final")).toBe(false);
    expect(shouldSweep("playing", "playing")).toBe(false);
    expect(shouldSweep("home", "lobby")).toBe(false);
  });
});
