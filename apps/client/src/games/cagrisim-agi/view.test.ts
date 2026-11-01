import type { CagrisimReveal } from "@glix/engine";
import { describe, expect, it } from "vitest";
import {
  canSubmit,
  chipList,
  currentReveal,
  guessGroup,
  headlineOf,
  isLongAnswer,
  lateHint,
  medalOf,
  miniLine,
  outcomeOf,
  parseCagrisimView,
  ringPlan,
  ringState,
  shortName,
  stampOf,
  wordScale,
} from "./view.js";

const reveal: CagrisimReveal = {
  groups: [
    { text: "mavi", members: ["a", "b", "e"], points: 3, variants: [] },
    { text: "dalga", members: ["f", "g"], points: 2, variants: ["dalgalar", "dalga"] },
  ],
  singles: [{ playerId: "c", text: "tuz" }],
  silent: ["d"],
};
const answerPub = {
  startedAt: 100,
  round: 0,
  rounds: 3,
  roundStartedAt: 100,
  answerEndsAt: 20_100,
  revealEndsAt: 24_100,
  endsAt: 76_100,
  word: "KAR",
  phase: "answer",
  answeredIds: ["a"],
  results: [],
  totals: { a: 0, b: 0 },
  awards: null,
};
const miniPub = { ...answerPub, phase: "mini", results: [{ word: "KAR", reveal }], totals: { a: 3 } };
const finalPub = {
  ...answerPub,
  round: 2,
  phase: "final",
  results: [
    { word: "KAR", reveal },
    { word: "DENİZ", reveal },
    { word: "VADİ", reveal },
  ],
  totals: { a: 9, f: 6 },
  awards: { a: 2, f: 1 },
};

describe("Çağrışım Ağı görünümü (doğrulama)", () => {
  it("cevap aşamasını okur; izleyicide kişisel görünüm boş olabilir", () => {
    const v = parseCagrisimView(answerPub, { myAnswer: "mavi" });
    expect(v?.word).toBe("KAR");
    expect(v?.myAnswer).toBe("mavi");
    expect(v && currentReveal(v)).toBeNull();
    expect(parseCagrisimView(answerPub, null)?.myAnswer).toBeNull();
  });
  it("mini ve büyük açılışı okur", () => {
    const m = parseCagrisimView(miniPub, { myAnswer: null });
    expect(m && currentReveal(m)?.groups[1]?.variants).toEqual(["dalgalar", "dalga"]);
    const f = parseCagrisimView(finalPub, { myAnswer: null });
    expect(f?.awards).toEqual({ a: 2, f: 1 });
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseCagrisimView({ ...answerPub, phase: "reveal" }, null)).toBeNull();
    expect(parseCagrisimView({ ...miniPub, results: [] }, null)).toBeNull();
    expect(parseCagrisimView({ ...finalPub, awards: null }, null)).toBeNull();
    expect(parseCagrisimView({ ...answerPub, round: 5 }, null)).toBeNull();
    expect(parseCagrisimView({ ...answerPub, totals: { a: "x" } }, null)).toBeNull();
    expect(parseCagrisimView(answerPub, { myAnswer: 4 })).toBeNull();
  });
});

