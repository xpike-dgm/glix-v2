import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type RusRuletiState, rusRuleti, rusRuletiShouldEnd } from "./index.js";
import {
  RUS_RULETI_DECISION_MS,
  RUS_RULETI_MAX_RISK,
  RUS_RULETI_OPEN_MS,
  RUS_RULETI_START_RISK,
} from "./types.js";

const T0 = 1_000_000;
const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ctx = (now: number, connected: readonly string[] = IDS, seed = 1): GameContext => ({
  now,
  rng: createRng(seed),
  connected,
});
/** Bağlı listesine dokunulursa fırlatan bağlam: tick ve catch-up `connected` okumamalı. */
const noConnected = (now: number): GameContext => ({
  now,
  rng: createRng(1),
  get connected(): readonly string[] {
    throw new Error("tick connected okumamalı");
  },
});

const ids = (n: number): string[] => IDS.slice(0, n);
const start = (n = 4, over: Partial<RusRuletiState> = {}, seed = 1): RusRuletiState => ({
  ...rusRuleti.setup(ids(n), ctx(T0, ids(n), seed)),
  ...over,
});
/** Atışı her zaman patlatan / hiç patlatmayan durum (risk zar karşısında). */
const BOOM = 100;
const SAFE = 0;

function shoot(
  s: RusRuletiState,
  who: string,
  target: string,
  now: number,
  connected = ids(s.players.length),
) {
  return rusRuleti.reduce(s, who, { kind: "shoot", target }, ctx(now, connected));
}
function ok(r: RusRuletiState | { rejected: string }): RusRuletiState {
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reason = (r: unknown): string => (isRejected(r) ? r.rejected : "kabul");
const other = (s: RusRuletiState, not: string): string => s.alive.find((x) => x !== not) as string;

describe("rus-ruleti: kurulum", () => {
  it("2-8 oyuncu", () => {
    expect(rusRuleti.minPlayers).toBe(2);
    expect(rusRuleti.maxPlayers).toBe(8);
  });

  it("herkes hayatta, risk %16, ilk karar penceresi hemen açık ve 18 sn", () => {
    const s = start(5);
    expect(s.alive).toEqual(ids(5));
    expect(s.eliminated).toEqual([]);
    expect(s.risk).toBe(16);
    expect(RUS_RULETI_START_RISK).toBe(16);
    expect(s.openAt).toBe(T0);
    expect(s.deadline).toBe(T0 + 18_000);
    expect(rusRuleti.isFinished(s, ctx(T0))).toBe(false);
  });

  it("silahın ilk sahibi rastgele (tüm oyuncular çıkabilir) ve belirli", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 400; seed++) seen.add(start(4, {}, seed).holder);
    expect([...seen].sort()).toEqual(ids(4));
    expect(start(4, {}, 9).holder).toBe(start(4, {}, 9).holder);
  });

  it("ilk sahip bağlı olanlar arasından seçilir", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = rusRuleti.setup(ids(4), ctx(T0, ["b", "c"], seed));
      expect(["b", "c"]).toContain(s.holder);
    }
  });
});

