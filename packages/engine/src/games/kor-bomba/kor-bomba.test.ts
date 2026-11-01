import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/invariants.js";
import {
  KOR_BOMBA_FUSE_CAP_MS,
  KOR_BOMBA_LOCK_MS,
  KOR_BOMBA_OUTRO_MS,
  type KorBombaState,
  korBomba,
} from "./index.js";

const T0 = 1_700_000_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL, seed = 7): GameContext => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players = ALL, connected: readonly string[] = players, seed = 7): KorBombaState =>
  korBomba.setup(players, ctx(T0, connected, seed));
/** Sabit durum kurar (rastgelelik olmadan). İlk elin kilidi T0'da açılmış sayılır. */
const fixed = (over: Partial<KorBombaState> = {}): KorBombaState => {
  const s: KorBombaState = {
    ...start(),
    holder: "a",
    explodeAt: T0 + 16_000,
    heldSince: T0 - KOR_BOMBA_LOCK_MS,
    ...over,
  };
  return { ...s, fuseMs: s.explodeAt - T0 };
};
/** Kilit bitmiş bir sonraki an. */
const unlocked = (s: KorBombaState): number => s.heldSince + KOR_BOMBA_LOCK_MS;
const pass = (s: KorBombaState, from: string, to: string, at: number, connected: readonly string[] = ALL) =>
  korBomba.reduce(s, from, { kind: "pass", to }, ctx(at, connected, 99));
const ok = (r: ReturnType<typeof pass>): KorBombaState => {
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
};

