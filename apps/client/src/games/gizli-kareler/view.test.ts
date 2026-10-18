import type { KarelerPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  cellName,
  groupByCell,
  parseKarelerView,
  pointsOf,
  screenPhase,
  statusOf,
  whoColumns,
} from "./view.js";

const base: KarelerPublicView = {
  size: 3,
  startedAt: 1_000,
  endsAt: 21_000,
  stage2: null,
  stage1: null,
  stage2Reveal: null,
  finishesAt: null,
  walkover: null,
  points: null,
};
const priv = { myChoice: 4 };
const reveal1 = {
  choices: { a: 0, b: 0, c: 5, d: null },
  status: { a: "clash", b: "clash", c: "solo", d: "passive" },
} as const;

describe("Gizli Kareler görünümü", () => {
  it("1. aşama seçim görünümünü okur", () => {
    expect(parseKarelerView(base, priv)).toMatchObject({ size: 3, myChoice: 4, stage1: null });
    expect(parseKarelerView({ ...base, size: 4 }, { myChoice: 15 })?.myChoice).toBe(15);
    expect(parseKarelerView(base, { myChoice: null })?.myChoice).toBeNull();
  });

  it("açılmış sonucu okur", () => {
    const pub = {
      ...base,
      stage1: reveal1,
      stage2: { startsAt: 25_000, endsAt: 45_000, players: ["c"] },
      finishesAt: 50_000,
      points: { a: 0, b: 0, c: 1, d: 0 },
    };
    expect(parseKarelerView(pub, priv)?.stage1).toEqual(reveal1);
  });

  it("bozuk görünümü reddeder", () => {
    expect(parseKarelerView(null, priv)).toBeNull();
    expect(parseKarelerView(base, null)).toBeNull();
    expect(parseKarelerView({ ...base, size: 5 }, priv)).toBeNull();
    expect(parseKarelerView({ ...base, startedAt: "x" }, priv)).toBeNull();
    expect(parseKarelerView({ ...base, finishesAt: "x" }, priv)).toBeNull();
    expect(parseKarelerView({ ...base, walkover: 3 }, priv)).toBeNull();
    // Hücre numarası ızgara dışında.
    expect(parseKarelerView(base, { myChoice: 9 })).toBeNull();
    expect(parseKarelerView({ ...base, size: 4 }, { myChoice: 16 })).toBeNull();
    expect(parseKarelerView(base, { myChoice: 1.5 })).toBeNull();
    expect(parseKarelerView(base, {})).toBeNull();
    const bad = (patch: object) => parseKarelerView({ ...base, ...patch }, priv);
    expect(bad({ stage1: { ...reveal1, choices: { ...reveal1.choices, a: 9 } } })).toBeNull();
    expect(bad({ stage1: { ...reveal1, status: { ...reveal1.status, a: "yok" } } })).toBeNull();
    // Seçmeyen pasif olmalı, seçen pasif olamaz.
    expect(bad({ stage1: { ...reveal1, status: { ...reveal1.status, d: "solo" } } })).toBeNull();
    expect(bad({ stage1: { ...reveal1, status: { ...reveal1.status, a: "passive" } } })).toBeNull();
    expect(bad({ stage1: { ...reveal1, status: { a: "clash" } } })).toBeNull();
    expect(bad({ stage1: 3 })).toBeNull();
    expect(bad({ stage2: { startsAt: 1, endsAt: 2, players: [1] } })).toBeNull();
    expect(bad({ stage1: reveal1, points: { a: 3 } })).toBeNull();
    // 1. aşama açılmadan sonraki aşama bilgisi olamaz.
    expect(bad({ points: { a: 0 } })).toBeNull();
    expect(bad({ stage2: { startsAt: 1, endsAt: 2, players: [] } })).toBeNull();
    expect(bad({ stage1: reveal1, stage2Reveal: reveal1 })).toBeNull();
  });

  it("ekran aşaması: seçim, 1. sonuç, 2. seçim, son sonuç", () => {
    const stage2 = { startsAt: 25_000, endsAt: 45_000, players: ["c"] };
    const open = { ...base, stage1: reveal1, stage2, points: { a: 0, b: 0, c: 1, d: 0 } };
    expect(screenPhase(base, 5_000)).toBe("choose1");
    expect(screenPhase(base, 30_000)).toBe("choose1"); // sonuç henüz gelmedi
    expect(screenPhase(open, 21_500)).toBe("reveal1");
    expect(screenPhase(open, 24_999)).toBe("reveal1");
    expect(screenPhase(open, 25_000)).toBe("choose2");
    expect(screenPhase({ ...open, stage2Reveal: reveal1 }, 45_100)).toBe("reveal2");
    // Oyun 1. aşamada bitiyorsa 2. aşama yoktur.
    expect(screenPhase({ ...base, stage1: reveal1 }, 40_000)).toBe("reveal1");
  });

  it("hücre adları ve gruplama", () => {
    expect([0, 2, 3, 8].map((c) => cellName(c, 3))).toEqual(["A1", "A3", "B1", "C3"]);
    expect([0, 5, 15].map((c) => cellName(c, 4))).toEqual(["A1", "B2", "D4"]);
    const g = groupByCell(reveal1);
    expect(g.get(0)).toEqual(["a", "b"]);
    expect(g.get(5)).toEqual(["c"]);
    expect([...g.values()].flat()).not.toContain("d");
  });

  it("durum, puan ve avatar sütunları", () => {
    expect(statusOf(reveal1, "c")).toBe("solo");
    expect(statusOf(reveal1, "zzz")).toBeNull();
    expect(statusOf(null, "c")).toBeNull();
    expect(pointsOf({ ...base, points: { a: 2 } }, "a")).toBe(2);
    expect(pointsOf(base, "a")).toBe(0);
    expect([1, 2, 4, 5, 8].map(whoColumns)).toEqual([1, 2, 2, 3, 3]);
  });
});
