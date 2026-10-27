import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { deepFreeze } from "../../testing/deep.js";
import {
  kuleUstasi as game,
  KULE_BASE_SPEED,
  KULE_INTRO_MS,
  KULE_PAUSE_MISS_MS,
  KULE_PAUSE_OK_MS,
  KULE_SPEED_CAP,
  KULE_SPEED_START,
  KULE_START_WIDTH,
  KULE_TOTAL_MS,
  KULE_TRACK,
  KULE_TURN_MS,
  type KuleBlock,
  type KulePublicView,
  type KuleState,
  kuleBlockLeft,
  kuleCut,
  kuleDropTime,
  kuleNextSpeed,
} from "./index.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = [], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const start = (n = 4, seed = 1): KuleState => game.setup(ids(n), ctx(T0, ids(n), seed));
const active = (s: KuleState) => s.order[s.turnIndex] as string;
const top = (s: KuleState): KuleBlock => s.tower[s.tower.length - 1] as KuleBlock;
const block = (left: number, width: number): KuleBlock => ({ left, width, perfect: false });

function drop(s: KuleState, who: string, at: number, now = at): KuleState {
  const r = game.reduce(s, who, { kind: "drop", at }, ctx(now));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (s: KuleState, who: string, at: number, now = at) => {
  const r = game.reduce(s, who, { kind: "drop", at }, ctx(now));
  return isRejected(r) ? r.rejected : null;
};
/** Sıranın ilk anında bırakır: blok sol uçtadır (konum 0). */
const dropAtStart = (s: KuleState): KuleState => drop(s, active(s), s.turnStart, s.turnStart + 50);
/** Kayan bloğun sol kenarı `left`'e `tolerance` birimden yakın olduğu ilk geçen süre (ms). */
function elapsedFor(s: KuleState, left: number, tolerance = 0): number {
  for (let e = 0; e < 20_000; e++) {
    const l = kuleBlockLeft(s.turnStart, s.speed, top(s).width, s.turnStart + e);
    if (Math.abs(l - left) <= tolerance) return e;
  }
  throw new Error(`konum bulunamadı: ${left}`);
}
/** Aktif oyuncu üst bloğun tam üstüne yakın (kusursuz sınırı içinde) bırakır. */
function dropPerfect(s: KuleState): KuleState {
  const at = s.turnStart + elapsedFor(s, top(s).left, 8);
  return drop(s, active(s), at, at + 20);
}
/** Sonraki sıra toplam süreden sonra bitecek şekilde ayarlanır; süre dolunca oyun biter, başka bırakış olmaz. */
const finishByTime = (s: KuleState): KuleState =>
  game.tick({ ...s, turnStart: s.startedAt + KULE_TOTAL_MS - 1_000 }, ctx(s.startedAt + KULE_TOTAL_MS));
/** Dar kule: üstte 100 genişliğinde blok; sol uçtan bırakan ıskalar. */
const narrowTower = (s: KuleState): KuleState => ({
  ...s,
  tower: [block(300, 400), block(400, 100)],
  floors: 1,
});

describe("kurulum", () => {
  it("tüm oyuncular sırada, kimse çıkmamış, taban blok ortada ve başlangıç genişliğinde", () => {
    const s = start(5);
    expect([...s.order].sort()).toEqual(ids(5));
    expect(s.eliminated).toEqual([]);
    expect(s.tower).toEqual([{ left: 300, width: KULE_START_WIDTH, perfect: false }]);
    expect(s.speed).toBe(KULE_SPEED_START);
    expect(s.turnStart).toBe(T0 + KULE_INTRO_MS);
    expect(s.need).toBe(3);
    expect(game.minPlayers).toBe(2);
    expect(game.maxPlayers).toBe(8);
  });

  it("sıra ctx.rng ile karıştırılır: aynı tohum aynı sıra, farklı tohumlar farklı sıralar", () => {
    expect(start(8, 3).order).toEqual(start(8, 3).order);
    const orders = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) orders.add(start(8, seed).order.join());
    expect(orders.size).toBeGreaterThan(5);
  });

  it("kural 12: rastgele havuzda, tutorial üç adım", () => {
    expect(game.randomPool).toBeUndefined();
    expect(game.briefing.steps).toHaveLength(3);
  });
});

