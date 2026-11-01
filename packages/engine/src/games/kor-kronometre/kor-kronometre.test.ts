import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  type KorKronometreState,
  korKronometre,
  korKronometreEntries,
  korKronometreHandEntries,
  korKronometrePhaseAt,
  korKronometrePressTime,
  korKronometreStandings,
} from "./index.js";
import {
  KOR_KRONOMETRE_GAP_MS,
  KOR_KRONOMETRE_HANDS,
  KOR_KRONOMETRE_REVEAL_MS,
  KOR_KRONOMETRE_TOTAL_MS,
  korKronometreDurationMs,
} from "./types.js";

const T0 = 5_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
/** İlk elin hedefi `seconds` olan ilk tohum (hedefler setup'ta tohumlu RNG'den gelir). */
const seedForTarget = (seconds: number): number => {
  for (let seed = 1; seed < 5000; seed++) {
    if (korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed)).hands[0]?.targetMs === seconds * 1000)
      return seed;
  }
  throw new Error(`hedef ${seconds} için tohum yok`);
};
/** Varsayılan: 1. elin hedefi 10 sn. */
const start = (players = ["a", "b", "c"], targetSeconds = 10): KorKronometreState =>
  korKronometre.setup(players, ctx(T0, players, seedForTarget(targetSeconds)));
