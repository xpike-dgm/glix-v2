import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { checkGameInvariants, findLeaks } from "../../testing/invariants.js";
import { korBombaBot } from "./bots.js";
import { KOR_BOMBA_LOCK_MS, type KorBombaAction, type KorBombaState, korBomba } from "./index.js";

/** BM-M3 — Kör Bomba "tek kurşun": oyunda bir kez "PATLAR!" bahsi. */
const T0 = 1_700_000_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, seed = 5): GameContext => ({ now, rng: createRng(seed), connected: ALL });
const fixed = (over: Partial<KorBombaState> = {}): KorBombaState => ({
  ...korBomba.setup(ALL, ctx(T0)),
  holder: "a",
  explodeAt: T0 + 16_000,
  heldSince: T0 - KOR_BOMBA_LOCK_MS,
  ...over,
});
const act = (s: KorBombaState, who: string, action: KorBombaAction, at: number): KorBombaState | string => {
  const r = korBomba.reduce(s, who, action, ctx(at, 99));
  return isRejected(r) ? r.rejected : r;
};
const okState = (r: KorBombaState | string): KorBombaState => {
  if (typeof r === "string") throw new Error(`reddedildi: ${r}`);
  return r;
};
const bet = (turn: number): KorBombaAction => ({ kind: "bet", turn });
const pass = (to: string): KorBombaAction => ({ kind: "pass", to });
/** Kilidi bitmiş an. */
const open = (s: KorBombaState): number => s.heldSince + KOR_BOMBA_LOCK_MS;

describe("kor-bomba bahsi: uygunluk", () => {
  it("taşıyıcı olmayan her katılımcı bahis yapabilir; bahis o ele bağlanır", () => {
    for (const id of ["b", "c", "d"]) {
      const s = okState(act(fixed(), id, bet(0), T0 + 10));
      expect(s.bets).toEqual({ [id]: 0 });
      expect(s.betUsed).toEqual([id]);
    }
  });

  it("taşıyıcı bahis yapamaz", () => {
    expect(act(fixed(), "a", bet(0), T0 + 10)).toBe("holder_cannot_bet");
  });

  it("katılımcı olmayan bahis yapamaz", () => {
    expect(act(fixed(), "ghost", bet(0), T0 + 10)).toBe("not_participant");
  });

  it("oyun başına tek hak: pasla yanan bahsin hakkı geri gelmez", () => {
    let s = okState(act(fixed(), "b", bet(0), T0 + 10));
    expect(act(s, "b", bet(0), T0 + 20)).toBe("already_bet");
    s = okState(act(s, "a", pass("c"), T0 + 30));
    expect(act(s, "b", bet(1), T0 + 40)).toBe("already_bet");
  });

  it("eski elin bahsi reddedilir, hak yanmaz", () => {
    const s = okState(act(fixed(), "a", pass("c"), T0 + 10));
    expect(act(s, "b", bet(0), T0 + 20)).toBe("stale_turn");
    expect(okState(act(s, "b", bet(1), T0 + 30)).bets).toEqual({ b: 1 });
  });

  it("fitilde 3 sn'den az kaldıysa kabul edilmez ve hak yanmaz; 3 sn tam sınırda kabul", () => {
    const s = fixed();
    expect(act(s, "b", bet(0), s.explodeAt - 2_999)).toBe("too_late");
    expect(act(s, "b", bet(0), s.explodeAt - 1)).toBe("too_late");
    const ok = okState(act(s, "b", bet(0), s.explodeAt - 3_000));
    expect(ok.bets).toEqual({ b: 0 });
    // Reddedilen bahis durumu değiştirmez: hak duruyor.
    expect(s.betUsed).toEqual([]);
  });

  it("patlama anından sonra bahis kabul edilmez", () => {
    const s = fixed();
    expect(act(s, "b", bet(0), s.explodeAt)).toBe("ended");
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(act(boom, "b", bet(0), s.explodeAt + 5)).toBe("ended");
  });

  it("bombayı taşırken bahis yok; pas verdikten sonra kullanılabilir", () => {
    let s = fixed();
    expect(act(s, "a", bet(0), T0 + 10)).toBe("holder_cannot_bet");
    s = okState(act(s, "a", pass("b"), T0 + 20));
    expect(okState(act(s, "a", bet(1), T0 + 30)).bets).toEqual({ a: 1 });
  });

  it("parseAction: yalnız tam biçim; eski 'predict' kabul edilmez", () => {
    expect(korBomba.parseAction({ kind: "bet", turn: 2 })).toEqual(bet(2));
    for (const raw of [
      { kind: "bet" },
      { kind: "bet", turn: -1 },
      { kind: "bet", turn: 1.5 },
      { kind: "bet", turn: "1" },
      { kind: "bet", turn: 1, to: "b" },
      { kind: "bet", turn: 1e9 },
      { kind: "predict", turn: 1, explodes: true },
    ]) {
      expect(korBomba.parseAction(raw)).toBeNull();
    }
  });
});

