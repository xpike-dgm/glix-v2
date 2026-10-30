import { describe, expect, it } from "vitest";
import type { CardId } from "../../cards/catalog.js";
import { type PlayedCard, resolveCards } from "../../cards/resolve.js";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  type AlisverisState,
  alisverisPoints,
  alisverisSettle,
  gizliAlisveris as g,
  rollShelf,
} from "./index.js";
import {
  ALISVERIS_BUDGET,
  ALISVERIS_DURATION_MS,
  ALISVERIS_HEAT_AT_MS,
  ALISVERIS_POOL,
  ALISVERIS_REVEAL_MS,
  ALISVERIS_SCALE,
  ALISVERIS_SHOP_MS,
  alisverisPriceRange,
  couponPrice,
  formatKredi,
  heatLevel,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, seed = 1, connected: readonly string[] = ids(8)) => ({
  now,
  rng: createRng(seed),
  connected,
});
/** Kurallı testler için sabit raf: ilk 12 ürün taban fiyatlarıyla, kupon yok (raf/kupon testleri ayrı). */
const CLASSIC = ALISVERIS_POOL.slice(0, 12).map((p) => ({ id: p.id, name: p.name, price: p.base }));
const start = (n = 4, seed = 1, coupons: Record<string, number> = {}): AlisverisState => ({
  ...g.setup(ids(n), ctx(T0, seed)),
  shelf: CLASSIC.map((p) => ({ ...p })),
  coupons,
});
const END = ALISVERIS_SHOP_MS;

