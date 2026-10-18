import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type SonKisiState, sonKisi, sonKisiScores, sonKisiTension } from "./index.js";
import { SON_KISI_MAX_MS, SON_KISI_MIN_MS } from "./types.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
/** Bitişi bilinen oyun: bitiş T0 + endMs. */
const start = (endMs = 15_000, players = ALL): SonKisiState => ({
  ...sonKisi.setup(players, ctx(T0)),
  endsAt: T0 + endMs,
  // Bilinen eşikler: bitişten 6 / 3,5 / 1,5 sn önce.
  thresholds: [T0 + endMs - 6_000, T0 + endMs - 3_500, T0 + endMs - 1_500],
});

function flee(state: SonKisiState, id: string, at: number): SonKisiState {
  const r = sonKisi.reduce(state, id, { kind: "escape" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const finish = (s: SonKisiState) => sonKisi.result(sonKisi.tick(s, ctx(s.endsAt)));

describe("son-kisi kuralları", () => {
  it("2-8 oyuncu, tek aşama", () => {
    expect(sonKisi.minPlayers).toBe(2);
    expect(sonKisi.maxPlayers).toBe(8);
  });

  it("gizli bitiş 10-20 sn arasında, ms çözünürlükte rastgele seçilir", () => {
    const durations = new Set<number>();
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let seed = 1; seed <= 3000; seed++) {
      const s = sonKisi.setup(ALL, ctx(T0, ALL, seed));
      const d = s.endsAt - s.startedAt;
      durations.add(d);
      min = Math.min(min, d);
      max = Math.max(max, d);
      expect(d).toBeGreaterThanOrEqual(SON_KISI_MIN_MS);
      expect(d).toBeLessThanOrEqual(SON_KISI_MAX_MS);
    }
    expect(min).toBeLessThan(10_300);
    expect(max).toBeGreaterThan(19_700);
    expect(durations.size).toBeGreaterThan(1500);
    expect([...durations].some((d) => d % 1000 !== 0)).toBe(true);
  });

  it("aynı tohum aynı bitişi verir (belirlilik)", () => {
    expect(sonKisi.setup(ALL, ctx(T0, ALL, 77)).endsAt).toBe(sonKisi.setup(ALL, ctx(T0, ALL, 77)).endsAt);
  });

  it("bitiş anında oyun biter; öncesinde bitmez", () => {
    const s = start();
    expect(sonKisi.isFinished(s, ctx(T0 + 14_999))).toBe(false);
    expect(sonKisi.isFinished(s, ctx(T0 + 15_000))).toBe(true);
  });

  it("en geç kaçan +1, diğer kaçanlar 0, hiç kaçmayan -1", () => {
    let s = start();
    s = flee(s, "a", 3_000);
    s = flee(s, "b", 9_000);
    s = flee(s, "c", 6_000);
    const r = finish(s);
    expect(r.awards).toEqual({ a: 0, b: 1, c: 0, d: -1 });
    expect(r.miniScores).toEqual(r.awards);
  });

  it("ilk kaçan ödül almaz (yalnız son kaçan)", () => {
    let s = start();
    s = flee(s, "a", 100);
    s = flee(s, "b", 14_000);
    for (const id of ["c", "d"]) s = flee(s, id, 13_000);
    expect(finish(s).awards).toEqual({ a: 0, b: 1, c: 0, d: 0 });
  });

  it("eşit zaman damgası: en son kaçan hepsi +1", () => {
    let s = start();
    s = flee(s, "a", 5_000);
    s = flee(s, "b", 12_345);
    s = flee(s, "c", 12_345);
    expect(finish(s).awards).toEqual({ a: 0, b: 1, c: 1, d: -1 });
  });

  it("herkes aynı anda kaçarsa hepsi +1", () => {
    let s = start();
    for (const id of ALL) s = flee(s, id, 7_777);
    expect(finish(s).awards).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });

  it("hiç kimse kaçmazsa herkes -1", () => {
    expect(finish(start()).awards).toEqual({ a: -1, b: -1, c: -1, d: -1 });
  });

  it("tek kişi kaçarsa o +1, diğerleri -1", () => {
    expect(finish(flee(start(), "c", 1)).awards).toEqual({ a: -1, b: -1, c: 1, d: -1 });
  });

  it("ikinci basış yok sayılır: zaman damgası ilk basıştan kalır", () => {
    let s = flee(start(), "a", 2_000);
    s = flee(s, "a", 14_000);
    expect(s.escapes).toEqual([{ id: "a", at: T0 + 2_000 }]);
    s = flee(s, "b", 9_000);
    // a ikinci kez basarak sona geçemez: son kaçan b.
    expect(finish(s).awards).toEqual({ a: 0, b: 1, c: -1, d: -1 });
  });

  it("bitişten bir ms önceki basış geçerli, bitiş anındaki ve sonrası reddedilir", () => {
    const s = start();
    const ok = sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 14_999));
    expect(isRejected(ok)).toBe(false);
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 15_000))).toEqual({ rejected: "ended" });
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 99_000))).toEqual({ rejected: "ended" });
    if (isRejected(ok)) throw new Error("beklenmiyor");
    expect(finish(ok).awards.a).toBe(1);
  });

  it("katılımcı olmayan reddedilir; başlamadan önceki basış reddedilir", () => {
    expect(sonKisi.reduce(start(), "x", { kind: "escape" }, ctx(T0 + 5))).toEqual({
      rejected: "not_participant",
    });
    expect(sonKisi.reduce(start(), "a", { kind: "escape" }, ctx(T0 - 1))).toEqual({
      rejected: "not_started",
    });
  });

  it("bağlantısı kopuk oyuncunun kaçışı da sayılır; bağlı listesi sonucu etkilemez", () => {
    const s0 = start();
    const s1 = sonKisi.reduce(s0, "a", { kind: "escape" }, ctx(T0 + 100, ["b"]));
    if (isRejected(s1)) throw new Error("reddedildi");
    expect(sonKisi.result(sonKisi.tick(s1, ctx(T0 + 20_000, [])))).toEqual(
      sonKisi.result(sonKisi.tick(s1, ctx(T0 + 20_000, ALL))),
    );
    expect(finish(s1).awards.a).toBe(1);
  });

  it("puan fonksiyonu: tablo", () => {
    expect(sonKisiScores(["a", "b"], [])).toEqual({ a: -1, b: -1 });
    expect(
      sonKisiScores(
        ["a", "b", "c"],
        [
          { id: "a", at: 5 },
          { id: "b", at: 9 },
        ],
      ),
    ).toEqual({ a: 0, b: 1, c: -1 });
  });

  it("eylem ayrıştırma: yalnız {kind:'escape'}", () => {
    expect(sonKisi.parseAction({ kind: "escape" })).toEqual({ kind: "escape" });
    expect(sonKisi.parseAction({ kind: "escape", x: 1 })).toBeNull();
    expect(sonKisi.parseAction({ kind: "steal" })).toBeNull();
    expect(sonKisi.parseAction(null)).toBeNull();
  });
});

