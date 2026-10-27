import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { ortalamaninYarisi as g, type OrtalamaState, ortalamaAwards, ortalamaSettle } from "./index.js";
import {
  ORTALAMA_CHOOSE_MS,
  ORTALAMA_DURATION_MS,
  ORTALAMA_MULTIPLIERS,
  ORTALAMA_REVEAL_MS,
  ORTALAMA_ROUND_REVEAL_MS,
  ORTALAMA_ROUNDS,
  ortalamaMultiplier,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, seed = 1, connected: readonly string[] = ids(8)) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (n = 4, seed = 1): OrtalamaState => g.setup(ids(n), ctx(T0, seed));

function choose(state: OrtalamaState, id: string, value: number, at = 1_000): OrtalamaState {
  const r = g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reject = (state: OrtalamaState, id: string, value: number, at: number) =>
  g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
const reveal = (s: OrtalamaState) => {
  const r = g.publicView(s, ctx(T0 + ORTALAMA_CHOOSE_MS)).reveal;
  if (!r) throw new Error("sonuç açılmadı");
  return r;
};
/** Herkes 1. turda seçer; 1. turun sonucu döner (`res`: o turun puanları; genel skor yalnız oyun sonunda). */
function play(values: number[]) {
  let s = start(values.length);
  values.forEach((v, i) => {
    s = choose(s, `p${i + 1}`, v);
  });
  const r = reveal(s);
  return { s, r, res: { awards: r.points, miniScores: r.points } };
}

describe("ortalamanin-yarisi kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("3 tur: her turda seçim 10 sn, ardından sonuç gösterimi; son sonuçtan sonra biter", () => {
    const s = start();
    expect(ORTALAMA_CHOOSE_MS).toBe(10_000);
    expect(ORTALAMA_ROUNDS).toBe(3);
    expect(ORTALAMA_REVEAL_MS).toBeLessThanOrEqual(7_000);
    expect(s.rounds).toHaveLength(3);
    expect(s.rounds.map((x) => x.endsAt - x.startAt)).toEqual([10_000, 10_000, 10_000]);
    // 10 + 5 | 10 + 5 | 10 + 7 = 47 sn
    expect(ORTALAMA_DURATION_MS).toBe(47_000);
    expect(g.isFinished(s, ctx(T0 + 10_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 15_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 40_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ORTALAMA_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ORTALAMA_DURATION_MS))).toBe(true);
  });

  it("sayı 0–100 tam sayı: sınırlar kabul, dışı ve ondalık reddedilir", () => {
    const s = start();
    expect(isRejected(reject(s, "p1", 0, 100))).toBe(false);
    expect(isRejected(reject(s, "p1", 100, 100))).toBe(false);
    for (const bad of [-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "7", null, undefined, 1000]) {
      expect(g.parseAction({ kind: "choose", value: bad })).toBeNull();
    }
    expect(g.parseAction({ kind: "choose", value: 42 })).toEqual({ kind: "choose", value: 42 });
    expect(g.parseAction({ kind: "choose", value: 42, extra: 1 })).toBeNull();
    expect(g.parseAction({ kind: "pick", value: 42 })).toBeNull();
    expect(g.parseAction([])).toBeNull();
    // parseAction'ı atlayan çağrı da reduce'ta reddedilir.
    expect(reject(s, "p1", 101, 100)).toEqual({ rejected: "out_of_range" });
    expect(reject(s, "p1", -1, 100)).toEqual({ rejected: "out_of_range" });
  });

  it("seçim süre bitene kadar değiştirilebilir; son seçim geçerli", () => {
    let s = start(3);
    s = choose(s, "p1", 80, 1_000);
    s = choose(s, "p1", 10, 5_000);
    s = choose(s, "p1", 30, 9_999);
    expect(g.view(s, "p1", ctx(T0 + 9_999))).toEqual({ myChoice: 30, locked: false });
    s = choose(s, "p2", 30);
    s = choose(s, "p3", 30);
    expect(reveal(s).choices).toEqual({ p1: 30, p2: 30, p3: 30 });
  });

  it("süre dolunca (ve sonrasında) seçim reddedilir; sonuç değişmez", () => {
    let s = start(3);
    s = choose(s, "p1", 10);
    expect(reject(s, "p1", 50, ORTALAMA_CHOOSE_MS)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 50, ORTALAMA_CHOOSE_MS + 1)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 50, ORTALAMA_DURATION_MS + 5_000)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 50, ORTALAMA_CHOOSE_MS - 1)).not.toEqual({ rejected: "ended" });
    expect(reveal(s).choices.p1).toBe(10);
  });

  it("katılımcı olmayan oyuncunun eylemi reddedilir", () => {
    expect(reject(start(3), "ghost", 5, 100)).toEqual({ rejected: "not_participant" });
  });

  it("hedef = ortalamanın yarısı (ondalık)", () => {
    const { r } = play([10, 20, 31]);
    expect(r.mean).toBeCloseTo(61 / 3, 10);
    expect(r.target).toBeCloseTo(61 / 6, 10);
    const { r: r2 } = play([100, 100, 100, 100]);
    expect(r2.mean).toBe(100);
    expect(r2.target).toBe(50);
  });

  it("en yakın tek kişi +2, ikinci yakın +1, diğerleri 0", () => {
    // ortalama 40, hedef 20: p1(20)=0, p2(30)=10, p3(60)=40, p4(50)=30
    const { r, res } = play([20, 30, 60, 50]);
    expect(r.target).toBe(20);
    expect(r.order).toEqual(["p1", "p2", "p4", "p3"]);
    expect(res.awards).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    expect(res.miniScores).toEqual(res.awards);
    expect(r.points).toEqual(res.awards);
    expect(r.ranks).toEqual({ p1: 1, p2: 2, p4: 3, p3: 4 });
  });

  it("hedefin altındaki ve üstündeki aynı uzaklık gerçekten eşit sayılır (ondalık hata yok)", () => {
    // 0,10,20 -> ort 10, hedef 5: 0 ve 10 ikisi de 5 uzakta -> en yakınlar eşit
    const { res, r } = play([0, 10, 20]);
    expect(r.target).toBe(5);
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 0 });
    // Sonsuz ondalık hedef (61/6): uzaklık eşitliği tam sayı aritmetiğiyle bulunur.
    const t = play([3, 3, 55]);
    expect(t.res.awards).toEqual({ p1: 1, p2: 1, p3: 0 });
  });

  it("en yakınlar eşitse hepsi +1 ve ikinci ödül verilmez", () => {
    // ort 10, hedef 5: p1=0,p2=10 eşit en yakın; p3=20 uzak; kimse +1 (ikinci) almaz
    const { res } = play([0, 10, 20]);
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 0 });
    // Üçü de eşit: herkes +1
    expect(play([40, 40, 40]).res.awards).toEqual({ p1: 1, p2: 1, p3: 1 });
    // Dört kişi, üçü eşit en yakın, biri uzak
    const four = play([0, 0, 0, 100]);
    expect(four.r.target).toBeCloseTo(12.5);
    expect(four.res.awards).toEqual({ p1: 1, p2: 1, p3: 1, p4: 0 });
  });

  it("ikinci derecede eşitlik: aynı derecedekilerin hepsi +1", () => {
    // hedef 10 (toplam 80, n=4): uzaklıklar 0, 5, 5, 40 -> tek en yakın, ikinci derece eşit
    const { r, res } = play([10, 5, 15, 50]);
    expect(r.target).toBe(10);
    expect(r.ranks).toEqual({ p1: 1, p2: 2, p3: 2, p4: 3 });
    expect(res.awards).toEqual({ p1: 2, p2: 1, p3: 1, p4: 0 });
  });

  it("üçüncü ve sonraki derecelerde eşitlik puanı etkilemez", () => {
    // hedef 10: uzaklıklar 0, 5, 10, 45
    const { res, r } = play([10, 15, 0, 55]);
    expect(r.target).toBe(10);
    expect(res.awards).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
  });

  it("tek ve çift sayıda oyuncuda dengeli: 3 ve 8 oyuncu", () => {
    const three = play([10, 12, 90]);
    expect(Object.keys(three.res.awards).sort()).toEqual(["p1", "p2", "p3"]);
    const eight = play([5, 8, 9, 10, 12, 20, 40, 90]);
    expect(Object.values(eight.res.awards).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(3);
    expect(Object.keys(eight.res.awards)).toHaveLength(8);
  });

  it("göndermeyene sunucu 0–100 arası rastgele tam sayı atar ve sonuçta normal seçim gibi görünür", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = start(5, seed);
      s = choose(s, "p1", 50);
      const r = reveal(s);
      for (const id of ids(5)) {
        const v = r.choices[id];
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(r.choices.p1).toBe(50);
      // Atanan sayı, hedefe uzaklık ve puan hesabına normal seçim gibi girer.
      expect(Object.keys(r.distances).sort()).toEqual(ids(5));
      expect(Object.keys(r.ranks).sort()).toEqual(ids(5));
    }
  });

  it("atama farklı tohumlarla değişir, aynı tohumla aynıdır (belirlilik)", () => {
    const a = reveal(start(6, 7)).choices;
    expect(reveal(start(6, 7)).choices).toEqual(a);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) seen.add(JSON.stringify(reveal(start(6, seed)).choices));
    expect(seen.size).toBeGreaterThan(20);
  });

  it("atama sonuç anına bağlı değildir: tick geç ya da hiç gelmese de aynı sonuç", () => {
    const s = start(4, 9);
    const early = g.publicView(s, ctx(T0 + ORTALAMA_CHOOSE_MS)).reveal;
    const late = g.publicView(
      g.tick(s, ctx(T0 + ORTALAMA_CHOOSE_MS + 3_000)),
      ctx(T0 + ORTALAMA_CHOOSE_MS + 3_000),
    ).reveal;
    expect(late).toEqual(early);
    expect(g.result(s)).toEqual(g.result(g.tick(s, ctx(T0 + ORTALAMA_DURATION_MS))));
  });

  it("hiç kimse göndermezse herkese rastgele sayı atanır ve oyun yine puanlanır", () => {
    const s = start(4, 3);
    const res = g.result(s);
    expect(Object.keys(res.awards).sort()).toEqual(ids(4));
    const total = Object.values(res.awards).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(4);
  });

  it("bağlantısı kopmuş oyuncu da katılımcıdır: göndermediyse sayı atanır, puanlamaya girer", () => {
    let s = g.setup(ids(3), ctx(T0, 5, ["p1", "p2"]));
    s = choose(s, "p1", 20);
    s = choose(s, "p2", 20);
    const r = reveal(s);
    expect(Object.keys(r.choices)).toEqual(ids(3));
    // Bağlı listesi sonucu etkilemez.
    const again = g.tick(s, { now: T0 + ORTALAMA_CHOOSE_MS, rng: createRng(1), connected: [] });
    expect(g.publicView(again, ctx(T0 + ORTALAMA_CHOOSE_MS, 1, [])).reveal).toEqual(r);
  });

  it("tur puanı mini puana yazılır; genel skor yalnız sonda toplamdan çevrilir", () => {
    const { s, r } = play([20, 30, 60, 50]);
    expect(r.points).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    const res = g.result(s);
    // miniScores = 3 turun tur puanları toplamı; awards = toplamın sıralama ödülü.
    const sum = (id: string) => [0, 1, 2].reduce((a, k) => a + (ortalamaSettle(s, k).points[id] ?? 0), 0);
    expect(res.miniScores).toEqual({ p1: sum("p1"), p2: sum("p2"), p3: sum("p3"), p4: sum("p4") });
    expect(res.awards).toEqual(ortalamaAwards(res.miniScores));
  });

  it("tick süre dolunca bir kez durum değiştirir, sonra aynı nesneyi döner", () => {
    const s = start();
    expect(g.tick(s, ctx(T0 + 5_000))).toBe(s);
    const t = g.tick(s, ctx(T0 + ORTALAMA_CHOOSE_MS));
    expect(t).not.toBe(s);
    expect(t.revealed).toBe(1);
    expect(g.tick(t, ctx(T0 + ORTALAMA_CHOOSE_MS + 100))).toBe(t);
  });

  it("aynı değeri tekrar göndermek durumu değiştirmez", () => {
    const s = choose(start(), "p1", 40);
    expect(g.reduce(s, "p1", { kind: "choose", value: 40 }, ctx(T0 + 2_000))).toBe(s);
  });
});

