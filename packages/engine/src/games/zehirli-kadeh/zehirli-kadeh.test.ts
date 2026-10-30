import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type ZehirliKadehState, zehirliKadeh } from "./index.js";
import { zehirliKadehPoisonCount } from "./types.js";

const T0 = 1_000_000;
const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ids = (n: number): string[] => IDS.slice(0, n);
const ctx = (now: number, connected: readonly string[] = IDS, seed = 1): GameContext => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (n = 4, seed = 1, over: Partial<ZehirliKadehState> = {}): ZehirliKadehState => ({
  ...zehirliKadeh.setup(ids(n), ctx(T0, ids(n), seed)),
  ...over,
});
const swap = (s: ZehirliKadehState, who: string, target: string, now: number, connected = IDS) =>
  zehirliKadeh.reduce(s, who, { kind: "swap", target }, ctx(now, connected));
const check = (s: ZehirliKadehState, who: string, target: string, now: number, connected = IDS) =>
  zehirliKadeh.reduce(s, who, { kind: "check", target }, ctx(now, connected));
function ok(r: ZehirliKadehState | { rejected: string }): ZehirliKadehState {
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reason = (r: unknown): string => (isRejected(r) ? r.rejected : "kabul");
const finish = (s: ZehirliKadehState) => zehirliKadeh.tick(s, ctx(s.endsAt));

describe("zehirli-kadeh: kurulum", () => {
  it("2-8 oyuncu, tek aşama 20 sn", () => {
    expect(zehirliKadeh.minPlayers).toBe(2);
    expect(zehirliKadeh.maxPlayers).toBe(8);
    const s = start(4);
    expect(s.endsAt - s.startedAt).toBe(20_000);
  });

  it.each([
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3],
    [8, 3],
  ])("%i oyuncuda %i zehirli kadeh, her oyuncuya bir kadeh", (n, poison) => {
    expect(zehirliKadehPoisonCount(n)).toBe(poison);
    for (let seed = 1; seed <= 30; seed++) {
      const s = start(n, seed);
      expect(s.poisoned).toHaveLength(poison);
      expect(new Set(s.poisoned).size).toBe(poison);
      expect(s.holds).toEqual(ids(n).map((_, i) => i));
      for (const c of s.poisoned) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(n);
      }
    }
  });

  it("zehirli kadehler rastgele dağıtılır (her kadeh zehirli çıkabilir) ve belirlidir", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 300; seed++) for (const c of start(4, seed).poisoned) seen.add(c);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(start(6, 5).poisoned).toEqual(start(6, 5).poisoned);
  });
});

