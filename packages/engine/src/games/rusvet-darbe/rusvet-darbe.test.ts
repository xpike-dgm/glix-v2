import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  coupSucceeds,
  type RusvetState,
  resolveHand,
  rusvetCounts,
  rusvetDarbe,
  rusvetFillTokens,
  rusvetFillVotes,
  signBeats,
} from "./index.js";
import {
  RUSVET_COUP_MS,
  RUSVET_GIVE_MS,
  RUSVET_MAX_DURATION_MS,
  RUSVET_MAX_HANDS,
  RUSVET_REVEAL_MS,
  RUSVET_SIGN_MS,
  RUSVET_SIGN_REVEAL_MS,
  RUSVET_VOTE_MS,
  type RusvetAction,
  type RusvetPublicView,
  type RusvetView,
  type Sign,
} from "./types.js";

const T0 = 1_000_000;
/** Dağıtım + darbe aşaması bitince sonuç açılır (en az bir oyuncu jeton almamışsa). */
const REVEAL_AT = RUSVET_GIVE_MS + RUSVET_COUP_MS;
const HAND_MS = RUSVET_SIGN_MS + RUSVET_SIGN_REVEAL_MS;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c", "d", "e", "f"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players: string[] = ["a", "b", "c"], seed = 1): RusvetState =>
  rusvetDarbe.setup(players, ctx(T0, players, seed));

function act(s: RusvetState, who: string, action: RusvetAction, at: number, connected?: readonly string[]) {
  const r = rusvetDarbe.reduce(s, who, action, ctx(at, connected ?? s.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rej = (
  s: RusvetState,
  who: string,
  action: RusvetAction,
  at: number,
  connected?: readonly string[],
) => {
  const r = rusvetDarbe.reduce(s, who, action, ctx(at, connected ?? s.players));
  return isRejected(r) ? r.rejected : "kabul";
};
/** Oyları verir (hepsi seçim süresi içinde). */
const withVotes = (players: string[], edges: [string, string][], seed = 1): RusvetState => {
  let s = start(players, seed);
  for (const [from, to] of edges) s = act(s, from, { kind: "vote", target: to }, T0 + 1_000);
  return s;
};
const at = (s: RusvetState, offset: number) => rusvetDarbe.tick(s, ctx(T0 + offset, s.players));
const pub = (s: RusvetState, offset: number) =>
  rusvetDarbe.publicView(s, ctx(T0 + offset, s.players)) as RusvetPublicView;
const priv = (s: RusvetState, who: string | null, offset: number) =>
  rusvetDarbe.view(s, who, ctx(T0 + offset, s.players)) as RusvetView;
const give = (tokens: [string, number][]): RusvetAction => ({
  kind: "give",
  tokens: tokens.map(([to, n]) => ({ to, n })),
});
const EMPTY_VIEW: RusvetView = {
  myVote: null,
  mySign: null,
  myTokens: null,
  myCoup: null,
  canCoup: false,
  locked: false,
};
const sign = (s: Sign): RusvetAction => ({ kind: "sign", sign: s });

/** 4 oyuncu, herkes bir oy alır -> dörtlü eşitlik (bütçe 1). */
const RING4: [string, string][] = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "a"],
];
/** a: 3 oy alır (bütçe 3), tek başkan. */
const STAR4: [string, string][] = [
  ["b", "a"],
  ["c", "a"],
  ["d", "a"],
  ["a", "b"],
];

describe("rusvet-darbe meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde, teknik kelime yok", () => {
    expect(rusvetDarbe.minPlayers).toBe(3);
    expect(rusvetDarbe.maxPlayers).toBe(8);
    expect(rusvetDarbe.orientation).toBe("portrait");
    expect(rusvetDarbe.briefing.steps).toHaveLength(3);
    expect(JSON.stringify(rusvetDarbe.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("süreler: 20 sn seçim, 8 sn işaret + 2,5 sn açılış, 25 sn dağıtım", () => {
    expect(RUSVET_VOTE_MS).toBe(20_000);
    expect(RUSVET_SIGN_MS).toBe(8_000);
    expect(RUSVET_SIGN_REVEAL_MS).toBe(2_500);
    expect(RUSVET_GIVE_MS).toBe(25_000);
    expect(RUSVET_MAX_HANDS).toBe(6);
    expect(RUSVET_COUP_MS).toBe(10_000);
    expect(RUSVET_MAX_DURATION_MS).toBe(20_000 + 6 * 10_500 + 25_000 + RUSVET_COUP_MS + RUSVET_REVEAL_MS);
  });

  it("kurulumda ctx.rng'den tek tohum alınır; aynı tohum aynı durum", () => {
    expect(start(["a", "b", "c"], 9)).toEqual(start(["a", "b", "c"], 9));
    expect(start(["a", "b", "c"], 9).seed).not.toBe(start(["a", "b", "c"], 10).seed);
  });
});

describe("rusvet-darbe başkanlık oyu", () => {
  it("oy değiştirilebilir: son oy geçerli; aynı oy durumu değiştirmez", () => {
    let s = start();
    s = act(s, "a", { kind: "vote", target: "b" }, T0 + 1_000);
    s = act(s, "a", { kind: "vote", target: "c" }, T0 + 2_000);
    expect(s.votes.a).toBe("c");
    expect(act(s, "a", { kind: "vote", target: "c" }, T0 + 3_000)).toBe(s);
  });

  it("kendine oy, bilinmeyen hedef, kopuk hedef ve katılımcı olmayan reddedilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "vote", target: "a" }, T0 + 10)).toBe("self_target");
    expect(rej(s, "a", { kind: "vote", target: "zzz" }, T0 + 10)).toBe("unknown_target");
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + 10, ["a", "c"])).toBe("target_offline");
    expect(rej(s, "ghost", { kind: "vote", target: "a" }, T0 + 10)).toBe("not_participant");
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + 10, ["a", "b", "c"])).toBe("kabul");
  });

  it("20 sn dolunca oy reddedilir; 1 ms önce kabul edilir", () => {
    const s = start();
    const v: RusvetAction = { kind: "vote", target: "b" };
    expect(rej(s, "a", v, T0 + RUSVET_VOTE_MS - 1)).toBe("kabul");
    expect(rej(s, "a", v, T0 + RUSVET_VOTE_MS)).toBe("wrong_phase");
  });

  it("oy vermeyenin oyu kendisi dışındaki rastgele birine gider; her oyuncu tam bir oy kullanır", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const players = ["a", "b", "c", "d"];
      const s = start(players, seed);
      const filled = rusvetFillVotes(players, s.seed, {});
      for (const id of players) {
        expect(filled[id]).not.toBe(id);
        expect(players).toContain(filled[id]);
      }
      const total = Object.values(rusvetCounts(players, filled)).reduce((x, y) => x + y, 0);
      expect(total).toBe(4);
    }
  });

  it("kısmi oy: verilen oy korunur, eksikler doldurulur", () => {
    const s = withVotes(["a", "b", "c"], [["a", "c"]], 5);
    const filled = rusvetFillVotes(s.players, s.seed, s.votes);
    expect(filled.a).toBe("c");
    expect(filled.b).not.toBe("b");
  });

  it("doldurma tohumdan türer: tick sıklığı ve ctx.rng tüketimi sonucu değiştirmez", () => {
    const s = start(["a", "b", "c", "d"], 3);
    const direct = rusvetDarbe.result(s);
    const stepped = rusvetDarbe.result(at(at(at(s, 5_000), 19_000), 20_000));
    expect(stepped).toEqual(direct);
  });
});