describe("konum fonksiyonu (üçgen dalga)", () => {
  const W = KULE_START_WIDTH;
  const at = (elapsed: number, speed = KULE_SPEED_START, width = W) =>
    kuleBlockLeft(5_000, speed, width, 5_000 + elapsed);

  it("sıra başlamadan önce sol uçtadır; ilk an 0", () => {
    expect(kuleBlockLeft(5_000, 1000, W, 4_000)).toBe(0);
    expect(at(0)).toBe(0);
  });

  it("sabit hızla gider: 450 birim/sn", () => {
    expect(KULE_BASE_SPEED).toBe(450);
    expect(at(1000)).toBe(450);
    expect(at(1333)).toBe(599);
    expect(at(1334)).toBe(600);
  });

  it("uca varınca geri döner ve başa sarar", () => {
    expect(at(1500)).toBe(525);
    expect(at(2000)).toBe(300);
    expect(at(2667)).toBe(0);
    // Pist genişliği − blok genişliği hiç aşılmaz.
    for (let e = 0; e < 20_000; e += 37) {
      const l = at(e);
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(KULE_TRACK - W);
    }
  });

  it("yalnız (turnStart, hız, genişlik, an) fonksiyonu: tekrar çağrı aynı, tam sayı sonuç", () => {
    for (let e = 0; e < 8000; e += 111) {
      expect(at(e, 1337)).toBe(at(e, 1337));
      expect(Number.isInteger(at(e, 1337))).toBe(true);
    }
  });

  it("hız çarpanı hareketi hızlandırır", () => {
    expect(at(500, 2000)).toBe(at(1000, 1000));
  });

  it("dar blok daha uzun yol alır", () => {
    // Aralık 900, periyot 1800: 2500 ms -> 1125 birim yol -> 1800 − 1125 = 675
    expect(at(2500, 1000, 100)).toBe(675);
    expect(at(4000, 1000, 100)).toBe(0);
  });
});

describe("kesme matematiği ve kusursuz toleransı", () => {
  const base = block(300, 400);

  it("tam üstüne gelen kusursuz; blok alttakine oturur", () => {
    const c = kuleCut(base, 300, 400);
    expect(c.kind).toBe("perfect");
    expect(c.block).toEqual({ left: 300, width: 400, perfect: true });
    expect(c.cutWidth).toBe(0);
  });

  it("taşma %4'ün altındaysa (15 < 16) kusursuz, kesilmez; genişlik korunur", () => {
    const c = kuleCut(base, 315, 400);
    expect(c.kind).toBe("perfect");
    expect(c.block).toEqual({ left: 300, width: 400, perfect: true });
    const l = kuleCut(base, 285, 400);
    expect(l.kind).toBe("perfect");
  });

  it("taşma tam %4 (16) ise kusursuz değil, kesilir", () => {
    const c = kuleCut(base, 316, 400);
    expect(c.kind).toBe("ok");
    expect(c.block).toEqual({ left: 316, width: 384, perfect: false });
    expect(c.cutLeft).toBe(700);
    expect(c.cutWidth).toBe(16);
  });

  it("sola taşan kısım kesilir", () => {
    const c = kuleCut(base, 250, 400);
    expect(c.kind).toBe("ok");
    expect(c.block).toEqual({ left: 300, width: 350, perfect: false });
    expect(c.cutLeft).toBe(250);
    expect(c.cutWidth).toBe(50);
  });

  it("sağa taşan kısım kesilir", () => {
    const c = kuleCut(base, 450, 400);
    expect(c.block).toEqual({ left: 450, width: 250, perfect: false });
    expect(c.cutLeft).toBe(700);
    expect(c.cutWidth).toBe(150);
  });

  it("kalan genişlik + kesilen = bırakılan genişlik", () => {
    for (let left = 0; left <= 600; left += 7) {
      const c = kuleCut(base, left, 400);
      if (c.kind === "ok") expect((c.block as KuleBlock).width + c.cutWidth).toBe(400);
    }
  });

  it("hiç denk gelmeyen ya da yalnız kenarı değen blok ıskadır", () => {
    const narrow = block(400, 100);
    expect(kuleCut(narrow, 0, 100).kind).toBe("miss");
    expect(kuleCut(narrow, 300, 100).kind).toBe("miss"); // yalnız kenar değer
    expect(kuleCut(narrow, 500, 100).kind).toBe("miss");
    expect(kuleCut(narrow, 301, 100).kind).toBe("ok");
    const miss = kuleCut(narrow, 0, 100);
    expect(miss.block).toBeNull();
    expect(miss.cutWidth).toBe(100);
  });

  it("kusursuz eşiği bloğun genişliğine göre ölçülür (100 genişlikte 3 < 4)", () => {
    const narrow = block(400, 100);
    expect(kuleCut(narrow, 403, 100).kind).toBe("perfect");
    expect(kuleCut(narrow, 404, 100).kind).toBe("ok");
  });
});

