import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type AlisverisState, alisverisSettle, gizliAlisveris as g } from "./index.js";
import {
  ALISVERIS_BUDGET,
  ALISVERIS_CATALOG,
  ALISVERIS_DURATION_MS,
  ALISVERIS_REVEAL_MS,
  ALISVERIS_SCALE,
  ALISVERIS_SHOP_MS,
  formatKredi,
} from "./types.js";

const T0 = 1_000_000;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const ctx = (now: number, seed = 1, connected: readonly string[] = ids(8)) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (n = 4, seed = 1): AlisverisState => g.setup(ids(n), ctx(T0, seed));
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

  it("havuz: 12 sabit ürün ve doğru fiyatlar; herkes 60 kredi ile başlar", () => {
    expect(ALISVERIS_CATALOG.map((p) => [p.name, p.price])).toEqual([
      ["Hologram Sticker", 8],
      ["Enerji İçeceği", 10],
      ["Neon Rozet", 12],
      ["Retro Kartuş", 15],
      ["Mini Hoparlör", 18],
      ["Arcade Eldiveni", 20],
      ["Piksel Kamera", 22],
      ["Jet Çanta", 24],
      ["Kristal Kulaklık", 26],
      ["Holo Kask", 28],
      ["Mini Drone", 32],
      ["Gizli Sandık", 36],
    ]);
    expect(ALISVERIS_BUDGET).toBe(60);
    const s = start();
    expect(priv(s, "p1")).toEqual({ basket: [], remaining: 60 });
    expect(g.publicView(s, ctx(T0)).budget).toBe(60);
  });

  it("ürün sırası maç başına karışır ama aynı tohumda aynıdır; hepsi görünür", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const p = g.publicView(start(4, seed), ctx(T0)).products;
      expect(p.map((x) => x.id).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      for (const x of p) expect(x.price).toBe(ALISVERIS_CATALOG[x.id]?.price);
      orders.add(p.map((x) => x.id).join());
    }
    expect(orders.size).toBeGreaterThan(8);
    expect(g.publicView(start(4, 7), ctx(T0)).products).toEqual(g.publicView(start(4, 7), ctx(T0)).products);
  });

  it("sepete ekleme ve çıkarma bir eylemdir; kalan bütçe canlı güncellenir", () => {
    let s = start();
    s = ok(s, "p1", "add", 3); // 15
    s = ok(s, "p1", "add", 5); // 20
    expect(priv(s, "p1")).toEqual({ basket: [3, 5], remaining: 25 });
    s = ok(s, "p1", "remove", 3);
    expect(priv(s, "p1")).toEqual({ basket: [5], remaining: 40 });
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

  it("parseAction yalnız { kind: add|remove, product: 0..11 tam sayı } kabul eder", () => {
    expect(g.parseAction({ kind: "add", product: 0 })).toEqual({ kind: "add", product: 0 });
    expect(g.parseAction({ kind: "remove", product: 11 })).toEqual({ kind: "remove", product: 11 });
    for (const bad of [-1, 12, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3", null, undefined]) {
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

  it("en yüksek değerli sepet +1 alır, diğerleri 0", () => {
    // p1: 36 (tek) ; p2: 24 + 20 = 44 ; p3: 18
    const res = g.result(shop([[11], [7, 5], [4]]));
    expect(res.awards).toEqual({ p1: 0, p2: 1, p3: 0 });
  });

  it("pahalı ürün çok kişi alınca değer düşer: ucuz ama tek ürün kazanabilir", () => {
    // 36'yı 4 kişi alır -> 9 ; p5 tek başına 28 alır.
    const res = g.result(shop([[11], [11], [11], [11], [9]]));
    expect(res.awards).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0, p5: 1 });
  });

  it("en değerli sepetler eşitse hepsi +1 alır", () => {
    const res = g.result(shop([[7], [7], [0]]));
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 0 });
    expect(g.result(shop([[1], [2], [3]])).awards).toEqual({ p1: 0, p2: 0, p3: 1 });
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
    // Üçü de aynı sepet -> hepsi eşit, hepsi +1.
    expect(g.result(fake).awards).toEqual({ p1: 1, p2: 1, p3: 1 });
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
    expect(g.result(near).awards).toEqual({ p1: 0, p2: 0, p3: 1 });
  });

  it("boş sepet 0 sayılır; kimse ürün almazsa kimse puan almaz", () => {
    const s = shop([[], [], []]);
    expect(reveal(s).values).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(reveal(s).winners).toEqual([]);
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 0, p3: 0 });
    // Yalnız biri alırsa o kazanır; sepet göndermeyen 0.
    expect(g.result(shop([[0], [], []])).awards).toEqual({ p1: 1, p2: 0, p3: 0 });
  });

  it("süre bittiğindeki sepet geçerlidir: eklenip çıkarılan ürün sayılmaz", () => {
    let s = start(3);
    s = ok(s, "p1", "add", 11, 1_000);
    s = ok(s, "p1", "remove", 11, 2_000);
    s = ok(s, "p1", "add", 0, 3_000);
    s = ok(s, "p2", "add", 11, 4_000);
    expect(reveal(s).baskets).toEqual({ p1: [0], p2: [11], p3: [] });
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 1, p3: 0 });
  });

  it("süre dolunca ve sonrasında eylem reddedilir; sonuç değişmez", () => {
    const s = shop([[0], [1], [2]]);
    expect(act(s, "p1", "add", 5, END)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "remove", 0, END + 100)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "add", 5, ALISVERIS_DURATION_MS + 9_999)).toEqual({ rejected: "ended" });
    expect(act(s, "p1", "add", 5, END - 1)).not.toHaveProperty("rejected");
    expect(g.result(s).awards).toEqual({ p1: 0, p2: 0, p3: 1 });
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

  it("miniScores sepet değeridir (iki ondalık), awards yalnız +1", () => {
    const res = g.result(shop([[7], [7], [1]]));
    expect(res.miniScores).toEqual({ p1: 12, p2: 12, p3: 10 });
    expect(res.awards).toEqual({ p1: 1, p2: 1, p3: 0 });
  });

  it("tick süre dolunca durumu bir kez değiştirir", () => {
    const s = start();
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
      ["budget", "endsAt", "products", "reveal", "revealEndsAt", "startedAt"].sort(),
    );
    const raw = JSON.stringify(p);
    for (const k of ["basket", "buyers", "values", "winners"]) expect(raw).not.toContain(k);
    // Raf listesi yalnız ad, fiyat ve numara taşır.
    for (const x of p.products) expect(Object.keys(x).sort()).toEqual(["id", "name", "price"]);
  });

  it("her oyuncu yalnız kendi sepetini görür; izleyici hiçbirini", () => {
    const s = shop([[7, 0], [7], [11]]);
    expect(priv(s, "p1")).toEqual({ basket: [7, 0], remaining: 28 });
    expect(priv(s, "p2")).toEqual({ basket: [7], remaining: 36 });
    expect(priv(s, "p3")).toEqual({ basket: [11], remaining: 24 });
    expect(priv(s, null)).toEqual({ basket: [], remaining: 60 });
    for (const id of ids(3)) expect(Object.keys(priv(s, id)).sort()).toEqual(["basket", "remaining"]);
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
