import { describe, expect, it } from "vitest";
import { countedValue, REVEAL_TIMELINE, revealSchedule } from "./timeline.js";
import {
  fromNumber,
  hintText,
  ledgerTiles,
  parseBorsaView,
  parseHint,
  parseHintPair,
  profitLeaders,
  profitOf,
  revealOrder,
  shortName,
  signed,
  sortedBids,
  verdictOf,
  verdictText,
  wonOnTie,
} from "./view.js";

const pub = {
  phase: "bid",
  round: 1,
  rounds: 5,
  startedAt: 0,
  stageStartedAt: 1,
  stageEndsAt: 2,
  players: ["a", "b"],
  coins: { a: 100, b: 90 },
  boxes: { a: 0, b: 12 },
  bidIds: ["a"],
  history: [{ value: 12, winner: "b", price: 10, bids: { a: 5, b: 10 } }],
  reveal: null,
};
const priv = { hint: { main: { kind: "gt", n: 30 }, extra: { kind: "odd" } }, myBid: null };

describe("Kara Borsa görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseBorsaView(pub, priv);
    expect(v).toMatchObject({
      phase: "bid",
      round: 1,
      hint: { main: { kind: "gt", n: 30 }, extra: { kind: "odd" } },
      myBid: null,
    });
    expect(v?.history[0]?.winner).toBe("b");
  });

  it("açılış sonucunu okur", () => {
    const v = parseBorsaView(
      { ...pub, phase: "reveal", reveal: { value: -20, winner: null, price: 0, bids: { a: 0, b: 0 } } },
      { hint: null, myBid: 7 },
    );
    expect(v?.reveal?.value).toBe(-20);
    expect(v?.myBid).toBe(7);
  });

  it("bozuk görünümleri reddeder", () => {
    expect(parseBorsaView(null, priv)).toBeNull();
    expect(parseBorsaView({ ...pub, phase: "x" }, priv)).toBeNull();
    expect(parseBorsaView({ ...pub, coins: { a: "1" } }, priv)).toBeNull();
    expect(parseBorsaView({ ...pub, history: [{ value: 1 }] }, priv)).toBeNull();
    expect(parseBorsaView({ ...pub, reveal: { value: 1 } }, priv)).toBeNull();
    expect(parseBorsaView(pub, { hint: { kind: "yok" }, myBid: null })).toBeNull();
    expect(parseBorsaView(pub, { hint: null, myBid: "3" })).toBeNull();
    // Eski biçim (tek ipucu) ya da eksik ek ipucu reddedilir.
    expect(parseBorsaView(pub, { hint: { kind: "gt", n: 30 }, myBid: null })).toBeNull();
    expect(parseHintPair({ main: { kind: "even" } })).toBeNull();
  });

  it("ipucu türleri ayrıştırılır ve Türkçe okunur", () => {
    expect(hintText(parseHint({ kind: "gt", n: 30 }) ?? { kind: "even" })).toBe("Değeri 30'dan büyük");
    expect(hintText({ kind: "between", lo: 5, hi: 9 })).toBe("Değeri 5 ile 9 arasında");
    expect(hintText({ kind: "notMultiple", n: 10 })).toBe("Değeri 10'un katı değil");
    expect(hintText({ kind: "cursed" })).toContain("lanetli");
    expect(hintText({ kind: "lt", n: 5 })).toBe("Değeri 5'ten küçük");
    expect(hintText({ kind: "gt", n: 40 })).toBe("Değeri 40'tan büyük");
    expect(hintText({ kind: "multiple", n: 3 })).toBe("Değeri 3'ün katı");
    expect(parseHint({ kind: "between", lo: 1 })).toBeNull();
    expect(parseHint({ kind: "even", extra: 1 })).toEqual({ kind: "even" });
    expect(parseHint(null)).toBeNull();
  });

  it("teklifler yüksekten düşüğe sıralanır", () => {
    const r = { value: 1, winner: "c", price: 9, bids: { a: 0, b: 4, c: 9 } };
    expect(sortedBids(r, ["a", "b", "c"]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("Büyük Kutu eşikleri 120'ye kadar doğru ekle okunur", () => {
    expect(fromNumber(70)).toBe("70'ten");
    expect(fromNumber(80)).toBe("80'den");
    expect(fromNumber(90)).toBe("90'dan");
    expect(fromNumber(100)).toBe("100'den");
    expect(fromNumber(110)).toBe("110'dan");
    expect(fromNumber(120)).toBe("120'den");
    expect(fromNumber(105)).toBe("105'ten");
    expect(fromNumber(0)).toBe("0'dan");
    expect(hintText({ kind: "lt", n: 80 })).toBe("Değeri 80'den küçük");
  });

  it("açılış sırası: düşükten yükseğe, kazanan en son (eşit teklifte de)", () => {
    const r = { value: 30, winner: "b", price: 20, bids: { a: 20, b: 20, c: 0, d: 5 } };
    expect(revealOrder(r, ["a", "b", "c", "d"]).map((x) => x.id)).toEqual(["c", "d", "a", "b"]);
    expect(wonOnTie(r)).toBe(true);
    expect(wonOnTie({ ...r, bids: { a: 3, b: 20 } })).toBe(false);
    const none = { value: 30, winner: null, price: 0, bids: { a: 0, b: 0 } };
    expect(revealOrder(none, ["a", "b"])).toHaveLength(2);
    expect(wonOnTie(none)).toBe(false);
  });

  it("kâr/zarar damgası: kelepir, başa baş, kazık, lanet", () => {
    const base = { winner: "a", bids: { a: 10 } };
    const v = (value: number, price: number) => verdictOf({ ...base, value, price });
    expect(v(25, 10)).toEqual({ kind: "bargain", net: 15 });
    expect(verdictText(v(25, 10) ?? { kind: "even", net: 0 })).toBe("Kelepir! +15");
    expect(verdictText(v(10, 10) ?? { kind: "bargain", net: 0 })).toBe("Başa baş");
    expect(verdictText(v(37, 44) ?? { kind: "even", net: 0 })).toBe("Kazık! −7");
    expect(verdictText(v(-20, 44) ?? { kind: "even", net: 0 })).toBe("LANETLENDİ −64");
    expect(verdictOf({ value: 5, winner: null, price: 0, bids: {} })).toBeNull();
  });

  it("kâr, taç ve kısa ad", () => {
    expect(profitOf(pub, "a")).toBe(0);
    expect(profitOf(pub, "b")).toBe(2);
    expect(profitLeaders(pub)).toEqual(["b"]);
    expect(profitLeaders({ ...pub, coins: { a: 100, b: 88 } })).toEqual([]);
    expect(profitLeaders({ ...pub, coins: { a: 112, b: 100 } })).toEqual(["a", "b"]);
    expect(signed(5)).toBe("+5");
    expect(signed(-7)).toBe("−7");
    expect(signed(0)).toBe("0");
    expect(shortName("Ayşegül")).toBe("Ayşegül");
    expect(shortName("Abdurrahman")).toBe("Abdurra…");
    expect(Array.from(shortName("Çağlayanlar"))).toHaveLength(8);
  });

  it("pazar defteri: açılmış, sıradaki ve gelecek turlar; son tur ×2", () => {
    const tiles = ledgerTiles(parseBorsaView(pub, priv) ?? { history: [], round: 0, rounds: 5 });
    expect(tiles.map((t) => t.state)).toEqual(["done", "current", "future", "future", "future"]);
    expect(tiles[0]).toMatchObject({ value: 12, winner: "b", price: 10 });
    expect(tiles.map((t) => t.big)).toEqual([false, false, false, false, true]);
  });

  it("açılış zaman çizelgesi 8 oyuncuda bile 8 sn'ye sığar; değer 0'dan sayar", () => {
    for (const n of [3, 5, 8]) {
      const p = revealSchedule(n);
      expect(p.rowAt(n - 1)).toBeLessThan(p.lidAt);
      expect(p.lidAt).toBeLessThan(p.verdictAt);
      expect(p.summaryAt).toBeLessThan(REVEAL_TIMELINE.endMs);
    }
    expect(REVEAL_TIMELINE.endMs).toBe(8_000);
    const p = revealSchedule(4);
    expect(countedValue(37, p.countAt - 10, p.countAt)).toBe(0);
    expect(countedValue(37, p.countAt + REVEAL_TIMELINE.countMs, p.countAt)).toBe(37);
    expect(countedValue(-20, p.countAt + 99_999, p.countAt)).toBe(-20);
  });
});