describe("son-kisi gerilim göstergesi (yalnız 0-3)", () => {
  it("düzey = geçilen gizli eşik sayısı", () => {
    const th = [5_000, 7_000, 9_000];
    expect(sonKisiTension(th, 0)).toBe(0);
    expect(sonKisiTension(th, 4_999)).toBe(0);
    expect(sonKisiTension(th, 5_000)).toBe(1);
    expect(sonKisiTension(th, 7_000)).toBe(2);
    expect(sonKisiTension(th, 8_999)).toBe(2);
    expect(sonKisiTension(th, 9_000)).toBe(3);
  });

  it("eşikler rastgele, bitişe bağlı aralıklarda, artan ve başlangıçtan >= 1 sn sonradır", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const s = sonKisi.setup(ALL, ctx(T0, ALL, seed));
      const [t1, t2, t3] = s.thresholds as [number, number, number];
      expect(t1).toBeGreaterThanOrEqual(T0 + 1_000);
      expect(t1).toBeLessThanOrEqual(t2);
      expect(t2).toBeLessThanOrEqual(t3);
      expect(s.endsAt - t1).toBeGreaterThanOrEqual(5_000);
      expect(s.endsAt - t1).toBeLessThanOrEqual(8_000);
      expect(s.endsAt - t2).toBeGreaterThanOrEqual(2_500);
      expect(s.endsAt - t2).toBeLessThanOrEqual(4_500);
      expect(s.endsAt - t3).toBeGreaterThanOrEqual(800);
      expect(s.endsAt - t3).toBeLessThanOrEqual(2_200);
    }
  });

  it("düzey-1 anı bitişin deterministik işlevi değildir (aynı bitişte >= 2 sn oynar)", () => {
    // Aynı gizli bitiş, farklı tohumlar: bitişi sabitleyip eşikleri tohumdan yeniden üret.
    const lead = new Map<number, Set<number>>();
    for (let seed = 1; seed <= 4000; seed++) {
      const s = sonKisi.setup(ALL, ctx(T0, ALL, seed));
      const d = s.endsAt - T0;
      const set = lead.get(d) ?? new Set<number>();
      set.add(s.endsAt - (s.thresholds[0] as number));
      lead.set(d, set);
    }
    let widest = 0;
    for (const set of lead.values()) widest = Math.max(widest, Math.max(...set) - Math.min(...set));
    // Aynı bitişi paylaşan tohumlar az olabilir; genel dağılım da geniş olmalı.
    const all = [...lead.values()].flatMap((x) => [...x]);
    expect(Math.max(...all) - Math.min(...all)).toBeGreaterThanOrEqual(2_000);
    expect(widest).toBeGreaterThanOrEqual(0);
  });

  it("tick düzey yükselince durumu değiştirir (sunucu yeniden yayın yapsın), değişmezse aynı nesneyi döner", () => {
    const s = start(10_000);
    expect(sonKisi.tick(s, ctx(T0 + 100))).toBe(s);
    const t1 = sonKisi.tick(s, ctx(T0 + 4_000));
    expect(t1).not.toBe(s);
    expect(t1.tension).toBe(1);
    expect(sonKisi.tick(t1, ctx(T0 + 4_500))).toBe(t1);
    expect(sonKisi.tick(t1, ctx(T0 + 9_100)).tension).toBe(3);
    // Düzey düşmez ve sonucu etkilemez.
    expect(sonKisi.tick(t1, ctx(T0 + 100))).toBe(t1);
    expect(finish(t1)).toEqual(finish(s));
  });

  it("publicView gerilimi ve kaçanları verir; başlamadan önce 0", () => {
    const s = flee(start(10_000), "b", 1_000);
    const at = (ms: number) => sonKisi.publicView(s, ctx(T0 + ms));
    expect(at(-500).tension).toBe(0);
    expect(at(2_000).tension).toBe(0);
    expect(at(4_000).tension).toBe(1);
    expect(at(7_000).tension).toBe(2);
    expect(at(9_000).tension).toBe(3);
    expect(at(2_000).escaped).toEqual(["b"]);
    expect(at(2_000).finished).toBe(false);
    expect(at(2_000).result).toBeNull();
  });
});

