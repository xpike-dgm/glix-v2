import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type ButonaBasState, butonaBas, butonaBasAwards, butonaBasPressTime } from "./index.js";
import {
  BUTONA_BAS_AT_MAX_AGE_MS,
  BUTONA_BAS_COOLDOWN_MS,
  BUTONA_BAS_DURATION_MS,
  BUTONA_BAS_GAP_MS,
  BUTONA_BAS_ROUND_MS,
  BUTONA_BAS_ROUNDS,
  BUTONA_BAS_WINDOWS_MS,
  butonaBasCrowdNeed,
  butonaBasHighlights,
  butonaBasRoundOffset,
  butonaBasWindowMs,
} from "./types.js";

const T0 = 1_000_000;
const ABC = ["a", "b", "c"];
const ctx = (now: number, connected: readonly string[] = ABC) => ({ now, rng: createRng(1), connected });
const start = (players = ABC): ButonaBasState => butonaBas.setup(players, ctx(T0, players));

/** Sunucunun `at` anında aldığı basış; `touch` verilirse istemcinin bildirdiği dokunma anı (oyun başından ms). */
function press(
  state: ButonaBasState,
  id: string,
  at: number,
  touch?: number,
  connected: readonly string[] = state.players,
): ButonaBasState {
  const action =
    touch === undefined ? { kind: "press" as const } : { kind: "press" as const, at: T0 + touch };
  const r = butonaBas.reduce(state, id, action, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const settleAt = (s: ButonaBasState, at: number) => butonaBas.tick(s, ctx(T0 + at));
/** Pencere kapanıştan 250 ms sonra puanlanır: `closes` (oyun başından) + gecikme. */
const scored = (closes: number) => closes + BUTONA_BAS_AT_MAX_AGE_MS;
const R2 = butonaBasRoundOffset(1); // 18_000
const R3 = butonaBasRoundOffset(2); // 36_000

describe("butona-bas kuralları", () => {
  it("setup süreyi ve sıfır puanları kurar", () => {
    const s = start();
    expect(s.startedAt).toBe(T0);
    expect(s.endsAt).toBe(T0 + 51_000);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.roundScores).toEqual({ a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0] });
  });

  it("aynı pencerede iki farklı oyuncu: ikisi de +1", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "b", 290);
    s = settleAt(s, scored(310));
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
    expect(s.recent).toEqual([
      {
        round: 0,
        index: 0,
        pressers: ["a", "b"],
        outcome: "match",
        points: 1,
        crowd: null,
        settledAt: T0 + 560,
      },
    ]);
  });

  it("üç oyuncu eşleşirse üçü de +1 (3 kişide kalabalık bonusu yok)", () => {
    let s = start();
    for (const id of ABC) s = press(s, id, 5_000);
    s = settleAt(s, 6_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 1 });
    expect(s.recent[0]?.crowd).toBeNull();
  });

  it("tek basan -1 alır", () => {
    let s = start();
    s = press(s, "a", 100);
    s = settleAt(s, scored(400));
    expect(s.scores).toEqual({ a: -1, b: 0, c: 0 });
    expect(s.recent[0]).toMatchObject({ outcome: "solo", points: -1 });
  });

  it("kimse basmazsa puan ve geçmiş değişmez", () => {
    const s = settleAt(start(), 10_000);
    expect(s.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(s.recent).toEqual([]);
  });

  it("tick değişiklik yoksa aynı nesneyi döner", () => {
    const s = start();
    expect(settleAt(s, 1_000)).toBe(s);
  });

  it("bitiş sınırı: 50999 ms kabul, 51000 ms ret", () => {
    const s = start();
    const ok = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 50_999));
    expect(isRejected(ok)).toBe(false);
    const late = butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + BUTONA_BAS_DURATION_MS));
    expect(isRejected(late)).toBe(true);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 70_000)))).toBe(true);
  });

  it("son pencere bitişte puanlanır ve oyun biter", () => {
    let s = start();
    s = press(s, "a", 50_900);
    s = press(s, "b", 50_999);
    expect(butonaBas.isFinished(s, ctx(T0 + 50_999))).toBe(false);
    expect(butonaBas.isFinished(s, ctx(T0 + 51_000))).toBe(true);
    s = settleAt(s, 51_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("result tick çağrılmamış pencereleri de sayar", () => {
    let s = start();
    s = press(s, "a", 100);
    s = press(s, "b", 200);
    expect(butonaBas.result(s).miniScores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("oyuncu olmayan basamaz", () => {
    const r = butonaBas.reduce(start(), "x", { kind: "press" }, ctx(T0 + 10));
    expect(isRejected(r)).toBe(true);
  });

  it("girdi durumu değiştirilmez", () => {
    const s = start();
    const snapshot = JSON.stringify(s);
    const next = settleAt(press(press(s, "a", 10), "b", 20), 1_000);
    expect(next.scores.a).toBe(1);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("recent en fazla 8 kayıt tutar, en yenisi sonda, boş pencereler yok", () => {
    let s = start();
    for (let i = 0; i < 12; i++) s = press(s, "a", i * 1_100);
    s = settleAt(s, 12 * 1_100);
    expect(s.recent).toHaveLength(8);
    expect(s.recent.map((w) => w.index)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);
    expect(s.recent.every((w) => w.round === 0)).toBe(true);
  });

  it("parseAction: press ve isteğe bağlı dokunma anı", () => {
    expect(butonaBas.parseAction({ kind: "press" })).toEqual({ kind: "press" });
    expect(butonaBas.parseAction({ kind: "press", at: 1234 })).toEqual({ kind: "press", at: 1234 });
    for (const bad of [
      null,
      1,
      "press",
      [],
      {},
      { kind: "x" },
      { kind: "press", extra: 1 },
      { kind: "press", at: "1" },
      { kind: "press", at: Number.NaN },
      { kind: "press", at: -5 },
      { kind: "press", at: 1, extra: 1 },
    ]) {
      expect(butonaBas.parseAction(bad)).toBeNull();
    }
  });
});

describe("butona-bas BB-M1: 1 sn dolum", () => {
  it("sayılan basıştan sonra 1000 ms içinde gelen basış sessizce yok sayılır (ceza yok)", () => {
    let s = start();
    s = press(s, "a", 100);
    const same = press(s, "a", 600);
    expect(same).toBe(s);
    const edge = press(s, "a", 100 + BUTONA_BAS_COOLDOWN_MS - 1);
    expect(edge).toBe(s);
    s = press(s, "a", 100 + BUTONA_BAS_COOLDOWN_MS);
    s = settleAt(s, 3_000);
    // İki ayrı tek basış: −1 −1; yok sayılan basışlar hiçbir pencere açmaz.
    expect(s.scores.a).toBe(-2);
    expect(s.recent).toHaveLength(2);
  });

  it("aynı pencerede tekrar basış tek sayılır (dolum sayesinde)", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "a", 100);
    s = press(s, "a", 299);
    s = settleAt(s, 1_000);
    expect(s.scores.a).toBe(-1);
    expect(s.recent[0]?.pressers).toEqual(["a"]);
  });

  it("yok sayılan basış başkasının penceresine de girmez", () => {
    let s = start();
    s = press(s, "a", 0);
    s = press(s, "b", 900); // b'nin ilk basışı: tek
    s = press(s, "a", 950); // a dolumda: sayılmaz
    s = settleAt(s, 3_000);
    expect(s.scores).toEqual({ a: -1, b: -1, c: 0 });
  });

  it("bir turda en çok 15 sayılan basış", () => {
    let s = start();
    for (let t = 0; t < BUTONA_BAS_ROUND_MS; t += 50) s = press(s, "a", t);
    s = settleAt(s, BUTONA_BAS_ROUND_MS);
    expect(s.scores.a).toBe(-15);
  });

  it("bekleme dokunma anına göre ölçülür; her tur dolu başlar", () => {
    let s = start();
    s = press(s, "a", 14_900);
    // 2. turun ilk anı: 3 sn ara dolumdan uzun.
    const r2 = press(s, "a", R2);
    expect(r2).not.toBe(s);
    // Dokunma anı 1000 ms'yi doldurduysa geç varış sayılır.
    let t = start();
    t = press(t, "a", 1_000);
    t = press(t, "a", 2_100, 2_000);
    expect(t.lastAt.a).toBe(T0 + 2_000);
  });

  it("görünüm dolum bitişini bildirir", () => {
    const s = press(start(), "a", 100);
    expect(butonaBas.view(s, "a", ctx(T0 + 200)).readyAt).toBe(T0 + 1_100);
    expect(butonaBas.view(s, "a", ctx(T0 + 1_100)).readyAt).toBeNull();
    expect(butonaBas.view(s, "b", ctx(T0 + 200)).readyAt).toBeNull();
  });
});

describe("butona-bas BB-M3: kayan pencere", () => {
  it("pencere ilk basışla açılır: eski ızgara sınırı (300 ms) iki basışı ayırmaz", () => {
    let s = start();
    s = press(s, "a", 295);
    s = press(s, "b", 305);
    s = settleAt(s, 1_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("ilk basandan sonra pencere süresi içinde basan girer, sonra basan yeni pencere açar", () => {
    let same = start();
    same = press(same, "a", 1_000);
    same = press(same, "b", 1_299);
    same = settleAt(same, 2_000);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });

    let split = start();
    split = press(split, "a", 1_000);
    split = press(split, "b", 1_300);
    split = settleAt(split, 2_000);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
    expect(split.recent.map((w) => w.index)).toEqual([0, 1]);
  });

  it("zincir uzamaz: üçüncü basış ilk basandan ölçülür", () => {
    let s = start();
    s = press(s, "a", 0);
    s = press(s, "b", 250);
    s = press(s, "c", 320);
    s = settleAt(s, 2_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: -1 });
  });

  it("pencere tur bitişini geçemez; tur bitince hemen puanlanır", () => {
    let s = start();
    s = press(s, "a", 14_900);
    s = press(s, "b", 14_999);
    expect(settleAt(s, 14_999).scores).toEqual({ a: 0, b: 0, c: 0 });
    s = settleAt(s, 15_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("pencere kapanıştan 250 ms sonra puanlanır (önce değil)", () => {
    let s = start();
    s = press(s, "a", 1_000);
    expect(settleAt(s, 1_300 + BUTONA_BAS_AT_MAX_AGE_MS - 1).scores.a).toBe(0);
    s = settleAt(s, 1_300 + BUTONA_BAS_AT_MAX_AGE_MS);
    expect(s.scores.a).toBe(-1);
  });

  it("açık pencere varken bekleyen sonuç olsa da yeni pencere açılabilir", () => {
    let s = start();
    s = press(s, "a", 1_000);
    s = press(s, "b", 1_350); // a'nın penceresi kapandı ama puanlanmadı
    s = settleAt(s, 1_550);
    expect(s.scores).toEqual({ a: -1, b: 0, c: 0 });
    s = settleAt(s, 1_900);
    expect(s.scores).toEqual({ a: -1, b: -1, c: 0 });
  });
});

describe("butona-bas BB-M4: dokunma anı", () => {
  it("geç ulaşan ama aynı anda dokunulan basış aynı pencereye girer", () => {
    let s = start();
    s = press(s, "a", 2_000, 2_000);
    // b de 2000'de dokundu, mobil veride 200 ms geç ulaştı (3. turun penceresinden uzun).
    s = press(s, "b", 2_200, 2_010);
    s = settleAt(s, 3_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("3. turda 120 ms'lik pencerede 150 ms gecikme eşleşmeyi bozmaz", () => {
    let s = start();
    s = press(s, "a", R3 + 1_000, R3 + 1_000);
    s = press(s, "b", R3 + 1_150, R3 + 1_005);
    s = settleAt(s, R3 + 2_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("geç ulaşan erken dokunuş pencerenin açılışını öne çeker", () => {
    let s = start();
    s = press(s, "b", 2_100, 2_100);
    s = press(s, "a", 2_200, 2_000); // önce dokunuldu
    s = press(s, "c", 2_310, 2_310); // a'dan 310 ms sonra: a'nın penceresine girmez
    s = settleAt(s, 4_000);
    expect(s.scores).toEqual({ a: 1, b: 1, c: -1 });
    expect(s.recent[0]?.pressers).toEqual(["a", "b"]);
  });

  it("250 ms'den eski, turdan önce ya da gelecekten gelen an yerine sunucunun aldığı an kullanılır", () => {
    expect(butonaBasPressTime(undefined, 0, 1_000)).toBe(1_000);
    expect(butonaBasPressTime(750, 0, 1_000)).toBe(750);
    expect(butonaBasPressTime(749, 0, 1_000)).toBe(1_000);
    expect(butonaBasPressTime(1_200, 0, 1_000)).toBe(1_000);
    expect(butonaBasPressTime(900, 950, 1_000)).toBe(1_000);
    let s = start();
    s = press(s, "a", 2_000, 1_000); // çok eski: 2000 sayılır
    expect(s.lastAt.a).toBe(T0 + 2_000);
  });

  it("sonucu görüp geriye tarihli basışla pencereye girilemez", () => {
    let s = start();
    s = press(s, "a", 1_000, 1_000);
    s = settleAt(s, 1_550); // puanlandı: a tek kaldı
    expect(s.scores.a).toBe(-1);
    // b sonucu gördü, en çok 250 ms geriye tarihleyebilir: 1300, pencere 1000..1300 kapandı.
    s = press(s, "b", 1_550, 1_300);
    s = settleAt(s, 3_000);
    expect(s.scores).toEqual({ a: -1, b: -1, c: 0 });
  });

  it("turun bitişinden sonra gelen basış dokunma anı turun içinde olsa da reddedilir", () => {
    const s = start();
    const late = butonaBas.reduce(s, "a", { kind: "press", at: T0 + 14_950 }, ctx(T0 + 15_050));
    expect(late).toEqual({ rejected: "between_rounds" });
  });
});

describe("butona-bas BB-M2: kalabalık bonusu", () => {
  const P5 = ["a", "b", "c", "d", "e"];
  const s5 = () => start(P5);

  it("eşik: 4+ bağlı katılımcıda yarıdan fazlası", () => {
    expect([2, 3, 4, 5, 6, 7, 8].map(butonaBasCrowdNeed)).toEqual([null, null, 3, 3, 4, 4, 5]);
  });

  it("5 kişide 3 kişi aynı pencerede: her biri +2, KALABALIK", () => {
    let s = s5();
    for (const id of ["a", "b", "c"]) s = press(s, id, 1_000);
    s = press(s, "d", 3_000);
    s = press(s, "e", 3_000);
    s = settleAt(s, 5_000);
    expect(s.scores).toEqual({ a: 2, b: 2, c: 2, d: 1, e: 1 });
    expect(s.recent.map((w) => [w.points, w.crowd])).toEqual([
      [2, "crowd"],
      [1, null],
    ]);
  });

  it("herkes basarsa TAM EKİP (yine +2)", () => {
    let s = s5();
    for (const id of P5) s = press(s, id, 1_000);
    s = settleAt(s, 2_000);
    expect(Object.values(s.scores)).toEqual([2, 2, 2, 2, 2]);
    expect(s.recent[0]?.crowd).toBe("full");
  });

  it("2 ve 3 kişide eşleşme hep +1", () => {
    let two = start(["a", "b"]);
    two = press(two, "a", 1_000);
    two = press(two, "b", 1_000);
    two = settleAt(two, 2_000);
    expect(two.scores).toEqual({ a: 1, b: 1 });
    expect(two.recent[0]?.crowd).toBeNull();
  });

  it("eşik bağlı katılımcıya bakar: kopan oyuncu kalabalığı zorlaştırmaz", () => {
    // 5 katılımcı, 1'i koptu: 4 bağlı, eşik 3.
    const on = ["a", "b", "c", "d"];
    let s = s5();
    for (const id of ["a", "b", "c"]) s = press(s, id, 1_000, undefined, on);
    s = settleAt(s, 2_000);
    expect(s.recent[0]).toMatchObject({ points: 2, crowd: "crowd" });
    // 3 bağlı kaldıysa bonus yok.
    let t = s5();
    for (const id of ["a", "b", "c"]) t = press(t, id, 1_000, undefined, ["a", "b", "c"]);
    t = settleAt(t, 2_000);
    expect(t.recent[0]).toMatchObject({ points: 1, crowd: null });
  });

  it("eşik pencereyi açan basıştaki sayıdır (pencere içinde biri koparsa değişmez)", () => {
    let s = s5();
    s = press(s, "a", 1_000, undefined, P5);
    s = press(s, "b", 1_050, undefined, ["a", "b", "c", "d"]);
    s = press(s, "c", 1_100, undefined, ["a", "b", "c", "d"]);
    s = settleAt(s, 2_000);
    // Açılışta 5 bağlı: eşik 3, basan 3 → kalabalık ama tam ekip değil.
    expect(s.recent[0]).toMatchObject({ points: 2, crowd: "crowd" });
  });

  it("tek basış −1 ve normal eşleşme +1 aynen kalır", () => {
    let s = s5();
    s = press(s, "a", 1_000);
    s = press(s, "b", 3_000);
    s = press(s, "c", 3_000);
    s = settleAt(s, 5_000);
    expect(s.scores).toEqual({ a: -1, b: 1, c: 1, d: 0, e: 0 });
  });
});

describe("butona-bas ödüller (BB-M5)", () => {
  it("tek lider +2, ikinci +1, diğerleri 0", () => {
    expect(butonaBasAwards({ a: 5, b: 3, c: 1 })).toEqual({ a: 2, b: 1 });
  });
  it("ikincilik eşitse eşitlerin hepsi +1", () => {
    expect(butonaBasAwards({ a: 5, b: 3, c: 3, d: 1 })).toEqual({ a: 2, b: 1, c: 1 });
  });
  it("lider eşitse liderler yalnız +1", () => {
    expect(butonaBasAwards({ a: 5, b: 5, c: 3 })).toEqual({ a: 1, b: 1 });
  });
  it("herkes eşit ve > 0 ise herkes +1", () => {
    expect(butonaBasAwards({ a: 5, b: 5, c: 5, d: 5 })).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });
  it("hiç puanı olmayan ödül almaz: herkes 0 ise ödül yok", () => {
    expect(butonaBasAwards({ a: 0, b: 0, c: 0 })).toEqual({});
    expect(butonaBasAwards({ a: 0, b: -2, c: -2 })).toEqual({});
  });
  it("sıradaki 0 ya da eksi ise +1 verilmez", () => {
    expect(butonaBasAwards({ a: 3, b: 0, c: -1 })).toEqual({ a: 2 });
    expect(butonaBasAwards({ a: 3, b: 1, c: 0 })).toEqual({ a: 2, b: 1 });
  });
  it("kimse basmazsa result ödül vermez", () => {
    const r = butonaBas.result(settleAt(start(), 51_000));
    expect(r.miniScores).toEqual({ a: 0, b: 0, c: 0 });
    expect(r.awards).toEqual({});
  });
  it("result ödülleri mini puanlardan üretir", () => {
    let s = start();
    s = press(s, "a", 0);
    s = press(s, "b", 0);
    s = press(s, "a", 1_200);
    s = press(s, "b", 1_200);
    s = press(s, "c", 2_400);
    s = settleAt(s, 51_000);
    const r = butonaBas.result(s);
    expect(r.miniScores).toEqual({ a: 2, b: 2, c: -1 });
    expect(r.awards).toEqual({ a: 1, b: 1 });
  });
});

describe("butona-bas görünüm", () => {
  it("oyuncu ve izleyici görünümü", () => {
    let s = start();
    s = press(s, "a", 10);
    const mine = butonaBas.view(s, "a", ctx(T0 + 20));
    expect(mine.myScore).toBe(0);
    expect(mine.pressedThisWindow).toBe(true);
    expect(butonaBas.view(s, "b", ctx(T0 + 20)).pressedThisWindow).toBe(false);
    const spectator = butonaBas.view(s, null, ctx(T0 + 20));
    expect(spectator).toEqual({ myScore: null, pressedThisWindow: false, readyAt: null });
  });

  it("herkese açık görünüm herkes için aynıdır ve kişisel alan içermez", () => {
    let s = start();
    s = press(s, "a", 10);
    const pub = butonaBas.publicView(s, ctx(T0 + 20));
    expect(pub.windowMs).toBe(300);
    expect(pub.endsAt - pub.startedAt).toBe(51_000);
    expect([pub.round, pub.rounds, pub.phase]).toEqual([1, 3, "play"]);
    expect(pub.scores).toEqual({ a: 0, b: 0, c: 0 });
    expect(pub.final).toBeNull();
    expect(Object.keys(pub).sort()).toEqual([
      "endsAt",
      "final",
      "phase",
      "phaseEndsAt",
      "recent",
      "round",
      "roundScores",
      "rounds",
      "scores",
      "startedAt",
      "windowMs",
    ]);
    expect(Object.keys(butonaBas.view(s, "a", ctx(T0 + 20))).sort()).toEqual([
      "myScore",
      "pressedThisWindow",
      "readyAt",
    ]);
    expect(JSON.stringify(pub)).not.toContain("presses");
  });

  it("pencere kapanınca pressedThisWindow sıfırlanır", () => {
    const s = press(start(), "a", 10);
    expect(butonaBas.view(s, "a", ctx(T0 + 309)).pressedThisWindow).toBe(true);
    expect(butonaBas.view(s, "a", ctx(T0 + 310)).pressedThisWindow).toBe(false);
  });

  it("görünümü değiştirmek durumu etkilemez", () => {
    let s = start();
    s = press(s, "a", 10);
    s = press(s, "b", 20);
    s = settleAt(s, 1_000);
    const v = butonaBas.publicView(s, ctx(T0 + 1_000));
    v.scores.a = 99;
    v.recent[0]?.pressers.push("z");
    const rs = v.roundScores.a;
    if (rs) rs[0] = 50;
    expect(s.scores.a).toBe(1);
    expect(s.roundScores.a).toEqual([1, 0, 0]);
    expect(s.recent[0]?.pressers).toEqual(["a", "b"]);
  });

  it("tur puanları ayrı tutulur (BB-U5)", () => {
    let s = start();
    s = press(s, "a", 100);
    s = press(s, "b", 150);
    s = press(s, "a", R2 + 100);
    s = press(s, "b", R3 + 100);
    s = press(s, "c", R3 + 100);
    s = settleAt(s, 51_000);
    expect(butonaBas.publicView(s, ctx(T0 + 51_000)).roundScores).toEqual({
      a: [1, -1, 0],
      b: [1, 0, 1],
      c: [0, 0, 1],
    });
  });

  it("oyun bitince son açılış verisi: ortak pencereler ve tek basışlar (BB-U7)", () => {
    let s = start();
    for (const at of [100, 2_000, 4_000]) {
      s = press(s, "a", at);
      s = press(s, "b", at);
    }
    s = press(s, "c", 6_000);
    s = press(s, "c", 8_000);
    s = press(s, "a", 10_000);
    s = press(s, "c", 10_000);
    // Tick çağrılmadan da bitişte her şey puanlanmış görünür.
    const pub = butonaBas.publicView(s, ctx(T0 + 51_000));
    expect(pub.phase).toBe("over");
    expect(pub.final).toEqual({
      pairs: [
        { a: "a", b: "b", count: 3 },
        { a: "a", b: "c", count: 1 },
      ],
      solos: { c: 2 },
    });
    const h = butonaBasHighlights(pub.final ?? { pairs: [], solos: {} }, ABC);
    expect(h).toEqual({ pair: { a: "a", b: "b", count: 3 }, lone: { id: "c", count: 2 } });
    expect(butonaBasHighlights({ pairs: [], solos: {} }, ABC)).toEqual({ pair: null, lone: null });
  });
});

describe("butona-bas determinizm", () => {
  it("aynı girdiler aynı sonucu verir", () => {
    const run = () => {
      const rng = createRng(77);
      const ids = ["a", "b", "c", "d"];
      let s = start(ids);
      for (let t = 0; t < 51_000; t += 50) {
        const id = ids[rng.int(4)] as string;
        if (rng.next() < 0.5) {
          const touch = rng.next() < 0.5 ? T0 + t - rng.int(300) : undefined;
          const action =
            touch === undefined ? { kind: "press" as const } : { kind: "press" as const, at: touch };
          const r = butonaBas.reduce(s, id, action, ctx(T0 + t, ids));
          if (!isRejected(r)) s = r;
        }
        s = settleAt(s, t);
      }
      s = settleAt(s, 51_000);
      return butonaBas.result(s);
    };
    expect(run()).toEqual(run());
  });

  it("tick sıklığı sonucu değiştirmez (geç ulaşan dokunuşlar dahil)", () => {
    const presses: [string, number, number | undefined][] = [
      ["a", 10, undefined],
      ["b", 250, 200],
      ["c", 700, undefined],
      ["a", 1_100, 1_000],
      ["b", 1_200, undefined],
      ["c", 1_400, 1_190],
      ["a", R2 + 10, undefined],
      ["c", R2 + 150, R2 + 20],
      ["b", R2 + 210, undefined],
      ["c", R3 + 5, undefined],
      ["a", R3 + 200, R3 + 50],
      ["b", R3 + 4_000, undefined],
      ["c", 50_990, 50_800],
    ];
    const play = (step: number) => {
      let s = start();
      for (const [id, at, touch] of presses) {
        if (step > 0) s = settleAt(s, at);
        s = press(s, id, at, touch);
      }
      for (let t = 0; step > 0 && t <= 51_000; t += step) s = settleAt(s, t);
      return butonaBas.result(s);
    };
    expect(play(0)).toEqual(play(0));
    expect(play(100)).toEqual(play(0));
    expect(play(7)).toEqual(play(0));
    expect(play(1)).toEqual(play(0));
  });
});

describe("butona-bas O8: 3 tur, daralan pencere", () => {
  it("sabitler: 3 tur, pencere 300/200/120, tur 15 sn, ara 3 sn, toplam 51 sn", () => {
    expect(BUTONA_BAS_ROUNDS).toBe(3);
    expect([...BUTONA_BAS_WINDOWS_MS]).toEqual([300, 200, 120]);
    expect([0, 1, 2].map(butonaBasWindowMs)).toEqual([300, 200, 120]);
    expect(BUTONA_BAS_ROUND_MS).toBe(15_000);
    expect(BUTONA_BAS_GAP_MS).toBe(3_000);
    expect(BUTONA_BAS_DURATION_MS).toBe(51_000);
    expect(BUTONA_BAS_COOLDOWN_MS).toBe(1_000);
    expect(BUTONA_BAS_AT_MAX_AGE_MS).toBe(250);
    expect([R2, R3]).toEqual([18_000, 36_000]);
  });

  it("2. turda pencere 200 ms: 199 ms aynı pencere, 200 ms sonraki", () => {
    let same = start();
    same = press(same, "a", R2 + 500);
    same = press(same, "b", R2 + 699);
    same = settleAt(same, R2 + 2_000);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });
    let split = start();
    split = press(split, "a", R2 + 500);
    split = press(split, "b", R2 + 700);
    split = settleAt(split, R2 + 2_000);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
    expect(split.recent.map((w) => [w.round, w.index])).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });

  it("3. turda pencere 120 ms: 119 ms aynı pencere, 120 ms sonraki", () => {
    let same = start();
    same = press(same, "a", R3 + 500);
    same = press(same, "b", R3 + 619);
    same = settleAt(same, R3 + 2_000);
    expect(same.scores).toEqual({ a: 1, b: 1, c: 0 });
    let split = start();
    split = press(split, "a", R3 + 500);
    split = press(split, "b", R3 + 620);
    split = settleAt(split, R3 + 2_000);
    expect(split.scores).toEqual({ a: -1, b: -1, c: 0 });
  });

  it("turlar arası ara: basış reddedilir, pencere/ceza oluşmaz", () => {
    const s = start();
    for (const at of [15_000, 16_500, 17_999, 33_000, 34_999]) {
      expect(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + at))).toEqual({
        rejected: "between_rounds",
      });
    }
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 14_999)))).toBe(false);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 18_000)))).toBe(false);
    expect(isRejected(butonaBas.reduce(s, "a", { kind: "press" }, ctx(T0 + 36_000)))).toBe(false);
    expect(butonaBas.view(s, "a", ctx(T0 + 16_000)).pressedThisWindow).toBe(false);
  });

  it("2. turun ilk basışında dokunma anı turun başından önceye çekilemez", () => {
    let s = start();
    s = press(s, "a", R2 + 100, R2 - 50);
    expect(s.lastAt.a).toBe(T0 + R2 + 100);
  });

  it("genel skor yalnız sonda, toplama göre bir kez: tek lider +2, ikinci +1", () => {
    let s = start();
    for (const [at, ids] of [
      [100, ["a", "b", "c"]],
      [R2 + 50, ["a", "b"]],
      [R3 + 50, ["a"]],
      [R3 + 1_500, ["a", "b"]],
    ] as const) {
      for (const id of ids) s = press(s, id, at);
    }
    s = settleAt(s, 51_000);
    expect(butonaBas.result(s).miniScores).toEqual({ a: 2, b: 3, c: 1 });
    expect(butonaBas.result(s).awards).toEqual({ b: 2, a: 1 });
    const mid = settleAt(start(), 20_000);
    expect(butonaBas.result(mid).awards).toEqual({});
  });

  it("görünüm: tur, evre, pencere ve süre bilgisi", () => {
    const s = start();
    const v = (at: number) => butonaBas.publicView(s, ctx(T0 + at));
    expect(v(0)).toMatchObject({
      round: 1,
      rounds: 3,
      phase: "play",
      windowMs: 300,
      phaseEndsAt: T0 + 15_000,
    });
    expect(v(15_000)).toMatchObject({ round: 2, phase: "gap", windowMs: 200, phaseEndsAt: T0 + 18_000 });
    expect(v(18_000)).toMatchObject({ round: 2, phase: "play", windowMs: 200, phaseEndsAt: T0 + 33_000 });
    expect(v(33_000)).toMatchObject({ round: 3, phase: "gap", windowMs: 120, phaseEndsAt: T0 + 36_000 });
    expect(v(36_000)).toMatchObject({ round: 3, phase: "play", windowMs: 120, phaseEndsAt: T0 + 51_000 });
    expect(v(51_000)).toMatchObject({ round: 3, phase: "over", windowMs: 120 });
  });
});

describe("registry", () => {
  it("katalog butona-bas içerir", async () => {
    const { GAMES, getCatalog } = await import("../index.js");
    expect(GAMES["butona-bas"]).toBe(butonaBas);
    expect(getCatalog()).toContainEqual({
      id: "butona-bas",
      name: "Butona Bas",
      minPlayers: 2,
      maxPlayers: 8,
      orientation: "portrait",
    });
  });
  it("anlatım: en fazla 3 madde, BB-U15 metinleri", () => {
    expect(butonaBas.briefing.steps).toEqual([
      "Birlikte bas: aynı anda basanlar +1, tek kalan −1",
      "Bastıktan sonra buton 1 sn dolar; yüksek sesle '3, 2, 1, BAS!' deyin",
      "3 tur: pencere her turda daralır (300, 200, 120 ms)",
    ]);
  });
});

describe("butona-bas bot takvimi", () => {
  it("hem eşleşme hem tek başına basış üretir", async () => {
    const { BOTS, buildActions, buildTicks, runSimulation } = await import("../../testing/index.js");
    const bot = BOTS["butona-bas"];
    if (!bot) throw new Error("bot yok");
    let positive = 0;
    let negative = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const players = ["p1", "p2", "p3", "p4"];
      const out = runSimulation(butonaBas, {
        seed,
        players,
        startedAt: T0,
        actions: buildActions(bot, seed, players, T0),
        ticks: buildTicks(seed, "irregular", T0, bot.durationMs),
        durationMs: bot.durationMs,
      });
      for (const v of Object.values(out.result.miniScores)) {
        if (v > 0) positive++;
        if (v < 0) negative++;
      }
    }
    expect(positive).toBeGreaterThan(0);
    expect(negative).toBeGreaterThan(0);
  });
});

