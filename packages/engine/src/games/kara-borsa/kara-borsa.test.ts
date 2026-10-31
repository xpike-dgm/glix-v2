import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { BOTS, buildActions, buildTicks, runSimulation } from "../../testing/index.js";
import { cursedSeerLimit, hintHolds, makeHints } from "./hints.js";
import { type BorsaState, borsaAwards, karaBorsa as game, settleRound } from "./index.js";
import {
  BORSA_BID_MS,
  BORSA_CURSED_VALUE,
  BORSA_DURATION_MS,
  BORSA_FINAL_SCALE,
  BORSA_REVEAL_MS,
  BORSA_ROUNDS,
  BORSA_START_COINS,
  type BorsaAction,
  type BorsaHintPair,
} from "./types.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
const ctx = (at: number, connected: readonly string[] = PLAYERS) => ({
  now: T0 + at,
  rng: createRng(1),
  connected,
});
const ROUND_MS = BORSA_BID_MS + BORSA_REVEAL_MS;

/** Kutu değerleri belli bir oyun. */
function start(values: number[] = [10, 20, 30, 40, 50], players = PLAYERS): BorsaState {
  const s = game.setup(players, ctx(0, players));
  return { ...s, values };
}
const bid = (amount: number): BorsaAction => ({ kind: "bid", amount });
function act(s: BorsaState, id: string, a: BorsaAction, at: number, connected?: readonly string[]) {
  const r = game.reduce(s, id, a, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reason = (s: BorsaState, id: string, a: BorsaAction, at: number) => {
  const r = game.reduce(s, id, a, ctx(at));
  return isRejected(r) ? r.rejected : null;
};
const tickAt = (s: BorsaState, at: number) => game.tick(s, ctx(at));
const roundStart = (r: number) => r * ROUND_MS;
/** Tüm turları süreyle (teklifsiz ya da verilen teklifler) oynar. */
function playRounds(s: BorsaState, plan: Record<string, number>[]): BorsaState {
  let st = s;
  plan.forEach((bids, r) => {
    for (const [id, amount] of Object.entries(bids)) st = act(st, id, bid(amount), roundStart(r) + 1_000);
    st = tickAt(st, roundStart(r + 1));
  });
  return st;
}

describe("kara-borsa kurulum", () => {
  it("3-8 oyuncu, 5 tur, herkes 100 jetonla başlar; teklif 20 sn, açılış 8 sn", () => {
    expect(game.minPlayers).toBe(3);
    expect(game.maxPlayers).toBe(8);
    expect(BORSA_ROUNDS).toBe(5);
    expect(BORSA_START_COINS).toBe(100);
    expect(BORSA_BID_MS).toBe(20_000);
    expect(BORSA_REVEAL_MS).toBe(8_000);
    expect(BORSA_DURATION_MS).toBe(140_000);
    const s = game.setup(PLAYERS, ctx(0));
    expect(s.coins).toEqual({ a: 100, b: 100, c: 100, d: 100 });
    expect(s.stageEndsAt).toBe(T0 + 20_000);
    expect(s.values).toHaveLength(5);
  });

  it("briefing kısa ve teknik sözcük içermez", () => {
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    const all = [game.briefing.goal, ...game.briefing.steps].join(" ").toLowerCase();
    for (const w of ["debug", "protocol", "server", "stage"]) expect(all).not.toContain(w);
  });

  it("1-4. tur kutu değeri 0-60 tam sayı ya da lanetli (-20); lanetli oranı ~%15", () => {
    let cursed = 0;
    let total = 0;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 1500; seed++) {
      const s = game.setup(PLAYERS, { now: 0, rng: createRng(seed), connected: PLAYERS });
      for (const v of s.values.slice(0, 4)) {
        total++;
        if (v === BORSA_CURSED_VALUE) cursed++;
        else {
          expect(Number.isInteger(v) && v >= 0 && v <= 60).toBe(true);
          seen.add(v);
        }
      }
    }
    expect(cursed / total).toBeGreaterThan(0.13);
    expect(cursed / total).toBeLessThan(0.17);
    expect(seen.size).toBe(61);
  });

  it("son tur Büyük Kutu: değer 0-120 ya da lanetli (-40), lanetli oranı ~%15", () => {
    expect(BORSA_FINAL_SCALE).toBe(2);
    let cursed = 0;
    let high = 0;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 3000; seed++) {
      const v = game.setup(PLAYERS, { now: 0, rng: createRng(seed), connected: PLAYERS }).values[4] as number;
      if (v === -40) cursed++;
      else {
        expect(Number.isInteger(v) && v >= 0 && v <= 120).toBe(true);
        seen.add(v);
        if (v > 60) high++;
      }
    }
    expect(cursed / 3000).toBeGreaterThan(0.12);
    expect(cursed / 3000).toBeLessThan(0.18);
    expect(seen.size).toBe(121);
    expect(high).toBeGreaterThan(1000);
  });

  it("aynı tohum aynı kurulum", () => {
    const mk = () => game.setup(PLAYERS, { now: T0, rng: createRng(9), connected: PLAYERS });
    expect(mk()).toEqual(mk());
  });
});