const hand = (s: KorKronometreState, i: number) => {
  const h = s.hands[i];
  if (!h) throw new Error(`el ${i} yok`);
  return h;
};
/** El `i`de "BAŞLA!"dan `ms` sonra (sunucunun aldığı an) basış; `at` verilirse dokunma anı (BAŞLA!'dan ms). */
function press(s: KorKronometreState, id: string, i: number, ms: number, at?: number): KorKronometreState {
  const go = hand(s, i).goAt;
  const action = at === undefined ? { kind: "press" as const } : { kind: "press" as const, at: go + at };
  const r = korKronometre.reduce(s, id, action, ctx(go + ms));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejectionAt = (s: KorKronometreState, id: string, now: number, at?: number): string | null => {
  const action = at === undefined ? { kind: "press" as const } : { kind: "press" as const, at };
  const r = korKronometre.reduce(s, id, action, ctx(now));
  return isRejected(r) ? r.rejected : null;
};
/** Bütün eller kapandıktan sonraki an (son açılış). */
const over = (s: KorKronometreState) => ctx(hand(s, KOR_KRONOMETRE_HANDS - 1).endsAt);

describe("kor-kronometre akış (KR-M2, KR-M3)", () => {
  it("2-8 oyuncu; 3 el: hazır ol 3/2/2 sn, basış hedef + 8 sn, el arası 3 sn, son açılış 6 sn", () => {
    expect(korKronometre.minPlayers).toBe(2);
    expect(korKronometre.maxPlayers).toBe(8);
    const s = start();
    expect(s.hands).toHaveLength(3);
    const [h0, h1, h2] = s.hands as [
      KorKronometreState["hands"][0],
      KorKronometreState["hands"][0],
      KorKronometreState["hands"][0],
    ];
    expect(h0.startAt).toBe(T0);
    expect(h0.goAt).toBe(T0 + 3_000);
    expect(h0.endsAt).toBe(h0.goAt + h0.targetMs + 8_000);
    expect(h1.startAt).toBe(h0.endsAt + KOR_KRONOMETRE_GAP_MS);
    expect(h1.goAt).toBe(h1.startAt + 2_000);
    expect(h1.endsAt).toBe(h1.goAt + korKronometreDurationMs(h1.targetMs));
    expect(h2.goAt).toBe(h2.startAt + 2_000);
    expect(s.revealEndsAt).toBe(h2.endsAt + KOR_KRONOMETRE_REVEAL_MS);
    expect(s.revealEndsAt - T0).toBeLessThanOrEqual(KOR_KRONOMETRE_TOTAL_MS);
    expect(KOR_KRONOMETRE_TOTAL_MS).toBe(
      3_000 + 21_000 + 3_000 + 2_000 + 21_000 + 3_000 + 2_000 + 21_000 + 6_000,
    );
  });

  it("anlatım: 3 madde (KR-U15)", () => {
    expect(korKronometre.briefing.steps).toEqual([
      "Sayaç görünmez; hedef yazılı (7–13 sn)",
      "'BAŞLA!' ile içinden say, tek kez bas",
      "3 el: her elde en yakın 2, ikinci 1 puan",
    ]);
  });

  it("hedefler: 7–13 tam saniye, eller arasında tekrarsız, tohumdan belirli; 1. elde bütün değerler çıkar", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) {
      const s = korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed));
      const targets = s.hands.map((h) => h.targetMs);
      expect(new Set(targets).size).toBe(3);
      for (const t of targets) {
        expect(Number.isInteger(t / 1000)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(7_000);
        expect(t).toBeLessThanOrEqual(13_000);
      }
      const again = korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed));
      expect(again.hands.map((h) => h.targetMs)).toEqual(targets);
      seen.add((targets[0] ?? 0) / 1000);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  });

  it("evreler: hazır ol → sayma → el arası → … → son açılış", () => {
    const s = start();
    const h0 = hand(s, 0);
    const h1 = hand(s, 1);
    const h2 = hand(s, 2);
    expect(korKronometrePhaseAt(s, T0)).toEqual({ hand: 0, phase: "ready" });
    expect(korKronometrePhaseAt(s, h0.goAt - 1)).toEqual({ hand: 0, phase: "ready" });
    expect(korKronometrePhaseAt(s, h0.goAt)).toEqual({ hand: 0, phase: "count" });
    expect(korKronometrePhaseAt(s, h0.endsAt)).toEqual({ hand: 0, phase: "gap" });
    expect(korKronometrePhaseAt(s, h1.startAt)).toEqual({ hand: 1, phase: "ready" });
    expect(korKronometrePhaseAt(s, h1.goAt)).toEqual({ hand: 1, phase: "count" });
    expect(korKronometrePhaseAt(s, h2.goAt)).toEqual({ hand: 2, phase: "count" });
    expect(korKronometrePhaseAt(s, h2.endsAt)).toEqual({ hand: 2, phase: "over" });
  });

  it("'Hazır ol' sırasında basış hak yakmaz (reddedilir, sonra basılabilir); el arasında basış sayılmaz", () => {
    const s = start();
    expect(rejectionAt(s, "a", T0 + 100)).toBe("not_started");
    expect(rejectionAt(s, "a", hand(s, 0).goAt - 1)).toBe("not_started");
    expect(rejectionAt(s, "a", hand(s, 0).goAt)).toBeNull();
    expect(rejectionAt(s, "a", hand(s, 0).endsAt)).toBe("between_hands");
    expect(rejectionAt(s, "a", hand(s, 1).startAt + 10)).toBe("not_started");
    expect(rejectionAt(s, "a", T0 - 1)).toBe("not_started");
  });

  it("basış süresi 'BAŞLA!'dan hedef + 8 sn: son ms kabul, kapanışta ve sonrasında red; son elden sonra ended", () => {
    const s = start(["a", "b"], 7);
    const h0 = hand(s, 0);
    expect(rejectionAt(s, "a", h0.goAt + 14_999)).toBeNull();
    expect(rejectionAt(s, "a", h0.goAt + 15_000)).toBe("between_hands");
    const h2 = hand(s, 2);
    expect(rejectionAt(s, "a", h2.endsAt - 1)).toBeNull();
    expect(rejectionAt(s, "a", h2.endsAt)).toBe("ended");
    expect(rejectionAt(s, "a", h2.endsAt + 9_000)).toBe("ended");
  });

  it("her elde bir basış; ikinci basış reddedilir ve ilk kayıt korunur; sonraki elde yeniden basılır", () => {
    let s = press(start(), "a", 0, 4_000);
    expect(rejectionAt(s, "a", hand(s, 0).goAt + 9_000)).toBe("already_pressed");
    expect(hand(s, 0).presses.a).toBe(4_000);
    s = press(s, "a", 1, 5_000);
    expect(hand(s, 1).presses.a).toBe(5_000);
  });

  it("katılımcı olmayan reddedilir", () => {
    const s = start();
    expect(rejectionAt(s, "x", hand(s, 0).goAt + 100)).toBe("not_participant");
  });

  it("kopuk oyuncunun basışı da geçerlidir", () => {
    const s = start();
    const r = korKronometre.reduce(s, "a", { kind: "press" }, ctx(hand(s, 0).goAt + 10_000, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("bitiş: son açılış bitince oyun biter; açılış son elin kapanışında başlar", () => {
    const s = start();
    expect(korKronometre.revealAt?.(s, ctx(T0))).toBe(hand(s, 2).endsAt);
    expect(korKronometre.isFinished(s, ctx(s.revealEndsAt - 1))).toBe(false);
    expect(korKronometre.isFinished(s, ctx(s.revealEndsAt))).toBe(true);
  });

  it("tick evre sayacını yalnız evre değişince değiştirir; nextWake sıradaki sınırı verir", () => {
    const s = start();
    expect(korKronometre.tick(s, ctx(T0 + 10))).toBe(s);
    const t = korKronometre.tick(s, ctx(hand(s, 0).goAt));
    expect(t.stage).toBe(1);
    expect(korKronometre.tick(t, ctx(hand(s, 0).goAt + 500))).toBe(t);
    expect(korKronometre.tick(t, ctx(hand(s, 0).endsAt)).stage).toBe(2);
    expect(korKronometre.tick(t, ctx(hand(s, 2).endsAt)).stage).toBe(8);
    expect(korKronometre.nextWake?.(s, ctx(T0))).toBe(hand(s, 0).goAt);
    expect(korKronometre.nextWake?.(s, ctx(hand(s, 0).goAt))).toBe(hand(s, 0).endsAt);
    expect(korKronometre.nextWake?.(s, ctx(hand(s, 2).endsAt))).toBe(s.revealEndsAt);
    expect(korKronometre.nextWake?.(s, ctx(s.revealEndsAt))).toBeNull();
  });

  it("parseAction yalnız {kind:'press'} ve isteğe bağlı sayı `at` kabul eder", () => {
    expect(korKronometre.parseAction({ kind: "press" })).toEqual({ kind: "press" });
    expect(korKronometre.parseAction({ kind: "press", at: 10_000 })).toEqual({ kind: "press", at: 10_000 });
    expect(korKronometre.parseAction({ kind: "press", at: "1" })).toBeNull();
    expect(korKronometre.parseAction({ kind: "press", at: -1 })).toBeNull();
    expect(korKronometre.parseAction({ kind: "press", at: Number.NaN })).toBeNull();
    expect(korKronometre.parseAction({ kind: "press", t: 10_000 })).toBeNull();
    expect(korKronometre.parseAction({ kind: "press", at: 1, x: 1 })).toBeNull();
    expect(korKronometre.parseAction({ kind: "tap" })).toBeNull();
    expect(korKronometre.parseAction([])).toBeNull();
    expect(korKronometre.parseAction(null)).toBeNull();
  });
});

describe("kor-kronometre dokunma anı (KR-M1)", () => {
  it("dokunma anı en çok 400 ms eskiyse kabul edilir", () => {
    const s = press(start(), "a", 0, 10_150, 10_000);
    expect(hand(s, 0).presses.a).toBe(10_000);
    const t = press(start(), "a", 0, 10_400, 10_000);
    expect(hand(t, 0).presses.a).toBe(10_000);
  });

  it("400 ms'den eskiyse sunucunun aldığı an kullanılır", () => {
    const s = press(start(), "a", 0, 10_401, 10_000);
    expect(hand(s, 0).presses.a).toBe(10_401);
  });

  it("gelecekten gelen an sunucunun aldığı ana çekilir; `at` yoksa sunucu anı", () => {
    const s = press(start(), "a", 0, 9_000, 9_500);
    expect(hand(s, 0).presses.a).toBe(9_000);
    const t = press(start(), "a", 0, 9_876);
    expect(hand(t, 0).presses.a).toBe(9_876);
  });

  it("'BAŞLA!'dan önceki an reddedilir (hak yanmaz)", () => {
    const s = start();
    const go = hand(s, 0).goAt;
    expect(rejectionAt(s, "a", go + 100, go - 1)).toBe("too_early");
    expect(rejectionAt(s, "a", go + 100, go)).toBeNull();
    expect(korKronometrePressTime(undefined, 0, 5)).toBe(5);
    expect(korKronometrePressTime(-1, 0, 5)).toBeNull();
  });

  it("süre sınırı değişmez: kapanıştan sonra ulaşan basış (dokunma anı erken olsa da) reddedilir", () => {
    const s = start();
    const h = hand(s, 0);
    expect(rejectionAt(s, "a", h.endsAt, h.endsAt - 100)).toBe("between_hands");
    const h2 = hand(s, 2);
    expect(rejectionAt(s, "a", h2.endsAt + 1, h2.endsAt - 50)).toBe("ended");
  });
});

describe("kor-kronometre el puanı", () => {
  const settle = (s: KorKronometreState, i = 0) => korKronometreEntries(s)[i] ?? [];
  const pts = (s: KorKronometreState, i = 0) =>
    Object.fromEntries(settle(s, i).map((e) => [e.playerId, e.points]));

  it("en yakın 2, ikinci yakın 1, diğerleri 0 (hedefin iki yanından)", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 0, 10_400);
    s = press(s, "b", 0, 9_700);
    s = press(s, "c", 0, 12_000);
    s = press(s, "d", 0, 3_000);
    expect(pts(s)).toEqual({ a: 1, b: 2, c: 0, d: 0 });
  });

  it("basmayan sıralamaya girmez, puan almaz, sonda yer alır; uzak basış bile basmayandan öndedir", () => {
    let s = start();
    s = press(s, "a", 0, 100);
    s = press(s, "b", 0, 17_900);
    expect(settle(s).map((e) => [e.playerId, e.rank, e.points])).toEqual([
      ["b", 1, 2],
      ["a", 2, 1],
      ["c", null, 0],
    ]);
    expect(settle(s)[2]).toEqual({
      playerId: "c",
      ms: null,
      pressed: false,
      distance: null,
      rank: null,
      bullseye: false,
      points: 0,
    });
  });

  it("eşitlik: iki birinci ikisi de 2, kimse 1 almaz; tek birinci iki ikinci: ikinciler 1", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 0, 9_500);
    s = press(s, "b", 0, 10_500);
    s = press(s, "c", 0, 11_000);
    s = press(s, "d", 0, 14_000);
    expect(settle(s).map((e) => [e.playerId, e.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", 4],
    ]);
    expect(pts(s)).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    let t = start(["a", "b", "c", "d"]);
    t = press(t, "a", 0, 10_200);
    t = press(t, "b", 0, 9_000);
    t = press(t, "c", 0, 11_000);
    t = press(t, "d", 0, 15_000);
    expect(pts(t)).toEqual({ a: 2, b: 1, c: 1, d: 0 });
  });

  it("tam isabet (KR-M5): 50 ms dahil +1 ek el puanı, derecesinden bağımsız; birden çok kişi alabilir", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 0, 10_000); // 0: 1. derece + bonus
    s = press(s, "b", 0, 9_950); // 50: 2. derece + bonus
    s = press(s, "c", 0, 10_050); // 50: 2. derece + bonus
    s = press(s, "d", 0, 10_051); // 51: bonus yok
    const e = settle(s);
    expect(e.map((x) => [x.playerId, x.rank, x.bullseye, x.points])).toEqual([
      ["a", 1, true, 3],
      ["b", 2, true, 2],
      ["c", 2, true, 2],
      ["d", 4, false, 0],
    ]);
  });

  it("mesafe o elin hedefinden ölçülür", () => {
    const players = ["a", "b"];
    const entries = korKronometreHandEntries(players, { targetMs: 7_000, presses: { a: 7_400, b: 6_000 } });
    expect(entries.map((e) => [e.playerId, e.distance, e.points])).toEqual([
      ["a", 400, 2],
      ["b", 1_000, 1],
    ]);
  });
});