describe("butona-bas nextWake", () => {
  const wake = (s: ButonaBasState, at: number) => butonaBas.nextWake?.(s, ctx(T0 + at)) ?? null;

  it("basış yokken evre sonunu (tur bitişi) bildirir", () => {
    expect(wake(start(), 0)).toBe(T0 + BUTONA_BAS_ROUND_MS);
  });

  it("bekleyen pencerenin puanlanma anını bildirir (kapanış + 250 ms)", () => {
    const s = press(start(), "a", 10);
    expect(wake(s, 10)).toBe(T0 + 10 + 300 + BUTONA_BAS_AT_MAX_AGE_MS);
  });

  it("tur arasında bir sonraki turun başını, oyun sonunda null bildirir", () => {
    const s = start();
    expect(wake(s, BUTONA_BAS_ROUND_MS + 1)).toBe(T0 + R2);
    expect(wake(s, BUTONA_BAS_DURATION_MS)).toBeNull();
  });

  it("uyandırma anında tick görünür bir şeyi gerçekten değiştirir", () => {
    const s = press(start(), "a", 10);
    const at = wake(s, 10) as number;
    expect(butonaBas.tick(s, ctx(at - 1)).scores.a).toBe(0);
    expect(butonaBas.tick(s, ctx(at)).scores.a).toBe(-1);
  });
});
