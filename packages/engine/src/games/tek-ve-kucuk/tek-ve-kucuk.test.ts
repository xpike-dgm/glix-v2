import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { tekVeKucuk as g, type TekState, tekSettle } from "./index.js";
import {
  TEK_CHOOSE_MS,
  TEK_DURATION_MS,
  TEK_REVEAL_MS,
  TEK_ROUNDS,
  TEK_WIN_POINTS,
  tekMax,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });
const start = (n = 4): TekState => g.setup(ids(n), ctx(T0));
function act(
  state: TekState,
  id: string,
  action: Parameters<typeof g.reduce>[2],
  at: number,
  connected?: readonly string[],
) {
  const r = g.reduce(state, id, action, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r as TekState;
}
const pick = (s: TekState, id: string, value: number, at = 1_000) =>
  act(s, id, { kind: "choose", value }, at);

describe("tek-ve-kucuk kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde, rastgele havuz dışı (taslak)", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(g.randomPool).toBe(false);
  });

  it("5 tur: seçim 10 sn + sonuç 4 sn (son tur 6 sn); toplam 72 sn", () => {
    expect(TEK_ROUNDS).toBe(5);
    expect(TEK_DURATION_MS).toBe(5 * 10_000 + 4 * 4_000 + 6_000);
    const s = start();
    expect(g.isFinished(s, ctx(T0 + TEK_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + TEK_DURATION_MS))).toBe(true);
  });

  it("sayı aralığı oyuncu sayısı + 2'dir", () => {
    expect(tekMax(3)).toBe(5);
    expect(tekMax(8)).toBe(10);
    expect(g.publicView(start(3), ctx(T0)).max).toBe(5);
    const s = start(3);
    expect(g.reduce(s, "p1", { kind: "choose", value: 6 }, ctx(T0 + 100))).toEqual({
      rejected: "out_of_range",
    });
    expect(isRejected(g.reduce(s, "p1", { kind: "choose", value: 5 }, ctx(T0 + 100)))).toBe(false);
    expect(g.reduce(s, "p1", { kind: "choose", value: 0 }, ctx(T0 + 100))).toEqual({
      rejected: "out_of_range",
    });
  });

  it("en küçük TEK kalan sayı kazanır (+3)", () => {
    // 1'i iki kişi, 2'yi bir kişi, 3'ü bir kişi seçti -> 2 kazanır.
    const r = tekSettle(ids(4), 6, { p1: 1, p2: 1, p3: 2, p4: 3 });
    expect(r.winner).toBe("p3");
    expect(r.winningValue).toBe(2);
    expect(r.points).toEqual({ p1: 0, p2: 0, p3: TEK_WIN_POINTS, p4: 0 });
    expect(r.counts.slice(0, 4)).toEqual([2, 1, 1, 0]);
  });

  it("kimse tek kalmazsa kimse puan almaz", () => {
    const r = tekSettle(ids(4), 6, { p1: 1, p2: 1, p3: 4, p4: 4 });
    expect(r.winner).toBeNull();
    expect(r.winningValue).toBeNull();
    expect(Object.values(r.points)).toEqual([0, 0, 0, 0]);
  });

  it("seçmeyen yarışmaz; tek seçen otomatik kazanır", () => {
    const r = tekSettle(ids(4), 6, { p2: 5 });
    expect(r.winner).toBe("p2");
    expect(r.picks).toEqual({ p2: 5 });
  });

  it("seçim değiştirilir, kilit sonrası değişmez; seçimsiz kilit yok", () => {
    let s = start();
    s = pick(s, "p1", 3);
    s = pick(s, "p1", 2, 2_000);
    expect(g.view(s, "p1", ctx(T0 + 2_500)).myValue).toBe(2);
    expect(g.reduce(s, "p2", { kind: "lock" }, ctx(T0 + 2_000))).toEqual({ rejected: "nothing_to_lock" });
    s = act(s, "p1", { kind: "lock" }, 3_000);
    expect(g.reduce(s, "p1", { kind: "choose", value: 4 }, ctx(T0 + 3_500))).toEqual({ rejected: "locked" });
  });

  it("çöp ve katılımcı olmayan eylem reddedilir; süre sonrası seçim alınmaz", () => {
    const s = start();
    expect(g.reduce(s, "ghost", { kind: "choose", value: 1 }, ctx(T0 + 10))).toEqual({
      rejected: "not_participant",
    });
    expect(g.reduce(s, "p1", { kind: "choose", value: 1 }, ctx(T0 + TEK_CHOOSE_MS))).toEqual({
      rejected: "ended",
    });
    for (const raw of [
      { kind: "choose", value: 11 },
      { kind: "choose", value: 0 },
      { kind: "choose", value: 2.5 },
      { kind: "choose" },
      { kind: "x" },
      null,
      "a",
    ]) {
      expect(g.parseAction(raw)).toBeNull();
    }
  });

  it("tur geçişi: önceki turların kazanan sayıları sonraki turda görünür", () => {
    let s = start(4);
    s = pick(s, "p1", 1);
    s = pick(s, "p2", 2);
    s = pick(s, "p3", 2);
    const second = g.publicView(s, ctx(T0 + TEK_CHOOSE_MS + TEK_REVEAL_MS));
    expect(second.round).toBe(2);
    expect(second.previous).toEqual([{ winningValue: 1, winner: "p1" }]);
    expect(second.totals.p1).toBe(TEK_WIN_POINTS);
    expect(second.reveal).toBeNull();
  });

  it("bağlı herkes kilitleyince tur 1 sn sonra biter", () => {
    const players = ids(3);
    let s = start(3);
    s = act(s, "p1", { kind: "choose", value: 1 }, 500, players);
    s = act(s, "p2", { kind: "choose", value: 2 }, 600, players);
    s = act(s, "p3", { kind: "choose", value: 2 }, 700, players);
    for (const [i, id] of players.entries()) s = act(s, id, { kind: "lock" }, 1_000 + i * 100, players);
    expect(g.publicView(s, ctx(T0 + 2_199)).phase).toBe("choose");
    const open = g.publicView(s, ctx(T0 + 2_200));
    expect(open.phase).toBe("reveal");
    expect(open.reveal?.winner).toBe("p1");
  });

  it("5 turun toplamı genel skora çevrilir; puan alan yoksa ödül yok", () => {
    let s = start(4);
    for (let r = 0; r < TEK_ROUNDS; r++) {
      const base = r * (TEK_CHOOSE_MS + TEK_REVEAL_MS);
      s = pick(s, "p1", 1, base + 1_000);
      s = pick(s, "p2", 2, base + 1_000);
      s = pick(s, "p3", 2, base + 1_000);
    }
    const end = g.tick(s, ctx(T0 + TEK_DURATION_MS));
    expect(g.isFinished(end, ctx(T0 + TEK_DURATION_MS))).toBe(true);
    const res = g.result(end);
    expect(res.miniScores).toEqual({ p1: 15, p2: 0, p3: 0, p4: 0 });
    expect(res.awards).toEqual({ p1: 2, p2: 0, p3: 0, p4: 0 });
    expect(g.publicView(end, ctx(T0 + TEK_DURATION_MS)).final).toEqual(res.awards);
    const nobody = g.result(g.tick(start(4), ctx(T0 + TEK_DURATION_MS)));
    expect(Object.values(nobody.awards)).toEqual([0, 0, 0, 0]);
  });
});

