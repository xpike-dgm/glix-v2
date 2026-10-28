import { describe, expect, it } from "vitest";
import {
  canSubmitAnswer,
  lafErrorText,
  myPoints,
  parseLafPrivateView,
  parseLafPublicView,
  parseLafView,
  rankedCards,
} from "./view.js";

const pub = {
  players: ["a", "b", "c"],
  phase: "write",
  index: null,
  total: 3,
  startedAt: 100,
  stageStartedAt: 100,
  stageEndsAt: 60_100,
  ready: [],
  voters: [],
  duel: null,
  reveal: null,
  history: [],
  scores: { a: 0, b: 0, c: 0 },
};
const priv = {
  tasks: [{ id: "q1", prompt: "Soru?", answer: null }],
  locked: false,
  myCard: null,
  myVote: null,
};
const cards = [
  { id: "k1", author: "a", text: "bir", voters: ["c"], points: 1, master: false },
  { id: "k2", author: "b", text: null, voters: [], points: 0, master: false },
  { id: "k3", author: "c", text: "üç", voters: ["a", "b"], points: 3, master: true },
];

describe("Laf Sokma görünümü", () => {
  it("yazma görünümünü okur", () => {
    const v = parseLafView(pub, priv);
    expect(v?.phase).toBe("write");
    expect(v?.tasks[0]?.prompt).toBe("Soru?");
    expect(v?.duel).toBeNull();
  });

  it("oylama görünümünü ve Cevap yok kartını okur", () => {
    const v = parseLafView(
      {
        ...pub,
        phase: "vote",
        index: 0,
        voters: ["c"],
        duel: {
          id: "q1",
          prompt: "Soru?",
          cards: [
            { id: "k1", text: "bir" },
            { id: "k2", text: null },
          ],
        },
      },
      { ...priv, tasks: [], myCard: "k1" },
    );
    expect(v?.duel?.cards[1]?.text).toBeNull();
    expect(v?.myCard).toBe("k1");
    expect(v?.voters).toEqual(["c"]);
  });

  it("açılış görünümünü okur", () => {
    const v = parseLafPublicView({
      ...pub,
      phase: "reveal",
      index: 0,
      reveal: { id: "q1", prompt: "S?", cards },
    });
    expect(v?.reveal?.cards[2]?.master).toBe(true);
    expect(myPoints(v?.reveal ?? null, "c")).toBe(3);
    expect(myPoints(v?.reveal ?? null, "zz")).toBeNull();
  });

  it("bozuk görünümleri reddeder", () => {
    expect(parseLafPublicView(null)).toBeNull();
    expect(parseLafPublicView({ ...pub, phase: "başka" })).toBeNull();
    expect(parseLafPublicView({ ...pub, history: [{ id: 3 }] })).toBeNull();
    expect(parseLafPublicView({ ...pub, duel: { id: "q1", prompt: "S", cards: [{ id: 1 }] } })).toBeNull();
    expect(parseLafPrivateView({ ...priv, tasks: [{ id: "q1" }] })).toBeNull();
    expect(parseLafPrivateView({ ...priv, locked: "evet" })).toBeNull();
    expect(parseLafView(pub, null)).toBeNull();
  });

  it("açılış sıralaması: çok puan üstte, eşitte kart sırası", () => {
    expect(rankedCards(cards).map((c) => c.id)).toEqual(["k3", "k1", "k2"]);
    expect(
      rankedCards([
        { ...cards[0], points: 1 },
        { ...cards[1], points: 1 },
      ] as never).map((c) => c.id),
    ).toEqual(["k1", "k2"]);
  });

  it("cevap denetimi: boş ve 80 karakter üstü olmaz; hata cümleleri teknik değil", () => {
    expect(canSubmitAnswer("   ")).toBe(false);
    expect(canSubmitAnswer("kısa")).toBe(true);
    expect(canSubmitAnswer("a".repeat(81))).toBe(false);
    expect(canSubmitAnswer("ş".repeat(80))).toBe(true);
    for (const r of ["inappropriate", "too_long", "empty", "invalid", "locked", "ended", "x", undefined]) {
      expect(lafErrorText(r)).not.toMatch(/inappropriate|rejected|server|error|_/i);
    }
  });
});
