import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type AcgozlulukState, acgozlulukAwards, acgozlulukSettle, acgozlulukLimiti as g } from "./index.js";
import {
  ACGOZLULUK_CHOOSE_MS,
  ACGOZLULUK_DURATION_MS,
  ACGOZLULUK_LIMITS,
  ACGOZLULUK_PEEK_MS,
  ACGOZLULUK_REVEAL_MS,
  ACGOZLULUK_ROUND_REVEAL_MS,
  ACGOZLULUK_ROUNDS,
  acgozlulukBand,
  acgozlulukFairShare,
  acgozlulukLimit,
  acgozlulukScoutWord,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8), seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});

/** Kurulum; `limits` verilirse turların gerçek limitleri testte sabitlenir (sisli limitten bağımsız). */
function start(n = 4, limits?: readonly number[], seed = 1): AcgozlulukState {
  const s = g.setup(ids(n), ctx(T0, ids(n), seed));
  if (!limits) return s;
  return { ...s, rounds: s.rounds.map((r, i) => ({ ...r, limit: limits[i] ?? r.limit })) };
}
const roundStart = (s: AcgozlulukState, r: number) => (s.rounds[r]?.startAt ?? 0) - T0;

function choose(state: AcgozlulukState, id: string, value: number, at = 1_000): AcgozlulukState {
  const r = g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reject = (state: AcgozlulukState, id: string, value: number, at: number) =>
  g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
const lock = (state: AcgozlulukState, id: string, at: number, connected: readonly string[] = ids(8)) =>
  g.reduce(state, id, { kind: "lock" }, ctx(T0 + at, connected));
const lockOk = (state: AcgozlulukState, id: string, at: number, connected?: readonly string[]) => {
  const r = lock(state, id, at, connected);
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
};
/** Tur `r`'de herkes `values` sırasıyla seçer (turun 1. saniyesinde). */
function play(state: AcgozlulukState, r: number, values: readonly number[]): AcgozlulukState {
  let s = state;
  values.forEach((v, i) => {
    s = choose(s, `p${i + 1}`, v, roundStart(s, r) + 1_000);
  });
  return s;
}

describe("acgozluluk-limiti kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde (3 tur, sisli limit, Gözcü, en çok koyan kazanır)", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
    const text = g.briefing.steps.join(" ");
    for (const part of ["3 tur", "Seçmezsen 0", "sisli", "Gözcü", "en çok koyan kazanır"]) {
      expect(text).toContain(part);
    }
  });

  it("AL-M2: 3 tur; seçim 12 sn, ara açılış 5 sn, son açılış 7 sn (toplam en çok 53 sn)", () => {
    const s = start();
    expect(ACGOZLULUK_ROUNDS).toBe(3);
    expect(s.rounds).toHaveLength(3);
    expect(ACGOZLULUK_DURATION_MS).toBe(53_000);
    for (const [i, r] of s.rounds.entries()) {
      expect(r.endsAt - r.startAt).toBe(ACGOZLULUK_CHOOSE_MS);
      expect(r.revealEndsAt - r.endsAt).toBe(i === 2 ? ACGOZLULUK_REVEAL_MS : ACGOZLULUK_ROUND_REVEAL_MS);
      if (i > 0) expect(r.startAt).toBe(s.rounds[i - 1]?.revealEndsAt);
    }
    expect(g.isFinished(s, ctx(T0 + 52_999))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 53_000))).toBe(true);
    expect(g.revealAt?.(s, ctx(T0))).toBe(T0 + 12_000 * 3 + 5_000 * 2);
  });

  it("publicView turu, tur başlangıcını ve süreleri gösterir", () => {
    const s = start();
    const at = (t: number) => g.publicView(s, ctx(T0 + t));
    expect(at(0)).toMatchObject({ round: 1, rounds: 3, roundStartedAt: T0, endsAt: T0 + 12_000 });
    expect(at(12_000)).toMatchObject({ round: 1, revealEndsAt: T0 + 17_000 });
    expect(at(17_000)).toMatchObject({ round: 2, roundStartedAt: T0 + 17_000, reveal: null });
    expect(at(46_000)).toMatchObject({ round: 3 });
  });

  it("AL-M4: bant tablonun çevresinde (3–4: ±1, 5–6: ±2, 7–8: ±3); 3 kişide en az 5", () => {
    expect(ACGOZLULUK_LIMITS).toEqual({ 3: 6, 4: 11, 5: 17, 6: 24, 7: 33, 8: 43 });
    expect(acgozlulukBand(3)).toEqual({ low: 5, high: 7 });
    expect(acgozlulukBand(4)).toEqual({ low: 10, high: 12 });
    expect(acgozlulukBand(5)).toEqual({ low: 15, high: 19 });
    expect(acgozlulukBand(6)).toEqual({ low: 22, high: 26 });
    expect(acgozlulukBand(7)).toEqual({ low: 30, high: 36 });
    expect(acgozlulukBand(8)).toEqual({ low: 40, high: 46 });
    for (let n = 3; n <= 8; n++) {
      expect(acgozlulukBand(n).high).toBeLessThanOrEqual(n * n);
      expect(acgozlulukLimit(n)).toBe(ACGOZLULUK_LIMITS[n]);
    }
  });

  it("AL-M4: gerçek limit her tur bant içinden ayrı çekilir; tohum aynıysa aynı", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = start(5, undefined, seed);
      expect(s.band).toEqual({ low: 15, high: 19 });
      for (const r of s.rounds) {
        expect(r.limit).toBeGreaterThanOrEqual(15);
        expect(r.limit).toBeLessThanOrEqual(19);
        seen.add(r.limit);
      }
      expect(start(5, undefined, seed).rounds.map((r) => r.limit)).toEqual(s.rounds.map((r) => r.limit));
    }
    expect([...seen].sort()).toEqual([15, 16, 17, 18, 19]);
  });

  it("AL-M4: gerçek limit tur açılana kadar hiçbir görünümde yok; açılınca reveal.limit", () => {
    const s = start(5, [18, 16, 15]);
    for (const t of [0, 7_000, 11_999]) {
      const pub = g.publicView(s, ctx(T0 + t));
      expect(pub.band).toEqual({ low: 15, high: 19 });
      expect(JSON.stringify(pub)).not.toContain('"limit"');
      for (const p of [...ids(5), null])
        expect(JSON.stringify(g.view(s, p, ctx(T0 + t)))).not.toContain("limit");
    }
    expect(g.publicView(s, ctx(T0 + 12_000)).reveal?.limit).toBe(18);
    const r2 = g.publicView(s, ctx(T0 + 17_000));
    expect(r2.history.map((h) => h.reveal.limit)).toEqual([18]);
    expect(JSON.stringify(r2.reveal)).toBe("null");
  });

  it("adil pay ⌊orta değer ÷ N⌋: 3→2, 4→2, 5→3, 6→4, 7→4, 8→5", () => {
    expect([3, 4, 5, 6, 7, 8].map(acgozlulukFairShare)).toEqual([2, 2, 3, 4, 4, 5]);
  });

  it("seçim aralığı 0..N; aralık dışı reddedilir", () => {
    for (const n of [3, 5, 8]) {
      const s = start(n);
      expect(g.publicView(s, ctx(T0)).maxChoice).toBe(n);
      expect(isRejected(reject(s, "p1", n, 100))).toBe(false);
      expect(reject(s, "p1", n + 1, 100)).toEqual({ rejected: "out_of_range" });
    }
    expect(isRejected(reject(start(4), "p1", 0, 100))).toBe(false);
  });

  it("parseAction yalnız tamsayı, 0 ve üzeri, kind+value; lock yalnız kind", () => {
    expect(g.parseAction({ kind: "choose", value: 3 })).toEqual({ kind: "choose", value: 3 });
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    for (const bad of [
      { kind: "choose", value: -1 },
      { kind: "choose", value: 1.5 },
      { kind: "choose", value: "3" },
      { kind: "choose", value: Number.NaN },
      { kind: "choose", value: 1000 },
      { kind: "choose" },
      { kind: "choose", value: 2, extra: 1 },
      { kind: "lock", value: 1 },
      { value: 2 },
      [],
      null,
      "3",
    ]) {
      expect(g.parseAction(bad)).toBeNull();
    }
  });

  it("seçim tur bitene kadar değiştirilebilir; son seçim geçerli; aynı seçim durumu değiştirmez", () => {
    let s = start(4, [11, 11, 11]);
    s = choose(s, "p1", 4, 1_000);
    s = choose(s, "p1", 2, 11_999);
    expect(g.view(s, "p1", ctx(T0 + 11_999)).myChoice).toBe(2);
    expect(g.reduce(s, "p1", { kind: "choose", value: 2 }, ctx(T0 + 11_999))).toBe(s);
    expect(g.publicView(s, ctx(T0 + 12_000)).reveal?.choices.p1).toBe(2);
  });

  it("açılış sırasında ve oyun bitince seçim reddedilir; başlamadan önce de", () => {
    const s = choose(start(), "p1", 2);
    expect(reject(s, "p1", 3, 12_000)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 3, 16_999)).toEqual({ rejected: "ended" });
    expect(isRejected(reject(s, "p2", 3, 17_000))).toBe(false);
    expect(reject(s, "p2", 3, ACGOZLULUK_DURATION_MS + 10)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 3, -1)).toEqual({ rejected: "not_started" });
    for (const who of ["ghost", "", "__proto__"]) {
      expect(reject(s, who, 1, 100)).toEqual({ rejected: "not_participant" });
    }
  });

  it("her tur seçim boşalır; seçmeyen o turda 0 ve 'missing' listesinde", () => {
    let s = start(3, [6, 6, 6]);
    s = play(s, 0, [2, 2, 1]);
    const r2 = roundStart(s, 1);
    expect(g.view(s, "p1", ctx(T0 + r2)).myChoice).toBeNull();
    s = choose(s, "p1", 3, r2 + 500);
    const rv = g.publicView(s, ctx(T0 + r2 + 12_000)).reveal;
    expect(rv?.choices).toEqual({ p1: 3, p2: 0, p3: 0 });
    expect(rv?.missing).toEqual(["p2", "p3"]);
  });

  it("tur puanı: taşmazsa seçilen sayı, taşarsa (limit +1 bile) herkese 0; toplam = limit taşma değildir", () => {
    let s = start(3, [6, 6, 6]);
    s = play(s, 0, [2, 2, 2]); // 6 = limit
    s = play(s, 1, [3, 2, 2]); // 7 > 6
    s = play(s, 2, [3, 1, 0]); // 4
    const pub = g.publicView(s, ctx(T0 + 53_000 - 1));
    expect(pub.history.map((h) => [h.reveal.total, h.reveal.over])).toEqual([
      [6, false],
      [7, true],
    ]);
    expect(pub.history[1]?.reveal.points).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(pub.reveal).toMatchObject({ total: 4, over: false, points: { p1: 3, p2: 1, p3: 0 } });
    expect(pub.totals).toEqual({ p1: 5, p2: 3, p3: 2 });
    expect(g.result(s).miniScores).toEqual({ p1: 5, p2: 3, p3: 2 });
  });

  it("totals açılmış turları sayar: tur seçimi sürerken o tur dahil değil", () => {
    let s = start(3, [6, 6, 6]);
    s = play(s, 0, [2, 1, 1]);
    expect(g.publicView(s, ctx(T0 + 11_000)).totals).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(g.publicView(s, ctx(T0 + 12_000)).totals).toEqual({ p1: 2, p2: 1, p3: 1 });
    expect(g.publicView(s, ctx(T0 + 20_000)).totals).toEqual({ p1: 2, p2: 1, p3: 1 });
    expect(g.publicView(s, ctx(T0 + 20_000)).final).toBeNull();
  });
});