describe("bırakış: kesme, kusursuz, ıska", () => {
  it("sol uçta bırakan blok kesilir: kule daralır, sıra ilerler, hız artar", () => {
    const s = start(4);
    const who = active(s);
    const n = dropAtStart(s);
    expect(top(n)).toEqual({ left: 300, width: 100, perfect: false });
    expect(n.tower).toHaveLength(2);
    expect(n.floors).toBe(1);
    expect(n.speed).toBe(1060);
    expect(n.turn).toBe(2);
    expect(active(n)).toBe(s.order[1]);
    expect(n.turnStart).toBe(s.turnStart + KULE_PAUSE_OK_MS);
    expect(n.last).toMatchObject({ kind: "ok", player: who, auto: false, cutLeft: 0, cutWidth: 300 });
    expect(n.eliminated).toEqual([]);
  });

  it("kusursuz: blok tam oturur, genişlik korunur, kusursuz sayısı artar", () => {
    const s = start(4);
    const who = active(s);
    const n = dropPerfect(s);
    expect(top(n)).toEqual({ left: 300, width: 400, perfect: true });
    expect(n.last).toMatchObject({ kind: "perfect", player: who, cutWidth: 0 });
    expect(n.perfects[who]).toBe(1);
    expect(n.speed).toBe(1060);
  });

  it("ıska: oyuncu çıkar, kule başlangıç genişliğine sıfırlanır, hız da sıfırlanır, sıra sürer", () => {
    const s = { ...narrowTower(start(4)), speed: 1190 };
    const who = active(s);
    const n = dropAtStart(s);
    expect(n.eliminated).toEqual([who]);
    expect(n.tower).toEqual([block(300, KULE_START_WIDTH)]);
    expect(n.speed).toBe(KULE_SPEED_START);
    expect(n.floors).toBe(0);
    expect(n.last).toMatchObject({ kind: "miss", player: who });
    expect(n.last?.fallen).toHaveLength(2);
    expect(n.turnStart).toBe(s.turnStart + KULE_PAUSE_MISS_MS);
    expect(active(n)).toBe(s.order[1]);
    expect(n.finished).toBe(false);
  });

  it("çıkan oyuncu bir daha sıraya girmez: çevrim atlayarak sürer", () => {
    let s = start(4);
    const [, b, c, d] = s.order as [string, string, string, string];
    s = dropAtStart(s); // a: kule daralır (100)
    expect(active(s)).toBe(b);
    s = dropAtStart(s); // b: ıska
    expect(s.eliminated).toEqual([b]);
    expect(active(s)).toBe(c);
    s = dropAtStart(s); // c: taban 400 -> 100
    expect(active(s)).toBe(d);
    s = drop(s, d, s.turnStart, s.turnStart); // d: ıska -> yarısı çıktı
    expect(s.finished).toBe(true);
    expect(s.eliminated).toEqual([b, d]);
  });

  it("hız her katta %6 artar, tam sayıdır", () => {
    expect(kuleNextSpeed(1000)).toBe(1060);
    expect(kuleNextSpeed(1060)).toBe(1123);
    expect(kuleNextSpeed(1123)).toBe(1190);
  });

  it("hız başlangıcın 2,5 katını aşmaz", () => {
    expect(KULE_SPEED_CAP).toBe(2500);
    let v = KULE_SPEED_START;
    for (let i = 0; i < 40; i++) {
      const next = kuleNextSpeed(v);
      expect(next).toBeGreaterThanOrEqual(v);
      expect(next).toBeLessThanOrEqual(2500);
      v = next;
    }
    expect(v).toBe(2500);
    expect(kuleNextSpeed(2500)).toBe(2500);
  });

  it("art arda kusursuz bırakışlarla hız tavana çıkar ve orada kalır", () => {
    let s = start(2);
    for (let i = 0; i < 20; i++) {
      s = dropPerfect(s);
      expect(s.speed).toBeLessThanOrEqual(2500);
    }
    expect(s.speed).toBe(2500);
  });
});