// Ürün numaraları fiyatlarıyla: 0=8, 1=10, 2=12, 3=15, 4=18, 5=20, 6=22, 7=24, 8=26, 9=28, 10=32, 11=36
function act(state: AlisverisState, id: string, kind: "add" | "remove", product: number, at = 1_000) {
  return g.reduce(state, id, { kind, product }, ctx(T0 + at));
}
function ok(state: AlisverisState, id: string, kind: "add" | "remove", product: number, at = 1_000) {
  const r = act(state, id, kind, product, at);
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
/** `baskets[i]` = oyuncu i+1'in sepeti. */
function shop(baskets: number[][]): AlisverisState {
  let s = start(baskets.length);
  baskets.forEach((b, i) => {
    for (const p of b) s = ok(s, `p${i + 1}`, "add", p);
  });
  return s;
}
const reveal = (s: AlisverisState) => {
  const r = g.publicView(s, ctx(T0 + END)).reveal;
  if (!r) throw new Error("açılmadı");
  return r;
};
const priv = (s: AlisverisState, id: string | null, at = 5_000) => g.view(s, id, ctx(T0 + at));

describe("gizli-alisveris kuralları", () => {
  it("katılım 3–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([3, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("tek aşama 30 sn; ardından sonuç gösterimi; sonra biter", () => {
    const s = start();
    expect(ALISVERIS_SHOP_MS).toBe(30_000);
    expect(s.endsAt - s.startedAt).toBe(30_000);
    expect(ALISVERIS_REVEAL_MS).toBeLessThanOrEqual(10_000);
    expect(g.isFinished(s, ctx(T0 + END))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ALISVERIS_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + ALISVERIS_DURATION_MS))).toBe(true);
  });

  it("havuz 20 ürün; herkes 60 kredi ile başlar", () => {
    expect(ALISVERIS_POOL).toHaveLength(20);
    expect(new Set(ALISVERIS_POOL.map((p) => p.name)).size).toBe(20);
    expect(ALISVERIS_POOL.map((p) => p.id)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(ALISVERIS_POOL.slice(12).map((p) => p.name)).toEqual([
      "Lazer Kalem",
      "Ses Kartı",
      "Retro Joystick",
      "Plazma Lamba",
      "Mini Robot",
      "Hologram Saat",
      "Neon Kaykay",
      "VR Gözlük",
    ]);
    expect(ALISVERIS_BUDGET).toBe(60);
    const s = start();
    expect(priv(s, "p1")).toEqual({ basket: [], remaining: 60, locked: false, coupon: null });
    expect(g.publicView(s, ctx(T0)).budget).toBe(60);
  });

  it("sepete ekleme ve çıkarma bir eylemdir; kalan bütçe canlı güncellenir", () => {
    let s = start();
    s = ok(s, "p1", "add", 3); // 15
    s = ok(s, "p1", "add", 5); // 20
    expect(priv(s, "p1")).toEqual({ basket: [3, 5], remaining: 25, locked: false, coupon: null });
    s = ok(s, "p1", "remove", 3);
    expect(priv(s, "p1")).toEqual({ basket: [5], remaining: 40, locked: false, coupon: null });
    s = ok(s, "p1", "add", 3);
    expect(priv(s, "p1").remaining).toBe(25);
  });

  it("aynı ürün ikinci kez eklenemez; sepette olmayan çıkarılamaz", () => {
    const s = ok(start(), "p1", "add", 2);
    expect(act(s, "p1", "add", 2)).toEqual({ rejected: "already_in_basket" });
    expect(act(s, "p1", "remove", 4)).toEqual({ rejected: "not_in_basket" });
    // Başkasının sepeti ayrıdır: aynı ürünü başkası alabilir.
    expect(isRejected(act(s, "p2", "add", 2))).toBe(false);
  });

  it("bütçe aşılamaz: tam 60 kabul, 61 reddedilir ve sepet değişmez", () => {
    let s = start();
    s = ok(s, "p1", "add", 11); // 36
    s = ok(s, "p1", "add", 7); // 60
    expect(priv(s, "p1").remaining).toBe(0);
    expect(act(s, "p1", "add", 0)).toEqual({ rejected: "over_budget" });
    let t = ok(start(), "p1", "add", 11); // 36
    t = ok(t, "p1", "add", 6); // 58
    expect(act(t, "p1", "add", 0)).toEqual({ rejected: "over_budget" }); // 66
    expect(priv(t, "p1").basket).toEqual([11, 6]);
    // Çıkarınca tekrar yer açılır.
    t = ok(t, "p1", "remove", 6);
    expect(isRejected(act(t, "p1", "add", 7))).toBe(false); // 60
  });

  it("parseAction yalnız { kind: add|remove, product: 0..19 tam sayı } kabul eder", () => {
    expect(g.parseAction({ kind: "add", product: 0 })).toEqual({ kind: "add", product: 0 });
    expect(g.parseAction({ kind: "remove", product: 19 })).toEqual({ kind: "remove", product: 19 });
    for (const bad of [-1, 20, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3", null, undefined]) {
      expect(g.parseAction({ kind: "add", product: bad })).toBeNull();
    }
    expect(g.parseAction({ kind: "buy", product: 3 })).toBeNull();
    expect(g.parseAction({ kind: "add", product: 3, extra: 1 })).toBeNull();
    expect(g.parseAction({ kind: "add" })).toBeNull();
  });

  it("katılımcı olmayan reddedilir", () => {
    expect(act(start(), "ghost", "add", 1)).toEqual({ rejected: "not_participant" });
  });

  it("ürün değeri = fiyat / alıcı sayısı: 24 kredilik ürünü 2 kişi alırsa 12 olur", () => {
    const s = shop([[7], [7], [0]]);
    const r = reveal(s);
    expect(r.buyers["7"]).toBe(2);
    expect(r.buyers["0"]).toBe(1);
    expect(r.buyers["5"]).toBe(0);
    expect(r.values).toEqual({ p1: 12 * ALISVERIS_SCALE, p2: 12 * ALISVERIS_SCALE, p3: 8 * ALISVERIS_SCALE });
    expect(r.baskets).toEqual({ p1: [7], p2: [7], p3: [0] });
  });

  it("en değerli sepet +2, ikinci +1, diğerleri 0", () => {
    // p1: 36 (tek) ; p2: 24 + 20 = 44 ; p3: 18
    const res = g.result(shop([[11], [7, 5], [4]]));
    expect(res.awards).toEqual({ p1: 1, p2: 2, p3: 0 });
    // Eksi puan yok: en değersiz (ve boş) sepet 0.
    expect(g.result(shop([[11], [7, 5], [4], []])).awards).toEqual({ p1: 1, p2: 2, p3: 0, p4: 0 });
  });

  it("pahalı ürün çok kişi alınca değer düşer: ucuz ama tek ürün kazanabilir", () => {
    // 36'yı 4 kişi alır -> 9 ; p5 tek başına 28 alır.
    const res = g.result(shop([[11], [11], [11], [11], [9]]));
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1, p5: 2 });
  });

  it("birincide eşitlik: hepsi +2, sonraki farklı değer +1", () => {
    const res = g.result(shop([[7], [7], [0]]));
    expect(res.awards).toEqual({ p1: 2, p2: 2, p3: 1 });
    expect(g.result(shop([[1], [2], [3]])).awards).toEqual({ p1: 0, p2: 1, p3: 2 });
    // İkincide eşitlik: hepsi +1.
    expect(g.result(shop([[11], [1], [1], [0]])).awards).toEqual({ p1: 2, p2: 0, p3: 0, p4: 1 });
    expect(g.result(shop([[11], [2], [5], [2]])).awards).toEqual({ p1: 2, p2: 0, p3: 1, p4: 0 });
    expect(g.result(shop([[11], [6], [8], [4, 0]])).awards).toEqual({ p1: 2, p2: 0, p3: 1, p4: 1 });
  });

  it("kesirli değer (10/3) tam sayı olarak saklanır ve diğer sepetle doğru karşılaştırılır", () => {
    // p1: ürün 1 (10) 3 kişi -> 3,33 ; ürün 0 (8) tek -> 8 ; toplam 11,333..
    // p4: ürün 4 (18) tek -> 18 ... farklı; eşitlik testi: iki sepet tam 10/3+10/3.
    const s = shop([[1], [1], [1], [2, 3], [0]]);
    // buyers: 1->3, 2->1, 3->1, 0->1 ; p4 = 12+15 = 27 ; p5 = 8 ; p1..p3 = 10/3
    const r = reveal(s);
    expect(r.values.p1).toBe((10 * 840) / 3);
    expect(Number.isInteger(r.values.p1)).toBe(true);
    expect(r.winners).toEqual(["p4"]);
  });

  it("değerler kesirsiz tam sayıyla tutulur (1–8 alıcıda); sıralama yuvarlanmamış değerle yapılır", () => {
    // A: ürün 1 (10) ve ürün 2 (12) 7 kişi paylaşırsa çok küçük farklar oluşur. Doğrudan değerleri kuruyoruz:
    const base = shop([[0], [1], [2]]);
    const fake: AlisverisState = {
      ...base,
      baskets: { p1: [0, 1, 2], p2: [0, 1, 2], p3: [0, 1, 2] },
    };
    // Üçü de aynı sepet -> herkesin değeri aynı, kimse puan almaz.
    expect(g.result(fake).awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    // 7 alıcı: 8/7 -> 960/840 ... değerler 840'ın katı olmayabilir ama tam sayıdır.
    const crowd: AlisverisState = {
      ...base,
      players: ids(7),
      baskets: Object.fromEntries(ids(7).map((id) => [id, [0]])),
    };
    const r = alisverisSettle(crowd);
    for (const v of Object.values(r.values)) expect(Number.isInteger(v)).toBe(true);
    // Tek fark: 1 kuruştan küçük: 11 kredi/ 3 kişi değil; mantıksal sıralama ölçekli tam sayıyla yapılır.
    const near: AlisverisState = {
      ...base,
      players: ids(3),
      baskets: { p1: [3, 0], p2: [3, 1], p3: [3, 2] }, // 3 numaralı ürünü üçü alır: 5 ; +8 / +10 / +12
    };
    expect(g.result(near).awards).toEqual({ p1: 0, p2: 1, p3: 2 });
  });

  it("boş sepet 0 sayılır; kimse ürün almazsa kimse puan almaz", () => {
    const s = shop([[], [], []]);
    expect(reveal(s).values).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(reveal(s).winners).toEqual([]);
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    // Yalnız biri alırsa o +2 alır; değeri 0 olan ödül almaz (ikincilik yok).
    expect(g.result(shop([[0], [], []])).awards).toEqual({ p1: 2, p2: 0, p3: 0 });
  });

  it("süre bittiğindeki sepet geçerlidir: eklenip çıkarılan ürün sayılmaz", () => {
    let s = start(3);
    s = ok(s, "p1", "add", 11, 1_000);
    s = ok(s, "p1", "remove", 11, 2_000);
    s = ok(s, "p1", "add", 0, 3_000);
    s = ok(s, "p2", "add", 11, 4_000);
    expect(reveal(s).baskets).toEqual({ p1: [0], p2: [11], p3: [] });
    expect(g.result(s).awards).toEqual({ p1: 1, p2: 2, p3: 0 });
  });

  it("süre dolunca ve sonrasında eylem reddedilir; sonuç değişmez", () => {
    const s = shop([[0], [1], [2]]);
    expect(act(s, "p1", "add", 5, END)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "remove", 0, END + 100)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "add", 5, ALISVERIS_DURATION_MS + 9_999)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "add", 5, END - 1)).not.toHaveProperty("rejected");
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 1, p3: 2 });
  });

  it("bağlantısı kopan oyuncunun sepeti geçerlidir (bağlantı listesi sonucu etkilemez)", () => {
    const s = shop([[7], [0], [1]]);
    const a = g.publicView(s, ctx(T0 + END, 1, []));
    const b = g.publicView(s, ctx(T0 + END, 1, ids(3)));
    expect(a).toEqual(b);
    expect(a.reveal?.winners).toEqual(["p1"]);
  });

  it("görüntü biçimi: iki ondalık, Türkçe virgül", () => {
    expect(formatKredi(0)).toBe("0,00");
    expect(formatKredi(12 * ALISVERIS_SCALE)).toBe("12,00");
    expect(formatKredi((10 * ALISVERIS_SCALE) / 3)).toBe("3,33");
    expect(formatKredi((20 * ALISVERIS_SCALE) / 3)).toBe("6,67");
    expect(formatKredi((5 * ALISVERIS_SCALE) / 2)).toBe("2,50");
    expect(formatKredi(ALISVERIS_SCALE / 8)).toBe("0,13"); // 0,125 yarım yukarı
    expect(formatKredi(1234 * ALISVERIS_SCALE + 420)).toBe("1234,50");
  });

  it("miniScores tam sayıdır ve awards ile aynıdır (sepet değerleri sonuç görünümünde)", () => {
    const res = g.result(shop([[7], [7], [1]]));
    expect(res.miniScores).toEqual({ p1: 2, p2: 2, p3: 1 });
    expect(res.awards).toEqual({ p1: 2, p2: 2, p3: 1 });
  });

  it("tick süre dolunca durumu bir kez değiştirir", () => {
    const s = g.tick(start(), ctx(T0 + ALISVERIS_HEAT_AT_MS));
    expect(g.tick(s, ctx(T0 + END - 1))).toBe(s);
    const t = g.tick(s, ctx(T0 + END));
    expect(t).not.toBe(s);
    expect(g.tick(t, ctx(T0 + END + 1))).toBe(t);
  });
});

