import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/invariants.js";
import {
  type SonKisiRoundState,
  type SonKisiState,
  sonKisi,
  sonKisiPhaseAt,
  sonKisiRoundPoints,
  sonKisiStandings,
  sonKisiTension,
} from "./index.js";
import {
  SON_KISI_GAP_MS,
  SON_KISI_MAX_MS,
  SON_KISI_MIN_MS,
  SON_KISI_REVEAL_MS,
  SON_KISI_ROUNDS,
} from "./types.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});

/** Bilinen takvim: her tur `alarms[i]` ms'de çalar; eşikler alarmdan 6 / 3,5 / 1,5 sn önce. */
function start(alarms: readonly number[] = [12_000, 10_000, 14_000], players = ALL): SonKisiState {
  const base = sonKisi.setup(players, ctx(T0));
  const rounds: SonKisiRoundState[] = [];
  let at = T0;
  for (const ms of alarms) {
    const alarmAt = at + ms;
    rounds.push({
      startAt: at,
      alarmAt,
      endsAt: alarmAt,
      thresholds: [alarmAt - 6_000, alarmAt - 3_500, alarmAt - 1_500],
      escapes: [],
    });
    at = alarmAt + SON_KISI_GAP_MS;
  }
  const last = rounds[rounds.length - 1] as SonKisiRoundState;
  return { ...base, rounds, revealEndsAt: last.endsAt + SON_KISI_REVEAL_MS };
}

const roundOf = (s: SonKisiState, i: number) => s.rounds[i] as SonKisiRoundState;