describe("bırakış anı (at) doğrulaması", () => {
  it("geçerli aralıktaki an olduğu gibi kullanılır", () => {
    expect(kuleDropTime(1900, 1000, 2000)).toBe(1900);
    expect(kuleDropTime(1600, 1000, 2000)).toBe(1600); // tam 400 ms eski
    expect(kuleDropTime(1000, 1000, 1200)).toBe(1000); // sıra başı
    expect(kuleDropTime(2000, 1000, 2000)).toBe(2000); // şimdi
  });

  it("400 ms'den eski, sıradan önceki ya da gelecekteki an yerine sunucu saati kullanılır", () => {
    expect(kuleDropTime(1599, 1000, 2000)).toBe(2000);
    expect(kuleDropTime(900, 1000, 1200)).toBe(1200);
    expect(kuleDropTime(2500, 1000, 2000)).toBe(2000);
    expect(kuleDropTime(-5, 1000, 2000)).toBe(2000);
  });

  it("reduce geçerli at'i kullanır: konum o ana göredir", () => {
    const s = start(3);
    const e = elapsedFor(s, 300);
    const at = s.turnStart + e;
    const n = drop(s, active(s), at, at + 300);
    expect(n.last?.at).toBe(at);
    expect(n.last?.kind).toBe("perfect");
  });

  it("reduce eski at'i yok sayar ve sunucu saatini kullanır", () => {
    const s = start(3);
    const now = s.turnStart + 3000;
    const n = drop(s, active(s), s.turnStart, now);
    expect(n.last?.at).toBe(now);
    expect(n.last?.dropLeft).toBe(kuleBlockLeft(s.turnStart, s.speed, KULE_START_WIDTH, now));
  });

  it("reduce gelecekteki at'i yok sayar", () => {
    const s = start(3);
    const now = s.turnStart + 1000;
    const n = drop(s, active(s), now + 5000, now);
    expect(n.last?.at).toBe(now);
  });

  it("parseAction yalnız sonlu sayı kabul eder, tam sayıya indirir", () => {
    expect(game.parseAction({ kind: "drop", at: 1234.9 })).toEqual({ kind: "drop", at: 1234 });
    for (const bad of [
      null,
      undefined,
      0,
      "drop",
      [],
      {},
      { kind: "drop" },
      { at: 5 },
      { kind: "drop", at: "5" },
      { kind: "drop", at: Number.NaN },
      { kind: "drop", at: Number.POSITIVE_INFINITY },
      { kind: "drop", at: null },
      { kind: "drop", at: 1e300 },
      { kind: "press", at: 5 },
      { kind: "drop", at: 5, extra: 1 },
    ]) {
      expect(game.parseAction(bad)).toBeNull();
    }
  });
});

describe("reddedilen eylemler", () => {
  it("sırası olmayan, çıkmış, katılımcı olmayan, sıra başlamadan önce", () => {
    const s = start(4);
    const [a, b] = s.order as [string, string];
    expect(rejection(s, b, s.turnStart)).toBe("not_your_turn");
    expect(rejection(s, "yok", s.turnStart)).toBe("not_participant");
    expect(rejection(s, a, s.turnStart - 1, s.turnStart - 1)).toBe("not_started");
    const out = { ...s, eliminated: [a] };
    expect(rejection(out, a, s.turnStart)).toBe("eliminated");
  });

  it("sıra süresi dolunca otomatik bırakış önce işlenir; geç gelen eylem reddedilir", () => {
    const s = narrowTower(start(3));
    const [a, b] = s.order as [string, string];
    const late = s.turnStart + KULE_TURN_MS + 10;
    // a dokunmadı: süre dolunca bırakılan blok dar kulede ıskaladı, a çıktı; sıra b'de ama henüz başlamadı.
    expect(rejection(s, a, late)).toBe("eliminated");
    expect(rejection(s, b, late)).toBe("not_started");
  });

  it("oyun bitince eylem reddedilir", () => {
    const s = { ...start(3), finished: true, endedAt: T0 + 5 };
    expect(rejection(s, active(s), s.turnStart)).toBe("ended");
  });
});