describe("acgozluluk-limiti genel skor (AL-M1)", () => {
  it("örnek 3-3-3-3-5 = 17 (tek tur): 5'i seçen +2, 3'ü seçen dördü +1", () => {
    expect(acgozlulukAwards({ a: 3, b: 3, c: 3, d: 3, e: 5 })).toEqual({ a: 1, b: 1, c: 1, d: 1, e: 2 });
  });
  it("örnek 4-4-3-3-3: iki eşit lider +1, kalanlar 0", () => {
    expect(acgozlulukAwards({ a: 4, b: 4, c: 3, d: 3, e: 3 })).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 0 });
  });
  it("örnek herkes eşit: hepsi +1; mini puanı 0 olan ödül almaz; herkes 0 ise kimse", () => {
    expect(acgozlulukAwards({ a: 3, b: 3, c: 3 })).toEqual({ a: 1, b: 1, c: 1 });
    expect(acgozlulukAwards({ a: 2, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(acgozlulukAwards({ a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("result: mini puan üç turun toplamı, awards +2/+1/0 (her katılımcı anahtarlı)", () => {
    let s = start(4, [11, 11, 11]);
    s = play(s, 0, [3, 3, 2, 2]); // 10
    s = play(s, 1, [4, 3, 3, 3]); // 13 taştı
    s = play(s, 2, [3, 2, 2, 1]); // 8
    const r = g.result(s);
    expect(r.miniScores).toEqual({ p1: 6, p2: 5, p3: 4, p4: 3 });
    expect(r.awards).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    expect(g.publicView(s, ctx(T0 + 52_000)).final).toEqual(r.awards);
  });

  it("hep taşarsa herkes 0, kimse ödül almaz", () => {
    let s = start(3, [6, 6, 6]);
    for (let r = 0; r < 3; r++) s = play(s, r, [3, 3, 3]);
    expect(g.result(s)).toEqual({ miniScores: { p1: 0, p2: 0, p3: 0 }, awards: { p1: 0, p2: 0, p3: 0 } });
  });

  it("kimse seçmezse herkes 0 ve taşma yok", () => {
    const s = start(5);
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 });
    expect(g.publicView(s, ctx(T0 + 12_000)).reveal).toMatchObject({ total: 0, over: false, order: [] });
  });
});

describe("acgozluluk-limiti dolum sırası ve taşıranlar (AL-U6)", () => {
  it("küçükten büyüğe, eşitlerde katılım sırası; 0 seçen şerit oluşturmaz", () => {
    let s = start(5, [17, 17, 17]);
    s = play(s, 0, [4, 0, 2, 4, 1]);
    expect(acgozlulukSettle(s, 0).order).toEqual(["p5", "p3", "p1", "p4"]);
    expect(acgozlulukSettle(s, 0).spillers).toEqual([]);
  });

  it("taşmada: limiti geçiren ilk şerit ve sonrakiler; aynı sayıyı seçenlerin hepsi", () => {
    let s = start(5, [10, 10, 10]);
    // sıra: p5(1) p3(2) p1(3) p2(3) p4(5) → 1,3,6,9,14: limit 10'u p4 geçirir.
    s = play(s, 0, [3, 3, 2, 5, 1]);
    expect(acgozlulukSettle(s, 0).spillers).toEqual(["p4"]);
    // sıra: p3(1) p1(3) p2(3) p4(3) → 1,4,7,10,… limit 8: p4 geçirir, aynı sayıdaki p1 ve p2 de damga alır.
    let t = start(4, [8, 8, 8]);
    t = play(t, 0, [3, 3, 1, 3]);
    expect(acgozlulukSettle(t, 0)).toMatchObject({ over: true, spillers: ["p1", "p2", "p4"] });
  });
});

describe("acgozluluk-limiti erken bitiş (tur başına)", () => {
  it("herkes kilitleyince tur 1 sn sonra kapanır; sonraki turlar öne çekilir", () => {
    let s = start(3, [6, 6, 6]);
    for (const id of ids(3)) s = choose(s, id, 1);
    s = lockOk(s, "p1", 2_000);
    s = lockOk(s, "p2", 3_000);
    s = lockOk(s, "p3", 4_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + 5_000);
    expect(s.rounds[0]?.revealEndsAt).toBe(T0 + 10_000);
    expect(s.rounds[1]?.startAt).toBe(T0 + 10_000);
    expect(s.rounds[2]?.revealEndsAt).toBe(T0 + 53_000 - 7_000);
    expect(g.publicView(s, ctx(T0 + 4_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 5_000)).reveal).toMatchObject({ total: 3 });
    expect(g.tick(s, ctx(T0 + 5_000)).revealed).toBe(1);
  });

  it("bir kişi eksikken bitmez; kopan oyuncu beklenmez", () => {
    let s = start(3);
    for (const id of ids(3)) s = choose(s, id, 1);
    s = lockOk(lockOk(s, "p1", 2_000), "p2", 3_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + 12_000);
    let t = choose(choose(start(3), "p1", 2), "p2", 2);
    t = lockOk(lockOk(t, "p1", 2_000, ["p1", "p2"]), "p2", 3_000, ["p1", "p2"]);
    expect(t.rounds[0]?.endsAt).toBe(T0 + 4_000);
  });

  it("kilit sonrası değişiklik, ikinci kilit ve seçimsiz kilit reddedilir", () => {
    let s = start(4);
    expect(lock(s, "p1", 1_000)).toEqual({ rejected: "nothing_to_lock" });
    s = choose(s, "p1", 2);
    s = lockOk(s, "p1", 2_000);
    expect(reject(s, "p1", 3, 3_000)).toEqual({ rejected: "locked" });
    expect(lock(s, "p1", 3_000)).toEqual({ rejected: "locked" });
    // sonraki turda kilit yeniden açıktır
    const r2 = roundStart(s, 1);
    expect(g.view(s, "p1", ctx(T0 + r2)).locked).toBe(false);
    expect(isRejected(reject(s, "p1", 3, r2 + 100))).toBe(false);
  });
});

describe("acgozluluk-limiti Gözcü (AL-M3)", () => {
  it("kelime eşikleri: ≤ %70 RAHAT, ≤ limit SINIRDA, üstü TAŞIYOR", () => {
    expect(acgozlulukScoutWord(0, 17)).toBe("rahat");
    expect(acgozlulukScoutWord(11, 17)).toBe("rahat"); // 11,9 sınır
    expect(acgozlulukScoutWord(12, 17)).toBe("sinirda");
    expect(acgozlulukScoutWord(7, 10)).toBe("rahat");
    expect(acgozlulukScoutWord(8, 10)).toBe("sinirda");
    expect(acgozlulukScoutWord(17, 17)).toBe("sinirda");
    expect(acgozlulukScoutWord(18, 17)).toBe("tasiyor");
  });

  it("her tur bir Gözcü; 3 turda 3 farklı kişi; kim olduğu herkese açık", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const s = start(5, undefined, seed);
      const scouts = [0, 1, 2].map((r) => g.publicView(s, ctx(T0 + roundStart(s, r) + 10)).scoutId);
      expect(new Set(scouts).size).toBe(3);
      for (const id of scouts) expect(ids(5)).toContain(id);
    }
  });

  it("3 oyuncuda üç tur, herkes bir kez Gözcü", () => {
    const s = start(3);
    const scouts = [0, 1, 2].map((r) => g.publicView(s, ctx(T0 + roundStart(s, r))).scoutId);
    expect([...scouts].sort()).toEqual(ids(3));
  });

  it("bağlantısı kopuk oyuncu Gözcü seçilmez (sıradaki bağlı oyuncuya geçer)", () => {
    let s = start(4);
    const second = s.scoutOrder[1] as string;
    const online = ids(4).filter((id) => id !== second);
    s = g.onPresence?.(s, ctx(T0 + 5_000, online)) ?? s;
    const r2 = g.publicView(s, ctx(T0 + roundStart(s, 1) + 1)).scoutId;
    expect(r2).not.toBe(second);
    expect(r2).toBe(s.scoutOrder[2]);
  });

  it("7. saniyede o anki gönderilmiş seçimlerin fotoğrafı; sonra güncellenmez; yalnız Gözcü görür", () => {
    let s = start(5, [17, 17, 17]);
    const scout = g.publicView(s, ctx(T0)).scoutId as string;
    s = choose(s, "p1", 5, 1_000);
    s = choose(s, "p2", 5, 2_000);
    expect(g.view(s, scout, ctx(T0 + ACGOZLULUK_PEEK_MS - 1)).scout).toBeNull();
    expect(g.publicView(s, ctx(T0 + ACGOZLULUK_PEEK_MS - 1)).scoutPeekedAt).toBeNull();
    // 10 / 17 ≤ %70 → RAHAT; 7. saniyeden sonraki seçimler fotoğrafı değiştirmez.
    s = choose(s, "p3", 5, 8_000);
    s = choose(s, "p4", 5, 9_000);
    expect(g.view(s, scout, ctx(T0 + 9_500)).scout).toEqual({ word: "rahat", at: T0 + 7_000 });
    expect(g.publicView(s, ctx(T0 + 9_500)).scoutPeekedAt).toBe(T0 + 7_000);
    for (const p of [...ids(5).filter((id) => id !== scout), null]) {
      expect(g.view(s, p, ctx(T0 + 9_500)).scout).toBeNull();
    }
    expect(JSON.stringify(g.publicView(s, ctx(T0 + 9_500)))).not.toMatch(/rahat|sinirda|tasiyor/);
    // Tick'li ve tick'siz yol aynı.
    expect(g.view(g.tick(s, ctx(T0 + 7_100)), scout, ctx(T0 + 9_500)).scout).toEqual({
      word: "rahat",
      at: T0 + 7_000,
    });
  });

  it("tick zamanlamasından bağımsız: fotoğraf 7. saniyede, sonradan gelen tick'le değil", () => {
    let a = start(4, [11, 11, 11]);
    a = choose(a, "p1", 4, 1_000);
    a = choose(a, "p2", 4, 6_000);
    const b = g.tick(a, ctx(T0 + 7_000));
    // a: tick yok; 8. saniyede gelen seçim önce fotoğrafı çeker.
    const a2 = choose(a, "p3", 4, 8_000);
    const b2 = choose(b, "p3", 4, 8_000);
    const scout = g.publicView(a, ctx(T0)).scoutId as string;
    expect(g.view(a2, scout, ctx(T0 + 9_000)).scout).toEqual(g.view(b2, scout, ctx(T0 + 9_000)).scout);
    expect(g.view(a2, scout, ctx(T0 + 9_000)).scout?.word).toBe("sinirda"); // 8 / 11
  });

  it("erken bitişte 7. saniye gelmeden herkes kilitlerse Gözcü kilit anında bakar", () => {
    let s = start(3, [6, 6, 6]);
    for (const id of ids(3)) s = choose(s, id, 3);
    for (const id of ids(3)) s = lockOk(s, id, 3_000);
    const scout = g.publicView(s, ctx(T0)).scoutId as string;
    expect(g.view(s, scout, ctx(T0 + 3_500)).scout).toEqual({ word: "tasiyor", at: T0 + 3_000 });
  });

  it("izleyici ve kopuk listesi kelimeyi değiştirmez; geçmiş turların kelimesi kimseye gitmez", () => {
    let s = start(4);
    s = g.tick(s, ctx(T0 + 8_000));
    const r2 = roundStart(s, 1);
    const pub = g.publicView(s, ctx(T0 + r2 + 1));
    expect(JSON.stringify(pub.history)).not.toMatch(/rahat|sinirda|tasiyor|peek/);
    for (const p of [...ids(4), null]) expect(g.view(s, p, ctx(T0 + r2 + 1)).scout).toBeNull();
  });
});

describe("acgozluluk-limiti tick ve belirlilik", () => {
  it("tick değişiklik yoksa aynı nesne; tur açılınca ve geçişte yeni nesne; connected'a bakmaz", () => {
    const s = g.tick(choose(start(), "p1", 1), ctx(T0 + 7_500));
    expect(g.tick(s, ctx(T0 + 8_000))).toBe(s);
    const opened = g.tick(s, ctx(T0 + 12_000));
    expect(opened).not.toBe(s);
    expect(opened.revealed).toBe(1);
    expect(g.tick(s, ctx(T0 + 12_000, []))).toEqual(opened);
    const next = g.tick(opened, ctx(T0 + 17_000));
    expect(next.shown).toBe(1);
  });

  it("nextWake tur başı, bakış, kapanış ve açılış bitişlerini verir", () => {
    const s = start();
    expect(g.nextWake?.(s, ctx(T0))).toBe(T0 + 7_000);
    expect(g.nextWake?.(s, ctx(T0 + 7_000))).toBe(T0 + 12_000);
    expect(g.nextWake?.(s, ctx(T0 + 12_000))).toBe(T0 + 17_000);
    expect(g.nextWake?.(s, ctx(T0 + 53_000))).toBeNull();
  });

  it("sonuç, bitiş tick'inden önce de aynı (idempotent)", () => {
    const s = choose(start(), "p1", 1);
    expect(g.result(s)).toEqual(g.result(g.tick(s, ctx(T0 + 99_999))));
  });
});

describe("acgozluluk-limiti gizlilik (yapısal)", () => {
  const keys = (v: unknown): string[] => {
    if (typeof v !== "object" || v === null) return [];
    return Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]);
  };

  it("secrets() boştur (gerekçe: değerler kısa sayılar / turdan tura tekrar eden kelime)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("tur açılmadan publicView seçim, toplam ya da gerçek limit taşımaz", () => {
    let s = start(5);
    s = choose(s, "p1", 5);
    s = choose(s, "p2", 4);
    for (const at of [0, 1, 7_000, 11_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(keys(pub)).not.toContain("choices");
      expect(keys(pub)).not.toContain("total");
      expect(keys(pub)).not.toContain("limit");
      expect(Object.values(pub.totals)).toEqual([0, 0, 0, 0, 0]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; izleyici ve katılımcı olmayan hiçbir şey görmez", () => {
    let s = start(5);
    s = choose(s, "p1", 5);
    s = choose(s, "p2", 4);
    expect(g.view(s, "p1", ctx(T0 + 5_000))).toMatchObject({ myChoice: 5, locked: false });
    expect(g.view(s, "p3", ctx(T0 + 5_000))).toMatchObject({ myChoice: null });
    expect(g.view(s, null, ctx(T0 + 5_000))).toEqual({ myChoice: null, locked: false, scout: null });
    expect(g.view(s, "ghost", ctx(T0 + 5_000))).toEqual({ myChoice: null, locked: false, scout: null });
  });

  it("bir oyuncunun seçimini değiştirmek başkasının görünümünü değiştirmez (Gözcü bakmadan önce)", () => {
    const a = choose(start(5), "p1", 1);
    const b = choose(a, "p1", 5);
    for (const viewer of ["p2", "p3", null]) {
      expect(g.view(a, viewer, ctx(T0 + 5_000))).toEqual(g.view(b, viewer, ctx(T0 + 5_000)));
    }
    expect(g.publicView(a, ctx(T0 + 5_000))).toEqual(g.publicView(b, ctx(T0 + 5_000)));
  });
});
