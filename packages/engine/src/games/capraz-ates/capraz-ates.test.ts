import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type CaprazAtesState, caprazAtes, caprazAtesReveal } from "./index.js";
import { CAPRAZ_ATES_DURATION_MS, CAPRAZ_ATES_FIRE_MS, CAPRAZ_ATES_REVEAL_MS } from "./types.js";

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

  it("setup 25 sn hedef süresi ve sonrasında izleme süresi kurar", () => {
    const s = start();
    expect(s.endsAt - s.startedAt).toBe(25_000);
    expect(s.finishAt - s.startedAt).toBe(CAPRAZ_ATES_DURATION_MS);
    expect(s.targets).toEqual({});
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
    const later = caprazAtes.tick(s, ctx(T0 + 20_000, ["a", "c"]));
    expect(scoresOf(later)).toEqual({ a: 1, b: -1, c: 0 });
  });

  it("bağlantısı kopmuş oyuncu (kendi bağlantısı kayıtlıysa bile) bağlı birini hedefleyebilir", () => {
    const r = caprazAtes.reduce(start(), "a", { kind: "target", target: "b" }, ctx(T0 + 10, ["b", "c"]));
    expect(isRejected(r)).toBe(false);
  });

  it("katılımcı olmayan oyuncunun eylemi reddedilir", () => {
    const r = caprazAtes.reduce(start(), "ghost", { kind: "target", target: "a" }, ctx(T0 + 10));
    expect(r).toEqual({ rejected: "not_participant" });
  });

  it("süre bitiminde (25 sn) ve sonrasında eylem reddedilir; 1 ms önce kabul edilir", () => {
    const s = start();
    const act = { kind: "target", target: "b" } as const;
    expect(isRejected(caprazAtes.reduce(s, "a", act, ctx(T0 + CAPRAZ_ATES_FIRE_MS - 1)))).toBe(false);
    expect(caprazAtes.reduce(s, "a", act, ctx(T0 + CAPRAZ_ATES_FIRE_MS))).toEqual({ rejected: "ended" });
    expect(isRejected(caprazAtes.reduce(s, "a", act, ctx(T0 + CAPRAZ_ATES_DURATION_MS + 10)))).toBe(true);
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

describe("capraz-ates zamanlama ve sonuç", () => {
  it("tick süre dolana kadar durumu değiştirmez; dolunca bir kez işaretler (yayın tetiklemek için)", () => {
    const s = aim(start(), "a", "b");
    expect(caprazAtes.tick(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS - 1, []))).toBe(s);
    const closed = caprazAtes.tick(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS, []));
    expect(closed).not.toBe(s);
    expect(closed.targets).toEqual(s.targets);
    expect(caprazAtes.tick(closed, ctx(T0 + 99_999, []))).toBe(closed);
  });

  it("izleme süresi dolana kadar bitmez", () => {
    const s = start();
    expect(caprazAtes.isFinished(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(T0 + CAPRAZ_ATES_DURATION_MS - 1))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(T0 + CAPRAZ_ATES_DURATION_MS))).toBe(true);
  });

  it("genel skora direkt eklenir: awards = miniScores, beraberlik yok", () => {
    const s = play(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
      ],
    );
    const r = caprazAtes.result(s);
    expect(r.awards).toEqual(r.miniScores);
  });

  it("süre bitiminde publicView hedefleri, puanları ve çiftleri açar", () => {
    const s = play(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ],
    );
    const pub = caprazAtes.publicView(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS));
    expect(pub.reveal).toEqual({
      targets: { a: "b", b: "a", c: "a" },
      scores: { a: 0, b: 0, c: 1 },
      mutual: [["a", "b"]],
    });
  });
});