describe("rusvet-darbe seçim sonucu", () => {
  it("en çok oy alan tek kişi başkan olur; bütçe aldığı oy sayısıdır; dağıtım hemen başlar", () => {
    const s = withVotes(["a", "b", "c", "d"], STAR4);
    const before = pub(s, RUSVET_VOTE_MS - 1);
    expect(before.president).toBeNull();
    expect(before.budget).toBeNull();
    expect(before.phase).toBe("vote");
    const after = pub(s, RUSVET_VOTE_MS);
    expect(after.phase).toBe("give");
    expect(after.president).toBe("a");
    expect(after.budget).toBe(3);
    expect(after.phaseEndsAt - after.phaseStartedAt).toBe(RUSVET_GIVE_MS);
    expect(after.duel).toBeNull();
  });

  it("eşitlikte düello başlar; başkan ve bütçe henüz açık değildir", () => {
    const s = withVotes(["a", "b", "c", "d"], RING4);
    const p = pub(s, RUSVET_VOTE_MS);
    expect(p.phase).toBe("duel");
    expect(p.president).toBeNull();
    expect(p.budget).toBeNull();
    expect(p.duel?.candidates).toEqual(["a", "b", "c", "d"]);
    expect(p.duel?.hand).toBe(1);
    expect(p.duel?.signs).toBeNull();
  });

  it("yalnız en çok oyu paylaşanlar aday olur (3'lü eşitlik)", () => {
    const three = withVotes(
      ["a", "b", "c", "d", "e", "f"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
        ["d", "a"],
        ["e", "b"],
        ["f", "c"],
      ],
    );
    expect(pub(three, RUSVET_VOTE_MS).duel?.candidates).toEqual(["a", "b", "c"]);
    const two = withVotes(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "b"],
      ],
    );
    expect(pub(two, RUSVET_VOTE_MS).duel?.candidates).toEqual(["a", "b"]);
  });
});

describe("rusvet-darbe taş-kâğıt-makas kuralları", () => {
  it("signBeats: taş makası, makas kâğıdı, kâğıt taşı yener", () => {
    expect(signBeats("tas", "makas")).toBe(true);
    expect(signBeats("makas", "kagit")).toBe(true);
    expect(signBeats("kagit", "tas")).toBe(true);
    expect(signBeats("makas", "tas")).toBe(false);
    expect(signBeats("kagit", "makas")).toBe(false);
    expect(signBeats("tas", "kagit")).toBe(false);
    expect(signBeats("tas", "tas")).toBe(false);
  });

  it("iki aday: kazanan devam eder", () => {
    const h = resolveHand(["a", "b"], { a: "tas", b: "makas" });
    expect(h.advance).toEqual(["a"]);
    expect(h.replay).toBe(false);
  });

  it("üç aday, tek işaret diğer ikisini yener: o işareti verenler devam eder", () => {
    const h = resolveHand(["a", "b", "c"], { a: "tas", b: "makas", c: "makas" });
    expect(h.advance).toEqual(["a"]);
    const h2 = resolveHand(["a", "b", "c"], { a: "tas", b: "tas", c: "makas" });
    expect(h2.advance).toEqual(["a", "b"]);
    expect(h2.replay).toBe(false);
  });

  it("elde tam iki farklı işaret varsa az kişili işaret de kazanabilir", () => {
    const h = resolveHand(["a", "b", "c"], { a: "kagit", b: "tas", c: "tas" });
    expect(h.advance).toEqual(["a"]);
  });

  it("üç işaretin de bulunduğu el yok sayılır ve tekrarlanır", () => {
    const h = resolveHand(["a", "b", "c"], { a: "tas", b: "kagit", c: "makas" });
    expect(h.replay).toBe(true);
    expect(h.advance).toEqual(["a", "b", "c"]);
  });

  it("herkes aynı işareti verirse el yok sayılır ve tekrarlanır", () => {
    const h = resolveHand(["a", "b"], { a: "kagit", b: "kagit" });
    expect(h.replay).toBe(true);
    expect(h.advance).toEqual(["a", "b"]);
  });
});