/** Tur `i`nin başından `ms` sonra kaç. */
function flee(s: SonKisiState, id: string, i: number, ms: number, players = ALL): SonKisiState {
  const r = sonKisi.reduce(s, id, { kind: "escape" }, ctx(roundOf(s, i).startAt + ms, players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const pubAt = (s: SonKisiState, now: number, players = ALL) => sonKisi.publicView(s, ctx(now, players));

describe("son-kisi kuralları", () => {
  it("2-8 oyuncu, 3 tur", () => {
    expect(sonKisi.minPlayers).toBe(2);
    expect(sonKisi.maxPlayers).toBe(8);
    expect(sonKisi.setup(ALL, ctx(T0)).rounds).toHaveLength(SON_KISI_ROUNDS);
    expect(SON_KISI_ROUNDS).toBe(3);
  });

  it("her turun gizli alarmı 8-16 sn arasında, ms çözünürlükte; turlar arası 4 sn", () => {
    const durations = new Set<number>();
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let seed = 1; seed <= 1500; seed++) {
      const s = sonKisi.setup(ALL, ctx(T0, ALL, seed));
      expect(roundOf(s, 0).startAt).toBe(T0);
      s.rounds.forEach((r, i) => {
        const d = r.alarmAt - r.startAt;
        durations.add(d);
        min = Math.min(min, d);
        max = Math.max(max, d);
        expect(d).toBeGreaterThanOrEqual(SON_KISI_MIN_MS);
        expect(d).toBeLessThanOrEqual(SON_KISI_MAX_MS);
        expect(r.endsAt).toBe(r.alarmAt);
        if (i > 0) expect(r.startAt - roundOf(s, i - 1).endsAt).toBe(SON_KISI_GAP_MS);
      });
      expect(s.revealEndsAt).toBe(roundOf(s, 2).endsAt + SON_KISI_REVEAL_MS);
    }
    expect(min).toBeLessThan(8_300);
    expect(max).toBeGreaterThan(15_700);
    expect(durations.size).toBeGreaterThan(2000);
    expect([...durations].some((d) => d % 1000 !== 0)).toBe(true);
  });

  it("aynı tohum aynı takvimi verir (belirlilik)", () => {
    expect(sonKisi.setup(ALL, ctx(T0, ALL, 77))).toEqual(sonKisi.setup(ALL, ctx(T0, ALL, 77)));
  });

  it("evreler: tur, tur arası, son açılış; oyun son açılışın sonunda biter", () => {
    const s = start();
    expect(sonKisiPhaseAt(s, T0 + 11_999)).toEqual({ round: 0, phase: "play" });
    expect(sonKisiPhaseAt(s, T0 + 12_000)).toEqual({ round: 0, phase: "gap" });
    expect(sonKisiPhaseAt(s, T0 + 15_999)).toEqual({ round: 0, phase: "gap" });
    expect(sonKisiPhaseAt(s, T0 + 16_000)).toEqual({ round: 1, phase: "play" });
    expect(sonKisiPhaseAt(s, T0 + 26_000)).toEqual({ round: 1, phase: "gap" });
    expect(sonKisiPhaseAt(s, T0 + 30_000)).toEqual({ round: 2, phase: "play" });
    expect(sonKisiPhaseAt(s, T0 + 44_000)).toEqual({ round: 2, phase: "over" });
    expect(sonKisi.revealAt?.(s, ctx(T0))).toBe(T0 + 44_000);
    expect(sonKisi.isFinished(s, ctx(T0 + 44_000 + SON_KISI_REVEAL_MS - 1))).toBe(false);
    expect(sonKisi.isFinished(s, ctx(T0 + 44_000 + SON_KISI_REVEAL_MS))).toBe(true);
  });

  it("SK-M1: son kaçan +2, sondan ikinci +1, diğer kaçanlar ve yakalanan 0 (eksi yok)", () => {
    let s = start();
    s = flee(s, "a", 0, 3_000);
    s = flee(s, "b", 0, 9_000);
    s = flee(s, "c", 0, 6_000);
    const r = pubAt(s, T0 + 12_000).results[0];
    expect(r?.points).toEqual({ a: 0, b: 2, c: 1, d: 0 });
    expect(r?.last).toEqual(["b"]);
    expect(r?.second).toEqual(["c"]);
    expect(r?.caught).toEqual(["d"]);
    expect(r?.escapes.map((e) => [e.id, e.ms])).toEqual([
      ["a", 3_000],
      ["c", 6_000],
      ["b", 9_000],
    ]);
  });

  it("kimse kaçmazsa kimse puan almaz; tek kişi kaçarsa yalnız o +2", () => {
    expect(sonKisiRoundPoints(ALL, [], T0 + 10_000)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(sonKisiRoundPoints(ALL, [{ id: "c", at: T0 + 1 }], T0 + 10_000)).toEqual({
      a: 0,
      b: 0,
      c: 2,
      d: 0,
    });
  });

  it("eşit zaman damgası: aynı derecedekiler aynı puanı alır; sondan ikinci bir sonraki farklı zamandır", () => {
    const pts = sonKisiRoundPoints(
      ALL,
      [
        { id: "a", at: 100 },
        { id: "b", at: 500 },
        { id: "c", at: 500 },
        { id: "d", at: 300 },
      ],
      10_000,
    );
    expect(pts).toEqual({ a: 0, b: 2, c: 2, d: 1 });
  });

  it("2 oyuncuda sondan ikinci ödülü yoktur", () => {
    expect(
      sonKisiRoundPoints(
        ["a", "b"],
        [
          { id: "a", at: 100 },
          { id: "b", at: 500 },
        ],
        10_000,
      ),
    ).toEqual({ a: 0, b: 2 });
  });

  it("SK-M4: alarmdan önceki son 1 sn (uç dahil) içinde kaçan +1 ek alır; en çok 3", () => {
    const alarm = 10_000;
    const pts = sonKisiRoundPoints(
      ALL,
      [
        { id: "a", at: alarm - 1_001 },
        { id: "b", at: alarm - 1_000 },
        { id: "c", at: alarm - 1 },
      ],
      alarm,
    );
    // c son (2) + kıl payı (1) = 3; b sondan ikinci (1) + kıl payı (1) = 2; a 0 (pencere dışı).
    expect(pts).toEqual({ a: 0, b: 2, c: 3, d: 0 });
    expect(Math.max(...Object.values(pts))).toBeLessThanOrEqual(3);
  });

  it("kıl payı, tur erken kapansa da özgün alarma göre ölçülür; açılışta etiketlenir", () => {
    let s = start([12_000, 10_000, 14_000]);
    s = flee(s, "a", 0, 2_000);
    s = flee(s, "b", 0, 3_000);
    s = flee(s, "c", 0, 4_000);
    s = flee(s, "d", 0, 11_500); // herkes kaçtı: tur 12 500'de değil 12 000'de (alarm) kapanır
    expect(roundOf(s, 0).endsAt).toBe(T0 + 12_000);
    const r = pubAt(s, T0 + 12_000).results[0];
    expect(r?.rang).toBe(true);
    expect(r?.escapes.find((e) => e.id === "d")).toMatchObject({ close: true, points: 3 });
    expect(r?.escapes.find((e) => e.id === "c")).toMatchObject({ close: false, points: 1 });
  });

  it("herkes erken kaçınca tur son kaçıştan 1 sn sonra kapanır, sonraki turlar öne kayar; alarm 'çalacaktı' diye açılır", () => {
    let s = start([12_000, 10_000, 14_000]);
    for (const [i, id] of ALL.entries()) s = flee(s, id, 0, 4_000 + i * 500); // son kaçış 5 500
    expect(roundOf(s, 0).endsAt).toBe(T0 + 6_500);
    expect(roundOf(s, 0).alarmAt).toBe(T0 + 12_000);
    expect(roundOf(s, 1).startAt).toBe(T0 + 6_500 + SON_KISI_GAP_MS);
    expect(roundOf(s, 1).alarmAt - roundOf(s, 1).startAt).toBe(10_000);
    expect(roundOf(s, 1).thresholds[0]).toBe(roundOf(s, 1).alarmAt - 6_000);
    expect(s.revealEndsAt).toBe(roundOf(s, 2).endsAt + SON_KISI_REVEAL_MS);
    expect(sonKisi.isFinished(s, ctx(T0 + 6_499))).toBe(false);
    const r = pubAt(s, T0 + 6_500).results[0];
    expect(r?.rang).toBe(false);
    expect(r?.alarmMs).toBe(12_000);
    expect(r?.points).toEqual({ a: 0, b: 0, c: 1, d: 2 });
  });

  it("bir kişi eksikken (kopuk da olsa) tur erken kapanmaz", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = flee(s, id, 0, 4_000, ["a", "b", "c"]);
    expect(roundOf(s, 0).endsAt).toBe(T0 + 12_000);
    expect(sonKisi.tick(s, ctx(T0 + 5_000, ["a", "b", "c"])).rounds).toEqual(s.rounds);
  });

  it("tur başına tek basış: ikinci basış yok sayılır, sonraki turda yeniden basılır", () => {
    let s = flee(start(), "a", 0, 2_000);
    s = flee(s, "a", 0, 11_000);
    expect(roundOf(s, 0).escapes).toEqual([{ id: "a", at: T0 + 2_000 }]);
    s = flee(s, "a", 1, 5_000);
    expect(roundOf(s, 1).escapes).toEqual([{ id: "a", at: roundOf(s, 1).startAt + 5_000 }]);
  });

  it("alarm anındaki ve tur arasındaki basış reddedilir; alarmdan 1 ms önceki geçerli", () => {
    const s = start();
    expect(isRejected(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 11_999)))).toBe(false);
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 12_000))).toEqual({
      rejected: "between_rounds",
    });
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 15_999))).toEqual({
      rejected: "between_rounds",
    });
    expect(isRejected(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 16_000)))).toBe(false);
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 44_000))).toEqual({ rejected: "ended" });
    expect(sonKisi.reduce(s, "a", { kind: "escape" }, ctx(T0 + 99_000))).toEqual({ rejected: "ended" });
  });

  it("katılımcı olmayan reddedilir; başlamadan önceki basış reddedilir", () => {
    expect(sonKisi.reduce(start(), "x", { kind: "escape" }, ctx(T0 + 5))).toEqual({
      rejected: "not_participant",
    });
    expect(sonKisi.reduce(start(), "a", { kind: "escape" }, ctx(T0 - 1))).toEqual({
      rejected: "not_started",
    });
  });

  it("kopan oyuncu bir turu kaçırsa da (0) sonraki turlara katılır", () => {
    let s = start();
    s = flee(s, "a", 0, 3_000, ["a", "b", "c"]);
    s = flee(s, "d", 1, 4_000);
    const pub = pubAt(s, T0 + 44_000);
    expect(pub.results[0]?.points.d).toBe(0);
    expect(pub.results[1]?.points.d).toBe(2);
  });

  it("SK-M2: genel skor üç turun toplamına göre +2 / +1 / 0; mini puan toplamdır", () => {
    let s = start();
    s = flee(s, "a", 0, 11_500); // 3 (son + kıl payı)
    s = flee(s, "b", 0, 5_000); // 1
    s = flee(s, "a", 1, 2_000); // 1
    s = flee(s, "b", 1, 4_000); // 2
    s = flee(s, "c", 2, 1_000); // 2 (tek kaçan)
    const r = sonKisi.result(s);
    expect(r.miniScores).toEqual({ a: 4, b: 3, c: 2, d: 0 });
    expect(r.awards).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    const fin = pubAt(s, T0 + 44_000).final;
    expect(fin?.map((x) => [x.playerId, x.total, x.rank, x.award])).toEqual([
      ["a", 4, 1, 2],
      ["b", 3, 2, 1],
      ["c", 2, 3, 0],
      ["d", 0, 4, 0],
    ]);
    expect(fin?.[0]?.roundPoints).toEqual([3, 1, 0]);
  });

  it("sıralama: birincide eşitlik hepsi +2, sonraki farklı toplam +1; herkes eşit ve > 0 ise +1; 0 ödülsüz", () => {
    const res = (pts: Record<string, number>) => ({
      index: 0,
      alarmMs: 1,
      rang: true,
      escapes: [],
      caught: [],
      last: [],
      second: [],
      points: pts,
    });
    const aw = (pts: Record<string, number>) =>
      Object.fromEntries(sonKisiStandings(Object.keys(pts), [res(pts)]).map((x) => [x.playerId, x.award]));
    expect(aw({ a: 3, b: 3, c: 1, d: 0 })).toEqual({ a: 2, b: 2, c: 1, d: 0 });
    expect(aw({ a: 2, b: 2, c: 2 })).toEqual({ a: 1, b: 1, c: 1 });
    expect(aw({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
    expect(aw({ a: 2, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    expect(aw({ a: 5, b: 1 })).toEqual({ a: 2, b: 1 });
  });

  it("kimse hiç kaçmazsa herkes 0 (eksi yok)", () => {
    const r = sonKisi.result(start());
    expect(r.awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(r.miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
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
    expect(sonKisiTension(th, 4_999)).toBe(0);
    expect(sonKisiTension(th, 5_000)).toBe(1);
    expect(sonKisiTension(th, 8_999)).toBe(2);
    expect(sonKisiTension(th, 9_000)).toBe(3);
  });

  it("eşikler her tur yeniden çekilir: alarma göre aralıklarda, artan ve tur başından >= 1 sn sonra", () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const s = sonKisi.setup(ALL, ctx(T0, ALL, seed));
      for (const r of s.rounds) {
        const [t1, t2, t3] = r.thresholds as [number, number, number];
        expect(t1).toBeGreaterThanOrEqual(r.startAt + 1_000);
        expect(t1).toBeLessThanOrEqual(t2);
        expect(t2).toBeLessThanOrEqual(t3);
        expect(r.alarmAt - t1).toBeLessThanOrEqual(8_000);
        expect(r.alarmAt - t2).toBeGreaterThanOrEqual(2_500);
        expect(r.alarmAt - t2).toBeLessThanOrEqual(4_500);
        expect(r.alarmAt - t3).toBeGreaterThanOrEqual(800);
        expect(r.alarmAt - t3).toBeLessThanOrEqual(2_200);
        if (r.alarmAt - r.startAt >= 9_000) expect(r.alarmAt - t1).toBeGreaterThanOrEqual(5_000);
      }
    }
  });

  it("tick yalnız evre/gerilim değişince yeni durum döner", () => {
    const s = start();
    expect(sonKisi.tick(s, ctx(T0 + 100))).toBe(s);
    const t1 = sonKisi.tick(s, ctx(T0 + 6_000));
    expect(t1).not.toBe(s);
    expect(sonKisi.tick(t1, ctx(T0 + 6_100))).toBe(t1);
    const gap = sonKisi.tick(t1, ctx(T0 + 12_000));
    expect(gap.stage).not.toBe(t1.stage);
    expect(sonKisi.result(gap)).toEqual(sonKisi.result(s));
  });

  it("nextWake eşiklere, tur kapanışına ve sonraki tur başına uyanır", () => {
    const s = start();
    expect(sonKisi.nextWake?.(s, ctx(T0))).toBe(T0 + 6_000);
    expect(sonKisi.nextWake?.(s, ctx(T0 + 10_500))).toBe(T0 + 12_000);
    expect(sonKisi.nextWake?.(s, ctx(T0 + 12_000))).toBe(T0 + 16_000);
  });

  it("publicView gerilimi ve kaçan SAYISINI verir; tur kapanınca 3", () => {
    const s = flee(start(), "b", 0, 1_000);
    expect(pubAt(s, T0 + 2_000).tension).toBe(0);
    expect(pubAt(s, T0 + 6_000).tension).toBe(1);
    expect(pubAt(s, T0 + 8_500).tension).toBe(2);
    expect(pubAt(s, T0 + 10_500).tension).toBe(3);
    expect(pubAt(s, T0 + 2_000).escapedCount).toBe(1);
    expect(pubAt(s, T0 + 2_000).results).toEqual([]);
    expect(pubAt(s, T0 + 12_500).tension).toBe(3);
    expect(pubAt(s, T0 + 16_000).escapedCount).toBe(0);
    expect(pubAt(s, T0 + 16_000).tension).toBe(0);
  });
});

describe("son-kisi gizlilik", () => {
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

  it("sahip kararı: oyun sırasında kimin kaçtığı hiçbir görünümde yok (yalnız sayı); kendi kaçışın yalnız sende", () => {
    const s0 = start([12_000, 10_000, 14_000], ids);
    const s = flee(s0, "p1", 0, 2_345, ids);
    const t = flee(s0, "p2", 0, 2_345, ids);
    const now = T0 + 5_000;
    const pub = JSON.stringify(sonKisi.publicView(s, ctx(now, ids)));
    // p1 ya da p2 kaçtığında herkese açık görünüm birebir aynıdır.
    expect(pub).toBe(JSON.stringify(sonKisi.publicView(t, ctx(now, ids))));
    expect(pub).not.toContain("2345");
    expect(sonKisi.publicView(s, ctx(now, ids)).escapedCount).toBe(1);
    expect(sonKisi.view(s, "p1", ctx(now, ids))).toEqual({ escaped: true, myMs: 2_345 });
    expect(sonKisi.view(s, "p2", ctx(now, ids))).toEqual({ escaped: false, myMs: null });
    expect(sonKisi.view(s, null, ctx(now, ids))).toEqual({ escaped: false, myMs: null });
    // Kaçan ile kaçmayanın görünümü kimin kaçtığını ele vermez: p2 ve p3 aynı görünümü alır.
    expect(JSON.stringify(sonKisi.view(s, "p2", ctx(now, ids)))).toBe(
      JSON.stringify(sonKisi.view(s, "p3", ctx(now, ids))),
    );
  });

  it("tur kapanmadan ne alarm, ne süre, ne eşik geçer; görünüm yalnız gerilim ve sayıyla ilerler (çok tohum)", () => {
    for (let seed = 1; seed <= 150; seed++) {
      let s = sonKisi.setup(ids, ctx(T0, ids, seed));
      s = flee(s, "p2", 0, 1_234, ids);
      for (const [i, r] of s.rounds.entries()) {
        const total = r.alarmAt - r.startAt;
        for (const frac of [0, 0.3, 0.5, 0.76, 0.9, 0.999]) {
          const now = r.startAt + Math.floor(total * frac);
          const all = everything(s, now).replace(/"startedAt":\d+/g, "");
          expect(all, `seed ${seed} tur ${i} frac ${frac}`).not.toContain(String(r.alarmAt));
          expect(all).not.toContain(`"alarmMs":${total}`);
          expect(all).not.toMatch(/endsAt|remaining|duration|deadline|threshold|alarmAt/i);
          for (const t of r.thresholds) expect(all).not.toContain(String(t));
          // Gelecek turların alarmı da yok.
          for (const later of s.rounds.slice(i))
            expect(all).not.toContain(`"alarmMs":${later.alarmAt - later.startAt}`);
        }
      }
    }
  });

  it("aynı gerilimde iki farklı alarmda görünüm aynıdır", () => {
    const a = start([11_000, 10_000, 10_000], ids);
    const b = start([16_000, 10_000, 10_000], ids);
    const va = sonKisi.publicView(a, ctx(T0 + 5_500, ids));
    const vb = sonKisi.publicView(b, ctx(T0 + 10_500, ids));
    expect(va.tension).toBe(1);
    expect(vb.tension).toBe(1);
    expect(JSON.stringify(va)).toBe(JSON.stringify(vb));
  });

  it("findLeaks: mutlak alarm ve eşikler hiçbir anda (tur arası, son açılış dahil) görünüme girmez", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = sonKisi.setup(ids, ctx(T0, ids, seed));
      // 1. turda herkes erken kaçar (öne kayma), 2. turda biri kaçar.
      for (const id of ids) s = flee(s, id, 0, 3_000 + ids.indexOf(id) * 7, ids);
      s = flee(s, "p3", 1, 2_000, ids);
      const points = s.rounds.flatMap((r) => [
        r.startAt,
        r.endsAt - 1,
        r.endsAt,
        r.endsAt + 1,
        r.endsAt + 3_999,
      ]);
      for (const now of points) {
        const leaks = findLeaks(sonKisi, s, ids, now, ids);
        // Son açılış (oyun bitti) dışında sızıntı yok; bitmiş oyunda sahipsiz sırlar denetim dışıdır.
        expect(leaks, `seed ${seed} now ${now}`).toEqual([]);
      }
    }
  });

  it("secrets() her turun alarmını ve eşiklerini bildirir; sahibi yoktur", () => {
    const s = sonKisi.setup(ids, ctx(T0, ids, 5));
    const secrets = sonKisi.secrets(s);
    expect(secrets).toHaveLength(SON_KISI_ROUNDS * 4);
    expect(secrets.map((x) => x.value)).toContain(String(roundOf(s, 0).alarmAt));
    expect(secrets.map((x) => x.value)).toContain(String(roundOf(s, 2).thresholds[2]));
    expect(secrets.every((x) => x.ownerIds.length === 0)).toBe(true);
  });

  it("publicView/view alan kümesi sabittir", () => {
    const s = sonKisi.setup(ids, ctx(T0, ids, 9));
    expect(Object.keys(sonKisi.publicView(s, ctx(T0 + 1, ids))).sort()).toEqual([
      "escapedCount",
      "final",
      "finished",
      "phase",
      "results",
      "round",
      "rounds",
      "startedAt",
      "tension",
      "totals",
    ]);
    expect(Object.keys(sonKisi.view(s, "p1", ctx(T0 + 1, ids))).sort()).toEqual(["escaped", "myMs"]);
  });

  it("tur kapanınca açılış: alarm anı (turun başından), kaçışlar, yakalananlar; mutlak alarm yine yok", () => {
    let s = start([12_000, 10_000, 14_000], ids);
    s = flee(s, "p1", 0, 3_000, ids);
    s = flee(s, "p3", 0, 8_000, ids);
    const pub = sonKisi.publicView(s, ctx(T0 + 12_000, ids));
    expect(pub.phase).toBe("gap");
    expect(pub.results[0]).toMatchObject({
      index: 0,
      alarmMs: 12_000,
      rang: true,
      caught: ["p2"],
      last: ["p3"],
      second: ["p1"],
      points: { p1: 1, p2: 0, p3: 2 },
    });
    expect(pub.totals).toEqual({ p1: 1, p2: 0, p3: 2 });
    expect(JSON.stringify(pub)).not.toContain(String(T0 + 12_000));
  });
});
