import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { checkGameInvariants, findLeaks } from "../../testing/invariants.js";
import { rusRuletiBot } from "./bots.js";
import { type RusRuletiAction, type RusRuletiState, rusRuleti } from "./index.js";

/** O9 — Rus Ruleti elenen izleyici tahmini ve "Kâhin" rozeti. */
const T0 = 1_000_000;
const IDS = ["a", "b", "c", "d", "e", "f"];
const BOOM = 100;
const SAFE = 0;
const ctx = (now: number): GameContext => ({ now, rng: createRng(3), connected: IDS });
/** 6 oyuncu; a,b elenmiş (izleyici); silah c'de. */
const base = (over: Partial<RusRuletiState> = {}): RusRuletiState => ({
  ...rusRuleti.setup(IDS, ctx(T0)),
  alive: ["c", "d", "e", "f"],
  eliminated: ["a", "b"],
  holder: "c",
  openAt: T0,
  deadline: T0 + 18_000,
  ...over,
});
const act = (s: RusRuletiState, who: string, action: RusRuletiAction, now: number) => {
  const r = rusRuleti.reduce(s, who, action, ctx(now));
  return isRejected(r) ? r.rejected : r;
};
const okState = (r: RusRuletiState | string): RusRuletiState => {
  if (typeof r === "string") throw new Error(`reddedildi: ${r}`);
  return r;
};
const predict = (turn: number, explodes: boolean): RusRuletiAction => ({ kind: "predict", turn, explodes });
const shoot = (s: RusRuletiState, target: string, now: number) =>
  okState(act(s, s.holder, { kind: "shoot", target }, now));

/** `rounds` atış: her atışta a ve b verilen tahmini yapar, atış `boom` ise patlar. Elenen yoksa SAFE kalır. */
function playShots(s0: RusRuletiState, plan: { guessA?: boolean; guessB?: boolean; boom: boolean }[]) {
  let s = s0;
  let t = T0 + 100;
  for (const step of plan) {
    s = { ...s, risk: step.boom ? BOOM : SAFE };
    if (step.guessA !== undefined) s = okState(act(s, "a", predict(s.shots, step.guessA), t));
    if (step.guessB !== undefined) s = okState(act(s, "b", predict(s.shots, step.guessB), t));
    const target = s.alive.find((id) => id !== s.holder) ?? s.holder;
    t += 100;
    s = shoot(s, target, t);
    t = s.openAt + 10;
    s = { ...s, openAt: t - 5 };
    if (s.over) break;
  }
  return s;
}

describe("rus-ruleti tahmini: uygunluk", () => {
  it("yalnız elenenler tahmin verir; hayatta olanlar ve katılımcı olmayanlar veremez", () => {
    expect(typeof act(base(), "a", predict(0, true), T0 + 10)).toBe("object");
    expect(typeof act(base(), "b", predict(0, false), T0 + 10)).toBe("object");
    for (const id of ["c", "d", "f"])
      expect(act(base(), id, predict(0, true), T0 + 10)).toBe("alive_cannot_predict");
    expect(act(base(), "ghost", predict(0, true), T0 + 10)).toBe("not_participant");
  });

  it("silah sahibi olsa bile hayattaki tahmin veremez ve atış hakkı etkilenmez", () => {
    expect(act(base(), "c", predict(0, true), T0 + 10)).toBe("alive_cannot_predict");
    expect(typeof act(base(), "c", { kind: "shoot", target: "d" }, T0 + 10)).toBe("object");
  });

  it("atış başına tek tahmin; değiştirilemez", () => {
    const s = okState(act(base(), "a", predict(0, true), T0 + 10));
    expect(act(s, "a", predict(0, true), T0 + 20)).toBe("already_predicted");
    expect(act(s, "a", predict(0, false), T0 + 20)).toBe("already_predicted");
    expect(s.predictions).toEqual({ a: true });
  });

  it("yanlış atış sırası reddedilir (stale_turn)", () => {
    expect(act(base(), "a", predict(1, true), T0 + 10)).toBe("stale_turn");
    const after = shoot(base({ risk: SAFE }), "d", T0 + 10);
    expect(act(after, "a", predict(0, true), after.openAt + 1)).toBe("stale_turn");
  });

  it("her atıştan sonra yeniden tahmin hakkı doğar, sonuç animasyonu sırasında da", () => {
    const s = shoot(base({ risk: SAFE }), "d", T0 + 10);
    expect(s.predictions).toEqual({});
    expect(typeof act(s, "a", predict(1, true), T0 + 20)).toBe("object");
  });

  it("oyun bitince tahmin kabul edilmez; yeni elenen sonraki atıştan tahmin verebilir", () => {
    const s = shoot(
      base({ risk: BOOM, players: [...IDS, "g", "h"], alive: ["c", "d", "e", "f", "g", "h"] }),
      "d",
      T0 + 10,
    );
    expect(s.eliminated).toContain("d");
    expect(s.over).toBe(false);
    expect(typeof act(s, "d", predict(1, true), T0 + 20)).toBe("object");
    const over = { ...s, over: true };
    expect(act(over, "a", predict(1, true), T0 + 30)).toBe("ended");
  });

  it("süre dolup sunucu ateş ettiyse tahmin yeni atışa sayılmaz (stale_turn)", () => {
    const s = base({ risk: SAFE });
    const late = s.deadline + 1;
    expect(act(s, "a", predict(0, true), late)).toBe("stale_turn");
  });

  it("parseAction: yalnız tam biçim", () => {
    expect(rusRuleti.parseAction({ kind: "predict", turn: 3, explodes: false })).toEqual(predict(3, false));
    expect(rusRuleti.parseAction({ kind: "shoot", target: "a" })).toEqual({ kind: "shoot", target: "a" });
    for (const raw of [
      { kind: "predict", turn: 3 },
      { kind: "predict", explodes: true },
      { kind: "predict", turn: -1, explodes: true },
      { kind: "predict", turn: 0.5, explodes: true },
      { kind: "predict", turn: "0", explodes: true },
      { kind: "predict", turn: 0, explodes: 1 },
      { kind: "predict", turn: 0, explodes: true, target: "a" },
    ]) {
      expect(rusRuleti.parseAction(raw)).toBeNull();
    }
  });
});