describe("rusvet-darbe düello akışı", () => {
  const duel = (seed = 1) => withVotes(["a", "b", "c", "d"], RING4, seed);
  const E = RUSVET_VOTE_MS;

  it("yalnız adaylar işaret verebilir; aday olmayan ve oy aşamasındaki işaret reddedilir", () => {
    const three = withVotes(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "b"],
      ],
    );
    expect(pub(three, E).duel?.candidates).toEqual(["a", "b"]);
    expect(rej(three, "c", sign("tas"), T0 + E + 100)).toBe("not_candidate");
    expect(rej(three, "a", sign("tas"), T0 + E + 100)).toBe("kabul");
    expect(rej(three, "a", sign("tas"), T0 + 1_000)).toBe("wrong_phase");
    expect(rej(three, "a", { kind: "give", tokens: [] }, T0 + E + 100)).toBe("wrong_phase");
  });

  it("işaret tek seferliktir: ilk işaret kesindir; el bitince yeni işaret reddedilir", () => {
    let s = duel();
    s = act(s, "a", sign("tas"), T0 + E + 1_000);
    expect(rej(s, "a", sign("makas"), T0 + E + 2_000)).toBe("locked");
    expect(rej(s, "a", sign("tas"), T0 + E + 2_000)).toBe("locked");
    expect(priv(s, "a", E + 3_000).mySign).toBe("tas");
    expect(rej(s, "b", sign("tas"), T0 + E + RUSVET_SIGN_MS - 1)).toBe("kabul");
    expect(rej(s, "b", sign("tas"), T0 + E + RUSVET_SIGN_MS)).toBe("wrong_phase");
    expect(rej(s, "b", sign("tas"), T0 + E + RUSVET_SIGN_MS + 1_000)).toBe("wrong_phase");
  });

  it("işaretler açılış anına kadar gizli; açılışta herkes için aynı anda görünür (yapısal)", () => {
    let s = duel();
    s = act(s, "a", sign("tas"), T0 + E + 1_000);
    s = act(s, "b", sign("makas"), T0 + E + 1_500);
    const hidden = pub(s, E + RUSVET_SIGN_MS - 1);
    expect(hidden.duel?.signs).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("makas");
    expect(JSON.stringify(hidden)).not.toContain("tas");
    // Başka adayın işareti başkasının view'ında yok.
    expect(priv(s, "a", E + 2_000).mySign).toBe("tas");
    expect(priv(s, "b", E + 2_000).mySign).toBe("makas");
    expect(priv(s, "c", E + 2_000).mySign).toBeNull();
    expect(priv(s, "d", E + 2_000).mySign).toBeNull();
    expect(priv(s, null, E + 2_000).mySign).toBeNull();
    const shown = pub(s, E + RUSVET_SIGN_MS);
    expect(shown.duel?.signs?.a).toBe("tas");
    expect(shown.duel?.signs?.b).toBe("makas");
    expect(Object.keys(shown.duel?.signs ?? {}).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("işaret vermeyene rastgele işaret atanır (deterministik)", () => {
    const s = duel(4);
    const a = pub(s, E + RUSVET_SIGN_MS).duel?.signs;
    const b = pub(duel(4), E + RUSVET_SIGN_MS + 1_000).duel?.signs;
    expect(a).toBeDefined();
    expect(a).toEqual(b);
    for (const v of Object.values(a ?? {})) expect(["tas", "kagit", "makas"]).toContain(v);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++)
      seen.add(pub(duel(seed), E + RUSVET_SIGN_MS).duel?.signs?.a as string);
    expect(seen.size).toBe(3);
  });

  it("el sonucu 2,5 sn açılış penceresinden sonra uygulanır; kazanan başkan olur ve dağıtım başlar", () => {
    let s = withVotes(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "b"],
      ],
    );
    s = act(s, "a", sign("tas"), T0 + E + 1_000);
    s = act(s, "b", sign("makas"), T0 + E + 1_000);
    // Herkes işaret verdiği için açılış hemen (E + 1000) başlar; sonuç 2,5 sn sonra uygulanır.
    const revealEnd = E + 1_000 + RUSVET_SIGN_REVEAL_MS;
    const during = pub(s, revealEnd - 1);
    expect(during.phase).toBe("duel");
    expect(during.president).toBeNull();
    const done = pub(s, revealEnd);
    expect(done.phase).toBe("give");
    expect(done.president).toBe("a");
    expect(done.budget).toBe(2);
    expect(done.phaseEndsAt - done.phaseStartedAt).toBe(RUSVET_GIVE_MS);
    expect(done.phaseStartedAt).toBe(T0 + revealEnd);
  });

  it("sonuç çıkmayan el tekrarlanır; sonraki elde yalnız kalan adaylar oynar", () => {
    let s = duel();
    // Herkes işaretini verince el hemen açılır; sonraki el 2,5 sn sonra başlar.
    const REVEAL = RUSVET_SIGN_REVEAL_MS;
    const h2At = E + 500 + REVEAL;
    // El 1: a,b taş; c,d makas -> taş kazanır, a ve b devam.
    for (const [id, sg] of [
      ["a", "tas"],
      ["b", "tas"],
      ["c", "makas"],
      ["d", "makas"],
    ] as const)
      s = act(s, id, sign(sg), T0 + E + 500);
    const h2 = pub(s, h2At);
    expect(h2.phase).toBe("duel");
    expect(h2.duel?.hand).toBe(2);
    expect(h2.duel?.candidates).toEqual(["a", "b"]);
    expect(h2.duel?.history).toHaveLength(1);
    expect(h2.duel?.history[0]?.advance).toEqual(["a", "b"]);
    // El 2: ikisi de aynı işaret -> tekrar.
    s = act(s, "a", sign("kagit"), T0 + h2At + 500);
    s = act(s, "b", sign("kagit"), T0 + h2At + 500);
    expect(rej(s, "c", sign("tas"), T0 + h2At + 600)).toBe("not_candidate");
    const h3At = h2At + 500 + REVEAL;
    const h3 = pub(s, h3At);
    expect(h3.duel?.hand).toBe(3);
    expect(h3.duel?.candidates).toEqual(["a", "b"]);
    expect(h3.duel?.history[1]?.replay).toBe(true);
    expect(h3.duel?.signs).toBeNull();
    // El 3: kâğıt taşı yener.
    s = act(s, "a", sign("kagit"), T0 + h3At + 500);
    s = act(s, "b", sign("tas"), T0 + h3At + 500);
    const fin = pub(s, h3At + 500 + REVEAL);
    expect(fin.phase).toBe("give");
    expect(fin.president).toBe("a");
  });

  it("6 elden sonra hâlâ eşitse kalanlar arasından rastgele başkan seçilir", () => {
    let s = duel(7);
    // Her elde herkes 100 ms sonra işaret verir: el hemen açılır, 2,5 sn sonra biter.
    const FAST = 100 + RUSVET_SIGN_REVEAL_MS;
    for (let h = 0; h < RUSVET_MAX_HANDS; h++) {
      const base = E + h * FAST;
      for (const id of ["a", "b", "c", "d"]) s = act(s, id, sign("tas"), T0 + base + 100);
      expect(pub(s, base + FAST - 1).phase).toBe("duel");
    }
    const p = pub(s, E + RUSVET_MAX_HANDS * FAST);
    expect(p.phase).toBe("give");
    expect(["a", "b", "c", "d"]).toContain(p.president);
    expect(p.budget).toBe(1);
    expect(p.duel).toBeNull();
    // Farklı tohumlarda farklı başkan seçilebilir.
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      let t = duel(seed);
      for (let h = 0; h < RUSVET_MAX_HANDS; h++)
        for (const id of ["a", "b", "c", "d"]) t = act(t, id, sign("tas"), T0 + E + h * FAST + 100);
      seen.add(pub(t, E + RUSVET_MAX_HANDS * FAST).president as string);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("düello sonrası 25 sn dağıtım, ardından sonuç süresi; toplam süre sınırı aşılmaz", () => {
    // Kimse işaret vermezse eller tam süreyle oynanır; oyun her durumda üst sınırda biter.
    const slow = duel(7);
    expect(rusvetDarbe.isFinished(slow, ctx(T0 + RUSVET_MAX_DURATION_MS))).toBe(true);
    // Herkes hemen işaret verirse oyun daha erken biter.
    let s = duel(7);
    const FAST = 100 + RUSVET_SIGN_REVEAL_MS;
    for (let h = 0; h < RUSVET_MAX_HANDS; h++)
      for (const id of ["a", "b", "c", "d"]) s = act(s, id, sign("tas"), T0 + E + h * FAST + 100);
    const fastEnd = E + RUSVET_MAX_HANDS * FAST + RUSVET_GIVE_MS + RUSVET_COUP_MS + RUSVET_REVEAL_MS;
    expect(rusvetDarbe.isFinished(s, ctx(T0 + fastEnd - 1))).toBe(false);
    expect(rusvetDarbe.isFinished(s, ctx(T0 + fastEnd))).toBe(true);
  });

  it("açılan eller geçmişte herkese görünür", () => {
    let s = duel();
    for (const id of ["a", "b", "c", "d"]) s = act(s, id, sign("kagit"), T0 + E + 100);
    const p = pub(s, E + HAND_MS + 100);
    expect(p.duel?.history[0]?.signs).toEqual({ a: "kagit", b: "kagit", c: "kagit", d: "kagit" });
  });
});