describe("zaman aşımı: otomatik bırakış", () => {
  it("dokunmayan oyuncu süre dolduğu anda bırakmış sayılır (tick ile)", () => {
    const s = narrowTower(start(3));
    const who = active(s);
    const deadline = s.turnStart + KULE_TURN_MS;
    expect(game.tick(s, ctx(deadline - 1))).toBe(s);
    const n = game.tick(s, ctx(deadline));
    expect(n.last).toMatchObject({ player: who, auto: true, at: deadline });
    expect(n.last?.dropLeft).toBe(kuleBlockLeft(s.turnStart, s.speed, 100, deadline));
    expect(n.turn).toBe(2);
  });

  it("dar kulede zaman aşımı ıska olabilir: oyuncu çıkar", () => {
    const s = narrowTower(start(3));
    const who = active(s);
    const n = game.tick(s, ctx(s.turnStart + KULE_TURN_MS));
    // 6000 ms * 0,45 = 2700; dalga periyodu 1800; 2700 % 1800 = 900 -> blok 900..1000, altta 400..500
    expect(n.last?.kind).toBe("miss");
    expect(n.eliminated).toEqual([who]);
    expect(n.tower).toEqual([block(300, KULE_START_WIDTH)]);
  });

  it("tick geç çağrılsa bile kaçırılan sıralar kendi mutlak anlarında işlenir", () => {
    const s = start(4);
    const n = game.tick(s, ctx(s.turnStart + 3 * KULE_TURN_MS + 5_000));
    expect(n.turn).toBeGreaterThanOrEqual(4);
    const k = game.tick(s, ctx(s.turnStart + KULE_TURN_MS));
    expect(n.last?.turn).toBeGreaterThan(k.last?.turn ?? 0);
  });

  it("tick bağlı oyuncu listesine bakmaz: bağlantısı kopan da zamanla bırakır", () => {
    const s = narrowTower(start(4));
    const who = active(s);
    const t = s.turnStart + KULE_TURN_MS;
    const all = game.tick(s, ctx(t, ids(4)));
    const without = game.tick(
      s,
      ctx(
        t,
        ids(4).filter((x) => x !== who),
      ),
    );
    const none = game.tick(s, ctx(t, []));
    expect(without).toEqual(all);
    expect(none).toEqual(all);
    expect(all.last?.player).toBe(who);
  });
});

