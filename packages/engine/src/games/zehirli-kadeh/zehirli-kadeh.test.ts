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
    expect(mine).toBe(JSON.stringify({ role: "player" }));
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
    for (const bad of [
      { kind: "swap" },
      { kind: "swap", target: "" },
      { kind: "swap", target: 4 },
      { kind: "swap", target: "b", x: 1 },
      { kind: "swap", target: "y".repeat(65) },
      { kind: "trade", target: "b" },
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
