import { gizliKareler, type KarelerPublicView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { karelerBriefing } from "./briefing.js";
import {
  bonusLine,
  bonusOutcome,
  cellAt,
  cellCard,
  cellCrowd,
  cellName,
  flipPlan,
  ghostHits,
  ghostsByCell,
  groupByCell,
  hintText,
  parseHint,
  parseKarelerView,
  pointsOf,
  screenPhase,
  shortName,
  stageHead,
  statusOf,
  summaryRows,
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
  bonus: null,
  ready: [],
};
const priv = { myChoice: 4, locked: false, compass: null };
const reveal1 = {
  choices: { a: 0, b: 0, c: 5, d: null },
  status: { a: "clash", b: "clash", c: "solo", d: "passive" },
} as const;

describe("Gizli Kareler görünümü", () => {
  it("1. aşama seçim görünümünü okur", () => {
    expect(parseKarelerView(base, priv)).toMatchObject({ size: 3, myChoice: 4, stage1: null });
    expect(parseKarelerView({ ...base, size: 4 }, { myChoice: 15, locked: false })?.myChoice).toBe(15);
    expect(parseKarelerView(base, { myChoice: null, locked: false })?.myChoice).toBeNull();
  });

  it("kilit bilgisini okur ve bozuğunu reddeder", () => {
    expect(parseKarelerView({ ...base, ready: ["a", "b"] }, { myChoice: 4, locked: true })).toMatchObject({
      ready: ["a", "b"],
      locked: true,
    });
    expect(parseKarelerView({ ...base, ready: undefined }, priv)).toBeNull();
    expect(parseKarelerView({ ...base, ready: [1] }, priv)).toBeNull();
    expect(parseKarelerView(base, { myChoice: 4 })).toBeNull();
    expect(parseKarelerView(base, { myChoice: 4, locked: "x" })).toBeNull();
  });

  it("açılmış sonucu okur", () => {
    const pub = {
      ...base,
      stage1: reveal1,
      stage2: { startsAt: 25_000, endsAt: 45_000, players: ["c"], ghosts: ["a", "b", "d"] },
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
    expect(parseKarelerView(base, { myChoice: 9, locked: false })).toBeNull();
    expect(parseKarelerView({ ...base, size: 4 }, { myChoice: 16, locked: false })).toBeNull();
    expect(parseKarelerView(base, { myChoice: 1.5, locked: false })).toBeNull();
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
    expect(bad({ stage1: reveal1, points: { a: 5 } })).toBeNull();
    // 1. aşama açılmadan sonraki aşama bilgisi olamaz.
    expect(bad({ points: { a: 0 } })).toBeNull();
    expect(bad({ stage2: { startsAt: 1, endsAt: 2, players: [] } })).toBeNull();
    expect(bad({ stage1: reveal1, stage2Reveal: reveal1 })).toBeNull();
  });

  it("ödül karesini okur; sonuçtan önce gelirse ya da bozuksa reddeder", () => {
    const stage2 = { startsAt: 25_000, endsAt: 45_000, players: ["c", "e"], ghosts: ["a", "b", "d"] };
    const done = {
      ...base,
      stage1: reveal1,
      stage2,
      stage2Reveal: {
        choices: { c: 4, e: 6 },
        status: { c: "solo", e: "solo" },
        ghosts: { a: null, b: 2, d: null },
        compass: { c: { kind: "corner" }, e: { kind: "notRow", row: 0 } },
      },
      finishesAt: 50_000,
      points: { a: 0, b: 0, c: 4, d: 0 },
    };
    expect(parseKarelerView({ ...done, bonus: { cell: 4, winner: "c" } }, priv)?.bonus).toEqual({
      cell: 4,
      winner: "c",
    });
    expect(parseKarelerView({ ...done, bonus: { cell: 4, winner: null } }, priv)?.bonus?.winner).toBeNull();
    expect(parseKarelerView(done, priv)?.bonus).toBeNull();
    // 2. aşama sonucu açılmadan ödül karesi olamaz.
    expect(parseKarelerView({ ...base, bonus: { cell: 4, winner: null } }, priv)).toBeNull();
    expect(
      parseKarelerView({ ...done, stage2Reveal: null, bonus: { cell: 4, winner: null } }, priv),
    ).toBeNull();
    // Izgara dışı hücre ya da bozuk kazanan.
    expect(parseKarelerView({ ...done, bonus: { cell: 9, winner: null } }, priv)).toBeNull();
    expect(parseKarelerView({ ...done, bonus: { cell: 4, winner: 3 } }, priv)).toBeNull();
    expect(parseKarelerView({ ...done, bonus: "x" }, priv)).toBeNull();
  });

  it("ekran aşaması: seçim, 1. sonuç, 2. seçim, son sonuç", () => {
    const stage2 = { startsAt: 25_000, endsAt: 45_000, players: ["c"], ghosts: ["a", "b", "d"] };
    const open = { ...base, stage1: reveal1, stage2, points: { a: 0, b: 0, c: 1, d: 0 } };
    expect(screenPhase(base, 5_000)).toBe("choose1");
    expect(screenPhase(base, 30_000)).toBe("choose1"); // sonuç henüz gelmedi
    expect(screenPhase(open, 21_500)).toBe("reveal1");
    expect(screenPhase(open, 23_999)).toBe("reveal1");
    expect(screenPhase(open, 25_000)).toBe("choose2");
    expect(screenPhase(open, 24_000)).toBe("band"); // GK-U5: 2. aşamadan önceki 1 sn
    expect(screenPhase({ ...open, stage2Reveal: { ...reveal1, ghosts: {}, compass: {} } }, 45_100)).toBe(
      "reveal2",
    );
    // Oyun 1. aşamada bitiyorsa 2. aşama yoktur.
    expect(screenPhase({ ...base, stage1: reveal1 }, 40_000)).toBe("reveal1");
  });

  it("hücre adları ve gruplama", () => {
    // GK-U1: sütun harfi + satır numarası.
    expect([0, 2, 3, 8].map((c) => cellName(c, 3))).toEqual(["A1", "C1", "A2", "C3"]);
    expect([0, 5, 14, 15].map((c) => cellName(c, 4))).toEqual(["A1", "B2", "C4", "D4"]);
    expect([0, 4, 9, 13].map((c) => cellAt(c, 4))).toEqual(["A1'de", "A2'de", "B3'te", "B4'te"]);
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
    expect([1, 2, 4].map(whoColumns)).toEqual([1, 2, 2]);
  });

  it("2. aşama sonucu: hayaletler ve pusulalar okunur; bozuk olan reddedilir", () => {
    const stage2 = { startsAt: 25_000, endsAt: 45_000, players: ["c"], ghosts: ["a", "b", "d"] };
    const r2 = {
      choices: { c: 4 },
      status: { c: "haunted" },
      ghosts: { a: 4, b: null, d: 1 },
      compass: { c: { kind: "corner" } },
    };
    const pub = {
      ...base,
      stage1: reveal1,
      stage2,
      stage2Reveal: r2,
      finishesAt: 53_000,
      points: { a: 0, b: 0, c: 1, d: 0 },
    };
    expect(parseKarelerView(pub, priv)?.stage2Reveal?.ghosts).toEqual({ a: 4, b: null, d: 1 });
    const bad = (patch: object) => parseKarelerView({ ...pub, stage2Reveal: { ...r2, ...patch } }, priv);
    expect(bad({ ghosts: { a: 9 } })).toBeNull();
    expect(bad({ ghosts: { c: 1 } })).toBeNull(); // yarışan hayalet olamaz
    expect(bad({ compass: { c: { kind: "inner" } } })).toBeNull(); // 3×3'te "içeride" yok
    expect(bad({ compass: { a: { kind: "corner" } } })).toBeNull(); // hayaletin pusulası olmaz
    expect(bad({ ghosts: undefined })).toBeNull();
    // 1. aşamada "haunted" olamaz.
    expect(
      parseKarelerView(
        { ...base, stage1: { ...reveal1, status: { ...reveal1.status, c: "haunted" } } },
        priv,
      ),
    ).toBeNull();
    // Stage2 hayalet listesi zorunlu.
    expect(parseKarelerView({ ...pub, stage2: { startsAt: 1, endsAt: 2, players: ["c"] } }, priv)).toBeNull();
  });

  it("pusula: kişisel görünümde okunur; ızgaraya uymayan reddedilir; yazısı Türkçe", () => {
    expect(parseKarelerView(base, { ...priv, compass: { kind: "notCol", col: 1 } })?.compass).toEqual({
      kind: "notCol",
      col: 1,
    });
    expect(parseKarelerView(base, { ...priv, compass: { kind: "notCol", col: 3 } })).toBeNull();
    expect(parseKarelerView(base, { ...priv, compass: { kind: "half", side: "top" } })).toBeNull();
    expect(parseHint({ kind: "half", side: "left" }, 4)).toEqual({ kind: "half", side: "left" });
    expect(parseHint({ kind: "half", side: "orta" }, 4)).toBeNull();
    expect(hintText({ kind: "notRow", row: 1 })).toBe("2. satırda değil");
    expect(hintText({ kind: "notCol", col: 2 })).toBe("C sütununda değil");
    expect(hintText({ kind: "notCorner" })).toBe("köşede değil");
    expect(hintText({ kind: "half", side: "top" })).toBe("üst yarıda");
  });

  it("GK-U6: kareler sırayla döner: boşlar, tek kalanlar, çakışmalar, en son kendi karen", () => {
    const groups = new Map([
      [0, ["a", "b"]],
      [4, ["me"]],
      [5, ["c"]],
    ]);
    const { at, end } = flipPlan(3, groups, 4);
    const t = (c: number) => at.get(c) ?? -1;
    const empties = [1, 2, 3, 6, 7, 8];
    for (const e of empties) expect(t(e)).toBeLessThan(t(5));
    expect(t(5)).toBeLessThan(t(0));
    expect(t(0)).toBeLessThan(t(4));
    expect(end).toBeGreaterThan(t(4));
    expect(at.size).toBe(9);
  });

  it("GK-U8: başlık aşama sonucunu söyler, toplamı söylemez", () => {
    const base0 = {
      final: false,
      status: "solo" as const,
      cell: 9,
      size: 4,
      mates: [],
      walkover: false,
      wonBonus: false,
      ghost: false,
      ghostHits: [],
      ghostPicked: false,
      spectator: false,
      soloCount: 3,
    };
    expect(stageHead(base0).text).toBe("Tek kaldın · +1");
    expect(stageHead({ ...base0, final: true, wonBonus: true }).text).toBe("Ödül karesi! +1 +2");
    expect(stageHead({ ...base0, status: "clash", mates: ["Elif"] }).text).toBe("B3'te çakıştın · Elif");
    expect(stageHead({ ...base0, status: "clash", mates: ["Elif", "Mert", "Kaan"] }).text).toBe(
      "B3'te çakıştın · 3 kişiyle",
    );
    // 2. aşamada çakışan sakin bir başlık görür (kırmızı "Elendin" değil).
    const c2 = stageHead({ ...base0, final: true, status: "clash", mates: ["Elif"] });
    expect(c2).toEqual({ text: "2. aşamada çakıştın · Elif", kind: "calm" });
    expect(stageHead({ ...base0, final: true, status: "haunted" }).text).toBe("B3'te hayalete çarptın");
    expect(
      stageHead({ ...base0, ghost: true, status: null, ghostPicked: true, ghostHits: ["Mert"] }).text,
    ).toBe("Hayaletin düşürdü: Mert");
    expect(stageHead({ ...base0, spectator: true }).text).toBe("3 kişi tek kaldı");
    for (const k of [base0, { ...base0, walkover: true }])
      expect(stageHead(k).text).not.toMatch(/Toplam|Elendin/);
  });

  it("GK-U7: ödül anı sonuçları", () => {
    const g = new Map([
      [3, ["a", "b"]],
      [5, ["c"]],
    ]);
    const gh = new Map([[5, ["x"]]]);
    expect(bonusOutcome({ cell: 7, winner: "d" }, g, gh)).toBe("win");
    expect(bonusOutcome({ cell: 3, winner: null }, g, gh)).toBe("clash");
    expect(bonusOutcome({ cell: 5, winner: null }, g, gh)).toBe("haunted");
    expect(bonusOutcome({ cell: 1, winner: null }, g, gh)).toBe("none");
    expect(bonusLine("win", "Elif", false)).toEqual({ title: "ÖDÜL KARESİ!", sub: "Elif +2" });
    expect(bonusLine("clash", null, true).sub).toBe("Ödülde çakıştınız: ödül yok");
    expect(bonusLine("none", null, false).sub).toBe("Ödül karesini kimse bulamadı");
  });

  it("GK-U9: özet tablosu toplamı en yüksek olanı en üste koyar", () => {
    const stage2 = { startsAt: 25_000, endsAt: 45_000, players: ["c"], ghosts: ["a", "b", "d"] };
    const pub = {
      ...base,
      stage1: reveal1,
      stage2,
      stage2Reveal: {
        choices: { c: 4 },
        status: { c: "solo" as const },
        ghosts: { a: 1, b: null, d: null },
        compass: {},
      },
      bonus: { cell: 4, winner: "c" },
      points: { a: 0, b: 0, c: 4, d: 0 },
    };
    const rows = summaryRows(pub, ["a", "b", "c", "d"]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b", "d"]);
    expect(rows[0]).toEqual({ id: "c", s1: "solo", s2: "solo", bonus: true, total: 4 });
    expect(rows[1]?.s2).toBe("ghost");
    expect(rows[3]?.s1).toBe("passive");
  });

  it("GK-U11: hücre kartı, kalabalık hücre ve kısa ad", () => {
    expect(cellCard(6, 4, ["Elif", "Mert"], [], false)).toBe("C2 · Elif, Mert · çakıştı");
    expect(cellCard(0, 3, ["Elif"], ["Kaan"], false)).toBe("A1 · Elif · hayalete çarptı · hayalet: Kaan");
    expect(cellCard(0, 3, [], [], true)).toBe("A1 · boş · ödül karesi");
    expect(cellCrowd(["a", "b", "c", "d"])).toEqual({ shown: ["a", "b", "c", "d"], more: 0 });
    expect(cellCrowd(["a", "b", "c", "d", "e", "f"])).toEqual({ shown: ["a", "b", "c"], more: 3 });
    expect(shortName("Zeynep")).toBe("Zeynep");
    expect(shortName("Abdurrahman")).toBe("Abdur.");
  });

  it("hayalet yardımcıları", () => {
    const r2 = {
      choices: { c: 4, e: 5 },
      status: { c: "haunted" as const, e: "solo" as const },
      ghosts: { a: 4, b: null },
      compass: {},
    };
    expect(ghostsByCell(r2).get(4)).toEqual(["a"]);
    expect(ghostHits(r2, "a")).toEqual(["c"]);
    expect(ghostHits(r2, "b")).toEqual([]);
  });

  it("GK-U17: anlatım ızgarayı oyuncu sayısına göre söyler", () => {
    const steps = ["Gizlice bir kare seç (2–4 kişide 3×3, 5–8 kişide 4×4). Seçmezsen pasif kalırsın.", "x"];
    expect(karelerBriefing(steps, 3)[0]).toBe(
      "Gizlice bir kare seç (bu oyunda 3×3). Seçmezsen pasif kalırsın.",
    );
    expect(karelerBriefing(steps, 6)[0]).toContain("bu oyunda 4×4");
    expect(karelerBriefing(steps, 6)[1]).toBe("x");
    // Motorun anlatım maddesi bu kalıbı taşır (değişirse istemci yer değiştiremez).
    expect(karelerBriefing(gizliKareler.briefing.steps, 2)[0]).toContain("(bu oyunda 3×3)");
  });
});
