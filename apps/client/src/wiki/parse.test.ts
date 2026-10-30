import { describe, expect, it } from "vitest";
import { parseData, parseFeedbackList, parseGame, parseState } from "./parse.js";

describe("ansiklopedi yanıt doğrulaması", () => {
  it("oyun: eksik alanlar boş değere düşer, yanlış türler atlanır", () => {
    const g = parseGame({
      id: "butona-bas",
      ad: "Butona Bas",
      kurallar: ["a", 3, "b"],
      akis: [{ ad: "Bekle", sureSn: 5 }, "bozuk", { ad: "Bas", sureSn: "uzun" }],
      ekranlar: [{ dosya: "iyi-ad", baslik: "B", tv: true }, { dosya: "../kotu" }],
      sabitler: [{ ad: "SURE", deger: 5 }],
    });
    expect(g?.kurallar).toEqual(["a", "b"]);
    expect(g?.akis.map((a) => a.sureSn)).toEqual([5, null]);
    expect(g?.ekranlar).toEqual([{ dosya: "iyi-ad", baslik: "B", aciklama: "", tv: true }]);
    expect(g?.sabitler[0]?.deger).toBe("5");
    expect(g?.kategori).toBe("Diğer");
    expect(parseGame({ id: "Kötü Ad" })).toBeNull();
  });

  it("veri: bozuk oyun ve ekran adları düşer", () => {
    expect(
      parseData({ games: [{ id: "a" }, { ad: "kimliksiz" }], screens: ["e-1", "../x", 4] }),
    ).toMatchObject({
      games: [{ id: "a" }],
      screens: ["e-1"],
    });
    expect(parseData({ games: {} })).toBeNull();
  });

  it("not listesi: bozuk satır atlanır", () => {
    const iyi = {
      id: 1,
      gameId: "a",
      section: "Genel",
      text: "t",
      status: "acik",
      screen: null,
      box: null,
      hasImage: false,
      reply: "",
      createdAt: 1,
      updatedAt: 1,
    };
    const l = parseFeedbackList({
      items: [iyi, { ...iyi, id: 2, status: "bitti" }, { ...iyi, id: 3, box: { x: 2, y: 0, w: 1, h: 1 } }],
    });
    expect(l?.map((f) => f.id)).toEqual([1]);
    expect(parseFeedbackList({})).toBeNull();
  });

  it("erişim durumu", () => {
    expect(parseState({ state: "ready" })).toBe("ready");
    expect(parseState({ state: "x" })).toBeNull();
  });
});