describe("kor-kronometre erken bitiş (el başına)", () => {
  it("herkes basınca el son basıştan 1 sn sonra kapanır; sonraki eller kayar; sonuç açılır", () => {
    let s = start();
    const before = hand(s, 1).startAt;
    s = press(s, "a", 0, 9_000);
    s = press(s, "b", 0, 9_100);
    expect(hand(s, 0).endsAt).toBe(hand(start(), 0).endsAt);
    s = press(s, "c", 0, 9_200);
    const go = hand(s, 0).goAt;
    expect(hand(s, 0).endsAt).toBe(go + 10_200);
    expect(hand(s, 1).startAt).toBe(go + 10_200 + KOR_KRONOMETRE_GAP_MS);
    expect(hand(s, 1).startAt).toBeLessThan(before);
    expect(hand(s, 1).goAt).toBe(hand(s, 1).startAt + 2_000);
    expect(s.revealEndsAt).toBe(hand(s, 2).endsAt + KOR_KRONOMETRE_REVEAL_MS);
    expect(korKronometre.publicView(s, ctx(go + 10_199)).played[0]?.reveal).toBeNull();
    expect(korKronometre.publicView(s, ctx(go + 10_200)).played[0]?.reveal).not.toBeNull();
    expect(rejectionAt(s, "a", go + 9_500)).toBe("already_pressed");
  });

  it("bir kişi eksikken bitmez; bağlantıya bakılmaz", () => {
    let s = start();
    s = press(s, "a", 0, 5_000);
    s = press(s, "b", 0, 6_000);
    expect(hand(s, 0).endsAt).toBe(hand(s, 0).goAt + korKronometreDurationMs(10_000));
    expect(korKronometre.tick(s, ctx(hand(s, 0).goAt + 7_000, ["a", "b"]))).toEqual(
      korKronometre.tick(s, ctx(hand(s, 0).goAt + 7_000)),
    );
  });
});

