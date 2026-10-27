import { describe, expect, it } from "vitest";
import { collectPublicTexts, EVIDENCE_MAX_TEXTS, EVIDENCE_TEXT_MAX, evidenceGames } from "./evidence.js";

describe("bildirim kanıtı: yalnız herkese açık metin", () => {
  it("laf-sokma: açılmış kartlar (geçmiş + son açılış); açılmamış düello kartları ve başkası alınmaz", () => {
    const view = {
      duel: { id: "q9", prompt: "?", cards: [{ id: "k1", text: "henüz açılmamış cevap" }] },
      reveal: { id: "final", prompt: "?", cards: [{ id: "k2", author: "a", text: "son cevap", voters: [] }] },
      history: [
        {
          id: "q1",
          prompt: "?",
          cards: [
            { id: "k3", author: "a", text: "eski cevap" },
            { id: "k4", author: "b", text: "b'nin cevabı" },
            { id: "k5", author: "a", text: null },
          ],
        },
      ],
    };
    expect(collectPublicTexts("laf-sokma", view, ["a", "b", "c"])).toEqual({
      a: ["eski cevap", "son cevap"],
      b: ["b'nin cevabı"],
    });
  });

  it("sozluk-blofu: yalnız açılışta sahibi belli kartlar; gerçek kart ve açılmamış kartlar alınmaz", () => {
    const cards = [
      { id: "k1", text: "gerçek tanım" },
      { id: "k2", text: "a'nın blöfü" },
      { id: "k3", text: "b'nin blöfü" },
    ];
    const hidden = { cards, reveal: null };
    expect(collectPublicTexts("sozluk-blofu", hidden, ["a", "b"])).toEqual({});
    const shown = { cards, reveal: { realCard: "k1", authors: { k2: "a", k3: "b" }, picks: {}, scores: {} } };
    expect(collectPublicTexts("sozluk-blofu", shown, ["a", "b", "c"])).toEqual({
      a: ["a'nın blöfü"],
      b: ["b'nin blöfü"],
    });
  });

  it("kendim: yalnız açılmış kartın sahibi", () => {
    const view = {
      owners: ["a", "b"],
      reveal: {
        cards: [
          { id: 0, text: "ELMA", owner: "a" },
          { id: 1, text: "ARMUT", owner: "b" },
        ],
      },
    };
    expect(collectPublicTexts("kendim", view, ["a"])).toEqual({ a: ["ELMA"] });
    expect(collectPublicTexts("kendim", { owners: ["a"], reveal: null }, ["a"])).toEqual({});
  });

  it("yazi-yaz: yalnız yazan olarak açılan kelime", () => {
    const view = { reveal: { writers: ["a", "b"], words: { a: "KEDİ", b: "" }, guesses: {} } };
    expect(collectPublicTexts("yazi-yaz", view, ["a", "b", "c"])).toEqual({ a: ["KEDİ"] });
    expect(collectPublicTexts("yazi-yaz", { reveal: null }, ["a"])).toEqual({});
  });

  it("cagrisim-agi: grup ve tek cevaplar", () => {
    const view = {
      reveal: {
        groups: [{ text: "DENİZ", members: ["a", "b"], points: 2 }],
        singles: [{ playerId: "c", text: "ÇÖL" }],
        silent: ["d"],
      },
    };
    expect(collectPublicTexts("cagrisim-agi", view, ["a", "c", "d"])).toEqual({ a: ["DENİZ"], c: ["ÇÖL"] });
  });

  it("kanıtı tanımsız oyunlar (bozuk-telefon, karalama-defteri, diğerleri) hiçbir şey eklemez", () => {
    const view = { reveal: { steps: [{ kind: "write", author: "a", text: "x" }] }, drawings: { a: [] } };
    for (const id of ["bozuk-telefon", "karalama-defteri", "butona-bas", "bilinmeyen"])
      expect(collectPublicTexts(id, view, ["a"])).toEqual({});
    expect(evidenceGames().sort()).toEqual([
      "cagrisim-agi",
      "kendim",
      "laf-sokma",
      "sozluk-blofu",
      "yazi-yaz",
    ]);
  });

  it("bozuk ya da beklenmeyen biçimde çökmez, sınırlar uygulanır", () => {
    expect(collectPublicTexts("kendim", null, ["a"])).toEqual({});
    expect(collectPublicTexts("kendim", { reveal: { cards: "x" } }, ["a"])).toEqual({});
    const many = {
      history: [
        {
          cards: Array.from({ length: 20 }, (_, i) => ({ author: "a", text: `cevap ${i}` })),
        },
        { cards: [{ author: "a", text: "u".repeat(500) }] },
      ],
    };
    const out = collectPublicTexts("laf-sokma", many, ["a"]);
    expect(out.a).toHaveLength(EVIDENCE_MAX_TEXTS);
    const long = collectPublicTexts(
      "laf-sokma",
      { history: [{ cards: [{ author: "a", text: "u".repeat(500) }] }] },
      ["a"],
    );
    expect(long.a?.[0]?.length).toBe(EVIDENCE_TEXT_MAX);
  });
});