describe("rusvet-darbe jeton dağıtımı", () => {
  const E = RUSVET_VOTE_MS;
  const base = () => at(withVotes(["a", "b", "c", "d"], STAR4), E + 1); // başkan a, bütçe 3

  it("yalnız başkan dağıtabilir; oy aşamasında dağıtım reddedilir", () => {
    const s = base();
    expect(rej(s, "b", give([["c", 1]]), T0 + E + 100)).toBe("not_president");
    expect(rej(s, "a", give([["b", 1]]), T0 + E + 100)).toBe("kabul");
    expect(rej(withVotes(["a", "b", "c"], []), "a", give([]), T0 + 100)).toBe("wrong_phase");
  });

  it("kendine verilemez, bilinmeyen oyuncuya verilemez, kişi başı en çok 2, toplam bütçeyi aşamaz", () => {
    const s = base();
    expect(rej(s, "a", give([["a", 1]]), T0 + E + 100)).toBe("self_target");
    expect(rej(s, "a", give([["zzz", 1]]), T0 + E + 100)).toBe("unknown_target");
    expect(
      rej(
        s,
        "a",
        give([
          ["b", 2],
          ["c", 2],
        ]),
        T0 + E + 100,
      ),
    ).toBe("over_budget");
    expect(
      rej(
        s,
        "a",
        give([
          ["b", 2],
          ["c", 1],
        ]),
        T0 + E + 100,
      ),
    ).toBe("kabul");
    expect(rusvetDarbe.parseAction(give([["b", 3]]))).toBeNull();
    expect(rusvetDarbe.parseAction(give([["b", 0]]))).toBeNull();
    expect(rusvetDarbe.parseAction(give([["b", 1.5]]))).toBeNull();
    expect(
      rusvetDarbe.parseAction(
        give([
          ["b", 1],
          ["b", 1],
        ]),
      ),
    ).toBeNull();
  });

  it("dağıtım süre bitene kadar değiştirilebilir; 25 sn dolunca reddedilir", () => {
    let s = base();
    s = act(s, "a", give([["b", 2]]), T0 + E + 1_000);
    s = act(
      s,
      "a",
      give([
        ["c", 1],
        ["d", 2],
      ]),
      T0 + E + 2_000,
    );
    expect(priv(s, "a", E + 3_000).myTokens).toEqual([
      { to: "c", n: 1 },
      { to: "d", n: 2 },
    ]);
    expect(rej(s, "a", give([["b", 1]]), T0 + E + RUSVET_GIVE_MS - 1)).toBe("kabul");
    expect(rej(s, "a", give([["b", 1]]), T0 + E + RUSVET_GIVE_MS)).toBe("wrong_phase");
  });

  it("bağlı olmayan oyuncuya yeni jeton eklenemez; mevcut jeton azaltılabilir", () => {
    let s = base();
    const online = ["a", "c", "d"];
    expect(rej(s, "a", give([["b", 1]]), T0 + E + 100, online)).toBe("target_offline");
    s = act(s, "a", give([["b", 2]]), T0 + E + 100);
    expect(rej(s, "a", give([["b", 1]]), T0 + E + 200, online)).toBe("kabul");
    expect(
      rej(
        s,
        "a",
        give([
          ["b", 2],
          ["c", 1],
        ]),
        T0 + E + 200,
        online,
      ),
    ).toBe("kabul");
    expect(rej(s, "a", give([["b", 2]]), T0 + E + 200, online)).toBe("kabul");
  });

  it("dağıtılmayan jetonlar sonda sınıra uyarak rastgele dağıtılır; başkana verilmez; toplam bütçedir", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const players = ["a", "b", "c", "d", "e"];
      const s = start(players, seed);
      const filled = rusvetFillTokens(players, s.seed, "a", 4, { b: 2 });
      expect(filled.a).toBe(0);
      expect(filled.b).toBe(2);
      const total = Object.values(filled).reduce((x, y) => x + y, 0);
      expect(total).toBe(4);
      for (const v of Object.values(filled)) expect(v).toBeLessThanOrEqual(2);
    }
  });

  it("bütçe sınırda dolar: 3 oyunculu oyunda 2 oyla 2 jeton, kişi başı 2'yi aşmaz", () => {
    const filled = rusvetFillTokens(["a", "b", "c"], 5, "a", 2, {});
    expect(Object.values(filled).reduce((x, y) => x + y, 0)).toBe(2);
    expect(Math.max(...Object.values(filled))).toBeLessThanOrEqual(2);
  });

  it("hiç dağıtım yapılmazsa tüm jetonlar rastgele dağıtılır", () => {
    const s = base();
    const p = pub(at(s, E + REVEAL_AT), E + REVEAL_AT);
    expect(p.phase).toBe("reveal");
    const sum = Object.values(p.reveal?.tokens ?? {}).reduce((x, y) => x + y, 0);
    expect(sum).toBe(3);
    expect(p.reveal?.tokens.a).toBe(0);
  });

  it("kısmi dağıtım korunur, kalan rastgele tamamlanır", () => {
    let s = base();
    s = act(s, "a", give([["b", 2]]), T0 + E + 1_000);
    const p = pub(s, E + REVEAL_AT);
    expect(p.reveal?.tokens.b).toBe(2);
    expect(Object.values(p.reveal?.tokens ?? {}).reduce((x, y) => x + y, 0)).toBe(3);
  });
});

describe("rusvet-darbe puanlama", () => {
  const E = RUSVET_VOTE_MS;
  it("başkan +1, jetonlar doğrudan genel skor; awards = miniScores", () => {
    let s = withVotes(["a", "b", "c", "d"], STAR4);
    s = at(s, E + 1);
    s = act(
      s,
      "a",
      give([
        ["b", 2],
        ["c", 1],
      ]),
      T0 + E + 1_000,
    );
    const r = rusvetDarbe.result(s);
    expect(r.miniScores).toEqual({ a: 1, b: 2, c: 1, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
  });

  it("toplam puan = bütçe + 1 (başkan)", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const players = ["a", "b", "c", "d", "e"];
      const s = start(players, seed);
      const r = rusvetDarbe.result(s);
      const counts = rusvetCounts(players, rusvetFillVotes(players, s.seed, {}));
      const top = Math.max(...Object.values(counts));
      const total = Object.values(r.awards).reduce((x, y) => x + y, 0);
      expect(total).toBe(top + 1);
    }
  });

  it("sonuç ekranı oy akışını, sayıları, jetonları ve skorları açar", () => {
    let s = withVotes(["a", "b", "c", "d"], STAR4);
    s = act(
      at(s, E + 1),
      "a",
      give([
        ["b", 2],
        ["c", 1],
      ]),
      T0 + E + 1_000,
    );
    const p = pub(s, E + REVEAL_AT);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.votes).toEqual({ a: "b", b: "a", c: "a", d: "a" });
    expect(p.reveal?.counts).toEqual({ a: 3, b: 1, c: 0, d: 0 });
    expect(p.reveal?.tokens).toEqual({ a: 0, b: 2, c: 1, d: 0 });
    expect(p.reveal?.scores).toEqual({ a: 1, b: 2, c: 1, d: 0 });
    expect(p.phaseEndsAt - p.phaseStartedAt).toBe(RUSVET_REVEAL_MS);
  });

  it("sonuç süresi dolana kadar bitmez; bitişten sonra her eylem reddedilir", () => {
    const s = withVotes(["a", "b", "c", "d"], STAR4);
    const end = E + RUSVET_GIVE_MS + RUSVET_REVEAL_MS; // bu oyunda herkes jeton alır: darbe aşaması atlanır
    expect(rusvetDarbe.isFinished(s, ctx(T0 + end - 1))).toBe(false);
    expect(rusvetDarbe.isFinished(s, ctx(T0 + end))).toBe(true);
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + end + 5)).toBe("ended");
    expect(rej(s, "a", sign("tas"), T0 + end + 5)).toBe("ended");
    expect(rej(s, "a", give([]), T0 + end + 5)).toBe("ended");
  });

  it("kopuk oyuncu da jeton alabilir ve başkan olabilir (bağlılık yalnız hedef seçimini sınırlar)", () => {
    let s = withVotes(["a", "b", "c", "d"], STAR4);
    s = act(at(s, E + 1), "a", give([["b", 2]]), T0 + E + 1_000);
    const done = rusvetDarbe.tick(s, ctx(T0 + E + RUSVET_GIVE_MS + 1, ["a"]));
    expect(rusvetDarbe.result(done).miniScores.b).toBe(2);
  });
});

