import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type GizliHirsizState, gizliHirsiz, gizliHirsizScores } from "./index.js";
import {
  GIZLI_HIRSIZ_DURATION_MS,
  GIZLI_HIRSIZ_REVEAL_MS,
  GIZLI_HIRSIZ_SIGNAL_MS,
  type GizliHirsizChoice,
} from "./types.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = ALL) => ({
  now,
  rng: createRng(1),
  connected,
});
const start = (players = ALL): GizliHirsizState => gizliHirsiz.setup(players, ctx(T0, players));

function act(
  state: GizliHirsizState,
  id: string,
  at: number,
  kind: GizliHirsizChoice,
  connected: readonly string[] = state.players,
): GizliHirsizState {
  const r = gizliHirsiz.reduce(state, id, { kind }, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const steal = (s: GizliHirsizState, id: string, at: number) => act(s, id, at, "steal");
const pass = (s: GizliHirsizState, id: string, at: number) => act(s, id, at, "pass");
const END = GIZLI_HIRSIZ_DURATION_MS;
const finish = (s: GizliHirsizState) => gizliHirsiz.result(gizliHirsiz.tick(s, ctx(T0 + END)));

describe("gizli-hirsiz kuralları", () => {
  it("2-8 oyuncu, tek aşama, 30 sn; açılış 4,5 sn gösterilir", () => {
    expect(gizliHirsiz.minPlayers).toBe(2);
    expect(gizliHirsiz.maxPlayers).toBe(8);
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(30_000);
    expect(gizliHirsiz.revealAt?.(s, ctx(T0))).toBe(T0 + END);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + END))).toBe(false);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + END + GIZLI_HIRSIZ_REVEAL_MS - 1))).toBe(false);
    expect(gizliHirsiz.isFinished(s, ctx(T0 + END + GIZLI_HIRSIZ_REVEAL_MS))).toBe(true);
  });

  it("tek kişi çalarsa +1, diğerleri 0", () => {
    const r = finish(steal(start(), "b", 5_000));
    expect(r.miniScores).toEqual({ a: 0, b: 1, c: 0, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("iki kişi çalarsa ikisi de -1, çalmayanlar 0", () => {
    let s = steal(start(), "a", 1_000);
    s = steal(s, "c", 29_000);
    expect(finish(s).awards).toEqual({ a: -1, b: 0, c: -1, d: 0 });
  });

  it("herkes çalarsa herkes -1", () => {
    let s = start();
    for (const id of ALL) s = steal(s, id, 2_000);
    expect(finish(s).awards).toEqual({ a: -1, b: -1, c: -1, d: -1 });
  });

  it("kimse çalmazsa herkes 0", () => {
    expect(finish(start()).awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("GH-M1: ÇALMA puanı değiştirmez (çalmamakla aynı)", () => {
    let s = steal(start(), "b", 5_000);
    s = pass(s, "a", 6_000);
    s = pass(s, "c", 7_000);
    expect(finish(s).awards).toEqual({ a: 0, b: 1, c: 0, d: 0 });
  });

  it("GH-M1: karar geri alınmaz; sonraki eylemler yok sayılır", () => {
    let s = steal(start(), "a", 1_000);
    s = steal(s, "a", 2_000);
    s = pass(s, "a", 3_000);
    expect(s.presses).toEqual([{ id: "a", at: T0 + 1_000 }]);
    expect(s.passes).toEqual([]);
    let t = pass(start(), "b", 1_000);
    t = steal(t, "b", 2_000);
    expect(t.presses).toEqual([]);
    expect(t.passes).toEqual(["b"]);
    expect(finish(s).awards.a).toBe(1);
    expect(finish(t).awards.b).toBe(0);
  });

  it("ÇAL kararı zaman damgasıyla kaydedilir", () => {
    let s = steal(start(), "c", 700);
    s = steal(s, "a", 900);
    expect(s.presses).toEqual([
      { id: "c", at: T0 + 700 },
      { id: "a", at: T0 + 900 },
    ]);
  });

  it("süre dolduktan sonra gelen karar reddedilir; sonuç değişmez", () => {
    const s = steal(start(), "a", 10);
    expect(gizliHirsiz.reduce(s, "b", { kind: "steal" }, ctx(T0 + END))).toEqual({ rejected: "ended" });
    expect(gizliHirsiz.reduce(s, "b", { kind: "pass" }, ctx(T0 + END + 5_000))).toEqual({
      rejected: "ended",
    });
    expect(finish(s).awards).toEqual({ a: 1, b: 0, c: 0, d: 0 });
  });

  it("son milisaniyedeki karar geçerlidir", () => {
    expect(finish(steal(start(), "d", END - 1)).awards.d).toBe(1);
  });

  it("katılımcı olmayan reddedilir; başlamadan önceki karar reddedilir", () => {
    expect(gizliHirsiz.reduce(start(), "x", { kind: "steal" }, ctx(T0 + 5))).toEqual({
      rejected: "not_participant",
    });
    expect(gizliHirsiz.reduce(start(), "a", { kind: "pass" }, ctx(T0 - 1))).toEqual({
      rejected: "not_started",
    });
  });

  it("bağlantısı kopuk oyuncunun kararı da sayılır; bağlı listesi sonucu etkilemez", () => {
    const s1 = act(start(), "a", 100, "steal", ["b", "c"]);
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

  it("eylem ayrıştırma: yalnız {kind:'steal'} ve {kind:'pass'}", () => {
    expect(gizliHirsiz.parseAction({ kind: "steal" })).toEqual({ kind: "steal" });
    expect(gizliHirsiz.parseAction({ kind: "pass" })).toEqual({ kind: "pass" });
    expect(gizliHirsiz.parseAction({ kind: "steal", extra: 1 })).toBeNull();
    expect(gizliHirsiz.parseAction({ kind: "press" })).toBeNull();
    expect(gizliHirsiz.parseAction([])).toBeNull();
    expect(gizliHirsiz.parseAction("steal")).toBeNull();
  });

  it("sonuç, tick zamanlamasından bağımsız: tick'siz de doğru", () => {
    const s = steal(start(), "a", 10);
    expect(gizliHirsiz.result(s).awards).toEqual({ a: 1, b: 0, c: 0, d: 0 });
  });

  it("açılış çalanları sırasıyla ve ÇAL saniyeleriyle verir (GH-U5 / GH-U6)", () => {
    let s = steal(start(), "c", 3_200);
    s = pass(s, "b", 4_000);
    s = steal(s, "a", 27_900);
    const pub = gizliHirsiz.publicView(s, ctx(T0 + END));
    expect(pub.reveal).toEqual({
      thieves: ["c", "a"],
      pressedAt: [3_200, 27_900],
      outcome: "multi",
      scores: { a: -1, b: 0, c: -1, d: 0 },
    });
  });

  it("nextWake: işaret, bitiş ve açılış sonu", () => {
    const s = start();
    expect(gizliHirsiz.nextWake?.(s, ctx(T0))).toBe(T0 + GIZLI_HIRSIZ_SIGNAL_MS);
    expect(gizliHirsiz.nextWake?.(s, ctx(T0 + GIZLI_HIRSIZ_SIGNAL_MS))).toBe(T0 + END);
    expect(gizliHirsiz.nextWake?.(s, ctx(T0 + END))).toBe(T0 + END + GIZLI_HIRSIZ_REVEAL_MS);
    expect(gizliHirsiz.nextWake?.(s, ctx(T0 + END + GIZLI_HIRSIZ_REVEAL_MS))).toBeNull();
    const two = start(["a", "b"]);
    expect(gizliHirsiz.nextWake?.(two, ctx(T0, ["a", "b"]))).toBe(T0 + END);
  });
});

describe("gizli-hirsiz gizlilik (kim ne seçti sona kadar gizli)", () => {
  const ids = ["p1", "p2", "p3", "p4"];
  const json = (v: unknown) => JSON.stringify(v);
  const withChoices = (choices: Record<string, GizliHirsizChoice>): GizliHirsizState => {
    let s = start(ids);
    let t = 1_000;
    for (const [id, kind] of Object.entries(choices)) {
      t += 500;
      s = act(s, id, t, kind);
    }
    return s;
  };

  it("GH-M1 sızıntı: karar listesi seçimi sızdırmaz (ÇAL ile ÇALMA görünümde aynı)", () => {
    const stole = withChoices({ p2: "steal", p4: "pass" });
    const passed = withChoices({ p2: "pass", p4: "steal" });
    for (const at of [3_000, GIZLI_HIRSIZ_SIGNAL_MS - 1]) {
      const c = ctx(T0 + at, ids);
      expect(json(gizliHirsiz.publicView(stole, c))).toBe(json(gizliHirsiz.publicView(passed, c)));
      for (const id of ["p1", "p3"]) {
        expect(json(gizliHirsiz.view(stole, id, c))).toBe(json(gizliHirsiz.view(passed, id, c)));
      }
      expect(json(gizliHirsiz.view(stole, null, c))).toBe(json(gizliHirsiz.view(passed, null, c)));
    }
    const pub = gizliHirsiz.publicView(stole, ctx(T0 + 3_000, ids));
    expect(pub.decided).toEqual(["p2", "p4"]);
    expect(json(pub)).not.toMatch(/steal|pass|thieves|presses/);
  });

  it("işaretten sonra yalnız ortak işaret farklıdır (kimlik, sayı yok)", () => {
    const stole = withChoices({ p2: "steal", p4: "pass" });
    const passed = withChoices({ p2: "pass", p4: "pass" });
    const c = ctx(T0 + GIZLI_HIRSIZ_SIGNAL_MS + 100, ids);
    const a = gizliHirsiz.publicView(stole, c);
    const b = gizliHirsiz.publicView(passed, c);
    expect(a.signal).toBe("stir");
    expect(b.signal).toBe("quiet");
    expect({ ...a, signal: null }).toEqual({ ...b, signal: null });
  });

  it("başkasının görünümü, başka biri karar verince değişmez; yalnız kendi görünümü değişir", () => {
    const s0 = start(ids);
    const c = ctx(T0 + 5_000, ids);
    const before = Object.fromEntries(ids.map((id) => [id, json(gizliHirsiz.view(s0, id, c))]));
    const s1 = steal(s0, "p2", 3_000);
    for (const id of ids) {
      const now = json(gizliHirsiz.view(s1, id, c));
      if (id === "p2") expect(now).not.toBe(before[id]);
      else expect(now).toBe(before[id]);
    }
    expect(gizliHirsiz.view(s1, "p2", c)).toEqual({ choice: "steal" });
    expect(gizliHirsiz.view(pass(s1, "p3", 3_500), "p3", c)).toEqual({ choice: "pass" });
    expect(gizliHirsiz.view(s1, "p1", c)).toEqual({ choice: null });
  });

  it("görünümlerde zaman damgası ya da ÇAL sırası geçmez", () => {
    const s = steal(start(ids), "p3", 4_321);
    const c = ctx(T0 + 10_000, ids);
    const all = [
      json(gizliHirsiz.publicView(s, c)),
      ...ids.filter((i) => i !== "p3").map((i) => json(gizliHirsiz.view(s, i, c))),
      json(gizliHirsiz.view(s, null, c)),
    ].join("|");
    expect(all).not.toContain(String(T0 + 4_321));
    expect(all).not.toContain("4321");
  });

  it("süre dolunca sonuç herkese açılır (çalanlar ve puanlar)", () => {
    let s = start(ids);
    s = steal(s, "p3", 1);
    s = steal(s, "p1", 2);
    const pub = gizliHirsiz.publicView(s, ctx(T0 + END, ids));
    expect(pub.finished).toBe(true);
    expect(pub.reveal?.thieves).toEqual(["p3", "p1"]);
    expect(pub.reveal?.scores).toEqual({ p1: -1, p2: 0, p3: -1, p4: 0 });
    expect(gizliHirsiz.publicView(start(ids), ctx(T0 + END, ids)).reveal?.outcome).toBe("none");
    const solo = gizliHirsiz.publicView(steal(start(ids), "p2", 5), ctx(T0 + END, ids));
    expect(solo.reveal?.outcome).toBe("solo");
  });

  it("izleyici karar veremez ve hiçbir şey görmez", () => {
    expect(gizliHirsiz.view(steal(start(ids), "p1", 5), null, ctx(T0 + 100, ids))).toEqual({
      choice: null,
    });
  });
});

describe("gizli-hirsiz kasada kıpırtı (GH-M2)", () => {
  const S = GIZLI_HIRSIZ_SIGNAL_MS;
  const sig = (s: GizliHirsizState, at: number) => gizliHirsiz.publicView(s, ctx(T0 + at, s.players)).signal;

  it("15. saniyeden önce işaret yok; sonra sessiz ya da kıpırtı", () => {
    const quiet = pass(start(), "a", 2_000);
    expect(sig(quiet, S - 1)).toBeNull();
    expect(sig(quiet, S)).toBe("quiet");
    const stir = steal(start(), "a", 2_000);
    expect(sig(stir, S - 1)).toBeNull();
    expect(sig(stir, S)).toBe("stir");
    expect(gizliHirsiz.publicView(stir, ctx(T0 + S)).signalAt).toBe(T0 + S);
  });

  it("işaret yalnız 15. saniyedeki durumu söyler; sonraki ÇAL'lar değiştirmez", () => {
    let s = pass(start(), "b", 1_000);
    s = steal(s, "a", S + 500);
    expect(sig(s, S + 600)).toBe("quiet");
    expect(sig(s, END)).toBe("quiet");
  });

  it("ÇALMA kararları işareti etkilemez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = pass(s, id, 1_000);
    expect(sig(s, S)).toBe("quiet");
  });

  it("2 oyuncuda işaret yoktur", () => {
    const two = steal(start(["a", "b"]), "a", 1_000);
    expect(sig(two, S + 1)).toBeNull();
    expect(gizliHirsiz.publicView(two, ctx(T0 + S, ["a", "b"])).signalAt).toBeNull();
  });

  it("herkes 15. saniyeden önce karar verdiyse işaret gösterilmez", () => {
    let s = start();
    for (const id of ALL) s = steal(s, id, 14_500);
    expect(s.endsAt).toBe(T0 + 15_500);
    expect(sig(s, S + 100)).toBeNull();
    expect(sig(s, END)).toBeNull();
  });

  it("herkes 15. saniyeden sonra karar verdiyse işaret durur", () => {
    let s = steal(start(), "a", 3_000);
    for (const id of ["b", "c", "d"]) s = pass(s, id, S + 200);
    expect(sig(s, S + 1_200)).toBe("stir");
  });
});

describe("gizli-hirsiz erken bitiş (GH-M1: bağlı herkes karar verdi)", () => {
  const everyone = (): GizliHirsizState => {
    let s = start();
    for (const [i, id] of ALL.entries()) s = act(s, id, 4_000 + i * 100, i % 2 === 0 ? "steal" : "pass");
    return s;
  };
  const rejection = (s: GizliHirsizState, id: string, at: number): string | null => {
    const r = gizliHirsiz.reduce(s, id, { kind: "steal" }, ctx(T0 + at));
    return isRejected(r) ? r.rejected : null;
  };

  it("(a) herkes karar verince son karardan 1 sn sonra biter", () => {
    const s = everyone(); // son karar 4 300
    expect(s.endsAt).toBe(T0 + 5_300);
    expect(gizliHirsiz.publicView(s, ctx(T0 + 5_299)).reveal).toBeNull();
    expect(gizliHirsiz.publicView(s, ctx(T0 + 5_300)).reveal?.outcome).toBe("multi");
    expect(gizliHirsiz.isFinished(s, ctx(T0 + 5_300 + GIZLI_HIRSIZ_REVEAL_MS))).toBe(true);
    expect(gizliHirsiz.result(s).miniScores).toEqual({ a: -1, b: 0, c: -1, d: 0 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = pass(s, id, 4_000);
    expect(s.endsAt).toBe(T0 + END);
  });

  it("(c) kopan oyuncu beklenmez", () => {
    let s = start();
    s = act(s, "a", 4_000, "pass", ["a", "b", "c"]);
    s = act(s, "b", 4_100, "steal", ["a", "b", "c"]);
    s = act(s, "c", 4_200, "pass", ["a", "b", "c"]);
    expect(s.endsAt).toBe(T0 + 5_200);
  });

  it("(d) son eksik oyuncu koparsa 1 sn sonra biter (onPresence)", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) s = pass(s, id, 4_000);
    const off = gizliHirsiz.onPresence?.(s, ctx(T0 + 9_000, ["a", "b", "c"]));
    expect(off?.endsAt).toBe(T0 + 10_000);
    expect(gizliHirsiz.onPresence?.(s, ctx(T0 + 9_000, ALL))).toBe(s);
  });

  it("(e) bitişten sonra yeni karar kabul edilmez", () => {
    const s = everyone();
    expect(rejection(s, "a", 5_000)).toBeNull(); // tekrar karar yok sayılır (gizlilik için aynı cevap)
    expect(rejection(s, "a", 5_300)).toBe("ended");
  });

  it("(f) tick bağlantıya bakmaz", () => {
    const s = everyone();
    expect(gizliHirsiz.tick(s, ctx(T0 + 8_000, []))).toEqual(gizliHirsiz.tick(s, ctx(T0 + 8_000, ALL)));
  });
});