describe("zehirli-kadeh: takas", () => {
  it("takas anında uygulanır: iki oyuncunun kadehi yer değiştirir", () => {
    const s = ok(swap(start(4), "a", "c", T0 + 1000));
    expect(s.holds).toEqual([2, 1, 0, 3]);
    expect(zehirliKadeh.publicView(s, ctx(T0 + 1000)).holdings).toEqual({ a: 2, b: 1, c: 0, d: 3 });
  });

  it("her takas süreyi 5 sn uzatır", () => {
    let s = start(4);
    s = ok(swap(s, "a", "b", T0 + 1000));
    expect(s.endsAt).toBe(T0 + 25_000);
    s = ok(swap(s, "c", "d", T0 + 2000));
    expect(s.endsAt).toBe(T0 + 30_000);
  });

  it("kendinle takas yok", () => {
    expect(reason(swap(start(4), "a", "a", T0 + 1000))).toBe("self_target");
  });

  it("her oyuncu en çok bir kez takas başlatır", () => {
    let s = ok(swap(start(4), "a", "b", T0 + 1000));
    expect(reason(swap(s, "a", "c", T0 + 2000))).toBe("already_swapped");
    expect(reason(swap(s, "a", "b", T0 + 2000))).toBe("already_swapped");
    s = ok(swap(s, "c", "d", T0 + 3000));
    expect(s.swapped).toEqual(["a", "c"]);
  });

  it("hedef olmak hak harcamaz: hedef sonra kendi takasını başlatabilir", () => {
    let s = ok(swap(start(4), "a", "b", T0 + 1000));
    expect(s.swapped).toEqual(["a"]);
    s = ok(swap(s, "b", "c", T0 + 2000));
    expect(s.holds).toEqual([1, 2, 0, 3]);
  });

  it("takas zorunlu değil: hiç takas olmadan süre 20 sn'de biter", () => {
    const s = start(4);
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 19_999))).toBe(false);
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 20_000))).toBe(true);
  });

  it("hedef başka bir bağlı katılımcı olmalı", () => {
    const s = start(4);
    expect(reason(swap(s, "a", "b", T0 + 1000, ["a", "c", "d"]))).toBe("target_offline");
    expect(reason(swap(s, "a", "zz", T0 + 1000, [...ids(4), "zz"]))).toBe("bad_target");
    expect(reason(swap(s, "ghost", "a", T0 + 1000))).toBe("not_participant");
  });

  it("bağlantısı kopmuş oyuncu başkasıyla (bağlıysa) takas edilebilir; kopuk hedef reddedilir", () => {
    const s = start(4);
    expect(reason(swap(s, "a", "b", T0 + 1000, ["a", "b"]))).toBe("kabul");
  });

  it("aynı anda gelen iki takasta sunucu sırası geçerlidir", () => {
    const s = start(4);
    const first = ok(swap(s, "a", "b", T0 + 1000));
    const second = ok(swap(first, "c", "a", T0 + 1000));
    // a: 0↔1 sonra c↔a: a önce 1'i tutuyordu.
    expect(second.holds).toEqual([2, 0, 1, 3]);
    expect(second.swaps.map((x) => x.seq)).toEqual([1, 2]);
    // Ters sırada farklı sonuç: sıra belirleyicidir.
    const rev = ok(swap(ok(swap(s, "c", "a", T0 + 1000)), "a", "b", T0 + 1000));
    expect(rev.holds).not.toEqual(second.holds);
  });

  it("takas geçmişi herkese açık: kim kiminle, sırayla", () => {
    let s = start(4);
    s = ok(swap(s, "b", "a", T0 + 1000));
    s = ok(swap(s, "c", "d", T0 + 2500));
    const v = zehirliKadeh.publicView(s, ctx(T0 + 3000));
    expect(v.swaps).toEqual([
      { seq: 1, from: "b", to: "a", at: T0 + 1000 },
      { seq: 2, from: "c", to: "d", at: T0 + 2500 },
    ]);
    expect(v.swapped).toEqual(["b", "c"]);
    expect(v.endsAt).toBe(T0 + 30_000);
  });
});

describe("zehirli-kadeh: bitiş ve puan", () => {
  it("süre bitince sonuç hemen açılır; öncesinde açılmaz", () => {
    const s = start(4);
    expect(
      zehirliKadeh.publicView(zehirliKadeh.tick(s, ctx(T0 + 19_999)), ctx(T0 + 19_999)).result,
    ).toBeNull();
    const done = finish(s);
    const v = zehirliKadeh.publicView(done, ctx(s.endsAt));
    expect(v.ended).toBe(true);
    expect(v.result?.poisonedCups).toEqual(s.poisoned);
  });

  it("süre bitiminde (tick gelmeden) takas reddedilir; son ms'de kabul edilir", () => {
    const s = start(4);
    expect(reason(swap(s, "a", "b", T0 + 19_999))).toBe("kabul");
    expect(reason(swap(s, "a", "b", T0 + 20_000))).toBe("ended");
  });

  it("tick değişiklik yoksa aynı nesneyi döner; bitişte bir kez değişir", () => {
    const s = start(4);
    expect(zehirliKadeh.tick(s, ctx(T0 + 5))).toBe(s);
    const done = finish(s);
    expect(zehirliKadeh.tick(done, ctx(T0 + 99_000))).toBe(done);
  });

  it("temiz kadehi olanlar +1, zehirli kadehi olanlar 0 (beraberlik yok, hepsi puan alır)", () => {
    const s = start(6, 3);
    const r = zehirliKadeh.result(finish(s));
    for (const [i, id] of ids(6).entries()) expect(r.miniScores[id]).toBe(s.poisoned.includes(i) ? 0 : 1);
    expect(r.awards).toEqual(r.miniScores);
    expect(Object.values(r.awards).filter((x) => x === 1)).toHaveLength(3);
  });

  it("puan takastan sonra elindeki kadehe göre verilir", () => {
    const s0 = start(4, 1, { poisoned: [0, 1] });
    // a (zehirli 0) c (temiz 2) ile takas eder: a temiz, c zehirli.
    const s = ok(swap(s0, "a", "c", T0 + 1000));
    const r = zehirliKadeh.result(finish(s));
    expect(r.miniScores).toEqual({ a: 1, b: 0, c: 0, d: 1 });
    const v = zehirliKadeh.publicView(finish(s), ctx(s.endsAt));
    expect(v.result).toEqual({ clean: ["a", "d"], poisoned: ["b", "c"], poisonedCups: [0, 1] });
  });

  it("tüm kadehler zehirli olamaz: en az bir temiz kadeh kalır", () => {
    for (let n = 2; n <= 8; n++) {
      const r = zehirliKadeh.result(finish(start(n, 9)));
      expect(Object.values(r.awards).some((x) => x === 1)).toBe(true);
    }
  });
});