describe("ortalamanin-yarisi gizlilik (yapısal)", () => {
  // Seçimler en çok 3 haneli sayılardır; alt dizgi sızıntı denetimi onları koruyamaz (secrets() boş).
  // Bu yüzden görünümlerin yapısı doğrudan denetlenir.
  const keys = (v: unknown): string[] => {
    if (typeof v !== "object" || v === null) return [];
    return Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]);
  };
  const numbers = (v: unknown): number[] => {
    if (typeof v === "number") return [v];
    if (typeof v !== "object" || v === null) return [];
    return Object.values(v).flatMap(numbers);
  };

  it("secrets() boştur (gerekçe: değerler kısa sayılar)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("süre dolmadan publicView yalnız zaman alanları taşır; seçim, ortalama, hedef, sıra, atanan sayı yok", () => {
    let s = start(5, 11);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 33);
    s = choose(s, "p3", 91);
    for (const at of [0, 1, 5_000, 9_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(Object.keys(pub).sort()).toEqual([
        "endsAt",
        "final",
        "lockedIds",
        "multiplier",
        "previous",
        "reveal",
        "revealEndsAt",
        "round",
        "roundStartedAt",
        "rounds",
        "startedAt",
        "totals",
      ]);
      const flat = JSON.stringify({ ...pub, totals: null });
      for (const id of ids(5)) expect(flat).not.toContain(id);
      for (const k of ["choices", "mean", "target", "order", "fallback", "distances", "points"]) {
        expect(keys(pub)).not.toContain(k);
      }
      // Sayısal alanlar yalnız zaman damgalarıdır.
      expect(pub.previous).toEqual([]);
      expect(Object.values(pub.totals).every((v) => v === 0)).toBe(true);
      expect(pub.final).toBeNull();
      expect(numbers({ ...pub, totals: null, multiplier: null })).toEqual([
        pub.startedAt,
        pub.roundStartedAt,
        pub.endsAt,
        pub.revealEndsAt,
        pub.round,
        pub.rounds,
      ]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; diğerleri ve izleyici başkasınınkini göremez", () => {
    let s = start(5, 12);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 33);
    for (const at of [0, 5_000, 9_999, 10_000, 14_000]) {
      expect(g.view(s, "p1", ctx(T0 + at))).toEqual({ myChoice: 77, locked: false });
      expect(g.view(s, "p2", ctx(T0 + at))).toEqual({ myChoice: 33, locked: false });
      expect(g.view(s, "p3", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, null, ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, "ghost", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
    }
  });

  it("göndermeyenin sunucu atadığı sayı, sonuç açılana kadar hiçbir görünümde yoktur (kendisininkinde bile)", () => {
    const s = start(4, 13);
    for (const p of [...ids(4), null]) {
      const v = g.view(s, p, ctx(T0 + 9_999));
      expect(v).toEqual({ myChoice: null, locked: false });
    }
    expect(JSON.stringify(g.publicView(s, ctx(T0 + 9_999)))).not.toContain("fallback");
  });

  it("süre dolunca seçimler herkese açılır (adil açılış)", () => {
    let s = start(3);
    s = choose(s, "p1", 77);
    const r = g.publicView(s, ctx(T0 + ORTALAMA_CHOOSE_MS)).reveal;
    expect(r?.choices.p1).toBe(77);
  });
});

