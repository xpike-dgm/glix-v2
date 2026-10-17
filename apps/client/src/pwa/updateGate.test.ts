import { describe, expect, it } from "vitest";
import type { ScreenId } from "../screens/route.js";
import { shouldOfferUpdate } from "./updateGate.js";

const ALL: ScreenId[] = [
  "home",
  "join",
  "notfound",
  "lobby",
  "briefing",
  "countdown",
  "playing",
  "results",
  "final",
];

describe("shouldOfferUpdate", () => {
  it("bekleyen sürüm yoksa hiçbir ekranda önermez", () => {
    for (const s of ALL) expect(shouldOfferUpdate(false, s)).toBe(false);
  });
  it("ana sayfa, katıl, lobi ve final ekranında önerir", () => {
    for (const s of ["home", "join", "notfound", "lobby", "final"] as const)
      expect(shouldOfferUpdate(true, s)).toBe(true);
  });
  it("maç sürerken (anlatım, geri sayım, oyun, sonuç) erteler", () => {
    for (const s of ["briefing", "countdown", "playing", "results"] as const)
      expect(shouldOfferUpdate(true, s)).toBe(false);
  });
  it("maç bitip final ekranına geçince öneri görünür", () => {
    expect(shouldOfferUpdate(true, "playing")).toBe(false);
    expect(shouldOfferUpdate(true, "final")).toBe(true);
  });
});
