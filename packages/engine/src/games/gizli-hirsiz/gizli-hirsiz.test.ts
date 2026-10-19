import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type GizliHirsizState, gizliHirsiz, gizliHirsizScores } from "./index.js";
import { GIZLI_HIRSIZ_DURATION_MS } from "./types.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL) => ({
  now,
  rng: createRng(1),
  connected,
});
const start = (players = ALL): GizliHirsizState => gizliHirsiz.setup(players, ctx(T0));

function steal(state: GizliHirsizState, id: string, at: number): GizliHirsizState {
  const r = gizliHirsiz.reduce(state, id, { kind: "steal" }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const END = GIZLI_HIRSIZ_DURATION_MS;
const finish = (s: GizliHirsizState) => gizliHirsiz.result(gizliHirsiz.tick(s, ctx(T0 + END)));

describe("gizli-hirsiz kuralları", () => {
  it("2-8 oyuncu, tek aşama, 30 sn", () => {
    expect(gizliHirsiz.minPlayers).toBe(2);
    expect(gizliHirsiz.maxPlayers).toBe(8);
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(30_000);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + END - 1))).toBe(false);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + END))).toBe(true);
  });

  it("tek kişi basarsa +1, diğerleri 0", () => {
    const r = finish(steal(start(), "b", 5_000));
    expect(r.miniScores).toEqual({ a: 0, b: 1, c: 0, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("iki kişi basarsa ikisi de -1, basmayanlar 0", () => {
    let s = steal(start(), "a", 1_000);
    s = steal(s, "c", 29_000);
    expect(finish(s).awards).toEqual({ a: -1, b: 0, c: -1, d: 0 });
  });

  it("herkes basarsa herkes -1", () => {
    let s = start();
    for (const id of ALL) s = steal(s, id, 2_000);
    expect(finish(s).awards).toEqual({ a: -1, b: -1, c: -1, d: -1 });
  });

  it("kimse basmazsa herkes 0", () => {
    expect(finish(start()).awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("ikinci basış yok sayılır: tek basan iki kez basınca yine +1 (çoklu sayılmaz)", () => {
    let s = steal(start(), "a", 1_000);
    s = steal(s, "a", 2_000);
    s = steal(s, "a", 3_000);
    expect(s.presses).toEqual([{ id: "a", at: T0 + 1_000 }]);
    expect(finish(s).awards.a).toBe(1);
  });

  it("ilk geçerli basış zaman damgasıyla kaydedilir", () => {
    let s = steal(start(), "c", 700);
    s = steal(s, "a", 900);
    expect(s.presses).toEqual([
      { id: "c", at: T0 + 700 },
      { id: "a", at: T0 + 900 },
    ]);
  });

  it("süre dolduktan sonra gelen basış reddedilir; sonuç değişmez", () => {
    const s = steal(start(), "a", 10);
    const late = gizliHirsiz.reduce(s, "b", { kind: "steal" }, ctx(T0 + END));
    expect(late).toEqual({ rejected: "ended" });
    expect(gizliHirsiz.reduce(s, "b", { kind: "steal" }, ctx(T0 + END + 5_000))).toEqual({
      rejected: "ended",
    });
    expect(finish(s).awards).toEqual({ a: 1, b: 0, c: 0, d: 0 });
  });

  it("son milisaniyedeki basış geçerlidir", () => {
    const s = steal(start(), "d", END - 1);
    expect(finish(s).awards.d).toBe(1);
  });

  it("katılımcı olmayan reddedilir; başlamadan önceki basış reddedilir", () => {
    expect(gizliHirsiz.reduce(start(), "x", { kind: "steal" }, ctx(T0 + 5))).toEqual({
      rejected: "not_participant",
    });
    expect(gizliHirsiz.reduce(start(), "a", { kind: "steal" }, ctx(T0 - 1))).toEqual({
      rejected: "not_started",
    });
  });

  it("bağlantısı kopuk oyuncunun basışı da sayılır; bağlı listesi sonucu etkilemez", () => {
    const s0 = start();
    const s1 = gizliHirsiz.reduce(s0, "a", { kind: "steal" }, ctx(T0 + 100, ["b", "c"]));
    if (isRejected(s1)) throw new Error("reddedildi");
    const r1 = gizliHirsiz.result(gizliHirsiz.tick(s1, ctx(T0 + END, [])));
    const r2 = gizliHirsiz.result(gizliHirsiz.tick(s1, ctx(T0 + END, ALL)));
    expect(r1).toEqual(r2);
    expect(r1.awards.a).toBe(1);
  });

  it("puan fonksiyonu: tablo", () => {
    expect(gizliHirsizScores(["a", "b"], [])).toEqual({ a: 0, b: 0 });
    expect(gizliHirsizScores(["a", "b"], ["b"])).toEqual({ a: 0, b: 1 });
    expect(gizliHirsizScores(["a", "b", "c"], ["a", "b"])).toEqual({ a: -1, b: -1, c: 0 });
  });

  it("eylem ayrıştırma: yalnız {kind:'steal'}", () => {
    expect(gizliHirsiz.parseAction({ kind: "steal" })).toEqual({ kind: "steal" });
    expect(gizliHirsiz.parseAction({ kind: "steal", extra: 1 })).toBeNull();
    expect(gizliHirsiz.parseAction({ kind: "press" })).toBeNull();
    expect(gizliHirsiz.parseAction([])).toBeNull();
    expect(gizliHirsiz.parseAction("steal")).toBeNull();
  });

  it("sonuç, tick zamanlamasından bağımsız: tick'siz de doğru", () => {
    const s = steal(start(), "a", 10);
    expect(gizliHirsiz.result(s).awards).toEqual({ a: 1, b: 0, c: 0, d: 0 });
  });
});

describe("gizli-hirsiz gizlilik (kim bastığı sona kadar gizli)", () => {
  const ids = ["p1", "p2", "p3", "p4"];
  const json = (v: unknown) => JSON.stringify(v);

  it("süre dolana kadar publicView basış hakkında hiçbir şey içermez", () => {
    const empty = start(ids);
    const base = json(gizliHirsiz.publicView(empty, ctx(T0 + 1_000, ids)));
    let s = empty;
    for (const [i, id] of ["p2", "p4"].entries()) s = steal(s, id, 1_000 + i);
    const after = gizliHirsiz.publicView(s, ctx(T0 + 20_000, ids));
    expect(after.reveal).toBeNull();
    expect(after.finished).toBe(false);
    expect(json(after)).toBe(base);
  });

  it("başkasının görünümü, başka biri bastığında değişmez; yalnız basanın kendi görünümü değişir", () => {
    const s0 = start(ids);
    const c = ctx(T0 + 5_000, ids);
    const before = Object.fromEntries(ids.map((id) => [id, json(gizliHirsiz.view(s0, id, c))]));
    const beforeSpec = json(gizliHirsiz.view(s0, null, c));
    const s1 = steal(s0, "p2", 3_000);
    for (const id of ids) {
      const now = json(gizliHirsiz.view(s1, id, c));
      if (id === "p2") expect(now).not.toBe(before[id]);
      else expect(now).toBe(before[id]);
    }
    expect(json(gizliHirsiz.view(s1, null, c))).toBe(beforeSpec);
    expect(gizliHirsiz.view(s1, "p2", c)).toEqual({ pressed: true });
    expect(gizliHirsiz.view(s1, "p1", c)).toEqual({ pressed: false });
  });

  it("görünümlerde kimlik, zaman damgası ya da basış sırası geçmez", () => {
    let s = start(ids);
    s = steal(s, "p3", 4_321);
    const c = ctx(T0 + 10_000, ids);
    const all = [
      json(gizliHirsiz.publicView(s, c)),
      ...ids.filter((i) => i !== "p3").map((i) => json(gizliHirsiz.view(s, i, c))),
      json(gizliHirsiz.view(s, null, c)),
    ].join("|");
    expect(all).not.toContain("p3");
    expect(all).not.toContain(String(T0 + 4_321));
    expect(all).not.toContain("4321");
  });

  it("süre dolunca sonuç herkese açılır (basanlar ve puanlar)", () => {
    let s = start(ids);
    s = steal(s, "p3", 1);
    s = steal(s, "p1", 2);
    const pub = gizliHirsiz.publicView(s, ctx(T0 + END, ids));
    expect(pub.finished).toBe(true);
    expect(pub.reveal).toEqual({
      thieves: ["p3", "p1"],
      outcome: "multi",
      scores: { p1: -1, p2: 0, p3: -1, p4: 0 },
    });
    expect(gizliHirsiz.publicView(start(ids), ctx(T0 + END, ids)).reveal?.outcome).toBe("none");
    const solo = gizliHirsiz.publicView(steal(start(ids), "p2", 5), ctx(T0 + END, ids));
    expect(solo.reveal?.outcome).toBe("solo");
  });

  it("izleyici basamaz ve hiçbir şey görmez", () => {
    expect(gizliHirsiz.view(start(ids), null, ctx(T0 + 100, ids))).toEqual({ pressed: false });
  });
});

describe("gizli-hirsiz erken bitiş (herkes bastı)", () => {
  const everyone = (): GizliHirsizState => {
    let s = start();
    for (const [i, id] of ALL.entries()) s = steal(s, id, 4_000 + i * 100);
    return s;
  };
  const rejection = (s: GizliHirsizState, id: string, at: number): string | null => {
    const r = gizliHirsiz.reduce(s, id, { kind: "steal" }, ctx(T0 + at));
    return isRejected(r) ? r.rejected : null;
  };

  it("(a) herkes basınca son basıştan 1 sn sonra biter; herkes -1", () => {
    const s = everyone(); // son basış 4 300
    expect(s.endsAt).toBe(T0 + 5_300);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + 5_299))).toBe(false);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + 5_300))).toBe(true);
    expect(gizliHirsiz.publicView(s, ctx(T0 + 5_299)).reveal).toBeNull();
    expect(gizliHirsiz.publicView(s, ctx(T0 + 5_300)).reveal?.outcome).toBe("multi");
    expect(gizliHirsiz.result(s).miniScores).toEqual({ a: -1, b: -1, c: -1, d: -1 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = steal(s, id, 4_000);
    expect(s.endsAt).toBe(T0 + END);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + 20_000))).toBe(false);
  });

  it("(c) bağlantıya bakılmaz: kopuk oyuncu basmadan bitmez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = steal(s, id, 4_000);
    expect(gizliHirsiz.tick(s, ctx(T0 + 10_000, ["a", "b", "c"]))).toBe(s);
    expect(s.endsAt).toBe(T0 + END);
  });

  it("(d) herkes bastıktan sonra yeni basış kabul edilmez", () => {
    const s = everyone();
    expect(rejection(s, "a", 5_000)).toBeNull(); // tekrar basış yok sayılır (gizlilik için aynı cevap)
    expect(rejection(s, "a", 5_300)).toBe("ended");
  });

  it("(e) süre dolmadan kim bastığı hiçbir görünümde yoktur", () => {
    const s = steal(start(), "a", 4_000);
    expect(JSON.stringify(gizliHirsiz.publicView(s, ctx(T0 + 5_000)))).not.toMatch(/thieves|presses|"a"/);
  });

  it("(f) tick bağlantıya bakmaz", () => {
    const s = everyone();
    expect(gizliHirsiz.tick(s, ctx(T0 + 8_000, []))).toEqual(gizliHirsiz.tick(s, ctx(T0 + 8_000, ALL)));
  });
});