describe("kara-borsa ipuçları", () => {
  it("ÖZELLİK: her oyuncunun ipucu gerçek değerle tutarlıdır (tüm değerler, çok tohum)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: 0, max: 60 }), fc.constant(BORSA_CURSED_VALUE)),
        fc.integer({ min: 0, max: 2 ** 30 }),
        fc.integer({ min: 3, max: 8 }),
        (value, seed, n) => {
          const players = Array.from({ length: n }, (_, i) => `p${i}`);
          const hints = makeHints(value, players, createRng(seed));
          expect(Object.keys(hints)).toHaveLength(n);
          for (const h of Object.values(hints)) {
            expect(hintHolds(h.main, value), JSON.stringify(h)).toBe(true);
            expect(hintHolds(h.extra, value), JSON.stringify(h)).toBe(true);
          }
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("kurulumdaki bütün ipuçları ilgili turun değeriyle tutarlı", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const players = ["a", "b", "c", "d", "e", "f"];
      const s = game.setup(players, { now: 0, rng: createRng(seed), connected: players });
      s.hints.forEach((round, r) => {
        for (const id of players) {
          const pair = round[id] as BorsaHintPair;
          expect(hintHolds(pair.main, s.values[r] as number)).toBe(true);
          expect(hintHolds(pair.extra, s.values[r] as number)).toBe(true);
        }
      });
    }
  });

  it("hintHolds her ipucu türünü doğru değerlendirir", () => {
    expect(hintHolds({ kind: "gt", n: 30 }, 31)).toBe(true);
    expect(hintHolds({ kind: "gt", n: 30 }, 30)).toBe(false);
    expect(hintHolds({ kind: "lt", n: 10 }, 9)).toBe(true);
    expect(hintHolds({ kind: "between", lo: 5, hi: 9 }, 9)).toBe(true);
    expect(hintHolds({ kind: "between", lo: 5, hi: 9 }, 10)).toBe(false);
    expect(hintHolds({ kind: "even" }, 0)).toBe(true);
    expect(hintHolds({ kind: "odd" }, 7)).toBe(true);
    expect(hintHolds({ kind: "multiple", n: 10 }, 30)).toBe(true);
    expect(hintHolds({ kind: "notMultiple", n: 10 }, 35)).toBe(true);
    expect(hintHolds({ kind: "cursed" }, -20)).toBe(true);
    expect(hintHolds({ kind: "notCursed" }, -20)).toBe(false);
    expect(hintHolds({ kind: "even" }, -20)).toBe(true);
    expect(hintHolds({ kind: "multiple", n: 10 }, -20)).toBe(true);
    expect(hintHolds({ kind: "odd" }, -20)).toBe(false);
  });

  it("oyuncular çoğunlukla farklı ana ipuçları alır", () => {
    let distinct = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const hints = makeHints(33, PLAYERS, createRng(seed));
      distinct += new Set(Object.values(hints).map((h) => JSON.stringify(h.main))).size;
    }
    expect(distinct / 100).toBeGreaterThan(3.2);
  });

  it("ana ipucu lanetsiz kutuda değeri daraltır: büyük / küçük / arasında (aralık en çok 30 geniş)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 2 ** 30 }), (value, seed) => {
        for (const { main } of Object.values(makeHints(value, ["a", "b", "c", "d", "e"], createRng(seed)))) {
          expect(["gt", "lt", "between"]).toContain(main.kind);
          if (main.kind === "between") expect(main.hi - main.lo).toBeLessThanOrEqual(30);
          if (main.kind === "gt" || main.kind === "lt") expect(main.n).toBeLessThanOrEqual(60);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("ek ipucu: çift/tek, 3/5/10 katı mı, ya da (lanetsizde) 'lanetli değil'", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const value of [0, 7, 30, 45, 60, -20]) {
        for (const { main, extra } of Object.values(makeHints(value, PLAYERS, createRng(seed)))) {
          kinds.add(extra.kind);
          expect(["even", "odd", "multiple", "notMultiple", "notCursed"]).toContain(extra.kind);
          if (value < 0) expect(extra.kind).not.toBe("notCursed");
          // "Lanetli değil" yalnız ana ipucu bunu zaten söylemiyorsa (ana ipucu "küçük") verilir.
          if (extra.kind === "notCursed") expect(main.kind).toBe("lt");
        }
      }
    }
    expect(kinds).toEqual(new Set(["even", "odd", "multiple", "notMultiple", "notCursed"]));
  });

  it("lanetli kutu: en az 1, en çok yarısı (yukarı) 'Kutu lanetli!' görür; diğerleri 'n'den küçük' (n 1-40)", () => {
    expect([3, 4, 5, 8].map(cursedSeerLimit)).toEqual([2, 2, 3, 4]);
    for (const n of [3, 4, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const counts = new Set<number>();
      for (let seed = 1; seed <= 200; seed++) {
        const hints = Object.values(makeHints(BORSA_CURSED_VALUE, players, createRng(seed)));
        const seers = hints.filter((h) => h.main.kind === "cursed").length;
        expect(seers).toBeGreaterThanOrEqual(1);
        expect(seers).toBeLessThanOrEqual(Math.ceil(n / 2));
        counts.add(seers);
        for (const { main } of hints) {
          if (main.kind === "cursed") continue;
          expect(main.kind).toBe("lt");
          if (main.kind === "lt") expect(main.n >= 1 && main.n <= 40).toBe(true);
        }
      }
      expect(counts.size).toBe(Math.ceil(n / 2));
    }
  });

  it("Büyük Kutu ipuçları ölçekli: eşikler 0-120, aralık en çok 60, lanetlide n 1-80", () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const value of [0, 15, 70, 119, 120]) {
        for (const { main } of Object.values(makeHints(value, PLAYERS, createRng(seed), 2))) {
          expect(hintHolds(main, value)).toBe(true);
          if (main.kind === "between") expect(main.hi - main.lo).toBeLessThanOrEqual(60);
          if (main.kind === "gt" || main.kind === "lt") expect(main.n).toBeLessThanOrEqual(120);
        }
      }
      for (const { main, extra } of Object.values(makeHints(-40, PLAYERS, createRng(seed), 2))) {
        expect(hintHolds(main, -40) && hintHolds(extra, -40)).toBe(true);
        if (main.kind === "lt") expect(main.n >= 1 && main.n <= 80).toBe(true);
      }
    }
    // Ölçek gerçekten büyür: yüksek eşikler görülür.
    const big = Array.from({ length: 200 }, (_, seed) => makeHints(110, PLAYERS, createRng(seed), 2));
    expect(big.some((h) => Object.values(h).some((p) => p.main.kind === "gt" && p.main.n > 60))).toBe(true);
  });

  it("her oyuncu yalnız kendi ipucunu görür; izleyici ipucu görmez", () => {
    const s = game.setup(PLAYERS, ctx(0));
    for (const id of PLAYERS) expect(game.view(s, id, ctx(0)).hint).toEqual(s.hints[0]?.[id]);
    expect(game.view(s, null, ctx(0)).hint).toBeNull();
    expect(game.view(s, "zed", ctx(0)).hint).toBeNull();
  });

  it("ipucu her turda yenilenir", () => {
    const s = game.setup(PLAYERS, ctx(0));
    const next = tickAt(s, roundStart(1));
    expect(game.view(next, "a", ctx(0)).hint).toEqual(s.hints[1]?.a);
  });
});

