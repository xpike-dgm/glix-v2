import { ASIRI_YUKLEME_OUTRO_MS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { REVEAL_TIMELINE, revealSchedule } from "./timeline.js";

describe("Aşırı Yükleme sonuç zaman çizelgesi", () => {
  it("bütçe bugünkü sonuç süresinin içindedir", () => {
    expect(REVEAL_TIMELINE.budgetMs).toBeLessThan(ASIRI_YUKLEME_OUTRO_MS);
  });

  it("2-8 oyuncu, patlamalı ya da patlamasız: açılış bütçeye sığar", () => {
    for (let n = 2; n <= 8; n++) {
      for (const boom of [false, true]) {
        for (let ex = 0; ex <= (boom ? n : 0); ex++) {
          const flags = Array.from({ length: n }, (_, i) => i >= n - ex);
          const s = revealSchedule(flags, boom);
          expect(s.doneAt).toBeLessThanOrEqual(REVEAL_TIMELINE.budgetMs);
          expect(s.rowAt).toHaveLength(n);
        }
      }
    }
  });

  it("sıra: patlama sahnesi → toplam sayaç → satırlar tek tek → puan uçuşu", () => {
    const s = revealSchedule([false, false, true], true);
    expect(s.countAt).toBe(REVEAL_TIMELINE.boomMs);
    const first = s.rowAt[0] ?? 0;
    expect(first).toBeGreaterThanOrEqual(s.countAt + s.countMs);
    for (let i = 1; i < s.rowAt.length; i++) expect(s.rowAt[i]).toBeGreaterThan(s.rowAt[i - 1] ?? 0);
    expect(s.flyAt).toBeGreaterThan(s.rowAt[2] ?? 0);
  });

  it("patlama yoksa sayaç hemen başlar", () => {
    expect(revealSchedule([false, false], false).countAt).toBe(REVEAL_TIMELINE.leadMs);
  });

  it("patlayan satır daha ağır açılır", () => {
    const s = revealSchedule([false, false, true, true], true);
    const normal = (s.rowAt[1] ?? 0) - (s.rowAt[0] ?? 0);
    const heavy = s.flyAt - (s.rowAt[3] ?? 0);
    expect(heavy).toBeGreaterThan(normal);
  });

  it("bütçe uzarsa (sonuç süresi uzatılırsa) aralar en çok rowGapMs olur", () => {
    const s = revealSchedule([false, false, false], false, { ...REVEAL_TIMELINE, budgetMs: 60_000 });
    expect((s.rowAt[1] ?? 0) - (s.rowAt[0] ?? 0)).toBe(REVEAL_TIMELINE.rowGapMs);
  });
});
