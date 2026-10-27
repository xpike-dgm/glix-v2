import { describe, expect, it } from "vitest";
import { deriveTitles, type RoundRecord } from "./titles.js";

const ids = ["a", "b", "c", "d"];
const r = (round: number, gameId: string, awards: Record<string, number>): RoundRecord => ({
  round,
  gameId,
  awards,
});
const byPlayer = (t: ReturnType<typeof deriveTitles>) =>
  Object.fromEntries(t.map((x) => [x.playerId, x.label]));

describe("final unvanları", () => {
  it("geçmiş ya da tek oyuncu yoksa unvan yok", () => {
    expect(deriveTitles([], ids)).toEqual([]);
    expect(deriveTitles([r(0, "butona-bas", { a: 2 })], ["a"])).toEqual([]);
  });

  it("en çok turu kazanan, son tur lideri, blöf kralı ve kurban ayrı oyunculara dağılır", () => {
    const rounds = [
      r(0, "butona-bas", { a: 2, b: 1 }),
      r(1, "sozluk-blofu", { a: 1, c: 2, d: -1 }),
      r(2, "butona-bas", { a: 2, b: 1, d: -1 }),
      r(3, "kor-bomba", { b: 2, d: -1 }),
    ];
    expect(byPlayer(deriveTitles(rounds, ids))).toEqual({
      a: "En çok kazanan",
      b: "Son dakika ustası",
      c: "Blöf kralı",
      d: "Kaderin kurbanı",
    });
  });

  it("eşitlikte oda sırasıyla ilk unvansız aday alır; aynı girdi aynı sonucu verir", () => {
    const rounds = [r(0, "butona-bas", { a: 2, b: 2 })];
    const t = deriveTitles(rounds, ids);
    expect(byPlayer(t)).toEqual({ a: "En çok kazanan", b: "Son dakika ustası" });
    expect(deriveTitles(rounds, ids)).toEqual(t);
  });

  it("hep puanlı: en az 3 tur, her turda puan, hiç eksi yok", () => {
    const rounds = [
      r(0, "butona-bas", { a: 3, c: 1 }),
      r(1, "butona-bas", { a: 3, c: 1 }),
      r(2, "butona-bas", { b: 3, c: 1 }),
    ];
    expect(byPlayer(deriveTitles(rounds, ids))).toMatchObject({ c: "Hep puanlı" });
    expect(deriveTitles(rounds.slice(0, 2), ids).some((x) => x.label === "Hep puanlı")).toBe(false);
  });

  it("blöf kralı en az +2 ister", () => {
    const rounds = [r(0, "sizma", { a: 1, b: 1 })];
    expect(deriveTitles(rounds, ids).some((x) => x.label === "Blöf kralı")).toBe(false);
  });
});
