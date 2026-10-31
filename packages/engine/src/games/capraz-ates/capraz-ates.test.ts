import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type CaprazAtesState, caprazAtes, caprazAtesReveal } from "./index.js";
import {
  CAPRAZ_ATES_DURATION_MS,
  CAPRAZ_ATES_FIRE_MS,
  CAPRAZ_ATES_INTERVAL_MS,
  CAPRAZ_ATES_REVEAL_MS,
} from "./types.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d", "e"];
const ctx = (now: number, connected: readonly string[] = ALL) => ({ now, rng: createRng(1), connected });
const start = (players: string[] = ["a", "b", "c"]): CaprazAtesState =>
  caprazAtes.setup(players, ctx(T0, players));

function aim(state: CaprazAtesState, from: string, to: string, at = 1_000, connected = ALL) {
  const r = caprazAtes.reduce(state, from, { kind: "target", target: to }, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const play = (players: string[], edges: [string, string][]): CaprazAtesState => {
  let s = start(players);
  for (const [from, to] of edges) s = aim(s, from, to, 1_000, players);
  return s;
};
const scoresOf = (s: CaprazAtesState) => caprazAtes.result(s).miniScores;

describe("capraz-ates meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde", () => {
    expect(caprazAtes.minPlayers).toBe(3);
    expect(caprazAtes.maxPlayers).toBe(8);
    expect(caprazAtes.orientation).toBe("portrait");
    expect(caprazAtes.briefing.steps.length).toBeLessThanOrEqual(3);
  });

  it("setup tur 1'i kurar: 20 sn seçim; toplam 20 + 5 + 20 + 8 sn", () => {
    const s = start();
    expect(s.round).toBe(1);
    expect(s.endsAt - s.startedAt).toBe(20_000);
    expect(CAPRAZ_ATES_INTERVAL_MS).toBe(5_000);
    expect(CAPRAZ_ATES_REVEAL_MS).toBe(8_000);
    expect(s.finishAt - s.startedAt).toBe(CAPRAZ_ATES_DURATION_MS);
    expect(CAPRAZ_ATES_DURATION_MS).toBe(53_000);
    expect(s.targets).toEqual({});
    expect(s.cover).toEqual([]);
  });
});