describe("rus-ruleti tahmini: rozet eşiği", () => {
  /** Hiç elenme istemeyen 8 kişilik oyun için gerekli: a,b elenmiş, risk SAFE; atışlar güvenli geçer. */
  const eight = (): RusRuletiState => {
    const ids8 = [...IDS, "g", "h"];
    return {
      ...rusRuleti.setup(ids8, ctx(T0)),
      alive: ["c", "d", "e", "f", "g", "h"],
      eliminated: ["a", "b"],
      holder: "c",
      openAt: T0,
      deadline: T0 + 18_000,
    };
  };
  const kahin = (s: RusRuletiState) => s.eliminated.filter((id) => (s.correct[id] ?? 0) >= 2);

  it("tek doğru tahmin rozet vermez, iki doğru verir; yanlışlar sayılmaz", () => {
    // a: güvenli (Hayır) doğru, güvenli (Evet) yanlış, güvenli (Hayır) doğru -> 2 doğru. b: 1 doğru.
    let s = playShots(eight(), [
      { guessA: false, guessB: false, boom: false },
      { guessA: true, guessB: true, boom: false },
      { guessA: false, guessB: true, boom: false },
    ]);
    expect(s.correct).toEqual({ a: 2, b: 1 });
    expect(kahin(s)).toEqual(["a"]);
    s = { ...s, over: true };
    expect(rusRuleti.publicView(s, ctx(T0)).result?.kahinler).toEqual(["a"]);
  });

  it("tam 1 doğru: rozet yok", () => {
    const s = { ...playShots(eight(), [{ guessA: false, boom: false }]), over: true };
    expect(rusRuleti.publicView(s, ctx(T0)).result?.kahinler).toEqual([]);
  });

  it("patlayan atışı bilen de sayılır", () => {
    const s0 = eight();
    let s = playShots(s0, [{ guessA: true, boom: true }]);
    s = { ...s, over: false };
    expect(s.correct.a).toBe(1);
    s = playShots({ ...s, openAt: T0 }, [{ guessA: true, boom: true }]);
    expect(s.correct.a).toBe(2);
  });

  it("rozet yalnız elenenlere: hayatta kalan tahmin veremediği için kâhin olamaz", () => {
    const s = {
      ...playShots(eight(), [
        { guessA: false, boom: false },
        { guessA: false, boom: false },
      ]),
      over: true,
    };
    expect(rusRuleti.publicView(s, ctx(T0)).result?.kahinler).toEqual(["a"]);
    for (const id of s.alive) expect(s.correct[id]).toBeUndefined();
  });

  it("tahmin puan vermez: ödüller yalnız hayatta kalma", () => {
    const s = {
      ...playShots(eight(), [
        { guessA: false, boom: false },
        { guessA: false, boom: false },
      ]),
      over: true,
    };
    const r = rusRuleti.result(s);
    expect(r.awards.a).toBe(0);
    expect(r.awards.b).toBe(0);
    expect(Object.values(r.awards).every((v) => v === 0 || v === 1)).toBe(true);
    for (const id of s.alive) expect(r.awards[id]).toBe(1);
  });

  it("tahmin atışın sonucunu etkilemez", () => {
    const withGuess = shoot(okState(act(base({ risk: 40 }), "a", predict(0, true), T0 + 5)), "d", T0 + 10);
    const without = shoot(base({ risk: 40 }), "d", T0 + 10);
    expect(withGuess.last).toEqual(without.last);
    expect(withGuess.alive).toEqual(without.alive);
    expect(withGuess.holder).toBe(without.holder);
  });
});