describe("Çağrışım Ağı sunum yardımcıları", () => {
  it("oyuncunun durumu ve başlık (CG-U6)", () => {
    expect(outcomeOf(reveal, "b")).toMatchObject({ kind: "group", index: 0 });
    expect(outcomeOf(reveal, "c")).toEqual({ kind: "single", text: "tuz" });
    expect(outcomeOf(reveal, "d")).toEqual({ kind: "silent" });
    expect(outcomeOf(reveal, "x")).toBeNull();
    const g = outcomeOf(reveal, "a");
    if (!g) throw new Error("yok");
    expect(headlineOf(g).big).toBe("3 kişilik ağ");
    expect(headlineOf({ kind: "single", text: "tuz" }).big).toBe("Bu sefer tek kaldın");
    expect(headlineOf({ kind: "silent" }).big).toBe("Yazmadın");
  });
  it("madalya: +2 altın, +1 gümüş", () => {
    expect(medalOf({ a: 2, b: 1, c: 0 }, "a")).toBe("gold");
    expect(medalOf({ a: 2, b: 1, c: 0 }, "b")).toBe("silver");
    expect(medalOf({ a: 2, b: 1, c: 0 }, "c")).toBeNull();
    expect(medalOf(null, "a")).toBeNull();
  });
  it("damgalar (CG-U7): tek yürek ve kara koyun (4+ oyuncu)", () => {
    const one = (members: string[], singles: string[] = [], silent: string[] = []): CagrisimReveal => ({
      groups: [{ text: "mavi", members, points: members.length, variants: [] }],
      singles: singles.map((playerId) => ({ playerId, text: "ördek" })),
      silent,
    });
    expect(stampOf(one(["a", "b"]))).toEqual({ kind: "heart" });
    expect(stampOf(one(["a", "b", "c"], ["d"]))).toEqual({ kind: "sheep", playerId: "d" });
    expect(stampOf(one(["a", "b"], ["c"]))).toBeNull();
    expect(stampOf(one(["a", "b", "c"], [], ["d"]))).toBeNull();
    expect(stampOf(reveal)).toBeNull();
  });
  it("kısa isim (CG-U8) ve isim çipleri (CG-U4)", () => {
    expect(shortName("Elif", false)).toBe("Elif");
    expect(shortName("Ayşegül", false)).toBe("Ayşegül");
    expect(shortName("Muhammet", false)).toBe("Muhamm…");
    expect(shortName("Muhammet", true)).toBe("Sen");
    expect(chipList([1, 2, 3, 4, 5, 6], 4)).toEqual({ shown: [1, 2, 3, 4], more: 2 });
    expect(miniLine(reveal)).toBe("mavi (3) · dalga (2)");
    expect(miniLine({ groups: [], singles: [], silent: [] })).toBeNull();
  });
  it("uzun cevap uyarısı (CG-U9) ve son 5 sn uyarısı (CG-U15)", () => {
    expect(isLongAnswer("mavi")).toBe(false);
    expect(isLongAnswer("denizde yüzen beyaz yelkenli")).toBe(true);
    expect(isLongAnswer("x".repeat(21))).toBe(true);
    expect(lateHint("", 4_000, false)).toBe("empty");
    expect(lateHint("mav", 4_000, false)).toBe("unsent");
    expect(lateHint("", 6_000, false)).toBeNull();
    expect(lateHint("", 4_000, true)).toBeNull();
    expect(lateHint("", 0, false)).toBeNull();
  });
  it("küre sayacı (CG-U2): kalan oran, saniye, son 5 sn", () => {
    expect(ringState(0, 0, 20_000)).toEqual({ left: 1, secs: 20, urgent: false });
    expect(ringState(16_500, 0, 20_000)).toEqual({ left: 0.175, secs: 4, urgent: true });
    expect(ringState(21_000, 0, 20_000)).toEqual({ left: 0, secs: 0, urgent: false });
  });
  it("izleyici denemesi (CG-U12) aynı eşleşme kurallarıyla ağ bulur", () => {
    expect(guessGroup(reveal, "MAVİ")?.text).toBe("mavi");
    expect(guessGroup(reveal, "dalgalar")?.text).toBe("dalga");
    expect(guessGroup(reveal, "ördek")).toBeNull();
  });
  it("ağ halkası sırası (CG-U5): ters kartlar, tek kalanlar, yazmayanlar, ağlar küçükten büyüğe", () => {
    const plan = ringPlan(reveal);
    expect(plan.flipAt.c).toBe(1);
    expect(plan.flipAt.d).toBe(2);
    expect(plan.groupStep).toEqual([4, 3]);
    expect(plan.flipAt.a).toBe(4);
    expect(plan.champion).toBe(0);
    expect(plan.steps).toBe(5);
    expect(ringPlan({ groups: [], singles: [], silent: [] })).toMatchObject({ steps: 1, champion: null });
  });
  it("gönderilebilirlik ve kelime boyu", () => {
    expect(canSubmit("  ")).toBe(false);
    expect(canSubmit(" a ")).toBe(true);
    expect(wordScale("AY")).toBeGreaterThan(wordScale("GÖKKUŞAĞI"));
  });
});
