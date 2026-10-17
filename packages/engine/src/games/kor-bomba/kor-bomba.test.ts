import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/invariants.js";
import { KOR_BOMBA_OUTRO_MS, type KorBombaState, korBomba } from "./index.js";

const T0 = 1_700_000_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL, seed = 7): GameContext => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players = ALL, connected: readonly string[] = players, seed = 7): KorBombaState =>
  korBomba.setup(players, ctx(T0, connected, seed));
/** Sabit durum kurar (rastgelelik olmadan). */
const fixed = (over: Partial<KorBombaState> = {}): KorBombaState => ({
  ...start(),
  holder: "a",
  explodeAt: T0 + 16_000,
  ...over,
});
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

  it("sınırsız pas: ardışık onlarca pas kabul edilir ve süre birikir", () => {
    let s = fixed({ explodeAt: T0 + 400_000 });
    const base = s.explodeAt;
    let holder = "a";
    for (let i = 0; i < 40; i++) {
      const to = holder === "a" ? "b" : "a";
      s = ok(korBomba.reduce(s, holder, { kind: "pass", to }, ctx(T0 + 100 + i, ALL, i + 1)));
      holder = to;
    }
    expect(s.passes).toBe(40);
    expect(s.explodeAt - base).toBeGreaterThanOrEqual(40_000);
    expect(s.explodeAt - base).toBeLessThanOrEqual(160_000);
  });

  it("geri pas serbest: A->B ve hemen B->A", () => {
    let s = ok(pass(fixed(), "a", "b", T0 + 100));
    s = ok(pass(s, "b", "a", T0 + 101));
    expect(s.holder).toBe("a");
    expect(s.passes).toBe(2);
  });

  it("yalnız taşıyıcı pas verebilir", () => {
    expect(pass(fixed(), "b", "c", T0 + 100)).toEqual({ rejected: "not_holder" });
    const s = ok(pass(fixed(), "a", "b", T0 + 100));
    expect(pass(s, "a", "c", T0 + 200)).toEqual({ rejected: "not_holder" });
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
    s = ok(korBomba.reduce(s, first, { kind: "pass", to: other }, ctx(T0 + 50, ["a", "b"], 3)));
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
    expect(holderView).toEqual({ role: "holder" });
    expect(Object.keys(holderView)).toEqual(["role"]);
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
  });

  it("taşıyıcı olmayan katılımcılar gerçek patlama zamanını ve son eklenen süreyi görür", () => {
    const after = ok(pass(s, "a", "b", T0 + 10));
    for (const id of ["a", "c", "d"]) {
      expect(korBomba.view(after, id, ctx(T0 + 20))).toEqual({
        role: "watcher",
        explodeAt: after.explodeAt,
        lastBonusMs: after.lastBonusMs,
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

  it("patlamadan sonra taşıyıcı da sonucu (patlama anını) görebilir", () => {
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.view(boom, "a", ctx(s.explodeAt)).role).toBe("watcher");
  });
});