describe("rus-ruleti tahmini: gizlilik", () => {
  const withGuess = (): RusRuletiState => {
    let s = okState(act(base(), "a", predict(0, true), T0 + 10));
    s = okState(act(s, "b", predict(0, false), T0 + 11));
    return s;
  };

  it("her elenen yalnız kendi tahminini görür", () => {
    const s = withGuess();
    expect(rusRuleti.view(s, "a", ctx(T0 + 20))).toEqual({
      role: "out",
      turn: 0,
      prediction: true,
      lastResult: null,
    });
    expect(rusRuleti.view(s, "b", ctx(T0 + 20))).toEqual({
      role: "out",
      turn: 0,
      prediction: false,
      lastResult: null,
    });
  });

  it("hayatta olanların ve izleyicilerin görünümü tahminlerden etkilenmez", () => {
    const quiet = base();
    const loud = withGuess();
    for (const id of ["c", "d", "e", "f", null, "ghost"]) {
      expect(rusRuleti.view(loud, id, ctx(T0 + 20))).toEqual(rusRuleti.view(quiet, id, ctx(T0 + 20)));
    }
  });

  it("publicView tahminleri, doğru sayılarını ve kimin tahmin ettiğini içermez (oyun sürerken)", () => {
    const quiet = rusRuleti.publicView(base(), ctx(T0 + 20));
    expect(rusRuleti.publicView(withGuess(), ctx(T0 + 20))).toEqual(quiet);
    let s = shoot(withGuess(), "d", T0 + 30);
    s = { ...s, risk: SAFE };
    const pv = JSON.stringify(rusRuleti.publicView(s, ctx(s.openAt)));
    expect(pv).not.toMatch(/correct|prediction|kahin|predict/i);
    expect(rusRuleti.publicView(s, ctx(s.openAt)).result).toBeNull();
  });

  it("çözülünce yalnız sahibi sonucunu görür", () => {
    const s = shoot(withGuess(), "d", T0 + 30);
    const boom = s.last?.exploded ?? false;
    expect(rusRuleti.view(s, "a", ctx(s.openAt))).toMatchObject({ lastResult: { turn: 0, correct: boom } });
    expect(rusRuleti.view(s, "b", ctx(s.openAt))).toMatchObject({ lastResult: { turn: 0, correct: !boom } });
    expect(rusRuleti.view(s, "c", ctx(s.openAt))).toEqual(rusRuleti.view(base(), "c", ctx(s.openAt)));
  });

  it("rozet bitişte herkese açık, öncesinde asla", () => {
    const s = playShots(base(), [
      { guessA: false, boom: false },
      { guessA: false, boom: false },
    ]);
    expect(s.over).toBe(false);
    expect(rusRuleti.publicView(s, ctx(T0)).result).toBeNull();
    expect(rusRuleti.publicView({ ...s, over: true }, ctx(T0)).result?.kahinler).toEqual(["a"]);
  });

  it("sızıntı denetimi tahminli durumda temiz", () => {
    expect(findLeaks(rusRuleti, withGuess(), IDS, T0 + 100)).toEqual([]);
  });

  it("tick connected okumaz ve tahminleri korur", () => {
    const s = withGuess();
    const noConn: GameContext = {
      now: T0 + 50,
      rng: createRng(1),
      get connected(): readonly string[] {
        throw new Error("tick connected okumamalı");
      },
    };
    expect(rusRuleti.tick(s, noConn).predictions).toEqual({ a: true, b: false });
  });
});

describe("rus-ruleti tahmini: belirlilik", () => {
  it("botlar tahminle oynar: belirlilik, tick bağımsızlığı ve kayıttan tekrar oynatma tutar", () => {
    let predicted = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { primary } = checkGameInvariants(rusRuleti, rusRuletiBot, { seed, playerCount: 3 + (seed % 6) });
      const st = primary.state as RusRuletiState;
      predicted += Object.keys(st.correct).length + Object.keys(st.results).length;
      predicted += primary.log.actions.filter((x) => (x.action as RusRuletiAction).kind === "predict").length;
    }
    expect(predicted).toBeGreaterThan(0);
  });
});