describe("gizli-alisveris gizlilik", () => {
  it("süre dolmadan ortak görünümde sepet, alıcı sayısı ve değer yoktur", () => {
    const s = shop([[7, 0], [7], [11]]);
    const p = g.publicView(s, ctx(T0 + END - 1));
    expect(p.reveal).toBeNull();
    expect(Object.keys(p).sort()).toEqual(
      [
        "budget",
        "endsAt",
        "heat",
        "heatAt",
        "products",
        "ready",
        "reveal",
        "revealEndsAt",
        "startedAt",
      ].sort(),
    );
    const raw = JSON.stringify(p);
    for (const k of ["basket", "buyers", "values", "winners", "coupon", "points"])
      expect(raw).not.toContain(k);
    // Raf listesi yalnız ad, fiyat ve numara taşır.
    for (const x of p.products) expect(Object.keys(x).sort()).toEqual(["id", "name", "price"]);
  });

  it("her oyuncu yalnız kendi sepetini görür; izleyici hiçbirini", () => {
    const s = shop([[7, 0], [7], [11]]);
    expect(priv(s, "p1")).toEqual({ basket: [7, 0], remaining: 28, locked: false, coupon: null });
    expect(priv(s, "p2")).toEqual({ basket: [7], remaining: 36, locked: false, coupon: null });
    expect(priv(s, "p3")).toEqual({ basket: [11], remaining: 24, locked: false, coupon: null });
    expect(priv(s, null)).toEqual({ basket: [], remaining: 60, locked: false, coupon: null });
    for (const id of ids(3))
      expect(Object.keys(priv(s, id)).sort()).toEqual(["basket", "coupon", "locked", "remaining"]);
  });

  it("süre dolunca sepetler ve alıcı sayıları ortak olur", () => {
    const s = shop([[7, 0], [7], [11]]);
    const r = g.publicView(s, ctx(T0 + END)).reveal;
    expect(r?.baskets).toEqual({ p1: [0, 7], p2: [7], p3: [11] });
    expect(r?.buyers["7"]).toBe(2);
  });

  it("rakibin eylemi başkasının görünümünü değiştirmez", () => {
    const a = shop([[7], [], []]);
    const b = shop([[7], [11], [0, 1]]);
    expect(priv(a, "p1")).toEqual(priv(b, "p1"));
    expect(g.publicView(a, ctx(T0 + 5_000))).toEqual(g.publicView(b, ctx(T0 + 5_000)));
  });
});

