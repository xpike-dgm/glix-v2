import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type KorKronometreState, korKronometre, korKronometreEntries } from "./index.js";
import { KOR_KRONOMETRE_REVEAL_MS, korKronometreDurationMs } from "./types.js";

const T0 = 5_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
/** Hedefi `seconds` olan ilk tohum (hedef setup'ta tohumlu RNG'den gelir). */
const seedForTarget = (seconds: number): number => {
  for (let seed = 1; seed < 5000; seed++) {
    if (korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed)).targetMs === seconds * 1000) return seed;
  }
  throw new Error(`hedef ${seconds} için tohum yok`);
};
/** Varsayılan: hedef 10 sn (süre 18 sn); diğer testler hedefi açıkça seçer. */
const start = (players = ["a", "b", "c"], targetSeconds = 10): KorKronometreState =>
  korKronometre.setup(players, ctx(T0, players, seedForTarget(targetSeconds)));

function press(state: KorKronometreState, id: string, at: number): KorKronometreState {
  const r = korKronometre.reduce(state, id, { kind: "press" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (state: KorKronometreState, id: string, at: number): string | null => {
  const r = korKronometre.reduce(state, id, { kind: "press" }, ctx(T0 + at));
  return isRejected(r) ? r.rejected : null;
};
const finish = (s: KorKronometreState) => korKronometre.tick(s, ctx(T0 + (s.endsAt - s.startedAt)));

describe("kor-kronometre kuralları", () => {
  it("2-8 oyuncu, tek aşama; süre = hedef + 8 sn", () => {
    expect(korKronometre.minPlayers).toBe(2);
    expect(korKronometre.maxPlayers).toBe(8);
    for (const sec of [7, 8, 9, 10, 11, 12, 13]) {
      const s = start(["a", "b", "c"], sec);
      expect(s.targetMs).toBe(sec * 1000);
      expect(s.endsAt - s.startedAt).toBe(sec * 1000 + 8_000);
      expect(s.revealEndsAt - s.endsAt).toBe(KOR_KRONOMETRE_REVEAL_MS);
    }
  });

  it("anlatım: 3 madde, 2. madde hedef süreyi saymak", () => {
    expect(korKronometre.briefing.steps).toHaveLength(3);
    expect(korKronometre.briefing.steps[1]).toBe("İçinden hedef süreyi say");
  });

  it("basış penceresi hedefe göre: hedef 7 -> 15 sn, hedef 13 -> 21 sn", () => {
    const a = start(["a", "b"], 7);
    expect(rejection(a, "a", 14_999)).toBeNull();
    expect(rejection(a, "a", 15_000)).toBe("ended");
    const b = start(["a", "b"], 13);
    expect(rejection(b, "a", 20_999)).toBeNull();
    expect(rejection(b, "a", 21_000)).toBe("ended");
  });

  it("hedef: 7–13 tam saniye, tohumdan belirli; tüm değerler çıkar; farklı tohumlarda değişir", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) {
      const s = korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed));
      expect(Number.isInteger(s.targetMs / 1000)).toBe(true);
      expect(s.targetMs).toBeGreaterThanOrEqual(7_000);
      expect(s.targetMs).toBeLessThanOrEqual(13_000);
      const again = korKronometre.setup(["a", "b"], ctx(T0, ["a", "b"], seed));
      expect(again.targetMs).toBe(s.targetMs);
      seen.add(s.targetMs / 1000);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  });

  it("basış anı sunucu saatinden oyun başına göre kaydedilir", () => {
    const s = press(start(), "a", 9_876);
    expect(s.presses).toEqual({ a: 9_876 });
  });

  it("en yakın +2, ikinci yakın +1, diğerleri 0 (hedefin iki yanından)", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 10_400); // 400
    s = press(s, "b", 9_700); // 300
    s = press(s, "c", 12_000); // 2000
    s = press(s, "d", 3_000); // 7000
    const r = korKronometre.result(finish(s));
    expect(r.awards).toEqual({ a: 1, b: 2, c: 0, d: 0 });
    expect(r.miniScores).toEqual(r.awards);
  });

  it("tam isabet (10 000 ms) en yakındır", () => {
    let s = start();
    s = press(s, "a", 10_000);
    s = press(s, "b", 10_001);
    const r = korKronometre.result(finish(s));
    expect(r.awards).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("basmayan oyuncu sıralamaya girmez, puan almaz; sıralama sonunda 'basmadı' olarak yer alır", () => {
    let s = start();
    s = press(s, "a", 1_000); // uzaklık 9000: tek basan
    const entries = korKronometreEntries(finish(s));
    expect(entries.map((e) => e.playerId)).toEqual(["a", "b", "c"]);
    expect(entries[0]).toMatchObject({ playerId: "a", pressed: true, rank: 1, points: 2, distance: 9_000 });
    for (const e of entries.slice(1)) {
      expect(e).toEqual({ playerId: e.playerId, ms: null, pressed: false, distance: null, rank: null, points: 0 });
    }
  });

  it("basmayan, basanların uzaklığından bağımsız: uzak basış bile basmayandan öndedir", () => {
    let s = start(["a", "b", "c"]);
    s = press(s, "a", 100);
    s = press(s, "b", 17_900);
    const entries = korKronometreEntries(finish(s));
    expect(entries.map((e) => [e.playerId, e.rank, e.points])).toEqual([
      ["b", 1, 2],
      ["a", 2, 1],
      ["c", null, 0],
    ]);
  });

  it("yalnız bir kişi bastıysa +2 o alır, diğerleri 0", () => {
    let s = start(["a", "b"]);
    s = press(s, "b", 17_000);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 0, b: 2 });
  });

  it("kimse basmazsa kimse puan almaz ve kimse sıralanmaz", () => {
    const f = finish(start());
    expect(korKronometre.result(f).awards).toEqual({ a: 0, b: 0, c: 0 });
    expect(korKronometreEntries(f).every((e) => e.rank === null && !e.pressed)).toBe(true);
  });

  it("iki kişi bastı, biri basmadı: ikinci +1, basmayan 0", () => {
    let s = start();
    s = press(s, "a", 9_000);
    s = press(s, "c", 12_000);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 2, b: 0, c: 1 });
  });

  it("eşitlik: iki birinci ikisi de +2, kimse +1 almaz (sonraki derece atlanır)", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 9_500);
    s = press(s, "b", 10_500);
    s = press(s, "c", 11_000);
    s = press(s, "d", 14_000);
    const entries = korKronometreEntries(finish(s));
    expect(entries.map((e) => [e.playerId, e.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", 4],
    ]);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 2, b: 2, c: 0, d: 0 });
  });

  it("eşitlik: tek birinci, iki ikinci -> ikisi de +1", () => {
    let s = start(["a", "b", "c", "d"]);
    s = press(s, "a", 10_000);
    s = press(s, "b", 9_000);
    s = press(s, "c", 11_000);
    s = press(s, "d", 15_000);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 2, b: 1, c: 1, d: 0 });
  });

  it("hedef 10 dışında da mesafe o turun hedefinden ölçülür", () => {
    let s = start(["a", "b", "c"], 7);
    s = press(s, "a", 10_000); // 3000
    s = press(s, "b", 7_400); // 400
    s = press(s, "c", 6_000); // 1000
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 0, b: 2, c: 1 });
  });

  it("eşitlik: aynı mesafede iki basış (hedefin iki yanı) ikisi de 1. derece", () => {
    let s = start(["a", "b", "c"], 12);
    s = press(s, "a", 11_000);
    s = press(s, "b", 13_000);
    s = press(s, "c", 12_500);
    const entries = korKronometreEntries(finish(s));
    expect(entries.map((e) => [e.playerId, e.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 2],
    ]);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("sıralama yakından uzağa; aynı mesafede katılım sırası", () => {
    let s = start();
    s = press(s, "c", 10_300);
    s = press(s, "a", 9_700);
    expect(korKronometreEntries(finish(s)).map((e) => e.playerId)).toEqual(["a", "c", "b"]);
  });

  it("yalnız bir basış: bir kez basılır, ikincisi reddedilir ve ilk kayıt korunur", () => {
    const s = press(start(), "a", 4_000);
    expect(rejection(s, "a", 10_000)).toBe("already_pressed");
    expect(s.presses.a).toBe(4_000);
  });

  it("süre dolunca (18 000 ms) gelen basış reddedilir; 17 999 ms kabul edilir", () => {
    const s = start();
    expect(rejection(s, "a", 17_999)).toBeNull();
    expect(rejection(s, "a", 18_000)).toBe("ended");
    expect(rejection(s, "a", 25_000)).toBe("ended");
  });

  it("katılımcı olmayan reddedilir", () => {
    expect(rejection(start(), "x", 100)).toBe("not_participant");
  });

  it("oyun başından önceki an reddedilir", () => {
    expect(rejection(start(), "a", -1)).toBe("not_started");
  });

  it("bağlantısı kopmuş oyuncunun basışı da geçerlidir ve basmayan sayılırsa sıralanmaz", () => {
    const s = start();
    const r = korKronometre.reduce(s, "a", { kind: "press" }, ctx(T0 + 10_000, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("bitiş: sonuç gösterimi bitince oyun biter", () => {
    const s = start();
    const end = T0 + korKronometreDurationMs(10_000) + KOR_KRONOMETRE_REVEAL_MS;
    expect(korKronometre.isFinished(s, ctx(end - 1))).toBe(false);
    expect(korKronometre.isFinished(s, ctx(end))).toBe(true);
  });

  it("parseAction yalnız {kind:'press'} kabul eder", () => {
    expect(korKronometre.parseAction({ kind: "press" })).toEqual({ kind: "press" });
    expect(korKronometre.parseAction({ kind: "press", t: 10_000 })).toBeNull();
    expect(korKronometre.parseAction({ kind: "tap" })).toBeNull();
    expect(korKronometre.parseAction([])).toBeNull();
    expect(korKronometre.parseAction(null)).toBeNull();
  });

  it("tick bayrağı yalnız süre dolunca ve bir kez değişir", () => {
    const s = start();
    expect(korKronometre.tick(s, ctx(T0 + 17_999))).toBe(s);
    const t = korKronometre.tick(s, ctx(T0 + 18_000));
    expect(t.revealed).toBe(true);
    expect(korKronometre.tick(t, ctx(T0 + 19_000))).toBe(t);
  });
});

describe("kor-kronometre gizlilik", () => {
  const JSON_OF = (v: unknown) => JSON.stringify(v);

  it("süre dolmadan publicView hiçbir basış ya da basan taşımaz", () => {
    let s = start();
    s = press(s, "a", 7_321);
    s = press(s, "b", 10_042);
    for (const at of [0, 7_400, 10_100, 17_999]) {
      const pub = korKronometre.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      const json = JSON_OF(pub);
      expect(json).not.toContain("7321");
      expect(json).not.toContain("10042");
      expect(Object.keys(pub).sort()).toEqual(["endsAt", "reveal", "revealEndsAt", "startedAt", "targetMs"]);
    }
  });

  it("view yalnız bastın mı der; kendi basış anı da gizlidir; başkasınınki yok", () => {
    let s = start();
    s = press(s, "a", 7_321);
    for (const who of ["a", "b", "c", null]) {
      const json = JSON_OF(korKronometre.view(s, who, ctx(T0 + 8_000)));
      expect(json).not.toContain("7321");
    }
    expect(korKronometre.view(s, "a", ctx(T0 + 8_000))).toEqual({ pressed: true });
    expect(korKronometre.view(s, "b", ctx(T0 + 8_000))).toEqual({ pressed: false });
    expect(korKronometre.view(s, null, ctx(T0 + 8_000))).toEqual({ pressed: false });
  });

  it("süre dolunca herkese açılır (sonuç satırları ve basış anları)", () => {
    let s = start();
    s = press(s, "a", 9_321);
    const pub = korKronometre.publicView(s, ctx(T0 + 18_000));
    expect(pub.reveal?.entries[0]).toMatchObject({ playerId: "a", ms: 9_321, rank: 1, points: 2 });
    expect(pub.reveal?.entries).toHaveLength(3);
  });

  it("hedef herkese açıktır; kişisel görünümde yoktur ve kalan süre sayacı hiçbir yerde taşınmaz", () => {
    const s = start(["a", "b", "c"], 11);
    expect(korKronometre.publicView(s, ctx(T0 + 5_000)).targetMs).toBe(11_000);
    expect(korKronometre.publicView(s, ctx(T0 + 5_000, [], 99)).targetMs).toBe(11_000);
    expect(JSON_OF(korKronometre.view(s, "a", ctx(T0)))).toBe('{"pressed":false}');
    expect(Object.keys(korKronometre.publicView(s, ctx(T0))).some((k) => /remain|left|kalan/i.test(k))).toBe(false);
  });
});

describe("kor-kronometre erken bitiş (herkes bastı)", () => {
  const everyone = (at: number): KorKronometreState => {
    let s = start();
    for (const [i, id] of ["a", "b", "c"].entries()) s = press(s, id, at + i * 100);
    return s;
  };

  it("(a) herkes basınca son basıştan 1 sn sonra açılır; sonuç gösterimi kayar; puanlar aynı", () => {
    const s = everyone(9_000); // son basış 9 200
    expect(s.endsAt).toBe(T0 + 10_200);
    expect(korKronometre.publicView(s, ctx(T0 + 10_199)).reveal).toBeNull();
    expect(korKronometre.publicView(s, ctx(T0 + 10_200)).reveal).not.toBeNull();
    expect(korKronometre.isFinished(s, ctx(T0 + 10_200 + KOR_KRONOMETRE_REVEAL_MS - 1))).toBe(false);
    expect(korKronometre.isFinished(s, ctx(T0 + 10_200 + KOR_KRONOMETRE_REVEAL_MS))).toBe(true);
    expect(korKronometre.tick(s, ctx(T0 + 10_200)).revealed).toBe(true);
    // 9 200 en uzak (800), 9 100 ikinci, 9 000 ... hepsi hedefin altında: en yakın c (9 200).
    expect(korKronometre.result(s).awards).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("(a2) erken bitiş hedefe göre: hedef 7 iken herkes basınca yine 1 sn sonra açılır", () => {
    let s = start(["a", "b"], 7);
    s = press(s, "a", 6_000);
    s = press(s, "b", 8_000);
    expect(s.endsAt).toBe(T0 + 9_000);
    expect(korKronometre.result(s).awards).toEqual({ a: 2, b: 2 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start();
    s = press(s, "a", 5_000);
    s = press(s, "b", 6_000);
    expect(s.endsAt).toBe(T0 + korKronometreDurationMs(10_000));
    expect(korKronometre.publicView(s, ctx(T0 + 12_000)).reveal).toBeNull();
  });

  it("(c) bağlantıya bakılmaz: kopuk oyuncu da basmadan bitmez (yalnız süre dolar)", () => {
    let s = start();
    s = press(s, "a", 5_000);
    s = press(s, "b", 6_000);
    expect(korKronometre.tick(s, ctx(T0 + 7_000, ["a", "b"]))).toBe(s);
    expect(s.endsAt).toBe(T0 + korKronometreDurationMs(10_000));
  });

  it("(d) herkes bastıktan sonra yeni basış reddedilir", () => {
    const s = everyone(9_000);
    expect(rejection(s, "a", 9_500)).toBe("already_pressed");
    expect(rejection(s, "a", 10_200)).toBe("ended");
  });

  it("(e) süre dolmadan kim bastığı hiçbir görünümde yoktur", () => {
    let s = start();
    s = press(s, "a", 5_000);
    const p = JSON.stringify(korKronometre.publicView(s, ctx(T0 + 6_000)));
    expect(p).not.toMatch(/presses|pressed|"a"/);
  });

  it("(f) tick bağlantıya bakmaz", () => {
    const s = everyone(9_000);
    expect(korKronometre.tick(s, ctx(T0 + 11_000, []))).toEqual(korKronometre.tick(s, ctx(T0 + 11_000)));
  });
});
