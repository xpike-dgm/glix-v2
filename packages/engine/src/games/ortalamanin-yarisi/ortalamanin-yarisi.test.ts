import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { ortalamaninYarisi as g, type OrtalamaState } from "./index.js";
import { ORTALAMA_CHOOSE_MS, ORTALAMA_DURATION_MS, ORTALAMA_REVEAL_MS } from "./types.js";

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
/** Herkes seçer; sonuç döner. */
function play(values: number[]) {
  let s = start(values.length);
  values.forEach((v, i) => {
    s = choose(s, `p${i + 1}`, v);
  });
  return { s, r: reveal(s), res: g.result(s) };
}

describe("ortalamanin-yarisi kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("tek aşama: seçim 20 sn, ardından sonuç gösterimi, sonra biter", () => {
    const s = start();
    expect(ORTALAMA_CHOOSE_MS).toBe(20_000);
    expect(s.endsAt - s.startedAt).toBe(20_000);
    expect(ORTALAMA_REVEAL_MS).toBeLessThanOrEqual(7_000);
    expect(g.isFinished(s, ctx(T0 + 20_000))).toBe(false);
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
    s = choose(s, "p1", 30, 19_999);
    expect(g.view(s, "p1", ctx(T0 + 19_999))).toEqual({ myChoice: 30 });
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

  it("puanlar doğrudan genel skora gider (awards = miniScores)", () => {
    const { res } = play([20, 30, 60, 50]);
    expect(res.awards).toEqual(res.miniScores);
  });

  it("tick süre dolunca bir kez durum değiştirir, sonra aynı nesneyi döner", () => {
    const s = start();
    expect(g.tick(s, ctx(T0 + 5_000))).toBe(s);
    const t = g.tick(s, ctx(T0 + ORTALAMA_CHOOSE_MS));
    expect(t).not.toBe(s);
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
    for (const at of [0, 1, 10_000, 19_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(Object.keys(pub).sort()).toEqual(["endsAt", "reveal", "revealEndsAt", "startedAt"]);
      const flat = JSON.stringify(pub);
      for (const id of ids(5)) expect(flat).not.toContain(id);
      for (const k of ["choices", "mean", "target", "order", "fallback", "distances", "points"]) {
        expect(keys(pub)).not.toContain(k);
      }
      // Sayısal alanlar yalnız zaman damgalarıdır.
      expect(numbers(pub)).toEqual([pub.startedAt, pub.endsAt, pub.revealEndsAt]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; diğerleri ve izleyici başkasınınkini göremez", () => {
    let s = start(5, 12);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 33);
    for (const at of [0, 5_000, 19_999, 20_000, 24_000]) {
      expect(g.view(s, "p1", ctx(T0 + at))).toEqual({ myChoice: 77 });
      expect(g.view(s, "p2", ctx(T0 + at))).toEqual({ myChoice: 33 });
      expect(g.view(s, "p3", ctx(T0 + at))).toEqual({ myChoice: null });
      expect(g.view(s, null, ctx(T0 + at))).toEqual({ myChoice: null });
      expect(g.view(s, "ghost", ctx(T0 + at))).toEqual({ myChoice: null });
    }
  });

  it("göndermeyenin sunucu atadığı sayı, sonuç açılana kadar hiçbir görünümde yoktur (kendisininkinde bile)", () => {
    const s = start(4, 13);
    for (const p of [...ids(4), null]) {
      const v = g.view(s, p, ctx(T0 + 19_999));
      expect(v).toEqual({ myChoice: null });
    }
    expect(JSON.stringify(g.publicView(s, ctx(T0 + 19_999)))).not.toContain("fallback");
  });

  it("süre dolunca seçimler herkese açılır (adil açılış)", () => {
    let s = start(3);
    s = choose(s, "p1", 77);
    const r = g.publicView(s, ctx(T0 + ORTALAMA_CHOOSE_MS)).reveal;
    expect(r?.choices.p1).toBe(77);
  });
});