describe("kor-bomba bahsi: puan", () => {
  it("bahsi tutan +1; taşıyıcı -1; bahis yapmayan 0", () => {
    const s = okState(act(fixed(), "b", bet(0), T0 + 10));
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    const r = korBomba.result(boom);
    expect(r.awards).toEqual({ a: -1, b: 1, c: 0, d: 0 });
    expect(r.miniScores).toEqual(r.awards);
    expect(boom.correctPredictors).toEqual(["b"]);
  });

  it("pas olursa bahis yanar: 0 (eksi yok)", () => {
    let s = okState(act(fixed(), "b", bet(0), T0 + 10));
    s = okState(act(s, "a", pass("c"), T0 + 20));
    expect(s.bets).toEqual({});
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.result(boom).awards).toEqual({ a: 0, b: 0, c: -1, d: 0 });
  });

  it("farklı ellere bahis: yalnız patlayan ele bağlı olanlar tutar", () => {
    let s = okState(act(fixed(), "b", bet(0), T0 + 10));
    s = okState(act(s, "a", pass("c"), T0 + 20));
    s = okState(act(s, "d", bet(1), T0 + 30));
    s = okState(act(s, "a", bet(1), T0 + 40));
    const r = korBomba.result(korBomba.tick(s, ctx(s.explodeAt)));
    expect(r.awards).toEqual({ a: 1, b: 0, c: -1, d: 1 });
    expect(Object.values(r.awards).every((v) => v <= 1)).toBe(true);
  });

  it("tick gecikse de sonuç aynı (result bayrağa bağlı değil)", () => {
    const s = okState(act(fixed(), "b", bet(0), T0 + 10));
    expect(korBomba.result(s).awards).toEqual(korBomba.result(korBomba.tick(s, ctx(s.explodeAt))).awards);
  });
});