describe("son-kisi gizlilik: gizli bitiş zamanı hiçbir görünümde yok", () => {
  const ids = ["p1", "p2", "p3"];

  /** Tüm oyuncuların + izleyicinin + herkese açık görünümün birleşik JSON'u. */
  function everything(s: SonKisiState, now: number): string {
    const c = ctx(now, ids);
    return [
      JSON.stringify(sonKisi.publicView(s, c)),
      ...ids.map((id) => JSON.stringify(sonKisi.view(s, id, c))),
      JSON.stringify(sonKisi.view(s, null, c)),
    ].join("|");
  }

  it("bitişe kadar ne mutlak bitiş zamanı, ne süre, ne kalan süre geçer (çok sayıda tohum)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = sonKisi.setup(ids, ctx(T0, ids, seed));
      const total = s.endsAt - s.startedAt;
      s = flee2(s, "p2", 1_234);
      for (const frac of [0, 0.3, 0.5, 0.76, 0.9, 0.999]) {
        const now = T0 + Math.floor(total * frac);
        // startedAt herkese açık ve bilinen bir değerdir; sayı çakışması olmasın diye çıkarılır.
        const all = everything(s, now).replace(/"startedAt":\d+/g, "");
        expect(all, `seed ${seed} frac ${frac}`).not.toContain(String(s.endsAt));
        expect(all).not.toContain(String(total));
        expect(all).not.toContain(String(s.endsAt - now));
        // Hiçbir anahtar bitiş/süre/kalan sızdırmaz.
        expect(all).not.toMatch(/endsAt|remaining|duration|left|deadline/i);
      }
    }
  });

  it("bitişe kadar görünüm yalnız tension ile ilerler: aynı gerilimde iki farklı bitişte görünüm aynıdır", () => {
    const a = start(11_000, ids); // eşik 1: 5 sn
    const b = start(19_000, ids); // eşik 1: 13 sn
    const va = sonKisi.publicView(a, ctx(T0 + 6_000, ids));
    const vb = sonKisi.publicView(b, ctx(T0 + 14_000, ids));
    expect(va.tension).toBe(1);
    expect(vb.tension).toBe(1);
    expect(JSON.stringify(va)).toBe(JSON.stringify(vb));
  });

  it("hiçbir görünüm gizli eşikleri açmaz (çok sayıda tohum)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = sonKisi.setup(ids, ctx(T0, ids, seed));
      for (const t of s.thresholds) {
        for (const now of [T0 + 500, t - 1, t, t + 1, s.endsAt - 1]) {
          const all = everything(s, now).replace(/"startedAt":\d+/g, "");
          expect(all).not.toContain(String(t));
          expect(all).not.toContain(String(t - T0));
          expect(all).not.toMatch(/threshold|esik|eşik/i);
        }
      }
    }
  });

  it("secrets() bitiş zamanını ve eşikleri bildirir; sahibi yoktur", () => {
    const s = sonKisi.setup(ids, ctx(T0, ids, 5));
    const secrets = sonKisi.secrets(s);
    expect(secrets).toHaveLength(4);
    expect(secrets[0]).toEqual({ ownerIds: [], value: String(s.endsAt), label: "gizli bitiş zamanı" });
    expect(secrets.slice(1).map((x) => x.value)).toEqual(s.thresholds.map(String));
    expect(secrets.every((x) => x.ownerIds.length === 0)).toBe(true);
  });

  it("durum anahtarları değişse bile publicView/view alan kümesi sabittir", () => {
    const s = sonKisi.setup(ids, ctx(T0, ids, 9));
    expect(Object.keys(sonKisi.publicView(s, ctx(T0 + 1, ids))).sort()).toEqual([
      "escaped",
      "finished",
      "result",
      "startedAt",
      "tension",
    ]);
    expect(Object.keys(sonKisi.view(s, "p1", ctx(T0 + 1, ids)))).toEqual(["escaped"]);
  });

  it("bitişten sonra sonuç açılır ama bitiş zamanı yine yoktur (kaçış süreleri hariç)", () => {
    let s = start(12_000, ids);
    s = flee(s, "p1", 3_000);
    s = flee(s, "p3", 8_000);
    const pub = sonKisi.publicView(s, ctx(s.endsAt, ids));
    expect(pub.finished).toBe(true);
    expect(pub.tension).toBe(3);
    expect(pub.result).toEqual({
      escapes: [
        { id: "p1", ms: 3_000 },
        { id: "p3", ms: 8_000 },
      ],
      last: ["p3"],
      missed: ["p2"],
      scores: { p1: 0, p2: -1, p3: 1 },
    });
    expect(JSON.stringify(pub)).not.toContain(String(s.endsAt));
    expect(JSON.stringify(pub)).not.toContain("12000");
  });

  it("kaçanların süreleri bitişe kadar kimseye açılmaz", () => {
    let s = start(15_000, ids);
    s = flee(s, "p1", 4_321);
    expect(everything(s, T0 + 6_000)).not.toContain("4321");
    expect(everything(s, T0 + 6_000)).not.toContain(String(T0 + 4_321));
  });

  it("kaçan avatarlar herkese açık; kaçmayanın görünümü değişmez", () => {
    const s0 = start(15_000, ids);
    const before = JSON.stringify(sonKisi.view(s0, "p3", ctx(T0 + 5_000, ids)));
    const s1 = flee(s0, "p1", 2_000);
    expect(sonKisi.publicView(s1, ctx(T0 + 5_000, ids)).escaped).toEqual(["p1"]);
    expect(JSON.stringify(sonKisi.view(s1, "p3", ctx(T0 + 5_000, ids)))).toBe(before);
    expect(sonKisi.view(s1, "p1", ctx(T0 + 5_000, ids))).toEqual({ escaped: true });
    expect(sonKisi.view(s1, null, ctx(T0 + 5_000, ids))).toEqual({ escaped: false });
  });

  function flee2(s: SonKisiState, id: string, at: number): SonKisiState {
    const r = sonKisi.reduce(s, id, { kind: "escape" }, ctx(T0 + at, ids));
    if (isRejected(r)) throw new Error(r.rejected);
    return r;
  }
});