describe("gizli-alisveris erken bitiş (Tamam)", () => {
  const lockAt = (s: AlisverisState, id: string, at: number, connected: readonly string[] = ids(8)) =>
    g.reduce(s, id, { kind: "lock" }, ctx(T0 + at, 1, connected));
  const lock = (s: AlisverisState, id: string, at: number, connected?: readonly string[]): AlisverisState => {
    const r = lockAt(s, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };

  it("parseAction lock kabul eder, fazladan alanı reddeder", () => {
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(g.parseAction({ kind: "lock", product: 1 })).toBeNull();
  });

  it("(a) herkes kilitleyince 1 sn sonra açılır; sonuç gösterimi buna göre kayar; boş sepet kilitlenebilir", () => {
    let s = shop([[0, 1], [2], []]);
    s = lock(s, "p1", 5_000);
    s = lock(s, "p2", 6_000);
    s = lock(s, "p3", 7_000);
    expect(g.publicView(s, ctx(T0 + 7_500)).endsAt).toBe(T0 + 8_000);
    expect(g.publicView(s, ctx(T0 + 7_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 8_000)).reveal).not.toBeNull();
    expect(g.isFinished(s, ctx(T0 + 8_000 + ALISVERIS_REVEAL_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + 8_000 + ALISVERIS_REVEAL_MS))).toBe(true);
    expect(g.tick(s, ctx(T0 + 8_000)).revealed).toBe(true);
    // Puanlama değişmez: p1 (8+10=18) en değerli, p2 (12) ikinci.
    expect(g.result(s).awards).toEqual({ p1: 2, p2: 1, p3: 0 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = shop([[0], [1], [2]]);
    s = lock(s, "p1", 5_000);
    s = lock(s, "p2", 5_000);
    expect(g.publicView(s, ctx(T0 + 5_000)).endsAt).toBe(T0 + END);
    expect(g.publicView(s, ctx(T0 + 20_000)).reveal).toBeNull();
  });

  it("(c) bağlantısı kopan oyuncu beklenmez; bağlı kimse yoksa kilit bitirmez", () => {
    const conn = ["p1", "p2"];
    let s = shop([[0], [1], [2]]);
    s = lock(s, "p1", 5_000, conn);
    s = lock(s, "p2", 5_000, conn);
    expect(g.publicView(s, ctx(T0 + 5_000)).endsAt).toBe(T0 + 6_000);
    const t = lock(shop([[0], [1], [2]]), "p1", 5_000, []);
    expect(g.publicView(t, ctx(T0 + 5_000)).endsAt).toBe(T0 + END);
  });

  it("(d) kilitten sonra ekleme/çıkarma/ikinci kilit reddedilir; kapanış penceresinde kimse değiştiremez", () => {
    let s = shop([[0], [1], [2]]);
    s = lock(s, "p1", 5_000);
    expect(act(s, "p1", "add", 5, 5_100)).toEqual({ rejected: "locked" });
    expect(act(s, "p1", "remove", 0, 5_100)).toEqual({ rejected: "locked" });
    expect(lockAt(s, "p1", 5_100)).toEqual({ rejected: "locked" });
    const conn = ["p1", "p2"];
    let t = shop([[0], [1], [2]]);
    t = lock(t, "p1", 5_000, conn);
    t = lock(t, "p2", 5_000, conn);
    expect(act(t, "p3", "add", 5, 5_500)).toEqual({ rejected: "closed" });
    expect(act(t, "p3", "add", 5, 6_000)).toEqual({ rejected: "ended" });
  });

  it("(e) kilit listesi sepetleri sızdırmaz", () => {
    let s = shop([[0, 1], [2], []]);
    s = lock(s, "p1", 5_000);
    const pubView = g.publicView(s, ctx(T0 + 5_100));
    expect(pubView.ready).toEqual(["p1"]);
    expect(pubView.reveal).toBeNull();
    expect(JSON.stringify(pubView)).not.toMatch(/baskets|buyers|values/);
    expect(priv(s, "p1")).toMatchObject({ basket: [0, 1], locked: true });
    expect(priv(s, "p2")).toMatchObject({ basket: [2], locked: false });
    expect(priv(s, null)).toMatchObject({ basket: [], locked: false });
  });

  it("(f) tick bağlantıya bakmaz", () => {
    let s = shop([[0], [1], [2]]);
    for (const id of ids(3)) s = lock(s, id, 5_000);
    expect(g.tick(s, ctx(T0 + 6_000, 1, []))).toEqual(g.tick(s, ctx(T0 + 6_000, 1, ids(3))));
  });
});

describe("gizli-alisveris her maç farklı raf", () => {
  const shelfOf = (seed: number, n = 4) => g.publicView(g.setup(ids(n), ctx(T0, seed)), ctx(T0)).products;

  it("havuzdan 12 farklı ürün; fiyatlar tam sayı, 6–40 ve taban fiyatın ±%30'u içinde", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const p = shelfOf(seed);
      expect(p).toHaveLength(12);
      expect(new Set(p.map((x) => x.id)).size).toBe(12);
      for (const x of p) {
        const base = ALISVERIS_POOL[x.id];
        expect(base?.name).toBe(x.name);
        expect(Number.isInteger(x.price)).toBe(true);
        expect(x.price).toBeGreaterThanOrEqual(6);
        expect(x.price).toBeLessThanOrEqual(40);
        expect(x.price).toBeGreaterThanOrEqual(Math.ceil((base?.base ?? 0) * 0.7 - 1e-9));
        expect(x.price).toBeLessThanOrEqual(Math.floor((base?.base ?? 0) * 1.3 + 1e-9));
      }
    }
  });

  it("ürün sayısı sınırı yok: tek sınır bütçe; ucuz rafta 5+ ürün alınabilir", () => {
    // Ucuz raf: 12 ürün 6–12 kredi.
    const cheap = [6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 12];
    let s: AlisverisState = {
      ...start(3),
      shelf: CLASSIC.map((p, i) => ({ ...p, price: cheap[i] ?? 6 })),
    };
    for (const id of [0, 1, 2, 3, 4, 5, 6]) s = ok(s, "p1", "add", id); // 6+6+7+7+8+8+9 = 51
    expect(priv(s, "p1").basket).toHaveLength(7);
    expect(priv(s, "p1").remaining).toBe(9);
    s = ok(s, "p1", "add", 7); // 60
    expect(priv(s, "p1").remaining).toBe(0);
    expect(act(s, "p1", "add", 8)).toEqual({ rejected: "over_budget" });
    expect(reveal(s).baskets.p1).toHaveLength(8);
  });

  it("kuponla 5 ürün sığabilir (en ucuz 5'in tam fiyatı 60'ı geçse bile)", () => {
    // Klasik raf: en ucuz 5 = 8+10+12+15+18 = 63; kupon Mini Hoparlör'de (18 → 9) → 54.
    let s = start(3, 1, { p1: 4, p2: 5, p3: 6 });
    for (const id of [0, 1, 2, 3, 4]) s = ok(s, "p1", "add", id);
    expect(priv(s, "p1")).toMatchObject({ basket: [0, 1, 2, 3, 4], remaining: 6 });
    // Kuponsuz oyuncu aynı 5'liyi alamaz.
    let t = start(3, 1, { p1: 4, p2: 5, p3: 6 });
    for (const id of [0, 1, 2, 3]) t = ok(t, "p2", "add", id);
    expect(act(t, "p2", "add", 4)).toEqual({ rejected: "over_budget" });
  });

  it("raf üretimi rng'yi yeniden çekme döngüsü olmadan bir kez kullanır", () => {
    const zero = { next: () => 0, int: () => 0, shuffle: <T>(xs: readonly T[]) => [...xs].reverse() };
    const shelf = rollShelf(zero);
    expect(shelf).toHaveLength(12);
    for (const p of shelf) expect(p.price).toBe(alisverisPriceRange(ALISVERIS_POOL[p.id]?.base ?? 0).min);
  });

  it("fiyat aralığı: ±%30, 6'nın altına ve 40'ın üstüne çıkmaz", () => {
    expect(alisverisPriceRange(8)).toEqual({ min: 6, max: 10 });
    expect(alisverisPriceRange(10)).toEqual({ min: 7, max: 13 });
    expect(alisverisPriceRange(36)).toEqual({ min: 26, max: 40 });
    expect(alisverisPriceRange(34)).toEqual({ min: 24, max: 40 });
  });

  it("maç başına raf, sıra ve fiyatlar değişir; aynı tohumda aynıdır (tekrar oynatılabilir)", () => {
    const sets = new Set<string>();
    const prices = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const p = shelfOf(seed);
      sets.add(
        p
          .map((x) => x.id)
          .sort((a, b) => a - b)
          .join(),
      );
      prices.add(p.map((x) => `${x.id}:${x.price}`).join());
    }
    expect(sets.size).toBeGreaterThan(15);
    expect(prices.size).toBe(20);
    expect(shelfOf(7)).toEqual(shelfOf(7));
    // Raf herkes için aynıdır: oyuncu sayısı rafı değiştirmez, ortak görünümde tek liste vardır.
    expect(shelfOf(9, 3)).toEqual(shelfOf(9, 8));
  });

  it("rafta olmayan ürün eklenemez/çıkarılamaz", () => {
    const s = g.setup(ids(3), ctx(T0, 5));
    const off = ALISVERIS_POOL.find((p) => !s.shelf.some((x) => x.id === p.id));
    expect(off).toBeDefined();
    expect(g.reduce(s, "p1", { kind: "add", product: off?.id ?? 0 }, ctx(T0 + 100))).toEqual({
      rejected: "not_on_shelf",
    });
    expect(g.reduce(s, "p1", { kind: "remove", product: off?.id ?? 0 }, ctx(T0 + 100))).toEqual({
      rejected: "not_on_shelf",
    });
  });
});