describe("kor-kronometre genel skor (KR-M3)", () => {
  /** Üç el oynatır: `plan[el][oyuncu]` = hedefe göre fark (ms) ya da basmadı (yok). */
  function play(players: string[], plan: Record<string, number>[]): KorKronometreState {
    let s = start(players);
    plan.forEach((presses, i) => {
      for (const [id, off] of Object.entries(presses)) s = press(s, id, i, hand(s, i).targetMs + off);
    });
    return s;
  }

  it("toplam el puanına göre +2 / +1 / 0; mini puan toplamdır", () => {
    const s = play(
      ["a", "b", "c"],
      [
        { a: 100, b: 200, c: 900 }, // a2 b1
        { a: 300, b: 100, c: 900 }, // b2 a1
        { a: 100, b: 900, c: 200 }, // a2 c1
      ],
    );
    const r = korKronometre.result(s);
    expect(r.miniScores).toEqual({ a: 5, b: 3, c: 1 });
    expect(r.awards).toEqual({ a: 2, b: 1, c: 0 });
    const pub = korKronometre.publicView(s, over(s));
    expect(pub.phase).toBe("over");
    expect(pub.final?.standings.map((x) => [x.playerId, x.total, x.rank, x.award])).toEqual([
      ["a", 5, 1, 2],
      ["b", 3, 2, 1],
      ["c", 1, 3, 0],
    ]);
    expect(pub.final?.standings[0]?.handPoints).toEqual([2, 1, 2]);
    expect(pub.totals).toEqual({ a: 5, b: 3, c: 1 });
  });

  it("eşitlik bozucu 1: toplam eşitse daha çok elde basan önde", () => {
    const s = play(
      ["a", "b", "c"],
      [
        { a: 100, b: 200, c: 300 }, // a2 b1
        { b: 100, c: 200 }, // b2 c1 (a basmadı)
        { c: 100, a: 200, b: 900 }, // c2 a1
      ],
    );
    // a: 3 (2 el), b: 3 (3 el), c: 3 (3 el) → b ve c 3 elde; ortalama: b (200+100+900)/3=400, c (300+200+100)/3=200
    const st = korKronometreStandings(s.players, korKronometreEntries(s));
    expect(st.map((x) => [x.playerId, x.total, x.pressedHands, x.rank, x.award])).toEqual([
      ["c", 3, 3, 1, 2],
      ["b", 3, 3, 2, 1],
      ["a", 3, 2, 3, 0],
    ]);
  });

  it("tam eşitlik: birincide eşitlik hepsi +2, sonraki +1; herkes eşit ve > 0 ise herkes +1", () => {
    const st = korKronometreStandings(
      ["a", "b", "c"],
      [
        [
          { playerId: "a", ms: 1, pressed: true, distance: 100, rank: 1, bullseye: false, points: 2 },
          { playerId: "b", ms: 1, pressed: true, distance: 100, rank: 1, bullseye: false, points: 2 },
          { playerId: "c", ms: 1, pressed: true, distance: 300, rank: 3, bullseye: false, points: 1 },
        ],
      ],
    );
    expect(st.map((x) => [x.playerId, x.rank, x.award])).toEqual([
      ["a", 1, 2],
      ["b", 1, 2],
      ["c", 3, 1],
    ]);
    const all = korKronometreStandings(
      ["a", "b"],
      [
        [
          { playerId: "a", ms: 1, pressed: true, distance: 100, rank: 1, bullseye: false, points: 2 },
          { playerId: "b", ms: 1, pressed: true, distance: 100, rank: 1, bullseye: false, points: 2 },
        ],
      ],
    );
    expect(all.map((x) => x.award)).toEqual([1, 1]);
  });

  it("hiç basmayanlar basanların gerisinde ve kendi aralarında aynı derecede", () => {
    const s = play(["a", "b", "c", "d"], [{ a: 100, b: 900 }, {}, {}]);
    const st = korKronometreStandings(s.players, korKronometreEntries(s));
    expect(st.map((x) => [x.playerId, x.rank, x.award, x.avgDistance])).toEqual([
      ["a", 1, 2, 100],
      ["b", 2, 1, 900],
      ["c", 3, 0, null],
      ["d", 3, 0, null],
    ]);
    const none = korKronometreStandings(
      ["a", "b"],
      [korKronometreHandEntries(["a", "b"], { targetMs: 9_000, presses: {} })],
    );
    expect(none.map((x) => [x.rank, x.award])).toEqual([
      [1, 0],
      [1, 0],
    ]);
  });

  it("toplamı 0 olan ödül almaz; kimse basmazsa kimse ödül almaz", () => {
    const s = play(["a", "b", "c"], [{ a: 100 }, { a: 100 }, { a: 100 }]);
    expect(korKronometre.result(s).awards).toEqual({ a: 2, b: 0, c: 0 });
    const none = start();
    expect(korKronometre.result(none).awards).toEqual({ a: 0, b: 0, c: 0 });
    expect(korKronometre.result(none).miniScores).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("2 oyuncu: her elde yakın 2, uzak 1; toplamda yüksek +2, diğeri +1", () => {
    const s = play(
      ["a", "b"],
      [
        { a: 100, b: 200 },
        { a: 100, b: 200 },
        { a: 300, b: 200 },
      ],
    );
    expect(korKronometre.result(s).miniScores).toEqual({ a: 5, b: 4 });
    expect(korKronometre.result(s).awards).toEqual({ a: 2, b: 1 });
  });
});

describe("kor-kronometre gizlilik", () => {
  it("el kapanmadan publicView o elin hiçbir basışını ya da basanını taşımaz", () => {
    let s = start();
    s = press(s, "a", 0, 7_321);
    s = press(s, "b", 0, 10_042);
    const go = hand(s, 0).goAt;
    for (const at of [0, 7_400, 10_100, 17_999]) {
      const pub = korKronometre.publicView(s, ctx(go + at));
      expect(pub.played[0]?.reveal).toBeNull();
      const json = JSON.stringify(pub);
      expect(json).not.toContain("7321");
      expect(json).not.toContain("10042");
      expect(json).not.toMatch(/presses|"pressed"/);
    }
  });

  it("gelecek ellerin hedefi ve oyunun bitişi görünmez; el arasında yalnız sıradaki elin hedefi açılır", () => {
    const s = start();
    const pub0 = korKronometre.publicView(s, ctx(T0 + 100));
    expect(pub0.played).toHaveLength(1);
    expect(pub0.endsAt).toBeNull();
    expect(pub0.revealEndsAt).toBeNull();
    const gap = korKronometre.publicView(s, ctx(hand(s, 0).endsAt));
    expect(gap.phase).toBe("gap");
    expect(gap.hand).toBe(0);
    expect(gap.played.map((h) => h.targetMs)).toEqual([hand(s, 0).targetMs, hand(s, 1).targetMs]);
    expect(gap.endsAt).toBeNull();
    const last = korKronometre.publicView(s, ctx(hand(s, 2).goAt));
    expect(last.played).toHaveLength(3);
    expect(last.endsAt).toBe(hand(s, 2).endsAt);
    expect(last.revealEndsAt).toBe(s.revealEndsAt);
    expect(last.final).toBeNull();
  });

  it("view yalnız bu elde bastın mı der; kendi basış anı da gizlidir", () => {
    let s = start();
    s = press(s, "a", 0, 7_321);
    const now = ctx(hand(s, 0).goAt + 8_000);
    for (const who of ["a", "b", "c", null]) {
      expect(JSON.stringify(korKronometre.view(s, who, now))).not.toContain("7321");
    }
    expect(korKronometre.view(s, "a", now)).toEqual({ pressed: true });
    expect(korKronometre.view(s, "b", now)).toEqual({ pressed: false });
    expect(korKronometre.view(s, null, now)).toEqual({ pressed: false });
    // Sonraki elde yeniden basmamış sayılır.
    expect(korKronometre.view(s, "a", ctx(hand(s, 1).goAt))).toEqual({ pressed: false });
  });

  it("el kapanınca o elin satırları herkese açılır; totals günceller", () => {
    let s = start();
    s = press(s, "a", 0, 9_321);
    const pub = korKronometre.publicView(s, ctx(hand(s, 0).endsAt));
    expect(pub.played[0]?.reveal?.entries[0]).toMatchObject({ playerId: "a", ms: 9_321, rank: 1, points: 2 });
    expect(pub.played[0]?.reveal?.entries).toHaveLength(3);
    expect(pub.totals).toEqual({ a: 2, b: 0, c: 0 });
  });
});
