import type { QuestView } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { parseServerMessage } from "./parse.js";
import {
  parseQuestsDone,
  parseQuestsState,
  questCountText,
  questDoneText,
  questProgressText,
} from "./questRules.js";

const wire = (v: unknown): string => JSON.stringify(v);

const quest = (over: Record<string, unknown> = {}) => ({
  id: "mac-3",
  text: "sunucu metni önemsiz",
  target: 3,
  progress: 1,
  reward: 30,
  done: false,
  ...over,
});
const state = (over: Record<string, unknown> = {}) => ({
  ok: true,
  enabled: true,
  quests: [quest(), quest({ id: "ilk3", target: 1, progress: 0, reward: 50 })],
  endsAt: 2_000_000,
  serverNow: 1_500_000,
  ...over,
});

describe("GET /api/quests ayrıştırma", () => {
  it("kapalıyken yalnız enabled:false kabul edilir", () => {
    expect(parseQuestsState({ ok: true, enabled: false }, 0)).toEqual({ enabled: false });
  });

  it("açıkken görevleri yerel havuz metniyle ve saat farkıyla döner", () => {
    const s = parseQuestsState(state(), 1_400_000);
    expect(s).toMatchObject({ enabled: true, endsAt: 2_000_000, clockOffset: 100_000 });
    if (s?.enabled) {
      expect(s.quests.map((q) => q.text)).toEqual(["3 maç bitir", "Bir maçta ilk 3'e gir"]);
      expect(s.quests[0]).toMatchObject({ target: 3, progress: 1, reward: 30, done: false });
    }
  });

  it("ilerleme hedefe kırpılır; hedefe varan görev tamam sayılır", () => {
    const s = parseQuestsState(state({ quests: [quest({ progress: 9 })] }), 0);
    expect(s?.enabled && s.quests[0]).toMatchObject({ progress: 3, done: true });
  });

  it("bozuk yanıtları atar", () => {
    const bad: unknown[] = [
      null,
      { ok: false },
      { ok: true },
      { ok: true, enabled: "evet" },
      state({ quests: [] }),
      state({ quests: [quest({ id: "bilinmeyen" })] }),
      state({ quests: [quest({ target: 0 })] }),
      state({ quests: [quest({ reward: -1 })] }),
      state({ quests: [quest({ progress: "1" })] }),
      state({ quests: [quest(), quest(), quest(), quest()] }),
      state({ endsAt: "yarın" }),
      state({ serverNow: -1 }),
    ];
    for (const b of bad) expect(parseQuestsState(b, 0)).toBeNull();
  });
});

describe("questsDone mesajı", () => {
  const msg = { type: "questsDone", quests: [{ id: "ilk3", text: "x", reward: 50 }], balance: 190 };

  it("geçerli mesaj ayrıştırılır; metin yerel havuzdan gelir", () => {
    expect(parseServerMessage(wire(msg))).toEqual({
      type: "questsDone",
      quests: [{ id: "ilk3", text: "Bir maçta ilk 3'e gir", reward: 50 }],
      balance: 190,
    });
  });

  it("bozuk mesajı atar", () => {
    for (const bad of [
      { ...msg, quests: [] },
      { ...msg, quests: [{ id: "yok", text: "x", reward: 50 }] },
      { ...msg, quests: [{ id: "ilk3", text: "x", reward: 0 }] },
      {
        ...msg,
        quests: [
          { id: "ilk3", text: "x", reward: 50 },
          { id: "ilk3", text: "x", reward: 50 },
        ],
      },
      { ...msg, balance: -5 },
      { ...msg, balance: "190" },
      { type: "questsDone" },
    ])
      expect(parseServerMessage(wire(bad))).toBeNull();
    expect(parseQuestsDone(null)).toBeNull();
  });

  it("metinler", () => {
    const one = parseQuestsDone(msg);
    const two = parseQuestsDone({
      ...msg,
      quests: [
        { id: "ilk3", text: "", reward: 50 },
        { id: "mac-3", text: "", reward: 30 },
      ],
    });
    expect(one && questDoneText(one)).toBe("Görev tamamlandı: +50 Glix");
    expect(two && questDoneText(two)).toBe("Görevler tamamlandı: +80 Glix");
  });
});

describe("kart metinleri", () => {
  it("sayaçlar", () => {
    const s = parseQuestsState(state({ quests: [quest({ progress: 3, done: true }), quest()] }), 0);
    if (!s?.enabled) throw new Error("durum");
    expect(questCountText(s.quests)).toBe("1/2");
    expect(questProgressText(s.quests[1] as QuestView)).toBe("1/3");
    expect(questProgressText({ ...(s.quests[1] as QuestView), target: 1 })).toBe("");
  });
});