describe("rus-ruleti: ateş etme kuralları", () => {
  it("yalnız silahı tutan ateş edebilir", () => {
    const s = start(4);
    const notHolder = other(s, s.holder);
    expect(reason(shoot(s, notHolder, s.holder, T0 + 1000))).toBe("not_holder");
    expect(reason(shoot(s, s.holder, notHolder, T0 + 1000))).toBe("kabul");
  });

  it("sahip kendini hedefleyebilir (bağlantısı kopuk görünse bile); silah kendisinde kalır", () => {
    const s = start(4, { risk: SAFE });
    const next = ok(shoot(s, s.holder, s.holder, T0 + 1000, []));
    expect(next.holder).toBe(s.holder);
    expect(next.last).toMatchObject({ shooter: s.holder, target: s.holder, exploded: false, auto: false });
  });

  it("başka bir hayatta oyuncuyu hedefleyebilir; patlamazsa silah doğrudan hedefe geçer", () => {
    const s = start(4, { risk: SAFE });
    const target = other(s, s.holder);
    const next = ok(shoot(s, s.holder, target, T0 + 1000));
    expect(next.holder).toBe(target);
    expect(next.alive).toEqual(s.alive);
    expect(next.last).toMatchObject({ seq: 1, shooter: s.holder, target, exploded: false, risk: 0 });
  });

  it("bağlı olmayan başka oyuncu hedeflenemez", () => {
    const s = start(4, { risk: SAFE });
    const target = other(s, s.holder);
    const online = ids(4).filter((x) => x !== target);
    expect(reason(shoot(s, s.holder, target, T0 + 1000, online))).toBe("target_offline");
  });

  it("katılımcı olmayan ya da bilinmeyen hedef reddedilir", () => {
    const s = start(4);
    expect(reason(shoot(s, s.holder, "kimse", T0 + 1000))).toBe("bad_target");
    expect(reason(shoot(s, s.holder, "h", T0 + 1000, [...ids(4), "h"]))).toBe("bad_target");
  });

  it("katılımcı olmayan oyuncunun eylemi reddedilir", () => {
    const s = start(4);
    expect(reason(shoot(s, "ghost", s.holder, T0 + 1000))).toBe("not_participant");
  });

  it("elenmiş oyuncu ne ateş eder ne hedeflenir", () => {
    let s = start(6, { risk: BOOM });
    const victim = other(s, s.holder);
    s = ok(shoot(s, s.holder, victim, T0 + 1000));
    expect(s.alive).not.toContain(victim);
    expect(reason(shoot(s, victim, s.holder, T0 + 4000))).toBe("eliminated");
    expect(reason(shoot(s, s.holder, victim, T0 + 4000))).toBe("bad_target");
  });
});

describe("rus-ruleti: risk", () => {
  it("risk %16'dan başlar, her güvenli atışta 10 artar, en çok %76 olur", () => {
    expect(RUS_RULETI_MAX_RISK).toBe(76);
    let s = start(4);
    const seen: number[] = [s.risk];
    let now = T0;
    // Patlamayan atışlar: riski kısa süreliğine düşük zara çevirmeden, yalnız risk basamağını izler.
    for (let i = 0; i < 9; i++) {
      const safe = { ...s, risk: s.risk };
      // Zarı belirleyen tohumu, bu atışta patlamayacak biçimde ara.
      let picked: RusRuletiState | null = null;
      for (let seed = 0; seed < 5000 && !picked; seed++) {
        const t = ok(shoot({ ...safe, seed }, s.holder, other(s, s.holder), now + RUS_RULETI_OPEN_MS));
        if (t.last && !t.last.exploded) picked = t;
      }
      if (!picked) throw new Error("güvenli atış bulunamadı");
      now += RUS_RULETI_OPEN_MS;
      s = { ...picked, seed: s.seed };
      seen.push(s.risk);
    }
    expect(seen).toEqual([16, 26, 36, 46, 56, 66, 76, 76, 76, 76]);
  });

  it("patlamada risk %16'ya döner", () => {
    const s = start(5, { risk: 66 });
    const boom = ok(shoot({ ...s, risk: BOOM }, s.holder, other(s, s.holder), T0 + 1000));
    expect(boom.risk).toBe(16);
  });

  it("patlama atış anında ctx.rng'den bağımsız, atış sırasından türer: aynı durum aynı sonuç", () => {
    const s = start(4, { risk: 46 });
    const t = other(s, s.holder);
    const a = ok(rusRuleti.reduce(s, s.holder, { kind: "shoot", target: t }, ctx(T0 + 5, ids(4), 1)));
    const b = ok(rusRuleti.reduce(s, s.holder, { kind: "shoot", target: t }, ctx(T0 + 5, ids(4), 99)));
    expect(b).toEqual(a);
  });

  it("patlama olasılığı riske uyar (~%16 ve ~%76)", () => {
    const count = (risk: number): number => {
      let boom = 0;
      const base = start(4, { risk });
      for (let seed = 0; seed < 4000; seed++) {
        const r = ok(shoot({ ...base, seed }, base.holder, other(base, base.holder), T0 + 5));
        if (r.last?.exploded) boom++;
      }
      return boom / 4000;
    };
    expect(count(16)).toBeGreaterThan(0.13);
    expect(count(16)).toBeLessThan(0.19);
    expect(count(76)).toBeGreaterThan(0.73);
    expect(count(76)).toBeLessThan(0.79);
  });
});

