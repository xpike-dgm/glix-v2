import { describe, expect, it } from "vitest";
import { fmtAgo, fmtDuration, fmtNum, fmtPct, fmtRate, level, phaseLabel, shortDay } from "./format.js";

describe("yönetici biçimleyicileri", () => {
  it("süre", () => {
    expect(fmtDuration(7)).toBe("7 sn");
    expect(fmtDuration(125)).toBe("2 dk 5 sn");
    expect(fmtDuration(3900)).toBe("1 sa 5 dk");
    expect(fmtDuration(2 * 86400 + 3 * 3600)).toBe("2 g 3 sa");
    expect(fmtDuration(-5)).toBe("0 sn");
  });
  it("veri hızı", () => {
    expect(fmtRate(812)).toBe("812 B/sn");
    expect(fmtRate(12.5 * 1024)).toBe("12,5 KB/sn");
    expect(fmtRate(1.5 * 1048576)).toBe("1,5 MB/sn");
  });
  it("yüzde, ondalık, gün", () => {
    expect(fmtPct(0.126)).toBe("%13");
    expect(fmtNum(1.25, 2)).toBe("1,25");
    expect(shortDay("2026-10-27")).toBe("27 Eki");
    expect(shortDay("2026-01-05")).toBe("5 Oca");
    expect(shortDay("bozuk")).toBe("bozuk");
  });
  it("ne kadar önce", () => {
    const now = 1_000_000_000;
    expect(fmtAgo(now - 5_000, now)).toBe("az önce");
    expect(fmtAgo(now - 5 * 60_000, now)).toBe("5 dk önce");
    expect(fmtAgo(now - 3 * 3600_000, now)).toBe("3 sa önce");
    expect(fmtAgo(now - 2 * 86400_000, now)).toBe("2 g önce");
  });
  it("eşik düzeyi ve aşama adı", () => {
    expect(level(10, 50, 100)).toBe("ok");
    expect(level(50, 50, 100)).toBe("warn");
    expect(level(100, 50, 100)).toBe("bad");
    expect(phaseLabel("playing")).toBe("Oyunda");
    expect(phaseLabel("yeni")).toBe("yeni");
  });
});