describe("gizli-alisveris gizli kupon", () => {
  it("herkese rafta bir kupon düşer; 8 oyuncuda bile iki oyuncuya aynı ürün düşmez", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = g.setup(ids(8), ctx(T0, seed));
      const cs = ids(8).map((id) => s.coupons[id]);
      expect(new Set(cs).size).toBe(8);
      for (const c of cs) expect(s.shelf.some((p) => p.id === c)).toBe(true);
    }
  });

  it("indirim %50, tam sayıya yukarı yuvarlanır", () => {
    expect(couponPrice(14)).toBe(7);
    expect(couponPrice(15)).toBe(8);
    expect(couponPrice(7)).toBe(4);
    expect(couponPrice(40)).toBe(20);
  });

  it("yalnız ödenen fiyat düşer; bütçe kontrolü indirimli fiyatla yapılır", () => {
    // p1'in kuponu Gizli Sandık (36 → 18).
    let s = start(3, 1, { p1: 11, p2: 10, p3: 9 });
    s = ok(s, "p1", "add", 11);
    expect(priv(s, "p1")).toEqual({ basket: [11], remaining: 42, locked: false, coupon: 11 });
    s = ok(s, "p1", "add", 10); // 32 → toplam 50
    s = ok(s, "p1", "add", 1); // 10 → toplam 60 (kuponsuz 78 olurdu)
    expect(priv(s, "p1").remaining).toBe(0);
    expect(act(s, "p1", "add", 0)).toEqual({ rejected: "over_budget" });
    // Başkası aynı ürünü tam fiyata öder.
    const t = ok(start(3, 1, { p1: 11, p2: 10, p3: 9 }), "p2", "add", 11);
    expect(priv(t, "p2").remaining).toBe(24);
    // Kuponla yer açılan ürün kuponsuz sığmaz.
    let u = start(3, 1, { p1: 11, p2: 10, p3: 9 });
    u = ok(u, "p2", "add", 9); // 28
    expect(act(u, "p2", "add", 11)).toEqual({ rejected: "over_budget" }); // 64
    u = ok(u, "p1", "add", 9); // 28
    expect(isRejected(act(u, "p1", "add", 11))).toBe(false); // 28 + 18 = 46
  });

  it("değer tam fiyat ÷ alıcıdır: kupon değeri düşürmez", () => {
    let s = start(3, 1, { p1: 11, p2: 10, p3: 9 });
    s = ok(s, "p1", "add", 11); // kuponlu, 18 ödedi
    s = ok(s, "p2", "add", 7);
    s = ok(s, "p3", "add", 7);
    const r = reveal(s);
    expect(r.values.p1).toBe(36 * ALISVERIS_SCALE);
    expect(r.values.p2).toBe(12 * ALISVERIS_SCALE);
    // Kuponlu ürünü başkası da alırsa değer yine tam fiyattan bölünür.
    let t = start(3, 1, { p1: 11, p2: 10, p3: 9 });
    t = ok(t, "p1", "add", 11);
    t = ok(t, "p2", "add", 11);
    expect(reveal(t).values).toMatchObject({ p1: 18 * ALISVERIS_SCALE, p2: 18 * ALISVERIS_SCALE });
  });

  it("kuponu kullanmak zorunlu değil", () => {
    let s = start(3, 1, { p1: 11, p2: 10, p3: 9 });
    s = ok(s, "p1", "add", 0);
    expect(priv(s, "p1")).toMatchObject({ basket: [0], remaining: 52, coupon: 11 });
    expect(g.result(shop([[0], [1], []])).awards).toEqual({ p1: 1, p2: 2, p3: 0 });
  });

  it("kupon yalnız sahibinin görünümünde; ortak görünümde ve izleyicide yok; sonuçta herkesinki açılır", () => {
    const s = g.setup(ids(4), ctx(T0, 3));
    for (const id of ids(4)) expect(priv(s, id).coupon).toBe(s.coupons[id]);
    expect(priv(s, null).coupon).toBeNull();
    const before = g.publicView(s, ctx(T0 + END - 1));
    expect(JSON.stringify(before)).not.toContain("coupon");
    // Başkasının kuponu değişse bile benim görünümüm ve ortak görünüm değişmez.
    const other = { ...s, coupons: { ...s.coupons, p2: s.coupons.p3 ?? 0, p3: s.coupons.p2 ?? 0 } };
    expect(priv(other, "p1")).toEqual(priv(s, "p1"));
    expect(g.publicView(other, ctx(T0 + 5_000))).toEqual(g.publicView(s, ctx(T0 + 5_000)));
    expect(g.publicView(s, ctx(T0 + END)).reveal?.coupons).toEqual(s.coupons);
  });
});