describe("capraz-ates gizlilik (yapısal)", () => {
  const players = ["p1", "p2", "p3", "p4"];
  const s = play(players, [
    ["p1", "p2"],
    ["p2", "p3"],
    ["p3", "p2"],
  ]);
  const before = ctx(T0 + CAPRAZ_ATES_FIRE_MS - 1, players);

  it("süre bitmeden publicView yalnız zamanları içerir: hedef, sayı, puan yok", () => {
    const pub = caprazAtes.publicView(s, before);
    expect(Object.keys(pub).sort()).toEqual(["endsAt", "finishAt", "lockedIds", "reveal", "startedAt"]);
    expect(pub.reveal).toBeNull();
    const json = JSON.stringify(pub);
    for (const id of players) expect(json).not.toContain(id);
  });

  it("publicView seçim yapıldıkça değişmez (kaç kişinin seçtiği bile sızmaz)", () => {
    const none = caprazAtes.publicView(start(players), before);
    const some = caprazAtes.publicView(s, before);
    expect({ ...none, startedAt: 0, endsAt: 0, finishAt: 0 }).toEqual({
      ...some,
      startedAt: 0,
      endsAt: 0,
      finishAt: 0,
    });
  });

  it("her özel görünüm yalnız o oyuncunun kendi hedefini içerir", () => {
    expect(caprazAtes.view(s, "p1", before)).toEqual({ myTarget: "p2", locked: false });
    expect(caprazAtes.view(s, "p2", before)).toEqual({ myTarget: "p3", locked: false });
    expect(caprazAtes.view(s, "p3", before)).toEqual({ myTarget: "p2", locked: false });
    expect(caprazAtes.view(s, "p4", before)).toEqual({ myTarget: null, locked: false });
    for (const id of players) {
      const v = caprazAtes.view(s, id, before);
      expect(Object.keys(v)).toEqual(["myTarget", "locked"]);
    }
  });

  it("hiçbir görünüm başkasının hedefini ya da hedef sayısını taşımaz", () => {
    // p4'ün görünümü: kimse onu hedeflemiyor ve kendi hedefi yok -> hiçbir kimlik içermemeli.
    const p4 = JSON.stringify(caprazAtes.view(s, "p4", before));
    for (const id of players) expect(p4).not.toContain(id);
    // p1 yalnız p2'yi görür; p3'ün p2'yi hedeflediğini (p2 iki kez hedeflendi) bilemez.
    const p1 = JSON.stringify(caprazAtes.view(s, "p1", before));
    expect(p1).not.toContain("p3");
    expect(p1).not.toContain("p4");
  });

  it("izleyicinin görünümü hedef içermez", () => {
    expect(caprazAtes.view(s, null, before)).toEqual({ myTarget: null, locked: false });
  });

  it("süre bitince hedefler publicView'da açılır", () => {
    const pub = caprazAtes.publicView(s, ctx(T0 + CAPRAZ_ATES_FIRE_MS, players));
    expect(pub.reveal?.targets).toEqual({ p1: "p2", p2: "p3", p3: "p2", p4: null });
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

  it("(a) herkes kilitleyince hedef aşaması 1 sn sonra biter", () => {
    let s = aimed();
    s = lockOk(lockOk(lockOk(s, "a", 2_000), "b", 3_000), "c", 4_000);
    expect(s.endsAt).toBe(T0 + 5_000);
    expect(caprazAtes.publicView(s, ctx(T0 + 4_999, three)).reveal).toBeNull();
    expect(caprazAtes.publicView(s, ctx(T0 + 5_000, three)).reveal?.targets).toEqual({
      a: "b",
      b: "c",
      c: "b",
    });
    expect(caprazAtes.isFinished(s, ctx(T0 + 4_999 + CAPRAZ_ATES_REVEAL_MS, three))).toBe(false);
    expect(caprazAtes.isFinished(s, ctx(T0 + 5_000 + CAPRAZ_ATES_REVEAL_MS, three))).toBe(true);
    expect(caprazAtes.tick(s, ctx(T0 + 5_000, three)).fireClosed).toBe(true);
    expect(scoresOf(s)).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    const s = lockOk(lockOk(aimed(), "a", 2_000), "b", 3_000);
    expect(s.endsAt).toBe(T0 + CAPRAZ_ATES_FIRE_MS);
    expect(caprazAtes.isFinished(s, ctx(T0 + 10_000, three))).toBe(false);
    expect(caprazAtes.publicView(s, ctx(T0 + 10_000, three)).reveal).toBeNull();
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
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

  it("(d) kilit sonrası hedef değişimi ve ikinci kilit reddedilir", () => {
    const s = lockOk(aimed(), "a", 2_000);
    const change = caprazAtes.reduce(s, "a", { kind: "target", target: "c" }, ctx(T0 + 3_000, three));
    expect(change).toEqual({ rejected: "locked" });
    expect(caprazAtes.reduce(s, "a", { kind: "target", target: "b" }, ctx(T0 + 3_000, three))).toEqual({
      rejected: "locked",
    });
    expect(lock(s, "a", 3_000)).toEqual({ rejected: "locked" });
    expect(caprazAtes.view(s, "a", ctx(T0 + 3_000, three))).toEqual({ myTarget: "b", locked: true });
  });

  it("hedefsiz kilitlenemez; erken bitişten sonra eylem reddedilir", () => {
    expect(lock(start(three), "a", 1_000)).toEqual({ rejected: "nothing_to_lock" });
    let s = aimed();
    for (const id of three) s = lockOk(s, id, 2_000);
    expect(lock(s, "a", 2_500)).toEqual({ rejected: "locked" });
    expect(lock(s, "a", 3_000)).toEqual({ rejected: "ended" });
    const fresh = start(three);
    expect(lock(fresh, "a", CAPRAZ_ATES_FIRE_MS)).toEqual({ rejected: "ended" });
  });

  it("(e) kilit listesi hedefleri sızdırmaz", () => {
    const s = lockOk(aimed(), "a", 2_000);
    const pub = caprazAtes.publicView(s, ctx(T0 + 3_000, three));
    expect(pub.lockedIds).toEqual(["a"]);
    expect(pub.reveal).toBeNull();
    expect(JSON.stringify(pub)).not.toContain("target");
    // b'nin görünümü yalnız kendi hedefi; a'nın hedefini taşımaz.
    expect(JSON.stringify(caprazAtes.view(s, "b", ctx(T0 + 3_000, three)))).not.toContain('"b"');
    expect(caprazAtes.view(s, null, ctx(T0 + 3_000, three))).toEqual({ myTarget: null, locked: false });
  });

  it("parseAction lock yalnız kind ile kabul edilir", () => {
    expect(caprazAtes.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(caprazAtes.parseAction({ kind: "lock", target: "b" })).toBeNull();
  });
});