describe("rusvet-darbe tick ve zamanlama", () => {
  it("tick aşama sınırlarında durumu değiştirir, arada aynı nesneyi döner", () => {
    const s = withVotes(["a", "b", "c", "d"], STAR4);
    expect(rusvetDarbe.tick(s, ctx(T0 + RUSVET_VOTE_MS - 1, []))).toBe(s);
    const give1 = rusvetDarbe.tick(s, ctx(T0 + RUSVET_VOTE_MS, []));
    expect(give1).not.toBe(s);
    expect(rusvetDarbe.tick(give1, ctx(T0 + RUSVET_VOTE_MS + RUSVET_GIVE_MS - 1, []))).toBe(give1);
    const rev = rusvetDarbe.tick(give1, ctx(T0 + RUSVET_VOTE_MS + RUSVET_GIVE_MS, []));
    // Dağıtım yapılmadı: rastgele dağıtımda herkes jeton aldı, darbe aşaması atlanır.
    expect(rev.stage).toBe("reveal");
    expect(rusvetDarbe.tick(rev, ctx(T0 + 999_999, []))).toBe(rev);
  });

  it("düelloda tick işaretlerin açıldığı ve el bittiği anlarda durumu değiştirir", () => {
    const s = withVotes(["a", "b", "c", "d"], RING4);
    const e = RUSVET_VOTE_MS;
    const duel = rusvetDarbe.tick(s, ctx(T0 + e, []));
    expect(rusvetDarbe.tick(duel, ctx(T0 + e + RUSVET_SIGN_MS - 1, []))).toBe(duel);
    const closed = rusvetDarbe.tick(duel, ctx(T0 + e + RUSVET_SIGN_MS, []));
    expect(closed).not.toBe(duel);
    expect(rusvetDarbe.tick(closed, ctx(T0 + e + HAND_MS - 1, []))).toBe(closed);
    expect(rusvetDarbe.tick(closed, ctx(T0 + e + HAND_MS, []))).not.toBe(closed);
  });

  it("tek tick'te birden çok aşama atlansa da sonuç, adım adım ilerlemeyle aynıdır", () => {
    let s = withVotes(["a", "b", "c", "d"], RING4, 11);
    s = act(s, "a", sign("tas"), T0 + RUSVET_VOTE_MS + 100);
    const jump = rusvetDarbe.tick(s, ctx(T0 + 200_000, s.players));
    let steps = s;
    for (let t = 1_000; t <= 200_000; t += 1_000) steps = rusvetDarbe.tick(steps, ctx(T0 + t, s.players));
    expect(rusvetDarbe.result(jump)).toEqual(rusvetDarbe.result(steps));
    expect(jump).toEqual(steps);
  });

  it("geç gelen eylem, tick edilmemiş durumda da doğru aşamaya göre değerlendirilir", () => {
    const s = withVotes(["a", "b", "c", "d"], STAR4); // hâlâ oy aşamasında (tick yok)
    expect(rej(s, "b", { kind: "vote", target: "c" }, T0 + RUSVET_VOTE_MS + 10)).toBe("wrong_phase");
    expect(rej(s, "a", give([["b", 1]]), T0 + RUSVET_VOTE_MS + 10)).toBe("kabul");
  });
});

describe("rusvet-darbe parseAction", () => {
  it("geçerli eylemleri kabul eder", () => {
    expect(rusvetDarbe.parseAction({ kind: "vote", target: "b" })).toEqual({ kind: "vote", target: "b" });
    expect(rusvetDarbe.parseAction({ kind: "sign", sign: "tas" })).toEqual({ kind: "sign", sign: "tas" });
    expect(rusvetDarbe.parseAction(give([["b", 2]]))).toEqual(give([["b", 2]]));
    expect(rusvetDarbe.parseAction(give([]))).toEqual(give([]));
  });
  it("bozuk eylemleri reddeder", () => {
    for (const bad of [
      { kind: "vote" },
      { kind: "vote", target: "" },
      { kind: "vote", target: "b", x: 1 },
      { kind: "sign", sign: "rock" },
      { kind: "sign" },
      { kind: "sign", sign: "tas", x: 1 },
      { kind: "give" },
      { kind: "give", tokens: "b" },
      { kind: "give", tokens: [{ to: "b" }] },
      { kind: "give", tokens: [{ to: "b", n: 1, x: 1 }] },
      { kind: "give", tokens: [null] },
      { kind: "give", tokens: Array.from({ length: 9 }, (_, i) => ({ to: `p${i}`, n: 1 })) },
      { kind: "bribe", target: "b" },
      "vote",
      [],
    ]) {
      expect(rusvetDarbe.parseAction(bad)).toBeNull();
    }
  });
});

describe("rusvet-darbe gizlilik (kısa kimlikler/işaretler; yapısal kontrol)", () => {
  const E = RUSVET_VOTE_MS;
  const players = ["pa1", "pb2", "pc3", "pd4"];
  const s0 = withVotes(players, [
    ["pa1", "pb2"],
    ["pc3", "pb2"],
  ]);

  it("seçim bitene kadar publicView oy, sayı, başkan ya da bütçe içermez; view yalnız kendi oyunu verir", () => {
    for (const off of [1, 5_000, E - 1]) {
      const p = pub(s0, off);
      expect(p.reveal).toBeNull();
      expect(p.president).toBeNull();
      expect(p.budget).toBeNull();
      expect(p.duel).toBeNull();
      const json = JSON.stringify(p);
      expect(json).not.toContain('"votes"');
      expect(json).not.toContain('"counts"');
      for (const id of players)
        expect(Object.keys(priv(s0, id, off)).sort()).toEqual([
          "canCoup",
          "locked",
          "myCoup",
          "mySign",
          "myTokens",
          "myVote",
        ]);
      expect(priv(s0, "pa1", off).myVote).toBe("pb2");
      expect(priv(s0, "pb2", off).myVote).toBeNull();
      expect(priv(s0, "pd4", off).myVote).toBeNull();
      expect(priv(s0, null, off)).toEqual(EMPTY_VIEW);
      expect(priv(s0, "ghost", off)).toEqual(EMPTY_VIEW);
    }
  });

  it("düello sırasında publicView oy akışı ve oy sayısı içermez", () => {
    const s = withVotes(players, [
      ["pa1", "pb2"],
      ["pb2", "pa1"],
      ["pc3", "pa1"],
      ["pd4", "pb2"],
    ]);
    const p = pub(s, E + 100);
    expect(p.phase).toBe("duel");
    const json = JSON.stringify(p);
    expect(json).not.toContain('"votes"');
    expect(json).not.toContain('"counts"');
    expect(json).not.toContain('"budget":2');
    expect(p.budget).toBeNull();
  });

  it("dağıtım sırasında yalnız başkanın view'ında dağıtım vardır; publicView'da yoktur", () => {
    let s = withVotes(
      ["pa1", "pb2", "pc3", "pd4"],
      [
        ["pb2", "pa1"],
        ["pc3", "pa1"],
        ["pd4", "pa1"],
        ["pa1", "pb2"],
      ],
    );
    s = act(
      at(s, E + 1),
      "pa1",
      give([
        ["pb2", 2],
        ["pc3", 1],
      ]),
      T0 + E + 1_000,
    );
    for (const off of [E + 1_500, E + RUSVET_GIVE_MS - 1]) {
      const p = pub(s, off);
      expect(p.phase).toBe("give");
      expect(p.president).toBe("pa1");
      expect(p.budget).toBe(3);
      const json = JSON.stringify(p);
      expect(json).not.toContain('"tokens"');
      expect(json).not.toContain('"scores"');
      expect(p.reveal).toBeNull();
      expect(priv(s, "pa1", off).myTokens).toEqual([
        { to: "pb2", n: 2 },
        { to: "pc3", n: 1 },
      ]);
      for (const other of ["pb2", "pc3", "pd4"]) expect(priv(s, other, off).myTokens).toBeNull();
      expect(priv(s, null, off).myTokens).toBeNull();
      for (const other of ["pb2", "pc3", "pd4", null])
        expect(JSON.stringify(priv(s, other, off))).not.toContain('pc3","n"');
    }
  });

  it("dağıtım sonunda sonuç herkese açılır", () => {
    let s = withVotes(
      ["pa1", "pb2", "pc3", "pd4"],
      [
        ["pb2", "pa1"],
        ["pc3", "pa1"],
        ["pd4", "pa1"],
        ["pa1", "pb2"],
      ],
    );
    s = act(
      at(s, E + 1),
      "pa1",
      give([
        ["pb2", 2],
        ["pc3", 1],
      ]),
      T0 + E + 1_000,
    );
    const p = pub(s, E + REVEAL_AT);
    expect(p.reveal?.tokens.pb2).toBe(2);
    expect(p.reveal?.votes.pb2).toBe("pa1");
  });

  it("secrets() boştur (kimlikler ve işaretler kısa; gizlilik yapısal testlerle doğrulanır)", () => {
    expect(rusvetDarbe.secrets(s0)).toEqual([]);
  });
});

