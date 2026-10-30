import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  zamanBombasiHafizasi as game,
  validTargets,
  ZAMAN_BOMBASI_ALERT_MS,
  ZAMAN_BOMBASI_COLORS,
  ZAMAN_BOMBASI_FAIL_SHOW_MS,
  ZAMAN_BOMBASI_INTRO_MS,
  ZAMAN_BOMBASI_OK_SHOW_MS,
  ZAMAN_BOMBASI_PICK_MS,
  type ZamanBombasiAction,
  type ZamanBombasiColor,
  type ZamanBombasiState,
} from "./index.js";

const T0 = 1_000_000;
const ctx = (now: number, connected: readonly string[] = [], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const start = (n = 4, seed = 1): ZamanBombasiState => game.setup(ids(n), ctx(T0, ids(n), seed));
/** Giriş evresinin başlangıcı (mutlak). */
const inputAt = (s: ZamanBombasiState) => s.turnStart + s.sequence.length * 350;
const deadlineAt = (s: ZamanBombasiState) => inputAt(s) + 1500 + s.sequence.length * 1000;
const active = (s: ZamanBombasiState) => s.active;
const pickOf = (s: ZamanBombasiState) => {
  if (!s.pick) throw new Error("seçim evresi değil");
  return s.pick;
};

function act(s: ZamanBombasiState, id: string, a: ZamanBombasiAction, at: number): ZamanBombasiState {
  const r = game.reduce(s, id, a, ctx(at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejectionOf = (s: ZamanBombasiState, id: string, a: ZamanBombasiAction, at: number) => {
  const r = game.reduce(s, id, a, ctx(at));
  return isRejected(r) ? r.rejected : null;
};
const press = (s: ZamanBombasiState, id: string, color: ZamanBombasiColor, at: number) =>
  act(s, id, { kind: "press", color }, at);
const rejection = (s: ZamanBombasiState, id: string, color: ZamanBombasiColor, at: number) =>
  rejectionOf(s, id, { kind: "press", color }, at);
const wrongColor = (c: ZamanBombasiColor): ZamanBombasiColor =>
  ZAMAN_BOMBASI_COLORS[(ZAMAN_BOMBASI_COLORS.indexOf(c) + 1) % 4] as ZamanBombasiColor;

/** Aktif oyuncu diziyi giriş evresinin başında doğru girer (sonuç: seçim evresi). */
function solve(s: ZamanBombasiState, at = inputAt(s)): ZamanBombasiState {
  let cur = s;
  const who = active(s);
  for (const c of s.sequence) cur = press(cur, who, c, at);
  return cur;
}
/** Doğru girer, rengi seçer ve bombayı atar (verilmezse ilk geçerli hedef). */
function solveThrow(
  s: ZamanBombasiState,
  opts: { color?: ZamanBombasiColor; target?: string; at?: number } = {},
): ZamanBombasiState {
  const at = opts.at ?? inputAt(s);
  const who = active(s);
  let cur = solve(s, at);
  cur = act(cur, who, { kind: "color", color: opts.color ?? "mavi" }, at);
  const target = opts.target ?? (validTargets(cur, pickOf(cur))[0] as string);
  return act(cur, who, { kind: "target", target }, at);
}
/** Aktif oyuncu ilk basışta yanlış basar. */
function failTurn(s: ZamanBombasiState, at = inputAt(s)): ZamanBombasiState {
  return press(s, active(s), wrongColor(s.sequence[0] as ZamanBombasiColor), at);
}

describe("kurulum", () => {
  it("4 renk, ilk dizi 2 eleman, herkes 0 puanda, ilk sıra karıştırılmış sıranın ilki", () => {
    const s = start(5);
    expect(s.sequence).toHaveLength(2);
    for (const c of s.sequence) expect(ZAMAN_BOMBASI_COLORS).toContain(c);
    expect([...s.order].sort()).toEqual(ids(5));
    expect(Object.values(s.scores)).toEqual([0, 0, 0, 0, 0]);
    expect(s.turnStart).toBe(T0 + ZAMAN_BOMBASI_INTRO_MS);
    expect(s.active).toBe(s.order[0]);
    expect([s.pick, s.thrower, s.lastThrow]).toEqual([null, null, null]);
  });

  it("ilk oyuncu ctx.rng ile rastgele: aynı tohum aynı, farklı tohumlar farklı ilk oyuncu verir", () => {
    expect(start(8, 3).active).toBe(start(8, 3).active);
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) firsts.add(start(8, seed).active);
    expect(firsts.size).toBeGreaterThan(3);
  });

  it("aynı renk art arda gelebilir; dört rengin hepsi üretilir", () => {
    let repeated = false;
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const q = start(2, seed).sequence;
      repeated ||= q[0] === q[1];
      for (const c of q) seen.add(c);
    }
    expect(repeated).toBe(true);
    expect(seen.size).toBe(4);
  });

  it("2–8 oyuncu, dikey yön, anlatım ≤ 3 madde", () => {
    expect([game.minPlayers, game.maxPlayers, game.orientation]).toEqual([2, 8, "portrait"]);
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
  });
});

describe("eylem ayrıştırma", () => {
  it("yalnız press/color {kind, color} ve target {kind, target} kabul edilir", () => {
    expect(game.parseAction({ kind: "press", color: "mavi" })).toEqual({ kind: "press", color: "mavi" });
    expect(game.parseAction({ kind: "color", color: "sari" })).toEqual({ kind: "color", color: "sari" });
    expect(game.parseAction({ kind: "target", target: "p2" })).toEqual({ kind: "target", target: "p2" });
    for (const raw of [
      { kind: "press" },
      { kind: "press", color: "mor" },
      { kind: "press", color: 1 },
      { kind: "press", color: "mavi", extra: 1 },
      { kind: "color", color: "mor" },
      { kind: "color", target: "p2" },
      { kind: "target", target: "" },
      { kind: "target", target: 3 },
      { kind: "target", target: "x".repeat(65) },
      { kind: "target", target: "p2", color: "mavi" },
      { kind: "tap", color: "mavi" },
      [],
      null,
      "mavi",
    ]) {
      expect(game.parseAction(raw)).toBeNull();
    }
  });
});

describe("evreler ve süreler (mutlak zamandan türer)", () => {
  it("hazırlık → oynatma (eleman başına 350 ms) → giriş", () => {
    const s = start(3);
    const t = s.turnStart;
    expect(game.publicView(s, ctx(t - 1)).phase).toBe("pause");
    const p0 = game.publicView(s, ctx(t));
    expect([p0.phase, p0.playbackIndex]).toEqual(["playback", 0]);
    expect(game.publicView(s, ctx(t + 349)).playbackIndex).toBe(0);
    expect(game.publicView(s, ctx(t + 350)).playbackIndex).toBe(1);
    const inp = game.publicView(s, ctx(t + 700));
    expect([inp.phase, inp.playbackIndex]).toEqual(["input", -1]);
  });

  it("giriş süresi = 1,5 sn + dizi uzunluğu × 1 sn; görünüm mutlak zamanları verir", () => {
    const s = start(3);
    const v = game.publicView(s, ctx(s.turnStart));
    expect(v.inputStart).toBe(s.turnStart + 700);
    expect(v.deadline).toBe(v.inputStart + 3500);
    expect([v.stepMs, v.length]).toEqual([350, 2]);
  });

  it("oynatma ve hazırlık evresinde basış reddedilir; giriş başlangıcında kabul edilir", () => {
    const s = start(3);
    const who = active(s);
    const c = s.sequence[0] as ZamanBombasiColor;
    expect(rejection(s, who, c, s.turnStart - 10)).toBe("not_input_yet");
    expect(rejection(s, who, c, inputAt(s) - 1)).toBe("not_input_yet");
    expect(rejection(s, who, c, inputAt(s))).toBeNull();
  });

  it("süre bitiminden 1 ms önceki basış geçerli, bitiş anındaki basış zaman aşımı sayılır", () => {
    const s = start(4);
    const who = active(s);
    expect(press(s, who, s.sequence[0] as ZamanBombasiColor, deadlineAt(s) - 1).entered).toHaveLength(1);
    expect(rejection(s, who, s.sequence[0] as ZamanBombasiColor, deadlineAt(s))).toBe("eliminated");
  });
});

describe("doğru giriş → bombayı at (ZB-M1/M2)", () => {
  it("doğru giren seçim evresine geçer: 0,9 sn TEMİZ, sonra 4 sn seçim; dizi henüz uzamaz", () => {
    const s = start(4);
    const who = active(s);
    const t = inputAt(s) + 500;
    const n = solve(s, t);
    expect(n.sequence).toEqual(s.sequence);
    expect(n.pick).toMatchObject({ by: who, kind: "throw", color: null, growth: 1 });
    expect(pickOf(n).opensAt).toBe(t + ZAMAN_BOMBASI_OK_SHOW_MS);
    expect(pickOf(n).deadline).toBe(t + ZAMAN_BOMBASI_OK_SHOW_MS + ZAMAN_BOMBASI_PICK_MS);
    expect(n.last).toMatchObject({ kind: "ok", player: who, at: t });
    const pv = game.publicView(n, ctx(t + 10));
    expect(pv.phase).toBe("pick");
    expect(pv.active).toBe(who);
    expect(pv.pick).toMatchObject({ by: who, kind: "throw", colorDone: false, blocked: null });
    expect(pv.sequence).toBeNull();
    for (const id of ids(4)) {
      const v = game.view(n, id, ctx(t + 10));
      expect(v.myPick).toBe(id === who);
      expect(v.myTurn).toBe(false);
    }
  });

  it("seçilen renk dizinin sonuna eklenir; hedef seçilince bomba atılır ve uyarı payından sonra oynatma başlar", () => {
    const s = start(4);
    const who = active(s);
    const t = inputAt(s);
    let n = solve(s, t);
    n = act(n, who, { kind: "color", color: "sari" }, t + 300);
    expect(game.view(n, who, ctx(t + 301)).pickColor).toBe("sari");
    const target = validTargets(n, pickOf(n))[1] as string;
    n = act(n, who, { kind: "target", target }, t + 800);
    expect(n.sequence).toEqual([...s.sequence, "sari"]);
    expect(n.active).toBe(target);
    expect(n.thrower).toBe(who);
    expect(n.pick).toBeNull();
    expect(n.lastThrow).toEqual({ from: who, to: target, at: t + 800, auto: false });
    expect(n.turnStart).toBe(t + 800 + ZAMAN_BOMBASI_ALERT_MS);
    expect(n.turn).toBe(s.turn + 1);
    expect(deadlineAt(n) - inputAt(n)).toBe(4500);
    const pv = game.publicView(n, ctx(t + 801));
    expect(pv.phase).toBe("pause");
    expect(pv.sequence).toEqual([...s.sequence, "sari"]);
    expect(game.view(n, target, ctx(t + 801)).myTurn).toBe(true);
  });

  it("seçim TEMİZ gösterimi sırasında da kabul edilir (alt sınır yok, yalnız üst sınır)", () => {
    const s = start(3);
    const who = active(s);
    const t = inputAt(s);
    const n = solve(s, t);
    const c = act(n, who, { kind: "color", color: "kirmizi" }, t + 1);
    expect(
      act(c, who, { kind: "target", target: validTargets(c, pickOf(c))[0] as string }, t + 2).pick,
    ).toBeNull();
  });

  it("önce renk, sonra hedef; renk bir kez seçilir; yalnız seçen, yalnız seçim evresinde", () => {
    const s = start(4);
    const who = active(s);
    const t = inputAt(s);
    const n = solve(s, t);
    const other = validTargets(n, pickOf(n))[0] as string;
    expect(rejectionOf(n, who, { kind: "target", target: other }, t)).toBe("color_first");
    expect(rejectionOf(n, other, { kind: "color", color: "mavi" }, t)).toBe("not_your_pick");
    expect(rejectionOf(n, "yok", { kind: "color", color: "mavi" }, t)).toBe("not_participant");
    expect(rejection(n, who, "mavi", t)).toBe("picking");
    const c = act(n, who, { kind: "color", color: "mavi" }, t);
    expect(rejectionOf(c, who, { kind: "color", color: "sari" }, t)).toBe("color_done");
    expect(rejectionOf(s, who, { kind: "color", color: "mavi" }, inputAt(s))).toBe("not_picking");
    expect(rejectionOf(s, who, { kind: "target", target: other }, inputAt(s))).toBe("not_picking");
  });

  it("kendine, elenmişe ya da olmayan oyuncuya atılamaz", () => {
    let s = start(5);
    s = failTurn(s); // ilk sıra: atan yok, rastgele yeni kurban
    const out = s.eliminated[0] as string;
    const who = active(s);
    const t = inputAt(s);
    const c = act(solve(s, t), who, { kind: "color", color: "mavi" }, t);
    for (const target of [who, out, "yok"]) {
      expect(rejectionOf(c, who, { kind: "target", target }, t)).toBe("bad_target");
    }
  });

  it("3+ aktif oyuncuda bombayı az önce atana hemen geri atılamaz; başkasına atılabilir", () => {
    const s = start(4);
    const a = active(s);
    const b = s.order[2] as string;
    const n = solveThrow(s, { target: b });
    const t = inputAt(n);
    const c = act(solve(n, t), b, { kind: "color", color: "yesil" }, t);
    expect(pickOf(c).blocked).toBe(a);
    expect(game.publicView(c, ctx(t)).pick?.blocked).toBe(a);
    expect(validTargets(c, pickOf(c))).not.toContain(a);
    expect(rejectionOf(c, b, { kind: "target", target: a }, t)).toBe("bad_target");
    const third = ids(4).find((id) => id !== a && id !== b) as string;
    expect(act(c, b, { kind: "target", target: third }, t).active).toBe(third);
  });

  it("engel yalnız bir sonraki atış içindir: araya biri girince bombayı atana atılabilir", () => {
    const s = start(4);
    const [a, b, c] = s.order as [string, string, string];
    let n = solveThrow(s, { target: b });
    n = solveThrow(n, { target: c });
    const t = inputAt(n);
    const p = act(solve(n, t), c, { kind: "color", color: "yesil" }, t);
    expect(pickOf(p).blocked).toBe(b);
    expect(act(p, c, { kind: "target", target: a }, t).active).toBe(a);
  });

  it("2 aktif oyuncuda engel yok: bombayı atana geri atılır (2 oyunculu oyun)", () => {
    let s = start(2);
    const [a, b] = s.order as [string, string];
    s = solveThrow(s, { target: b });
    const t = inputAt(s);
    const p = act(solve(s, t), b, { kind: "color", color: "mavi" }, t);
    expect(pickOf(p).blocked).toBeNull();
    expect(validTargets(p, pickOf(p))).toEqual([a]);
    expect(act(p, b, { kind: "target", target: a }, t).active).toBe(a);
  });

  it("3 oyuncudan biri elenince (2 aktif) engel kalkar", () => {
    let s = start(3, 4);
    s = failTurn(s); // ilk sıra elenir, rastgele yeni kurban
    expect(s.eliminated).toHaveLength(1);
    const x = active(s);
    const y = s.order.find((id) => id !== x && !s.eliminated.includes(id)) as string;
    s = solveThrow(s, { target: y });
    const t = inputAt(s);
    const p = act(solve(s, t), y, { kind: "color", color: "mavi" }, t);
    expect(pickOf(p).blocked).toBeNull();
    expect(act(p, y, { kind: "target", target: x }, t).active).toBe(x);
  });

  it("art arda doğru sıralar diziyi 1'er uzatır (önceki dizi başta kalır)", () => {
    let s = start(4, 7);
    const first = [...s.sequence];
    s = solveThrow(s, { color: "kirmizi" });
    s = solveThrow(s, { color: "kirmizi" });
    s = solveThrow(s, { color: "yesil" });
    expect(s.sequence).toEqual([...first, "kirmizi", "kirmizi", "yesil"]);
  });
});

describe("seçilmezse rastgele (maç tohumundan, belirleyici)", () => {
  it("hiç seçim yoksa süre bitiminde renk ve geçerli hedef rastgele; atış anı seçim bitişi", () => {
    const s = start(4);
    const who = active(s);
    const n = solve(s);
    const due = pickOf(n).deadline;
    expect(game.tick(n, ctx(due - 1))).toBe(n);
    const r = game.tick(n, ctx(due));
    expect(r.pick).toBeNull();
    expect(r.sequence).toHaveLength(3);
    expect(r.sequence.slice(0, 2)).toEqual(s.sequence);
    expect(validTargets(n, pickOf(n))).toContain(r.active);
    expect(r.lastThrow).toEqual({ from: who, to: r.active, at: due, auto: true });
    expect(r.turnStart).toBe(due + ZAMAN_BOMBASI_ALERT_MS);
    expect(game.tick(n, ctx(due + 3000))).toEqual(r);
  });

  it("renk seçildi ama hedef seçilmediyse renk korunur, yalnız hedef rastgele", () => {
    const s = start(4);
    const who = active(s);
    const n = act(solve(s), who, { kind: "color", color: "sari" }, inputAt(s));
    const r = game.tick(n, ctx(pickOf(n).deadline));
    expect(r.sequence).toEqual([...s.sequence, "sari"]);
    expect(r.active).not.toBe(who);
  });

  it("seçim süresi bitiş anında kapanır: 1 ms önce kabul, bitişte reddedilir", () => {
    const s = start(4);
    const who = active(s);
    const n = act(solve(s), who, { kind: "color", color: "sari" }, inputAt(s));
    const due = pickOf(n).deadline;
    const target = validTargets(n, pickOf(n))[0] as string;
    expect(rejectionOf(n, who, { kind: "target", target }, due - 1)).toBeNull();
    expect(rejectionOf(n, who, { kind: "target", target }, due)).toBe("not_picking");
  });

  it("rastgele hedef hiçbir zaman kendisi, elenmiş ya da engelli değildir; dağılır; aynı tohumda aynıdır", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      let s = start(5, seed);
      s = solveThrow(s);
      const n = solve(s);
      const p = pickOf(n);
      const r = game.tick(n, ctx(p.deadline));
      expect(r.active).not.toBe(p.by);
      expect(r.active).not.toBe(p.blocked);
      expect(validTargets(n, p)).toContain(r.active);
      expect(game.tick(n, ctx(p.deadline))).toEqual(r);
      seen.add(`${s.order.indexOf(r.active)}`);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("bağlantısı kopan seçicide süre dolunca rastgele (tick connected'a bakmaz); kopuk oyuncu hedef olabilir", () => {
    const s = start(4);
    const who = active(s);
    const n = solve(s);
    const due = pickOf(n).deadline;
    expect(game.tick(n, ctx(due, []))).toEqual(game.tick(n, ctx(due, ids(4))));
    const target = validTargets(n, pickOf(n))[0] as string;
    const c = act(n, who, { kind: "color", color: "mavi" }, inputAt(s));
    const r = game.reduce(c, who, { kind: "target", target }, ctx(inputAt(s), [who]));
    expect(isRejected(r) ? r.rejected : (r as ZamanBombasiState).active).toBe(target);
  });
});

describe("elenme", () => {
  it("yanlış basış anında eler; dizi yeni 2 renge döner; yeni kurbanı bombayı ona atan seçer", () => {
    let s = start(4);
    const a = active(s);
    s = solveThrow(s);
    s = solveThrow(s); // dizi 4
    const victim = active(s);
    const thrower = s.thrower as string;
    const t = inputAt(s) + 200;
    const n = failTurn(s, t);
    expect(n.eliminated).toEqual([victim]);
    expect(n.sequence).toHaveLength(2);
    expect(n.active).toBe(thrower);
    expect(n.pick).toMatchObject({ by: thrower, kind: "restart", growth: 0, blocked: null, color: null });
    expect(pickOf(n).opensAt).toBe(t + ZAMAN_BOMBASI_FAIL_SHOW_MS);
    expect(pickOf(n).deadline).toBe(t + ZAMAN_BOMBASI_FAIL_SHOW_MS + ZAMAN_BOMBASI_PICK_MS);
    expect(n.last).toMatchObject({ kind: "fail", player: victim, at: t });
    const pv = game.publicView(n, ctx(t + 1));
    expect(pv.pick?.colorDone).toBe(true);
    expect(pv.sequence).toBeNull();
    // Renk seçimi yok; hedef doğrudan seçilir. Bombayı az önce atan engeli bu seçimde yoktur.
    expect(rejectionOf(n, thrower, { kind: "color", color: "mavi" }, t + 1)).toBe("no_color_pick");
    expect(validTargets(n, pickOf(n))).toContain(
      a === thrower ? (s.order.find((id) => id !== a) as string) : a,
    );
    const target = validTargets(n, pickOf(n))[0] as string;
    const r = act(n, thrower, { kind: "target", target }, t + 500);
    expect(r.sequence).toEqual(n.sequence);
    expect(r.active).toBe(target);
    expect(r.thrower).toBe(thrower);
    expect(r.turnStart).toBe(t + 500 + ZAMAN_BOMBASI_ALERT_MS);
  });

  it("yeni dizi eskisinin devamı değildir (yeniden rastgele) ve elenme sonrası seçilmezse hedef rastgele", () => {
    let s = start(5, 9);
    s = solveThrow(s, { color: "kirmizi" });
    const n = failTurn(s);
    const r = game.tick(n, ctx(pickOf(n).deadline));
    expect(r.sequence).toEqual(n.sequence);
    expect(r.lastThrow).toMatchObject({ from: n.pick?.by, auto: true });
    expect(r.eliminated).not.toContain(r.active);
    expect(r.active).not.toBe(n.pick?.by);
  });

  it("ilk sırada (bombayı atan yok) elenince yeni kurban rastgele; patlama gösteriminden sonra atılır", () => {
    const s = start(4);
    const t = inputAt(s);
    const n = failTurn(s, t);
    expect(n.pick).toBeNull();
    expect(n.eliminated).toEqual([s.active]);
    expect(n.eliminated).not.toContain(n.active);
    expect(n.lastThrow).toEqual({ from: null, to: n.active, at: t + ZAMAN_BOMBASI_FAIL_SHOW_MS, auto: true });
    expect(n.turnStart).toBe(t + ZAMAN_BOMBASI_FAIL_SHOW_MS + ZAMAN_BOMBASI_ALERT_MS);
    expect(n.thrower).toBeNull();
  });

  it("elenen oyuncu sıraya bir daha girmez ve eylemleri reddedilir", () => {
    const s = start(4);
    const victim = active(s);
    const n = failTurn(s);
    expect(rejection(n, victim, "mavi", inputAt(n))).toBe("eliminated");
    expect(rejectionOf(n, victim, { kind: "target", target: "p1" }, inputAt(n))).toBe("eliminated");
    expect(game.view(n, victim, ctx(inputAt(n)))).toEqual({
      isOut: true,
      myTurn: false,
      myPick: false,
      pickColor: null,
    });
  });

  it("zaman aşımı (tick ile) yanlışla aynı sonucu verir ve kesin an olarak deadline'a işlenir", () => {
    let s = start(4);
    s = solveThrow(s);
    const victim = active(s);
    const at = deadlineAt(s);
    expect(game.tick(s, ctx(at - 1))).toBe(s);
    const n = game.tick(s, ctx(at));
    expect(n.eliminated).toEqual([victim]);
    expect(n.last).toMatchObject({ kind: "timeout", player: victim, at });
    expect(n.pick?.by).toBe(s.thrower);
    expect(game.tick(s, ctx(at + 1500))).toEqual(n);
  });

  it("uzun süre tick gelmese de ardışık zaman aşımları ve seçimler sırayla işlenir (tick takviminden bağımsız)", () => {
    const s = start(8);
    const jump = game.tick(s, ctx(T0 + 40_000));
    let step = s;
    for (let t = T0; t <= T0 + 40_000; t += 250) step = game.tick(step, ctx(t));
    expect(jump).toEqual(step);
    expect(jump.eliminated.length).toBeGreaterThanOrEqual(2);
  });

  it("bağlantısı kopan aktif oyuncu yalnız zamanla elenir", () => {
    const s = start(4);
    const victim = active(s);
    const without = ids(4).filter((x) => x !== victim);
    expect(game.tick(s, ctx(deadlineAt(s), without))).toEqual(game.tick(s, ctx(deadlineAt(s), ids(4))));
    expect(game.tick(s, ctx(deadlineAt(s) - 1, without))).toBe(s);
  });
});

describe("bitiş ve puanlama (ZB-M3: hayatta kalan +2, elenen 0, kimse elenmezse herkes +1)", () => {
  it.each([
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
  ])("%i oyuncuda %i elenme ile anında biter", (n, need) => {
    let s = start(n);
    expect(s.need).toBe(need);
    for (let i = 0; i < need; i++) {
      expect(s.finished).toBe(false);
      s = game.tick(s, ctx(Math.max(s.pick?.deadline ?? 0, s.turnStart)));
      s = failTurn(s);
    }
    expect(s.finished).toBe(true);
    expect(s.eliminated).toHaveLength(need);
    for (const id of ids(n)) expect(s.scores[id]).toBe(s.eliminated.includes(id) ? 0 : 2);
    expect(game.result(s)).toEqual({ miniScores: s.scores, awards: s.scores });
  });

  it("oyun sırasında puan birikmez (herkes 0); son elenmede bitişte verilir", () => {
    let s = start(4);
    s = failTurn(s);
    expect(Object.values(s.scores)).toEqual([0, 0, 0, 0]);
    expect(game.publicView(s, ctx(inputAt(s))).scores).toEqual(s.scores);
    const at = inputAt(s);
    s = failTurn(s, at);
    expect(s.finished).toBe(true);
    expect(s.endedAt).toBe(at);
    expect(Object.values(s.scores).sort()).toEqual([0, 0, 2, 2]);
  });

  it("2 oyuncuda hayatta kalan +2, elenen 0", () => {
    let s = start(2);
    const [a, b] = s.order as [string, string];
    s = solveThrow(s, { target: b });
    s = failTurn(s);
    expect(s.finished).toBe(true);
    expect(s.scores).toEqual({ [a]: 2, [b]: 0 });
  });

  it("bitişten sonra eylem reddedilir (tick edilmemiş olsa da); isFinished tick'siz fark eder", () => {
    let s = start(2);
    s = solveThrow(s);
    expect(game.isFinished(s, ctx(deadlineAt(s) - 1))).toBe(false);
    expect(game.isFinished(s, ctx(deadlineAt(s)))).toBe(true);
    expect(rejection(s, active(s), "mavi", deadlineAt(s) + 1)).toBe("ended");
  });
});

/** `startedAt`'i kaydırarak toplam süre/ani ölüm sınırlarını istenen ana getirir (kalan her şey aynı kalır). */
const withStart = (s: ZamanBombasiState, startedAt: number): ZamanBombasiState => ({ ...s, startedAt });

describe("toplam süre sınırı (90 sn)", () => {
  it("toplam süre kurulumdan 90 sn; görünüm mutlak zamanları verir", () => {
    const v = game.publicView(start(4), ctx(T0));
    expect([v.startedAt, v.endsAt, v.suddenDeathAt]).toEqual([T0, T0 + 90_000, T0 + 60_000]);
  });

  it("kimse elenmeden 90 sn dolarsa herkes +1", () => {
    let s = start(3);
    for (let i = 0; i < 6; i++) s = solveThrow(s);
    s = withStart(s, inputAt(s) + 100 - 90_000);
    const done = game.tick(s, ctx(inputAt(s) + 100));
    expect(done.finished).toBe(true);
    expect(done.timeUp).toBe(true);
    expect(done.endedAt).toBe(inputAt(s) + 100);
    expect(Object.values(done.scores)).toEqual([1, 1, 1]);
  });

  it("giriş sırasında süre dolarsa giriş yapanın sırası cezasız iptal edilir; o kişi hayatta sayılır (+2)", () => {
    let s = start(5);
    s = failTurn(s); // biri elendi
    const out = s.eliminated[0] as string;
    const who = active(s);
    s = press(s, who, s.sequence[0] as ZamanBombasiColor, inputAt(s));
    s = withStart(s, inputAt(s) + 500 - 90_000);
    const done = game.tick(s, ctx(inputAt(s) + 500));
    expect(done.finished).toBe(true);
    expect(done.timeUp).toBe(true);
    expect(done.eliminated).toEqual([out]);
    for (const id of ids(5)) expect(done.scores[id]).toBe(id === out ? 0 : 2);
  });

  it("seçim sırasında süre dolarsa seçim iptal, oyun biter", () => {
    let s = solve(start(4));
    s = withStart(s, pickOf(s).deadline - 1000 - 90_000);
    const end = s.startedAt + 90_000;
    expect(game.tick(s, ctx(end - 1)).finished).toBe(false);
    const done = game.tick(s, ctx(end));
    expect(done).toMatchObject({ finished: true, timeUp: true, endedAt: end, pick: null });
    expect(Object.values(done.scores)).toEqual([1, 1, 1, 1]);
  });

  it("süre dolmadan önce zaman aşımına uğrayan sıra yine cezalandırılır; aynı anda dolarsa iptal", () => {
    const s = start(4);
    const early = withStart(s, deadlineAt(s) + 1 - 90_000);
    expect(game.tick(early, ctx(deadlineAt(s) + 1)).eliminated).toEqual([s.active]);
    const same = withStart(s, deadlineAt(s) - 90_000);
    const done = game.tick(same, ctx(deadlineAt(s)));
    expect(done).toMatchObject({ finished: true, timeUp: true, eliminated: [] });
  });

  it("seçim süresi (4 sn) oyun saatinden düşer", () => {
    const s = start(3);
    const t = inputAt(s);
    const n = solve(s, t);
    const who = active(n);
    const c = act(n, who, { kind: "color", color: "mavi" }, t + 3000);
    const r = act(c, who, { kind: "target", target: validTargets(c, pickOf(c))[0] as string }, t + 3900);
    expect(r.turnStart).toBe(t + 3900 + ZAMAN_BOMBASI_ALERT_MS);
    expect(game.publicView(r, ctx(t + 3901)).endsAt).toBe(T0 + 90_000);
  });
});

describe("ani ölüm (60 sn sonrası +2: biri seçilen, biri rastgele)", () => {
  it("doğru bitiş anı tam 60 sn ise hâlâ +1", () => {
    const s = start(4);
    const t = inputAt(s);
    const n = solve(withStart(s, t - 60_000), t);
    expect(pickOf(n).growth).toBe(1);
  });

  it("60 sn'yi 1 ms aşınca +2: seçilen renk önce, ikinci renk rastgele; giriş süresi yeni uzunluğa göre", () => {
    const s = start(4);
    const t = inputAt(s);
    const n = solve(withStart(s, t - 60_001), t);
    expect(pickOf(n).growth).toBe(2);
    const who = active(n);
    const c = act(n, who, { kind: "color", color: "sari" }, t);
    const r = act(c, who, { kind: "target", target: validTargets(c, pickOf(c))[0] as string }, t);
    expect(r.sequence).toHaveLength(4);
    expect(r.sequence.slice(0, 3)).toEqual([...s.sequence, "sari"]);
    expect(ZAMAN_BOMBASI_COLORS).toContain(r.sequence[3]);
    expect(deadlineAt(r) - inputAt(r)).toBe(1500 + 4000);
    // seçilmezse ikisi de rastgele; aynı tohumda belirli
    const auto = game.tick(n, ctx(pickOf(n).deadline));
    expect(auto.sequence).toHaveLength(4);
    expect(game.tick(n, ctx(pickOf(n).deadline))).toEqual(auto);
  });

  it("ani ölümde elenme dizi uzunluğunu yine 2'ye sıfırlar", () => {
    const s = start(4);
    const n = failTurn(withStart(s, inputAt(s) - 70_000));
    expect(n.sequence).toHaveLength(2);
  });
});

describe("gizlilik", () => {
  it("metin olarak aranacak gizli bilgi yok", () => {
    expect(game.secrets(start(4))).toEqual([]);
  });

  it("oynatma evresinde dizi herkese görünür; giriş evresinde hiçbir görünümde yok", () => {
    const s = start(4);
    expect(game.publicView(s, ctx(s.turnStart)).sequence).toEqual(s.sequence);
    const pv = game.publicView(s, ctx(inputAt(s)));
    expect(pv.sequence).toBeNull();
    for (const id of [...ids(4), null]) {
      const v = game.view(s, id, ctx(inputAt(s)));
      expect(Object.keys(v).sort()).toEqual(["isOut", "myPick", "myTurn", "pickColor"]);
      expect(v.pickColor).toBeNull();
    }
  });

  it("seçilen renk yalnız seçenin görünümünde; herkese açık görünümde yalnız 'seçildi' bilgisi", () => {
    const s = start(4);
    const who = active(s);
    const t = inputAt(s);
    const n = act(solve(s, t), who, { kind: "color", color: "sari" }, t);
    const pv = game.publicView(n, ctx(t + 1));
    expect(pv.pick?.colorDone).toBe(true);
    expect(pv.sequence).toBeNull();
    expect(JSON.stringify(pv)).not.toContain("sari");
    for (const id of [...ids(4), null]) {
      expect(game.view(n, id, ctx(t + 1)).pickColor).toBe(id === who ? "sari" : null);
    }
  });

  it("hata özeti yalnız tek beklenen rengi verir, tam diziyi değil", () => {
    let s = start(4);
    s = solveThrow(s);
    const n = failTurn(s);
    expect(n.last?.expected).toBe(s.sequence[0]);
    expect(Object.keys(n.last ?? {}).sort()).toEqual(["at", "color", "expected", "kind", "player", "turn"]);
  });
});

describe("bildirim ve uyanma", () => {
  it("'Sıra sende!' yalnız diziyi girecek oyuncuya; seçim evresinde kimseye", () => {
    const s = start(4);
    expect(game.notify?.(s, ctx(T0))).toEqual([s.active]);
    const n = solve(s);
    expect(game.notify?.(n, ctx(inputAt(s)))).toEqual([]);
    const r = game.tick(n, ctx(pickOf(n).deadline));
    expect(game.notify?.(r, ctx(pickOf(n).deadline))).toEqual([r.active]);
  });

  it("nextWake: giriş/seçim süresinin bitişi ya da toplam süre", () => {
    const s = start(4);
    expect(game.nextWake?.(s, ctx(T0))).toBe(deadlineAt(s));
    const n = solve(s);
    expect(game.nextWake?.(n, ctx(inputAt(s)))).toBe(pickOf(n).deadline);
  });
});

describe("saflık ve belirlilik", () => {
  it("reduce girdi durumunu değiştirmez", () => {
    const s = start(4);
    const snap = JSON.stringify(s);
    solveThrow(s);
    failTurn(s);
    game.tick(s, ctx(deadlineAt(s) + 5000));
    game.publicView(s, ctx(deadlineAt(s) + 5000));
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("görünümler ctx.rng tüketmez", () => {
    const s = start(4);
    const rng = createRng(9);
    const before = createRng(9).next();
    game.publicView(s, { now: deadlineAt(s) + 20_000, rng, connected: [] });
    game.view(s, "p1", { now: deadlineAt(s) + 20_000, rng, connected: [] });
    expect(rng.next()).toBe(before);
  });

  it("aynı tohumla aynı oyun", () => {
    const run = () => game.tick(solve(game.tick(solve(start(4, 11)), ctx(T0 + 20_000))), ctx(T0 + 40_000));
    expect(run()).toEqual(run());
  });
});

describe("bot takvimi", () => {
  it("hem doğru bitmiş sıralar hem elenmeler üretir ve her zaman süre içinde biter", async () => {
    const { BOTS, buildActions, buildTicks, runSimulation } = await import("../../testing/index.js");
    const bot = BOTS["zaman-bombasi-hafizasi"];
    if (!bot) throw new Error("bot yok");
    let withOk = 0;
    let ended = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const players = ids(2 + (seed % 7));
      const out = runSimulation(game, {
        seed,
        players,
        startedAt: 0,
        actions: buildActions(bot, seed, players, 0),
        ticks: buildTicks(seed, "irregular", 0, bot.durationMs),
        durationMs: bot.durationMs,
        disconnectProbability: 0,
      });
      const st = out.state as ZamanBombasiState;
      ended += st.finished ? 1 : 0;
      // Sıra sayacı = 1 + atış sayısı; doğru giriş olmadan atış yalnız (bitirmeyen) elenmelerden gelir.
      if (st.turn > st.eliminated.length + (st.timeUp ? 1 : 0)) withOk++;
    }
    expect(ended).toBe(150);
    expect(withOk).toBeGreaterThan(0);
  });
});