describe("capraz-ates puanlama tablosu", () => {
  type Row = { name: string; players: string[]; edges: [string, string][]; expected: Record<string, number> };
  const rows: Row[] = [
    { name: "kimse ateş etmez", players: ["a", "b", "c"], edges: [], expected: { a: 0, b: 0, c: 0 } },
    {
      name: "tek ateş: hedeflenen -1, ateş eden +1",
      players: ["a", "b", "c"],
      edges: [["a", "b"]],
      expected: { a: 1, b: -1, c: 0 },
    },
    {
      name: "karşılıklı çift: ikisi de 0",
      players: ["a", "b", "c"],
      edges: [
        ["a", "b"],
        ["b", "a"],
      ],
      expected: { a: 0, b: 0, c: 0 },
    },
    {
      name: "3'lü döngü A→B→C→A: herkes hem ateş edip hem hedeflenir, -1",
      players: ["a", "b", "c"],
      edges: [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
      expected: { a: -1, b: -1, c: -1 },
    },
    {
      name: "yıldız: herkes A'yı hedefler; A tek -1, A hedefsiz, diğerleri +1",
      players: ["a", "b", "c", "d"],
      edges: [
        ["b", "a"],
        ["c", "a"],
        ["d", "a"],
      ],
      expected: { a: -1, b: 1, c: 1, d: 1 },
    },
    {
      name: "yıldız: A, kendini hedefleyenlerden birini hedeflerse çift 0 olur, diğerleri +1",
      players: ["a", "b", "c", "d"],
      edges: [
        ["b", "a"],
        ["c", "a"],
        ["d", "a"],
        ["a", "b"],
      ],
      expected: { a: 0, b: 0, c: 1, d: 1 },
    },
    {
      name: "karşılıklı çift + üçüncü oyuncu çiftten birini hedefler: çift 0, üçüncü +1",
      players: ["a", "b", "c"],
      edges: [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ],
      expected: { a: 0, b: 0, c: 1 },
    },
    {
      name: "karşılıklı çift + iki kişi aynı çifti hedefler",
      players: ["a", "b", "c", "d"],
      edges: [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "b"],
      ],
      expected: { a: 0, b: 0, c: 1, d: 1 },
    },
    {
      name: "yıldız: A, kendini hedeflemeyen birini hedeflerse A hedeflenen -1 (hedeflenme baskın, +1 yok)",
      players: ["a", "b", "c", "d"],
      edges: [
        ["b", "a"],
        ["c", "a"],
        ["a", "d"],
      ],
      expected: { a: -1, b: 1, c: 1, d: -1 },
    },
    {
      name: "hedefsiz oyuncu hedeflenirse -1",
      players: ["a", "b", "c"],
      edges: [
        ["a", "c"],
        ["b", "c"],
      ],
      expected: { a: 1, b: 1, c: -1 },
    },
    {
      name: "iki ayrı karşılıklı çift",
      players: ["a", "b", "c", "d"],
      edges: [
        ["a", "b"],
        ["b", "a"],
        ["c", "d"],
        ["d", "c"],
      ],
      expected: { a: 0, b: 0, c: 0, d: 0 },
    },
    {
      name: "zincir A→B→C: A hedeflenmez +1, B hedeflenir -1, C hedeflenir -1",
      players: ["a", "b", "c"],
      edges: [
        ["a", "b"],
        ["b", "c"],
      ],
      expected: { a: 1, b: -1, c: -1 },
    },
    {
      name: "4'lü döngü",
      players: ["a", "b", "c", "d"],
      edges: [
        ["a", "b"],
        ["b", "c"],
        ["c", "d"],
        ["d", "a"],
      ],
      expected: { a: -1, b: -1, c: -1, d: -1 },
    },
    {
      name: "karşılıklı çift + diğer ikisi birbirine tek yönlü",
      players: ["a", "b", "c", "d"],
      edges: [
        ["a", "b"],
        ["b", "a"],
        ["c", "d"],
      ],
      expected: { a: 0, b: 0, c: 1, d: -1 },
    },
    {
      name: "herkes ateş eder, tek karşılıklı çift ve kalanlar çifte yönelir",
      players: ["a", "b", "c", "d", "e"],
      edges: [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "c"],
        ["e", "d"],
      ],
      expected: { a: 0, b: 0, c: -1, d: -1, e: 1 },
    },
  ];
  it.each(rows)("$name", ({ players, edges, expected }) => {
    const s = play(players, edges);
    expect(scoresOf(s)).toEqual(expected);
    expect(caprazAtes.result(s).awards).toEqual(expected);
  });

  it("toplam puan: karşılıklı olmayan her hedef bir kez -1 sayılır", () => {
    const s = play(
      ["a", "b", "c", "d"],
      [
        ["b", "a"],
        ["c", "a"],
        ["d", "a"],
      ],
    );
    const reveal = caprazAtesReveal(s.players, s.targets);
    expect(Object.values(reveal.scores).filter((v) => v === -1)).toHaveLength(1);
  });

  it("karşılıklı çiftler tek kez listelenir", () => {
    const s = play(
      ["a", "b", "c"],
      [
        ["b", "a"],
        ["a", "b"],
      ],
    );
    expect(caprazAtesReveal(s.players, s.targets).mutual).toEqual([["a", "b"]]);
  });
});

const R1_END = CAPRAZ_ATES_FIRE_MS;
const R2_START = R1_END + CAPRAZ_ATES_INTERVAL_MS;
const R2_END = R2_START + CAPRAZ_ATES_FIRE_MS;
const FINISH = R2_END + CAPRAZ_ATES_REVEAL_MS;

