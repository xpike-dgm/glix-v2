import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type CizgiState, cizgiyiGecme as g } from "./index.js";
import { CIZGI_CHOOSE_MS, CIZGI_DURATION_MS, CIZGI_REVEAL_MS, cizgiZone } from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, connected: readonly string[] = ids(8)) => ({ now, rng: createRng(1), connected });
const start = (n = 4): CizgiState => g.setup(ids(n), ctx(T0));

function choose(state: CizgiState, id: string, value: number, at = 1_000): CizgiState {
  const r = g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reject = (state: CizgiState, id: string, value: number, at: number) =>
  g.reduce(state, id, { kind: "choose", value }, ctx(T0 + at));
const reveal = (s: CizgiState) => {
  const r = g.publicView(s, ctx(T0 + CIZGI_CHOOSE_MS)).reveal;
  if (!r) throw new Error("sonuç açılmadı");
  return r;
};
/** `values[i]` null ise oyuncu seçmez. */
function play(values: (number | null)[]) {
  let s = start(values.length);
  values.forEach((v, i) => {
    if (v !== null) s = choose(s, `p${i + 1}`, v);
  });
  return { s, r: reveal(s), res: g.result(s) };
}

describe("cizgiyi-gecme kuralları", () => {
  it("katılım 2–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([2, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("tek aşama: seçim 30 sn, ardından sonuç gösterimi, sonra biter", () => {
    const s = start();
    expect(CIZGI_CHOOSE_MS).toBe(30_000);
    expect(s.endsAt - s.startedAt).toBe(30_000);
    expect(CIZGI_REVEAL_MS).toBeLessThanOrEqual(7_000);
    expect(g.isFinished(s, ctx(T0 + 30_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + CIZGI_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + CIZGI_DURATION_MS))).toBe(true);
  });

  it("sayı 0–100 tam sayı: sınırlar kabul, dışı ve ondalık reddedilir", () => {
    const s = start();
    expect(isRejected(reject(s, "p1", 0, 100))).toBe(false);
    expect(isRejected(reject(s, "p1", 100, 100))).toBe(false);
    for (const bad of [-1, 101, 99.5, Number.NaN, Number.POSITIVE_INFINITY, "7", null, undefined]) {
      expect(g.parseAction({ kind: "choose", value: bad })).toBeNull();
    }
    expect(g.parseAction({ kind: "choose", value: 42 })).toEqual({ kind: "choose", value: 42 });
    expect(g.parseAction({ kind: "choose", value: 42, extra: 1 })).toBeNull();
    expect(g.parseAction({ kind: "pick", value: 42 })).toBeNull();
    expect(reject(s, "p1", 101, 100)).toEqual({ rejected: "out_of_range" });
    expect(reject(s, "p1", -1, 100)).toEqual({ rejected: "out_of_range" });
  });

  it("bölgeler 0–9, 10–19 … 90–99 ve tek elemanlı 100", () => {
    expect([0, 9, 10, 19, 20, 89, 90, 99, 100].map(cizgiZone)).toEqual([0, 0, 1, 1, 2, 8, 9, 9, 10]);
    // 99 ve 100 farklı bölge: ikisi de tek kalır.
    const { r } = play([99, 100]);
    expect(r.status).toEqual({ p1: "second", p2: "first" });
    // 90 ve 99 aynı bölge.
    expect(play([90, 99]).r.status).toEqual({ p1: "crashed", p2: "crashed" });
    // 9 ve 10 farklı bölge.
    expect(play([9, 10]).res.awards).toEqual({ p1: 1, p2: 2 });
  });

  it("tek kalanlar arasında en yüksek +2, ikinci yüksek +1, diğerleri 0", () => {
    const { res, r } = play([15, 95, 47, 72]);
    expect(res.awards).toEqual({ p1: 0, p2: 2, p3: 0, p4: 1 });
    expect(r.status).toEqual({ p1: "safe", p2: "first", p3: "safe", p4: "second" });
    expect(res.miniScores).toEqual(res.awards);
    expect(r.points).toEqual(res.awards);
  });

  it("aynı bölgedekilerin hiçbiri puan almaz; ceza yoktur (hepsi 0, negatif yok)", () => {
    // p1 ve p2 aynı bölgede en yüksekte: ikisi de pasif; ikinci/üçüncü tek kalanlar yükselir.
    const { res, r } = play([95, 91, 60, 30]);
    expect(r.status).toEqual({ p1: "crashed", p2: "crashed", p3: "first", p4: "second" });
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 2, p4: 1 });
    for (const v of Object.values(res.awards)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("aynı sayıyı seçenler de aynı bölgededir: pasif", () => {
    const { res } = play([77, 77, 12]);
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 2 });
  });

  it("üç ve daha fazla kişi tek bölgede: hepsi pasif", () => {
    const { res, r } = play([31, 32, 39, 80]);
    expect(r.status).toEqual({ p1: "crashed", p2: "crashed", p3: "crashed", p4: "first" });
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 2 });
  });

  it("kimse tek kalmazsa kimse puan almaz", () => {
    expect(play([50, 55, 80, 85]).res.awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
  });

  it("yalnız bir kişi tek kalırsa +2 alır, ikinci ödül yok", () => {
    const { res } = play([50, 55, 80]);
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 2 });
  });

  it("2 oyuncu farklı bölgelerde: yüksek +2, düşük +1", () => {
    expect(play([10, 70]).res.awards).toEqual({ p1: 1, p2: 2 });
  });

  it("seçmeyen pasiftir: bölge değerlendirmesine girmez ve puan almaz", () => {
    const { res, r } = play([null, 40, null, 10]);
    expect(r.status).toEqual({ p1: "none", p2: "first", p3: "none", p4: "second" });
    expect(r.choices).toEqual({ p1: null, p2: 40, p3: null, p4: 10 });
    expect(res.awards).toEqual({ p1: 0, p2: 2, p3: 0, p4: 1 });
    // İki seçmeyen aynı "bölge"de sayılmaz (çarpışma yok): hiç seçim yok -> hepsi 0.
    expect(play([null, null, null]).res.awards).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("seçmeyen oyuncu 0 seçmiş gibi sayılmaz: 0–9 bölgesindeki tek seçici tek kalır", () => {
    const { r } = play([null, null, 5]);
    expect(r.status.p3).toBe("first");
    // Seçmeyen sonuçta null görünür, 0 değil.
    expect(r.choices.p1).toBeNull();
  });

  it("seçim süre bitene kadar değiştirilebilir; son seçim geçerli (çarpışmadan kaçmak için)", () => {
    let s = start(3);
    s = choose(s, "p1", 55, 1_000);
    s = choose(s, "p2", 58, 2_000);
    s = choose(s, "p2", 80, 29_999);
    expect(g.view(s, "p2", ctx(T0 + 29_999))).toEqual({ myChoice: 80, locked: false });
    expect(reveal(s).status).toMatchObject({ p1: "second", p2: "first" });
  });

  it("süre dolunca (ve sonrasında) seçim reddedilir: geç seçim yapılmamış sayılır", () => {
    let s = start(3);
    s = choose(s, "p1", 10);
    expect(reject(s, "p2", 50, CIZGI_CHOOSE_MS)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 50, CIZGI_CHOOSE_MS + 1)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 50, CIZGI_DURATION_MS + 1_000)).toEqual({ rejected: "ended" });
    expect(isRejected(reject(s, "p2", 50, CIZGI_CHOOSE_MS - 1))).toBe(false);
    expect(reveal(s).status.p2).toBe("none");
  });

  it("katılımcı olmayanın eylemi reddedilir", () => {
    expect(reject(start(3), "ghost", 5, 100)).toEqual({ rejected: "not_participant" });
  });

  it("bağlantısı kopmuş oyuncunun son seçimi geçerlidir; bağlı listesi sonucu etkilemez", () => {
    let s = g.setup(ids(3), ctx(T0, ["p1"]));
    s = choose(s, "p2", 88);
    const a = g.publicView(s, ctx(T0 + CIZGI_CHOOSE_MS, ["p1"])).reveal;
    const b = g.publicView(
      g.tick(s, { now: T0 + CIZGI_CHOOSE_MS, rng: createRng(1), connected: [] }),
      ctx(T0 + CIZGI_CHOOSE_MS, []),
    ).reveal;
    expect(a).toEqual(b);
    expect(a?.status.p2).toBe("first");
    expect(a?.status.p1).toBe("none");
  });

  it("puanlar doğrudan genel skora gider (awards = miniScores)", () => {
    const { res } = play([15, 95, 47, 72]);
    expect(res.awards).toEqual(res.miniScores);
  });

  it("tick süre dolunca bir kez durum değiştirir, sonra aynı nesneyi döner", () => {
    const s = start();
    expect(g.tick(s, ctx(T0 + 5_000))).toBe(s);
    const t = g.tick(s, ctx(T0 + CIZGI_CHOOSE_MS));
    expect(t).not.toBe(s);
    expect(g.tick(t, ctx(T0 + CIZGI_CHOOSE_MS + 100))).toBe(t);
  });

  it("aynı değeri tekrar göndermek durumu değiştirmez", () => {
    const s = choose(start(), "p1", 40);
    expect(g.reduce(s, "p1", { kind: "choose", value: 40 }, ctx(T0 + 2_000))).toBe(s);
  });
});