describe("gizli-alisveris vitrin fısıltısı", () => {
  it("eşikler: 0 yok, ≤%25 1, ≤%50 2, >%50 3", () => {
    expect([0, 1, 2, 3, 4, 5, 8].map((h) => heatLevel(h, 8))).toEqual([0, 1, 1, 2, 2, 3, 3]);
    expect([0, 1, 2, 3].map((h) => heatLevel(h, 3))).toEqual([0, 2, 3, 3]);
    expect([0, 1, 2, 3, 4].map((h) => heatLevel(h, 4))).toEqual([0, 1, 2, 3, 3]);
    expect([1, 2, 3].map((h) => heatLevel(h, 5))).toEqual([1, 2, 3]);
  });

  it("15. saniyeden önce yok; 15. saniyede o anki sepetlerle belirir, raftaki her ürün için", () => {
    let s = shop([[7, 0], [7], [7], [11]]);
    expect(g.publicView(s, ctx(T0 + ALISVERIS_HEAT_AT_MS - 1)).heat).toBeNull();
    expect(g.publicView(s, ctx(T0)).heatAt).toBe(T0 + ALISVERIS_HEAT_AT_MS);
    s = g.tick(s, ctx(T0 + ALISVERIS_HEAT_AT_MS));
    const heat = g.publicView(s, ctx(T0 + ALISVERIS_HEAT_AT_MS)).heat;
    expect(heat?.["7"]).toBe(3); // 3/4
    expect(heat?.["0"]).toBe(1); // 1/4
    expect(heat?.["11"]).toBe(1);
    expect(heat?.["5"]).toBe(0);
    expect(Object.keys(heat ?? {}).sort()).toEqual(s.shelf.map((p) => String(p.id)).sort());
  });

  it("15. saniyedeki duruma göre DONAR: sonraki değişiklikler ateşi değiştirmez", () => {
    let s = shop([[7], [7], [], []]);
    s = ok(s, "p3", "add", 7, ALISVERIS_HEAT_AT_MS - 1); // 15. saniyeden önce: sayılır
    s = ok(s, "p4", "add", 5, ALISVERIS_HEAT_AT_MS); // 15. saniyede gelen eylem: sayılmaz (ateş önce donar)
    s = ok(s, "p1", "remove", 7, ALISVERIS_HEAT_AT_MS + 2_000);
    s = ok(s, "p2", "add", 11, ALISVERIS_HEAT_AT_MS + 3_000);
    const heat = g.publicView(s, ctx(T0 + END - 1)).heat;
    expect(heat?.["7"]).toBe(3);
    expect(heat?.["5"]).toBe(0);
    expect(heat?.["11"]).toBe(0);
    expect(g.publicView(g.tick(s, ctx(T0 + END - 1)), ctx(T0 + END - 1)).heat).toEqual(heat);
  });

  it("tick zamanlamasından bağımsızdır (tick erken/geç çalışsa da aynı ateş)", () => {
    const base = shop([[7], [0], [], []]);
    const early = g.tick(base, ctx(T0 + ALISVERIS_HEAT_AT_MS));
    const a = ok(early, "p3", "add", 7, ALISVERIS_HEAT_AT_MS + 50);
    const b = ok(base, "p3", "add", 7, ALISVERIS_HEAT_AT_MS + 50); // tick hiç çalışmadan
    const t = T0 + ALISVERIS_HEAT_AT_MS + 100;
    expect(g.publicView(a, ctx(t)).heat).toEqual(g.publicView(b, ctx(t)).heat);
    expect(g.publicView(g.tick(b, ctx(t)), ctx(t)).heat).toEqual(g.publicView(a, ctx(t)).heat);
  });

  it("gizlilik: ortak görünümde yalnız seviye var; kim aldığı ve tam sayı yok", () => {
    const s = g.tick(shop([[7, 0], [7], [11], []]), ctx(T0 + ALISVERIS_HEAT_AT_MS));
    const p = g.publicView(s, ctx(T0 + ALISVERIS_HEAT_AT_MS + 10));
    expect(p.reveal).toBeNull();
    for (const v of Object.values(p.heat ?? {})) expect([0, 1, 2, 3]).toContain(v);
    const raw = JSON.stringify(p.heat);
    for (const id of ids(4)) expect(raw).not.toContain(id);
    // Aynı seviyeye düşen farklı sepet dağılımları aynı ortak görünümü verir.
    const other = g.tick(shop([[11], [7], [7, 0], []]), ctx(T0 + ALISVERIS_HEAT_AT_MS));
    expect(g.publicView(other, ctx(T0 + ALISVERIS_HEAT_AT_MS + 10))).toEqual(p);
    // 4 kişide 1 ve 0 alıcı ayrılır ama 3 ile 4 alıcı aynı seviyededir (tam sayı yok).
    const three = g.tick(shop([[7], [7], [7], []]), ctx(T0 + ALISVERIS_HEAT_AT_MS));
    const four = g.tick(shop([[7], [7], [7], [7]]), ctx(T0 + ALISVERIS_HEAT_AT_MS));
    const at = ctx(T0 + ALISVERIS_HEAT_AT_MS + 10);
    expect(g.publicView(three, at).heat).toEqual(g.publicView(four, at).heat);
  });

  it("herkes 15. saniyeden önce bitirirse ateş hiç gösterilmez", () => {
    let s = shop([[7], [0], [1]]);
    for (const id of ids(3)) {
      const r = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 5_000, 1, ids(3)));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    expect(g.tick(s, ctx(T0 + ALISVERIS_HEAT_AT_MS)).heat).toBeNull();
    expect(g.publicView(s, ctx(T0 + ALISVERIS_HEAT_AT_MS)).heat).toBeNull();
  });

  it("herkes 14,9. saniyede Tamam derse kapanış penceresi 15. saniyeyi geçse de ateş gösterilmez", () => {
    let s = shop([[7], [7], [1]]);
    for (const id of ids(3)) {
      const r = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 14_900, 1, ids(3)));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    expect(s.endsAt).toBe(T0 + 15_900);
    expect(s.closedAt).toBe(T0 + 14_900);
    for (const at of [ALISVERIS_HEAT_AT_MS, ALISVERIS_HEAT_AT_MS + 500, 15_899, 15_900]) {
      expect(g.tick(s, ctx(T0 + at)).heat).toBeNull();
      expect(g.publicView(s, ctx(T0 + at)).heat).toBeNull();
    }
    expect(g.nextWake?.(s, ctx(T0 + 14_900))).toBe(T0 + 15_900);
    // Tam 15. saniyede kapanırsa ateş, kilitten önceki sepetlerle donar (ortak görünümde kalır).
    let t = shop([[7], [7], [1]]);
    for (const id of ids(3)) {
      const r = g.reduce(t, id, { kind: "lock" }, ctx(T0 + ALISVERIS_HEAT_AT_MS, 1, ids(3)));
      if (isRejected(r)) throw new Error(r.rejected);
      t = r;
    }
    expect(g.publicView(t, ctx(T0 + ALISVERIS_HEAT_AT_MS)).heat?.["7"]).toBe(3);
  });

  it("nextWake: önce vitrin anı, sonra alışveriş sonu, sonra oyun sonu", () => {
    const s = start();
    expect(g.nextWake?.(s, ctx(T0 + 1))).toBe(T0 + ALISVERIS_HEAT_AT_MS);
    const t = g.tick(s, ctx(T0 + ALISVERIS_HEAT_AT_MS));
    expect(g.nextWake?.(t, ctx(T0 + ALISVERIS_HEAT_AT_MS))).toBe(T0 + END);
    expect(g.nextWake?.(t, ctx(T0 + END))).toBe(T0 + ALISVERIS_DURATION_MS);
    expect(g.nextWake?.(t, ctx(T0 + ALISVERIS_DURATION_MS))).toBeNull();
  });
});

