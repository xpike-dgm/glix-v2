import { describe, expect, it } from "vitest";
import { type GameContext, isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { checkGameInvariants, findLeaks } from "../../testing/invariants.js";
import { korBombaBot } from "./bots.js";
import { type KorBombaAction, type KorBombaState, korBomba } from "./index.js";

/** O9 — Kör Bomba izleyici tahmini. */
const T0 = 1_700_000_000_000;
const ALL = ["a", "b", "c", "d"];
const ctx = (now: number, seed = 5): GameContext => ({ now, rng: createRng(seed), connected: ALL });
const fixed = (over: Partial<KorBombaState> = {}): KorBombaState => ({
  ...korBomba.setup(ALL, ctx(T0)),
  holder: "a",
  explodeAt: T0 + 16_000,
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
const predict = (turn: number, explodes: boolean): KorBombaAction => ({ kind: "predict", turn, explodes });
const pass = (to: string): KorBombaAction => ({ kind: "pass", to });

describe("kor-bomba tahmini: uygunluk", () => {
  it("taşıyıcı olmayan her katılımcı tahmin verebilir", () => {
    for (const id of ["b", "c", "d"])
      expect(typeof act(fixed(), id, predict(0, true), T0 + 10)).toBe("object");
  });

  it("taşıyıcı tahmin veremez", () => {
    expect(act(fixed(), "a", predict(0, true), T0 + 10)).toBe("holder_cannot_predict");
  });

  it("katılımcı olmayan tahmin veremez", () => {
    expect(act(fixed(), "ghost", predict(0, true), T0 + 10)).toBe("not_participant");
  });

  it("el başına tek tahmin: ikinci tahmin (aynı ya da zıt) reddedilir, ilki değişmez", () => {
    const s = okState(act(fixed(), "b", predict(0, true), T0 + 10));
    expect(act(s, "b", predict(0, true), T0 + 20)).toBe("already_predicted");
    expect(act(s, "b", predict(0, false), T0 + 20)).toBe("already_predicted");
    expect(s.predictions).toEqual({ b: true });
  });

  it("eski elin tahmini reddedilir (stale_turn)", () => {
    const s = okState(act(fixed(), "a", pass("c"), T0 + 10));
    expect(act(s, "b", predict(0, true), T0 + 20)).toBe("stale_turn");
    expect(act(s, "b", predict(5, true), T0 + 20)).toBe("stale_turn");
  });

  it("her yeni elde yeniden tahmin hakkı doğar; yeni taşıyıcı veremez, eski taşıyıcı verebilir", () => {
    let s = okState(act(fixed(), "b", predict(0, false), T0 + 10));
    s = okState(act(s, "a", pass("c"), T0 + 20));
    expect(s.predictions).toEqual({});
    expect(act(s, "c", predict(1, true), T0 + 30)).toBe("holder_cannot_predict");
    s = okState(act(s, "b", predict(1, true), T0 + 30));
    s = okState(act(s, "a", predict(1, true), T0 + 40));
    expect(s.predictions).toEqual({ b: true, a: true });
  });

  it("patlama anından sonra tahmin kabul edilmez; süreden önce her an kabul", () => {
    const s = fixed();
    expect(typeof act(s, "b", predict(0, true), s.explodeAt - 1)).toBe("object");
    expect(act(s, "b", predict(0, true), s.explodeAt)).toBe("ended");
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(act(boom, "b", predict(0, true), s.explodeAt + 5)).toBe("ended");
  });

  it("parseAction: yalnız tam biçim", () => {
    expect(korBomba.parseAction({ kind: "predict", turn: 2, explodes: true })).toEqual(predict(2, true));
    for (const raw of [
      { kind: "predict", turn: 2 },
      { kind: "predict", explodes: true },
      { kind: "predict", turn: -1, explodes: true },
      { kind: "predict", turn: 1.5, explodes: true },
      { kind: "predict", turn: "1", explodes: true },
      { kind: "predict", turn: 1, explodes: "evet" },
      { kind: "predict", turn: 1, explodes: true, to: "b" },
      { kind: "predict", turn: 1e9, explodes: true },
    ]) {
      expect(korBomba.parseAction(raw)).toBeNull();
    }
  });
});

describe("kor-bomba tahmini: puan", () => {
  it("patlar diyen ve bilen +1 alır; taşıyıcı -1; patlamaz diyen 0", () => {
    let s = okState(act(fixed(), "b", predict(0, true), T0 + 10));
    s = okState(act(s, "c", predict(0, false), T0 + 11));
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    const r = korBomba.result(boom);
    expect(r.awards).toEqual({ a: -1, b: 1, c: 0, d: 0 });
    expect(r.miniScores).toEqual(r.awards);
    expect(boom.correctPredictors).toEqual(["b"]);
  });

  it("pasla biten elde 'patlar' diyen puan alamaz; patlamayan eldeki tahminler sonraki ödülü etkilemez", () => {
    let s = okState(act(fixed(), "b", predict(0, true), T0 + 10));
    s = okState(act(s, "a", pass("c"), T0 + 20));
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.result(boom).awards).toEqual({ a: 0, b: 0, c: -1, d: 0 });
  });

  it("üst sınır +1: birçok elde 'patlar' diyen en çok bir kez, toplam +1 alır", () => {
    let s = fixed();
    let t = T0;
    const order = ["a", "c", "d", "c", "d"];
    for (let i = 0; i < order.length; i++) {
      t += 10;
      s = okState(act(s, "b", predict(i, true), t));
      t += 10;
      s = okState(act(s, order[i] as string, pass(order[i + 1] ?? "a"), t));
    }
    t += 10;
    s = okState(act(s, "b", predict(s.passes, true), t));
    const r = korBomba.result(korBomba.tick(s, ctx(s.explodeAt)));
    expect(r.awards.b).toBe(1);
    expect(Object.values(r.awards).filter((v) => v > 1)).toEqual([]);
  });

  it("birden çok doğru tahminci hepsi +1 alır; kimse bilmezse yalnız taşıyıcı -1", () => {
    let s = fixed();
    for (const id of ["b", "c", "d"]) s = okState(act(s, id, predict(0, true), T0 + 10));
    expect(korBomba.result(korBomba.tick(s, ctx(s.explodeAt))).awards).toEqual({ a: -1, b: 1, c: 1, d: 1 });
    expect(korBomba.result(korBomba.tick(fixed(), ctx(T0 + 16_000))).awards).toEqual({
      a: -1,
      b: 0,
      c: 0,
      d: 0,
    });
  });

  it("tick gecikse de sonuç aynı (result bayrağa bağlı değil)", () => {
    const s = okState(act(fixed(), "b", predict(0, true), T0 + 10));
    expect(korBomba.result(s).awards).toEqual(korBomba.result(korBomba.tick(s, ctx(s.explodeAt))).awards);
  });
});

describe("kor-bomba tahmini: gizlilik", () => {
  const withPreds = (): KorBombaState => {
    let s = okState(act(fixed({ explodeAt: T0 + 17_345 }), "b", predict(0, true), T0 + 10));
    s = okState(act(s, "c", predict(0, false), T0 + 11));
    return s;
  };

  it("taşıyıcı hiçbir tahmini görmez: görünümü tahminsiz de tahminli de aynıdır", () => {
    const quiet = korBomba.view(fixed({ explodeAt: T0 + 17_345 }), "a", ctx(T0 + 20));
    const loud = korBomba.view(withPreds(), "a", ctx(T0 + 20));
    expect(loud).toEqual(quiet);
    expect(loud).toEqual({ role: "holder", lastResult: null });
  });

  it("herkes yalnız kendi tahminini görür", () => {
    const s = withPreds();
    const b = korBomba.view(s, "b", ctx(T0 + 20));
    const c = korBomba.view(s, "c", ctx(T0 + 20));
    const d = korBomba.view(s, "d", ctx(T0 + 20));
    expect(b).toMatchObject({ prediction: { turn: 0, explodes: true } });
    expect(c).toMatchObject({ prediction: { turn: 0, explodes: false } });
    expect(d).toMatchObject({ prediction: null });
    // b'nin görünümünde c'nin tahmini, c'ninkinde b'nin tahmini yok (alan yalnız kendi tahmini)
    expect(JSON.stringify(b)).not.toContain('"explodes":false');
    expect(JSON.stringify(c)).not.toContain('"explodes":true');
  });

  it("izleyici (katılımcı olmayan) görünümünde tahmin yok", () => {
    expect(korBomba.view(withPreds(), null, ctx(T0 + 20))).toEqual({ role: "spectator" });
  });

  it("publicView çözülmeden tahmin içermez; kimin tahmin verdiği de sızmaz", () => {
    const quiet = korBomba.publicView(fixed({ explodeAt: T0 + 17_345 }), ctx(T0 + 20));
    const loud = korBomba.publicView(withPreds(), ctx(T0 + 20));
    expect(loud).toEqual(quiet);
    expect(loud.correctPredictors).toEqual([]);
  });

  it("pasta tahminler herkese açılmaz; sahibi yalnız kendi sonucunu görür", () => {
    const s = okState(act(withPreds(), "a", pass("d"), T0 + 30));
    expect(korBomba.publicView(s, ctx(T0 + 40)).correctPredictors).toEqual([]);
    const clean = okState(act(fixed({ explodeAt: T0 + 17_345 }), "a", pass("d"), T0 + 30));
    expect(korBomba.publicView(s, ctx(T0 + 40))).toEqual(korBomba.publicView(clean, ctx(T0 + 40)));
    expect(korBomba.view(s, "b", ctx(T0 + 40))).toMatchObject({
      prediction: null,
      lastResult: { turn: 0, correct: false },
    });
    expect(korBomba.view(s, "c", ctx(T0 + 40))).toMatchObject({ lastResult: { turn: 0, correct: true } });
    expect(korBomba.view(s, "a", ctx(T0 + 40))).toMatchObject({ lastResult: null });
  });

  it("patlamada puan alanlar herkese açılır, yanlışlar ve 'patlamaz' diyenler değil", () => {
    const s = withPreds();
    const boom = korBomba.tick(s, ctx(s.explodeAt));
    expect(korBomba.publicView(boom, ctx(s.explodeAt)).correctPredictors).toEqual(["b"]);
    expect(korBomba.view(boom, "b", ctx(s.explodeAt))).toMatchObject({ lastResult: { correct: true } });
    expect(korBomba.view(boom, "c", ctx(s.explodeAt))).toMatchObject({ lastResult: { correct: false } });
  });

  it("taşıyıcının görünümü diğer oyuncuların tahmin gönderdiği anlarda değişmez (zamanlama yok)", () => {
    const s0 = fixed();
    const before = JSON.stringify(korBomba.view(s0, "a", ctx(T0 + 5)));
    const s1 = okState(act(s0, "b", predict(0, true), T0 + 6));
    const s2 = okState(act(s1, "c", predict(0, true), T0 + 7));
    expect(JSON.stringify(korBomba.view(s2, "a", ctx(T0 + 8)))).toBe(before);
  });

  it("sızıntı denetimi tahminli durumda temiz", () => {
    expect(findLeaks(korBomba, withPreds(), ALL, T0 + 100)).toEqual([]);
  });

  it("tahmin sunucu işlemi süreden bağımsız: kalan süreyi etkilemez", () => {
    const s = fixed();
    const after = okState(act(s, "b", predict(0, true), T0 + 15_000));
    expect(after.explodeAt).toBe(s.explodeAt);
    expect(after.lastBonusMs).toBe(s.lastBonusMs);
  });
});

describe("kor-bomba tahmini: belirlilik", () => {
  it("botlar tahminle oynar: belirlilik, tick bağımsızlığı ve kayıttan tekrar oynatma tutar", () => {
    let predicted = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { primary } = checkGameInvariants(korBomba, korBombaBot, { seed, playerCount: 2 + (seed % 7) });
      const st = primary.state as KorBombaState;
      predicted += Object.keys(st.results).length + Object.keys(st.predictions).length;
      expect(primary.log.actions.some((x) => (x.action as KorBombaAction).kind === "predict")).toBe(true);
      for (const v of Object.values(primary.result.awards)) expect(v).toBeLessThanOrEqual(1);
    }
    expect(predicted).toBeGreaterThan(0);
  });

  it("eşit girdi eşit çıktı (reduce saf)", () => {
    const s = fixed();
    const a = act(s, "b", predict(0, true), T0 + 10);
    const b = act(s, "b", predict(0, true), T0 + 10);
    expect(a).toEqual(b);
    expect(s.predictions).toEqual({});
  });
});