describe("kor-bomba kuralları", () => {
  it("meta: 2-8 oyuncu, yatay, kısa Türkçe anlatım", () => {
    expect(korBomba.minPlayers).toBe(2);
    expect(korBomba.maxPlayers).toBe(8);
    expect(korBomba.orientation).toBe("landscape");
    expect(korBomba.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("bomba rastgele bir katılımcıda başlar (tüm oyuncular bir gün seçilir)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) seen.add(start(ALL, ALL, seed).holder);
    expect([...seen].sort()).toEqual(ALL);
  });

  it("bomba yalnız bağlı katılımcıda başlar", () => {
    for (let seed = 1; seed <= 100; seed++) {
      expect(["b", "d"]).toContain(start(ALL, ["b", "d"], seed).holder);
    }
  });

  it("bağlı katılımcı yoksa katılımcılardan biri seçilir", () => {
    expect(ALL).toContain(start(ALL, [], 3).holder);
    expect(ALL).toContain(start(ALL, ["ghost"], 3).holder);
  });

  it("patlama zamanı ilk verilişten 15-20 sn sonra, ms çözünürlükte", () => {
    const fuses = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const fuse = start(ALL, ALL, seed).explodeAt - T0;
      expect(fuse).toBeGreaterThanOrEqual(15_000);
      expect(fuse).toBeLessThanOrEqual(20_000);
      expect(Number.isInteger(fuse)).toBe(true);
      fuses.add(fuse);
    }
    expect(fuses.size).toBeGreaterThan(100);
    expect(Math.min(...fuses)).toBeLessThan(15_400);
    expect(Math.max(...fuses)).toBeGreaterThan(19_600);
  });

  it("setup belirlidir: aynı tohum aynı bomba", () => {
    expect(start(ALL, ALL, 5)).toEqual(start(ALL, ALL, 5));
  });

  it("taşıyıcı bağlı başka birine pas verir; bomba ve sayaç güncellenir", () => {
    const s = ok(pass(fixed(), "a", "c", T0 + 1000));
    expect(s.holder).toBe("c");
    expect(s.passes).toBe(1);
    expect(s.lastPass).toEqual({ seq: 1, from: "a", to: "c" });
  });

  it("her pas patlamaya 1-4 sn ekler (ms çözünürlükte)", () => {
    const bonuses = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) {
      const before = fixed();
      const after = ok(korBomba.reduce(before, "a", { kind: "pass", to: "b" }, ctx(T0 + 10, ALL, seed)));
      const bonus = after.explodeAt - before.explodeAt;
      expect(bonus).toBeGreaterThanOrEqual(1000);
      expect(bonus).toBeLessThanOrEqual(4000);
      expect(after.lastBonusMs).toBe(bonus);
      bonuses.add(bonus);
    }
    expect(bonuses.size).toBeGreaterThan(100);
    expect(Math.min(...bonuses)).toBeLessThan(1_200);
    expect(Math.max(...bonuses)).toBeGreaterThan(3_800);
  });

  it("BM-M2: 1.–3. pas 1–4 sn, 4.–6. pas 0,5–2 sn, 7. ve sonrası 0 ekler", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = fixed({ explodeAt: T0 + 20_000 });
      let holder = "a";
      const order = ["b", "c", "d", "a", "b", "c", "d", "a", "b"];
      for (const to of order) {
        const before = s.explodeAt;
        s = ok(korBomba.reduce(s, holder, { kind: "pass", to }, ctx(unlocked(s), ALL, seed * 31 + s.passes)));
        const bonus = s.explodeAt - before;
        expect(s.lastBonusMs).toBe(bonus);
        if (s.passes <= 3) {
          expect(bonus).toBeGreaterThanOrEqual(1_000);
          expect(bonus).toBeLessThanOrEqual(4_000);
        } else if (s.passes <= 6) {
          expect(bonus).toBeGreaterThanOrEqual(500);
          expect(bonus).toBeLessThanOrEqual(2_000);
        } else expect(bonus).toBe(0);
        holder = to;
      }
      expect(s.passes).toBe(9);
    }
  });

  it("BM-M2: fitil oyunun başından 45 sn'yi asla geçmez (ek süre kırpılır)", () => {
    const s = fixed({ explodeAt: T0 + KOR_BOMBA_FUSE_CAP_MS - 300 });
    const next = ok(pass(s, "a", "b", T0 + 100));
    expect(next.explodeAt).toBe(T0 + KOR_BOMBA_FUSE_CAP_MS);
    expect(next.lastBonusMs).toBe(300);
    const full = ok(pass(fixed({ explodeAt: T0 + KOR_BOMBA_FUSE_CAP_MS }), "a", "b", T0 + 100));
    expect(full.lastBonusMs).toBe(0);
    expect(full.explodeAt).toBe(T0 + KOR_BOMBA_FUSE_CAP_MS);
  });

  it("BM-M2: en hızlı sıcak patatesle bile oyun 45 sn içinde biter", () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = start(ALL, ALL, seed);
      let i = 0;
      while (true) {
        const t = unlocked(s);
        if (t >= s.explodeAt) break;
        const to = ALL.filter((id) => id !== s.holder && id !== s.lastPass?.from)[i % 2] as string;
        s = ok(korBomba.reduce(s, s.holder, { kind: "pass", to }, ctx(t, ALL, seed + i)));
        i++;
      }
      expect(s.explodeAt - T0).toBeLessThanOrEqual(38_000);
    }
  });

  it("BM-M1: bombayı alan 1,5 sn pas veremez (ilk taşıyıcı dahil); fitil işlemeye devam eder", () => {
    const s0 = start(ALL, ALL, 3);
    const other = ALL.find((id) => id !== s0.holder) as string;
    expect(korBomba.reduce(s0, s0.holder, { kind: "pass", to: other }, ctx(T0 + 1_499))).toEqual({
      rejected: "locked",
    });
    const s1 = ok(korBomba.reduce(s0, s0.holder, { kind: "pass", to: other }, ctx(T0 + 1_500)));
    const third = ALL.find((id) => id !== s1.holder && id !== s0.holder) as string;
    expect(korBomba.reduce(s1, other, { kind: "pass", to: third }, ctx(T0 + 2_999))).toEqual({
      rejected: "locked",
    });
    expect(ok(korBomba.reduce(s1, other, { kind: "pass", to: third }, ctx(T0 + 3_000))).holder).toBe(third);
    // Kilitteyken patlarsa bomba onda patlar.
    const late = { ...s1, explodeAt: T0 + 2_000 };
    expect(korBomba.result(korBomba.tick(late, ctx(T0 + 2_000))).awards[other]).toBe(-1);
  });

  it("BM-M1: kilit görünümde herkese açık (alış anı + 1,5 sn); süreyle ilgisi yok", () => {
    const s = ok(pass(fixed(), "a", "b", T0 + 700));
    expect(korBomba.publicView(s, ctx(T0 + 800)).lockedUntil).toBe(T0 + 700 + 1_500);
  });

  it("BM-M1: 3+ bağlıda az önce atana hemen geri pas yok; bir el sonra serbest", () => {
    let s = ok(pass(fixed(), "a", "b", T0 + 100));
    expect(pass(s, "b", "a", unlocked(s))).toEqual({ rejected: "no_return" });
    s = ok(pass(s, "b", "c", unlocked(s)));
    // c'ye b attı; c, a'ya verebilir (a artık "az önce atan" değil).
    s = ok(pass(s, "c", "a", unlocked(s)));
    expect(s.holder).toBe("a");
    expect(s.passes).toBe(3);
  });

  it("BM-M1: atan dışında bağlı kimse yoksa geri pas serbest; 2 oyuncuda yasak yok", () => {
    let s = ok(pass(fixed(), "a", "b", T0 + 100));
    expect(ok(pass(s, "b", "a", unlocked(s), ["a", "b"])).holder).toBe("a");
    let two = start(["a", "b"], ["a", "b"], 11);
    const first = two.holder;
    const other = first === "a" ? "b" : "a";
    two = ok(korBomba.reduce(two, first, { kind: "pass", to: other }, ctx(unlocked(two), ["a", "b"], 3)));
    s = ok(korBomba.reduce(two, other, { kind: "pass", to: first }, ctx(unlocked(two), ["a", "b"], 4)));
    expect(s.holder).toBe(first);
  });

  it("BM-M1: kilit bitmeden reddedilen pas bombayı yerinde bırakır", () => {
    const s = ok(pass(fixed(), "a", "b", T0 + 100));
    expect(pass(s, "b", "c", T0 + 101)).toEqual({ rejected: "locked" });
    expect(s.holder).toBe("b");
  });

  it("yalnız taşıyıcı pas verebilir", () => {
    expect(pass(fixed(), "b", "c", T0 + 100)).toEqual({ rejected: "not_holder" });
    const s = ok(pass(fixed(), "a", "b", T0 + 100));
    expect(pass(s, "a", "c", unlocked(s))).toEqual({ rejected: "not_holder" });
  });

  it("kendine pas verilemez", () => {
    expect(pass(fixed(), "a", "a", T0 + 100)).toEqual({ rejected: "self_target" });
  });

  it("katılımcı olmayan hedefe pas verilemez", () => {
    expect(pass(fixed(), "a", "ghost", T0 + 100)).toEqual({ rejected: "bad_target" });
    expect(pass(fixed(), "a", "__proto__", T0 + 100)).toEqual({ rejected: "bad_target" });
  });

  it("bağlantısı kopuk hedefe pas verilemez; bağlı olana verilir", () => {
    const connected = ["a", "b", "d"];
    expect(pass(fixed(), "a", "c", T0 + 100, connected)).toEqual({ rejected: "target_offline" });
    expect(ok(pass(fixed(), "a", "d", T0 + 100, connected)).holder).toBe("d");
  });

  it("bağlantısı kopan taşıyıcı bombayı tutar; patlayınca o -1 alır", () => {
    let s = fixed();
    s = korBomba.tick(s, ctx(T0 + 16_000, ["b", "c", "d"]));
    expect(s.holder).toBe("a");
    expect(korBomba.result(s).miniScores).toEqual({ a: -1, b: 0, c: 0, d: 0 });
  });

  it("katılımcı olmayan pas veremez", () => {
    expect(pass(fixed(), "ghost", "b", T0 + 100)).toEqual({ rejected: "not_participant" });
  });

  it("patlama ile aynı ms'deki pas reddedilir (patlama önce)", () => {
    const s = fixed();
    expect(pass(s, "a", "b", s.explodeAt)).toEqual({ rejected: "ended" });
  });

  it("patlamadan 1 ms önceki pas kabul edilir ve süreyi uzatır", () => {
    const s = fixed();
    const next = ok(pass(s, "a", "b", s.explodeAt - 1));
    expect(next.explodeAt).toBeGreaterThan(s.explodeAt);
    expect(korBomba.isFinished(next, ctx(s.explodeAt))).toBe(false);
  });

  it("patlamadan sonraki pas (tick edilmemiş olsa da) reddedilir", () => {
    const s = fixed();
    expect(pass(s, "a", "b", s.explodeAt + 500)).toEqual({ rejected: "ended" });
    const boom = korBomba.tick(s, ctx(s.explodeAt + 5));
    expect(pass(boom, "a", "b", s.explodeAt - 100)).toEqual({ rejected: "ended" });
    expect(pass(boom, "a", "b", s.explodeAt + 1)).toEqual({ rejected: "ended" });
  });

  it("patlama anında kurallar biter; sonuç ekranı kısa patlama gösterisinden sonra açılır", () => {
    const s = fixed();
    expect(korBomba.isFinished(s, ctx(s.explodeAt - 1))).toBe(false);
    // Patlamadan itibaren pas yok, ama gösteri süresince oyun "bitmiş" sayılmaz.
    expect(pass(s, "a", "b", s.explodeAt)).toEqual({ rejected: "ended" });
    expect(korBomba.isFinished(s, ctx(s.explodeAt))).toBe(false);
    expect(korBomba.isFinished(s, ctx(s.explodeAt + KOR_BOMBA_OUTRO_MS - 1))).toBe(false);
    expect(korBomba.isFinished(s, ctx(s.explodeAt + KOR_BOMBA_OUTRO_MS))).toBe(true);
  });

  it("gösteri sırasında taşıyıcı değişmez ve puan sabittir", () => {
    const s = fixed();
    const boom = korBomba.tick(s, ctx(s.explodeAt + 1));
    expect(pass(boom, "a", "b", s.explodeAt + 500)).toEqual({ rejected: "ended" });
    expect(korBomba.result(boom).awards).toEqual({ a: -1, b: 0, c: 0, d: 0 });
  });

  it("tick patlamayı işaretler, değişiklik yoksa aynı nesneyi döner", () => {
    const s = fixed();
    expect(korBomba.tick(s, ctx(s.explodeAt - 1))).toBe(s);
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(boom.exploded).toBe(true);
    expect(korBomba.tick(boom, ctx(s.explodeAt + 10))).toBe(boom);
  });

  it("tick bağlı listesine bakmaz: farklı connected aynı sonucu verir", () => {
    const s = fixed();
    const a = korBomba.tick(s, ctx(s.explodeAt + 1, ALL));
    const b = korBomba.tick(s, ctx(s.explodeAt + 1, []));
    expect(a).toEqual(b);
  });

  it("puanlama: taşıyıcı -1, diğerleri 0; ödül = mini puan", () => {
    let s = fixed();
    s = ok(pass(s, "a", "c", T0 + 100));
    const r = korBomba.result(korBomba.tick(s, ctx(s.explodeAt)));
    expect(r.miniScores).toEqual({ a: 0, b: 0, c: -1, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("hiç pas verilmezse ilk taşıyıcı -1 alır; + puan yoktur", () => {
    const s = fixed();
    const r = korBomba.result(korBomba.tick(s, ctx(s.explodeAt)));
    expect(r.awards).toEqual({ a: -1, b: 0, c: 0, d: 0 });
    expect(Object.values(r.awards).every((v) => v <= 0)).toBe(true);
  });

  it("iki oyunculu oyun çalışır", () => {
    let s = start(["a", "b"], ["a", "b"], 11);
    const first = s.holder;
    const other = first === "a" ? "b" : "a";
    s = ok(korBomba.reduce(s, first, { kind: "pass", to: other }, ctx(T0 + 1_500, ["a", "b"], 3)));
    expect(s.holder).toBe(other);
    const r = korBomba.result(korBomba.tick(s, ctx(s.explodeAt)));
    expect(r.awards[other]).toBe(-1);
    expect(r.awards[first]).toBe(0);
  });

  it("saf: reduce durumu değiştirmez", () => {
    const s = fixed();
    const copy = JSON.parse(JSON.stringify(s)) as KorBombaState;
    pass(s, "a", "b", T0 + 10);
    expect(s).toEqual(copy);
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    expect(korBomba.parseAction({ kind: "pass", to: "b" })).toEqual({ kind: "pass", to: "b" });
    expect(korBomba.parseAction({ kind: "predict", turn: 0, explodes: true })).toBeNull();
    for (const raw of [
      { kind: "pass" },
      { kind: "pass", to: "" },
      { kind: "pass", to: 5 },
      { kind: "pass", to: "b", extra: 1 },
      { kind: "pass", to: "x".repeat(65) },
      { kind: "press", to: "b" },
      ["pass", "b"],
      null,
      "pass",
    ]) {
      expect(korBomba.parseAction(raw)).toBeNull();
    }
  });
});

describe("kor-bomba gizlilik", () => {
  const s = fixed({ explodeAt: T0 + 17_345 });

  it("secrets: patlama zamanı, sahipleri taşıyıcı dışındaki herkes", () => {
    expect(korBomba.secrets(s)).toEqual([
      { ownerIds: ["b", "c", "d"], value: String(T0 + 17_345), label: "patlama zamanı" },
    ]);
  });

  it("taşıyıcının görünümünde hiçbir süre alanı yok (yapısal)", () => {
    const withBonus = ok(pass(fixed(), "a", "b", T0 + 10));
    const holderView = korBomba.view(withBonus, "b", ctx(T0 + 20));
    expect(holderView).toEqual({ role: "holder", betUsed: false, lastResult: null });
    expect(Object.keys(holderView)).toEqual(["role", "betUsed", "lastResult"]);
    const json = JSON.stringify(holderView);
    expect(json).not.toMatch(/explode|bonus|time|remain|left|ms|At/i);
  });

  it("izleyici görünümünde süre yok", () => {
    expect(korBomba.view(s, null, ctx(T0 + 20))).toEqual({ role: "spectator" });
    expect(korBomba.view(s, "ghost", ctx(T0 + 20))).toEqual({ role: "spectator" });
  });

  it("publicView patlamadan önce patlama zamanını ve eklenen süreyi içermez", () => {
    const after = ok(pass(s, "a", "b", T0 + 10));
    const json = JSON.stringify(korBomba.publicView(after, ctx(T0 + 20)));
    expect(json).not.toContain(String(after.explodeAt));
    expect(json).not.toContain(String(after.lastBonusMs));
    expect(korBomba.publicView(after, ctx(T0 + 20)).explodedAt).toBeNull();
    expect(korBomba.publicView(after, ctx(T0 + 20)).journey).toBeNull();
    expect(json).not.toContain("bonus");
  });

  it("BM-U3: pas zinciri herkese açık, süre taşımaz", () => {
    let s1 = ok(pass(s, "a", "b", T0 + 10));
    s1 = ok(pass(s1, "b", "c", unlocked(s1)));
    const pv = korBomba.publicView(s1, ctx(T0 + 5_000));
    expect(pv.trail).toEqual(["a", "b", "c"]);
    expect(korBomba.publicView(s, ctx(T0)).trail).toEqual(["a"]);
  });

  it("BM-U6: patlamadan sonra yolculuk ve fitil hesabı herkese açılır", () => {
    let s1 = ok(pass(s, "a", "b", T0 + 1_000));
    s1 = ok(pass(s1, "b", "c", T0 + 4_000));
    const boom = korBomba.tick(s1, ctx(s1.explodeAt));
    const j = korBomba.publicView(boom, ctx(s1.explodeAt)).journey;
    expect(j).not.toBeNull();
    expect(j?.fuseMs).toBe(s.fuseMs);
    expect(j?.bonusesMs).toEqual(s1.log.map((p) => p.bonusMs));
    expect(j?.totalMs).toBe(s1.explodeAt - T0);
    expect(j?.totalMs).toBe((j?.fuseMs ?? 0) + (j?.bonusesMs ?? []).reduce((x, y) => x + y, 0));
    expect(j?.hands).toEqual([
      { holder: "a", heldMs: 1_000 },
      { holder: "b", heldMs: 3_000 },
      { holder: "c", heldMs: s1.explodeAt - (T0 + 4_000) },
    ]);
  });

  it("taşıyıcı olmayan katılımcılar gerçek patlama zamanını ve son eklenen süreyi görür", () => {
    const after = ok(pass(s, "a", "b", T0 + 10));
    for (const id of ["a", "c", "d"]) {
      expect(korBomba.view(after, id, ctx(T0 + 20))).toEqual({
        role: "watcher",
        explodeAt: after.explodeAt,
        lastBonusMs: after.lastBonusMs,
        bet: null,
        betUsed: false,
        lastResult: null,
      });
    }
  });

  it("pas sonrası eski taşıyıcı artık süreyi görür, yeni taşıyıcı görmez", () => {
    const after = ok(pass(s, "a", "b", T0 + 10));
    expect(korBomba.view(after, "a", ctx(T0 + 20)).role).toBe("watcher");
    expect(korBomba.view(after, "b", ctx(T0 + 20)).role).toBe("holder");
  });

  it("sızıntı denetimi: taşıyıcı, izleyici ve publicView temiz", () => {
    expect(findLeaks(korBomba, s, ALL, T0 + 100)).toEqual([]);
    const after = ok(pass(s, "a", "c", T0 + 10));
    expect(findLeaks(korBomba, after, ALL, T0 + 100)).toEqual([]);
  });

  it("patlamadan sonra patlama zamanı herkese açık; gizli kayıt kalmaz", () => {
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.secrets(boom)).toEqual([]);
    expect(korBomba.publicView(boom, ctx(s.explodeAt))).toMatchObject({
      exploded: true,
      explodedAt: s.explodeAt,
      holder: "a",
    });
  });

  it("BM-U5: sunucu patlamaya tam zamanlı uyanır, ardından gösteri bitişine", () => {
    expect(korBomba.nextWake?.(s, ctx(T0 + 100))).toBe(s.explodeAt);
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.nextWake?.(boom, ctx(s.explodeAt))).toBe(s.explodeAt + KOR_BOMBA_OUTRO_MS);
    expect(korBomba.nextWake?.(boom, ctx(s.explodeAt + KOR_BOMBA_OUTRO_MS))).toBeNull();
  });

  it("patlamadan sonra taşıyıcı da sonucu (patlama anını) görebilir", () => {
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.view(boom, "a", ctx(s.explodeAt)).role).toBe("watcher");
  });
});