describe("cizgiyi-gecme gizlilik (yapısal)", () => {
  // Seçimler en çok 3 haneli sayılardır; alt dizgi sızıntı denetimi onları koruyamaz (secrets() boş).
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

  it("süre dolmadan publicView yalnız zaman alanları taşır; seçim, bölge, durum yok", () => {
    let s = start(5);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 33);
    s = choose(s, "p3", 91);
    for (const at of [0, 1, 15_000, 29_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(Object.keys(pub).sort()).toEqual(["endsAt", "lockedIds", "reveal", "revealEndsAt", "startedAt"]);
      const flat = JSON.stringify(pub);
      for (const id of ids(5)) expect(flat).not.toContain(id);
      for (const k of ["choices", "status", "points", "zone", "zones"]) expect(keys(pub)).not.toContain(k);
      expect(numbers(pub)).toEqual([pub.startedAt, pub.endsAt, pub.revealEndsAt]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; diğerleri ve izleyici başkasınınkini (ve çarpışmayı) göremez", () => {
    let s = start(5);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 71); // p1 ile aynı bölge: bunu kimse önceden öğrenemez
    for (const at of [0, 5_000, 29_999, 30_000, 36_000]) {
      expect(g.view(s, "p1", ctx(T0 + at))).toEqual({ myChoice: 77, locked: false });
      expect(g.view(s, "p2", ctx(T0 + at))).toEqual({ myChoice: 71, locked: false });
      expect(g.view(s, "p3", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, null, ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, "ghost", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
    }
  });

  it("süre dolunca seçimler herkese açılır", () => {
    const s = choose(start(3), "p1", 77);
    expect(g.publicView(s, ctx(T0 + CIZGI_CHOOSE_MS)).reveal?.choices.p1).toBe(77);
  });
});

describe("cizgiyi-gecme erken bitiş", () => {
  const lock = (state: CizgiState, id: string, at: number, connected: readonly string[] = ids(8)) =>
    g.reduce(state, id, { kind: "lock" }, ctx(T0 + at, connected));
  const lockOk = (state: CizgiState, id: string, at: number, connected?: readonly string[]) => {
    const r = lock(state, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const chosen = (n = 3): CizgiState => {
    let s = start(n);
    for (const [i, id] of ids(n).entries()) s = choose(s, id, 20 * (i + 1));
    return s;
  };

  it("(a) herkes kilitleyince seçim aşaması 1 sn sonra biter, sonuç değişmez", () => {
    const base = chosen();
    let s = base;
    for (const id of ids(3)) s = lockOk(s, id, 4_000);
    expect(s.endsAt).toBe(T0 + 5_000);
    expect(g.publicView(s, ctx(T0 + 4_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 5_000)).reveal?.status).toEqual({
      p1: "safe",
      p2: "second",
      p3: "first",
    });
    expect(g.isFinished(s, ctx(T0 + 4_999 + CIZGI_REVEAL_MS))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 5_000 + CIZGI_REVEAL_MS))).toBe(true);
    expect(g.tick(s, ctx(T0 + 5_000)).revealed).toBe(true);
    expect(g.result(s)).toEqual(g.result(base));
  });

  it("(b) bir kişi eksikken bitmez", () => {
    const s = lockOk(lockOk(chosen(), "p1", 2_000), "p2", 3_000);
    expect(s.endsAt).toBe(T0 + CIZGI_CHOOSE_MS);
    expect(g.publicView(s, ctx(T0 + 10_000)).reveal).toBeNull();
    expect(g.isFinished(s, ctx(T0 + 10_000))).toBe(false);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const online = ["p1", "p2"];
    let s = choose(choose(start(3), "p1", 10), "p2", 50);
    s = lockOk(s, "p1", 2_000, online);
    expect(s.endsAt).toBe(T0 + CIZGI_CHOOSE_MS);
    s = lockOk(s, "p2", 3_000, online);
    expect(s.endsAt).toBe(T0 + 4_000);
  });

  it("(d) kilit sonrası değişiklik ve ikinci kilit reddedilir; seçimsiz kilitlenemez", () => {
    const s = lockOk(chosen(), "p1", 2_000);
    expect(reject(s, "p1", 99, 2_500)).toEqual({ rejected: "locked" });
    expect(reject(s, "p1", 20, 2_500)).toEqual({ rejected: "locked" });
    expect(lock(s, "p1", 2_500)).toEqual({ rejected: "locked" });
    expect(g.view(s, "p1", ctx(T0 + 2_500))).toEqual({ myChoice: 20, locked: true });
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
    expect(g.view(s, "p1", ctx(T0 + 2_500))).toEqual({ myChoice: 20, locked: false });
    expect(g.view(s, null, ctx(T0 + 2_500))).toEqual({ myChoice: null, locked: false });
  });

  it("parseAction lock yalnız kind ile kabul edilir", () => {
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(g.parseAction({ kind: "lock", value: 3 })).toBeNull();
  });
});