describe("zehirli-kadeh: gizlilik (yapısal)", () => {
  const viewers = (n: number): (string | null)[] => [...ids(n), null];
  const snapshot = (s: ZehirliKadehState, n: number, now: number) =>
    JSON.stringify([
      zehirliKadeh.publicView(s, ctx(now)),
      ...viewers(n).map((p) => zehirliKadeh.view(s, p, ctx(now))),
    ]);

  it("zehirli kadehler sahibi dahil hiçbir görünümde yoktur: zehir kümesi dışında özdeş durumların görünümleri eşittir", () => {
    const n = 5;
    const a = start(n, 1, { poisoned: [0, 1] });
    const b = start(n, 1, { poisoned: [3, 4] });
    const c = start(n, 1, { poisoned: [2, 0] });
    expect(snapshot(b, n, T0 + 100)).toBe(snapshot(a, n, T0 + 100));
    expect(snapshot(c, n, T0 + 100)).toBe(snapshot(a, n, T0 + 100));
    // takaslardan sonra da
    const sa = ok(swap(a, "a", "e", T0 + 1000));
    const sb = ok(swap(b, "a", "e", T0 + 1000));
    expect(snapshot(sb, n, T0 + 2000)).toBe(snapshot(sa, n, T0 + 2000));
    // son anda (bitişten bir ms önce) hâlâ aynı
    expect(snapshot(sb, n, sb.endsAt - 1)).toBe(snapshot(sa, n, sa.endsAt - 1));
  });

  it("görünümlerde zehir alanı yok; yalnız sonuç açılınca poisonedCups gelir", () => {
    const s = start(4);
    const before = snapshot(s, 4, T0 + 100);
    expect(before).not.toMatch(/poisoned|poisonedCups|zehir|"clean"/i);
    expect(before).toContain("poisonCount");
    const after = snapshot(finish(s), 4, s.endsAt);
    expect(after).toContain("poisonedCups");
  });

  it("sahibi bile kendi kadehinin durumunu göremez: kendi görünümü başkasınınkiyle aynı biçimde", () => {
    const s = start(4, 2);
    const mine = JSON.stringify(zehirliKadeh.view(s, "a", ctx(T0)));
    expect(JSON.stringify(zehirliKadeh.view(s, "b", ctx(T0)))).toBe(mine);
    expect(mine).toBe(JSON.stringify({ role: "player", check: null }));
  });

  it("zehirli kadeh sayısı herkese açık (kurala göre), hangileri olduğu değil", () => {
    expect(zehirliKadeh.publicView(start(8), ctx(T0)).poisonCount).toBe(3);
  });

  it("secrets zehirli kadehleri bildirir, sonuç açılınca boşalır", () => {
    const s = start(6, 4);
    expect(zehirliKadeh.secrets(s)).toHaveLength(3);
    expect(zehirliKadeh.secrets(finish(s))).toEqual([]);
  });
});

describe("zehirli-kadeh: eylem doğrulama", () => {
  it("geçerli eylemi okur, bozukları reddeder", () => {
    expect(zehirliKadeh.parseAction({ kind: "swap", target: "b" })).toEqual({ kind: "swap", target: "b" });
    expect(zehirliKadeh.parseAction({ kind: "check", target: "b" })).toEqual({ kind: "check", target: "b" });
    for (const bad of [
      { kind: "swap" },
      { kind: "swap", target: "" },
      { kind: "swap", target: 4 },
      { kind: "swap", target: "b", x: 1 },
      { kind: "swap", target: "y".repeat(65) },
      { kind: "trade", target: "b" },
      { kind: "check" },
      { kind: "check", target: "" },
      { kind: "check", target: 3 },
      { kind: "check", target: "b", cup: 1 },
      [],
      null,
    ]) {
      expect(zehirliKadeh.parseAction(bad)).toBeNull();
    }
  });
  it("briefing en çok 3 madde", () => {
    expect(zehirliKadeh.briefing.steps.length).toBeLessThanOrEqual(3);
  });
});