describe("rusvet-darbe erken bitiş", () => {
  const E = RUSVET_VOTE_MS;
  const lock: RusvetAction = { kind: "lock" };
  const P = ["a", "b", "c"];

  it("parseAction lock kabul eder, fazladan alanı reddeder", () => {
    expect(rusvetDarbe.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(rusvetDarbe.parseAction({ kind: "lock", target: "a" })).toBeNull();
  });

  describe("başkanlık oyu: Tamam", () => {
    const voted = (conn?: readonly string[]) => {
      let s = start(P);
      for (const [f, t] of [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ] as const)
        s = act(s, f, { kind: "vote", target: t }, T0 + 1_000, conn);
      return s;
    };

    it("(a) herkes kilitleyince oylama 1 sn sonra biter; sonuç aynı", () => {
      let s = voted();
      for (const id of P) s = act(s, id, lock, T0 + 5_000);
      expect(s.voteEndsAt).toBe(T0 + 6_000);
      expect(pub(s, 5_999).phase).toBe("vote");
      const p = pub(s, 6_000);
      expect(p.phase).toBe("give");
      expect(p.president).toBe("a");
      expect(p.budget).toBe(2);
      expect(p.phaseStartedAt).toBe(T0 + 6_000);
    });

    it("(b) bir kişi eksikken bitmez; oysuz kilitlenemez", () => {
      let s = voted();
      s = act(s, "a", lock, T0 + 5_000);
      s = act(s, "b", lock, T0 + 5_000);
      expect(s.voteEndsAt).toBe(T0 + E);
      expect(pub(s, 10_000).phase).toBe("vote");
      expect(rej(start(P), "a", lock, T0 + 1_000)).toBe("nothing_to_lock");
    });

    it("(c) bağlantısı kopan oyuncu beklenmez", () => {
      const conn = ["a", "b"];
      let s = voted();
      s = act(s, "a", lock, T0 + 5_000, conn);
      s = act(s, "b", lock, T0 + 5_000, conn);
      expect(s.voteEndsAt).toBe(T0 + 6_000);
    });

    it("(d) kilitten sonra oy değişmez; kapanış penceresinde eylem reddedilir", () => {
      let s = voted();
      s = act(s, "a", lock, T0 + 5_000);
      expect(rej(s, "a", { kind: "vote", target: "c" }, T0 + 5_100)).toBe("locked");
      expect(rej(s, "a", lock, T0 + 5_100)).toBe("locked");
      const conn = ["a", "b"];
      let t = voted();
      t = act(t, "a", lock, T0 + 5_000, conn);
      t = act(t, "b", lock, T0 + 5_000, conn);
      expect(rej(t, "c", { kind: "vote", target: "b" }, T0 + 5_500)).toBe("closed");
      expect(rej(t, "c", lock, T0 + 5_500)).toBe("closed");
    });

    it("(e) kilit listesi oyları sızdırmaz", () => {
      let s = voted();
      s = act(s, "b", lock, T0 + 5_000);
      const p = pub(s, 5_100);
      expect(p.ready).toEqual(["b"]);
      expect(JSON.stringify(p)).not.toMatch(/votes|counts/);
      expect(priv(s, "b", 5_100)).toEqual({ ...EMPTY_VIEW, myVote: "a", locked: true });
      expect(priv(s, "a", 5_100).locked).toBe(false);
    });

    it("(f) tick bağlantıya bakmaz", () => {
      let s = voted();
      for (const id of P) s = act(s, id, lock, T0 + 5_000);
      expect(rusvetDarbe.tick(s, ctx(T0 + 7_000, []))).toEqual(rusvetDarbe.tick(s, ctx(T0 + 7_000, P)));
    });
  });

  describe("düello: herkes işaret verdi", () => {
    const duel = () => withVotes(["a", "b", "c", "d"], RING4);

    it("(a) herkes işaret verince açılış hemen başlar; (b) biri eksikse beklenir", () => {
      let s = duel();
      for (const id of ["a", "b", "c"]) s = act(s, id, sign("tas"), T0 + E + 1_000);
      expect(pub(s, E + 1_000).duel?.signs).toBeNull();
      expect(pub(s, E + 1_000).ready).toEqual(["a", "b", "c"]);
      expect(pub(s, E + 5_000).duel?.signEndsAt).toBe(T0 + E + RUSVET_SIGN_MS);
      s = act(s, "d", sign("makas"), T0 + E + 2_000);
      const p = pub(s, E + 2_000);
      expect(p.duel?.signs).toEqual({ a: "tas", b: "tas", c: "tas", d: "makas" });
      expect(p.duel?.signEndsAt).toBe(T0 + E + 2_000);
      expect(p.duel?.revealEndsAt).toBe(T0 + E + 2_000 + RUSVET_SIGN_REVEAL_MS);
    });

    it("(c) bağlantıya bakılmaz: kopuk aday da işaret vermeden bitmez", () => {
      let s = duel();
      for (const id of ["a", "b", "c"]) s = act(s, id, sign("tas"), T0 + E + 1_000, ["a", "b", "c"]);
      expect(pub(s, E + 3_000).duel?.signs).toBeNull();
    });

    it("(d) işaret kesin; açılıştan sonra değişmez", () => {
      let s = duel();
      for (const id of ["a", "b", "c", "d"]) s = act(s, id, sign("tas"), T0 + E + 1_000);
      expect(rej(s, "a", sign("makas"), T0 + E + 1_000)).toBe("wrong_phase");
      expect(rej(s, "a", sign("makas"), T0 + E + 1_500)).toBe("wrong_phase");
    });

    it("(e) işaretler yalnız açılışta çıkar; kilit listesi içeriği taşımaz", () => {
      let s = duel();
      s = act(s, "a", sign("kagit"), T0 + E + 1_000);
      const p = pub(s, E + 1_100);
      expect(p.ready).toEqual(["a"]);
      expect(JSON.stringify(p)).not.toContain("kagit");
      expect(priv(s, "a", E + 1_100).locked).toBe(true);
      expect(priv(s, "b", E + 1_100).locked).toBe(false);
    });

    it("(f) replay: aynı eylem kayıtı tick sıklığından bağımsız aynı sonucu verir", () => {
      let a = duel();
      let b = duel();
      for (const id of ["a", "b", "c", "d"]) {
        a = act(a, id, sign("tas"), T0 + E + 1_000);
        b = act(b, id, sign("tas"), T0 + E + 1_000);
      }
      for (let t = E; t < E + 20_000; t += 700) a = at(a, t);
      expect(rusvetDarbe.result(a)).toEqual(rusvetDarbe.result(b));
      expect(pub(a, E + 20_000)).toEqual(pub(b, E + 20_000));
    });
  });

  describe("dağıtım: Bitti", () => {
    /** a başkan (2 oy), dağıtım başladı. */
    const giving = () => {
      let s = start(P);
      for (const [f, t] of [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ] as const)
        s = act(s, f, { kind: "vote", target: t }, T0 + 1_000);
      return at(s, E);
    };

    it("(a) başkan Bitti deyince dağıtım 1 sn sonra biter, sonuç süresi buna göre kayar", () => {
      let s = giving();
      s = act(s, "a", give([["c", 1]]), T0 + E + 2_000);
      s = act(s, "a", lock, T0 + E + 2_000);
      expect(s.stage).toBe("give");
      expect(pub(s, E + 2_500).phaseEndsAt).toBe(T0 + E + 3_000);
      expect(pub(s, E + 2_999).phase).toBe("give");
      expect(pub(s, E + 3_000).phase).toBe("reveal");
      expect(rusvetDarbe.isFinished(s, ctx(T0 + E + 3_000 + RUSVET_REVEAL_MS - 1, P))).toBe(false);
      expect(rusvetDarbe.isFinished(s, ctx(T0 + E + 3_000 + RUSVET_REVEAL_MS, P))).toBe(true);
      // Puanlama aynı: başkan +1, c verilen 1 jeton + kalan 1 jeton rastgele.
      const total = Object.values(rusvetDarbe.result(s).miniScores).reduce((x, y) => x + y, 0);
      expect(total).toBe(3);
    });

    it("(b) yalnız başkan bitirir; hiç dağıtım yoksa bitiremez", () => {
      const s = giving();
      expect(rej(s, "b", lock, T0 + E + 2_000)).toBe("not_president");
      expect(rej(s, "a", lock, T0 + E + 2_000)).toBe("nothing_to_lock");
      expect(pub(s, E + 2_000).phaseEndsAt).toBe(T0 + E + RUSVET_GIVE_MS);
    });

    it("(c)(d) başkan dışındaki bağlantılar bitişi etkilemez; Bitti sonrası dağıtım ve ikinci Bitti reddedilir", () => {
      let s = giving();
      s = act(s, "a", give([["c", 1]]), T0 + E + 2_000);
      s = act(s, "a", lock, T0 + E + 2_000, ["a"]);
      expect(s.giveEndsAt).toBe(T0 + E + 3_000);
      expect(rej(s, "a", give([["c", 2]]), T0 + E + 2_500)).toBe("locked");
      expect(rej(s, "a", lock, T0 + E + 2_500)).toBe("locked");
    });

    it("(e) yalnız başkanın Bitti dediği görünür; dağıtım içeriği sızmaz", () => {
      let s = giving();
      s = act(s, "a", give([["c", 1]]), T0 + E + 2_000);
      expect(pub(s, E + 2_100).ready).toEqual([]);
      s = act(s, "a", lock, T0 + E + 2_100);
      const p = pub(s, E + 2_200);
      expect(p.ready).toEqual(["a"]);
      expect(JSON.stringify(p)).not.toMatch(/tokens|"n"/);
      expect(priv(s, "a", E + 2_200).locked).toBe(true);
      expect(priv(s, "b", E + 2_200).locked).toBe(false);
    });
  });
});

describe("rusvet-darbe darbe (O3)", () => {
  const E = RUSVET_VOTE_MS;
  const COUP_AT = E + RUSVET_GIVE_MS;
  const P5 = ["a", "b", "c", "d", "e"];
  const coup = (yes: boolean): RusvetAction => ({ kind: "coup", yes });
  /** a: 4 oy alır (bütçe 4), başkan olur. */
  const STAR5: [string, string][] = [
    ["b", "a"],
    ["c", "a"],
    ["d", "a"],
    ["e", "a"],
    ["a", "b"],
  ];
  /** a başkan; b 2, c 2 alır; d ve e jeton almaz (hak sahipleri). */
  const coupState = (
    players = P5,
    edges = STAR5,
    tokens: [string, number][] = [
      ["b", 2],
      ["c", 2],
    ],
  ) => {
    const s = act(at(withVotes(players, edges), E + 1), "a", give(tokens), T0 + E + 1_000);
    return rusvetDarbe.tick(s, ctx(T0 + COUP_AT, players));
  };
  const scoresAfter = (s: RusvetState) => rusvetDarbe.result(s).miniScores;

  it("jeton almayan oyuncular hak sahibidir; başkan ve jeton alanlar değildir", () => {
    const s = coupState();
    expect(s.stage).toBe("coup");
    expect(s.coupEligible).toEqual(["d", "e"]);
    const p = pub(s, COUP_AT + 1);
    expect(p.phase).toBe("coup");
    expect(p.coup?.eligible).toEqual(["d", "e"]);
    expect(p.coup?.tokens).toEqual({ a: 0, b: 2, c: 2, d: 0, e: 0 });
    expect(p.phaseEndsAt - p.phaseStartedAt).toBe(RUSVET_COUP_MS);
    expect(priv(s, "d", COUP_AT + 1).canCoup).toBe(true);
    expect(priv(s, "a", COUP_AT + 1).canCoup).toBe(false);
    expect(priv(s, "b", COUP_AT + 1).canCoup).toBe(false);
    expect(rej(s, "b", coup(true), T0 + COUP_AT + 100)).toBe("not_eligible");
    expect(rej(s, "a", coup(true), T0 + COUP_AT + 100)).toBe("not_eligible");
  });

  it("darbe oyu yalnız darbe aşamasında kabul edilir", () => {
    const s = withVotes(P5, STAR5);
    expect(rej(s, "d", coup(true), T0 + 1_000)).toBe("wrong_phase");
    const giving = at(s, E + 1);
    expect(rej(giving, "d", coup(true), T0 + E + 2_000)).toBe("wrong_phase");
    const done = coupState();
    expect(rej(done, "d", coup(true), T0 + COUP_AT + RUSVET_COUP_MS + 1)).toBe("ended");
  });

  it("oy tek seferliktir", () => {
    let s = coupState();
    s = act(s, "d", coup(false), T0 + COUP_AT + 100);
    expect(rej(s, "d", coup(true), T0 + COUP_AT + 200)).toBe("locked");
  });

  it("2 hak sahibinden 2'si Darbe derse (kesin çoğunluk) başkanın +1'i iptal olur; jetonlar etkilenmez", () => {
    let s = coupState();
    s = act(s, "d", coup(true), T0 + COUP_AT + 100);
    s = act(s, "e", coup(true), T0 + COUP_AT + 200);
    const p = pub(s, COUP_AT + 5_000);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.coup).toEqual({ eligible: ["d", "e"], yes: 2, success: true });
    expect(p.reveal?.scores).toEqual({ a: 0, b: 2, c: 2, d: 0, e: 0 });
    expect(scoresAfter(s)).toEqual({ a: 0, b: 2, c: 2, d: 0, e: 0 });
  });

  it("eşitlik çoğunluk değildir: 2 hak sahibinden 1 Darbe -> başkan +1 korur", () => {
    let s = coupState();
    s = act(s, "d", coup(true), T0 + COUP_AT + 100);
    s = act(s, "e", coup(false), T0 + COUP_AT + 200);
    expect(pub(s, COUP_AT + 5_000).reveal?.coup).toEqual({ eligible: ["d", "e"], yes: 1, success: false });
    expect(scoresAfter(s).a).toBe(1);
  });

  it("oy vermeyen 'Darbe yok' sayılır: süre dolunca tek Darbe oyu 2 kişide çoğunluk olmaz", () => {
    let s = coupState();
    s = act(s, "d", coup(true), T0 + COUP_AT + 100);
    const p = pub(s, COUP_AT + RUSVET_COUP_MS);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.coup).toEqual({ eligible: ["d", "e"], yes: 1, success: false });
    expect(scoresAfter(s).a).toBe(1);
  });

  it("tek hak sahibi Darbe derse çoğunluktur (1/1)", () => {
    // a başkan, b 2 + c 2 + d 0; 4 oyuncu, bütçe 3 -> b 2, c 1, d 0
    const players = ["a", "b", "c", "d"];
    let s = coupState(players, STAR4, [
      ["b", 2],
      ["c", 1],
    ]);
    expect(s.coupEligible).toEqual(["d"]);
    s = act(s, "d", coup(true), T0 + COUP_AT + 100);
    expect(pub(s, COUP_AT + 5_000).reveal?.coup).toEqual({ eligible: ["d"], yes: 1, success: true });
    expect(scoresAfter(s).a).toBe(0);
  });

  it("3 hak sahibinden 2 Darbe -> çoğunluk; 3'te 1 -> değil", () => {
    // 6 oyuncu, a başkan 5 oy (bütçe 5)... b 2, c 0, d 0, e 0 -> a verir b:2,c:0 dağıtım kısmi, kalan rastgele
    // Hak sahibi sayısını kesin tutmak için doğrudan saf yardımcıyı da sına.
    const eligible = ["x", "y", "z"];
    expect(coupSucceeds(eligible, { x: true, y: true })).toBe(true);
    expect(coupSucceeds(eligible, { x: true })).toBe(false);
    expect(coupSucceeds(eligible, { x: true, y: true, z: true })).toBe(true);
    expect(coupSucceeds(["x", "y", "z", "w"], { x: true, y: true })).toBe(false);
    expect(coupSucceeds(["x", "y", "z", "w"], { x: true, y: true, z: true })).toBe(true);
    expect(coupSucceeds([], {})).toBe(false);
  });

  it("herkes jeton aldıysa darbe aşaması atlanır; başkan +1 alır", () => {
    // 3 oyuncu, a başkan 2 oy; b ve c birer jeton alır.
    const players = ["a", "b", "c"];
    let s = withVotes(players, [
      ["b", "a"],
      ["c", "a"],
      ["a", "b"],
    ]);
    s = act(
      at(s, E + 1),
      "a",
      give([
        ["b", 1],
        ["c", 1],
      ]),
      T0 + E + 1_000,
    );
    const p = pub(s, COUP_AT);
    expect(p.phase).toBe("reveal");
    expect(p.coup).toBeNull();
    expect(p.reveal?.coup).toBeNull();
    expect(p.reveal?.scores).toEqual({ a: 1, b: 1, c: 1 });
    expect(rusvetDarbe.isFinished(s, ctx(T0 + COUP_AT + RUSVET_REVEAL_MS, players))).toBe(true);
  });

  it("hak sahiplerinin hepsi oy verince aşama 1 sn sonra biter (erken bitiş)", () => {
    let s = coupState();
    s = act(s, "d", coup(false), T0 + COUP_AT + 1_000);
    expect(pub(s, COUP_AT + 1_100).phase).toBe("coup");
    expect(pub(s, COUP_AT + 1_100).ready).toEqual(["d"]);
    s = act(s, "e", coup(false), T0 + COUP_AT + 2_000);
    expect(pub(s, COUP_AT + 2_999).phase).toBe("coup");
    expect(pub(s, COUP_AT + 3_000).phase).toBe("reveal");
    expect(rusvetDarbe.isFinished(s, ctx(T0 + COUP_AT + 3_000 + RUSVET_REVEAL_MS - 1, P5))).toBe(false);
    expect(rusvetDarbe.isFinished(s, ctx(T0 + COUP_AT + 3_000 + RUSVET_REVEAL_MS, P5))).toBe(true);
  });

  it("erken bitiş bağlantıya bakmaz; tick ctx.connected okumaz", () => {
    let s = coupState();
    s = act(s, "d", coup(true), T0 + COUP_AT + 1_000, ["d"]);
    s = act(s, "e", coup(true), T0 + COUP_AT + 1_100, ["d", "e"]);
    const a = rusvetDarbe.tick(s, ctx(T0 + COUP_AT + 5_000, []));
    const b = rusvetDarbe.tick(s, ctx(T0 + COUP_AT + 5_000, P5));
    expect(a).toEqual(b);
  });

  it("tick darbe aşamasının sınırlarında durumu değiştirir", () => {
    const s = coupState();
    expect(rusvetDarbe.tick(s, ctx(T0 + COUP_AT + RUSVET_COUP_MS - 1, []))).toBe(s);
    expect(rusvetDarbe.tick(s, ctx(T0 + COUP_AT + RUSVET_COUP_MS, [])).stage).toBe("reveal");
  });

  it("toplam süre sınırı darbe aşamasını da kapsar", () => {
    const s = withVotes(P5, STAR5);
    expect(rusvetDarbe.isFinished(s, ctx(T0 + RUSVET_MAX_DURATION_MS))).toBe(true);
  });

  it("aynı tohum ve aynı eylemlerle sonuç aynıdır (yeniden oynatılabilir)", () => {
    const run = () => {
      let s = coupState();
      s = act(s, "d", coup(true), T0 + COUP_AT + 100);
      s = act(s, "e", coup(true), T0 + COUP_AT + 200);
      return JSON.stringify([s, pub(s, COUP_AT + 5_000), rusvetDarbe.result(s)]);
    };
    expect(run()).toBe(run());
  });

  it("parseAction: coup yalnız {kind, yes: boolean}", () => {
    expect(rusvetDarbe.parseAction({ kind: "coup", yes: true })).toEqual({ kind: "coup", yes: true });
    expect(rusvetDarbe.parseAction({ kind: "coup", yes: false })).toEqual({ kind: "coup", yes: false });
    for (const bad of [
      { kind: "coup" },
      { kind: "coup", yes: "evet" },
      { kind: "coup", yes: 1 },
      { kind: "coup", yes: true, extra: 1 },
    ])
      expect(rusvetDarbe.parseAction(bad)).toBeNull();
  });

  describe("gizlilik", () => {
    const s0 = (() => {
      let s = coupState();
      s = act(s, "d", coup(true), T0 + COUP_AT + 100);
      return s;
    })();

    it("darbe sürerken kimsenin oyu, sayı ya da 'yes' alanı başka birinin görünümünde yoktur", () => {
      for (const off of [COUP_AT + 150, COUP_AT + RUSVET_COUP_MS - 1]) {
        const p = pub(s0, off);
        const json = JSON.stringify(p);
        expect(p.reveal).toBeNull();
        expect(json).not.toMatch(/yes|success|coupVotes|"myCoup"/);
        expect(p.ready).toEqual(["d"]); // yalnız kim oy verdi, ne verdiği değil
        for (const other of ["a", "b", "c", "e", null, "ghost"]) {
          const v = priv(s0, other, off);
          expect(v.myCoup).toBeNull();
        }
        expect(priv(s0, "d", off).myCoup).toBe(true);
      }
    });

    it("oy sonuç aşamasında bile yalnız sayı olarak açılır; kim ne dedi yok", () => {
      let s = act(s0, "e", coup(false), T0 + COUP_AT + 200);
      const p = pub(s, COUP_AT + 5_000);
      const json = JSON.stringify(p.reveal?.coup);
      expect(json).toBe('{"eligible":["d","e"],"yes":1,"success":false}');
      for (const id of ["a", "b", "c", "d", "e"]) {
        // sonuçta bile başkasının darbe oyu görünümlerde yok (yalnız kendi oyu, ve yalnız darbe aşamasında)
        expect(JSON.stringify(priv(s, id, COUP_AT + 5_000))).not.toContain('"myCoup":true');
      }
      s = s0;
    });

    it("darbe aşaması dışında kimse oy hakkı taşımaz (canCoup false)", () => {
      const giving = at(withVotes(P5, STAR5), E + 1);
      for (const id of P5) expect(priv(giving, id, E + 1_000).canCoup).toBe(false);
    });
  });
});