function act(state: CaprazAtesState, from: string, action: unknown, at: number, connected = ALL) {
  const parsed = caprazAtes.parseAction(action);
  if (!parsed) throw new Error("geçersiz eylem");
  const r = caprazAtes.reduce(state, from, parsed, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const cover = (state: CaprazAtesState, from: string, at = 1_000, connected = ALL) =>
  act(state, from, { kind: "cover" }, at, connected);
const roundScores = (s: CaprazAtesState, at: number) =>
  caprazAtes.publicView(s, ctx(T0 + at)).rounds.map((r) => r.scores);

describe("capraz-ates siper", () => {
  type Row = {
    name: string;
    players: string[];
    edges: [string, string][];
    cover: string[];
    expected: Record<string, number>;
  };
  const rows: Row[] = [
    {
      name: "siperde ve hedeflenmiş: 0 (ceza yok)",
      players: ["a", "b", "c"],
      edges: [["a", "b"]],
      cover: ["b"],
      expected: { a: 1, b: 0, c: 0 },
    },
    {
      name: "siperde ve hedeflenmemiş: 0 (+1 yok)",
      players: ["a", "b", "c"],
      edges: [],
      cover: ["a"],
      expected: { a: 0, b: 0, c: 0 },
    },
    {
      name: "siperdekine ateş eden 'ateş etti' sayılır: hedeflenmediyse +1",
      players: ["a", "b", "c"],
      edges: [
        ["a", "c"],
        ["b", "c"],
      ],
      cover: ["c"],
      expected: { a: 1, b: 1, c: 0 },
    },
    {
      name: "siperdekine ateş eden kendisi hedeflendiyse −1",
      players: ["a", "b", "c", "d"],
      edges: [
        ["a", "c"],
        ["b", "a"],
      ],
      cover: ["c"],
      expected: { a: -1, b: 1, c: 0, d: 0 },
    },
    {
      name: "siper + karşılıklılık: A siperdeyse B→A karşılıklı değildir, B +1",
      players: ["a", "b", "c"],
      edges: [["b", "a"]],
      cover: ["a"],
      expected: { a: 0, b: 1, c: 0 },
    },
    {
      name: "önce hedef sonra siper: siper geçerli, eski hedef sayılmaz",
      players: ["a", "b", "c"],
      edges: [
        ["a", "b"],
        ["b", "a"],
      ],
      cover: ["a"],
      expected: { a: 0, b: 1, c: 0 },
    },
    {
      name: "herkes siperde: herkes 0",
      players: ["a", "b", "c"],
      edges: [],
      cover: ["a", "b", "c"],
      expected: { a: 0, b: 0, c: 0 },
    },
  ];
  it.each(rows)("$name", ({ players, edges, cover: sheltered, expected }) => {
    let s = play(players, edges);
    for (const id of sheltered) s = cover(s, id, 2_000, players);
    expect(scoresOf(s)).toEqual(expected);
    const pub = caprazAtes.publicView(s, ctx(T0 + R1_END, players));
    expect(pub.rounds[0]?.cover).toEqual(players.filter((id) => sheltered.includes(id)));
    for (const id of sheltered) expect(pub.rounds[0]?.targets[id]).toBeNull();
    expect(pub.rounds[0]?.mutual.some((pair) => sheltered.some((id) => pair.includes(id)))).toBe(false);
  });

  it("siperden çıkıp hedef seçilebilir; aynı siperi tekrar seçmek durumu değiştirmez", () => {
    let s = cover(start(), "a");
    expect(cover(s, "a", 1_500)).toBe(s);
    s = aim(s, "a", "b", 2_000);
    expect(s.cover).toEqual([]);
    expect(s.targets.a).toBe("b");
    expect(scoresOf(s)).toEqual({ a: 1, b: -1, c: 0 });
  });

  it("siper ile Tamam: kilitlenince değiştirilemez", () => {
    const s = act(cover(start(), "a"), "a", { kind: "lock" }, 2_000);
    expect(caprazAtes.view(s, "a", ctx(T0 + 2_000))).toEqual({ myTarget: null, cover: true, locked: true });
    expect(caprazAtes.reduce(s, "a", { kind: "target", target: "b" }, ctx(T0 + 3_000))).toEqual({
      rejected: "locked",
    });
  });

  it("parseAction siperi yalnız kind ile kabul eder", () => {
    expect(caprazAtes.parseAction({ kind: "cover" })).toEqual({ kind: "cover" });
    expect(caprazAtes.parseAction({ kind: "cover", target: "b" })).toBeNull();
  });
});

describe("capraz-ates eylemler", () => {
  it("hedef değiştirilebilir: son seçim geçerli", () => {
    let s = start();
    s = aim(s, "a", "b", 1_000);
    s = aim(s, "a", "c", 2_000);
    expect(s.targets.a).toBe("c");
    expect(scoresOf(s)).toEqual({ a: 1, b: 0, c: -1 });
  });

  it("aynı hedefi tekrar seçmek durumu değiştirmez", () => {
    const s = aim(start(), "a", "b");
    expect(aim(s, "a", "b", 5_000)).toBe(s);
  });

  it("kendini hedefleme reddedilir", () => {
    const r = caprazAtes.reduce(start(), "a", { kind: "target", target: "a" }, ctx(T0 + 10));
    expect(r).toEqual({ rejected: "self_target" });
  });

  it("bilinmeyen hedef reddedilir", () => {
    const r = caprazAtes.reduce(start(), "a", { kind: "target", target: "zzz" }, ctx(T0 + 10));
    expect(isRejected(r)).toBe(true);
  });

  it("bağlı olmayan hedef reddedilir; bağlanınca kabul edilir", () => {
    const players = ["a", "b", "c"];
    const s = start(players);
    expect(caprazAtes.reduce(s, "a", { kind: "target", target: "b" }, ctx(T0 + 10, ["a", "c"]))).toEqual({
      rejected: "target_offline",
    });
    expect(
      isRejected(caprazAtes.reduce(s, "a", { kind: "target", target: "b" }, ctx(T0 + 10, players))),
    ).toBe(false);
  });

  it("hedef sonradan kopsa da önceki seçim geçerli kalır ve hedeflenme cezası uygulanır", () => {
    let s = start();
    s = aim(s, "a", "b", 1_000);
    const later = caprazAtes.tick(s, ctx(T0 + 15_000, ["a", "c"]));
    expect(scoresOf(later)).toEqual({ a: 1, b: -1, c: 0 });
  });

  it("katılımcı olmayan oyuncunun eylemi reddedilir", () => {
    const r = caprazAtes.reduce(start(), "ghost", { kind: "target", target: "a" }, ctx(T0 + 10));
    expect(r).toEqual({ rejected: "not_participant" });
  });

  it("hedef göndermeyen oyuncu hedef sayılmaz, hedeflenmezse 0 alır", () => {
    const s = aim(start(), "a", "b");
    expect(scoresOf(s).c).toBe(0);
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    expect(caprazAtes.parseAction({ kind: "target", target: "b" })).toEqual({ kind: "target", target: "b" });
    for (const bad of [
      { kind: "target" },
      { kind: "target", target: "" },
      { kind: "target", target: 3 },
      { kind: "target", target: "b", extra: 1 },
      { kind: "fire", target: "b" },
      { kind: "target", target: "x".repeat(65) },
      ["target", "b"],
      "b",
    ]) {
      expect(caprazAtes.parseAction(bad)).toBeNull();
    }
  });
});

describe("capraz-ates iki tur", () => {
  const three = ["a", "b", "c"];

  it("tur 1'in sonunda kısa açılış, sonra tur 2 boş seçimlerle başlar", () => {
    let s = start(three);
    s = aim(s, "a", "b", 1_000, three);
    s = cover(s, "c", 1_000, three);
    expect(caprazAtes.publicView(s, ctx(T0 + R1_END - 1)).rounds).toEqual([]);
    const pub = caprazAtes.publicView(s, ctx(T0 + R1_END));
    expect(pub.round).toBe(2);
    expect(pub.roundStartedAt).toBe(T0 + R2_START);
    expect(pub.endsAt).toBe(T0 + R2_END);
    expect(pub.finishAt).toBe(T0 + FINISH);
    expect(pub.rounds).toEqual([
      { targets: { a: "b", b: null, c: null }, cover: ["c"], scores: { a: 1, b: -1, c: 0 }, mutual: [] },
    ]);
    expect(pub.totals).toBeNull();
    // Tur 2'de herkes sıfırdan başlar.
    expect(caprazAtes.view(s, "a", ctx(T0 + R2_START))).toEqual({
      myTarget: null,
      cover: false,
      locked: false,
    });
    expect(caprazAtes.view(s, "c", ctx(T0 + R2_START))).toEqual({
      myTarget: null,
      cover: false,
      locked: false,
    });
  });

  it("kısa açılış sırasında seçim reddedilir; tur 2 başlayınca kabul edilir", () => {
    const s = aim(start(three), "a", "b", 1_000, three);
    const act2 = { kind: "target", target: "c" } as const;
    expect(caprazAtes.reduce(s, "a", act2, ctx(T0 + R1_END))).toEqual({ rejected: "not_started" });
    expect(caprazAtes.reduce(s, "a", act2, ctx(T0 + R2_START - 1))).toEqual({ rejected: "not_started" });
    const ok = caprazAtes.reduce(s, "a", act2, ctx(T0 + R2_START));
    expect(isRejected(ok)).toBe(false);
  });

  it("tur 2'nin sonunda final açılış; puan iki turun toplamı (−2…+2)", () => {
    const four = ["a", "b", "c", "d"];
    let s = start(four);
    s = aim(s, "a", "b", 1_000, four);
    s = aim(s, "c", "b", 1_000, four);
    s = aim(s, "d", "a", 1_000, four);
    // Tur 1: a −1, b −1, c +1, d +1.
    s = aim(s, "a", "b", R2_START + 1_000, four);
    s = aim(s, "c", "d", R2_START + 1_000, four);
    s = cover(s, "b", R2_START + 2_000, four);
    // Tur 2: a +1 (siperdekine ateş), b 0 (siper), c +1, d −1.
    expect(roundScores(s, R2_END - 1)).toEqual([{ a: -1, b: -1, c: 1, d: 1 }]);
    const pub = caprazAtes.publicView(s, ctx(T0 + R2_END));
    expect(pub.rounds.map((r) => r.scores)).toEqual([
      { a: -1, b: -1, c: 1, d: 1 },
      { a: 1, b: 0, c: 1, d: -1 },
    ]);
    expect(pub.totals).toEqual({ a: 0, b: -1, c: 2, d: 0 });
    const r = caprazAtes.result(caprazAtes.tick(s, ctx(T0 + R2_END)));
    expect(r.miniScores).toEqual({ a: 0, b: -1, c: 2, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
    // Tick hiç çalışmasa da sonuç aynı.
    expect(caprazAtes.result(s)).toEqual(r);
  });

  it("toplam en çok +2, en az −2", () => {
    let s = start(three);
    s = aim(s, "a", "b", 1_000, three);
    s = aim(s, "c", "b", 1_000, three);
    s = aim(s, "a", "b", R2_START + 1, three);
    s = aim(s, "c", "b", R2_START + 1, three);
    expect(caprazAtes.result(s).miniScores).toEqual({ a: 2, b: -2, c: 2 });
  });

  it("final açılışı bitene kadar oyun bitmez; tur 2 bitince eylem reddedilir", () => {
    const s = start(three);
    expect(caprazAtes.isFinished(s, ctx(T0 + R2_END))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(T0 + FINISH - 1))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(T0 + FINISH))).toBe(true);
    const act2 = { kind: "target", target: "b" } as const;
    expect(isRejected(caprazAtes.reduce(s, "a", act2, ctx(T0 + R2_END - 1)))).toBe(false);
    expect(caprazAtes.reduce(s, "a", act2, ctx(T0 + R2_END))).toEqual({ rejected: "ended" });
    expect(caprazAtes.reduce(s, "a", act2, ctx(T0 + FINISH + 10))).toEqual({ rejected: "ended" });
  });

  it("tick tur geçişlerinde bir kez değişir, aksi halde aynı nesneyi döner", () => {
    const s = aim(start(three), "a", "b", 1_000, three);
    expect(caprazAtes.tick(s, ctx(T0 + R1_END - 1, []))).toBe(s);
    const second = caprazAtes.tick(s, ctx(T0 + R1_END, []));
    expect(second.round).toBe(2);
    expect(caprazAtes.tick(second, ctx(T0 + R2_START + 100, []))).toBe(second);
    const closed = caprazAtes.tick(second, ctx(T0 + R2_END, []));
    expect(closed.fireClosed).toBe(true);
    expect(closed.rounds).toHaveLength(2);
    expect(caprazAtes.tick(closed, ctx(T0 + 99_999, []))).toBe(closed);
    // Arada tick olmadan doğrudan son ana atlamak aynı sonucu verir.
    expect(caprazAtes.tick(s, ctx(T0 + R2_END, []))).toEqual(closed);
  });

  it("tur 1 bilgisi tur 2 boyunca herkese açık; tur 2'nin seçimleri gizli", () => {
    let s = start(three);
    s = aim(s, "a", "b", 1_000, three);
    s = cover(s, "b", 1_000, three);
    s = aim(s, "c", "a", R2_START + 1_000, three);
    s = cover(s, "a", R2_START + 1_000, three);
    const mid = ctx(T0 + R2_START + 2_000, three);
    const pub = caprazAtes.publicView(s, mid);
    expect(pub.rounds).toHaveLength(1);
    expect(pub.rounds[0]?.targets).toEqual({ a: "b", b: null, c: null });
    expect(pub.rounds[0]?.cover).toEqual(["b"]);
    // Tur 2'nin seçimleri publicView'da yok: tur 1 bilgisi dışında herkese açık görünüm seçimle değişmez.
    const blank = caprazAtes.publicView(
      aim(cover(start(three), "b", 1_000, three), "a", "b", 1_000, three),
      mid,
    );
    expect(pub).toEqual(blank);
    expect(caprazAtes.view(s, "a", mid)).toEqual({ myTarget: null, cover: true, locked: false });
    expect(caprazAtes.view(s, "b", mid)).toEqual({ myTarget: null, cover: false, locked: false });
    expect(caprazAtes.view(s, "c", mid)).toEqual({ myTarget: "a", cover: false, locked: false });
    expect(caprazAtes.view(s, null, mid)).toEqual({ myTarget: null, cover: false, locked: false });
  });
});

describe("capraz-ates gizlilik (yapısal)", () => {
  const players = ["p1", "p2", "p3", "p4"];
  const s = cover(
    play(players, [
      ["p1", "p2"],
      ["p2", "p3"],
      ["p3", "p2"],
    ]),
    "p4",
    2_000,
    players,
  );
  const before = ctx(T0 + CAPRAZ_ATES_FIRE_MS - 1, players);

  it("tur bitmeden publicView yalnız zamanları içerir: hedef, siper, sayı, puan yok", () => {
    const pub = caprazAtes.publicView(s, before);
    expect(Object.keys(pub).sort()).toEqual([
      "endsAt",
      "finishAt",
      "lockedIds",
      "round",
      "roundStartedAt",
      "rounds",
      "startedAt",
      "totals",
    ]);
    expect(pub.rounds).toEqual([]);
    expect(pub.totals).toBeNull();
    const json = JSON.stringify(pub);
    for (const id of players) expect(json).not.toContain(id);
  });

  it("publicView seçim yapıldıkça değişmez (kaç kişinin seçtiği ya da siper aldığı bile sızmaz)", () => {
    const none = caprazAtes.publicView(start(players), before);
    const some = caprazAtes.publicView(s, before);
    expect(none).toEqual(some);
  });

  it("her özel görünüm yalnız o oyuncunun kendi seçimini içerir", () => {
    expect(caprazAtes.view(s, "p1", before)).toEqual({ myTarget: "p2", cover: false, locked: false });
    expect(caprazAtes.view(s, "p2", before)).toEqual({ myTarget: "p3", cover: false, locked: false });
    expect(caprazAtes.view(s, "p3", before)).toEqual({ myTarget: "p2", cover: false, locked: false });
    expect(caprazAtes.view(s, "p4", before)).toEqual({ myTarget: null, cover: true, locked: false });
    for (const id of players) {
      expect(Object.keys(caprazAtes.view(s, id, before))).toEqual(["myTarget", "cover", "locked"]);
    }
  });

  it("hiçbir görünüm başkasının hedefini, siperini ya da hedef sayısını taşımaz", () => {
    const p4 = JSON.stringify(caprazAtes.view(s, "p4", before));
    for (const id of players) expect(p4).not.toContain(id);
    const p1 = JSON.stringify(caprazAtes.view(s, "p1", before));
    expect(p1).not.toContain("p3");
    expect(p1).not.toContain("p4");
    expect(caprazAtes.view(s, "p1", before).cover).toBe(false);
  });

  it("izleyicinin görünümü seçim içermez", () => {
    expect(caprazAtes.view(s, null, before)).toEqual({ myTarget: null, cover: false, locked: false });
  });

  it("tur bitince hedefler ve siperler publicView'da açılır", () => {
    const pub = caprazAtes.publicView(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS, players));
    expect(pub.rounds[0]?.targets).toEqual({ p1: "p2", p2: "p3", p3: "p2", p4: null });
    expect(pub.rounds[0]?.cover).toEqual(["p4"]);
  });

  it("secrets() boş: metin araması kimlikleri koruyamaz, yukarıdaki yapısal testler korur", () => {
    expect(caprazAtes.secrets(s)).toEqual([]);
  });
});

describe("capraz-ates erken bitiş", () => {
  const three = ["a", "b", "c"];
  const lock = (state: CaprazAtesState, id: string, at: number, connected: readonly string[] = three) =>
    caprazAtes.reduce(state, id, { kind: "lock" }, ctx(T0 + at, connected));
  const lockOk = (state: CaprazAtesState, id: string, at: number, connected?: readonly string[]) => {
    const r = lock(state, id, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const aimed = (): CaprazAtesState => {
    let s = start(three);
    s = aim(s, "a", "b", 1_000, three);
    s = aim(s, "b", "c", 1_000, three);
    return aim(s, "c", "b", 1_000, three);
  };

  it("(a) tur 1'de herkes kilitleyince seçim 1 sn sonra biter; kısa açılış ve tur 2 öne kayar", () => {
    let s = aimed();
    s = lockOk(lockOk(lockOk(s, "a", 2_000), "b", 3_000), "c", 4_000);
    expect(s.endsAt).toBe(T0 + 5_000);
    expect(caprazAtes.publicView(s, ctx(T0 + 4_999, three)).rounds).toEqual([]);
    const pub = caprazAtes.publicView(s, ctx(T0 + 5_000, three));
    expect(pub.rounds[0]?.targets).toEqual({ a: "b", b: "c", c: "b" });
    expect(pub.roundStartedAt).toBe(T0 + 5_000 + CAPRAZ_ATES_INTERVAL_MS);
    expect(pub.endsAt).toBe(pub.roundStartedAt + CAPRAZ_ATES_FIRE_MS);
    expect(pub.finishAt).toBe(pub.endsAt + CAPRAZ_ATES_REVEAL_MS);
    expect(pub.lockedIds).toEqual([]);
    expect(scoresOf(s)).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("(b) tur 2'de de ayrı çalışır: siperle de kilitlenebilir, final açılışı 1 sn sonra", () => {
    let s = aimed();
    const r2 = R2_START + 1_000;
    s = act(s, "a", { kind: "target", target: "b" }, r2, three);
    s = cover(s, "b", r2, three);
    s = act(s, "c", { kind: "target", target: "a" }, r2, three);
    s = lockOk(lockOk(s, "a", r2 + 100), "b", r2 + 200);
    expect(s.endsAt).toBe(T0 + R2_END);
    s = lockOk(s, "c", r2 + 300);
    expect(s.endsAt).toBe(T0 + r2 + 1_300);
    expect(s.finishAt).toBe(s.endsAt + CAPRAZ_ATES_REVEAL_MS);
    expect(caprazAtes.isFinished(s, ctx(s.finishAt - 1))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(s.finishAt))).toBe(true);
    // Tur 1: a +1, b 0, c 0. Tur 2: a −1, b 0 (siper), c +1.
    expect(caprazAtes.result(s).miniScores).toEqual({ a: 0, b: 0, c: 1 });
  });

  it("(c) bir kişi eksikken bitmez", () => {
    const s = lockOk(lockOk(aimed(), "a", 2_000), "b", 3_000);
    expect(s.endsAt).toBe(T0 + CAPRAZ_ATES_FIRE_MS);
    expect(caprazAtes.publicView(s, ctx(T0 + 10_000, three)).rounds).toEqual([]);
  });

  it("(d) bağlantısı kopan oyuncu beklenmez", () => {
    const connected = ["a", "b"];
    let s = start(three);
    s = aim(s, "a", "b", 1_000, connected);
    s = aim(s, "b", "a", 1_000, connected);
    s = lockOk(s, "a", 2_000, connected);
    expect(s.endsAt).toBe(T0 + CAPRAZ_ATES_FIRE_MS);
    s = lockOk(s, "b", 3_000, connected);
    expect(s.endsAt).toBe(T0 + 4_000);
    expect(scoresOf(s)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("(e) kilit sonrası değişim ve ikinci kilit reddedilir", () => {
    const s = lockOk(aimed(), "a", 2_000);
    expect(caprazAtes.reduce(s, "a", { kind: "target", target: "c" }, ctx(T0 + 3_000, three))).toEqual({
      rejected: "locked",
    });
    expect(caprazAtes.reduce(s, "a", { kind: "cover" }, ctx(T0 + 3_000, three))).toEqual({
      rejected: "locked",
    });
    expect(lock(s, "a", 3_000)).toEqual({ rejected: "locked" });
    expect(caprazAtes.view(s, "a", ctx(T0 + 3_000, three))).toEqual({
      myTarget: "b",
      cover: false,
      locked: true,
    });
  });

  it("seçimsiz kilitlenemez; tur 1 erken bittikten sonra kısa açılışta eylem reddedilir", () => {
    expect(lock(start(three), "a", 1_000)).toEqual({ rejected: "nothing_to_lock" });
    let s = aimed();
    for (const id of three) s = lockOk(s, id, 2_000);
    expect(lock(s, "a", 2_500)).toEqual({ rejected: "locked" });
    expect(lock(s, "a", 3_000)).toEqual({ rejected: "not_started" });
  });

  it("(f) kilit listesi seçimleri sızdırmaz", () => {
    const s = lockOk(aimed(), "a", 2_000);
    const pub = caprazAtes.publicView(s, ctx(T0 + 3_000, three));
    expect(pub.lockedIds).toEqual(["a"]);
    expect(pub.rounds).toEqual([]);
    expect(JSON.stringify(pub)).not.toContain("target");
    expect(JSON.stringify(caprazAtes.view(s, "b", ctx(T0 + 3_000, three)))).not.toContain('"b"');
  });

  it("parseAction lock yalnız kind ile kabul edilir", () => {
    expect(caprazAtes.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(caprazAtes.parseAction({ kind: "lock", target: "b" })).toBeNull();
  });
});

describe("capraz-ates sonuç", () => {
  it("genel skora direkt eklenir: awards = miniScores (toplam), beraberlik yok", () => {
    const s = play(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
    const r = caprazAtes.result(s);
    expect(r.awards).toEqual(r.miniScores);
    expect(r.miniScores).toEqual({ a: 1, b: -1, c: -1 });
  });

  it("caprazAtesReveal varsayılan olarak siper içermez", () => {
    expect(caprazAtesReveal(["a", "b"], { a: "b" }).cover).toEqual([]);
  });
});
