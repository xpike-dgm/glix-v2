import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type AcgozlulukState, acgozlulukLimiti as g } from "./index.js";
import { ACGOZLULUK_CHOOSE_MS, ACGOZLULUK_DURATION_MS, ACGOZLULUK_LIMITS, acgozlulukLimit } from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });
const start = (n = 4): AcgozlulukState => g.setup(ids(n), ctx(T0));

function choose(state: AcgozlulukState, id: string, value: number, at = 1_000): AcgozlulukState {
  const r = g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reject = (state: AcgozlulukState, id: string, value: number, at: number) =>
  g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
const finalResult = (s: AcgozlulukState) => g.result(s);

describe("acgozluluk-limiti kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("tek aşama: seçim 20 sn, sonuç gösterimi sonrası biter", () => {
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(20_000);
    expect(ACGOZLULUK_CHOOSE_MS).toBe(20_000);
    expect(g.isFinished(s, ctx(T0 + 20_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ACGOZLULUK_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ACGOZLULUK_DURATION_MS))).toBe(true);
  });

  it("limit sabit tablodan gelir: 3→6, 4→11, 5→17, 6→24, 7→33, 8→43", () => {
    expect(ACGOZLULUK_LIMITS).toEqual({ 3: 6, 4: 11, 5: 17, 6: 24, 7: 33, 8: 43 });
    for (const [n, limit] of Object.entries(ACGOZLULUK_LIMITS)) {
      const s = g.setup(ids(Number(n)), ctx(T0));
      expect(s.limit).toBe(limit);
      expect(g.publicView(s, ctx(T0)).limit).toBe(limit);
      expect(acgozlulukLimit(Number(n))).toBe(limit);
    }
  });

  it("limit herkes için aynıdır ve maç içinde değişmez (seçimler ve zaman etkilemez)", () => {
    let s = start(5);
    const before = g.publicView(s, ctx(T0)).limit;
    s = choose(s, "p1", 5);
    expect(g.publicView(s, ctx(T0 + 10_000)).limit).toBe(before);
    expect(g.publicView(s, ctx(T0 + 21_000)).limit).toBe(before);
    for (const p of [...ids(5), null]) expect(JSON.stringify(g.view(s, p, ctx(T0)))).not.toContain("limit");
  });

  it("oyuncu sayısı kurulum anındaki katılımcı sayısıdır: seçim aralığı 0..N", () => {
    for (const n of [3, 5, 8]) {
      const s = g.setup(ids(n), ctx(T0));
      expect(g.publicView(s, ctx(T0)).maxChoice).toBe(n);
      expect(isRejected(reject(s, "p1", n, 100))).toBe(false);
      expect(reject(s, "p1", n + 1, 100)).toEqual({ rejected: "out_of_range" });
    }
    expect(isRejected(reject(start(4), "p1", 0, 100))).toBe(false);
  });

  it("parseAction yalnız tamsayı, 0 ve üzeri, kind+value", () => {
    expect(g.parseAction({ kind: "choose", value: 3 })).toEqual({ kind: "choose", value: 3 });
    expect(g.parseAction({ kind: "choose", value: 0 })).toEqual({ kind: "choose", value: 0 });
    for (const bad of [
      { kind: "choose", value: -1 },
      { kind: "choose", value: 1.5 },
      { kind: "choose", value: "3" },
      { kind: "choose", value: Number.NaN },
      { kind: "choose", value: Number.POSITIVE_INFINITY },
      { kind: "choose", value: 1000 },
      { kind: "choose" },
      { kind: "choose", value: 2, extra: 1 },
      { kind: "pick", value: 2 },
      { value: 2 },
      [],
      null,
      "3",
    ]) {
      expect(g.parseAction(bad)).toBeNull();
    }
  });

  it("seçim süre bitene kadar değiştirilebilir, son seçim geçerlidir", () => {
    let s = start(4);
    s = choose(s, "p1", 4, 1_000);
    s = choose(s, "p1", 1, 5_000);
    s = choose(s, "p1", 2, 19_999);
    expect(g.view(s, "p1", ctx(T0 + 19_999)).myChoice).toBe(2);
    expect(finalResult(s).miniScores.p1).toBe(2);
  });

  it("aynı seçimi tekrar göndermek durumu değiştirmez", () => {
    const s = choose(start(), "p1", 2);
    expect(g.reduce(s, "p1", { kind: "choose", value: 2 }, ctx(T0 + 2_000))).toBe(s);
  });

  it("süre dolunca (20. sn dahil) seçim ve değişiklik reddedilir; bitişten sonra da", () => {
    const s = choose(start(), "p1", 2);
    expect(reject(s, "p1", 3, 20_000)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 3, 20_001)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 3, ACGOZLULUK_DURATION_MS + 10)).toEqual({ rejected: "ended" });
    expect(reject(s, "p1", 3, -1)).toEqual({ rejected: "not_started" });
  });

  it("katılımcı olmayan seçim yapamaz", () => {
    const s = start();
    for (const who of ["ghost", "", "__proto__", "p9"]) {
      expect(reject(s, who, 1, 100)).toEqual({ rejected: "not_participant" });
    }
  });

  it("toplam limitin altında: herkes seçtiği kadar puan alır, awards = miniScores", () => {
    let s = start(4); // limit 11
    s = choose(s, "p1", 3);
    s = choose(s, "p2", 2);
    s = choose(s, "p3", 4);
    s = choose(s, "p4", 1);
    const r = finalResult(s);
    expect(r.miniScores).toEqual({ p1: 3, p2: 2, p3: 4, p4: 1 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("toplam tam limite eşitse aşılmış sayılmaz (≤ limit)", () => {
    let s = start(3); // limit 6
    for (const id of ["p1", "p2", "p3"]) s = choose(s, id, 2);
    expect(finalResult(s).miniScores).toEqual({ p1: 2, p2: 2, p3: 2 });
    const reveal = g.publicView(s, ctx(T0 + 20_000)).reveal;
    expect(reveal).toMatchObject({ total: 6, over: false });
  });

  it("limit bir fazla aşılırsa herkes 0 alır (en yüksek seçenlere özel ceza yok)", () => {
    let s = start(3); // limit 6
    s = choose(s, "p1", 3);
    s = choose(s, "p2", 2);
    s = choose(s, "p3", 2); // toplam 7
    const r = finalResult(s);
    expect(r.miniScores).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(r.awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(g.publicView(s, ctx(T0 + 20_000)).reveal).toMatchObject({ total: 7, over: true });
  });

  it("herkes üst sınırı seçerse taşar: 3 kişi × 3 = 9 > 6", () => {
    let s = start(3);
    for (const id of ids(3)) s = choose(s, id, 3);
    expect(finalResult(s).awards).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("seçim göndermeyen oyuncu 0 sayılır; diğerleri etkilenmez", () => {
    let s = start(3);
    s = choose(s, "p1", 3);
    s = choose(s, "p2", 3);
    const r = finalResult(s);
    expect(r.miniScores).toEqual({ p1: 3, p2: 3, p3: 0 });
    expect(g.publicView(s, ctx(T0 + 20_000)).reveal?.choices.p3).toBe(0);
  });

  it("kimse seçmezse herkes 0 ve taşma yok", () => {
    const s = start(5);
    expect(finalResult(s).miniScores).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 });
    expect(g.publicView(s, ctx(T0 + 20_000)).reveal).toMatchObject({ total: 0, over: false });
  });

  it("bağlantısı kopmuş oyuncunun önceki seçimi geçerli kalır; kopukken seçim yapılabilir/yapılmayabilir", () => {
    let s = start(4);
    s = choose(s, "p2", 3);
    // p2 koptu: yalnız p1 ve p3 bağlı; seçim, bağlı listesine bakılmadan işlenir ve sonuç tick'ten bağımsızdır
    const connected = ["p1", "p3"];
    const r = g.reduce(s, "p1", { kind: "choose", value: 2 }, ctx(T0 + 3_000, connected));
    expect(isRejected(r)).toBe(false);
    if (isRejected(r)) return;
    const done = g.tick(r, ctx(T0 + 25_000, connected));
    expect(g.result(done).miniScores).toEqual({ p1: 2, p2: 3, p3: 0, p4: 0 });
    expect(g.publicView(done, ctx(T0 + 25_000, connected))).toEqual(
      g.publicView(done, ctx(T0 + 25_000, ids(4))),
    );
  });

  it("tick süre dolana kadar durumu değiştirmez; dolunca bir kez 'açıldı' işaretler (yayın sinyali)", () => {
    const s = choose(start(), "p1", 1);
    expect(g.tick(s, ctx(T0 + 5_000))).toBe(s);
    expect(g.tick(s, ctx(T0 + 19_999))).toBe(s);
    const opened = g.tick(s, ctx(T0 + 20_000));
    expect(opened).not.toBe(s);
    expect(opened.revealed).toBe(true);
    expect(g.tick(opened, ctx(T0 + 21_000))).toBe(opened);
    // connected listesine bakmaz
    expect(g.tick(s, ctx(T0 + 20_000, []))).toEqual(opened);
    // görünüm bayraktan değil zamandan türer: tick'lenmemiş durum da süre dolunca açar
    expect(g.publicView(s, ctx(T0 + 20_000))).toEqual(g.publicView(opened, ctx(T0 + 20_000)));
  });

  it("sonuç, bitiş tick'inden önce de aynı hesaplanır (idempotent)", () => {
    const s = choose(start(), "p1", 1);
    expect(g.result(s)).toEqual(g.result(g.tick(s, ctx(T0 + 99_999))));
  });

  it("süre dolunca tüm seçimler aynı anda publicView'da açılır", () => {
    let s = start(3);
    s = choose(s, "p1", 1);
    s = choose(s, "p2", 2);
    expect(g.publicView(s, ctx(T0 + 19_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 20_000)).reveal).toEqual({
      choices: { p1: 1, p2: 2, p3: 0 },
      total: 3,
      over: false,
    });
  });
});

describe("acgozluluk-limiti gizlilik (yapısal)", () => {
  // Seçimler tek haneli sayılardır; alt dizgi sızıntı denetimi onları koruyamaz (secrets() boş).
  // Bu yüzden görünümlerin yapısı doğrudan denetlenir.
  const values = (v: unknown): unknown[] => {
    if (typeof v !== "object" || v === null) return [v];
    return Object.values(v).flatMap(values);
  };
  const keys = (v: unknown): string[] => {
    if (typeof v !== "object" || v === null) return [];
    return Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]);
  };

  it("secrets() boştur (gerekçe: değerler kısa sayılar)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("süre dolmadan publicView seçim, toplam ya da oyuncu başına bilgi taşımaz", () => {
    let s = start(5);
    s = choose(s, "p1", 5);
    s = choose(s, "p2", 4);
    s = choose(s, "p3", 3);
    for (const at of [0, 1, 10_000, 19_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(Object.keys(pub).sort()).toEqual(
        ["endsAt", "limit", "maxChoice", "reveal", "revealEndsAt", "startedAt"].sort(),
      );
      const flat = JSON.stringify(pub);
      for (const id of ids(5)) expect(flat).not.toContain(id);
      expect(keys(pub)).not.toContain("choices");
      expect(keys(pub)).not.toContain("total");
      // Tüm sayısal alanlar süre/limit/üst sınır; seçim değerleri (5,4,3) ya da toplam (12) farklı bir alandan gelmez.
      expect(values(pub).filter((x) => x === 12)).toEqual([]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; diğerleri ve izleyici başkasının seçimini göremez", () => {
    let s = start(5);
    s = choose(s, "p1", 5);
    s = choose(s, "p2", 4);
    expect(g.view(s, "p1", ctx(T0 + 5_000))).toEqual({ myChoice: 5 });
    expect(g.view(s, "p2", ctx(T0 + 5_000))).toEqual({ myChoice: 4 });
    expect(g.view(s, "p3", ctx(T0 + 5_000))).toEqual({ myChoice: null });
    expect(g.view(s, null, ctx(T0 + 5_000))).toEqual({ myChoice: null });
    expect(g.view(s, "ghost", ctx(T0 + 5_000))).toEqual({ myChoice: null });
  });

  it("bir oyuncunun seçimini değiştirmek başkasının görünümünü değiştirmez", () => {
    const a = choose(start(5), "p1", 1);
    const b = choose(a, "p1", 5);
    for (const viewer of ["p2", "p3", null]) {
      expect(g.view(a, viewer, ctx(T0 + 5_000))).toEqual(g.view(b, viewer, ctx(T0 + 5_000)));
    }
    expect(g.publicView(a, ctx(T0 + 5_000))).toEqual(g.publicView(b, ctx(T0 + 5_000)));
  });

  it("açılıştan sonra seçimler yalnız publicView'dadır; view hâlâ yalnız kendi seçimidir", () => {
    const s = choose(choose(start(3), "p1", 1), "p2", 2);
    const at = ctx(T0 + 21_000);
    expect(g.publicView(s, at).reveal?.choices).toEqual({ p1: 1, p2: 2, p3: 0 });
    expect(g.view(s, "p3", at)).toEqual({ myChoice: null });
  });
});
