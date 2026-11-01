import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type CizgiState, cizgiAwards, cizgiRadarZones, cizgiScore, cizgiyiGecme as g } from "./index.js";
import {
  CIZGI_CHOOSE_MS,
  CIZGI_DURATION_MS,
  CIZGI_MAX,
  CIZGI_RADAR_MS,
  CIZGI_REVEAL_MS,
  CIZGI_ROUND_REVEAL_MS,
  CIZGI_ROUNDS,
  CIZGI_ZONE_WIDTH,
  cizgiPeakZone,
  cizgiZone,
  cizgiZoneRange,
  cizgiZoneWidth,
} from "./types.js";

const T0 = 1_000_000;
/** 2. turun başlangıcı (erken bitiş yoksa). */
const R2 = CIZGI_CHOOSE_MS + CIZGI_ROUND_REVEAL_MS;
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
const revealAt = (s: CizgiState, at: number) => {
  const r = g.publicView(s, ctx(T0 + at)).reveal;
  if (!r) throw new Error("sonuç açılmadı");
  return r;
};
/** Tek tur oynatır (1. tur); `values[i]` null ise oyuncu seçmez. */
function play(values: (number | null)[]) {
  let s = start(values.length);
  values.forEach((v, i) => {
    if (v !== null) s = choose(s, `p${i + 1}`, v);
  });
  return { s, r: revealAt(s, CIZGI_CHOOSE_MS) };
}
/** İki tur oynatır. */
function playBoth(first: (number | null)[], second: (number | null)[]) {
  let s = start(first.length);
  first.forEach((v, i) => {
    if (v !== null) s = choose(s, `p${i + 1}`, v, 1_000);
  });
  second.forEach((v, i) => {
    if (v !== null) s = choose(s, `p${i + 1}`, v, R2 + 1_000);
  });
  return { s, res: g.result(s), pub: g.publicView(s, ctx(T0 + R2 + CIZGI_CHOOSE_MS)) };
}