describe("kara-borsa teklif", () => {
  it("tek seferlik: ikinci teklif reddedilir", () => {
    const s = act(start(), "a", bid(30), 1_000);
    expect(reason(s, "a", bid(40), 2_000)).toBe("already_bid");
    expect(reason(s, "a", bid(0), 2_000)).toBe("already_bid");
  });

  it("0 ile mevcut jeton arası geçerli; fazlası reddedilir; geçersiz biçim ayrıştırılmaz", () => {
    const s = start();
    expect(reason(s, "a", bid(100), 1_000)).toBeNull();
    expect(reason(s, "a", bid(101), 1_000)).toBe("insufficient");
    expect(reason(s, "a", bid(0), 1_000)).toBeNull();
    for (const raw of [
      { kind: "bid", amount: -1 },
      { kind: "bid", amount: 1.5 },
      { kind: "bid", amount: "5" },
      { kind: "bid" },
      { kind: "bid", amount: 5, x: 1 },
      { kind: "pas", amount: 5 },
      { kind: "bid", amount: Number.NaN },
      { kind: "bid", amount: 2_000_000 },
    ]) {
      expect(game.parseAction(raw)).toBeNull();
    }
  });

  it("katılımcı olmayan ve başlamadan gelen teklif reddedilir", () => {
    expect(reason(start(), "zed", bid(5), 1_000)).toBe("not_participant");
    expect(reason(start(), "a", bid(5), -1)).toBe("not_started");
  });

  it("süre dolunca (tick gelmeden de) teklif reddedilir; son milisaniye kabul", () => {
    const s = start();
    expect(reason(s, "a", bid(5), BORSA_BID_MS - 1)).toBeNull();
    expect(reason(s, "a", bid(5), BORSA_BID_MS)).toBe("wrong_phase");
  });

  it("açılış aşamasında teklif reddedilir; sonraki turda yeniden teklif verilebilir", () => {
    let s = act(start(), "a", bid(5), 1_000);
    s = tickAt(s, BORSA_BID_MS + 100);
    expect(reason(s, "b", bid(5), BORSA_BID_MS + 200)).toBe("wrong_phase");
    expect(reason(s, "a", bid(5), roundStart(1) + 1_000)).toBeNull();
  });

  it("teklifler kimsenin görünümünde sayı olarak yok: yalnız kendi teklifin ve kimlerin verdiği", () => {
    let s = act(start(), "a", bid(37), 1_000);
    s = act(s, "b", bid(61), 1_500);
    const pub = JSON.stringify(game.publicView(s, ctx(2_000)));
    expect(pub).toContain('"bidIds":["a","b"]');
    expect(pub).not.toContain("37");
    expect(pub).not.toContain("61");
    expect(game.view(s, "a", ctx(2_000)).myBid).toBe(37);
    expect(game.view(s, "b", ctx(2_000)).myBid).toBe(61);
    expect(game.view(s, "c", ctx(2_000)).myBid).toBeNull();
    expect(JSON.stringify(game.view(s, "c", ctx(2_000)))).not.toContain("37");
    expect(JSON.stringify(game.view(s, "a", ctx(2_000)))).not.toContain("61");
    expect(JSON.stringify(game.view(s, null, ctx(2_000)))).not.toContain("37");
  });
});

