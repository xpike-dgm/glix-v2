import { describe, expect, it } from "vitest";
import { canSubmit, outcomeOf, parseCagrisimView, revealPlan, wordScale } from "./view.js";

const answerPub = {
  startedAt: 100,
  answerEndsAt: 30_100,
  endsAt: 36_100,
  word: "DENİZ",
  phase: "answer",
  answeredIds: ["a"],
  reveal: null,
};
const revealPub = {
  ...answerPub,
  phase: "reveal",
  reveal: {
    groups: [{ text: "mavi", members: ["a", "b"], points: 2 }],
    singles: [{ playerId: "c", text: "tuz" }],
    silent: ["d"],
  },
};
const priv = { myAnswer: null };

describe("Çağrışım Ağı görünümü", () => {
  it("cevap aşaması görünümünü okur", () => {
    const v = parseCagrisimView(answerPub, { myAnswer: "mavi" });
    expect(v?.word).toBe("DENİZ");
    expect(v?.myAnswer).toBe("mavi");
    expect(v?.reveal).toBeNull();
  });
  it("açılış aşamasını okur ve oyuncunun durumunu bulur", () => {
    const v = parseCagrisimView(revealPub, priv);
    const reveal = v?.reveal;
    if (!reveal) throw new Error("açılış yok");
    expect(outcomeOf(reveal, "b")).toMatchObject({ kind: "group", index: 0 });
    expect(outcomeOf(reveal, "c")).toEqual({ kind: "single", text: "tuz" });
    expect(outcomeOf(reveal, "d")).toEqual({ kind: "silent" });
    expect(outcomeOf(reveal, "x")).toBeNull();
  });
  it("izleyicide cevap null olabilir", () => {
    expect(parseCagrisimView(answerPub, priv)?.myAnswer).toBeNull();
  });
  it("bozuk görünümü reddeder", () => {
    expect(parseCagrisimView(null, priv)).toBeNull();
    expect(parseCagrisimView(answerPub, null)).toBeNull();
    expect(parseCagrisimView(answerPub, { myAnswer: 5 })).toBeNull();
    expect(parseCagrisimView({ ...answerPub, word: 3 }, priv)).toBeNull();
    expect(parseCagrisimView({ ...answerPub, phase: "x" }, priv)).toBeNull();
    expect(parseCagrisimView({ ...answerPub, answeredIds: [1] }, priv)).toBeNull();
    expect(parseCagrisimView({ ...revealPub, reveal: null }, priv)).toBeNull();
    expect(parseCagrisimView({ ...revealPub, reveal: { groups: [], singles: [] } }, priv)).toBeNull();
    expect(
      parseCagrisimView(
        {
          ...revealPub,
          reveal: { groups: [{ text: "x", members: ["a"], points: 1 }], singles: [], silent: [] },
        },
        priv,
      ),
    ).toBeNull();
  });
  it("cevap aşamasında gelen açılış verisi yok sayılır", () => {
    expect(parseCagrisimView({ ...answerPub, reveal: revealPub.reveal }, priv)?.reveal).toBeNull();
  });
  it("boş ve yalnız boşluk gönderilemez", () => {
    expect(canSubmit("")).toBe(false);
    expect(canSubmit("  \t ")).toBe(false);
    expect(canSubmit(" a ")).toBe(true);
  });
  it("uzun kelimeler daha küçük yazılır ve sığar", () => {
    expect(wordScale("AY")).toBe(22);
    expect(wordScale("DENİZ")).toBeGreaterThan(wordScale("GÖKKUŞAĞI"));
    // 12 harflik kelime: genişlik yaklaşık 0,9 em/harf, dairenin %70'ini aşmaz.
    expect(wordScale("A".repeat(12)) * 12 * 0.9).toBeLessThanOrEqual(70);
    expect(wordScale("")).toBe(22);
  });
  it("sıralı açılış: önce tek kalanlar, sonra kümeler küçükten büyüğe; en büyük en son", () => {
    const reveal = {
      groups: [
        { text: "mavi", members: ["a", "b", "c"], points: 3 },
        { text: "tatil", members: ["d", "e"], points: 2 },
        { text: "kum", members: ["f", "g"], points: 2 },
      ],
      singles: [{ playerId: "h", text: "ördek" }],
      silent: [],
    };
    const plan = revealPlan(reveal);
    expect(plan.loneStep).toBe(0);
    expect(plan.groupStep).toEqual([3, 1, 2]);
    expect(plan.steps).toBe(4);
    expect(plan.champion).toBe(0);
  });
  it("sıralı açılış: tek kalan yoksa küme 0'dan başlar; küme yoksa yalnız blok", () => {
    const plan = revealPlan({
      groups: [{ text: "a", members: ["x", "y"], points: 2 }],
      singles: [],
      silent: [],
    });
    expect(plan).toEqual({ groupStep: [0], loneStep: null, steps: 1, champion: 0 });
    const none = revealPlan({ groups: [], singles: [{ playerId: "x", text: "t" }], silent: ["y"] });
    expect(none).toEqual({ groupStep: [], loneStep: 0, steps: 1, champion: null });
  });
});
