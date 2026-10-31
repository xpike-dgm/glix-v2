import { describe, expect, it } from "vitest";
import { parseBozukPrivateView, parseBozukPublicView, parseBozukView } from "./view.js";

const writeStep = { kind: "write", author: "a", text: "KEDİ UYUYOR" };
const drawStep = { kind: "draw", author: "b", strokes: [[0, 2, 0, 0, 10, 10]] };
const reveal = {
  chain: 0,
  chains: 3,
  starter: "a",
  stage: "vote",
  shown: 3,
  steps: [writeStep, drawStep],
  chainStartedAt: 1,
  stageEndsAt: 2,
  voted: ["a"],
  tally: null,
  robust: null,
};
const pub = {
  phase: "reveal",
  startedAt: 0,
  step: 3,
  steps: 3,
  stepStartedAt: null,
  stepEndsAt: null,
  players: ["a", "b", "c"],
  doneIds: [],
  reveal,
  scores: { a: 1, b: 0, c: 0 },
};
const priv = {
  role: null,
  prompt: null,
  text: null,
  strokes: {},
  pointsLeft: 0,
  done: false,
  myVote: null,
  myStep: null,
};

describe("Bozuk Telefon görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseBozukView(pub, priv);
    expect(v?.phase).toBe("reveal");
    expect(v?.reveal?.steps).toHaveLength(2);
    const second = v?.reveal?.steps[1];
    expect(second?.kind === "draw" && second.drawing.strokes).toEqual([[0, 2, 0, 0, 10, 10]]);
    expect(v?.scores).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("girdi aşaması: süreler, hazır olanlar ve önceki adım okunur", () => {
    const v = parseBozukView(
      {
        ...pub,
        phase: "draw",
        step: 1,
        stepStartedAt: 5,
        stepEndsAt: 65,
        doneIds: ["b"],
        reveal: null,
        scores: null,
      },
      { ...priv, role: "draw", prompt: { kind: "write", text: "KEDİ" }, pointsLeft: 1500 },
    );
    expect(v).toMatchObject({ phase: "draw", stepEndsAt: 65, doneIds: ["b"], role: "draw" });
    expect(v?.prompt).toEqual({ kind: "write", text: "KEDİ" });
    expect(v?.reveal).toBeNull();
  });

  it("önceki adım çizimse darbeleri ayrıştırılır; bozuk darbeler atlanır", () => {
    const p = parseBozukPrivateView({
      ...priv,
      role: "write",
      prompt: { kind: "draw", strokes: [[0, 2, 0, 0, 10, 10], "x", [9, 9]] },
    });
    expect(p?.prompt?.kind === "draw" && p.prompt.drawing.strokes).toHaveLength(1);
  });

  it("kendi darbeler numaraya göre sıralanır", () => {
    const p = parseBozukPrivateView({
      ...priv,
      role: "draw",
      strokes: { "10": [1, 1, 0, 0, 5, 5], "2": [0, 2, 1, 1, 2, 2], x: [0, 1, 0, 0, 1, 1] },
    });
    expect(p?.strokes.map((s) => s[0])).toEqual([0, 1]);
  });

  it("bozuk ortak görünümleri reddeder", () => {
    expect(parseBozukPublicView(null)).toBeNull();
    expect(parseBozukPublicView({ ...pub, phase: "x" })).toBeNull();
    expect(parseBozukPublicView({ ...pub, doneIds: [1] })).toBeNull();
    expect(parseBozukPublicView({ ...pub, scores: { a: "1" } })).toBeNull();
    expect(parseBozukPublicView({ ...pub, reveal: { ...reveal, stage: "x" } })).toBeNull();
    expect(parseBozukPublicView({ ...pub, reveal: { ...reveal, steps: [{ kind: "write" }] } })).toBeNull();
    expect(parseBozukPublicView({ ...pub, reveal: { ...reveal, tally: ["1"] } })).toBeNull();
    expect(parseBozukPublicView({ ...pub, stepEndsAt: "1" })).toBeNull();
  });

  it("bozuk kişisel görünümleri reddeder", () => {
    expect(parseBozukPrivateView(null)).toBeNull();
    expect(parseBozukPrivateView({ ...priv, role: "x" })).toBeNull();
    expect(parseBozukPrivateView({ ...priv, prompt: { kind: "write" } })).toBeNull();
    expect(parseBozukPrivateView({ ...priv, done: "x" })).toBeNull();
    expect(parseBozukPrivateView({ ...priv, myVote: "1" })).toBeNull();
    expect(parseBozukPrivateView({ ...priv, strokes: null })).toBeNull();
    expect(parseBozukView(pub, { ...priv, role: 3 })).toBeNull();
  });

  it("sonuç aşaması: oy dağılımı ve sağlam zincir bayrağı okunur", () => {
    const p = parseBozukPublicView({
      ...pub,
      reveal: { ...reveal, stage: "result", tally: [0, 2], robust: true },
    });
    expect(p?.reveal).toMatchObject({ stage: "result", tally: [0, 2], robust: true });
  });

  it("isimsiz gösteri/oylama: yazarı ve başlatanı null olan adımlar okunur; kendi adımın kişisel görünümde", () => {
    const v = parseBozukView(
      {
        ...pub,
        reveal: {
          ...reveal,
          starter: null,
          voteStartsAt: 1,
          crowned: null,
          steps: [
            { ...writeStep, author: null },
            { ...drawStep, author: null },
          ],
        },
      },
      { ...priv, myStep: 1 },
    );
    expect(v?.reveal?.starter).toBeNull();
    expect(v?.reveal?.steps.map((x) => x.author)).toEqual([null, null]);
    expect(v?.myStep).toBe(1);
    expect(parseBozukPrivateView({ ...priv, myStep: "1" })).toBeNull();
    expect(parseBozukPublicView({ ...pub, reveal: { ...reveal, starter: 5 } })).toBeNull();
    expect(
      parseBozukPublicView({ ...pub, reveal: { ...reveal, steps: [{ ...writeStep, author: 3 }] } }),
    ).toBeNull();
  });

  it("taçlar okunur; eski sunucuda oy dağılımından hesaplanır", () => {
    const withCrown = parseBozukPublicView({
      ...pub,
      reveal: { ...reveal, stage: "result", tally: [2, 2], robust: false, crowned: [0, 1] },
    });
    expect(withCrown?.reveal?.crowned).toEqual([0, 1]);
    const legacy = parseBozukPublicView({
      ...pub,
      reveal: { ...reveal, stage: "result", tally: [0, 3], robust: false },
    });
    expect(legacy?.reveal?.crowned).toEqual([1]);
    expect(parseBozukPublicView({ ...pub, reveal: { ...reveal, crowned: [-1] } })).toBeNull();
  });

  it("oyun sonu özeti (recap): yazarlı zincirler okunur; yazarsız adım ya da bozuk alan reddedilir", () => {
    const recap = [
      { chain: 0, starter: "a", steps: [writeStep, drawStep], tally: [0, 1], robust: false, crowned: [1] },
    ];
    const p = parseBozukPublicView({ ...pub, phase: "done", recap });
    expect(p?.recap?.[0]).toMatchObject({ chain: 0, starter: "a", crowned: [1], robust: false });
    expect(p?.recap?.[0]?.steps.map((x) => x.author)).toEqual(["a", "b"]);
    expect(parseBozukPublicView({ ...pub, recap: null })?.recap).toBeNull();
    expect(
      parseBozukPublicView({ ...pub, recap: [{ ...recap[0], steps: [{ ...writeStep, author: null }] }] }),
    ).toBeNull();
    expect(parseBozukPublicView({ ...pub, recap: [{ ...recap[0], tally: ["1"] }] })).toBeNull();
    expect(parseBozukPublicView({ ...pub, recap: "x" })).toBeNull();
  });

  it("10 renk ve çok kalın darbeler okunur", () => {
    const p = parseBozukPrivateView({
      ...priv,
      role: "draw",
      strokes: { "0": [7, 4, 0, 0, 5, 5], "1": [10, 1, 1, 1, 2, 2], "2": [11, 1, 0, 0, 1, 1] },
    });
    expect(p?.strokes).toEqual([
      [7, 4, 0, 0, 5, 5],
      [10, 1, 1, 1, 2, 2],
    ]);
  });
});
