import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  advanceSizma,
  cleanGuess,
  type SizmaState,
  sizma,
  sizmaGuessKey,
  sizmaOutcome,
  sizmaRunoff,
  speakerAt,
} from "./index.js";
import {
  SIZMA_CLUE_CAP_MS,
  SIZMA_COUNTDOWN_MS,
  SIZMA_FINAL_MS,
  SIZMA_GUESS_MS,
  SIZMA_MAX_DURATION_MS,
  SIZMA_NOTICE_MS,
  SIZMA_REVEAL_MS,
  SIZMA_RUNOFF_MS,
  SIZMA_TURN_MS,
  SIZMA_UNMASK_MS,
  SIZMA_VOTE_MS,
  type SizmaPublicView,
  type SizmaView,
} from "./types.js";
import { SIZMA_PAIRS } from "./words.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c", "d", "e"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
type S = SizmaState;

/** Sızma, kelimeler ve söyleme sırası sabitlenmiş durum (setup'ın rastgele seçimi yerine). */
function start(players: string[] = ["a", "b", "c"], infiltrator = "c"): S {
  const s = sizma.setup(players, ctx(T0, players));
  return { ...s, infiltrator, commonWord: "ÇAY", infiltratorWord: "KAHVE", order: [...players] };
}
const tick = (s: S, at: number) => sizma.tick(s, ctx(at, s.players));
const pub = (s: S, at: number): SizmaPublicView => sizma.publicView(tick(s, at), ctx(at, s.players));
const priv = (s: S, who: string | null, at: number): SizmaView =>
  sizma.view(tick(s, at), who, ctx(at, s.players));