describe("rus-ruleti: patlama", () => {
  it("hedef elenir; silah hayatta kalan rastgele birine verilir", () => {
    const owners = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const s = start(8, { risk: BOOM, seed });
      const victim = other(s, s.holder);
      const next = ok(shoot(s, s.holder, victim, T0 + 10));
      expect(next.alive).toEqual(s.alive.filter((x) => x !== victim));
      expect(next.eliminated).toEqual([victim]);
      expect(next.alive).toContain(next.holder);
      expect(next.last).toMatchObject({ exploded: true, target: victim });
      owners.add(next.holder);
    }
    expect(owners.size).toBeGreaterThan(4);
  });

  it("kendini vuran patlarsa kendisi elenir ve silah başkasına geçer", () => {
    const s = start(5, { risk: BOOM });
    const next = ok(shoot(s, s.holder, s.holder, T0 + 10));
    expect(next.alive).not.toContain(s.holder);
    expect(next.eliminated).toEqual([s.holder]);
    expect(next.holder).not.toBe(s.holder);
    expect(next.alive).toContain(next.holder);
  });

  it("birden çok elenme sırayla kaydedilir", () => {
    let s = start(8, { risk: BOOM });
    const v1 = other(s, s.holder);
    s = ok(shoot(s, s.holder, v1, T0 + 10));
    s = { ...s, risk: BOOM };
    const v2 = other(s, s.holder);
    s = ok(shoot(s, s.holder, v2, s.openAt));
    expect(s.eliminated).toEqual([v1, v2]);
  });
});

describe("rus-ruleti: bitiş", () => {
  it("yarı eşiği: hayatta kalan sayısı başlangıcın yarısı ya da altı", () => {
    expect(rusRuletiShouldEnd(2, 1)).toBe(true);
    expect(rusRuletiShouldEnd(3, 2)).toBe(false);
    expect(rusRuletiShouldEnd(3, 1)).toBe(true);
    expect(rusRuletiShouldEnd(4, 3)).toBe(false);
    expect(rusRuletiShouldEnd(4, 2)).toBe(true);
    expect(rusRuletiShouldEnd(5, 3)).toBe(false);
    expect(rusRuletiShouldEnd(5, 2)).toBe(true);
    expect(rusRuletiShouldEnd(7, 4)).toBe(false);
    expect(rusRuletiShouldEnd(7, 3)).toBe(true);
    expect(rusRuletiShouldEnd(8, 5)).toBe(false);
    expect(rusRuletiShouldEnd(8, 4)).toBe(true);
  });

  it.each([
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
  ])("%i oyuncuda %i patlamadan sonra biter, bir önceki patlamada bitmez", (n, booms) => {
    let s = start(n, { risk: BOOM });
    let now = T0 + 10;
    for (let i = 0; i < booms; i++) {
      expect(s.over).toBe(false);
      s = ok(shoot({ ...s, risk: BOOM }, s.holder, other(s, s.holder), now));
      now = s.openAt;
    }
    expect(s.over).toBe(true);
    expect(s.alive.length * 2).toBeLessThanOrEqual(n);
    expect(s.eliminated.length).toBe(booms);
  });

  it("sabit tur sayısı yok: güvenli atışlar süresiz sürer", () => {
    let s = start(3, { risk: SAFE });
    let now = T0 + 10;
    for (let i = 0; i < 40; i++) {
      s = ok(shoot({ ...s, risk: SAFE }, s.holder, other(s, s.holder), now));
      now = s.openAt;
    }
    expect(s.over).toBe(false);
    expect(s.shots).toBe(40);
  });

  it("son atıştan sonra eylem reddedilir (tick beklemeden); oyun açılış süresi dolunca biter", () => {
    const s0 = start(2, { risk: BOOM });
    const s = ok(shoot(s0, s0.holder, other(s0, s0.holder), T0 + 100));
    const holder = s.holder;
    expect(s.over).toBe(true);
    expect(reason(shoot(s, holder, holder, T0 + 10_000))).toBe("ended");
    expect(rusRuleti.isFinished(s, ctx(T0 + 100 + RUS_RULETI_OPEN_MS - 1))).toBe(false);
    expect(rusRuleti.isFinished(s, ctx(T0 + 100 + RUS_RULETI_OPEN_MS))).toBe(true);
  });

  it("oyun bitmeden isFinished false", () => {
    const s = start(4);
    expect(rusRuleti.isFinished(s, ctx(T0 + 1_000_000))).toBe(false);
  });

  it("puan: hayatta kalan +1, elenen 0; genel skor aynı", () => {
    let s = start(4, { risk: BOOM });
    const v1 = other(s, s.holder);
    s = ok(shoot(s, s.holder, v1, T0 + 10));
    s = { ...s, risk: BOOM };
    const v2 = other(s, s.holder);
    s = ok(shoot(s, s.holder, v2, s.openAt));
    expect(s.over).toBe(true);
    const r = rusRuleti.result(s);
    for (const id of ids(4)) expect(r.miniScores[id]).toBe(s.alive.includes(id) ? 1 : 0);
    expect(r.awards).toEqual(r.miniScores);
    expect(Object.values(r.awards).reduce((a, b) => a + b, 0)).toBe(2);
    expect(rusRuleti.publicView(s, ctx(s.openAt)).result).toEqual({
      survivors: s.alive,
      eliminated: [v1, v2],
    });
  });
});

