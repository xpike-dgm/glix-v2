import { describe, expect, it } from "vitest";
import {
  dailyQuests,
  EMPTY_QUEST_FACTS,
  QUEST_POOL,
  QUEST_REWARD_BY_TIER,
  questDone,
  questProgress,
  questReward,
  top3Streak,
} from "./quests.js";

describe("günlük görev seçimi", () => {
  it("aynı hesap ve gün her zaman aynı üç görevi verir; sırası kolay, orta, zor", () => {
    const a = dailyQuests(7, 20_000);
    expect(dailyQuests(7, 20_000)).toEqual(a);
    expect(a.map((q) => q.tier)).toEqual(["kolay", "orta", "zor"]);
  });

  it("gün ve hesap değişince dağılım değişir; her görev bir gün görünür", () => {
    const seen = new Set<string>();
    for (let d = 0; d < 200; d++) for (const q of dailyQuests(3, d)) seen.add(q.id);
    expect(seen.size).toBe(QUEST_POOL.length);
    const sets = new Set<string>();
    for (let acc = 1; acc <= 50; acc++)
      sets.add(
        dailyQuests(acc, 20_000)
          .map((q) => q.id)
          .join(),
      );
    expect(sets.size).toBeGreaterThan(5);
  });

  it("havuz kimlikleri benzersiz; her kademede en az iki görev; ödül tek tablodan", () => {
    expect(new Set(QUEST_POOL.map((q) => q.id)).size).toBe(QUEST_POOL.length);
    for (const tier of ["kolay", "orta", "zor"] as const) {
      expect(QUEST_POOL.filter((q) => q.tier === tier).length).toBeGreaterThanOrEqual(2);
    }
    expect(QUEST_REWARD_BY_TIER).toEqual({ kolay: 30, orta: 50, zor: 80 });
    for (const q of QUEST_POOL) expect(questReward(q)).toBe(QUEST_REWARD_BY_TIER[q.tier]);
  });
});

describe("görev ilerlemesi", () => {
  const def = (id: string) => {
    const q = QUEST_POOL.find((x) => x.id === id);
    if (!q) throw new Error(id);
    return q;
  };

  it("sayaç hedefe kırpılır; hedefe varınca tamamdır", () => {
    const mac3 = def("mac-3");
    expect(questProgress(mac3, EMPTY_QUEST_FACTS)).toBe(0);
    expect(questProgress(mac3, { ...EMPTY_QUEST_FACTS, matches: 2 })).toBe(2);
    expect(questDone(mac3, { ...EMPTY_QUEST_FACTS, matches: 2 })).toBe(false);
    expect(questDone(mac3, { ...EMPTY_QUEST_FACTS, matches: 3 })).toBe(true);
    expect(questProgress(mac3, { ...EMPTY_QUEST_FACTS, matches: 9 })).toBe(3);
  });

  it("her görev kendi sayacına bakar", () => {
    expect(questDone(def("puan-10"), { ...EMPTY_QUEST_FACTS, bestScore: 10 })).toBe(true);
    expect(questDone(def("puan-10"), { ...EMPTY_QUEST_FACTS, bestScore: 9 })).toBe(false);
    expect(questDone(def("birinci"), { ...EMPTY_QUEST_FACTS, gameWins: 1 })).toBe(true);
    expect(questDone(def("farkli-5"), { ...EMPTY_QUEST_FACTS, distinctGames: 4 })).toBe(false);
    expect(questDone(def("rozet"), { ...EMPTY_QUEST_FACTS, badges: 1 })).toBe(true);
    expect(questDone(def("arkadas"), { ...EMPTY_QUEST_FACTS, friendMatches: 1 })).toBe(true);
    expect(questDone(def("ust-uste"), { ...EMPTY_QUEST_FACTS, top3Streak: 1 })).toBe(false);
  });

  it("art arda ilk 3 dizisi", () => {
    expect(top3Streak([])).toBe(0);
    expect(top3Streak([1, 2, 5, 3])).toBe(2);
    expect(top3Streak([4, 1, 4, 2, 4])).toBe(1);
    expect(top3Streak([3, 3, 1])).toBe(3);
  });
});