describe("zehirli-kadeh: erken bitiş (herkes takas hakkını kullandı)", () => {
  /** 3 oyuncu: a-b, b-c, c-a takasları. */
  const everyone = (): ZehirliKadehState => {
    let s = start(3);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "c", T0 + 3_000));
    s = ok(swap(s, "c", "a", T0 + 4_000));
    return s;
  };

  it("(a) herkes takas edince son takastan 1 sn sonra biter (uzama yok)", () => {
    const s = everyone();
    expect(s.endsAt).toBe(T0 + 5_000);
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 4_999))).toBe(false);
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 5_000))).toBe(true);
    const t = zehirliKadeh.tick(s, ctx(T0 + 5_000));
    expect(t.ended).toBe(true);
    expect(zehirliKadeh.publicView(t, ctx(T0 + 5_000)).result).not.toBeNull();
    // Puanlama aynı: temiz kadeh +1.
    const scores = zehirliKadeh.result(t).miniScores;
    expect(Object.values(scores).reduce((x, y) => x + y, 0)).toBe(2);
  });

  it("(b) bir kişi eksikken bitmez; her takas süreyi 5 sn uzatır", () => {
    let s = start(3);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "c", T0 + 3_000));
    expect(s.endsAt).toBe(T0 + 20_000 + 10_000);
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 25_000))).toBe(false);
  });

  it("(c) bağlantıya bakılmaz: kopuk oyuncu takas etmeden bitmez", () => {
    let s = start(3);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "a", T0 + 3_000));
    expect(zehirliKadeh.isFinished(s, ctx(T0 + 4_000, ["a", "b"]))).toBe(false);
    expect(s.endsAt).toBeGreaterThan(T0 + 20_000);
  });

  it("(d) herkes takas ettikten sonra yeni takas reddedilir", () => {
    const s = everyone();
    expect(reason(swap(s, "a", "b", T0 + 4_500))).toBe("already_swapped");
    expect(reason(swap(s, "a", "b", T0 + 5_000))).toBe("ended");
  });

  it("(e) görünüm yalnız kimlerin takas ettiğini ve kadeh numaralarını açar, zehir bilgisi yok", () => {
    const s = everyone();
    const json = JSON.stringify(zehirliKadeh.publicView(s, ctx(T0 + 4_500)));
    expect(json).not.toContain("poisoned");
    expect(zehirliKadeh.publicView(s, ctx(T0 + 4_500)).result).toBeNull();
  });

  it("(f) tick bağlantıya bakmaz", () => {
    const s = everyone();
    expect(zehirliKadeh.tick(s, ctx(T0 + 6_000, []))).toEqual(zehirliKadeh.tick(s, ctx(T0 + 6_000, IDS)));
  });
});

