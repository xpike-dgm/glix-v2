import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  type AsiriYuklemeState,
  asiriYukleme,
  asiriYuklemeEndAt,
  asiriYuklemeExploders,
  asiriYuklemePoints,
} from "./index.js";
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

/** Bar'ı tam 100'e getirir: a 40, b 35, c 25; pencere t+2 ms'de başlar. */
function filled(at = 1_000): AsiriYuklemeState {
  let s = start();
  for (let i = 0; i < 4; i++) s = tap(s, "a", at, 10);
  for (let i = 0; i < 3; i++) s = tap(s, "b", at + 1, 10);
  s = tap(s, "b", at + 1, 5);
  s = tap(s, "c", at + 2, 10);
  s = tap(s, "c", at + 2, 10);
  s = tap(s, "c", at + 2, 5);
  return s;
}
/** `filled(1_000)` için pencerenin bitişi (T0'a göre). */
const WINDOW_END = 1_002 + ASIRI_YUKLEME_DANGER_MS;

const P = asiriYuklemePoints;
/** Puan: önce/sonra sayıları tek nesneden (eksik = 0). */
const pts = (players: string[], before: Record<string, number>, after: Record<string, number> = {}) =>
  P(players, before, after);

describe("asiri-yukleme akış", () => {
  it("2-8 oyuncu, bar boş başlar, süre sınırı yok", () => {
    expect(asiriYukleme.minPlayers).toBe(2);
    expect(asiriYukleme.maxPlayers).toBe(8);
    const s = start();
    expect(s.total).toBe(0);
    expect(s.dangerAt).toBeNull();
    expect(s.before).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.after).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("her tık bara 1 ekler ve oyuncunun 'önce' sayısına yazılır", () => {
    let s = start();
    s = tap(s, "a", 100);
    s = tap(s, "b", 200);
    s = tap(s, "a", 300);
    expect(s.total).toBe(3);
    expect(s.before).toEqual({ a: 2, b: 1, c: 0 });
    expect(s.after).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("toplu tık (count): n tık = n", () => {
    const s = tap(start(), "a", 100, 7);
    expect(s.total).toBe(7);
    expect(s.before.a).toBe(7);
  });

  it("100'e ulaşan tık turu bitirmez; yalnız gizli 3 sn pencereyi başlatır", () => {
    const s = filled(1_000);
    expect(s.total).toBe(100);
    expect(s.dangerAt).toBe(T0 + 1_002);
    expect(asiriYukleme.isFinished(s, ctx(T0 + WINDOW_END))).toBe(false);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + WINDOW_END);
  });

  it("100'ü aşan tık turu BİTİRMEZ: pencere sonuna kadar herkes basabilir", () => {
    let s = filled(1_000);
    s = tap(s, "b", 1_500);
    expect(s.total).toBe(101);
    expect(s.after.b).toBe(1);
    expect(s.over).toBe(false);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + WINDOW_END);
    // Aynı ms'de ve sonrasında başkaları da basabilir; hepsi "sonra" sayılır.
    s = tap(s, "a", 1_500, 3);
    s = tap(s, "c", WINDOW_END - 1);
    expect(s.after).toEqual({ a: 3, b: 1, c: 1 });
    expect(s.before).toEqual({ a: 40, b: 35, c: 25 });
    expect(s.total).toBe(105);
    expect(rejection(s, "a", WINDOW_END)).toBe("ended");
    expect(asiriYukleme.tick(s, ctx(T0 + WINDOW_END - 1)).over).toBe(false);
    expect(asiriYukleme.tick(s, ctx(T0 + WINDOW_END)).over).toBe(true);
  });

  it("toplu mesaj: 100'e kadar olan kısım 'önce', aşan kısım 'sonra' sayılır", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10); // 90
    s = tap(s, "b", 200, 5); // 95
    s = tap(s, "c", 300, 10); // 5 önce, 5 sonra
    expect(s.before.c).toBe(5);
    expect(s.after.c).toBe(5);
    expect(s.total).toBe(105);
    expect(s.dangerAt).toBe(T0 + 300);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + 300 + ASIRI_YUKLEME_DANGER_MS);
  });

  it("toplu mesaj tam 100'de biterse 'sonra' yoktur; bar doluyken gelen mesajın hepsi 'sonra'", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 100 + i, 10); // 90
    s = tap(s, "b", 500, 10); // tam 100
    expect(s.before.b).toBe(10);
    expect(s.after.b).toBe(0);
    s = tap(s, "c", 600, 10);
    expect(s.before.c).toBe(0);
    expect(s.after.c).toBe(10);
    expect(s.dangerAt).toBe(T0 + 500);
  });

  it("pencere taşmadan biterse patlama olmaz ve tıklamalar sıralanır (eksi yok)", () => {
    const s = filled(1_000); // a 40, b 35, c 25
    expect(rejection(s, "a", WINDOW_END - 1)).toBeNull();
    expect(awards(s, WINDOW_END)).toEqual({ a: 2, b: 1, c: 0 });
    expect(rejection(s, "a", WINDOW_END)).toBe("ended");
  });

  it("90 sn teknik üst sınır: kimse tıklamazsa patlamasız biter, puan yok", () => {
    const s = start();
    expect(asiriYuklemeEndAt(s)).toBe(T0 + ASIRI_YUKLEME_CAP_MS);
    expect(awards(s)).toEqual({ a: 0, b: 0, c: 0 });
    expect(rejection(s, "a", ASIRI_YUKLEME_CAP_MS - 1)).toBeNull();
    expect(rejection(s, "a", ASIRI_YUKLEME_CAP_MS)).toBe("ended");
  });

  it("90 sn sınırı bar dolmadan dolarsa sıralama aynı kuralla verilir, eksi yok", () => {
    let s = start(["a", "b", "c", "d"]);
    s = tap(s, "a", 1_000, 5);
    s = tap(s, "b", 2_000, 3);
    s = tap(s, "c", 3_000, 3);
    expect(awards(s)).toEqual({ a: 2, b: 1, c: 1, d: 0 });
    const rev = asiriYukleme.publicView(finish(s), ctx(T0 + ASIRI_YUKLEME_CAP_MS)).reveal;
    expect(rev).toMatchObject({ total: 11, exploders: [] });
  });

  it("bar dolduysa pencere her zaman tam 3 sn: 89,5 sn'de dolan bar 92,5 sn'de biter", () => {
    let s = start();
    s = tap(s, "a", 89_500, 10);
    for (let i = 0; i < 9; i++) s = tap(s, "b", 89_500, 10); // 100
    expect(s.dangerAt).toBe(T0 + 89_500);
    expect(asiriYuklemeEndAt(s)).toBe(T0 + 92_500);
    // 90. sn sınırı bar dolduğu için uygulanmaz: 90. sn'deki tık kabul edilir ve "sonra" sayılır.
    expect(rejection(s, "c", ASIRI_YUKLEME_CAP_MS)).toBeNull();
    s = tap(s, "c", ASIRI_YUKLEME_CAP_MS);
    expect(s.after.c).toBe(1);
    s = tap(s, "a", 92_499);
    expect(rejection(s, "c", 92_500)).toBe("ended");
    expect(asiriYukleme.tick(s, ctx(T0 + 92_499)).over).toBe(false);
    expect(asiriYukleme.isFinished(s, ctx(T0 + 92_500 + ASIRI_YUKLEME_OUTRO_MS - 1))).toBe(false);
    expect(asiriYukleme.isFinished(s, ctx(T0 + 92_500 + ASIRI_YUKLEME_OUTRO_MS))).toBe(true);
    // a ve c patladı, sonra 1'er: eşit → ikisi de −1; b tek patlamayan lider +2.
    expect(awards(s, 92_500)).toEqual({ a: -1, b: 2, c: -1 });
  });

  it("bar 90. sn'de hâlâ dolmadıysa tur 90. sn'de biter (sonraki tık dolduramaz)", () => {
    let s = start();
    for (let i = 0; i < 9; i++) s = tap(s, "a", 89_900, 10); // 90
    expect(rejection(s, "b", ASIRI_YUKLEME_CAP_MS, 10)).toBe("ended");
    expect(asiriYuklemeEndAt(s)).toBe(T0 + ASIRI_YUKLEME_CAP_MS);
  });

  it("katılımcı olmayan reddedilir; başlangıçtan önce reddedilir", () => {
    expect(rejection(start(), "x", 100)).toBe("not_participant");
    expect(rejection(start(), "a", -1)).toBe("not_started");
  });

  it("bağlantısı kopmuş oyuncunun tıkı da işlenir (hedef yok)", () => {
    const r = asiriYukleme.reduce(start(), "a", { kind: "tap", count: 2 }, ctx(T0 + 10, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("bitiş: pencere sonu + sonuç süresi (patlama bitişi öne çekmez)", () => {
    const s = tap(filled(1_000), "a", 2_000);
    const end = T0 + WINDOW_END + ASIRI_YUKLEME_OUTRO_MS;
    expect(asiriYukleme.isFinished(s, ctx(end - 1))).toBe(false);
    expect(asiriYukleme.isFinished(s, ctx(end))).toBe(true);
  });

  it("tick bayrağı yalnız tur bitince değişir", () => {
    const s = filled(1_000);
    expect(asiriYukleme.tick(s, ctx(T0 + 2_000))).toBe(s);
    const t = asiriYukleme.tick(s, ctx(T0 + WINDOW_END));
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

  it("kurulum bilgilendirmesi yeni kuralı söyler; en az tıklayan cezası yok", () => {
    const text = asiriYukleme.briefing.steps.join(" ");
    expect(text).toContain("herkes patlar");
    expect(text).toContain("−2");
    expect(text).not.toContain("en az");
  });
});

describe("asiri-yukleme puanlama", () => {
  it("tek patlayan −1 alır ve sıralamaya girmez; kalanlar +2/+1", () => {
    let s = filled(1_000); // a 40, b 35, c 25
    s = tap(s, "a", 2_000); // a en çok tıklayan ama patladı
    expect(awards(s, WINDOW_END)).toEqual({ a: -1, b: 2, c: 1 });
    expect(asiriYukleme.result(finish(s, WINDOW_END)).miniScores).toEqual({ a: -1, b: 2, c: 1 });
  });

  it("çoklu patlama: 100'den sonra en çok basan tek kişi −2, diğer patlayanlar −1", () => {
    let s = start(["a", "b", "c", "d"]);
    for (let i = 0; i < 4; i++) s = tap(s, "a", 500, 10);
    for (let i = 0; i < 3; i++) s = tap(s, "b", 500, 10);
    for (let i = 0; i < 2; i++) s = tap(s, "c", 500, 10);
    s = tap(s, "d", 500, 10); // 100
    s = tap(s, "b", 1_000, 4);
    s = tap(s, "c", 1_200, 1);
    s = tap(s, "b", 1_400, 2); // b sonra 6, c sonra 1
    expect(s.after).toEqual({ a: 0, b: 6, c: 1, d: 0 });
    // Patlamayanlar a (40) ve d (10): a +2, d +1.
    expect(awards(s, 500 + ASIRI_YUKLEME_DANGER_MS)).toEqual({ a: 2, b: -2, c: -1, d: 1 });
  });

  it("100'den sonra en çok basanlar eşitse hepsi −1 (kimse −2 almaz)", () => {
    expect(pts(["a", "b", "c", "d"], { a: 40, b: 30, c: 20, d: 10 }, { a: 3, b: 3, c: 1 })).toEqual({
      a: -1,
      b: -1,
      c: -1,
      d: 2,
    });
    expect(pts(["a", "b", "c"], { a: 40, b: 30, c: 30 }, { a: 2, b: 2, c: 2 })).toEqual({
      a: -1,
      b: -1,
      c: -1,
    });
  });

  it("yalnız bir kişi patladıysa −1 (çok bassa bile −2 değil)", () => {
    expect(pts(["a", "b", "c"], { a: 40, b: 30, c: 30 }, { b: 9 })).toEqual({ a: 2, b: -1, c: 1 });
  });

  it("patlayan sıralamaya girmez: 100'den önce lider olsa bile ödül almaz", () => {
    expect(pts(["a", "b", "c"], { a: 80, b: 15, c: 5 }, { a: 1 })).toEqual({ a: -1, b: 2, c: 1 });
  });

  it("liderler eşitse hepsi +1, +2 ve ikinci sıra verilmez", () => {
    expect(pts(["a", "b", "c"], { a: 30, b: 30, c: 10 })).toEqual({ a: 1, b: 1, c: 0 });
    expect(pts(["a", "b", "c", "d"], { a: 30, b: 30, c: 40, d: 0 }, { c: 2 })).toEqual({
      a: 1,
      b: 1,
      c: -1,
      d: 0,
    });
  });

  it("tek lider +2; ikinci sırada eşitlik: hepsi +1; diğerleri 0", () => {
    expect(pts(["a", "b", "c", "d"], { a: 30, b: 20, c: 20, d: 5 })).toEqual({ a: 2, b: 1, c: 1, d: 0 });
  });

  it("kimse patlamazsa hiç eksi puan yok (en az tıklayan cezası kalktı)", () => {
    const p = pts(["a", "b", "c", "d"], { a: 50, b: 30, c: 15, d: 5 });
    expect(p).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    expect(Math.min(...Object.values(p))).toBe(0);
  });

  it("hiç tıklamayan ödül almaz; kimse tıklamadıysa kimse puan almaz", () => {
    expect(pts(["a", "b", "c"], { a: 4, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(pts(["a", "b"], { a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
    // Tek tıklayan patlamayan +2 alır, ikinci sıra yoksa kimse +1 almaz.
    expect(pts(["a", "b", "c"], { a: 3, b: 0, c: 60 }, { c: 1 })).toEqual({ a: 2, b: 0, c: -1 });
  });

  it("herkes patlarsa sıralama ödülü yok", () => {
    expect(pts(["a", "b"], { a: 50, b: 50 }, { a: 2, b: 1 })).toEqual({ a: -2, b: -1 });
  });

  it("patlayanlar katılım sırasıyla listelenir", () => {
    expect(asiriYuklemeExploders(["c", "a", "b"], { a: 1, b: 0, c: 4 })).toEqual(["c", "a"]);
  });

  it("sonuç ve result() aynı puanları verir", () => {
    let s = filled(1_000);
    s = tap(s, "c", 2_000, 2);
    s = tap(s, "b", 2_100);
    s = finish(s, WINDOW_END);
    const rev = asiriYukleme.publicView(s, ctx(T0 + WINDOW_END)).reveal;
    expect(rev?.points).toEqual({ a: 2, b: -1, c: -2 });
    expect(asiriYukleme.result(s).awards).toEqual(rev?.points);
    expect(asiriYukleme.result(s).miniScores).toEqual(rev?.points);
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

  it("pencerede patlayanlar olsa da tur bitene kadar hiçbir görünümde iz yok", () => {
    let s = filled(1_000);
    s = tap(s, "a", 1_500, 4);
    s = tap(s, "c", 1_600);
    const pub = asiriYukleme.publicView(s, ctx(T0 + 1_700));
    expect(pub).toEqual({ startedAt: T0, danger: true, reveal: null });
    for (const who of ["a", "b", "c", null]) {
      const v = asiriYukleme.view(s, who, ctx(T0 + 1_700));
      expect(Object.keys(v)).toEqual(["participant"]);
      const json = JSON_OF(v);
      for (const word of ["exploders", "before", "after", "total"]) expect(json).not.toContain(word);
    }
    for (const word of ["exploders", "before", "after", "total", "105"])
      expect(JSON_OF(pub)).not.toContain(word);
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

  it("pencere bitişinden 1 ms önce hâlâ gizli, bitişte herkese açılır", () => {
    let s = filled(1_000);
    s = tap(s, "c", 2_000, 3);
    expect(asiriYukleme.publicView(s, ctx(T0 + WINDOW_END - 1)).reveal).toBeNull();
    const rev = asiriYukleme.publicView(s, ctx(T0 + WINDOW_END)).reveal;
    expect(rev).toEqual({
      total: 103,
      before: { a: 40, b: 35, c: 25 },
      after: { a: 0, b: 0, c: 3 },
      exploders: ["c"],
      points: { a: 2, b: 1, c: -1 },
    });
  });
});