describe("kara-borsa tur sonucu", () => {
  it("en yüksek teklif kutuyu alır ve teklifini öder; kutu değeri puana eklenir", () => {
    let s = start([40, 0, 0, 0, 0]);
    s = act(s, "a", bid(10), 1_000);
    s = act(s, "b", bid(25), 1_100);
    s = act(s, "c", bid(25 - 1), 1_200);
    s = tickAt(s, BORSA_BID_MS);
    expect(s.history[0]).toMatchObject({ value: 40, winner: "b", price: 25 });
    expect(s.coins).toMatchObject({ a: 100, b: 75, c: 100, d: 100 });
    expect(s.boxes.b).toBe(40);
  });

  it("eşitlikte önce teklif veren kazanır (her iki sırada da)", () => {
    for (const order of [
      ["a", "b"],
      ["b", "a"],
      ["d", "c", "a"],
    ]) {
      let s = start();
      order.forEach((id, i) => {
        s = act(s, id, bid(30), 1_000 + i); // aynı ya da ardışık ms
      });
      s = tickAt(s, BORSA_BID_MS);
      expect(s.history[0]?.winner).toBe(order[0]);
    }
  });

  it("eşitlikte aynı milisaniyede gelen teklifler işlenme sırasına göre", () => {
    let s = start();
    s = act(s, "c", bid(30), 1_000);
    s = act(s, "a", bid(30), 1_000);
    expect(settleRound(PLAYERS, s.bids, 5).winner).toBe("c");
  });

  it("kimse teklif vermezse (ya da herkes 0) kutu kimseye gitmez", () => {
    let s = start();
    s = tickAt(s, BORSA_BID_MS);
    expect(s.history[0]).toMatchObject({ winner: null, price: 0 });
    let t = start();
    for (const id of PLAYERS) t = act(t, id, bid(0), 1_000);
    t = tickAt(t, 2_100);
    expect(t.history[0]?.winner).toBeNull();
    expect(t.coins).toEqual({ a: 100, b: 100, c: 100, d: 100 });
  });

  it("lanetli kutu (-20) puanı düşürür", () => {
    const s = playRounds(start([BORSA_CURSED_VALUE, 0, 0, 0, 0]), [{ a: 30 }]);
    expect(s.coins.a).toBe(70);
    expect(s.boxes.a).toBe(-20);
    // Kâr: (70 + (−20)) − 100 = −50.
    expect(game.result(s).miniScores.a).toBe(-50);
  });

  it("jeton teklif kadar azalır; sonraki turda yeni bakiye sınırdır", () => {
    let s = playRounds(start(), [{ a: 90 }]);
    expect(reason(s, "a", bid(11), roundStart(1) + 1_000)).toBe("insufficient");
    expect(reason(s, "a", bid(10), roundStart(1) + 1_000)).toBeNull();
    s = act(s, "a", bid(10), roundStart(1) + 1_000);
  });

  it("açılışta tur sonucu (değer, kazanan, fiyat, herkesin teklifi) açılır; öncesinde değer yok", () => {
    let s = start([37, 0, 0, 0, 0]);
    s = act(s, "a", bid(12), 1_000);
    expect(game.publicView(s, ctx(0)).reveal).toBeNull();
    expect(game.publicView(s, ctx(0)).history).toEqual([]);
    s = tickAt(s, BORSA_BID_MS);
    const pub = game.publicView(s, ctx(0));
    expect(pub.phase).toBe("reveal");
    expect(pub.reveal).toEqual({ value: 37, winner: "a", price: 12, bids: { a: 12, b: 0, c: 0, d: 0 } });
    expect(pub.coins.a).toBe(88);
    expect(pub.boxes.a).toBe(37);
    expect(pub.bidIds).toEqual([]);
  });

  it("açılıştan sonra yeni tur başlar, teklifler sıfırlanır; 5 tur sonra oyun biter", () => {
    let s = playRounds(start(), [{ a: 5 }]);
    expect(s.round).toBe(1);
    expect(s.stage).toBe("bid");
    expect(game.view(s, "a", ctx(0)).myBid).toBeNull();
    expect(game.isFinished(s, ctx(roundStart(5) - 1))).toBe(false);
    expect(game.isFinished(s, ctx(roundStart(5)))).toBe(true);
    s = tickAt(s, roundStart(5));
    expect(s.stage).toBe("done");
    expect(reason(s, "a", bid(1), roundStart(5) + 10)).toBe("ended");
  });

  it("bitişten sonra eylem reddedilir (tick gelmese de)", () => {
    expect(reason(start(), "a", bid(1), roundStart(5) + 1)).toBe("ended");
  });
});