describe("tek-ve-kucuk gizlilik (yapısal)", () => {
  it("secrets() boştur (gerekçe: değerler kısa sayılar)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("seçim süresince ortak görünüm seçim ya da sayım taşımaz", () => {
    let s = start(5);
    s = pick(s, "p1", 3);
    s = pick(s, "p2", 3);
    for (const at of [0, 5_000, 9_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      const flat = JSON.stringify(pub);
      for (const word of ["picks", "counts", "choices", "winner"]) expect(flat).not.toContain(word);
    }
  });

  it("kişisel görünüm yalnız sahibinin seçimini taşır", () => {
    let s = start(4);
    s = pick(s, "p1", 4);
    expect(g.view(s, "p1", ctx(T0 + 100)).myValue).toBe(4);
    expect(g.view(s, "p2", ctx(T0 + 100)).myValue).toBeNull();
    expect(g.view(s, null, ctx(T0 + 100)).myValue).toBeNull();
  });

  it("sonuç açılınca seçimler ve sayımlar herkese görünür", () => {
    let s = start(4);
    s = pick(s, "p1", 4);
    s = pick(s, "p2", 4);
    s = pick(s, "p3", 2);
    const open = g.publicView(s, ctx(T0 + TEK_CHOOSE_MS)).reveal;
    expect(open?.picks).toEqual({ p1: 4, p2: 4, p3: 2 });
    expect(open?.counts[3]).toBe(2);
  });
});
