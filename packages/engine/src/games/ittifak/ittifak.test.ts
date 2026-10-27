import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { type IttifakState, ittifak, ittifakFillVotes, ittifakReveal } from "./index.js";
import {
  ITTIFAK_DURATION_MS,
  ITTIFAK_MAX_PROMISES,
  ITTIFAK_REVEAL_MS,
  ITTIFAK_TALK_MS,
  ITTIFAK_VOTE_MS,
  type IttifakPublicView,
  type IttifakView,
} from "./types.js";

const T0 = 1_000_000;
const VOTE_AT = T0 + ITTIFAK_TALK_MS + 1_000;
const VOTE_END = T0 + ITTIFAK_TALK_MS + ITTIFAK_VOTE_MS;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c", "d", "e"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players: string[] = ["a", "b", "c"], seed = 1) =>
  ittifak.setup(players, ctx(T0, players, seed));

function vote(state: ReturnType<typeof start>, from: string, to: string, at = VOTE_AT, connected?: string[]) {
  const r = ittifak.reduce(state, from, { kind: "vote", target: to }, ctx(at, connected ?? state.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const play = (players: string[], edges: [string, string][]) => {
  let s = start(players);
  for (const [from, to] of edges) s = vote(s, from, to);
  return s;
};
const pub = (s: ReturnType<typeof start>, at: number) =>
  ittifak.publicView(s, ctx(at, s.players)) as IttifakPublicView;
const priv = (s: ReturnType<typeof start>, who: string | null, at: number) =>
  ittifak.view(s, who, ctx(at, s.players)) as IttifakView;
const scores = (s: ReturnType<typeof start>) => ittifak.result(s).miniScores;

describe("ittifak meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(ittifak.minPlayers).toBe(3);
    expect(ittifak.maxPlayers).toBe(8);
    expect(ittifak.orientation).toBe("portrait");
    expect(ittifak.briefing.steps).toHaveLength(3);
    expect(JSON.stringify(ittifak.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("süreler: 60 sn pazarlık, 15 sn oylama", () => {
    const s = start();
    expect(s.talkEndsAt - s.startedAt).toBe(60_000);
    expect(s.voteEndsAt - s.talkEndsAt).toBe(15_000);
    expect(s.finishAt - s.startedAt).toBe(ITTIFAK_DURATION_MS);
    expect(ITTIFAK_REVEAL_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("ittifak puanlama: alınan her oy +1 genel puan", () => {
  it("herkes oy verir; oylar toplanır, awards = miniScores", () => {
    const s = play(
      ["a", "b", "c", "d"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
        ["d", "a"],
      ],
    );
    expect(scores(s)).toEqual({ a: 3, b: 1, c: 0, d: 0 });
    expect(ittifak.result(s).awards).toEqual(scores(s));
  });

  it("oy eşitliği sorun değil: herkes aldığı oy kadar alır", () => {
    const s = play(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ],
    );
    expect(scores(s)).toEqual({ a: 2, b: 1, c: 0 });
    const tie = play(
      ["a", "b", "c"],
      [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    );
    expect(scores(tie)).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("toplam puan oyuncu sayısına eşittir (herkes tam bir oy kullanır)", () => {
    for (let n = 3; n <= 8; n++) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const s = start(players, n * 17);
      const total = Object.values(scores(s)).reduce((a, b) => a + b, 0);
      expect(total).toBe(n);
    }
  });

  it("oy değiştirilebilir: son oy geçerli", () => {
    let s = start(["a", "b", "c"]);
    s = vote(s, "a", "b");
    s = vote(s, "a", "c", VOTE_AT + 2_000);
    s = vote(s, "b", "a");
    s = vote(s, "c", "a");
    expect(scores(s)).toEqual({ a: 2, b: 0, c: 1 });
  });

  it("aynı oyu tekrar vermek durumu değiştirmez", () => {
    const s = advanceTo(vote(start(), "a", "b"), VOTE_AT);
    expect(vote(s, "a", "b", VOTE_AT + 5_000)).toBe(s);
  });
});

function advanceTo(s: ReturnType<typeof start>, at: number) {
  return ittifak.tick(s, ctx(at, s.players));
}

describe("ittifak eksik oy: kendisi dışındaki rastgele katılımcıya gider", () => {
  it("oy vermeyen oyunun oyu kendisine gitmez ve her zaman bir oy sayılır", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const players = ["a", "b", "c", "d"];
      const s = start(players, seed);
      const filled = ittifakFillVotes(s.players, s.seed, {});
      for (const id of players) {
        expect(filled[id]).toBeDefined();
        expect(filled[id]).not.toBe(id);
        expect(players).toContain(filled[id]);
      }
    }
  });

  it("rastgele dağılım: her aday bir miktar oy alır (sabit değil)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const s = start(["a", "b", "c", "d"], seed);
      seen.add(ittifakFillVotes(s.players, s.seed, {}).a as string);
    }
    expect([...seen].sort()).toEqual(["b", "c", "d"]);
  });

  it("doldurma tohumdan türer: aynı tohum aynı sonuç, ctx.rng akışının tüketimine bağlı değil", () => {
    const rng = createRng(7);
    const a = ittifak.setup(["a", "b", "c"], { now: T0, rng, connected: ["a", "b", "c"] });
    const rng2 = createRng(7);
    const b = ittifak.setup(["a", "b", "c"], { now: T0, rng: rng2, connected: ["a", "b", "c"] });
    expect(a).toEqual(b);
    expect(ittifak.result(a)).toEqual(ittifak.result(b));
    // Eylem/tick sırası sonucu değiştirmez.
    const t1 = advanceTo(a, VOTE_END + 10);
    expect(ittifak.result(t1)).toEqual(ittifak.result(a));
  });

  it("kimse oy vermezse tüm oylar rastgele atanır; toplam puan oyuncu sayısı kadar", () => {
    const s = start(["a", "b", "c"], 5);
    const r = ittifak.result(advanceTo(s, VOTE_END));
    expect(Object.values(r.awards).reduce((x, y) => x + y, 0)).toBe(3);
  });

  it("kısmi oy: verilen oy korunur, yalnız eksikler doldurulur", () => {
    const s = vote(start(["a", "b", "c"], 9), "a", "c");
    const filled = ittifakFillVotes(s.players, s.seed, s.votes);
    expect(filled.a).toBe("c");
    expect(filled.b).not.toBe("b");
    expect(filled.c).not.toBe("c");
  });
});

describe("ittifak eylem kuralları", () => {
  it("pazarlık sırasında oy reddedilir; oylama başlar başlamaz kabul edilir", () => {
    const s = start();
    const act = { kind: "vote", target: "b" } as const;
    expect(ittifak.reduce(s, "a", act, ctx(T0 + ITTIFAK_TALK_MS - 1, s.players))).toEqual({
      rejected: "not_voting_yet",
    });
    expect(isRejected(ittifak.reduce(s, "a", act, ctx(T0 + ITTIFAK_TALK_MS, s.players)))).toBe(false);
  });

  it("oylama süresi (15 sn) bitince ve sonrasında oy reddedilir; 1 ms önce kabul edilir", () => {
    const s = start();
    const act = { kind: "vote", target: "b" } as const;
    expect(isRejected(ittifak.reduce(s, "a", act, ctx(VOTE_END - 1, s.players)))).toBe(false);
    expect(ittifak.reduce(s, "a", act, ctx(VOTE_END, s.players))).toEqual({ rejected: "ended" });
    expect(isRejected(ittifak.reduce(s, "a", act, ctx(T0 + ITTIFAK_DURATION_MS + 5, s.players)))).toBe(true);
  });

  it("kendine oy reddedilir", () => {
    const s = start();
    expect(ittifak.reduce(s, "a", { kind: "vote", target: "a" }, ctx(VOTE_AT, s.players))).toEqual({
      rejected: "self_target",
    });
  });

  it("bilinmeyen hedef ve katılımcı olmayan oyuncu reddedilir", () => {
    const s = start();
    expect(ittifak.reduce(s, "a", { kind: "vote", target: "zzz" }, ctx(VOTE_AT, s.players))).toEqual({
      rejected: "unknown_target",
    });
    expect(ittifak.reduce(s, "ghost", { kind: "vote", target: "a" }, ctx(VOTE_AT, s.players))).toEqual({
      rejected: "not_participant",
    });
  });

  it("bağlı olmayan hedefe oy reddedilir; bağlanınca kabul edilir", () => {
    const s = start();
    const act = { kind: "vote", target: "b" } as const;
    expect(ittifak.reduce(s, "a", act, ctx(VOTE_AT, ["a", "c"]))).toEqual({ rejected: "target_offline" });
    expect(isRejected(ittifak.reduce(s, "a", act, ctx(VOTE_AT, ["a", "b", "c"])))).toBe(false);
  });

  it("verilen oy, hedef sonradan koptuysa da geçerli kalır; kopuk oyuncu da oy alır", () => {
    const s = vote(start(["a", "b", "c"]), "a", "b");
    const later = ittifak.tick(s, ctx(VOTE_END + 1, ["a", "c"]));
    expect(ittifak.result(later).miniScores.b).toBeGreaterThanOrEqual(1);
  });

  it("bağlantısı kopmuş oyuncunun oyu da sayılır (oy süre içinde verilmişse)", () => {
    let s = start(["a", "b", "c"]);
    s = vote(s, "a", "b", VOTE_AT, ["a", "b", "c"]);
    s = vote(s, "b", "c");
    s = vote(s, "c", "b");
    const done = ittifak.tick(s, ctx(VOTE_END + 1, ["b"]));
    expect(scores(done)).toEqual({ a: 0, b: 2, c: 1 });
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    expect(ittifak.parseAction({ kind: "vote", target: "b" })).toEqual({ kind: "vote", target: "b" });
    for (const bad of [
      { kind: "vote" },
      { kind: "vote", target: "" },
      { kind: "vote", target: 3 },
      { kind: "vote", target: "b", extra: 1 },
      { kind: "propose", target: "b" },
      { kind: "vote", target: "x".repeat(65) },
      ["vote", "b"],
      "b",
    ]) {
      expect(ittifak.parseAction(bad)).toBeNull();
    }
  });

  it("uygulamada teklif/söz/anlaşma eylemi yoktur", () => {
    for (const kind of ["offer", "promise", "deal", "ally", "propose"]) {
      expect(ittifak.parseAction({ kind, target: "b" })).toBeNull();
    }
  });
});

describe("ittifak zamanlama", () => {
  it("tick aşama sınırlarında durumu bir kez değiştirir (yayın tetiklemek için)", () => {
    const s = start();
    expect(ittifak.tick(s, ctx(T0 + ITTIFAK_TALK_MS - 1, []))).toBe(s);
    const voting = ittifak.tick(s, ctx(T0 + ITTIFAK_TALK_MS, []));
    expect(voting).not.toBe(s);
    expect(ittifak.tick(voting, ctx(VOTE_END - 1, []))).toBe(voting);
    const closed = ittifak.tick(voting, ctx(VOTE_END, []));
    expect(closed).not.toBe(voting);
    expect(closed.finalVotes).not.toBeNull();
    expect(ittifak.tick(closed, ctx(VOTE_END + 50_000, []))).toBe(closed);
  });

  it("açılış süresi dolana kadar bitmez", () => {
    const s = start();
    expect(ittifak.isFinished(s, ctx(VOTE_END))).toBe(false);
    expect(ittifak.isFinished(s, ctx(T0 + ITTIFAK_DURATION_MS - 1))).toBe(false);
    expect(ittifak.isFinished(s, ctx(T0 + ITTIFAK_DURATION_MS))).toBe(true);
  });

  it("publicView aşamayı zamandan verir", () => {
    const s = start();
    expect(pub(s, T0 + 1).phase).toBe("talk");
    expect(pub(s, T0 + ITTIFAK_TALK_MS).phase).toBe("vote");
    expect(pub(s, VOTE_END).phase).toBe("reveal");
  });
});

describe("ittifak gizlilik (oylar kısa kimliklerdir; yapısal kontrol)", () => {
  const players = ["pa1", "pb2", "pc3", "pd4"];
  const s = vote(vote(start(players, 3), "pa1", "pb2"), "pc3", "pb2");

  it("oylama bitene kadar publicView hiçbir oy, sayı ya da sonuç içermez", () => {
    for (const at of [T0 + 1, VOTE_AT, VOTE_END - 1]) {
      const p = pub(s, at);
      expect(p.reveal).toBeNull();
      expect(Object.keys(p).sort()).toEqual(
        ["finishAt", "phase", "players", "ready", "reveal", "startedAt", "talkEndsAt", "voteEndsAt"].sort(),
      );
    }
  });

  it("view yalnız kendi oyunu verir, başkasının oyunu ya da alınan oyu göstermez", () => {
    for (const who of players) {
      const v = priv(s, who, VOTE_AT);
      expect(Object.keys(v)).toEqual(["myVote", "myPromises", "locked"]);
    }
    expect(priv(s, "pa1", VOTE_AT).myVote).toBe("pb2");
    expect(priv(s, "pd4", VOTE_AT).myVote).toBeNull();
    expect(priv(s, "pb2", VOTE_AT).myVote).toBeNull();
    expect(priv(s, null, VOTE_AT).myVote).toBeNull();
    expect(priv(s, "ghost", VOTE_AT).myVote).toBeNull();
  });

  it("başkasının oyu hiçbir başka oyuncunun view/publicView çıktısında geçmez (JSON taraması)", () => {
    const only = vote(start(["x1y", "z2w", "q3r"], 4), "x1y", "q3r");
    for (const at of [T0 + 100, VOTE_AT, VOTE_END - 1]) {
      const publicJson = JSON.stringify(pub(only, at));
      expect(publicJson).not.toContain('"votes"');
      expect(publicJson).not.toContain('"scores"');
      for (const other of ["z2w", "q3r"]) {
        expect(JSON.stringify(priv(only, other, at))).toBe('{"myVote":null,"myPromises":[],"locked":false}');
      }
      expect(JSON.stringify(priv(only, null, at))).toBe('{"myVote":null,"myPromises":[],"locked":false}');
    }
  });

  it("oylama bitince oy akışı herkese açılır", () => {
    const p = pub(s, VOTE_END);
    expect(p.reveal?.votes.pa1).toBe("pb2");
    expect(p.reveal?.votes.pc3).toBe("pb2");
    expect(p.reveal?.scores.pb2).toBeGreaterThanOrEqual(2);
  });

  it("secrets() boştur (kimlikler kısa; gizlilik yapısal testlerle doğrulanır)", () => {
    expect(ittifak.secrets(s)).toEqual([]);
  });
});

describe("ittifak ittifakReveal", () => {
  it("oyları skorlara çevirir", () => {
    const r = ittifakReveal(["a", "b", "c"], { a: "b", b: "c", c: "b" });
    expect(r.scores).toEqual({ a: 0, b: 2, c: 1 });
  });
});

describe("ittifak erken bitiş", () => {
  const act = (
    s: ReturnType<typeof start>,
    id: string,
    kind: "skip" | "lock",
    at: number,
    connected: readonly string[] = s.players,
  ) => ittifak.reduce(s, id, { kind }, ctx(at, connected));
  const ok = (
    s: ReturnType<typeof start>,
    id: string,
    kind: "skip" | "lock",
    at: number,
    connected?: readonly string[],
  ) => {
    const r = act(s, id, kind, at, connected);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const P = ["a", "b", "c"];

  it("parseAction skip ve lock kabul eder, fazladan alanı reddeder", () => {
    expect(ittifak.parseAction({ kind: "skip" })).toEqual({ kind: "skip" });
    expect(ittifak.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    expect(ittifak.parseAction({ kind: "skip", target: "b" })).toBeNull();
    expect(ittifak.parseAction({ kind: "lock", extra: 1 })).toBeNull();
  });

  describe("konuşma: Oylamaya geçelim", () => {
    it("(a) bağlı herkes basınca konuşma 1 sn sonra biter; oylama süresi ve oy akışı kaymış olur", () => {
      let s = start(P);
      for (const id of P) s = ok(s, id, "skip", T0 + 10_000);
      expect(s.talkEndsAt).toBe(T0 + 11_000);
      expect(pub(s, T0 + 10_999).phase).toBe("talk");
      expect(pub(s, T0 + 11_000).phase).toBe("vote");
      expect(pub(s, T0 + 11_000).voteEndsAt).toBe(T0 + 11_000 + ITTIFAK_VOTE_MS);
      expect(pub(s, T0 + 11_000).finishAt).toBe(T0 + 11_000 + ITTIFAK_VOTE_MS + ITTIFAK_REVEAL_MS);
      // Oylama kayan zamanda açılır ve kabul eder.
      expect(ittifak.reduce(s, "a", { kind: "vote", target: "b" }, ctx(T0 + 11_000, P))).not.toHaveProperty(
        "rejected",
      );
    });

    it("(b) bir kişi eksikken bitmez", () => {
      let s = start(P);
      s = ok(s, "a", "skip", T0 + 10_000);
      s = ok(s, "b", "skip", T0 + 10_000);
      expect(s.talkEndsAt).toBe(T0 + ITTIFAK_TALK_MS);
      expect(pub(s, T0 + 30_000).phase).toBe("talk");
    });

    it("(c) bağlantısı kopan oyuncu beklenmez", () => {
      let s = start(P);
      const conn = ["a", "b"];
      s = ok(s, "a", "skip", T0 + 10_000, conn);
      s = ok(s, "b", "skip", T0 + 10_000, conn);
      expect(s.talkEndsAt).toBe(T0 + 11_000);
      expect(ok(start(P), "a", "skip", T0 + 10_000, []).talkEndsAt).toBe(T0 + ITTIFAK_TALK_MS);
    });

    it("(d) kapanış penceresinde yeni eylem reddedilir; oylama aşamasında skip reddedilir; tekrar basmak zararsız", () => {
      let s = start(P);
      const conn = ["a", "b"];
      s = ok(s, "a", "skip", T0 + 10_000, conn);
      expect(ok(s, "a", "skip", T0 + 10_100, conn)).toBe(s);
      s = ok(s, "b", "skip", T0 + 10_000, conn);
      expect(act(s, "c", "skip", T0 + 10_500)).toEqual({ rejected: "closed" });
      expect(act(s, "a", "skip", T0 + 11_500)).toEqual({ rejected: "not_talking" });
      expect(act(start(P), "a", "lock", T0 + 10_000)).toEqual({ rejected: "not_voting_yet" });
    });

    it("(e) basanlar herkese açık, başka bir şey sızmaz", () => {
      let s = start(P);
      s = ok(s, "b", "skip", T0 + 10_000);
      const p = pub(s, T0 + 10_100);
      expect(p.ready).toEqual(["b"]);
      expect(p.reveal).toBeNull();
      expect(priv(s, "b", T0 + 10_100)).toEqual({ myVote: null, myPromises: [], locked: true });
      expect(priv(s, "a", T0 + 10_100)).toEqual({ myVote: null, myPromises: [], locked: false });
    });

    it("(f) tick bağlantıya bakmaz", () => {
      let s = start(P);
      for (const id of P) s = ok(s, id, "skip", T0 + 10_000);
      expect(ittifak.tick(s, ctx(T0 + 12_000, []))).toEqual(ittifak.tick(s, ctx(T0 + 12_000, P)));
    });
  });

  describe("oylama: Tamam", () => {
    it("(a) herkes kilitleyince oylama 1 sn sonra biter, oylar açılır; puanlama aynı", () => {
      let s = play(P, [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ]);
      for (const id of P) s = ok(s, id, "lock", VOTE_AT + 2_000);
      expect(s.voteEndsAt).toBe(VOTE_AT + 3_000);
      expect(pub(s, VOTE_AT + 2_999).phase).toBe("vote");
      expect(pub(s, VOTE_AT + 3_000).phase).toBe("reveal");
      expect(pub(s, VOTE_AT + 3_000).reveal?.scores).toEqual({ a: 2, b: 1, c: 0 });
      expect(ittifak.isFinished(s, ctx(VOTE_AT + 3_000 + ITTIFAK_REVEAL_MS - 1, P))).toBe(false);
      expect(ittifak.isFinished(s, ctx(VOTE_AT + 3_000 + ITTIFAK_REVEAL_MS, P))).toBe(true);
      expect(scores(s)).toEqual({ a: 2, b: 1, c: 0 });
    });

    it("(b) bir kişi eksikken bitmez; oysuz kilitlenemez", () => {
      let s = play(P, [
        ["a", "b"],
        ["b", "a"],
        ["c", "a"],
      ]);
      s = ok(s, "a", "lock", VOTE_AT + 2_000);
      s = ok(s, "b", "lock", VOTE_AT + 2_000);
      expect(s.voteEndsAt).toBe(VOTE_END);
      expect(act(start(P), "a", "lock", VOTE_AT)).toEqual({ rejected: "nothing_to_lock" });
    });

    it("(c) bağlantısı kopan oyuncu beklenmez", () => {
      const conn = ["a", "b"];
      let s = start(P);
      s = vote(s, "a", "b", VOTE_AT, conn);
      s = vote(s, "b", "a", VOTE_AT, conn);
      s = ok(s, "a", "lock", VOTE_AT + 1_000, conn);
      s = ok(s, "b", "lock", VOTE_AT + 1_000, conn);
      expect(s.voteEndsAt).toBe(VOTE_AT + 2_000);
      // Kopuk c'nin eksik oyu yine rastgele tamamlanır (kural değişmedi).
      expect(Object.keys(ittifakFillVotes(P, s.seed, s.votes))).toEqual(P);
    });

    it("(d) kilitten sonra oy değiştirme ve ikinci kilit reddedilir; kapanış penceresinde oy kabul edilmez", () => {
      let s = play(P, [["a", "b"]]);
      s = ok(s, "a", "lock", VOTE_AT + 500);
      expect(act(s, "a", "lock", VOTE_AT + 600)).toEqual({ rejected: "locked" });
      expect(ittifak.reduce(s, "a", { kind: "vote", target: "c" }, ctx(VOTE_AT + 600, P))).toEqual({
        rejected: "locked",
      });
      const conn = ["a", "b"];
      let t = start(P);
      t = vote(t, "a", "b", VOTE_AT, conn);
      t = vote(t, "b", "a", VOTE_AT, conn);
      t = ok(t, "a", "lock", VOTE_AT + 500, conn);
      t = ok(t, "b", "lock", VOTE_AT + 500, conn);
      expect(ittifak.reduce(t, "c", { kind: "vote", target: "a" }, ctx(VOTE_AT + 800, P))).toEqual({
        rejected: "closed",
      });
      expect(ittifak.reduce(t, "c", { kind: "vote", target: "a" }, ctx(VOTE_AT + 1_500, P))).toEqual({
        rejected: "ended",
      });
    });

    it("(e) kilit listesi oyları sızdırmaz", () => {
      let s = play(P, [
        ["a", "b"],
        ["b", "c"],
      ]);
      s = ok(s, "a", "lock", VOTE_AT + 500);
      const p = pub(s, VOTE_AT + 600);
      expect(p.ready).toEqual(["a"]);
      expect(JSON.stringify(p)).not.toMatch(/votes|scores|myVote/);
      expect(priv(s, "a", VOTE_AT + 600)).toEqual({ myVote: "b", myPromises: [], locked: true });
      expect(priv(s, "b", VOTE_AT + 600)).toEqual({ myVote: "c", myPromises: [], locked: false });
    });
  });
});

describe("ittifak söz işaretleri (O4)", () => {
  const P = ["pa1", "pb2", "pc3", "pd4"];
  const promise = (s: IttifakState, from: string, target: string, on = true, at = T0 + 5_000) =>
    ittifak.reduce(s, from, { kind: "promise", target, on }, ctx(at, s.players));
  const ok = (s: IttifakState, from: string, target: string, on = true, at = T0 + 5_000): IttifakState => {
    const r = promise(s, from, target, on, at);
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };
  const rejected = (s: IttifakState, from: string, target: string, on = true, at = T0 + 5_000) => {
    const r = promise(s, from, target, on, at);
    return isRejected(r) ? r.rejected : "kabul";
  };

  it("en çok 2 kişiye söz işareti konur; kaldırınca yeniden yer açılır; aynı işareti tekrarlamak etkisizdir", () => {
    expect(ITTIFAK_MAX_PROMISES).toBe(2);
    let s = start(P);
    s = ok(s, "pa1", "pb2");
    s = ok(s, "pa1", "pc3");
    expect(rejected(s, "pa1", "pd4")).toBe("too_many_promises");
    expect(ok(s, "pa1", "pb2")).toBe(s); // zaten var
    expect(ok(s, "pa1", "pd4", false)).toBe(s); // zaten yok
    s = ok(s, "pa1", "pb2", false);
    s = ok(s, "pa1", "pd4");
    expect(priv(s, "pa1", T0 + 6_000).myPromises.sort()).toEqual(["pc3", "pd4"]);
  });

  it("kendine, bilinmeyene ve pazarlık dışında söz işareti konamaz", () => {
    const s = start(P);
    expect(rejected(s, "pa1", "pa1")).toBe("self_target");
    expect(rejected(s, "pa1", "ghost")).toBe("unknown_target");
    expect(rejected(s, "ghost", "pa1")).toBe("not_participant");
    expect(rejected(s, "pa1", "pb2", true, T0 + ITTIFAK_TALK_MS)).toBe("not_talking");
    expect(rejected(s, "pa1", "pb2", false, VOTE_AT)).toBe("not_talking");
  });

  it("herkes 'Oylamaya geçelim' dedikten sonra (konuşma kapanırken) işaret konamaz", () => {
    let s = start(["pa1", "pb2", "pc3"]);
    for (const id of s.players) {
      const r = ittifak.reduce(s, id, { kind: "skip" }, ctx(T0 + 10_000, s.players));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    }
    expect(rejected(s, "pa1", "pb2", true, T0 + 10_500)).toBe("closed");
  });

  it("parseAction: promise yalnız {kind, target, on: boolean}", () => {
    expect(ittifak.parseAction({ kind: "promise", target: "b", on: true })).toEqual({
      kind: "promise",
      target: "b",
      on: true,
    });
    for (const bad of [
      { kind: "promise", target: "b" },
      { kind: "promise", target: "b", on: 1 },
      { kind: "promise", target: "", on: true },
      { kind: "promise", on: true },
      { kind: "promise", target: "b", on: true, extra: 1 },
    ])
      expect(ittifak.parseAction(bad)).toBeNull();
  });

  it("sonuçta söz oyla karşılaştırılır: tutuldu ve bozuldu", () => {
    let s = start(P);
    s = ok(s, "pa1", "pb2");
    s = ok(s, "pa1", "pc3");
    s = ok(s, "pb2", "pa1");
    s = vote(s, "pa1", "pb2"); // pa1: pb2'ye tuttu, pc3'e bozdu
    s = vote(s, "pb2", "pc3"); // pb2: pa1'e bozdu
    s = vote(s, "pc3", "pa1");
    s = vote(s, "pd4", "pa1");
    const r = pub(s, VOTE_END).reveal;
    expect(r?.promises).toEqual({
      pa1: [
        { to: "pb2", kept: true },
        { to: "pc3", kept: false },
      ],
      pb2: [{ to: "pa1", kept: false }],
    });
    // puanlama değişmez
    expect(r?.scores).toEqual({ pa1: 2, pb2: 1, pc3: 1, pd4: 0 });
    expect(scores(s)).toEqual(r?.scores);
  });

  it("oy vermeyenin sunucuca atanan oyu da karşılaştırılır; söz veren yoksa promises boştur", () => {
    let s = start(P);
    s = ok(s, "pa1", "pb2");
    const r = pub(s, VOTE_END).reveal;
    const filled = ittifakFillVotes(P, s.seed, {});
    expect(r?.promises).toEqual({ pa1: [{ to: "pb2", kept: filled.pa1 === "pb2" }] });
    expect(pub(start(P), VOTE_END).reveal?.promises).toEqual({});
  });

  it("söz işaretleri puanı etkilemez: işaretli ve işaretsiz aynı oylarla aynı skor", () => {
    const edges: [string, string][] = [
      ["pa1", "pb2"],
      ["pb2", "pa1"],
      ["pc3", "pa1"],
      ["pd4", "pb2"],
    ];
    let plain = start(P);
    let marked = start(P);
    marked = ok(marked, "pa1", "pc3");
    marked = ok(marked, "pd4", "pa1");
    for (const [f, to] of edges) {
      plain = vote(plain, f, to);
      marked = vote(marked, f, to);
    }
    expect(scores(marked)).toEqual(scores(plain));
  });

  it("tekrar oynatma: aynı tohum ve eylemler aynı sonucu verir", () => {
    const run = () => {
      let s = start(P);
      s = ok(s, "pa1", "pb2");
      s = vote(s, "pa1", "pb2");
      return JSON.stringify([s, pub(s, VOTE_END), ittifak.result(s)]);
    };
    expect(run()).toBe(run());
  });

  describe("gizlilik", () => {
    let s = start(P, 5);
    s = ok(s, "pa1", "pb2");
    s = ok(s, "pa1", "pc3");
    s = ok(s, "pd4", "pb2");
    s = vote(s, "pa1", "pb2");

    it("oylama bitene kadar publicView hiçbir söz içermez", () => {
      for (const at of [T0 + 6_000, T0 + ITTIFAK_TALK_MS - 1, VOTE_AT, VOTE_END - 1]) {
        const p = pub(s, at);
        expect(p.reveal).toBeNull();
        expect(JSON.stringify(p)).not.toMatch(/promise|kept|söz/i);
        expect(Object.keys(p).sort()).toEqual(
          ["finishAt", "phase", "players", "ready", "reveal", "startedAt", "talkEndsAt", "voteEndsAt"].sort(),
        );
      }
    });

    it("söz işaretini yalnız sahibi görür; alıcı dahil kimse başkasının sözünü görmez", () => {
      for (const at of [T0 + 6_000, VOTE_AT, VOTE_END - 1]) {
        expect(priv(s, "pa1", at).myPromises.sort()).toEqual(["pb2", "pc3"]);
        expect(priv(s, "pd4", at).myPromises).toEqual(["pb2"]);
        // alıcılar: pb2 iki söz aldı, pc3 bir söz aldı; ikisi de bunu görmez
        for (const recv of ["pb2", "pc3", null, "ghost"]) {
          expect(priv(s, recv, at).myPromises).toEqual([]);
          expect(JSON.stringify(priv(s, recv, at))).not.toMatch(/pa1|pd4/);
        }
      }
    });

    it("oylama bitince sözler herkese açılır", () => {
      const r = pub(s, VOTE_END).reveal;
      expect(r?.promises.pa1?.map((x) => x.to).sort()).toEqual(["pb2", "pc3"]);
      expect(r?.promises.pd4?.map((x) => x.to)).toEqual(["pb2"]);
    });
  });
});