describe("cizgiyi-gecme kuralları", () => {
  it("katılım 2–8, dikey, anlatım ≤ 3 madde", () => {
    expect([g.minPlayers, g.maxPlayers, g.orientation]).toEqual([2, 8, "portrait"]);
    expect(g.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("CZ-M1: iki tur; her tur 30 sn seçim (CZ-M2 reddedildi), 5 sn ara açılış, 7 sn son açılış: 72 sn", () => {
    const s = start();
    expect(CIZGI_ROUNDS).toBe(2);
    expect(CIZGI_CHOOSE_MS).toBe(30_000);
    expect([CIZGI_ROUND_REVEAL_MS, CIZGI_REVEAL_MS]).toEqual([5_000, 7_000]);
    expect(CIZGI_DURATION_MS).toBe(72_000);
    expect(s.rounds.map((r) => [r.startAt - T0, r.endsAt - T0, r.revealEndsAt - T0])).toEqual([
      [0, 30_000, 35_000],
      [35_000, 65_000, 72_000],
    ]);
    expect(g.isFinished(s, ctx(T0 + 35_000))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + CIZGI_DURATION_MS - 1))).toBe(false);
    expect(g.isFinished(s, ctx(T0 + CIZGI_DURATION_MS))).toBe(true);
    expect(g.revealAt?.(s, ctx(T0))).toBe(T0 + 65_000);
  });

  it("görünüm turu izler: 1. tur, ara açılış, 2. tur, son açılış", () => {
    const s = choose(start(), "p1", 40);
    const at = (ms: number) => g.publicView(s, ctx(T0 + ms));
    expect([at(0).round, at(0).rounds, at(0).reveal]).toEqual([1, 2, null]);
    expect(at(30_000).round).toBe(1);
    expect(at(30_000).reveal?.choices.p1).toBe(40);
    expect(at(30_000).final).toBeNull();
    expect(at(35_000).round).toBe(2);
    expect(at(35_000).reveal).toBeNull();
    expect(at(35_000).history).toHaveLength(1);
    expect(at(35_000).roundStartedAt).toBe(T0 + 35_000);
    expect(at(65_000).final).not.toBeNull();
  });

  it("seçim her turun başında boşalır; ara açılışta seçim reddedilir", () => {
    let s = choose(start(), "p1", 40);
    expect(g.view(s, "p1", ctx(T0 + 31_000))).toEqual({ myChoice: 40, locked: false });
    expect(reject(s, "p1", 50, 31_000)).toEqual({ rejected: "ended" });
    expect(g.view(s, "p1", ctx(T0 + R2))).toEqual({ myChoice: null, locked: false });
    s = choose(s, "p1", 70, R2 + 100);
    expect(g.view(s, "p1", ctx(T0 + R2 + 200)).myChoice).toBe(70);
    // 1. turun sonucu değişmez.
    expect(revealAt(s, R2 + 200 + CIZGI_CHOOSE_MS).choices.p1).toBe(70);
    expect(g.publicView(s, ctx(T0 + R2 + 200)).history[0]?.choices.p1).toBe(40);
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

  it("bölge = ⌊sayı ÷ genişlik⌋; 4 oyuncuda onluk bölgeler, 100 Zirve", () => {
    expect([0, 9, 10, 19, 20, 89, 90, 99, 100].map((v) => cizgiZone(v, 10))).toEqual([
      0, 0, 1, 1, 2, 8, 9, 9, 10,
    ]);
    expect(play([99, 100, null, null]).r.status).toMatchObject({ p1: "second", p2: "first" });
    expect(play([90, 99, null, null]).r.status).toMatchObject({ p1: "crashed", p2: "crashed" });
    expect(play([9, 10, null, null]).r.points).toMatchObject({ p1: 1, p2: 2 });
  });

  it("CZ-M4: 100 her oyuncu sayısında ayrı, tek sayılık Zirve; altındaki son platform kısa kalabilir", () => {
    for (let n = 2; n <= 8; n++) {
      const w = cizgiZoneWidth(n);
      const peak = cizgiPeakZone(w);
      expect(cizgiZone(100, w)).toBe(peak);
      expect(cizgiZone(99, w)).toBe(peak - 1);
      expect(cizgiZoneRange(peak, w)).toEqual({ from: 100, to: 100 });
      expect(cizgiZoneRange(peak - 1, w).to).toBe(99);
    }
    // Değişen yalnız 3, 5, 6 kişi: son platform 98–99, 98–99, 96–99.
    expect(cizgiZoneRange(cizgiPeakZone(14) - 1, 14)).toEqual({ from: 98, to: 99 });
    expect(cizgiZoneRange(cizgiPeakZone(7) - 1, 7)).toEqual({ from: 98, to: 99 });
    expect(cizgiZoneRange(cizgiPeakZone(6) - 1, 6)).toEqual({ from: 96, to: 99 });
    // 2, 4, 7, 8 kişide platform sayısı aynı kalır.
    expect([25, 10, 5, 4].map(cizgiPeakZone)).toEqual([4, 10, 20, 25]);
    // 3 kişi (14): 98 ve 100 artık çarpışmaz; 100 tek kalan en yüksek → +2.
    expect(play([98, 100, 5]).r.status).toEqual({ p1: "second", p2: "first", p3: "safe" });
    // 6 kişi (6): 96 ve 99 aynı platform, 100 ayrı.
    expect(play([96, 99, 100, null, null, null]).r.status).toMatchObject({
      p1: "crashed",
      p2: "crashed",
      p3: "first",
    });
    // Zirvede iki kişi: çarpışır.
    expect(play([100, 100, 50]).r.status).toEqual({ p1: "crashed", p2: "crashed", p3: "first" });
  });

  it("O12 tablosu: oyuncu sayısı → bölge genişliği (2–8)", () => {
    const table = [2, 3, 4, 5, 6, 7, 8].map((n) => [n, cizgiZoneWidth(n)]);
    expect(table).toEqual([
      [2, 25],
      [3, 14],
      [4, 10],
      [5, 7],
      [6, 6],
      [7, 5],
      [8, 4],
    ]);
    expect(CIZGI_ZONE_WIDTH).toEqual({ 2: 25, 3: 14, 4: 10, 5: 7, 6: 6, 7: 5, 8: 4 });
    expect([cizgiZoneWidth(1), cizgiZoneWidth(9)]).toEqual([25, 4]);
  });

  it("O12 denge (Zirve ile): düzgün seçimde aynı bölgeye düşme olasılığı her oyuncu sayısında ≈ %25", () => {
    const probs: Record<number, number> = {};
    for (let n = 2; n <= 8; n++) {
      const w = cizgiZoneWidth(n);
      const sizes = new Map<number, number>();
      for (let v = 0; v <= CIZGI_MAX; v++) sizes.set(cizgiZone(v, w), (sizes.get(cizgiZone(v, w)) ?? 0) + 1);
      let q = 0; // iki bağımsız seçimin aynı bölgede olma olasılığı
      for (const size of sizes.values()) q += (size / (CIZGI_MAX + 1)) ** 2;
      const collide = 1 - (1 - q) ** (n - 1);
      probs[n] = Math.round(collide * 1000) / 10;
      expect(collide).toBeGreaterThan(0.24);
      expect(collide).toBeLessThan(0.27);
    }
    // CZ-M4 ile: 3 → %25,2, 5 → %24,5, 6 → %25,9 (öneri dosyasındaki yaklaşık değerler %25,1 / %24,4 / %25,8).
    expect([probs[3], probs[5], probs[6]]).toEqual([25.2, 24.5, 25.9]);
  });

  it("O12: bölge aralıkları ve oyuncu sayısına göre çarpışma", () => {
    expect(cizgiZoneRange(0, 25)).toEqual({ from: 0, to: 24 });
    expect(cizgiZoneRange(3, 25)).toEqual({ from: 75, to: 99 });
    expect(cizgiZoneRange(4, 25)).toEqual({ from: 100, to: 100 });
    expect(play([60, 74]).r.status).toEqual({ p1: "crashed", p2: "crashed" });
    expect(play([74, 75]).r.status).toEqual({ p1: "second", p2: "first" });
    const eight = (a: number, b: number) => play([a, b, null, null, null, null, null, null]).r;
    expect(eight(60, 63).status).toMatchObject({ p1: "crashed", p2: "crashed" });
    expect(eight(63, 64).status).toMatchObject({ p1: "second", p2: "first" });
  });

  it("tur puanı: tek kalanlar arasında en yüksek +2, ikinci +1, diğerleri 0", () => {
    const { r } = play([15, 95, 47, 72]);
    expect(r.points).toEqual({ p1: 0, p2: 2, p3: 0, p4: 1 });
    expect(r.status).toEqual({ p1: "safe", p2: "first", p3: "safe", p4: "second" });
  });

  it("aynı bölgedekilerin hiçbiri puan almaz; ceza yoktur", () => {
    const { r } = play([95, 91, 60, 30]);
    expect(r.status).toEqual({ p1: "crashed", p2: "crashed", p3: "first", p4: "second" });
    expect(r.points).toEqual({ p1: 0, p2: 0, p3: 2, p4: 1 });
    expect(play([77, 77, 12]).r.points).toEqual({ p1: 0, p2: 0, p3: 2 });
    expect(play([31, 32, 39, 80]).r.status).toEqual({
      p1: "crashed",
      p2: "crashed",
      p3: "crashed",
      p4: "first",
    });
    expect(play([50, 55, 80, 85]).r.points).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    expect(play([50, 55, 80]).r.points).toEqual({ p1: 0, p2: 0, p3: 2 });
  });

  it("seçmeyen pasiftir: bölge değerlendirmesine girmez ve puan almaz; 0 seçmiş sayılmaz", () => {
    const { r } = play([null, 40, null, 10]);
    expect(r.status).toEqual({ p1: "none", p2: "first", p3: "none", p4: "second" });
    expect(r.choices).toEqual({ p1: null, p2: 40, p3: null, p4: 10 });
    expect(play([null, null, null]).r.points).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(play([null, null, 5]).r.status.p3).toBe("first");
  });

  it("cizgiScore saftır: aynı girdi aynı sonucu verir (istemcinin 'ne olurdu?' hesabı)", () => {
    const a = cizgiScore(["x", "y", "z"], { x: 92, y: 94, z: null }, 7);
    expect(a.status).toEqual({ x: "crashed", y: "crashed", z: "none" });
    expect(cizgiScore(["x", "y", "z"], { x: 84, y: 94, z: null }, 7).points).toEqual({ x: 1, y: 2, z: 0 });
  });

  it("CZ-M1 genel skor: iki turun toplamı, rankAwards (+2 / +1; liderler eşitse hepsi +1)", () => {
    // 1. tur: p2 +2, p4 +1 · 2. tur: p2 +2, p1 +1 → toplam p2 4, p1 1, p4 1.
    const a = playBoth([15, 95, 47, 72], [60, 90, 20, null]);
    expect(a.res.miniScores).toEqual({ p1: 1, p2: 4, p3: 0, p4: 1 });
    expect(a.res.awards).toEqual({ p1: 1, p2: 2, p3: 0, p4: 1 });
    expect(a.pub.final).toEqual(a.res.awards);
    expect(a.pub.totals).toEqual(a.res.miniScores);
    // 2 kişide örnek: A +2/B +1, sonra B +2/A +1 → 3–3 → ikisi de +1.
    const b = playBoth([80, 30], [30, 80]);
    expect(b.res.miniScores).toEqual({ p1: 3, p2: 3 });
    expect(b.res.awards).toEqual({ p1: 1, p2: 1 });
    // Kimse puan almazsa kimse genel skor almaz; eksi yok.
    const c = playBoth([50, 51], [70, 71]);
    expect(c.res.awards).toEqual({ p1: 0, p2: 0 });
    expect(cizgiAwards({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
    for (const v of Object.values(a.res.awards)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("toplamlar: ara açılışta 1. tur dahil, 2. tur seçimi sırasında yalnız 1. tur", () => {
    const { s } = playBoth([15, 95, 47, 72], [60, 90, 20, null]);
    expect(g.publicView(s, ctx(T0 + 10_000)).totals).toEqual({ p1: 0, p2: 0, p3: 0, p4: 0 });
    expect(g.publicView(s, ctx(T0 + 30_000)).totals).toEqual({ p1: 0, p2: 2, p3: 0, p4: 1 });
    expect(g.publicView(s, ctx(T0 + R2 + 10_000)).totals).toEqual({ p1: 0, p2: 2, p3: 0, p4: 1 });
  });

  it("seçim süre bitene kadar değiştirilebilir; son seçim geçerli", () => {
    let s = start(3);
    s = choose(s, "p1", 55, 1_000);
    s = choose(s, "p2", 58, 2_000);
    s = choose(s, "p2", 80, 29_999);
    expect(g.view(s, "p2", ctx(T0 + 29_999))).toEqual({ myChoice: 80, locked: false });
    expect(revealAt(s, CIZGI_CHOOSE_MS).status).toMatchObject({ p1: "second", p2: "first" });
  });

  it("süre dolunca seçim reddedilir; oyun bitince de", () => {
    const s = choose(start(3), "p1", 10);
    expect(reject(s, "p2", 50, CIZGI_CHOOSE_MS)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 50, CIZGI_DURATION_MS)).toEqual({ rejected: "ended" });
    expect(reject(s, "p2", 50, CIZGI_DURATION_MS + 1_000)).toEqual({ rejected: "ended" });
    expect(isRejected(reject(s, "p2", 50, CIZGI_CHOOSE_MS - 1))).toBe(false);
    expect(reject(start(3), "ghost", 5, 100)).toEqual({ rejected: "not_participant" });
  });

  it("tick süre dolunca durum değiştirir, aynı anda tekrar çağrılınca aynı nesneyi döner", () => {
    const s = start(2);
    expect(g.tick(s, ctx(T0 + 5_000))).toBe(s);
    const t = g.tick(s, ctx(T0 + CIZGI_CHOOSE_MS));
    expect(t).not.toBe(s);
    expect(g.tick(t, ctx(T0 + CIZGI_CHOOSE_MS + 100))).toBe(t);
    const u = g.tick(t, ctx(T0 + R2));
    expect(u.shown).toBe(1);
  });

  it("aynı değeri tekrar göndermek durumu değiştirmez", () => {
    const s = choose(start(), "p1", 40);
    expect(g.reduce(s, "p1", { kind: "choose", value: 40 }, ctx(T0 + 2_000))).toBe(s);
  });
});

describe("cizgiyi-gecme kalabalık radarı (CZ-M3)", () => {
  it("turun 15. saniyesinde o an 2+ pin bulunan platformlar; sonra güncellenmez", () => {
    let s = start(5); // genişlik 7
    s = choose(s, "p1", 95, 1_000);
    s = choose(s, "p2", 92, 2_000); // 91–97: yanar
    s = choose(s, "p3", 40, 3_000);
    s = choose(s, "p4", 41, 4_000); // 35–41: yanar
    s = choose(s, "p5", 100, 5_000); // Zirve tek
    expect(g.publicView(s, ctx(T0 + CIZGI_RADAR_MS - 1)).radar).toBeNull();
    expect(g.publicView(s, ctx(T0)).radarAt).toBe(T0 + CIZGI_RADAR_MS);
    const pub = g.publicView(s, ctx(T0 + CIZGI_RADAR_MS));
    expect(pub.radar).toEqual({ at: T0 + CIZGI_RADAR_MS, zones: [5, 13] });
    // Radardan sonra kaçan: fotoğraf değişmez.
    s = choose(s, "p1", 60, CIZGI_RADAR_MS + 500);
    expect(g.publicView(s, ctx(T0 + 20_000)).radar?.zones).toEqual([5, 13]);
    // Sonuç radardan bağımsız, son seçimlerle.
    expect(revealAt(s, CIZGI_CHOOSE_MS).status.p2).toBe("second");
  });

  it("radar anı geldikten sonra gelen seçim fotoğrafa girmez (aynı ms dahil)", () => {
    let s = start(3);
    s = choose(s, "p1", 50, 1_000);
    s = choose(s, "p2", 51, CIZGI_RADAR_MS);
    expect(g.publicView(s, ctx(T0 + CIZGI_RADAR_MS + 1)).radar?.zones).toEqual([]);
  });

  it("kilitli ya da değil gönderilmiş her seçim sayılır; seçmeyen girmez", () => {
    let s = start(4);
    s = choose(s, "p1", 70, 1_000);
    s = g.reduce(s, "p1", { kind: "lock" }, ctx(T0 + 1_500)) as CizgiState;
    s = choose(s, "p2", 75, 2_000);
    expect(g.publicView(s, ctx(T0 + CIZGI_RADAR_MS)).radar?.zones).toEqual([7]);
    expect(cizgiRadarZones({}, 10)).toEqual([]);
  });

  it("her tur ayrı radar; 2. turun radarı 2. turun seçimleriyle", () => {
    let s = start(3);
    s = choose(s, "p1", 50, 1_000);
    s = choose(s, "p2", 51, 1_000);
    s = choose(s, "p1", 10, R2 + 1_000);
    s = choose(s, "p2", 90, R2 + 1_000);
    expect(g.publicView(s, ctx(T0 + R2)).radar).toBeNull();
    expect(g.publicView(s, ctx(T0 + R2 + CIZGI_RADAR_MS)).radar).toEqual({
      at: T0 + R2 + CIZGI_RADAR_MS,
      zones: [],
    });
  });

  it("2 kişide radar yoktur", () => {
    let s = start(2);
    s = choose(s, "p1", 95, 1_000);
    s = choose(s, "p2", 96, 1_000);
    const pub = g.publicView(s, ctx(T0 + 20_000));
    expect(pub.radarAt).toBeNull();
    expect(pub.radar).toBeNull();
  });

  it("herkes radar anından önce kilitlerse radar çıkmaz", () => {
    let s = start(3);
    for (const id of ids(3)) s = choose(s, id, 90, 1_000);
    for (const id of ids(3)) s = g.reduce(s, id, { kind: "lock" }, ctx(T0 + 14_500, ids(3))) as CizgiState;
    expect(s.rounds[0]?.endsAt).toBe(T0 + 15_500);
    expect(g.publicView(s, ctx(T0 + 15_200)).radar).toBeNull();
    expect(g.publicView(s, ctx(T0 + 15_600)).radar).toBeNull();
  });

  it("nextWake radar anını ve tur sınırlarını verir", () => {
    const s = start(3);
    expect(g.nextWake?.(s, ctx(T0))).toBe(T0 + CIZGI_RADAR_MS);
    expect(g.nextWake?.(s, ctx(T0 + CIZGI_RADAR_MS))).toBe(T0 + CIZGI_CHOOSE_MS);
    expect(g.nextWake?.(start(2), ctx(T0))).toBe(T0 + CIZGI_CHOOSE_MS);
  });

  it("tick radar anında durum değiştirir (yayın için)", () => {
    const s = choose(choose(start(3), "p1", 10), "p2", 11);
    const t = g.tick(s, ctx(T0 + CIZGI_RADAR_MS));
    expect(t).not.toBe(s);
    expect(t.rounds[0]?.radar?.zones).toEqual([0]);
    expect(g.tick(t, ctx(T0 + CIZGI_RADAR_MS + 50))).toBe(t);
  });
});

describe("cizgiyi-gecme gizlilik (yapısal)", () => {
  const keys = (v: unknown): string[] => {
    if (typeof v !== "object" || v === null) return [];
    return Object.entries(v).flatMap(([k, x]) => [k, ...keys(x)]);
  };

  it("secrets() boştur (gerekçe: değerler kısa sayılar)", () => {
    expect(g.secrets(start())).toEqual([]);
  });

  it("tur açılmadan publicView seçim, durum ya da oyuncu kimliği taşımaz; radar yalnız platform numaraları", () => {
    let s = start(5);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 76);
    s = choose(s, "p3", 91);
    for (const at of [0, 1, 15_000, 29_999]) {
      const pub = g.publicView(s, ctx(T0 + at));
      expect(pub.reveal).toBeNull();
      expect(pub.final).toBeNull();
      expect(pub.history).toEqual([]);
      expect(Object.keys(pub).sort()).toEqual([
        "endsAt",
        "final",
        "history",
        "lockedIds",
        "radar",
        "radarAt",
        "reveal",
        "revealEndsAt",
        "round",
        "roundStartedAt",
        "rounds",
        "startedAt",
        "totals",
        "zoneWidth",
      ]);
      for (const k of ["choices", "status", "points"]) expect(keys(pub)).not.toContain(k);
      // Kimlikler yalnız toplam tablosunun anahtarlarında (hepsi 0) bulunur.
      expect(Object.values(pub.totals).every((v) => v === 0)).toBe(true);
      if (pub.radar) expect(Object.keys(pub.radar).sort()).toEqual(["at", "zones"]);
    }
  });

  it("view yalnız sahibinin seçimini taşır; diğerleri ve izleyici başkasınınkini göremez", () => {
    let s = start(5);
    s = choose(s, "p1", 77);
    s = choose(s, "p2", 71);
    for (const at of [0, 5_000, 29_999, 30_000, 34_000]) {
      expect(g.view(s, "p1", ctx(T0 + at))).toEqual({ myChoice: 77, locked: false });
      expect(g.view(s, "p2", ctx(T0 + at))).toEqual({ myChoice: 71, locked: false });
      expect(g.view(s, "p3", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, null, ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
      expect(g.view(s, "ghost", ctx(T0 + at))).toEqual({ myChoice: null, locked: false });
    }
  });

  it("2. turda 2. turun seçimleri, 2. tur açılana kadar gizli", () => {
    let s = start(3);
    s = choose(s, "p1", 10, 1_000);
    s = choose(s, "p1", 88, R2 + 1_000);
    const pub = g.publicView(s, ctx(T0 + R2 + 5_000));
    expect(JSON.stringify(pub)).not.toContain("88");
    expect(pub.history[0]?.choices.p1).toBe(10);
  });
});

describe("cizgiyi-gecme erken bitiş (tur başına)", () => {
  const lock = (state: CizgiState, id: string, at: number, connected: readonly string[] = ids(8)) =>
    g.reduce(state, id, { kind: "lock" }, ctx(T0 + at, connected));
  const lockOk = (state: CizgiState, id: string, at: number, connected?: readonly string[]) => {
    const r = lock(state, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const chosen = (n = 3, at = 1_000): CizgiState => {
    let s = start(n);
    for (const [i, id] of ids(n).entries()) s = choose(s, id, 20 * (i + 1), at);
    return s;
  };

  it("(a) herkes kilitleyince tur 1 sn sonra biter; sonraki tur o kadar öne çekilir", () => {
    let s = chosen();
    for (const id of ids(3)) s = lockOk(s, id, 4_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + 5_000);
    expect(s.rounds[0]?.revealEndsAt).toBe(T0 + 10_000);
    expect(s.rounds[1]?.startAt).toBe(T0 + 10_000);
    expect(s.rounds[1]?.endsAt).toBe(T0 + 40_000);
    expect(s.rounds[1]?.revealEndsAt).toBe(T0 + 47_000);
    expect(g.publicView(s, ctx(T0 + 4_999)).reveal).toBeNull();
    expect(g.publicView(s, ctx(T0 + 5_000)).reveal?.status).toEqual({
      p1: "safe",
      p2: "second",
      p3: "first",
    });
    expect(g.publicView(s, ctx(T0 + 10_000)).round).toBe(2);
    expect(g.isFinished(s, ctx(T0 + 47_000))).toBe(true);
  });

  it("(b) 2. turda da erken bitiş; oyun sonu öne gelir", () => {
    let s = chosen();
    for (const [i, id] of ids(3).entries()) s = choose(s, id, 30 * i, R2 + 1_000);
    for (const id of ids(3)) s = lockOk(s, id, R2 + 2_000);
    expect(s.rounds[1]?.endsAt).toBe(T0 + R2 + 3_000);
    expect(g.isFinished(s, ctx(T0 + R2 + 3_000 + CIZGI_REVEAL_MS))).toBe(true);
  });

  it("(c) bir kişi eksikken bitmez; kopan oyuncu beklenmez", () => {
    const s = lockOk(lockOk(chosen(), "p1", 2_000), "p2", 3_000);
    expect(s.rounds[0]?.endsAt).toBe(T0 + CIZGI_CHOOSE_MS);
    const online = ["p1", "p2"];
    let t = choose(choose(start(3), "p1", 10), "p2", 50);
    t = lockOk(t, "p1", 2_000, online);
    t = lockOk(t, "p2", 3_000, online);
    expect(t.rounds[0]?.endsAt).toBe(T0 + 4_000);
  });

  it("(d) kilit sonrası değişiklik ve ikinci kilit reddedilir; seçimsiz kilitlenemez; kilit tur başında açılır", () => {
    const s = lockOk(chosen(), "p1", 2_000);
    expect(reject(s, "p1", 99, 2_500)).toEqual({ rejected: "locked" });
    expect(lock(s, "p1", 2_500)).toEqual({ rejected: "locked" });
    expect(g.view(s, "p1", ctx(T0 + 2_500))).toEqual({ myChoice: 20, locked: true });
    expect(lock(start(3), "p1", 1_000)).toEqual({ rejected: "nothing_to_lock" });
    expect(g.view(s, "p1", ctx(T0 + R2))).toEqual({ myChoice: null, locked: false });
    expect(lock(s, "p1", R2 + 100)).toEqual({ rejected: "nothing_to_lock" });
    expect(isRejected(reject(s, "p1", 5, R2 + 100))).toBe(false);
  });

  it("(e) kilit listesi seçimleri sızdırmaz ve tur başına sıfırlanır", () => {
    const s = lockOk(chosen(), "p2", 2_000);
    const pub = g.publicView(s, ctx(T0 + 2_500));
    expect(pub.lockedIds).toEqual(["p2"]);
    expect(JSON.stringify(pub)).not.toContain("choices");
    expect(g.publicView(s, ctx(T0 + R2)).lockedIds).toEqual([]);
  });

  it("parseAction lock yalnız kind ile kabul edilir", () => {
    expect(g.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(g.parseAction({ kind: "lock", value: 3 })).toBeNull();
  });
});
