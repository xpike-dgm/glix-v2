import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { tensionLevel } from "../ui/clockState.js";
import { gameEntry } from "./registry.js";

/** Süresi gizli oyunlar: kabuk saati çizilmez ve gerilim ritmi (kalan süreyi ele verir) çalmaz. */
const HIDDEN_TIME = ["kor-kronometre", "kor-bomba", "son-kisi", "asiri-yukleme", "zaman-bombasi-hafizasi"];

describe("saati gizli oyunlarda gerilim ritmi yok", () => {
  it("hepsi kayıtta noClock işaretli", () => {
    for (const id of HIDDEN_TIME) expect(gameEntry(id)?.noClock, id).toBe(true);
  });

  it("noClock olan oyunda gerilim düzeyi her zaman 0", () => {
    for (const id of HIDDEN_TIME) {
      const visible = !gameEntry(id)?.noClock;
      for (let now = 0; now <= 31_000; now += 1000)
        expect(tensionLevel({ startedAt: 0, endsAt: 30_000, urgency: true }, now, visible), id).toBe(0);
    }
  });

  it("çerçeve saate gerilimi yalnız noClock değilken bağlar", () => {
    const src = readFileSync(new URL("../ui/GameFrame.tsx", import.meta.url), "utf8");
    const uses = src.match(/<Clock\s[^>]*\/>/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toContain("tension={!props.noClock}");
  });
});