describe("rus-ruleti: karar süresi ve açılış penceresi", () => {
  it("her atıştan sonra 2,5 sn eylem kabul edilmez; pencere bitince 18 sn başlar", () => {
    expect(RUS_RULETI_OPEN_MS).toBe(2_500);
    expect(RUS_RULETI_DECISION_MS).toBe(18_000);
    const s0 = start(4, { risk: SAFE });
    const s1 = ok(shoot(s0, s0.holder, other(s0, s0.holder), T0 + 4_000));
    expect(s1.openAt).toBe(T0 + 6_500);
    expect(s1.deadline).toBe(T0 + 6_500 + 18_000);
    expect(reason(shoot(s1, s1.holder, s1.holder, T0 + 6_499))).toBe("not_open");
    expect(reason(shoot(s1, s1.holder, s1.holder, T0 + 6_500))).toBe("kabul");
  });

  it("süre dolmadan önceki son ms'de eylem kabul edilir, bitiş anında otomatik atış önce işlenir", () => {
    const s = start(4, { risk: SAFE });
    const t = other(s, s.holder);
    expect(reason(shoot(s, s.holder, t, T0 + 17_999))).toBe("kabul");
    // Tam bitiş anında sunucu atışı önce uygulanır; eski sahibin eylemi geçersiz kalır.
    expect(reason(shoot(s, s.holder, t, T0 + 18_000))).not.toBe("kabul");
  });

  it("süre dolunca sahip dışındaki rastgele bir hayatta oyuncuya otomatik ateş edilir", () => {
    const targets = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const s = start(5, { risk: SAFE, seed });
      const next = rusRuleti.tick(s, ctx(T0 + 18_000));
      expect(next.last).toMatchObject({ auto: true, shooter: s.holder, seq: 1 });
      expect(next.last?.target).not.toBe(s.holder);
      expect(s.alive).toContain(next.last?.target);
      expect(next.holder).toBe(next.last?.target);
      targets.add(next.last?.target as string);
    }
    expect(targets.size).toBe(4);
  });

  it("otomatik ateşte patlama olursa hedef elenir ve risk sıfırlanır", () => {
    const s = start(5, { risk: BOOM });
    const next = rusRuleti.tick(s, ctx(T0 + 18_000));
    expect(next.eliminated).toEqual([next.last?.target]);
    expect(next.risk).toBe(16);
    expect(next.last?.exploded).toBe(true);
  });

  it("otomatik atışın zamanı gerçek bitiş anıdır; sonraki pencere ondan kurulur (geç tick sonucu değiştirmez)", () => {
    const s = start(4, { risk: SAFE });
    const next = rusRuleti.tick(s, ctx(T0 + 18_400));
    expect(next.last?.at).toBe(T0 + 18_000);
    expect(next.openAt).toBe(T0 + 20_500);
    expect(next.deadline).toBe(T0 + 38_500);
  });

  it("tick bağlı listesine bakmaz (otomatik atış dahil)", () => {
    const s = start(4, { risk: SAFE });
    expect(() => rusRuleti.tick(s, noConnected(T0 + 5_000))).not.toThrow();
    const next = rusRuleti.tick(s, noConnected(T0 + 18_000));
    expect(next.shots).toBe(1);
  });

  it("bağlantısı kopan silah sahibi de süre dolunca atış yedirir", () => {
    const s = start(4, { risk: SAFE });
    const next = rusRuleti.tick(
      s,
      ctx(
        T0 + 18_000,
        ids(4).filter((x) => x !== s.holder),
      ),
    );
    expect(next.last?.shooter).toBe(s.holder);
    expect(next.last?.auto).toBe(true);
  });

  it("uzun süre tick gelmese de bekleyen tüm süre aşımları sırayla işlenir", () => {
    const s = start(8, { risk: 36 });
    const late = rusRuleti.tick(s, ctx(T0 + 200_000));
    let step = s;
    for (let t = T0; t <= T0 + 200_000; t += 500) step = rusRuleti.tick(step, ctx(t));
    expect(late).toEqual(step);
    expect(late.shots).toBeGreaterThan(5);
  });

  it("tek hayatta kalan sahipse kendine ateş edilir (savunma)", () => {
    const s = start(4, { alive: ["a"], holder: "a", eliminated: ["b", "c", "d"], risk: SAFE });
    const next = rusRuleti.tick(s, ctx(T0 + 18_000));
    expect(next.last?.target).toBe("a");
    expect(next.holder).toBe("a");
  });

  it("değişiklik yoksa tick aynı nesneyi döner", () => {
    const s = start(4);
    expect(rusRuleti.tick(s, ctx(T0 + 17_999))).toBe(s);
    const d0 = start(2, { risk: BOOM });
    const done = ok(shoot(d0, d0.holder, other(d0, d0.holder), T0 + 5));
    expect(rusRuleti.tick(done, ctx(T0 + 900_000))).toBe(done);
  });
});

