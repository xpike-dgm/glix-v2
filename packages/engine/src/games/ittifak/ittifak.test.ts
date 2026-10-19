import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { ittifak, ittifakFillVotes, ittifakReveal } from "./index.js";
import {
  ITTIFAK_DURATION_MS,
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
        ["finishAt", "phase", "players", "reveal", "startedAt", "talkEndsAt", "voteEndsAt"].sort(),
      );
    }
  });

  it("view yalnız kendi oyunu verir, başkasının oyunu ya da alınan oyu göstermez", () => {
    for (const who of players) {
      const v = priv(s, who, VOTE_AT);
      expect(Object.keys(v)).toEqual(["myVote"]);
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
        expect(JSON.stringify(priv(only, other, at))).toBe('{"myVote":null}');
      }
      expect(JSON.stringify(priv(only, null, at))).toBe('{"myVote":null}');
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