describe("bitiş", () => {
  it("başlangıç oyuncularının yarısı çıkınca biter (4 oyuncu: 2 çıkış)", () => {
    let s = start(4);
    const [a, b, c, d] = s.order as [string, string, string, string];
    s = dropAtStart(s);
    s = dropAtStart(s);
    expect(s.eliminated).toEqual([b]);
    expect(s.finished).toBe(false);
    s = dropAtStart(s);
    s = dropAtStart(s);
    expect(s.eliminated).toEqual([b, d]);
    expect(s.finished).toBe(true);
    expect(s.timeUp).toBe(false);
    expect(game.isFinished(s, ctx(T0))).toBe(true);
    expect(game.view(s, a, ctx(T0)).myTurn).toBe(false);
    expect(game.view(s, c, ctx(T0)).turnsAway).toBeNull();
  });

  it("tek sayıda yukarı yuvarlanır: 3 oyuncuda 2, 5 oyuncuda 3, 2 oyuncuda 1 çıkış", () => {
    expect(start(3).need).toBe(2);
    expect(start(5).need).toBe(3);
    expect(start(2).need).toBe(1);
    expect(start(8).need).toBe(4);
    let s = start(2);
    s = dropAtStart(s); // daralır
    s = dropAtStart(s); // ıska -> 1 çıkış
    expect(s.finished).toBe(true);
    expect(s.eliminated).toHaveLength(1);
  });

  it("90 sn dolunca biter (hiç ıska yoksa herkes kalır)", () => {
    // Sıra süresi toplam süreden sonra biter: o ana dek hiçbir bırakış işlenmez.
    const s: KuleState = { ...start(3), turnStart: T0 + KULE_TOTAL_MS - 2_000 };
    const limit = T0 + KULE_TOTAL_MS;
    expect(game.tick(s, ctx(limit - 1)).finished).toBe(false);
    const n = game.tick(s, ctx(limit));
    expect(n.finished).toBe(true);
    expect(n.timeUp).toBe(true);
    expect(n.endedAt).toBe(limit);
    expect(n.eliminated).toEqual([]);
    expect(game.result(n).miniScores).toEqual(Object.fromEntries(ids(3).map((id) => [id, 1])));
    expect(game.isFinished(s, ctx(limit))).toBe(true);
    expect(game.isFinished(s, ctx(limit - 1))).toBe(false);
  });

  it("süre dolarken sırası gelmiş oyuncunun bırakışı iptal edilir, cezası olmaz", () => {
    const base = start(3);
    const s: KuleState = { ...narrowTower(base), turnStart: T0 + KULE_TOTAL_MS - 2_000 };
    const limit = T0 + KULE_TOTAL_MS;
    // Sıra süresi (6 sn) toplam süreden sonra biter: otomatik bırakış hiç işlenmez.
    const n = game.tick(s, ctx(limit + 10_000));
    expect(n.finished).toBe(true);
    expect(n.timeUp).toBe(true);
    expect(n.eliminated).toEqual([]);
    expect(n.last).toBeNull();
    expect(n.turn).toBe(s.turn);
    expect(rejection(s, active(s), limit, limit)).toBe("ended");
    // Süre dolmadan önce yapılan bırakış geçerlidir.
    const before = drop(s, active(s), limit - 1_500, limit - 1_400);
    expect(before.last?.kind).toBe("miss");
  });

  it("sıra arasında (ara) süre dolarsa da oyun o anda biter", () => {
    const s: KuleState = { ...start(3), turnStart: T0 + KULE_TOTAL_MS + 3_000 };
    const n = game.tick(s, ctx(T0 + KULE_TOTAL_MS));
    expect(n.finished).toBe(true);
    expect(n.timeUp).toBe(true);
    expect(n.endedAt).toBe(T0 + KULE_TOTAL_MS);
  });

  it("biten oyun tekrar tick'lenince değişmez", () => {
    const s = start(3);
    const n = game.tick(s, ctx(T0 + KULE_TOTAL_MS));
    expect(game.tick(n, ctx(T0 + KULE_TOTAL_MS + 99_999))).toBe(n);
  });
});