describe("kara-borsa puanlama (kâr, +2 / +1 / 0)", () => {
  it("oyun içi puan kâr = kalan jeton + alınan kutuların değeri − 100", () => {
    const s = playRounds(start([40, 10, 0, 0, 0]), [{ a: 30 }, { a: 5, b: 20 }, {}, {}, {}]);
    const r = game.result(s);
    expect(r.miniScores).toEqual({ a: 40 - 30, b: 10 - 20, c: 0, d: 0 });
  });

  it("genel skor: en yüksek kâr +2, ikinci +1, diğerleri 0", () => {
    expect(borsaAwards({ a: 50, b: 20, c: 10, d: -10 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });

  it("birincide eşitlik: hepsi +2, sonraki farklı kâr +1 (eşitleri de)", () => {
    expect(borsaAwards({ a: 50, b: 50, c: 10, d: 5 })).toEqual({ a: 2, b: 2, c: 1, d: 0 });
    expect(borsaAwards({ a: 50, b: 20, c: 20, d: 5 })).toEqual({ a: 2, b: 1, c: 1, d: 0 });
    expect(borsaAwards({ a: 50, b: 50, c: 50, d: 1 })).toEqual({ a: 2, b: 2, c: 2, d: 1 });
  });

  it("kârı 0 ya da eksi olan ödül almaz; tek kârlı oyuncu yalnız +2 alır", () => {
    expect(borsaAwards({ a: 7, b: 0, c: 0, d: -20 })).toEqual({ a: 2, b: 0, c: 0, d: 0 });
    expect(borsaAwards({ a: 7, b: 3, c: 0, d: 0 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });

  it("kimse kâr etmediyse (herkes geçti ya da zararda) kimse ödül almaz; eksi ödül yok", () => {
    expect(borsaAwards({ a: 0, b: 0, c: 0, d: 0 })).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(borsaAwards({ a: -5, b: -20, c: -30, d: -40 })).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    const allPass = game.result(playRounds(start(), [{}, {}, {}, {}, {}]));
    expect(allPass.miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(allPass.awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("8 oyuncu: en çok iki farklı derece ödül alır", () => {
    const scores = { a: 30, b: 25, c: 20, d: 15, e: 10, f: 5, g: 0, h: -5 };
    expect(borsaAwards(scores)).toEqual({ a: 2, b: 1, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0 });
  });

  it("Büyük Kutu kârı iki kat sayılır: son turda 120'lik kutuyu 50'ye alan +70", () => {
    const s = playRounds(start([0, 0, 0, 0, 120]), [{}, {}, {}, {}, { b: 50, c: 49 }]);
    const r = game.result(s);
    expect(r.miniScores).toEqual({ a: 0, b: 70, c: 0, d: 0 });
    expect(r.awards).toEqual({ a: 0, b: 2, c: 0, d: 0 });
  });

  it("result tick gelmeden de aynı (kalan turlar teklifsiz kapanır)", () => {
    const s = act(start([40, 0, 0, 0, 0]), "a", bid(30), 1_000);
    const lazy = game.result(s);
    const ticked = game.result(tickAt(s, roundStart(5)));
    expect(lazy).toEqual(ticked);
    expect(lazy.miniScores.a).toBe(10);
    expect(lazy.awards).toEqual({ a: 2, b: 0, c: 0, d: 0 });
  });

  it("awards katılımcılara, tam sayı, eksi değil", () => {
    const r = game.result(playRounds(start(), [{ a: 5, b: 7 }]));
    expect(Object.keys(r.awards).sort()).toEqual(PLAYERS);
    for (const v of Object.values(r.awards)) expect(Number.isInteger(v) && v >= 0).toBe(true);
  });

  it("revealAt: son turun açılışının gerçek başlangıcı (erken bitişte öne çekilmiş an); öncesinde null", () => {
    let s = start();
    s = tickAt(s, roundStart(4));
    expect(game.revealAt?.(s, ctx(roundStart(4) + 100))).toBeNull();
    for (const id of PLAYERS) s = act(s, id, bid(0), roundStart(4) + 2_000);
    // Herkes verdi: teklif 1 sn sonra biter; açılış o anda başlar.
    expect(game.revealAt?.(s, ctx(roundStart(4) + 3_000))).toBe(T0 + roundStart(4) + 3_000);
    expect(game.isFinished(s, ctx(roundStart(4) + 3_000 + BORSA_REVEAL_MS - 1))).toBe(false);
    expect(game.isFinished(s, ctx(roundStart(4) + 3_000 + BORSA_REVEAL_MS))).toBe(true);
  });
});

describe("kara-borsa erken bitiş", () => {
  it("(a) herkes teklif verince tur 1 sn sonra biter", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = act(s, id, bid(5), 2_000);
    expect(s.stageEndsAt).toBe(T0 + BORSA_BID_MS);
    s = act(s, "d", bid(0), 3_000);
    expect(s.stageEndsAt).toBe(T0 + 4_000);
    expect(tickAt(s, 3_999).stage).toBe("bid");
    expect(tickAt(s, 4_000).stage).toBe("reveal");
    // Açılış 5 sn; sonraki tur erken bitişin ardından başlar.
    expect(tickAt(s, 4_000 + BORSA_REVEAL_MS).round).toBe(1);
    expect(tickAt(s, 4_000 + BORSA_REVEAL_MS).stageEndsAt).toBe(T0 + 4_000 + BORSA_REVEAL_MS + BORSA_BID_MS);
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = act(s, id, bid(5), 2_000);
    expect(tickAt(s, 15_000).stage).toBe("bid");
  });

  it("(c) ÖNERİ: bağlantısı kopan oyuncu beklenmez; bağlı herkes verince tur 1 sn sonra biter", () => {
    let s = start();
    for (const id of ["a", "b"]) s = act(s, id, bid(5), 2_000, ["a", "b", "c"]);
    expect(s.stageEndsAt).toBe(T0 + BORSA_BID_MS);
    s = act(s, "c", bid(5), 3_000, ["a", "b", "c"]);
    expect(s.stageEndsAt).toBe(T0 + 4_000);
    expect(tickAt(s, 4_000).stage).toBe("reveal");
    // Kopuk "d" teklif vermedi: 0 sayılır, kutu başkasına gider ya da kimseye gitmez.
    expect(tickAt(s, 4_000).history[0]?.bids.d).toBe(0);
  });

  it("(c2) bağlı olan biri hâlâ vermediyse bitmez; bağlı kimse yoksa erken bitiş olmaz", () => {
    let s = start();
    s = act(s, "a", bid(5), 2_000, ["a", "b"]);
    expect(s.stageEndsAt).toBe(T0 + BORSA_BID_MS);
    const r = game.reduce(s, "b", bid(5), ctx(3_000, []));
    if (isRejected(r)) throw new Error("reddedildi");
    expect(r.stageEndsAt).toBe(T0 + BORSA_BID_MS);
  });

  it("(c) jetonu biten oyuncu teklif beklenmez (yalnız 0 verebilir)", () => {
    let s = playRounds(start(), [{ a: 100 }]);
    const t = roundStart(1);
    expect(game.publicView(s, ctx(0)).bidIds).toEqual(["a"]);
    for (const id of ["b", "c", "d"]) s = act(s, id, bid(1), t + 2_000);
    expect(s.stageEndsAt).toBe(T0 + t + 3_000);
  });

  it("(d) teklif sonrası değişiklik reddedilir", () => {
    const s = act(start(), "a", bid(5), 1_000);
    expect(reason(s, "a", bid(9), 1_100)).toBe("already_bid");
  });

  it("(e) kimlerin teklif verdiği sızar, miktar sızmaz", () => {
    const s = act(start(), "a", bid(77), 1_000);
    const blobs = [
      JSON.stringify(game.publicView(s, ctx(1_500))),
      ...["b", "c", "d"].map((id) => JSON.stringify(game.view(s, id, ctx(1_500)))),
      JSON.stringify(game.view(s, null, ctx(1_500))),
    ];
    for (const b of blobs) expect(b).not.toContain("77");
  });

  it("(f) erken bitiş tick zamanlamasından bağımsız", () => {
    const run = (ticks: number[]) => {
      let s = start();
      for (const id of PLAYERS) s = act(s, id, bid(10 + PLAYERS.indexOf(id)), 2_000);
      for (const t of ticks) s = tickAt(s, t);
      return game.result(s);
    };
    expect(run([3_000, 3_500, 9_000, 30_000])).toEqual(run([]));
  });
});

describe("kara-borsa gizlilik (yapısal)", () => {
  it("kutu değeri turun sonuna kadar hiçbir görünümde yok; gelecek turlarınki sonuna kadar yok", () => {
    // Ayırt edici değer: 47 (başka hiçbir sayı 47 olamaz).
    let s = start([47, 53, 0, 0, 0]);
    s = act(s, "a", bid(11), 1_000);
    const blobs = (st: BorsaState, at: number) => [
      JSON.stringify(game.publicView(st, ctx(at))),
      ...PLAYERS.map((id) => JSON.stringify(game.view(st, id, ctx(at)))),
      JSON.stringify(game.view(st, null, ctx(at))),
    ];
    for (const b of blobs(s, 2_000)) {
      expect(b).not.toContain("47");
      expect(b).not.toContain("53");
    }
    const open = tickAt(s, BORSA_BID_MS);
    expect(blobs(open, BORSA_BID_MS)[0]).toContain('"value":47');
    expect(blobs(open, BORSA_BID_MS)[0]).not.toContain("53");
    const next = tickAt(s, roundStart(1) + 1_000);
    for (const b of blobs(next, roundStart(1) + 1_000).slice(1)) expect(b).not.toContain("53");
    expect(blobs(next, roundStart(1) + 1_000)[0]).not.toContain('"value":53');
  });

  it("ipuçları ortak görünümde ve başkalarının görünümünde yok", () => {
    const s = game.setup(PLAYERS, ctx(0));
    const pub = JSON.stringify(game.publicView(s, ctx(0)));
    expect(pub).not.toContain("hint");
    expect(pub).not.toContain('"kind"');
    for (const id of PLAYERS) {
      const own = game.view(s, id, ctx(0)).hint;
      expect(own).toEqual(s.hints[0]?.[id]);
    }
    // Her görünüm tek bir ipucu çifti taşır: kendisininki (ana + ek).
    for (const id of PLAYERS)
      expect(Object.keys(game.view(s, id, ctx(0)).hint ?? {}).sort()).toEqual(["extra", "main"]);
    for (const id of PLAYERS) expect(Object.keys(game.view(s, id, ctx(0))).sort()).toEqual(["hint", "myBid"]);
  });

  it("ipucu, ortak görünüm olmadan hiçbir yerden bir oyuncunun değerini daraltmaz: publicView ipucu alanı içermez", () => {
    const s = game.setup(PLAYERS, ctx(0));
    expect(Object.keys(game.publicView(s, ctx(0))).sort()).toEqual(
      [
        "bidIds",
        "boxes",
        "coins",
        "history",
        "phase",
        "players",
        "reveal",
        "round",
        "rounds",
        "stageEndsAt",
        "stageStartedAt",
        "startedAt",
      ].sort(),
    );
  });

  it("açılıştan sonra bile ipuçları açılmaz (yalnız sahibinde)", () => {
    const s = tickAt(game.setup(PLAYERS, ctx(0)), BORSA_BID_MS);
    expect(JSON.stringify(game.publicView(s, ctx(0)))).not.toContain("hint");
  });
});

describe("kara-borsa botu ve simülasyon", () => {
  it("bot teklifleri ayrıştırılır; çeşitli", () => {
    const bot = BOTS["kara-borsa"];
    if (!bot) throw new Error("bot yok");
    const seen = new Set<number>();
    let over = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const players = ["p1", "p2", "p3"];
      const s = game.setup(players, { now: 0, rng: createRng(seed), connected: players });
      for (const e of buildActions(bot, seed, players, 0)) {
        if (e.kind !== "valid" || !e.make || !players.includes(e.playerId)) continue;
        const raw = e.make({
          publicView: game.publicView(s, ctx(0)),
          privateView: game.view(s, e.playerId, ctx(0)),
          connected: players,
        }) as { amount: number };
        expect(game.parseAction(raw)).not.toBeNull();
        seen.add(raw.amount);
        if (raw.amount > 100) over++;
      }
    }
    expect(seen.size).toBeGreaterThan(20);
    expect(over).toBeGreaterThan(0);
  });

  it("tam oyun süre içinde biter", () => {
    const bot = BOTS["kara-borsa"];
    if (!bot) throw new Error("bot yok");
    for (const n of [3, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i + 1}`);
      const out = runSimulation(game, {
        seed: n,
        players,
        startedAt: 1_000,
        actions: buildActions(bot, n, players, 1_000),
        ticks: buildTicks(n, "irregular", 1_000, bot.durationMs),
        durationMs: bot.durationMs,
      });
      expect(out.endedAt - 1_000).toBeLessThanOrEqual(BORSA_DURATION_MS + 3_000);
      expect(Object.keys(out.result.awards)).toHaveLength(n);
    }
  });
});