describe("kor-bomba bahsi: gizlilik", () => {
  const withBets = (): KorBombaState => {
    let s = okState(act(fixed({ explodeAt: T0 + 17_345 }), "b", bet(0), T0 + 10));
    s = okState(act(s, "c", bet(0), T0 + 11));
    return s;
  };

  it("taşıyıcı hiçbir bahsi görmez: görünümü bahisli de bahissiz de aynıdır", () => {
    const quiet = korBomba.view(fixed({ explodeAt: T0 + 17_345 }), "a", ctx(T0 + 20));
    const loud = korBomba.view(withBets(), "a", ctx(T0 + 20));
    expect(loud).toEqual(quiet);
    expect(loud).toEqual({ role: "holder", betUsed: false, lastResult: null });
  });

  it("herkes yalnız kendi bahsini görür", () => {
    const s = withBets();
    expect(korBomba.view(s, "b", ctx(T0 + 20))).toMatchObject({
      bet: { turn: 0, holder: "a" },
      betUsed: true,
    });
    expect(korBomba.view(s, "d", ctx(T0 + 20))).toMatchObject({ bet: null, betUsed: false });
  });

  it("izleyici görünümünde bahis yok", () => {
    expect(korBomba.view(withBets(), null, ctx(T0 + 20))).toEqual({ role: "spectator" });
  });

  it("publicView bahis içermez; kimin bahis yaptığı sızmaz", () => {
    const quiet = korBomba.publicView(fixed({ explodeAt: T0 + 17_345 }), ctx(T0 + 20));
    const loud = korBomba.publicView(withBets(), ctx(T0 + 20));
    expect(loud).toEqual(quiet);
  });

  it("pasta bahis yanar; herkese açılmaz, sahibi yalnız kendi sonucunu görür", () => {
    const s = okState(act(withBets(), "a", pass("d"), T0 + 30));
    const clean = okState(act(fixed({ explodeAt: T0 + 17_345 }), "a", pass("d"), T0 + 30));
    expect(korBomba.publicView(s, ctx(T0 + 40))).toEqual(korBomba.publicView(clean, ctx(T0 + 40)));
    expect(korBomba.view(s, "b", ctx(T0 + 40))).toMatchObject({
      bet: null,
      betUsed: true,
      lastResult: { turn: 0, correct: false },
    });
    expect(korBomba.view(s, "a", ctx(T0 + 40))).toMatchObject({ lastResult: null, betUsed: false });
  });

  it("patlamada kazananların adı açılır, yananlarınki açılmaz", () => {
    let s = okState(act(withBets(), "a", pass("d"), T0 + 30));
    s = okState(act(s, "a", bet(1), T0 + 40));
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.publicView(boom, ctx(s.explodeAt)).correctPredictors).toEqual(["a"]);
    expect(korBomba.view(boom, "a", ctx(s.explodeAt))).toMatchObject({ lastResult: { correct: true } });
    expect(korBomba.view(boom, "b", ctx(s.explodeAt))).toMatchObject({ lastResult: { correct: false } });
  });

  it("taşıyıcının görünümü bahis anlarında değişmez (zamanlama yok)", () => {
    const s0 = fixed();
    const before = JSON.stringify(korBomba.view(s0, "a", ctx(T0 + 5)));
    const s1 = okState(act(s0, "b", bet(0), T0 + 6));
    const s2 = okState(act(s1, "c", bet(0), T0 + 7));
    expect(JSON.stringify(korBomba.view(s2, "a", ctx(T0 + 8)))).toBe(before);
  });

  it("sızıntı denetimi bahisli durumda temiz", () => {
    expect(findLeaks(korBomba, withBets(), ALL, T0 + 100)).toEqual([]);
  });

  it("bahis süreyi etkilemez", () => {
    const s = fixed();
    const after = okState(act(s, "b", bet(0), T0 + 5_000));
    expect(after.explodeAt).toBe(s.explodeAt);
    expect(after.lastBonusMs).toBe(s.lastBonusMs);
  });

  it("geri dönen taşıyıcıda kilit yeniden başlamaz (kilit alış anına bağlı)", () => {
    const s = okState(act(fixed(), "a", pass("b"), T0 + 100));
    // b koptu ve döndü: bağlantı durumu kilidi değiştirmez.
    expect(open(s)).toBe(T0 + 100 + KOR_BOMBA_LOCK_MS);
    expect(typeof act(s, "b", pass("c"), open(s))).toBe("object");
  });
});

describe("kor-bomba bahsi: belirlilik", () => {
  it("botlar bahisle oynar: belirlilik, tick bağımsızlığı ve kayıttan tekrar oynatma tutar", () => {
    let bets = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { primary } = checkGameInvariants(korBomba, korBombaBot, { seed, playerCount: 2 + (seed % 7) });
      const st = primary.state as KorBombaState;
      bets += st.betUsed.length;
      for (const v of Object.values(primary.result.awards)) expect(v).toBeLessThanOrEqual(1);
      expect(st.explodeAt - st.startedAt).toBeLessThanOrEqual(45_000);
    }
    expect(bets).toBeGreaterThan(0);
  });
});
