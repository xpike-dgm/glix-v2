import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type KorKronometreState, korKronometre, korKronometreEntries } from "./index.js";
import { KOR_KRONOMETRE_DURATION_MS, KOR_KRONOMETRE_REVEAL_MS } from "./types.js";

const T0 = 5_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c"]) => ({
  now,
  rng: createRng(1),
  connected,
});
const start = (players = ["a", "b", "c"]): KorKronometreState => korKronometre.setup(players, ctx(T0));

function press(state: KorKronometreState, id: string, at: number): KorKronometreState {
  const r = korKronometre.reduce(state, id, { kind: "press" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (state: KorKronometreState, id: string, at: number): string | null => {
  const r = korKronometre.reduce(state, id, { kind: "press" }, ctx(T0 + at));
  return isRejected(r) ? r.rejected : null;
};
const finish = (s: KorKronometreState) => korKronometre.tick(s, ctx(T0 + KOR_KRONOMETRE_DURATION_MS));

describe("kor-kronometre kuralları", () => {
  it("2-8 oyuncu, 18 sn, tek aşama", () => {
    expect(korKronometre.minPlayers).toBe(2);
    expect(korKronometre.maxPlayers).toBe(8);
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(18_000);
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

  it("basmayan oyuncu 18 000 ms basmış sayılır", () => {
    let s = start();
    s = press(s, "a", 1_000); // uzaklık 9000 > 8000
    const entries = korKronometreEntries(finish(s));
    const c = entries.find((e) => e.playerId === "c");
    expect(c).toMatchObject({ ms: 18_000, pressed: false, distance: 8_000 });
    const a = entries.find((e) => e.playerId === "a");
    expect(a?.distance).toBe(9_000);
    // Basmayanlar (b, c) eşit: ikisi de 1. derece; a 3. derece.
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 0, b: 2, c: 2 });
  });

  it("basan ile basmayan: 18 sn kabulü ikinci puanı da verir", () => {
    let s = start(["a", "b"]);
    s = press(s, "a", 9_000);
    expect(korKronometre.result(finish(s)).awards).toEqual({ a: 2, b: 1 });
  });

  it("kimse basmazsa hepsi 18 sn sayılır ve eşit derece paylaşılır", () => {
    const r = korKronometre.result(finish(start()));
    expect(r.awards).toEqual({ a: 2, b: 2, c: 2 });
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

  it("bağlantısı kopmuş oyuncunun basışı da geçerlidir ve basmayan sayılırsa 18 sn", () => {
    const s = start();
    const r = korKronometre.reduce(s, "a", { kind: "press" }, ctx(T0 + 10_000, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("bitiş: sonuç gösterimi bitince oyun biter", () => {
    const s = start();
    const end = T0 + KOR_KRONOMETRE_DURATION_MS + KOR_KRONOMETRE_REVEAL_MS;
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
      expect(Object.keys(pub).sort()).toEqual(["endsAt", "reveal", "revealEndsAt", "startedAt"]);
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

  it("view/publicView hiçbir yerde hedef sayısını (10000) ya da kalan süreyi taşımaz", () => {
    const s = start();
    const json = JSON_OF([korKronometre.publicView(s, ctx(T0 + 5_000)), korKronometre.view(s, "a", ctx(T0))]);
    expect(json).not.toContain("10000");
    expect(json).not.toContain("target");
  });
});