describe("zehirli-kadeh: kontrol hakkı", () => {
  const priv = (s: ZehirliKadehState, who: string | null, now = T0 + 100) =>
    zehirliKadeh.view(s, who, ctx(now));

  it("hedefin o anki kadehini doğru bildirir (zehirli ve temiz)", () => {
    const s0 = start(4, 1, { poisoned: [1, 3] });
    const a = ok(check(s0, "a", "b", T0 + 1000));
    expect(priv(a, "a").check).toEqual({ cup: 1, poisoned: true });
    const c = ok(check(a, "c", "a", T0 + 1100));
    expect(priv(c, "c").check).toEqual({ cup: 0, poisoned: false });
  });

  it("kontrol hakkı bir kez kullanılır; ikinci kontrol reddedilir", () => {
    const s = ok(check(start(4), "a", "b", T0 + 1000));
    expect(reason(check(s, "a", "c", T0 + 2000))).toBe("already_checked");
    expect(reason(check(s, "a", "b", T0 + 2000))).toBe("already_checked");
  });

  it("kendi kadehini kontrol edemez; hedef katılımcı olmalı; yalnız katılımcı kontrol eder", () => {
    const s = start(4);
    expect(reason(check(s, "a", "a", T0 + 1000))).toBe("self_target");
    expect(reason(check(s, "a", "zz", T0 + 1000, [...IDS, "zz"]))).toBe("bad_target");
    expect(reason(check(s, "ghost", "a", T0 + 1000))).toBe("not_participant");
  });

  it("kopuk oyuncunun kadehi de kontrol edilebilir (bağlı olma şartı yok)", () => {
    const s = start(4, 1, { poisoned: [1] });
    const r = ok(check(s, "a", "b", T0 + 1000, ["a", "c", "d"]));
    expect(priv(r, "a").check).toEqual({ cup: 1, poisoned: true });
  });

  it("süre bitince reddedilir; son ms'de kabul edilir; başlamadan reddedilir", () => {
    const s = start(4);
    expect(reason(check(s, "a", "b", T0 + 19_999))).toBe("kabul");
    expect(reason(check(s, "a", "b", T0 + 20_000))).toBe("ended");
    expect(reason(check(finish(s), "a", "b", T0 + 1000))).toBe("ended");
    expect(reason(check(s, "a", "b", T0 - 1))).toBe("not_started");
  });

  it("kontrol süreyi, kadehleri ve takas hakkını değiştirmez", () => {
    const s = start(4);
    const r = ok(check(s, "a", "b", T0 + 1000));
    expect(r.endsAt).toBe(s.endsAt);
    expect(r.holds).toEqual(s.holds);
    expect(r.swapped).toEqual([]);
    // Kontrolden sonra takas hakkı durur; takastan sonra kontrol hakkı durur.
    const t = ok(swap(r, "a", "c", T0 + 2000));
    expect(reason(check(ok(swap(start(4), "b", "c", T0 + 500)), "b", "a", T0 + 600))).toBe("kabul");
    expect(t.swapped).toEqual(["a"]);
  });

  it("bilgi kadeh NUMARASINA bağlıdır: kadeh takasla yer değiştirse de doğru kalır", () => {
    const s0 = start(4, 1, { poisoned: [1] });
    // a, b'nin kadehini (1, zehirli) kontrol eder; sonra b c ile takas eder: kadeh 1 artık c'de.
    let s = ok(check(s0, "a", "b", T0 + 1000));
    s = ok(swap(s, "b", "c", T0 + 2000));
    expect(s.holds[2]).toBe(1);
    expect(priv(s, "a").check).toEqual({ cup: 1, poisoned: true });
    // a kadeh 1'i kendisi alırsa da bilgi aynı kalır.
    s = ok(swap(s, "a", "c", T0 + 3000));
    expect(s.holds[0]).toBe(1);
    expect(priv(s, "a").check).toEqual({ cup: 1, poisoned: true });
    // Sonuç bunu doğrular: a zehirli kadehte kaldı.
    expect(zehirliKadeh.result(finish(s)).miniScores.a).toBe(0);
  });

  it("aynı kadehi iki kişi kontrol edebilir; ikisi de aynı sonucu görür", () => {
    const s0 = start(3, 1, { poisoned: [2] });
    const s = ok(check(ok(check(s0, "a", "c", T0 + 1000)), "b", "c", T0 + 1200));
    expect(priv(s, "a").check).toEqual({ cup: 2, poisoned: true });
    expect(priv(s, "b").check).toEqual({ cup: 2, poisoned: true });
  });
});

