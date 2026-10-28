import { describe, expect, it } from "vitest";
import { winnerCelebration } from "./finalFx.js";

const w = (celebration?: string) => ({ player: { cosmetics: celebration ? { celebration } : undefined } });

describe("kazananın kutlaması", () => {
  it("kazananın kuşandığı zafer kutlaması seçilir", () => {
    expect(winnerCelebration([w("zafer-balon")])).toBe("zafer-balon");
  });
  it("beraberlikte ilk sahibi kazanır; kutlaması olmayan atlanır", () => {
    expect(winnerCelebration([w(), w("zafer-simsek"), w("zafer-balon")])).toBe("zafer-simsek");
  });
  it("kimsede yoksa klasik konfeti (tanımsız)", () => {
    expect(winnerCelebration([w(), w()])).toBeUndefined();
    expect(winnerCelebration([])).toBeUndefined();
  });
  it("bilinmeyen ya da yanlış türdeki kimlik atlanır", () => {
    expect(winnerCelebration([w("zafer-yok"), w("cerceve-cift"), w("zafer-konfeti")])).toBe("zafer-konfeti");
  });
});
