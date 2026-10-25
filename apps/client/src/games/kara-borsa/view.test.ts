import { describe, expect, it } from "vitest";
import { hintText, parseBorsaView, parseHint, sortedBids } from "./view.js";

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
const priv = { hint: { kind: "gt", n: 30 }, myBid: null };

describe("Kara Borsa görünümü", () => {
  it("geçerli görünümleri birleştirir", () => {
    const v = parseBorsaView(pub, priv);
    expect(v).toMatchObject({ phase: "bid", round: 1, hint: { kind: "gt", n: 30 }, myBid: null });
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
});