describe("zehirli-kadeh: kontrol gizliliği", () => {
  const others = (s: ZehirliKadehState, n: number, except: string, now: number) =>
    JSON.stringify([
      zehirliKadeh.publicView(s, ctx(now)),
      ...[...ids(n), null].filter((p) => p !== except).map((p) => zehirliKadeh.view(s, p, ctx(now))),
    ]);

  it("kontrol eden dışında hiçbir görünüm değişmez (kontrolün yapıldığı bile görünmez)", () => {
    const n = 5;
    const s = start(n, 2);
    const checked = ok(check(s, "a", "c", T0 + 1000));
    expect(others(checked, n, "a", T0 + 1500)).toBe(others(s, n, "a", T0 + 1500));
    expect(zehirliKadeh.view(checked, "a", ctx(T0 + 1500))).not.toEqual(
      zehirliKadeh.view(s, "a", ctx(T0 + 1500)),
    );
    // Takaslardan sonra ve süre bitiminden hemen önce de aynı.
    const sw = (x: ZehirliKadehState) => ok(swap(x, "b", "c", T0 + 2000));
    expect(others(sw(checked), n, "a", T0 + 2500)).toBe(others(sw(s), n, "a", T0 + 2500));
    // Sonuç açıldıktan sonra da kontrol izi yok.
    const end = (x: ZehirliKadehState) => finish(sw(x));
    expect(others(end(checked), n, "a", end(s).endsAt)).toBe(others(end(s), n, "a", end(s).endsAt));
    expect(JSON.stringify(zehirliKadeh.publicView(end(checked), ctx(end(s).endsAt)))).not.toContain("check");
  });

  it("izleyici ve başka oyuncular kontrol sonucunu almaz; kontrol eden alır", () => {
    const s = ok(check(start(4, 1, { poisoned: [2] }), "a", "c", T0 + 1000));
    expect(zehirliKadeh.view(s, null, ctx(T0 + 1100))).toEqual({ role: "spectator", check: null });
    for (const p of ["b", "c", "d"]) expect(zehirliKadeh.view(s, p, ctx(T0 + 1100)).check).toBeNull();
    expect(zehirliKadeh.view(s, "a", ctx(T0 + 1100)).check).toEqual({ cup: 2, poisoned: true });
  });

  it("secrets kontrol sonucunu yalnız kontrol edene ait bildirir; zehir bilgisi sonuçta boşalır", () => {
    let s = start(4, 1, { poisoned: [1, 2] });
    s = ok(check(s, "a", "b", T0 + 1000));
    s = ok(check(s, "c", "b", T0 + 1000));
    s = ok(check(s, "d", "a", T0 + 1000));
    const sec = zehirliKadeh.secrets(s);
    const checks = sec.filter((e) => e.ownerIds.length > 0);
    expect(checks).toHaveLength(2);
    expect(checks.find((e) => e.ownerIds.includes("a"))?.ownerIds).toEqual(["a", "c"]);
    expect(checks.find((e) => e.ownerIds.includes("d"))?.ownerIds).toEqual(["d"]);
    for (const e of checks) {
      for (const p of ["a", "b", "c", "d", null]) {
        const json = JSON.stringify(zehirliKadeh.view(s, p, ctx(T0 + 1100)));
        expect(json.includes(e.value)).toBe(p !== null && e.ownerIds.includes(p));
      }
      expect(JSON.stringify(zehirliKadeh.publicView(s, ctx(T0 + 1100))).includes(e.value)).toBe(false);
    }
    // Sonuçta zehir kayıtları boşalır, kontrol kayıtları sahiplerine bağlı kalır.
    const done = zehirliKadeh.secrets(finish(s));
    expect(done.every((e) => e.ownerIds.length > 0)).toBe(true);
    expect(done).toHaveLength(2);
  });
});

describe("zehirli-kadeh: erken bitiş kontrolden etkilenmez", () => {
  it("herkes takas edince kontrol hakkı kullanılmamış olsa da 1 sn sonra biter", () => {
    let s = start(3);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "c", T0 + 3_000));
    s = ok(swap(s, "c", "a", T0 + 4_000));
    expect(s.checks).toEqual([]);
    expect(s.endsAt).toBe(T0 + 5_000);
  });

  it("herkes kontrol etse de takas etmeyen varken erken bitmez, süre uzamaz", () => {
    let s = start(3);
    s = ok(check(s, "a", "b", T0 + 1_000));
    s = ok(check(s, "b", "c", T0 + 1_100));
    s = ok(check(s, "c", "a", T0 + 1_200));
    expect(s.endsAt).toBe(T0 + 20_000);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "c", T0 + 3_000));
    expect(s.endsAt).toBe(T0 + 30_000);
    s = ok(swap(s, "c", "a", T0 + 4_000));
    expect(s.endsAt).toBe(T0 + 5_000);
  });

  it("herkes takas ettikten sonra kalan 1 sn içinde kontrol hâlâ yapılabilir ve bitişi değiştirmez", () => {
    let s = start(2);
    s = ok(swap(s, "a", "b", T0 + 2_000));
    s = ok(swap(s, "b", "a", T0 + 3_000));
    expect(s.endsAt).toBe(T0 + 4_000);
    const r = ok(check(s, "a", "b", T0 + 3_500));
    expect(r.endsAt).toBe(T0 + 4_000);
    expect(reason(check(s, "a", "b", T0 + 4_000))).toBe("ended");
  });
});