describe("puanlama", () => {
  it("çıkanlar −1, kalanlar +1 (kusursuz yoksa ek puan yok)", () => {
    let s = start(4);
    const [a, b, c, d] = s.order as [string, string, string, string];
    for (let i = 0; i < 4; i++) s = dropAtStart(s);
    const r = game.result(s);
    expect(r.miniScores).toEqual({ [a]: 1, [b]: -1, [c]: 1, [d]: -1 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("en çok kusursuz yapan ek +1 alır (en az 1 gerekir)", () => {
    let s = start(3);
    const [a, b, c] = s.order as [string, string, string];
    s = dropPerfect(s); // a
    const r = game.result(finishByTime(s));
    expect(r.miniScores).toEqual({ [a]: 2, [b]: 1, [c]: 1 });
  });

  it("kusursuzda eşitlik: eşit sayıdakilerin hepsi ek puan alır", () => {
    let s = start(3);
    const [a, b, c] = s.order as [string, string, string];
    s = dropPerfect(s); // a
    s = dropPerfect(s); // b
    const r = game.result(finishByTime(s));
    expect(r.miniScores).toEqual({ [a]: 2, [b]: 2, [c]: 1 });
  });

  it("daha çok kusursuz yapan tek başına alır; kusursuz yapan sonradan çıksa da bonus alır", () => {
    let s = start(4);
    const [a, b, c, d] = s.order as [string, string, string, string];
    s = dropPerfect(s); // a: 1
    s = dropPerfect(s); // b: 1
    s = dropPerfect(s); // c: 1
    s = dropPerfect(s); // d: 1
    s = dropPerfect(s); // a: 2
    expect(s.perfects[a]).toBe(2);
    // a'dan sonra b'nin sırası: tabanı daralt, b ıskalasın.
    const narrow: KuleState = { ...s, tower: [block(300, 400), block(400, 100)] };
    const out = dropAtStart(narrow); // b ıskalar
    expect(out.eliminated).toEqual([b]);
    const r = game.result(finishByTime(out));
    expect(r.miniScores).toEqual({ [a]: 2, [b]: -1, [c]: 1, [d]: 1 });
  });

  it("çıkan oyuncu en çok kusursuz yaptıysa o da ek +1 alır", () => {
    let s = start(4);
    const [a, , c] = s.order as [string, string, string, string];
    s = dropPerfect(s); // a: 1
    // a'nın ıskalayacağı sıra: önce diğerlerini geç
    // Sıra yeniden a'da; kule dar, a ıskalar.
    const narrow: KuleState = { ...s, turnIndex: 0, tower: [block(300, 400), block(400, 100)] };
    const out = dropAtStart(narrow);
    expect(out.eliminated).toEqual([a]);
    const r = game.result(finishByTime(out));
    expect(r.miniScores[a]).toBe(0); // −1 + 1
    expect(r.miniScores[c]).toBe(1);
  });

  it("sonuç, oyuncu başına kusursuz sayısını `stats.perfects` olarak taşır (yalnız sunucu muhasebesi)", () => {
    let s = start(3);
    const [a, b, c] = s.order as [string, string, string];
    s = dropPerfect(s); // a: 1
    s = dropPerfect(s); // b: 1
    s = dropPerfect(s); // c: 1
    s = dropPerfect(s); // a: 2
    const r = game.result(finishByTime(s));
    expect(r.stats).toEqual({ [a]: { perfects: 2 }, [b]: { perfects: 1 }, [c]: { perfects: 1 } });
    // Kural değişmez: puanlar stats olmadan da aynı; saf ve belirleyici.
    expect(game.result(finishByTime(s))).toEqual(r);
    expect(game.result(start(3)).stats).toEqual({
      p1: { perfects: 0 },
      p2: { perfects: 0 },
      p3: { perfects: 0 },
    });
  });

  it("publicView puanları oyun sürerken de aynı formülle gösterir", () => {
    let s = start(3);
    const [a, b, c] = s.order as [string, string, string];
    s = dropPerfect(s);
    const pv = game.publicView(s, ctx(s.turnStart)) as KulePublicView;
    expect(pv.scores).toEqual({ [a]: 2, [b]: 1, [c]: 1 });
    expect(pv.perfects).toEqual({ [a]: 1, [b]: 0, [c]: 0 });
  });
});

describe("görünümler", () => {
  it("publicView: sıra, kule, süre bilgisi; gizli bilgi yok", () => {
    const s = start(4);
    const pv = game.publicView(s, ctx(s.turnStart)) as KulePublicView;
    expect(pv.active).toBe(active(s));
    expect(pv.turnStart).toBe(s.turnStart);
    expect(pv.deadline).toBe(s.turnStart + KULE_TURN_MS);
    expect(pv.endsAt).toBe(T0 + KULE_TOTAL_MS);
    expect(pv.blockWidth).toBe(KULE_START_WIDTH);
    expect(pv.tower).toHaveLength(1);
    expect(pv.speed).toBe(KULE_SPEED_START);
    expect(game.secrets(s)).toEqual([]);
  });

  it("publicView süresi dolmuş sırayı işlenmiş gösterir (tick'ten bağımsız)", () => {
    const s = narrowTower(start(3));
    const now = s.turnStart + KULE_TURN_MS + 5;
    const viaView = game.publicView(s, ctx(now)) as KulePublicView;
    const viaTick = game.publicView(game.tick(s, ctx(now)), ctx(now)) as KulePublicView;
    expect(viaView).toEqual(viaTick);
    expect(viaView.turn).toBe(2);
  });

  it("view: sıra bende / kaç sıra var / çıktım; izleyici ve yabancı için boş", () => {
    const s = start(4);
    const [a, b, c] = s.order as [string, string, string];
    expect(game.view(s, a, ctx(T0))).toEqual({ isOut: false, myTurn: true, turnsAway: 0 });
    expect(game.view(s, b, ctx(T0))).toEqual({ isOut: false, myTurn: false, turnsAway: 1 });
    expect(game.view(s, c, ctx(T0)).turnsAway).toBe(2);
    expect(game.view(s, null, ctx(T0))).toEqual({ isOut: false, myTurn: false, turnsAway: null });
    expect(game.view(s, "yok", ctx(T0))).toEqual({ isOut: false, myTurn: false, turnsAway: null });
    const out = { ...s, eliminated: [b] };
    expect(game.view(out, b, ctx(T0))).toEqual({ isOut: true, myTurn: false, turnsAway: null });
    expect(game.view(out, c, ctx(T0)).turnsAway).toBe(1);
  });
});

describe("saflık ve belirlilik", () => {
  it("reduce girdi durumunu değiştirmez (dondurulmuş durumla çalışır)", () => {
    const s = deepFreeze(narrowTower(start(4)));
    const snap = JSON.stringify(s);
    dropAtStart(s);
    game.tick(s, ctx(s.turnStart + KULE_TURN_MS + 5_000));
    game.publicView(s, ctx(s.turnStart + 5_000));
    game.view(s, active(s), ctx(s.turnStart + 5_000));
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("görünümler ctx.rng tüketmez", () => {
    const s = start(4);
    const rng = createRng(9);
    const before = createRng(9).next();
    game.publicView(s, { now: s.turnStart + 20_000, rng, connected: [] });
    game.view(s, "p1", { now: s.turnStart + 20_000, rng, connected: [] });
    expect(rng.next()).toBe(before);
  });

  function play(seed: number, tickEvery: number): KuleState {
    let s = start(5, seed);
    const end = T0 + KULE_TOTAL_MS + 1_000;
    for (let t = T0; t <= end; t += tickEvery) {
      s = game.tick(s, ctx(t));
      if (s.finished) break;
      // Her oyuncu kendi sırasında, sıra başladıktan 1 sn sonra bırakır.
      if (t >= s.turnStart + 1_000) {
        const r = game.reduce(s, active(s), { kind: "drop", at: t }, ctx(t));
        if (!isRejected(r)) s = r;
      }
    }
    return game.tick(s, ctx(end));
  }

  it("aynı tohum ve aynı eylemlerle aynı sonuç", () => {
    expect(play(7, 100)).toEqual(play(7, 100));
    expect(game.result(play(7, 100))).toEqual(game.result(play(7, 100)));
  });

  it("farklı tohum farklı oyun sırası verir", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) orders.add(play(seed, 100).order.join());
    expect(orders.size).toBeGreaterThan(1);
  });

  it("tick takvimi sonucu değiştirmez: seyrek ve sık tick aynı durumu verir", () => {
    const s = start(4);
    const end = T0 + KULE_TOTAL_MS + 500;
    let dense = s;
    for (let t = T0; t <= end; t += 50) dense = game.tick(dense, ctx(t));
    const sparse = game.tick(s, ctx(end));
    expect(dense).toEqual(sparse);
    expect(sparse.finished).toBe(true);
  });
});

describe("bot takvimi", () => {
  it("bot oyunu her zaman süre içinde bitirir ve geçerli puan verir", async () => {
    const { BOTS, buildActions, buildTicks, runSimulation } = await import("../../testing/index.js");
    const bot = BOTS["kule-ustasi"];
    if (!bot) throw new Error("bot yok");
    for (let seed = 1; seed <= 40; seed++) {
      const players = ids(2 + (seed % 7));
      const out = runSimulation(game, {
        seed,
        players,
        startedAt: 0,
        actions: buildActions(bot, seed, players, 0),
        ticks: buildTicks(seed, "irregular", 0, bot.durationMs),
        durationMs: bot.durationMs,
        disconnectProbability: 0,
      });
      expect(game.isFinished(out.state as KuleState, ctx(out.endedAt))).toBe(true);
      expect(Object.keys(out.result.miniScores).sort()).toEqual([...players].sort());
    }
  });
});