function ok(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players): S {
  const parsed = sizma.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sizma.reduce(s, id, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function rej(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players) {
  const parsed = sizma.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sizma.reduce(s, id, parsed, ctx(at, connected));
  return isRejected(r) ? r.rejected : null;
}

/** Herkes "Oylamaya geç" der: oylama `at + 1 sn`'de başlar. */
function toVote(s: S, at = T0 + 1_000): S {
  let x = s;
  for (const id of x.players) x = ok(x, id, { kind: "skip" }, at);
  return x;
}
const VOTE_AT = T0 + 2_500;
const VOTE_END = T0 + 2_000 + SIZMA_VOTE_MS;
/** Oylar verilmiş, oylama süresi bitmiş durum. */
function voted(players: string[], infiltrator: string, edges: [string, string][]): S {
  let s = toVote(start(players, infiltrator));
  for (const [from, to] of edges) s = ok(s, from, { kind: "vote", target: to }, VOTE_AT);
  return s;
}
const NOTICE_END = VOTE_END + SIZMA_NOTICE_MS;

describe("sızma meta ve kurulum", () => {
  it("3-8 oyuncu, dikey, açılış en çok 3 madde, kısa ve teknik kelime yok", () => {
    expect(sizma.minPlayers).toBe(3);
    expect(sizma.maxPlayers).toBe(8);
    expect(sizma.orientation).toBe("portrait");
    expect(sizma.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(sizma.briefing.steps[1]).toBe("İki turda sırayla sesli ipucu ver");
    expect(sizma.briefing.steps[2]).toBe("Sızmayı oyla; eşitlikte yeniden oylanır");
    expect(JSON.stringify(sizma.briefing)).not.toMatch(/protocol|server|debug|stage/i);
  });

  it("süreler: konuşma 15 sn, geri sayım 3 sn, oylama 30 sn, ikinci oylama 15 sn, soru 10 sn, son şans 15 sn", () => {
    expect(SIZMA_TURN_MS).toBe(15_000);
    expect(SIZMA_COUNTDOWN_MS).toBe(3_000);
    expect(SIZMA_VOTE_MS).toBe(30_000);
    expect(SIZMA_RUNOFF_MS).toBe(15_000);
    expect(SIZMA_NOTICE_MS).toBe(10_000);
    expect(SIZMA_GUESS_MS).toBe(15_000);
    expect(SIZMA_CLUE_CAP_MS).toBe(300_000);
    // 8 kişide en kötü durum 8 × 2 × 15 sn = 4 dk: teknik tavanın altında.
    expect(8 * 2 * SIZMA_TURN_MS + SIZMA_COUNTDOWN_MS).toBeLessThan(SIZMA_CLUE_CAP_MS);
    const s = sizma.setup(["a", "b", "c"], ctx(T0));
    expect(s.clueEndsAt).toBe(T0 + 300_000);
    expect(s.turnEndsAt).toBe(T0 + 15_000);
    expect(SIZMA_MAX_DURATION_MS).toBeGreaterThan(SIZMA_CLUE_CAP_MS + SIZMA_VOTE_MS + SIZMA_RUNOFF_MS);
  });

  it("havuzdaki bir çift seçilir; ortak/sızma tarafı rastgele, iki kelime farklı", () => {
    const pool = new Set(
      SIZMA_PAIRS.map(([x, y]) => `${x.toLocaleUpperCase("tr-TR")}|${y.toLocaleUpperCase("tr-TR")}`),
    );
    const sides = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const s = sizma.setup(["a", "b", "c", "d"], ctx(T0, ["a", "b", "c", "d"], seed));
      const forward = `${s.commonWord}|${s.infiltratorWord}`;
      const backward = `${s.infiltratorWord}|${s.commonWord}`;
      expect(pool.has(forward) || pool.has(backward)).toBe(true);
      expect(s.commonWord).not.toBe(s.infiltratorWord);
      sides.add(pool.has(forward) ? "ilk-ortak" : "ikinci-ortak");
    }
    expect([...sides].sort()).toEqual(["ikinci-ortak", "ilk-ortak"]);
  });

  it("havuz: çiftler dolu, kendi içinde farklı ve tekrarsız", () => {
    expect(SIZMA_PAIRS.length).toBeGreaterThanOrEqual(150);
    const seen = new Set<string>();
    for (const [x, y] of SIZMA_PAIRS) {
      expect(x).not.toBe(y);
      const key = [x, y].sort().join("|");
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("tam bir sızma: her oyuncu eşit olasılıkla sızma olabilir; söyleme sırası oyuncuların permütasyonu", () => {
    const players = ["a", "b", "c", "d", "e"];
    const hits: Record<string, number> = {};
    for (let seed = 1; seed <= 300; seed++) {
      const s = sizma.setup(players, ctx(T0, players, seed));
      hits[s.infiltrator] = (hits[s.infiltrator] ?? 0) + 1;
      expect([...s.order].sort()).toEqual(players);
    }
    for (const id of players) expect(hits[id]).toBeGreaterThan(30);
  });

  it("kelimeler: sızma farklı kelimeyi, diğerleri ortak kelimeyi görür; izleyici görmez", () => {
    const s = start(["a", "b", "c", "d"], "c");
    expect(priv(s, "a", T0).word).toBe("ÇAY");
    expect(priv(s, "c", T0).word).toBe("KAHVE");
    expect(priv(s, null, T0).word).toBeNull();
    expect(priv(s, "ghost", T0).word).toBeNull();
  });
});

describe("sızma konuşma sırası (SZ-M3)", () => {
  const P = ["a", "b", "c", "d"];

  it("sıra iki turda aynıdır; konuşan ve tur ortak görünümde", () => {
    const s = start(P, "c");
    expect(speakerAt(s.order, 0)).toBe("a");
    expect(speakerAt(s.order, 4)).toBe("a");
    expect(speakerAt(s.order, 7)).toBe("d");
    expect(speakerAt(s.order, 8)).toBeNull();
    const p = pub(s, T0 + 10);
    expect(p.phase).toBe("clue");
    expect(p.turn).toBe(0);
    expect(p.turnEndsAt).toBe(T0 + SIZMA_TURN_MS);
    expect(sizma.notify?.(s, ctx(T0 + 10, P))).toEqual(["a"]);
  });

  it("'Söyledim'e yalnız sırası gelen basar; sıra bir sonrakine geçer ve süresi yeniden başlar", () => {
    let s = start(P, "c");
    expect(rej(s, "b", { kind: "said", turn: 0 }, T0 + 2_000)).toBe("not_your_turn");
    s = ok(s, "a", { kind: "said", turn: 0 }, T0 + 2_000);
    expect(s.turn).toBe(1);
    expect(s.turnStartedAt).toBe(T0 + 2_000);
    expect(s.turnEndsAt).toBe(T0 + 2_000 + SIZMA_TURN_MS);
    // Eski basış ikinci sırayı atlatmaz.
    expect(rej(s, "b", { kind: "said", turn: 0 }, T0 + 2_100)).toBe("stale_turn");
    expect(sizma.notify?.(s, ctx(T0 + 2_100, P))).toEqual(["b"]);
  });

  it("15 sn dolarsa sıra kendiliğinden geçer; tick zamanı sonucu değiştirmez", () => {
    const s = start(P, "c");
    const late = tick(s, T0 + 3 * SIZMA_TURN_MS + 10);
    let step = s;
    for (let t = T0; t <= T0 + 3 * SIZMA_TURN_MS + 10; t += 700) step = tick(step, t);
    step = tick(step, T0 + 3 * SIZMA_TURN_MS + 10);
    expect(late.turn).toBe(3);
    expect(late.turnStartedAt).toBe(T0 + 3 * SIZMA_TURN_MS);
    expect(JSON.stringify(step)).toBe(JSON.stringify(late));
  });

  it("iki tur bitince 3 sn geri sayım, sonra oylama kendiliğinden başlar", () => {
    let s = start(["a", "b", "c"], "c");
    let at = T0 + 1_000;
    for (let turn = 0; turn < 6; turn++) {
      s = ok(s, speakerAt(s.order, turn) as string, { kind: "said", turn }, at);
      at += 1_000;
    }
    const last = at - 1_000;
    expect(s.clueEndsAt).toBe(last + SIZMA_COUNTDOWN_MS);
    expect(pub(s, last + 100).phase).toBe("clue");
    expect(pub(s, last + 100).turn).toBe(6);
    expect(pub(s, last + SIZMA_COUNTDOWN_MS).phase).toBe("vote");
    expect(pub(s, last + SIZMA_COUNTDOWN_MS).phaseEndsAt).toBe(last + SIZMA_COUNTDOWN_MS + SIZMA_VOTE_MS);
    expect(rej(s, "a", { kind: "said", turn: 6 }, last + 100)).toBe("not_clue");
  });

  it("bağlantısı kopuk sıradakiler anında atlanır; kopuk konuşanın sırasını başka biri geçirebilir", () => {
    let s = start(P, "c");
    const on = ["a", "c", "d"];
    s = ok(s, "a", { kind: "said", turn: 0 }, T0 + 1_000, on);
    expect(s.turn).toBe(2); // b atlandı
    // c'nin bağlantısı koptu: d sırayı geçirebilir; c bağlıyken geçiremez.
    expect(rej(s, "d", { kind: "said", turn: 2 }, T0 + 1_500, on)).toBe("not_your_turn");
    s = ok(s, "d", { kind: "said", turn: 2 }, T0 + 1_500, ["a", "d"]);
    expect(s.turn).toBe(3);
    expect(speakerAt(s.order, s.turn)).toBe("d");
  });

  it("'Oylamaya geç': bağlı herkes basarsa kalan sıralar atlanır, oylama 1 sn sonra başlar", () => {
    let s = start(P, "c");
    for (const id of ["a", "b", "c"]) s = ok(s, id, { kind: "skip" }, T0 + 5_000);
    expect(s.clueClosing).toBe(false);
    expect(pub(s, T0 + 5_100).ready).toEqual(["a", "b", "c"]);
    s = ok(s, "d", { kind: "skip" }, T0 + 5_000);
    expect(s.turn).toBe(8);
    expect(s.clueEndsAt).toBe(T0 + 6_000);
    expect(pub(s, T0 + 6_000).phase).toBe("vote");
    expect(rej(s, "a", { kind: "said", turn: 8 }, T0 + 5_500)).toBe("not_clue");
  });

  it("bağlantısı kopan beklenmez; kimse bağlı değilken geçilmez", () => {
    let s = start(P, "c");
    for (const id of ["a", "b"]) s = ok(s, id, { kind: "skip" }, T0 + 5_000, ["a", "b"]);
    expect(s.clueClosing).toBe(true);
    const t = ok(start(P, "c"), "a", { kind: "skip" }, T0 + 5_000, []);
    expect(t.clueClosing).toBe(false);
  });

  it("teknik tavan: sıralar sürse de 5 dk'da oylama başlar", () => {
    const s: S = { ...start(P, "c"), clueEndsAt: T0 + 20_000, voteEndsAt: T0 + 20_000 + SIZMA_VOTE_MS };
    expect(pub(s, T0 + 20_000).phase).toBe("vote");
  });

  it("ipucu aşamasında oy, kilit, cevap ve tahmin reddedilir", () => {
    const s = start(P, "c");
    expect(rej(s, "a", { kind: "vote", target: "b" }, T0 + 10)).toBe("not_voting");
    expect(rej(s, "a", { kind: "lock" }, T0 + 10)).toBe("not_voting");
    expect(rej(s, "a", { kind: "notice", yes: true }, T0 + 10)).toBe("not_notice");
    expect(rej(s, "c", { kind: "guess", text: "çay" }, T0 + 10)).toBe("not_guess");
  });
});

describe("sızma oylama", () => {
  const P = ["a", "b", "c", "d", "e"];

  it("kendine oy serbest; oy değiştirilebilir; oylar süre bitene kadar yalnız sahibine görünür", () => {
    let s = toVote(start(P, "c"));
    s = ok(s, "a", { kind: "vote", target: "a" }, VOTE_AT);
    s = ok(s, "b", { kind: "vote", target: "a" }, VOTE_AT);
    s = ok(s, "b", { kind: "vote", target: "c" }, VOTE_AT + 10);
    expect(priv(s, "b", VOTE_AT + 20).myVote).toBe("c");
    expect(priv(s, "a", VOTE_AT + 20).myVote).toBe("a");
    expect(JSON.stringify(pub(s, VOTE_AT + 20))).not.toMatch(/"votes"|tally/);
  });

  it("bağlantısı kopmuş oyuncuya da oy verilebilir (SZ-M6); bilinmeyen hedef reddedilir", () => {
    let s = toVote(start(P, "c"));
    s = ok(s, "a", { kind: "vote", target: "c" }, VOTE_AT, ["a", "b"]);
    expect(s.votes.a).toBe("c");
    expect(rej(s, "a", { kind: "vote", target: "zz" }, VOTE_AT)).toBe("unknown_target");
  });

  it("kilit: oysuz kilitlenemez; herkes kilitleyince oylama 1 sn sonra biter", () => {
    let s = toVote(start(["a", "b", "c"], "c"));
    expect(rej(s, "a", { kind: "lock" }, VOTE_AT)).toBe("nothing_to_lock");
    for (const id of ["a", "b", "c"]) {
      s = ok(s, id, { kind: "vote", target: "c" }, VOTE_AT);
      s = ok(s, id, { kind: "lock" }, VOTE_AT + 100);
    }
    expect(s.voteEndsAt).toBe(VOTE_AT + 1_100);
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_AT + 200)).toBe("locked");
    expect(pub(s, VOTE_AT + 1_100).phase).toBe("notice");
  });

  it("oylama bitince oy reddedilir; 1 ms önce kabul edilir", () => {
    const s = toVote(start(P, "c"));
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_END - 1)).toBeNull();
    expect(rej(s, "a", { kind: "vote", target: "b" }, VOTE_END)).toBe("not_voting");
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    for (const good of [
      { kind: "skip" },
      { kind: "lock" },
      { kind: "said", turn: 3 },
      { kind: "vote", target: "a" },
      { kind: "notice", yes: false },
      { kind: "guess", text: "çay" },
    ])
      expect(sizma.parseAction(good)).toEqual(good);
    for (const bad of [
      null,
      [],
      "skip",
      { kind: "skip", x: 1 },
      { kind: "said" },
      { kind: "said", turn: -1 },
      { kind: "said", turn: 1.5 },
      { kind: "said", turn: "1" },
      { kind: "vote", target: "" },
      { kind: "vote", target: "x".repeat(65) },
      { kind: "notice", yes: 1 },
      { kind: "guess", text: "" },
      { kind: "guess", text: "x".repeat(65) },
      { kind: "guess", text: 3 },
      { kind: "clue", text: "ipucu" },
    ])
      expect(sizma.parseAction(bad)).toBeNull();
  });
});

describe("sızma ikinci oylama (SZ-M4)", () => {
  const P = ["a", "b", "c", "d"];

  it("eşitlikte yalnız eşit adaylar arasında 15 sn'lik ikinci oylama; oylar silinir", () => {
    const s = voted(P, "c", [
      ["a", "b"],
      ["b", "c"],
      ["c", "b"],
      ["d", "c"],
    ]);
    const p = pub(s, VOTE_END);
    expect(p.phase).toBe("runoff");
    expect(p.runoff).toEqual(["b", "c"]);
    expect(p.phaseEndsAt).toBe(VOTE_END + SIZMA_RUNOFF_MS);
    expect(p.ready).toEqual([]);
    // Oy sayıları gösterilmez.
    expect(JSON.stringify(p)).not.toMatch(/tally|"votes"/);
    expect(priv(s, "a", VOTE_END).myVote).toBeNull();
    // Önceki oylamada eşitlik yokken aday listesi görünmez.
    expect(pub(s, VOTE_END - 1).runoff).toBeNull();
  });

  it("aday olmayana oy reddedilir; adaylar da oy verir; eşitlik bozulursa sonuç ona göre", () => {
    let s = tick(
      voted(P, "c", [
        ["a", "b"],
        ["b", "c"],
        ["c", "b"],
        ["d", "c"],
      ]),
      VOTE_END,
    );
    const at = VOTE_END + 1_000;
    expect(rej(s, "a", { kind: "vote", target: "a" }, at)).toBe("not_candidate");
    for (const id of ["a", "b", "d"]) s = ok(s, id, { kind: "vote", target: "c" }, at);
    s = ok(s, "c", { kind: "vote", target: "c" }, at);
    for (const id of P) s = ok(s, id, { kind: "lock" }, at + 100);
    expect(s.runoffEndsAt).toBe(at + 1_100);
    const n = pub(s, at + 1_100);
    expect(n.phase).toBe("notice");
    expect(n.phaseEndsAt).toBe(at + 1_100 + SIZMA_NOTICE_MS);
    const r = pub(s, at + 1_100 + SIZMA_NOTICE_MS).reveal;
    expect(r?.caught).toBe(true);
    expect(r?.runoff).toEqual(["b", "c"]);
    expect(r?.tally).toEqual({ a: 0, b: 0, c: 4, d: 0 });
  });

  it("ikinci oylamada da eşitlik ya da oy yoksa sızma kurtulur", () => {
    let s = tick(
      voted(P, "c", [
        ["a", "b"],
        ["b", "c"],
      ]),
      VOTE_END,
    );
    s = ok(s, "a", { kind: "vote", target: "b" }, VOTE_END + 500);
    s = ok(s, "b", { kind: "vote", target: "c" }, VOTE_END + 500);
    const end = VOTE_END + SIZMA_RUNOFF_MS + SIZMA_NOTICE_MS;
    expect(pub(s, end).reveal?.caught).toBe(false);
    expect(sizma.result(tick(s, end)).awards.c).toBe(2);
    const empty = tick(
      voted(P, "c", [
        ["a", "b"],
        ["b", "c"],
      ]),
      end,
    );
    expect(pub(empty, end).reveal?.caught).toBe(false);
  });

  it("ilk oylamada hiç oy yoksa ikinci oylama olmaz; tek lider varsa da olmaz", () => {
    expect(sizmaRunoff(P, {})).toBeNull();
    expect(sizmaRunoff(P, { a: "b", b: "b", c: "a" })).toBeNull();
    expect(pub(voted(P, "c", []), VOTE_END).phase).toBe("notice");
  });

  it("3 oyuncuda 1-1-1: üç aday arasında yeniden oylanır", () => {
    expect(sizmaRunoff(["a", "b", "c"], { a: "b", b: "c", c: "a" })).toEqual(["a", "b", "c"]);
  });

  it("sızma adaylar arasında değilse de ikinci oylama yapılır; sonuç kurtuldu", () => {
    const s = voted(P, "d", [
      ["a", "b"],
      ["b", "c"],
    ]);
    expect(pub(s, VOTE_END).phase).toBe("runoff");
    expect(pub(s, VOTE_END).runoff).toEqual(["b", "c"]);
    const end = VOTE_END + SIZMA_RUNOFF_MS + SIZMA_NOTICE_MS;
    expect(pub(s, end).reveal?.caught).toBe(false);
  });

  it("ortak görünüm sızmanın kim olduğundan bağımsızdır", () => {
    const edges: [string, string][] = [
      ["a", "b"],
      ["b", "c"],
    ];
    for (const at of [VOTE_END, VOTE_END + 5_000, VOTE_END + SIZMA_RUNOFF_MS + 100]) {
      expect(JSON.stringify(pub(voted(P, "c", edges), at))).toBe(
        JSON.stringify(pub(voted(P, "a", edges), at)),
      );
    }
  });
});

describe("sızma puanlama (SZ-M1, SZ-M2)", () => {
  const P = ["a", "b", "c", "d", "e"];

  it("yakalanırsa yalnız sızmaya oy verenler +1; başkasına oy veren ve oy vermeyen 0; sızma 0", () => {
    const o = sizmaOutcome(P, "c", { a: "c", b: "c", c: "a", d: "a", e: "c" });
    // c 3, a 2: tek başına en çok oy.
    expect(o.caught).toBe(true);
    expect(o.scores).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 1 });
    expect(o.rightVoters).toEqual(["a", "b", "e"]);
  });

  it("sızma kendine oy verse de yakalama puanı almaz", () => {
    const o = sizmaOutcome(["a", "b", "c"], "c", { a: "c", c: "c" });
    expect(o.caught).toBe(true);
    expect(o.scores).toEqual({ a: 1, b: 0, c: 0 });
  });

  it("kurtulursa sızma +2, diğerleri 0; eksi puan yok", () => {
    const o = sizmaOutcome(P, "c", { a: "b", b: "a", c: "b" });
    expect(o.caught).toBe(false);
    expect(o.scores).toEqual({ a: 0, b: 0, c: 2, d: 0, e: 0 });
    expect(sizmaOutcome(P, "c", {}).scores.c).toBe(2);
  });

  it("Evet diyen sızma olmayan, yakalama puanını alamaz; sızmanın Evet bonusu +1", () => {
    const votes = { a: "c", b: "c", d: "c" };
    const o = sizmaOutcome(P, "c", votes, {}, { a: true, b: false, c: true, e: true });
    expect(o.scores).toEqual({ a: 0, b: 1, c: 1, d: 1, e: 0 });
    // Doğru oy listesi Evet'ten bağımsızdır (✓ gösterimi); puan ayrı.
    expect(o.rightVoters).toEqual(["a", "b", "d"]);
    const esc = sizmaOutcome(P, "c", { a: "b" }, {}, { a: true, c: true });
    expect(esc.scores).toEqual({ a: 0, b: 0, c: 3, d: 0, e: 0 });
  });

  it("puan aralığı 0…+3, eksi yok", () => {
    for (const notices of [{}, { c: true }, { a: true, c: true }]) {
      for (const votes of [{}, { a: "c", b: "c" }, { a: "b", b: "a" }]) {
        for (const stole of [false, true]) {
          for (const v of Object.values(sizmaOutcome(P, "c", votes, {}, notices, stole).scores)) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });
});

describe("sızma: Sızma sen miydin? (10 sn)", () => {
  const P = ["a", "b", "c"];

  it("oylamadan sonra 10 sn; cevap tek seferlik; herkes cevaplarsa 1 sn sonra biter", () => {
    let s = voted(P, "c", [["a", "b"]]);
    const at = VOTE_END + 500;
    expect(pub(s, at).phase).toBe("notice");
    s = ok(s, "a", { kind: "notice", yes: true }, at);
    expect(rej(s, "a", { kind: "notice", yes: false }, at + 10)).toBe("locked");
    expect(pub(s, at + 10).ready).toEqual(["a"]);
    expect(priv(s, "a", at + 10).myNotice).toBe(true);
    expect(priv(s, "b", at + 10).myNotice).toBeNull();
    s = ok(s, "b", { kind: "notice", yes: false }, at + 20);
    s = ok(s, "c", { kind: "notice", yes: true }, at + 30);
    expect(s.noticeEndsAt).toBe(at + 1_030);
    expect(pub(s, at + 1_030).phase).toBe("reveal");
    expect(pub(s, at + 1_030).reveal?.selfNoticed).toBe(true);
  });

  it("kopuk oyuncu beklenmez; cevap vermeyen Hayır sayılır", () => {
    let s = voted(P, "c", [["a", "b"]]);
    s = ok(s, "a", { kind: "notice", yes: false }, VOTE_END + 100, ["a"]);
    expect(s.noticeEndsAt).toBe(VOTE_END + 1_100);
    expect(pub(voted(P, "c", []), NOTICE_END).reveal?.selfNoticed).toBe(false);
  });

  it("ortak görünüm cevapların ne olduğunu ve sızmayı içermez", () => {
    const a = ok(voted(P, "c", []), "a", { kind: "notice", yes: true }, VOTE_END + 100);
    const b = ok(voted(P, "a", []), "a", { kind: "notice", yes: false }, VOTE_END + 100);
    const x = JSON.stringify(pub(a, VOTE_END + 200));
    expect(x).toBe(JSON.stringify(pub(b, VOTE_END + 200)));
    expect(x).not.toMatch(/selfNoticed|infiltrator|"yes/);
  });
});

describe("sızma son şans (SZ-M5)", () => {
  const P = ["a", "b", "c", "d"];
  /** c yakalanır (a, b, d → c). */
  const caught = () =>
    voted(P, "c", [
      ["a", "c"],
      ["b", "c"],
      ["d", "c"],
      ["c", "a"],
    ]);
  const OPEN = NOTICE_END + SIZMA_UNMASK_MS;

  it("yakalanınca maske düşer: sızma ve oylar açılır, kelimeler ve puanlar açılmaz", () => {
    const s = caught();
    const p = pub(s, NOTICE_END);
    expect(p.phase).toBe("guess");
    expect(p.reveal?.infiltrator).toBe("c");
    expect(p.reveal?.caught).toBe(true);
    expect(p.reveal?.votes).toEqual({ a: "c", b: "c", d: "c", c: "a" });
    expect(p.reveal?.final).toBeNull();
    expect(p.reveal?.guessOpensAt).toBe(OPEN);
    expect(p.reveal?.guessEndsAt).toBe(OPEN + SIZMA_GUESS_MS);
    expect(JSON.stringify(p)).not.toMatch(/ÇAY|KAHVE/);
    // Ortak kelime kimsenin ekranında yok; sızma yalnız kendi kelimesini görür.
    expect(priv(s, "a", NOTICE_END).word).toBeNull();
    expect(priv(s, "c", NOTICE_END).word).toBe("KAHVE");
    expect(sizma.secrets(tick(s, NOTICE_END)).find((x) => x.value === "ÇAY")?.ownerIds).toEqual([]);
    expect(sizma.revealAt?.(s, ctx(NOTICE_END, P))).toBeNull();
  });

  it("yalnız sızma, yalnız pencere açılınca ve tek kez tahmin eder", () => {
    const s = tick(caught(), NOTICE_END);
    expect(rej(s, "c", { kind: "guess", text: "çay" }, OPEN - 1)).toBe("not_guess_yet");
    expect(rej(s, "a", { kind: "guess", text: "çay" }, OPEN + 10)).toBe("not_infiltrator");
    expect(rej(s, "c", { kind: "guess", text: "  ...  " }, OPEN + 10)).toBe("bad_guess");
    const g = ok(s, "c", { kind: "guess", text: "çay" }, OPEN + 10);
    expect(rej(g, "c", { kind: "guess", text: "kahve" }, OPEN + 20)).toBe("locked");
    expect(priv(g, "c", OPEN + 20).locked).toBe(true);
    // Tahminden 1 sn sonra kelimeler açılır.
    expect(g.guessEndsAt).toBe(OPEN + 1_010);
    expect(pub(g, OPEN + 1_010).phase).toBe("reveal");
  });

  it("doğru tahmin: KELİMEYİ ÇALDI, sızma +1; yakalayanların puanı değişmez", () => {
    const g = ok(tick(caught(), NOTICE_END), "c", { kind: "guess", text: " Çay! " }, OPEN + 10);
    const end = OPEN + 1_010;
    const f = pub(g, end).reveal?.final;
    expect(f?.stole).toBe(true);
    expect(f?.guess).toBe("ÇAY!");
    expect(f?.commonWord).toBe("ÇAY");
    expect(f?.scores).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(sizma.result(tick(g, end)).awards).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    // Evet + doğru tahmin: en çok +2.
    let n = ok(caught(), "c", { kind: "notice", yes: true }, VOTE_END + 100);
    n = ok(tick(n, NOTICE_END), "c", { kind: "guess", text: "çay" }, OPEN + 10);
    expect(sizma.result(tick(n, OPEN + 2_000)).awards.c).toBe(2);
  });

  it("yanlış tahmin ya da süre dolarsa ek puan yok", () => {
    const g = ok(tick(caught(), NOTICE_END), "c", { kind: "guess", text: "çayı" }, OPEN + 10);
    expect(pub(g, OPEN + 1_010).reveal?.final?.stole).toBe(false);
    const t = tick(caught(), OPEN + SIZMA_GUESS_MS);
    expect(t.stage).toBe("reveal");
    expect(pub(t, OPEN + SIZMA_GUESS_MS).reveal?.final?.guess).toBeNull();
    expect(sizma.result(t).awards.c).toBe(0);
  });

  it("karşılaştırma: büyük/küçük harf, boşluk, noktalama ve şapka farkı yok sayılır; ek almış hâl sayılmaz", () => {
    expect(sizmaGuessKey(" kâğıt. ")).toBe(sizmaGuessKey("KAĞIT"));
    expect(sizmaGuessKey("çay")).toBe("ÇAY");
    expect(sizmaGuessKey("ÇAYI")).not.toBe(sizmaGuessKey("ÇAY"));
    expect(sizmaGuessKey("cay")).not.toBe(sizmaGuessKey("ÇAY"));
    expect(sizmaGuessKey("istanbul")).toBe("İSTANBUL");
    expect(cleanGuess("   ")).toBeNull();
    expect(cleanGuess("x".repeat(25))).toBeNull();
    expect(cleanGuess("a\u0000b")).toBe("A B");
  });

  it("zaman çizelgesi: açılış 7 sn + son şans 15 sn + son açılış 5 sn; revealAt son şans bitişi", () => {
    const s = caught();
    const end = OPEN + SIZMA_GUESS_MS;
    expect(sizma.revealAt?.(s, ctx(end, P))).toBe(end);
    expect(sizma.isFinished(s, ctx(end + SIZMA_FINAL_MS - 1, P))).toBe(false);
    expect(sizma.isFinished(s, ctx(end + SIZMA_FINAL_MS, P))).toBe(true);
    expect(pub(s, end).reveal?.finalAt).toBe(end);
    expect(pub(s, end).reveal?.finishAt).toBe(end + SIZMA_FINAL_MS);
  });

  it("kurtulan sızmaya son şans gelmez: açılış doğrudan sonuç, revealAt soru bitişi", () => {
    const s = voted(P, "c", [["a", "b"]]);
    const p = pub(s, NOTICE_END);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.guessOpensAt).toBeNull();
    expect(p.reveal?.final?.commonWord).toBe("ÇAY");
    expect(sizma.revealAt?.(s, ctx(NOTICE_END, P))).toBe(NOTICE_END);
    expect(sizma.isFinished(s, ctx(NOTICE_END + SIZMA_REVEAL_MS, P))).toBe(true);
    expect(sizma.isFinished(s, ctx(NOTICE_END + SIZMA_REVEAL_MS - 1, P))).toBe(false);
  });
});

describe("sızma gizlilik (sızma kimliği kısa; yapısal kontrol)", () => {
  const players = ["pa1", "pb2", "pc3", "pd4"];
  const A = start(players, "pc3");
  const B: S = { ...A, infiltrator: "pa1", commonWord: "KAHVE", infiltratorWord: "ÇAY" };

  it("publicView açılana kadar sızmayı, kelimeleri ve oyları içermez: sızma kimse olsun aynı çıkar", () => {
    for (const at of [T0 + 1, T0 + 20_000, T0 + 100_000, T0 + 125_000, T0 + 150_000]) {
      const a = JSON.stringify(pub(A, at));
      expect(a).toBe(JSON.stringify(pub(B, at)));
      expect(a).not.toMatch(/ÇAY|KAHVE|infiltrator|Word|"votes"|tally/);
    }
  });

  it("view yalnız word, myVote, myNotice ve locked verir; sızma ile diğerlerinin görünümü aynı biçimde", () => {
    for (const who of players) {
      expect(Object.keys(priv(A, who, T0 + 10)).sort()).toEqual(["locked", "myNotice", "myVote", "word"]);
    }
    expect(JSON.stringify(priv(A, "pc3", T0 + 10))).not.toMatch(/infiltr|sızma|odd|fake/i);
    for (const who of ["pa1", "pb2", "pd4"])
      expect(JSON.stringify(priv(A, who, T0 + 10))).not.toContain("KAHVE");
    expect(JSON.stringify(priv(A, "pc3", T0 + 10))).not.toContain("ÇAY");
  });

  it("secrets: ortak kelime sızma dışındakilere, sızma kelimesi yalnız sızmaya; son açılışta boş", () => {
    const secrets = sizma.secrets(A);
    expect(secrets.find((x) => x.value === "ÇAY")?.ownerIds).toEqual(["pa1", "pb2", "pd4"]);
    expect(secrets.find((x) => x.value === "KAHVE")?.ownerIds).toEqual(["pc3"]);
    const end = toVote(A);
    expect(sizma.secrets(tick(end, T0 + 2_000 + SIZMA_VOTE_MS + SIZMA_NOTICE_MS))).toEqual([]);
  });

  it("çok kısa kelimeler secrets()'a girmez ama görünümlerde yine yalnız sahibine gider", () => {
    const short: S = { ...A, commonWord: "AT", infiltratorWord: "EŞEK" };
    expect(sizma.secrets(short).map((x) => x.value)).toEqual(["EŞEK"]);
    expect(priv(short, "pa1", T0).word).toBe("AT");
    expect(priv(short, "pc3", T0).word).toBe("EŞEK");
  });
});

describe("sızma tekrar oynatma", () => {
  it("aynı eylemler aynı sonucu verir; tick sıklığı sonucu değiştirmez", () => {
    const P = ["a", "b", "c", "d"];
    const run = (stepMs: number) => {
      let s = start(P, "c");
      s = ok(s, "a", { kind: "said", turn: 0 }, T0 + 4_000);
      for (let t = T0; t < T0 + 120_000; t += stepMs) s = tick(s, t);
      s = ok(s, "a", { kind: "vote", target: "c" }, T0 + 120_000);
      s = ok(s, "b", { kind: "vote", target: "d" }, T0 + 120_000);
      for (let t = T0 + 120_000; t < T0 + 400_000; t += stepMs) s = tick(s, t);
      s = advanceSizma(s, T0 + 400_000);
      return JSON.stringify([s, sizma.result(s)]);
    };
    expect(run(100)).toBe(run(3_700));
  });
});