describe("ortalamanin-yarisi erken bitiş", () => {
  const lock = (state: OrtalamaState, id: string, at: number, connected: readonly string[] = ids(8)) =>
    g.reduce(state, id, { kind: "lock" }, ctx(T0 + at, 1, connected));
  const lockOk = (state: OrtalamaState, id: string, at: number, connected?: readonly string[]) => {
    const r = lock(state, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const chosen = (n = 3): OrtalamaState => {
    let s = start(n);
    for (const [i, id] of ids(n).entries()) s = choose(s, id, 10 * (i + 1));
    return s;
  };

  it("(a) herkes kilitleyince seçim aşaması 1 sn sonra biter, sonuç değişmez", () => {
    const base = chosen();
    let s = base;
    for (const id of ids(3)) s = lockOk(s, id, 4_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + 5_000);
    expect(g.publicView(s, ctx(T0 + 4_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 5_000)).reveal?.target).toBe(10);
    // Oyun 1. tur erken bittiği için 4 sn erken biter (sonraki turlar kayar).
    expect(g.isFinished(s, ctx(T0 + ORTALAMA_DURATION_MS - 5_000 - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ORTALAMA_DURATION_MS - 5_000))).toBe(true);
    expect(g.tick(s, ctx(T0 + 5_000)).revealed).toBe(1);
    expect(g.result(s)).toEqual(g.result(base));
  });

  it("(b) bir kişi eksikken bitmez", () => {
    const s = lockOk(lockOk(chosen(), "p1", 2_000), "p2", 3_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + ORTALAMA_CHOOSE_MS);
    expect(g.publicView(s, ctx(T0 + 9_999)).reveal).toBeNull();
    expect(g.isFinished(s, ctx(T0 + 10_000))).toBe(false);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const online = ["p1", "p2"];
    let s = start(3);
    s = choose(choose(s, "p1", 10), "p2", 20);
    s = lockOk(s, "p1", 2_000, online);
    expect(s.rounds[0]?.endsAt).toBe(T0 + ORTALAMA_CHOOSE_MS);
    s = lockOk(s, "p2", 3_000, online);
    expect(s.rounds[0]?.endsAt).toBe(T0 + 4_000);
  });

  it("(d) kilit sonrası değişiklik ve ikinci kilit reddedilir; seçimsiz kilitlenemez", () => {
    const s = lockOk(chosen(), "p1", 2_000);
    expect(reject(s, "p1", 99, 2_500)).toEqual({ rejected: "locked" });
    expect(reject(s, "p1", 10, 2_500)).toEqual({ rejected: "locked" });
    expect(lock(s, "p1", 2_500)).toEqual({ rejected: "locked" });
    expect(g.view(s, "p1", ctx(T0 + 2_500))).toEqual({ myChoice: 10, locked: true });
    expect(lock(start(3), "p1", 1_000)).toEqual({ rejected: "nothing_to_lock" });
    expect(lock(start(3), "ghost", 1_000)).toEqual({ rejected: "not_participant" });
  });

  it("erken bitişten sonra (1 sn bekleme dahil) eylem reddedilir", () => {
    let s = chosen();
    for (const id of ids(3)) s = lockOk(s, id, 2_000);
    expect(reject(s, "p1", 5, 3_000)).toEqual({ rejected: "ended" });
    expect(lock(s, "p1", 3_000)).toEqual({ rejected: "ended" });
  });

  it("(e) kilit listesi seçimleri sızdırmaz", () => {
    const s = lockOk(chosen(), "p2", 2_000);
    const pub = g.publicView(s, ctx(T0 + 2_500));
    expect(pub.lockedIds).toEqual(["p2"]);
    expect(pub.reveal).toBeNull();
    expect(JSON.stringify(pub)).not.toContain("choices");
    expect(g.view(s, "p1", ctx(T0 + 2_500))).toEqual({ myChoice: 10, locked: false });
    expect(g.view(s, null, ctx(T0 + 2_500))).toEqual({ myChoice: null, locked: false });
  });

  it("parseAction lock yalnız kind ile kabul edilir", () => {
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(g.parseAction({ kind: "lock", value: 3 })).toBeNull();
  });
});

describe("ortalamanin-yarisi O5: 3 tur, değişen çarpan", () => {
  /** 1. tur başlangıcından itibaren turların seçim bitişleri (erken bitiş yokken). */
  const R = [0, 15_000, 30_000];
  const END = (r: number) => (R[r] ?? 0) + ORTALAMA_CHOOSE_MS;
  const vals = (r: number, values: number[]) =>
    values.map((v, i) => [`p${i + 1}`, v, (R[r] ?? 0) + 1_000] as const);
  function playAll(rounds: number[][], seed = 1): OrtalamaState {
    let s = start(rounds[0]?.length ?? 4, seed);
    rounds.forEach((values, r) => {
      for (const [id, v, at] of vals(r, values)) s = choose(s, id, v, at);
    });
    return s;
  }
  const viewAt = (s: OrtalamaState, at: number) => g.publicView(s, ctx(T0 + at));

  it("çarpanlar sırayla ½, ⅔, ¾", () => {
    expect(ORTALAMA_MULTIPLIERS).toEqual([
      { num: 1, den: 2 },
      { num: 2, den: 3 },
      { num: 3, den: 4 },
    ]);
    expect([0, 1, 2].map(ortalamaMultiplier)).toEqual(ORTALAMA_MULTIPLIERS);
    const s = playAll([
      [40, 40, 40, 40],
      [40, 40, 40, 40],
      [40, 40, 40, 40],
    ]);
    expect(viewAt(s, END(0)).reveal?.target).toBe(20);
    expect(viewAt(s, END(1)).reveal?.target).toBeCloseTo(80 / 3, 10);
    expect(viewAt(s, END(2)).reveal?.target).toBe(30);
    expect(viewAt(s, END(0)).multiplier).toEqual({ num: 1, den: 2 });
    expect(viewAt(s, END(1)).multiplier).toEqual({ num: 2, den: 3 });
    expect(viewAt(s, END(2)).multiplier).toEqual({ num: 3, den: 4 });
  });

  it("tur sıralaması: seçim 10 sn, sonuç 5 sn; tur numarası ve sonraki tur zamanında başlar", () => {
    const s = start(4);
    expect(viewAt(s, 0)).toMatchObject({ round: 1, rounds: 3, reveal: null });
    expect(viewAt(s, 9_999)).toMatchObject({ round: 1, reveal: null });
    expect(viewAt(s, 10_000)).toMatchObject({ round: 1 });
    expect(viewAt(s, 10_000).reveal).not.toBeNull();
    expect(viewAt(s, 14_999)).toMatchObject({ round: 1 });
    expect(viewAt(s, 15_000)).toMatchObject({ round: 2, reveal: null, roundStartedAt: T0 + 15_000 });
    expect(viewAt(s, 25_000).reveal).not.toBeNull();
    expect(viewAt(s, 30_000)).toMatchObject({
      round: 3,
      reveal: null,
      endsAt: T0 + 40_000,
      revealEndsAt: T0 + 47_000,
    });
    expect(viewAt(s, 46_999)).toMatchObject({ round: 3 });
    expect(g.isFinished(s, ctx(T0 + 46_999))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 47_000))).toBe(true);
    expect(ORTALAMA_ROUND_REVEAL_MS).toBe(5_000);
  });

  it("her turun seçim penceresi 10 sn (eski 20 sn'nin yarısı, alt sınır 10 sn)", () => {
    const s = start(4);
    expect(s.rounds.map((r) => r.endsAt - r.startAt)).toEqual([10_000, 10_000, 10_000]);
    expect(Math.max(10_000, 20_000 / 2)).toBe(ORTALAMA_CHOOSE_MS);
  });

  it("seçimler turlar arası taşınmaz; her tur boş başlar ve kilit sıfırlanır", () => {
    let s = start(3);
    s = choose(s, "p1", 70, 1_000);
    const lockedSoFar = g.reduce(s, "p1", { kind: "lock" }, ctx(T0 + 2_000));
    if (isRejected(lockedSoFar)) throw new Error("kilit reddedildi");
    expect(g.view(lockedSoFar, "p1", ctx(T0 + 2_000))).toEqual({ myChoice: 70, locked: true });
    expect(g.view(lockedSoFar, "p1", ctx(T0 + 15_000))).toEqual({ myChoice: null, locked: false });
    expect(viewAt(lockedSoFar, 15_000).lockedIds).toEqual([]);
    // 2. turda yeniden seçilebilir.
    const again = choose(lockedSoFar, "p1", 12, 16_000);
    expect(g.view(again, "p1", ctx(T0 + 16_000))).toEqual({ myChoice: 12, locked: false });
    expect(viewAt(again, 25_000).reveal?.choices.p1).toBe(12);
    expect(viewAt(again, 10_000).reveal?.choices.p1).toBe(70);
  });

  it("sonuç gösterilirken (turlar arası) seçim reddedilir", () => {
    const s = start(3);
    expect(reject(s, "p1", 5, 10_000)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 5, 14_999)).toEqual({ rejected: "ended" });
    expect(isRejected(reject(s, "p1", 5, 15_000))).toBe(false);
    expect(reject(s, "p1", 5, 25_000)).toEqual({ rejected: "ended" });
    expect(isRejected(reject(s, "p1", 5, 30_000))).toBe(false);
    expect(reject(s, "p1", 5, 40_000)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 5, 47_000)).toEqual({ rejected: "ended" });
  });

  it("2. turdan itibaren önceki turun ortalaması ve hedefi görünür; 1. turda yok", () => {
    const s = playAll([
      [10, 20, 30, 40],
      [50, 50, 50, 50],
      [0, 0, 0, 0],
    ]);
    expect(viewAt(s, 5_000).previous).toEqual([]);
    expect(viewAt(s, 12_000).previous).toEqual([]);
    const p2 = viewAt(s, 16_000);
    expect(p2.round).toBe(2);
    expect(p2.reveal).toBeNull();
    expect(p2.previous).toEqual([{ mean: 25, target: 12.5, multiplier: { num: 1, den: 2 } }]);
    const p3 = viewAt(s, 31_000);
    expect(p3.previous).toHaveLength(2);
    expect(p3.previous[1]).toMatchObject({ mean: 50 });
    expect(p3.previous[1]?.target).toBeCloseTo(100 / 3, 10);
    expect(p3.previous[1]?.multiplier).toEqual({ num: 2, den: 3 });
    // Önceki tur özeti seçimleri/oyuncuları taşımaz.
    expect(Object.keys(p2.previous[0] ?? {}).sort()).toEqual(["mean", "multiplier", "target"]);
  });

  it("tur sonuçları yalnız kendi turunun seçimlerinden hesaplanır (tur başına yakınlık puanı)", () => {
    const s = playAll([
      [20, 30, 60, 50], // ort 40, hedef 20 → p1 +2, p2 +1
      [90, 10, 50, 30], // ort 45, hedef 30 → p4 +2, p3 (20) / p2 (20) eşit ikinci
      [80, 40, 40, 60], // ort 55, hedef 41,25 → p2,p3 (1,25) eşit en yakın → +1 +1
    ]);
    expect(viewAt(s, END(0)).reveal?.points).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    const r2 = viewAt(s, END(1)).reveal;
    expect(r2?.target).toBe(30);
    expect(r2?.points).toEqual({ p1: 0, p2: 1, p3: 1, p4: 2 });
    const r3 = viewAt(s, END(2)).reveal;
    expect(r3?.target).toBe(41.25);
    expect(r3?.points).toEqual({ p1: 0, p2: 1, p3: 1, p4: 0 });
  });

  it("mini puanlar turlar boyunca birikir; genel skor yalnız sonda bir kez", () => {
    const s = playAll([
      [20, 30, 60, 50],
      [90, 10, 50, 30],
      [80, 40, 40, 60],
    ]);
    // p1: 2+0+0 = 2, p2: 1+1+1 = 3, p3: 0+1+1 = 2, p4: 0+2+0 = 2
    expect(viewAt(s, END(0)).totals).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    expect(viewAt(s, 16_000).totals).toEqual({ p1: 2, p2: 1, p3: 0, p4: 0 });
    expect(viewAt(s, END(1)).totals).toEqual({ p1: 2, p2: 2, p3: 1, p4: 2 });
    expect(viewAt(s, END(2)).totals).toEqual({ p1: 2, p2: 3, p3: 2, p4: 2 });
    // Genel skor yalnız son turun sonucunda görünür.
    expect(viewAt(s, END(0)).final).toBeNull();
    expect(viewAt(s, END(1)).final).toBeNull();
    expect(viewAt(s, END(2)).final).toEqual({ p1: 1, p2: 2, p3: 1, p4: 1 });
    const res = g.result(s);
    expect(res.miniScores).toEqual({ p1: 2, p2: 3, p3: 2, p4: 2 });
    expect(res.awards).toEqual({ p1: 1, p2: 2, p3: 1, p4: 1 });
  });

  it("dönüşüm: en yüksek toplam +2, ikinci +1, diğerleri 0", () => {
    expect(ortalamaAwards({ a: 5, b: 3, c: 1 })).toEqual({ a: 2, b: 1, c: 0 });
  });
  it("dönüşüm: ikincilik eşitse eşit olanların hepsi +1", () => {
    expect(ortalamaAwards({ a: 5, b: 3, c: 3, d: 0 })).toEqual({ a: 2, b: 1, c: 1, d: 0 });
  });
  it("dönüşüm: lider eşitse liderlerin hepsi +1, +2 yok, diğerleri 0", () => {
    expect(ortalamaAwards({ a: 5, b: 5, c: 3 })).toEqual({ a: 1, b: 1, c: 0 });
    expect(ortalamaAwards({ a: 4, b: 4, c: 4 })).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("şişme yok: 3 tur boyunca bile genel skor dağılımı tek turluk oyunla aynı (en çok +2 ve +1'ler)", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = start(5, seed);
      const total = Object.values(g.result(s).awards);
      expect(Math.max(...total)).toBeLessThanOrEqual(2);
      expect(total.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(5);
    }
  });

  it("göndermeyen her tur için ayrı rastgele sayı alır (turlar arası farklı), tur içinde sabit", () => {
    let differs = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = start(4, seed);
      for (const round of s.rounds) {
        for (const v of Object.values(round.fallback)) {
          expect(Number.isInteger(v) && v >= 0 && v <= 100).toBe(true);
        }
      }
      if (JSON.stringify(s.rounds[0]?.fallback) !== JSON.stringify(s.rounds[1]?.fallback)) differs++;
      const first = viewAt(s, END(0)).reveal?.choices;
      const second = viewAt(s, END(1)).reveal?.choices;
      expect(Object.keys(first ?? {})).toEqual(ids(4));
      expect(Object.keys(second ?? {})).toEqual(ids(4));
    }
    expect(differs).toBeGreaterThan(15);
  });

  it("erken bitiş her tur için ayrı: 1. tur erken biterse sonraki turlar öne çekilir", () => {
    const online = ids(3);
    let s = start(3);
    for (const [i, id] of ids(3).entries()) s = choose(s, id, 10 * (i + 1), 1_000);
    for (const id of ids(3)) {
      const r = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 3_000, 1, online));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    // 1. tur 3 sn + 1 sn bekleme = 4 sn'de biter; sonuç 5 sn → 2. tur 9. sn'de başlar (6 sn öne).
    expect(s.rounds.map((r) => [r.startAt - T0, r.endsAt - T0, r.revealEndsAt - T0])).toEqual([
      [0, 4_000, 9_000],
      [9_000, 19_000, 24_000],
      [24_000, 34_000, 41_000],
    ]);
    expect(viewAt(s, 8_999)).toMatchObject({ round: 1 });
    expect(viewAt(s, 9_000)).toMatchObject({ round: 2, reveal: null });
    // 2. turda herkes kilitlerse yalnız kendi turu kısalır.
    for (const [i, id] of ids(3).entries()) {
      const r = g.reduce(s, id, { kind: "choose", value: 20 + i }, ctx(T0 + 10_000));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    for (const id of ids(3)) {
      const r = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 11_000, 1, online));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    expect(s.rounds[1]?.endsAt).toBe(T0 + 12_000);
    expect(s.rounds[2]?.startAt).toBe(T0 + 17_000);
    expect(s.rounds[2]?.revealEndsAt).toBe(T0 + 34_000);
    expect(g.isFinished(s, ctx(T0 + 33_999))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 34_000))).toBe(true);
  });

  it("bağlantısı kopanı beklemez: bağlı olanlar kilitleyince tur erken biter (yalnız reduce bağlı listesine bakar)", () => {
    const online = ["p1", "p2"];
    let s = start(3);
    s = choose(choose(s, "p1", 10, 1_000), "p2", 20, 1_000);
    for (const id of online) {
      const r = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 2_000, 1, online));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    expect(s.rounds[0]?.endsAt).toBe(T0 + 3_000);
  });

  it("belirlilik: aynı tohum ve eylemler aynı sonucu ve görünümü verir; tick sıklığı etkilemez", () => {
    const run = (seed: number, tickStep: number) => {
      let s = start(5, seed);
      const rng = createRng(seed + 100);
      for (let t = 0; t <= ORTALAMA_DURATION_MS; t += 250) {
        if (rng.int(3) === 0) {
          const id = `p${1 + rng.int(5)}`;
          const r = g.reduce(s, id, { kind: "choose", value: rng.int(101) }, ctx(T0 + t, seed));
          if (!isRejected(r)) s = r;
        }
        if (tickStep > 0) s = g.tick(s, ctx(T0 + t, seed));
      }
      return {
        result: g.result(s),
        views: [5_000, 12_000, 20_000, 33_000, 44_000].map((at) => viewAt(s, at)),
      };
    };
    for (const seed of [1, 2, 3, 99]) {
      expect(run(seed, 250)).toEqual(run(seed, 250));
      expect(run(seed, 250).result).toEqual(run(seed, 0).result);
    }
    expect(JSON.stringify(run(1, 250).result)).not.toEqual(JSON.stringify(run(2, 250).result));
  });

  it("gizlilik: gelecek turların rastgele sayıları ve henüz açılmamış turun seçimleri görünümde yok", () => {
    let s = start(4, 21);
    s = choose(s, "p1", 77, 16_000);
    for (const at of [0, 9_999, 15_000, 16_500, 24_999, 30_000, 39_999]) {
      const pub = JSON.stringify(viewAt(s, at));
      expect(pub).not.toContain("fallback");
      expect(pub).not.toContain("choices");
      expect(g.view(s, "p2", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
    }
  });
});