describe("rus-ruleti: belirlilik ve saflık", () => {
  it("reddedilen eylem ortak rastgele akışı tüketmez (zaman aşımı beklerken bile)", () => {
    const s = start(4);
    const rng = createRng(5);
    const probe = createRng(5);
    const c: GameContext = { now: T0 + 40_000, rng, connected: ids(4) };
    const r = rusRuleti.reduce(s, "ghost", { kind: "shoot", target: "a" }, c);
    expect(isRejected(r)).toBe(true);
    expect(rng.next()).toBe(probe.next());
  });

  it("kabul edilen atış ortak rastgele akışı tüketmez", () => {
    const s = start(4);
    const rng = createRng(5);
    const probe = createRng(5);
    ok(
      rusRuleti.reduce(
        s,
        s.holder,
        { kind: "shoot", target: other(s, s.holder) },
        { now: T0 + 5, rng, connected: ids(4) },
      ),
    );
    expect(rng.next()).toBe(probe.next());
  });

  it("sonuç tick sıklığına bağlı değildir", () => {
    const run = (step: number): RusRuletiState => {
      let s = start(6, { risk: 36 }, 77);
      for (let t = T0; t <= T0 + 400_000; t += step) {
        s = rusRuleti.tick(s, ctx(t));
        // Her 7 sn'de bir sahip kendi elini çeker (kabul edilirse).
        if (t % 7_000 < step) {
          const r = rusRuleti.reduce(s, s.holder, { kind: "shoot", target: other(s, s.holder) }, ctx(t));
          if (!isRejected(r)) s = r;
        }
      }
      return rusRuleti.tick(s, ctx(T0 + 400_000));
    };
    expect(run(100)).toEqual(run(100));
    // Elle ateş zamanları tick sıklığına bağlı olduğundan yalnız tick-tek yol karşılaştırılır:
    const only = (step: number): RusRuletiState => {
      let s = start(6, { risk: 36 }, 77);
      for (let t = T0; t <= T0 + 400_000; t += step) s = rusRuleti.tick(s, ctx(t));
      return rusRuleti.tick(s, ctx(T0 + 400_000));
    };
    expect(only(50)).toEqual(only(3_000));
    expect(only(50)).toEqual(only(20_000));
  });

  it("sonuç zarları görünümlerden önce bilinmez: tohum dışında özdeş iki durumun görünümleri aynıdır", () => {
    const a = start(5, {}, 1);
    const b: RusRuletiState = { ...a, seed: a.seed ^ 0x2abc };
    expect(rusRuleti.publicView(b, ctx(T0))).toEqual(rusRuleti.publicView(a, ctx(T0)));
    for (const p of [...ids(5), null]) {
      expect(rusRuleti.view(b, p, ctx(T0))).toEqual(rusRuleti.view(a, p, ctx(T0)));
    }
    // Gizli tohum hiçbir görünümde geçmez.
    const json = JSON.stringify([
      rusRuleti.publicView(a, ctx(T0)),
      ...[...ids(5), null].map((p) => rusRuleti.view(a, p, ctx(T0))),
    ]);
    expect(json).not.toContain(String(a.seed));
    expect(rusRuleti.secrets(a)).toHaveLength(1);
  });
});