describe("gizli-alisveris puanlama (+2 / +1 / 0)", () => {
  const P3 = ["a", "b", "c"];
  it("eksi puan yok; değeri 0 olan ödül almaz; herkes eşitse kimse almaz", () => {
    expect(alisverisPoints(P3, { a: 30, b: 20, c: 10 })).toEqual({ a: 2, b: 1, c: 0 });
    expect(alisverisPoints(P3, { a: 30, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(alisverisPoints(P3, { a: 30, b: 30, c: 0 })).toEqual({ a: 2, b: 2, c: 0 });
    expect(alisverisPoints(P3, { a: 30, b: 30, c: 30 })).toEqual({ a: 0, b: 0, c: 0 });
    expect(alisverisPoints(P3, { a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
    expect(alisverisPoints(P3, { a: 30, b: 30, c: 5 })).toEqual({ a: 2, b: 2, c: 1 });
    expect(alisverisPoints(P3, { a: 30, b: 5, c: 5 })).toEqual({ a: 2, b: 1, c: 1 });
    expect(alisverisPoints(P3, {})).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("sonuçta herkesin puanı ve kazananlar açılır", () => {
    const r = reveal(shop([[11], [7, 5], [4]]));
    expect(r.points).toEqual({ p1: 1, p2: 2, p3: 0 });
    expect(r.winners).toEqual(["p2"]);
  });
});

describe("gizli-alisveris maç kartlarıyla", () => {
  const P = ["p1", "p2", "p3", "p4"];
  /** p1 +2 (birinci), p2 +1 (ikinci), p3 ve p4 0 (sonuncular). */
  const res = g.result(shop([[11], [7, 5], [4], []]));
  const play = (playerId: string, cardId: CardId, target?: string): PlayedCard =>
    target ? { playerId, cardId, target } : { playerId, cardId };
  const run = (plays: PlayedCard[], awards = res.awards, miniScores = res.miniScores) =>
    resolveCards({
      participants: P,
      present: P,
      miniScores,
      awards,
      plays,
      pending: {},
      hands: {},
      seed: 1,
      gameIndex: 0,
    }).awards;

  it("ham sonuç: +2 / +1 / 0 / 0, mini puan = ham puan", () => {
    expect(res.awards).toEqual({ p1: 1, p2: 2, p3: 0, p4: 0 });
    expect(res.miniScores).toEqual(res.awards);
  });

  it("Çift Puan +2'yi +4 yapar; Altın Dokunuş +1'i +3", () => {
    expect(run([play("p2", "cift-puan")]).p2).toBe(4);
    expect(run([play("p1", "altin-dokunus")]).p1).toBe(3);
  });

  it("Kendine Güven: birinci (+2 alan) +2 daha; ikinci −1", () => {
    expect(run([play("p2", "kendine-guven")]).p2).toBe(4);
    expect(run([play("p1", "kendine-guven")]).p1).toBe(0);
  });

  it("Sigorta: 0 alanlar sonuncudur (+1); ikinci sonuncu sayılmaz", () => {
    expect(run([play("p3", "sigorta")]).p3).toBe(1);
    expect(run([play("p1", "sigorta")]).p1).toBe(1);
  });

  it("herkesin değeri eşitse herkes 0 ve herkes birinci: Kendine Güven +2, Sigorta etkisiz", () => {
    const zero = { p1: 0, p2: 0, p3: 0, p4: 0 };
    expect(run([play("p1", "kendine-guven"), play("p2", "sigorta")], zero, zero)).toMatchObject({
      p1: 2,
      p2: 0,
    });
  });

  it("Ters Köşe: sıra tersine döner (0 alanlar +2 ve +1'i paylaşır, birinci 0)", () => {
    const out = run([play("p3", "ters-kose")]);
    expect(out.p2).toBe(0);
    expect(out.p1).toBe(0);
    expect((out.p3 ?? 0) + (out.p4 ?? 0)).toBe(3);
  });

  it("Lanet artı puanı sıfırlar; Çelme eksiye düşürebilir, Kalkan 0'a çeker", () => {
    expect(run([play("p3", "lanet", "p2")]).p2).toBe(0);
    expect(run([play("p1", "celme", "p3")]).p3).toBe(-1);
    expect(run([play("p3", "kalkan"), play("p1", "celme", "p3")]).p3).toBe(0);
  });

  it("Hırsız birinciden 1 puan alır; Vergi puan alan hedeften 1 puan geçirir", () => {
    expect(run([play("p3", "hirsiz")])).toMatchObject({ p2: 1, p3: 1 });
    expect(run([play("p4", "vergi", "p1")])).toMatchObject({ p1: 0, p4: 1 });
  });
});
