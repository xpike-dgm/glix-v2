import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type AsiriYuklemeState, asiriYukleme, asiriYuklemeEndAt, asiriYuklemePoints } from "./index.js";
import { ASIRI_YUKLEME_CAP_MS, ASIRI_YUKLEME_DANGER_MS, ASIRI_YUKLEME_OUTRO_MS } from "./types.js";

const T0 = 7_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c"]) => ({
  now,
  rng: createRng(1),
  connected,
});
const start = (players = ["a", "b", "c"]): AsiriYuklemeState => asiriYukleme.setup(players, ctx(T0));

function tap(state: AsiriYuklemeState, id: string, at: number, count = 1): AsiriYuklemeState {
  const r = asiriYukleme.reduce(state, id, { kind: "tap", count }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (state: AsiriYuklemeState, id: string, at: number, count = 1): string | null => {
  const r = asiriYukleme.reduce(state, id, { kind: "tap", count }, ctx(T0 + at));
  return isRejected(r) ? r.rejected : null;
};
const finish = (s: AsiriYuklemeState, at = ASIRI_YUKLEME_CAP_MS) => asiriYukleme.tick(s, ctx(T0 + at));
const awards = (s: AsiriYuklemeState, at?: number) => asiriYukleme.result(finish(s, at)).awards;

/** Bar'ı tam 100'e getirir: a 40, b 35, c 25 (t ms'de). */
function filled(at = 1_000): AsiriYuklemeState {
  let s = start();
  s = tap(s, "a", at, 10);
  s = tap(s, "a", at, 10);
  s = tap(s, "a", at, 10);
  s = tap(s, "a", at, 10);
  s = tap(s, "b", at + 1, 10);
  s = tap(s, "b", at + 1, 10);
  s = tap(s, "b", at + 1, 10);
  s = tap(s, "b", at + 1, 5);
  s = tap(s, "c", at + 2, 10);
  s = tap(s, "c", at + 2, 10);
  s = tap(s, "c", at + 2, 5);
  return s;
}

describe("asiri-yukleme kuralları", () => {
  it("2-8 oyuncu, bar boş başlar, süre sınırı yok", () => {
    expect(asiriYukleme.minPlayers).toBe(2);
    expect(asiriYukleme.maxPlayers).toBe(8);
    const s = start();
    expect(s.total).toBe(0);
    expect(s.dangerAt).toBeNull();
  });

  it("her tık bara 1 ekler ve oyuncuya yazılır", () => {
    let s = start();
    s = tap(s, "a", 100);
    s = tap(s, "b", 200);
    s = tap(s, "a", 300);
    expect(s.total).toBe(3);
    expect(s.clicks).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("toplu tık (count) sırayla işlenir: n tık = n", () => {
    const s = tap(start(), "a", 100, 7);
    expect(s.total).toBe(7);
    expect(s.clicks.a).toBe(7);
  });

  it("herkes istediği kadar tıklar (sınır yok, bar dolana kadar)", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10);
    expect(s.total).toBe(90);
    expect(rejection(s, "a", 500)).toBeNull();
  });

  it("100'e ulaşan tık turu bitirmez; yalnız gizli 3 sn pencereyi başlatır", () => {
    const s = filled(1_000);
    expect(s.total).toBe(100);
    expect(s.dangerAt).toBe(T0 + 1_002);
    expect(s.exploder).toBeNull();
    expect(asiriYukleme.isFinished(s, ctx(T0 + 1_002 + ASIRI_YUKLEME_DANGER_MS))).toBe(false);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + 1_002 + ASIRI_YUKLEME_DANGER_MS);
  });

  it("pencere içinde ilk tık kapasiteyi aşar: o oyuncu patlar, tur hemen biter", () => {
    let s = filled(1_000);
    s = tap(s, "b", 2_500);
    expect(s.exploder).toBe("b");
    expect(s.total).toBe(101);
    expect(s.over).toBe(true);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + 2_500);
    // Tur bitti: aynı ms'de ve sonrasında gelen tık reddedilir.
    expect(rejection(s, "a", 2_500)).toBe("ended");
    expect(rejection(s, "a", 2_900)).toBe("ended");
  });

  it("patlayan -1 alır ve sıralamaya girmez; diğerleri tıklamaya göre +2/+1", () => {
    let s = filled(1_000); // a 40, b 35, c 25
    s = tap(s, "a", 2_000); // a patlar (en çok tıklayan ama sıralamada yok)
    // c: ikinci sıra +1 ve en az tıklayan −1 (O7) → net 0.
    expect(awards(s)).toEqual({ a: -1, b: 2, c: 0 });
    expect(asiriYukleme.result(finish(s)).miniScores).toEqual({ a: -1, b: 2, c: 0 });
  });

  it("patlamayan ilk 100 sonrası tık: sıra sunucu sırasına göre ilk tık patlatır", () => {
    let s = filled(1_000);
    s = tap(s, "c", 1_500);
    const again = asiriYukleme.reduce(s, "a", { kind: "tap", count: 1 }, ctx(T0 + 1_500));
    expect(isRejected(again)).toBe(true);
    expect(s.exploder).toBe("c");
  });

  it("toplu mesaj kapasiteyi aşarsa aşan ilk tık patlatır (kalan tıklar sayılmaz)", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10); // 90
    s = tap(s, "b", 500, 10); // 100 dolar + 0 fazla -> pencere
    expect(s.total).toBe(100);
    expect(s.exploder).toBeNull();
    s = tap(s, "c", 600, 10); // ilk tık aşar
    expect(s.exploder).toBe("c");
    expect(s.total).toBe(101);
    expect(s.clicks.c).toBe(1);
  });

  it("aynı mesajda 100'e ulaşıp aşılırsa pencere ve patlama aynı anda; aşan tık sayılır", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10); // 90
    s = tap(s, "b", 200, 5); // 95
    s = tap(s, "c", 300, 10); // 5 dolar, 6. tık aşar
    expect(s.exploder).toBe("c");
    expect(s.dangerAt).toBe(T0 + 300);
    expect(s.clicks.c).toBe(6);
    expect(s.total).toBe(101);
  });

  it("pencere taşmadan biterse tur normal kapanır ve tıklamalar sıralanır", () => {
    const s = filled(1_000); // a 40, b 35, c 25; pencere 1002+3000
    const end = 1_002 + ASIRI_YUKLEME_DANGER_MS;
    expect(rejection(s, "a", end - 1)).toBeNull(); // pencere içindeki tık kabul edilir (patlatır)
    expect(awards(s, end)).toEqual({ a: 2, b: 1, c: -1 });
    expect(rejection(s, "a", end)).toBe("ended");
    expect(finish(s, end).exploder).toBeNull();
  });

  it("tıklama liderleri eşitse liderlerin hepsi +1, +2 verilmez, ikinci derece yok", () => {
    expect(asiriYuklemePoints(["a", "b", "c"], { a: 30, b: 30, c: 10 }, null)).toEqual({ a: 1, b: 1, c: -1 });
  });

  it("tek lider varsa ikinci sıra +1; ikinci sırada eşitlik: ikisi de +1", () => {
    expect(asiriYuklemePoints(["a", "b", "c", "d"], { a: 30, b: 20, c: 20, d: 5 }, null)).toEqual({
      a: 2,
      b: 1,
      c: 1,
      d: -1,
    });
  });

  it("patlayan dışlanınca kalanlar arasında eşitlik de uygulanır", () => {
    expect(asiriYuklemePoints(["a", "b", "c", "d"], { a: 50, b: 20, c: 20, d: 11 }, "a")).toEqual({
      a: -1,
      b: 1,
      c: 1,
      d: -1,
    });
  });

  it("hiç tıklamayan ödül almaz; kimse tıklamadıysa kimse puan almaz", () => {
    expect(asiriYuklemePoints(["a", "b", "c"], { a: 4, b: 0, c: 0 }, null)).toEqual({ a: 2, b: -1, c: -1 });
    expect(asiriYuklemePoints(["a", "b"], { a: 0, b: 0 }, null)).toEqual({ a: 0, b: 0 });
  });

  describe("O7: en az tıklayan −1", () => {
    const P = asiriYuklemePoints;
    it("tek en az tıklayan −1 alır (hiç tıklamayan da en az sayılır)", () => {
      expect(P(["a", "b", "c"], { a: 30, b: 20, c: 5 }, null)).toEqual({ a: 2, b: 1, c: -1 });
      expect(P(["a", "b", "c"], { a: 30, b: 20, c: 0 }, null)).toEqual({ a: 2, b: 1, c: -1 });
    });
    it("ikinci sırada +1 alan en az tıklayan net 0 alır", () => {
      expect(P(["a", "b"], { a: 30, b: 5 }, null)).toEqual({ a: 2, b: 0 });
    });
    it("en azda eşitlik: eşit en az tıklayanların hepsi −1", () => {
      expect(P(["a", "b", "c", "d"], { a: 30, b: 20, c: 5, d: 5 }, null)).toEqual({ a: 2, b: 1, c: -1, d: -1 });
    });
    it("herkesin sayısı aynıysa kimse bu cezayı almaz", () => {
      expect(P(["a", "b", "c"], { a: 7, b: 7, c: 7 }, null)).toEqual({ a: 1, b: 1, c: 1 });
      expect(P(["a", "b", "c"], { a: 0, b: 0, c: 0 }, null)).toEqual({ a: 0, b: 0, c: 0 });
    });
    it("patlayan en az tıklasa bile ikinci −1 almaz ve en az hesabına girmez", () => {
      // c patlatır (3 tık): kalan a 30, b 20 → b en az: +1 −1 = 0; c yalnız kendi −1'i.
      expect(P(["a", "b", "c"], { a: 30, b: 20, c: 3 }, "c")).toEqual({ a: 2, b: 0, c: -1 });
      // Kalanlar eşitse (a=b) ceza yok; patlayanın az sayısı kimseyi etkilemez.
      expect(P(["a", "b", "c"], { a: 20, b: 20, c: 1 }, "c")).toEqual({ a: 1, b: 1, c: -1 });
    });
    it("tek patlamayan oyuncu varsa ceza yok", () => {
      expect(P(["a", "b"], { a: 0, b: 101 }, "b")).toEqual({ a: 0, b: -1 });
    });
    it("sonuç ve result() aynı puanları verir; tıklamalar tur sonuna kadar gizli kalır", () => {
      let s = filled(1_000); // a 40, b 35, c 25
      const end = 1_002 + ASIRI_YUKLEME_DANGER_MS;
      expect(asiriYukleme.publicView(s, ctx(T0 + end - 1)).reveal).toBeNull();
      s = finish(s, end);
      const rev = asiriYukleme.publicView(s, ctx(T0 + end)).reveal;
      expect(rev?.points).toEqual({ a: 2, b: 1, c: -1 });
      expect(asiriYukleme.result(s).awards).toEqual(rev?.points);
    });
    it("kurulum bilgilendirmesi en az tıklayanın −1 aldığını söyler", () => {
      expect(asiriYukleme.briefing.steps.join(" ")).toContain("en az tıklayan −1");
    });
  });

  it("tek katılımcı tıklayıp diğeri patlatırsa: tıklayan +2", () => {
    expect(asiriYuklemePoints(["a", "b"], { a: 3, b: 101 }, "b")).toEqual({ a: 2, b: -1 });
  });

  it("90 sn teknik üst sınır: kimse tıklamazsa patlamasız biter, puan yok", () => {
    const s = start();
    expect(asiriYuklemeEndAt(s)).toBe(T0 + ASIRI_YUKLEME_CAP_MS);
    expect(awards(s)).toEqual({ a: 0, b: 0, c: 0 });
    expect(rejection(s, "a", ASIRI_YUKLEME_CAP_MS - 1)).toBeNull();
    expect(rejection(s, "a", ASIRI_YUKLEME_CAP_MS)).toBe("ended");
  });

  it("üst sınır dolarken bar 100'ün altındaysa patlama olmadan tıklamalar sıralanır", () => {
    let s = start();
    s = tap(s, "a", 1_000, 5);
    s = tap(s, "b", 2_000, 3);
    s = tap(s, "c", 3_000, 3);
    expect(awards(s)).toEqual({ a: 2, b: 0, c: 0 });
    expect(finish(s).exploder).toBeNull();
  });

  it("üst sınır, gizli pencereyi de keser (pencere 89 sn'de başlarsa 90. sn'de biter)", () => {
    let s = start();
    s = tap(s, "a", 89_000, 10); // 10
    for (let i = 0; i < 9; i++) s = tap(s, "b", 89_000, 10); // 100
    expect(s.dangerAt).toBe(T0 + 89_000);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + ASIRI_YUKLEME_CAP_MS);
    expect(rejection(s, "c", ASIRI_YUKLEME_CAP_MS)).toBe("ended");
  });

  it("katılımcı olmayan reddedilir; başlangıçtan önce reddedilir", () => {
    expect(rejection(start(), "x", 100)).toBe("not_participant");
    expect(rejection(start(), "a", -1)).toBe("not_started");
  });

  it("bağlantısı kopmuş oyuncunun tıkı da işlenir (hedef yok)", () => {
    const r = asiriYukleme.reduce(start(), "a", { kind: "tap", count: 2 }, ctx(T0 + 10, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("bitiş: tur sonu + sonuç süresi", () => {
    const s = tap(filled(1_000), "a", 2_000);
    const end = T0 + 2_000 + ASIRI_YUKLEME_OUTRO_MS;
    expect(asiriYukleme.isFinished(s, ctx(end - 1))).toBe(false);
    expect(asiriYukleme.isFinished(s, ctx(end))).toBe(true);
  });

  it("tick bayrağı yalnız tur bitince değişir", () => {
    const s = filled(1_000);
    expect(asiriYukleme.tick(s, ctx(T0 + 2_000))).toBe(s);
    const t = asiriYukleme.tick(s, ctx(T0 + 1_002 + ASIRI_YUKLEME_DANGER_MS));
    expect(t.over).toBe(true);
    expect(asiriYukleme.tick(t, ctx(T0 + 99_000))).toBe(t);
  });

  it("parseAction: {kind:'tap'} = 1 tık; count 1..10 tam sayı", () => {
    expect(asiriYukleme.parseAction({ kind: "tap" })).toEqual({ kind: "tap", count: 1 });
    expect(asiriYukleme.parseAction({ kind: "tap", count: 10 })).toEqual({ kind: "tap", count: 10 });
    for (const bad of [
      { kind: "tap", count: 0 },
      { kind: "tap", count: 11 },
      { kind: "tap", count: 1.5 },
      { kind: "tap", count: "3" },
      { kind: "tap", count: Number.NaN },
      { kind: "tap", count: 2, extra: 1 },
      { kind: "press" },
      [],
      null,
    ]) {
      expect(asiriYukleme.parseAction(bad)).toBeNull();
    }
  });
});

describe("asiri-yukleme gizlilik", () => {
  const JSON_OF = (v: unknown) => JSON.stringify(v);

  it("tur bitmeden publicView yalnız danger taşır: toplam, tıklamalar, pencere bitişi yok", () => {
    let s = start();
    s = tap(s, "a", 500, 7);
    s = tap(s, "b", 600, 3);
    const pub = asiriYukleme.publicView(s, ctx(T0 + 700));
    expect(pub).toEqual({ startedAt: T0, danger: false, reveal: null });
    expect(Object.keys(pub).sort()).toEqual(["danger", "reveal", "startedAt"]);
  });

  it("bar 100'e ulaşınca danger true olur; yine de sayı ve pencere bilgisi yoktur", () => {
    const s = filled(1_000);
    const pub = asiriYukleme.publicView(s, ctx(T0 + 1_500));
    expect(pub).toEqual({ startedAt: T0, danger: true, reveal: null });
    const json = JSON_OF(pub);
    expect(json).not.toContain(String(T0 + 1_002));
    expect(json).not.toContain("100");
  });

  it("danger bayrağı bar 100'e ulaşmadan asla true olmaz", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10);
    s = tap(s, "b", 300, 9); // 99
    expect(asiriYukleme.publicView(s, ctx(T0 + 400)).danger).toBe(false);
    s = tap(s, "b", 310, 1); // 100
    expect(asiriYukleme.publicView(s, ctx(T0 + 400)).danger).toBe(true);
  });

  it("view hiçbir sayı taşımaz (kendi tıklama sayın dahil)", () => {
    let s = start();
    s = tap(s, "a", 500, 7);
    for (const who of ["a", "b", null]) {
      const v = asiriYukleme.view(s, who, ctx(T0 + 700));
      expect(Object.keys(v)).toEqual(["participant"]);
    }
    expect(asiriYukleme.view(s, null, ctx(T0)).participant).toBe(false);
    expect(asiriYukleme.view(s, "a", ctx(T0)).participant).toBe(true);
  });

  it("pencere bitişinden 1 ms önce hâlâ gizli, bitişte açılır", () => {
    const s = filled(1_000);
    const end = 1_002 + ASIRI_YUKLEME_DANGER_MS;
    expect(asiriYukleme.publicView(s, ctx(T0 + end - 1)).reveal).toBeNull();
    const rev = asiriYukleme.publicView(s, ctx(T0 + end)).reveal;
    expect(rev).toMatchObject({ total: 100, exploder: null, clicks: { a: 40, b: 35, c: 25 } });
    expect(rev?.points).toEqual({ a: 2, b: 1, c: -1 });
  });

  it("patlama anında sonuç herkese açılır: patlayan, toplam 101, tıklamalar", () => {
    const s = tap(filled(1_000), "c", 2_000);
    const rev = asiriYukleme.publicView(s, ctx(T0 + 2_000)).reveal;
    expect(rev).toMatchObject({ total: 101, exploder: "c" });
    expect(rev?.clicks).toEqual({ a: 40, b: 35, c: 26 });
    expect(rev?.points).toEqual({ a: 2, b: 0, c: -1 });
  });

  it("patlamadan önce patlayanın kimliği hiçbir görünümde yoktur", () => {
    const s = filled(1_000);
    for (const who of ["a", "b", "c", null]) {
      expect(JSON_OF(asiriYukleme.view(s, who, ctx(T0 + 1_500)))).not.toContain("exploder");
    }
    expect(JSON_OF(asiriYukleme.publicView(s, ctx(T0 + 1_500)))).not.toContain("exploder");
  });
});