describe("rus-ruleti: görünümler", () => {
  it("publicView silah sahibini, riski ve son atışı herkese gösterir", () => {
    const s0 = start(4, { risk: SAFE });
    const s = ok(shoot(s0, s0.holder, other(s0, s0.holder), T0 + 10));
    const v = rusRuleti.publicView(s, ctx(T0 + 20));
    expect(v.holder).toBe(s.holder);
    expect(v.risk).toBe(10);
    expect(v.last?.seq).toBe(1);
    expect(v.alive).toEqual(ids(4));
    expect(v.deadline).toBe(s.deadline);
    expect(v.over).toBe(false);
    expect(v.result).toBeNull();
  });

  it("kişisel görünüm: hayatta, elenmiş, izleyici", () => {
    const s = start(4, { alive: ["a", "b"], eliminated: ["c", "d"], holder: "a" });
    expect(rusRuleti.view(s, "a", ctx(T0))).toEqual({ role: "alive" });
    expect(rusRuleti.view(s, "c", ctx(T0))).toEqual({ role: "out" });
    expect(rusRuleti.view(s, null, ctx(T0))).toEqual({ role: "spectator" });
    expect(rusRuleti.view(s, "zz", ctx(T0))).toEqual({ role: "spectator" });
  });

  it("bitişte deadline null ve sonuç dolu", () => {
    const s0 = start(2, { risk: BOOM });
    const s = ok(shoot(s0, s0.holder, other(s0, s0.holder), T0 + 10));
    const v = rusRuleti.publicView(s, ctx(T0 + 11));
    expect(v.over).toBe(true);
    expect(v.deadline).toBeNull();
    expect(v.result?.survivors).toHaveLength(1);
  });
});

describe("rus-ruleti: eylem doğrulama", () => {
  it("geçerli eylemi okur, bozukları reddeder", () => {
    expect(rusRuleti.parseAction({ kind: "shoot", target: "a" })).toEqual({ kind: "shoot", target: "a" });
    for (const bad of [
      { kind: "shoot" },
      { kind: "shoot", target: "" },
      { kind: "shoot", target: 3 },
      { kind: "shoot", target: "a", extra: 1 },
      { kind: "shoot", target: "x".repeat(65) },
      { kind: "fire", target: "a" },
      [],
      null,
      "shoot",
    ]) {
      expect(rusRuleti.parseAction(bad)).toBeNull();
    }
  });

  it("briefing kısa: en çok 3 madde", () => {
    expect(rusRuleti.briefing.steps.length).toBeLessThanOrEqual(3);
  });
});
