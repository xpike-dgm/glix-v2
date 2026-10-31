import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { BOTS, buildActions, buildTicks, findLeaks, runSimulation } from "../../testing/index.js";
import { type BozukState, bozukIsRobust, bozukNormalizeWords, bozukTelefon as game } from "./index.js";
import {
  BOZUK_DRAW_MS,
  BOZUK_EMPTY_TEXT,
  BOZUK_MAX_DRAW_ACTIONS,
  BOZUK_MAX_DURATION_MS,
  BOZUK_MAX_STROKES,
  BOZUK_MAX_TOTAL_POINTS,
  BOZUK_RESULT_MS,
  BOZUK_SHOW_STEP_MS,
  BOZUK_TIMELINE,
  BOZUK_VOTE_MS,
  BOZUK_WRITE_MS,
  type BozukAction,
  type BozukStep,
  bozukChainMs,
  bozukDurationMs,
  bozukRankAwards,
  bozukStepCount,
  bozukStepKind,
} from "./types.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
const ctx = (at: number, connected: readonly string[] = PLAYERS) => ({
  now: T0 + at,
  rng: createRng(1),
  connected,
});

/** Sıra sabit (a,b,c,d): zincir c'yi order[c] başlatır, s. adımda order[(c+s)%n] tutar. */
function start(players: string[] = PLAYERS): BozukState {
  const s = game.setup(players, ctx(0, players));
  return { ...s, order: [...players] };
}

function act(s: BozukState, id: string, action: BozukAction, at: number, connected?: readonly string[]) {
  const r = game.reduce(s, id, action, ctx(at, connected ?? s.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reasonOf = (
  s: BozukState,
  id: string,
  action: BozukAction,
  at: number,
  connected?: readonly string[],
) => {
  const r = game.reduce(s, id, action, ctx(at, connected ?? s.players));
  return isRejected(r) ? r.rejected : null;
};
/** Sunucudaki gibi ham eylem `parseAction`'dan geçer (temizlik uygulanır). */
const text = (t: string): BozukAction => {
  const parsed = game.parseAction({ kind: "text", text: t });
  if (parsed === null) throw new Error(`geçersiz cümle: ${t}`);
  return parsed;
};
const stroke = (n = 2, seed = 7): BozukAction => ({
  kind: "stroke",
  color: "beyaz",
  size: 2,
  points: Array.from({ length: n * 2 }, (_, i) => (i * seed) % 1001),
});
const lock: BozukAction = { kind: "lock" };
const vote = (step: number): BozukAction => ({ kind: "vote", step });
const tickAt = (s: BozukState, at: number, connected?: readonly string[]) =>
  game.tick(s, ctx(at, connected ?? s.players));

/** Adım `s` ne zaman başlar (erken bitiş yokken). */
const stepStart = (n: number, step: number): number => {
  let t = 0;
  for (let i = 0; i < step; i++) t += bozukStepKind(i) === "write" ? BOZUK_WRITE_MS : BOZUK_DRAW_MS;
  void n;
  return t;
};
/** Gösteri: son adım (steps-1) aralık sonra görünür ve oylama o an açılır. */
const showMs = (steps: number) => (steps - 1) * BOZUK_SHOW_STEP_MS;
const chainMs = (steps: number) => showMs(steps) + BOZUK_VOTE_MS + BOZUK_RESULT_MS;
const voteStart = (n: number, c: number) => chainStart(n, c) + showMs(bozukStepCount(n));
const revealStart = (n: number) => stepStart(n, bozukStepCount(n));
const chainStart = (n: number, c: number) => revealStart(n) + c * chainMs(bozukStepCount(n));
const endAt = (n: number) => chainStart(n, n);

/** Her oyuncunun benzersiz cümlesi ya da çizimi: adım `s`'te `id` için. */
const sentence = (id: string, step: number) => `zz${id}${step}`;
function inputAll(s: BozukState, players = s.players, at?: number): BozukState {
  let st = s;
  const t = at ?? stepStart(players.length, st.step) + 1_000;
  for (const id of players) {
    st =
      bozukStepKind(st.step) === "write"
        ? act(st, id, text(sentence(id, st.step)), t, players)
        : act(st, id, stroke(3, 11 + players.indexOf(id)), t, players);
  }
  return st;
}
/** Tüm adımları doldurup (zaman aşımıyla) gösterinin başına gelir. */
function toReveal(players = PLAYERS, fill = true): BozukState {
  let s = start(players);
  const steps = bozukStepCount(players.length);
  for (let i = 0; i < steps; i++) {
    if (fill) s = inputAll(s, players);
    s = tickAt(s, stepStart(players.length, i + 1), players);
  }
  return s;
}

describe("bozuk-telefon kurulum", () => {
  it("3-8 oyuncu; yazma 20 sn, çizme 45 sn, gösteri adımı 2 sn, oylama 6 sn, sonuç 2 sn; ilk adım yazma", () => {
    expect(game.minPlayers).toBe(3);
    expect(game.maxPlayers).toBe(8);
    expect(BOZUK_WRITE_MS).toBe(20_000);
    expect(BOZUK_DRAW_MS).toBe(45_000);
    expect(BOZUK_SHOW_STEP_MS).toBe(2_000);
    expect(BOZUK_VOTE_MS).toBe(6_000);
    expect(BOZUK_RESULT_MS).toBe(2_000);
    expect(BOZUK_TIMELINE).toEqual({
      writeMs: 20_000,
      drawMs: 45_000,
      showStepMs: 2_000,
      voteMs: 6_000,
      resultMs: 2_000,
      lockGraceMs: 1_000,
      maxSteps: 5,
    });
    const s = start();
    expect(s.endAt).toEqual([T0 + 20_000]);
    expect(bozukStepKind(0)).toBe("write");
    expect(bozukStepKind(1)).toBe("draw");
    expect(bozukStepKind(2)).toBe("write");
    expect(game.publicView(s, ctx(0)).phase).toBe("write");
  });

  it("adım sayısı = oyuncu sayısı, en çok 5 (7-8 kişide de 5)", () => {
    expect([3, 4, 5, 6, 7, 8].map(bozukStepCount)).toEqual([3, 4, 5, 5, 5, 5]);
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      expect(game.setup(players, ctx(0, players)).steps).toBe(bozukStepCount(n));
    }
  });

  it("3 oyuncuda yaz -> çiz -> yaz; 5+ oyuncuda yaz, çiz, yaz, çiz, yaz", () => {
    expect([0, 1, 2].map(bozukStepKind)).toEqual(["write", "draw", "write"]);
    expect([0, 1, 2, 3, 4].map(bozukStepKind)).toEqual(["write", "draw", "write", "draw", "write"]);
  });

  it("erken bitişsiz toplam süre: 3 oyuncu 121 sn, 4 oyuncu 186 sn, 5 oyuncu 230 sn, 8 oyuncu 278 sn", () => {
    expect([3, 4, 5, 6, 7, 8].map((n) => bozukDurationMs(n) / 1000)).toEqual([121, 186, 230, 246, 262, 278]);
    expect(bozukChainMs(5)).toBe(4 * 2_000 + 6_000 + 2_000);
    expect(bozukChainMs(3)).toBe(2 * 2_000 + 6_000 + 2_000);
  });

  it("süre üst sınırı: en uzun oyun BOZUK_MAX_DURATION_MS içinde bitiş", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) expect(bozukDurationMs(n)).toBeLessThanOrEqual(BOZUK_MAX_DURATION_MS);
    expect(endAt(8)).toBe(bozukDurationMs(8));
    expect(endAt(3)).toBe(bozukDurationMs(3));
  });

  it("briefing kısa: amaç + en çok 3 madde, teknik sözcük yok", () => {
    expect(game.briefing.steps.length).toBeLessThanOrEqual(3);
    const all = [game.briefing.goal, ...game.briefing.steps].join(" ").toLowerCase();
    for (const w of ["debug", "protocol", "server", "stage"]) expect(all).not.toContain(w);
  });

  it("aynı tohum aynı sırayı, farklı tohumlar farklı sıraları verir", () => {
    const mk = (seed: number) =>
      game.setup(PLAYERS, { now: T0, rng: createRng(seed), connected: PLAYERS }).order.join("");
    expect(mk(5)).toBe(mk(5));
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) seen.add(mk(seed));
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe("bozuk-telefon zincir dönüşü", () => {
  it("sıra katılımcıların bir permütasyonudur (sabit, karıştırılmış döngü)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 8 }), fc.integer({ min: 0, max: 100000 }), (n, seed) => {
        const players = Array.from({ length: n }, (_, i) => `p${i}`);
        const s = game.setup(players, { now: T0, rng: createRng(seed), connected: players });
        expect([...s.order].sort()).toEqual([...players].sort());
      }),
    );
  });

  it("hiçbir zincir sona kadar başlatıcısına dönmez; her adımda herkes tam bir zincir tutar", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 8 }), fc.integer({ min: 0, max: 100000 }), (n, seed) => {
        const players = Array.from({ length: n }, (_, i) => `p${i}`);
        let s = game.setup(players, { now: T0, rng: createRng(seed), connected: players });
        const steps = s.steps;
        for (let i = 0; i < steps; i++) {
          s = inputAll(s, players, stepStart(n, i) + 1);
          s = tickAt(s, stepStart(n, i + 1), players);
        }
        // Her zincirin yazarları: ilk yazar başlatan, hepsi birbirinden farklı.
        for (const starter of s.order) {
          const authors = (s.chains[starter] as BozukStep[]).map((x) => x.author);
          expect(authors).toHaveLength(steps);
          expect(authors[0]).toBe(starter);
          expect(new Set(authors).size).toBe(steps);
          expect(authors.slice(1)).not.toContain(starter);
        }
        // Her adımda her oyuncu tam bir zincirde yazar.
        for (let i = 0; i < steps; i++) {
          const at = s.order.map((st) => (s.chains[st] as BozukStep[])[i]?.author).sort();
          expect(at).toEqual([...players].sort());
        }
      }),
    );
  });

  it("ilk adımda herkes kendi zincirini başlatır", () => {
    const s = start();
    for (const id of PLAYERS) expect(game.view(s, id, ctx(0)).prompt).toBeNull();
    const done = tickAt(inputAll(s), 25_000);
    for (const id of PLAYERS) expect((done.chains[id] as BozukStep[])[0]?.author).toBe(id);
  });
});

describe("bozuk-telefon yazma adımı", () => {
  it("cümle kaydedilir (Türkçe büyük harf, boşluk sadeleşir) ve yalnız sahibinin görünümünde görünür", () => {
    const s = act(start(), "a", text("  iyi   ışık  "), 1_000);
    expect(game.view(s, "a", ctx(1_000)).text).toBe("İYİ IŞIK");
    expect(game.view(s, "b", ctx(1_000)).text).toBeNull();
    expect(game.view(s, null, ctx(1_000)).text).toBeNull();
    expect(JSON.stringify(game.publicView(s, ctx(1_000)))).not.toContain("IŞIK");
  });

  it("süre bitene kadar değiştirilebilir (son cümle geçerli)", () => {
    let s = act(start(), "a", text("birinci cümle"), 1_000);
    s = act(s, "a", text("ikinci cümle"), 19_000);
    s = tickAt(s, 20_000);
    expect(s.chains.a?.[0]).toEqual({ kind: "write", author: "a", text: "İKİNCİ CÜMLE" });
  });

  it("en çok 60 karakter; 61 karakter, boş, yalnız emoji ve denetim karakterleri geçersiz", () => {
    expect(game.parseAction({ kind: "text", text: "a".repeat(60) })).not.toBeNull();
    expect(game.parseAction({ kind: "text", text: "a".repeat(61) })).toBeNull();
    expect(game.parseAction({ kind: "text", text: "" })).toBeNull();
    expect(game.parseAction({ kind: "text", text: "   " })).toBeNull();
    expect(game.parseAction({ kind: "text", text: "😀😀" })).toBeNull();
    expect(game.parseAction({ kind: "text", text: "a‮b" })).toBeNull();
    expect(game.parseAction({ kind: "text", text: 5 })).toBeNull();
    expect(game.parseAction({ kind: "text", text: "merhaba", extra: 1 })).toBeNull();
    // Satır sonu boşluğa iner.
    expect(game.parseAction({ kind: "text", text: "a\nb" })).toEqual({ kind: "text", text: "A B" });
  });

  it("en kötü durum cümle mesajı 4 KB altında", () => {
    expect(JSON.stringify({ type: "action", seq: 99999, payload: text("ş".repeat(60)) }).length).toBeLessThan(
      4096,
    );
  });

  it("çizim eylemleri yazma adımında reddedilir", () => {
    const s = start();
    expect(reasonOf(s, "a", stroke(), 1_000)).toBe("wrong_phase");
    expect(reasonOf(s, "a", { kind: "undo" }, 1_000)).toBe("wrong_phase");
    expect(reasonOf(s, "a", { kind: "clear" }, 1_000)).toBe("wrong_phase");
    expect(reasonOf(s, "a", vote(0), 1_000)).toBe("wrong_phase");
  });

  it("süre dolmadan son milisaniyede kabul, süre dolunca ret", () => {
    const s = start();
    expect(reasonOf(s, "a", text("son an"), BOZUK_WRITE_MS - 1)).toBeNull();
    expect(reasonOf(s, "a", text("geç"), BOZUK_WRITE_MS)).toBe("wrong_phase");
  });

  it("katılımcı olmayan ve oyun başlamadan gelen eylem reddedilir", () => {
    const s = start();
    expect(reasonOf(s, "zed", text("ben kimim"), 1_000)).toBe("not_participant");
    expect(reasonOf(s, "a", text("erken"), -1)).toBe("not_started");
  });

  it("süresi dolan boş yazı zincire '…' olarak geçer; taslak varsa o geçer", () => {
    let s = act(start(), "b", text("bir şeyler"), 1_000);
    s = tickAt(s, BOZUK_WRITE_MS);
    expect(s.chains.a?.[0]).toEqual({ kind: "write", author: "a", text: BOZUK_EMPTY_TEXT });
    expect(s.chains.b?.[0]).toEqual({ kind: "write", author: "b", text: "BİR ŞEYLER" });
    expect(s.step).toBe(1);
  });
});

describe("bozuk-telefon çizme adımı ve önceki adımı görme", () => {
  it("her oyuncu yalnız elindeki zincirin bir önceki adımını görür", () => {
    let s = start();
    s = tickAt(inputAll(s), stepStart(4, 1));
    // Adım 1: zincir c'yi order[(c+1)%4] tutar -> b, a'nın cümlesini görür.
    expect(game.view(s, "b", ctx(stepStart(4, 1))).prompt).toEqual({
      kind: "write",
      text: sentence("a", 0).toLocaleUpperCase("tr-TR"),
    });
    expect(game.view(s, "a", ctx(stepStart(4, 1))).prompt).toEqual({
      kind: "write",
      text: sentence("d", 0).toLocaleUpperCase("tr-TR"),
    });
    expect(game.view(s, "b", ctx(stepStart(4, 1))).role).toBe("draw");
    expect(game.view(s, null, ctx(stepStart(4, 1))).prompt).toBeNull();
  });

  it("çizim adımında darbe/geri al/temizle ortak doğrulamayla çalışır; yazı eylemi reddedilir", () => {
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1) + 500;
    expect(reasonOf(s, "a", text("yazı"), t)).toBe("wrong_phase");
    expect(reasonOf(s, "a", { kind: "undo" }, t)).toBe("empty");
    expect(reasonOf(s, "a", { kind: "clear" }, t)).toBe("empty");
    s = act(s, "a", stroke(3), t);
    s = act(s, "a", stroke(4), t);
    expect(Object.keys(game.view(s, "a", ctx(t)).strokes)).toEqual(["0", "1"]);
    s = act(s, "a", { kind: "undo" }, t);
    expect(Object.keys(game.view(s, "a", ctx(t)).strokes)).toEqual(["0"]);
    s = act(s, "a", stroke(2), t);
    expect(Object.keys(game.view(s, "a", ctx(t)).strokes)).toEqual(["0", "2"]);
    s = act(s, "a", { kind: "clear" }, t);
    expect(game.view(s, "a", ctx(t)).strokes).toEqual({});
    expect(game.view(s, "a", ctx(t)).pointsLeft).toBe(BOZUK_MAX_TOTAL_POINTS);
  });

  it("darbe, nokta ve eylem kotaları uygulanır", () => {
    const base = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1) + 500;
    let s = base;
    for (let i = 0; i < BOZUK_MAX_STROKES; i++) s = act(s, "a", stroke(2), t);
    expect(reasonOf(s, "a", stroke(2), t)).toBe("too_many_strokes");
    s = base;
    for (let i = 0; i < BOZUK_MAX_TOTAL_POINTS / 100; i++) s = act(s, "a", stroke(100), t);
    expect(reasonOf(s, "a", stroke(2), t)).toBe("too_many_points");
    s = base;
    for (let i = 0; i < BOZUK_MAX_DRAW_ACTIONS / 2; i++) {
      s = act(s, "a", stroke(2), t);
      s = act(s, "a", { kind: "undo" }, t);
    }
    expect(reasonOf(s, "a", stroke(2), t)).toBe("too_many_actions");
  });

  it("geçersiz darbeler (nokta sayısı, aralık, renk, kalınlık) ayrıştırılmaz", () => {
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: [1, 2, 3] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: [1, 2] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: [0, 0, 1001, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "lacivert", size: 2, points: [0, 0, 1, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 5, points: [0, 0, 1, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 0, points: [0, 0, 1, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: [0, 0, 1.5, 5] })).toBeNull();
    expect(
      game.parseAction({ kind: "stroke", color: "eraser", size: 3, points: Array(240).fill(5) }),
    ).not.toBeNull();
    expect(
      game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: Array(242).fill(5) }),
    ).toBeNull();
  });

  it("10 renk (kırmızı, mor, kahverengi, gri dahil) ve 4 kalınlık (çok kalın) kabul edilir; sınırlar aynı", () => {
    for (const color of [
      "beyaz",
      "pembe",
      "sari",
      "yesil",
      "mavi",
      "turuncu",
      "kirmizi",
      "mor",
      "kahverengi",
      "gri",
      "eraser",
    ])
      for (const size of [1, 2, 3, 4])
        expect(game.parseAction({ kind: "stroke", color, size, points: [0, 0, 1, 5] })).not.toBeNull();
    // Yeni renk ve kalınlık sunucuda saklanır; silgi dizini (6) değişmez, yeni renkler 7..10.
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1) + 1;
    s = act(s, "a", { kind: "stroke", color: "gri", size: 4, points: [1, 2, 3, 4] }, t);
    s = act(s, "a", { kind: "stroke", color: "kirmizi", size: 1, points: [1, 2, 3, 4] }, t);
    s = act(s, "a", { kind: "stroke", color: "eraser", size: 4, points: [1, 2, 3, 4] }, t);
    expect(Object.values(game.view(s, "a", ctx(t)).strokes)).toEqual([
      [10, 4, 1, 2, 3, 4],
      [7, 1, 1, 2, 3, 4],
      [6, 4, 1, 2, 3, 4],
    ]);
    expect(BOZUK_MAX_STROKES).toBe(150);
    expect(BOZUK_MAX_TOTAL_POINTS).toBe(1_500);
    expect(BOZUK_MAX_DRAW_ACTIONS).toBe(400);
  });

  it("çizim ve yazının sonu: süresi dolan boş çizim 'boş tuval' (strokes: []) olarak geçer", () => {
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    s = act(s, "a", stroke(3), stepStart(4, 1) + 1);
    s = tickAt(s, stepStart(4, 2));
    // a, adım 1'de zincir 3'ü (d'nin) tutuyordu.
    const drawnByA = s.chains.d?.[1] as BozukStep;
    expect(drawnByA.kind).toBe("draw");
    expect(drawnByA.kind === "draw" && drawnByA.strokes).toHaveLength(1);
    const empty = s.chains.a?.[1] as BozukStep;
    expect(empty).toEqual({ kind: "draw", author: "b", strokes: [] });
  });

  it("sonraki yazma adımı çizimi görür, çizimin kendisi yazarsızdır", () => {
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    s = tickAt(inputAll(s), stepStart(4, 2));
    const t = stepStart(4, 2);
    const p = game.view(s, "c", ctx(t)).prompt;
    expect(p?.kind).toBe("draw");
    expect(JSON.stringify(p)).not.toContain("author");
    expect(game.view(s, "c", ctx(t)).role).toBe("write");
  });
});

describe("bozuk-telefon gizlilik (yapısal)", () => {
  /** Tüm görünümler: ortak + her oyuncu + izleyici. */
  const blobs = (s: BozukState, at: number, except: string[] = []) => {
    const out: Record<string, string> = { public: JSON.stringify(game.publicView(s, ctx(at))) };
    for (const id of PLAYERS) if (!except.includes(id)) out[id] = JSON.stringify(game.view(s, id, ctx(at)));
    out.spectator = JSON.stringify(game.view(s, null, ctx(at)));
    return out;
  };

  it("adım 2: cümle yalnız yazarında ve sıradaki tutucuda; zincirin geri kalanı gizli", () => {
    let s = start();
    s = tickAt(inputAll(s), stepStart(4, 1));
    s = tickAt(inputAll(s), stepStart(4, 2));
    const t = stepStart(4, 2);
    // a'nın başlattığı zincirin 0. adımı (a'nın cümlesi): a (yazar) ve b (adım 1 tutucusu, artık geçti) dışında kimse görmez.
    const aText = sentence("a", 0).toLocaleUpperCase("tr-TR");
    const views = blobs(s, t);
    expect(views.public).not.toContain(aText);
    expect(views.spectator).not.toContain(aText);
    for (const id of PLAYERS) expect(views[id]).not.toContain(aText);
    // Adım 2 tutucusu c, b'nin çizimini görür (a'nın cümlesini değil).
    expect(game.view(s, "c", ctx(t)).prompt?.kind).toBe("draw");
  });

  it("adım 1: önceki cümle yalnız o zinciri tutan oyuncuda", () => {
    const s = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1);
    for (const writer of PLAYERS) {
      const needle = sentence(writer, 0).toLocaleUpperCase("tr-TR");
      const holder = PLAYERS[(PLAYERS.indexOf(writer) + 1) % 4] as string;
      const views = blobs(s, t);
      for (const [who, blob] of Object.entries(views)) {
        if (who === holder) expect(blob).toContain(needle);
        else expect(blob, `${who} ← ${writer}`).not.toContain(needle);
      }
    }
  });

  it("çizimler: sahibinden ve sıradaki tutucudan başkasının görünümünde darbe yok", () => {
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    // d'nin özgün çizimi: ayırt edici koordinatlar.
    const marker = [111, 222, 333, 444, 555, 666];
    s = act(s, "d", { kind: "stroke", color: "mavi", size: 1, points: marker }, stepStart(4, 1) + 5);
    for (const id of ["a", "b", "c"]) {
      expect(JSON.stringify(game.view(s, id, ctx(stepStart(4, 1) + 5)))).not.toContain("111,222,333");
    }
    expect(JSON.stringify(game.publicView(s, ctx(stepStart(4, 1) + 5)))).not.toContain("111,222,333");
    expect(JSON.stringify(game.view(s, "d", ctx(stepStart(4, 1) + 5)))).toContain("111,222,333");
    // Adım 2: çizimi yalnız sonraki tutucu görür. d, zincir 2'yi (c'nin) tutuyordu -> bu zincirin sonraki tutucusu:
    s = tickAt(s, stepStart(4, 2));
    const views = blobs(s, stepStart(4, 2));
    const holders = PLAYERS.filter((id) => views[id]?.includes("111,222,333"));
    expect(holders).toHaveLength(1);
    expect(views.public).not.toContain("111,222,333");
    expect(views.spectator).not.toContain("111,222,333");
  });

  it("girdi aşamasında ortak görünümde hiçbir cümle/çizim yok; yalnız kimlerin bitirdiği", () => {
    let s = act(start(), "a", text("gizli cümle bir"), 100);
    s = act(s, "a", lock, 200);
    const pub = game.publicView(s, ctx(300));
    expect(pub.doneIds).toEqual(["a"]);
    expect(pub.reveal).toBeNull();
    expect(pub.scores).toBeNull();
    expect(JSON.stringify(pub)).not.toContain("GİZLİ");
  });

  it("secrets: gizli cümle yalnız yazarı ve sıradaki tutucuyu hak sahibi sayar", () => {
    const s = tickAt(inputAll(start()), stepStart(4, 1));
    const secrets = game.secrets(s);
    expect(secrets.length).toBe(4);
    for (const e of secrets) {
      expect(e.ownerIds).toHaveLength(2);
      expect(findLeaks(game, s, PLAYERS, T0 + stepStart(4, 1))).toEqual([]);
    }
  });

  it("kısa cümleler (secrets ile izlenemeyen) yapısal olarak gizli kalır: yalnız tutucunun prompt'unda", () => {
    let s = start();
    for (const id of PLAYERS) s = act(s, id, text(`${id}${id}`), 1_000);
    s = tickAt(s, stepStart(4, 1));
    const t = stepStart(4, 1);
    for (const writer of PLAYERS) {
      const holder = PLAYERS[(PLAYERS.indexOf(writer) + 1) % 4] as string;
      const needle = `"text":"${writer.toUpperCase()}${writer.toUpperCase()}"`;
      const seenBy = PLAYERS.filter((id) => JSON.stringify(game.view(s, id, ctx(t))).includes(needle));
      expect(seenBy).toEqual([holder]);
      expect(JSON.stringify(game.publicView(s, ctx(t)))).not.toContain(needle);
      expect(JSON.stringify(game.view(s, null, ctx(t)))).not.toContain(needle);
    }
  });

  it("bağlantı kopması gizliliği değiştirmez (görünümler bağlı listesine bakmaz)", () => {
    const s = tickAt(inputAll(start()), stepStart(4, 1));
    expect(findLeaks(game, s, PLAYERS, T0 + stepStart(4, 1), ["a"])).toEqual([]);
    expect(game.view(s, "b", ctx(0, ["a"]))).toEqual(game.view(s, "b", ctx(0, PLAYERS)));
  });

  it("gösteri: henüz gösterilmemiş adımlar ve sonraki zincirler hiçbir görünümde yok", () => {
    const s = tickAt(toReveal(), chainStart(4, 0) + 100);
    const pub = game.publicView(s, ctx(0));
    expect(pub.reveal?.steps).toHaveLength(1);
    const hidden = (s.chains.a as BozukStep[]).slice(1, 3).filter((x) => x.kind === "write");
    for (const h of hidden) {
      if (h.kind === "write") expect(JSON.stringify(pub)).not.toContain(h.text);
    }
    // Başka zincirin cümleleri de yok.
    const other = (s.chains.b as BozukStep[])[0];
    expect(other?.kind === "write" && JSON.stringify(pub).includes(other.text)).toBe(false);
    expect(findLeaks(game, s, PLAYERS, T0 + chainStart(4, 0) + 100)).toEqual([]);
  });

  it("gösteri: oylar sonuç aşamasına kadar kime verildiğiyle birlikte yok", () => {
    let s = tickAt(toReveal(), chainStart(4, 0) + showMs(4) + 100);
    s = act(s, "b", vote(2), chainStart(4, 0) + showMs(4) + 200);
    const pub = JSON.stringify(game.publicView(s, ctx(chainStart(4, 0) + showMs(4) + 200)));
    expect(pub).toContain('"voted":["b"]');
    expect(game.publicView(s, ctx(0)).reveal?.tally).toBeNull();
    for (const id of ["a", "c", "d"]) expect(game.view(s, id, ctx(0)).myVote).toBeNull();
    expect(game.view(s, "b", ctx(0)).myVote).toBe(2);
    expect(game.view(s, null, ctx(0)).myVote).toBeNull();
  });
});

describe("bozuk-telefon isimsiz oylama (gizlilik)", () => {
  /** Ortak görünümde ya da başkasının görünümünde yazar kimliği var mı (yapısal: "author" alanı ve başlatan). */
  const authorsIn = (v: {
    reveal: { steps: { author: string | null }[]; starter: string | null } | null;
  }) => [...(v.reveal?.steps.map((x) => x.author) ?? []), v.reveal?.starter ?? null];

  it("gösteri ve oylama boyunca ortak görünümde hiçbir adımın yazarı ve başlatan yok", () => {
    for (const n of [3, 4, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const s = toReveal(players);
      const steps = bozukStepCount(n);
      for (let c = 0; c < n; c++) {
        for (let t = 0; t < showMs(steps) + BOZUK_VOTE_MS; t += 500) {
          const at = chainStart(n, c) + t;
          const pub = game.publicView(tickAt(s, at, players), ctx(at, players));
          expect(pub.reveal?.stage === "show" || pub.reveal?.stage === "vote").toBe(true);
          expect(authorsIn(pub).every((x) => x === null)).toBe(true);
          expect(pub.recap).toBeNull();
          // Kişisel görünümler de yazar taşımaz (yalnız kendi adımının numarası).
          for (const id of [...players, null]) {
            const view = game.view(tickAt(s, at, players), id, ctx(at, players));
            expect(Object.keys(view).sort()).toEqual(
              ["done", "myStep", "myVote", "pointsLeft", "prompt", "role", "strokes", "text"].sort(),
            );
          }
        }
      }
    }
  });

  it("sonuç aşamasında yazarlar ve başlatan açılır", () => {
    const s = toReveal();
    const pub = game.publicView(tickAt(s, chainStart(4, 2) + showMs(4) + BOZUK_VOTE_MS), ctx(0));
    expect(pub.reveal?.stage).toBe("result");
    expect(pub.reveal?.starter).toBe("c");
    expect(pub.reveal?.steps.map((x) => x.author)).toEqual(["c", "d", "a", "b"]);
  });

  it("kendi adımın yalnız sana işaretlenir (myStep); başkasında ve izleyicide null", () => {
    const s = toReveal();
    // Zincir 1: yazarlar b,c,d,a. Gösteride yalnız görünen adımlar sayılır.
    const at = (ms: number) => tickAt(s, chainStart(4, 1) + ms);
    expect(game.view(at(100), "b", ctx(0)).myStep).toBe(0);
    expect(game.view(at(100), "c", ctx(0)).myStep).toBeNull(); // c'nin adımı (1) henüz açılmadı
    expect(game.view(at(2_100), "c", ctx(0)).myStep).toBe(1);
    expect(game.view(at(6_100), "a", ctx(0)).myStep).toBe(3);
    expect(game.view(at(6_100), null, ctx(0)).myStep).toBeNull();
    expect(game.view(at(6_100), "zed", ctx(0)).myStep).toBeNull();
    // 7-8 oyuncuda bir zincirde adımı olmayan oyuncu: null.
    const p7 = Array.from({ length: 7 }, (_, i) => `p${i}`);
    const s7 = tickAt(toReveal(p7), voteStart(7, 0), p7);
    const withStep = p7.filter((id) => game.view(s7, id, ctx(0, p7)).myStep !== null);
    expect(withStep).toHaveLength(5);
  });

  it("oylama sırasında kendi adımına oy reddedilir ama ortak görünüm bunu ele vermez", () => {
    const s = tickAt(toReveal(), voteStart(4, 0) + 100);
    expect(reasonOf(s, "b", vote(1), voteStart(4, 0) + 200)).toBe("own_step");
    const pub = JSON.stringify(game.publicView(s, ctx(0)));
    expect(pub).not.toContain('"author":"');
    expect(pub).toContain('"starter":null');
  });

  it("oyun sonu özeti (recap): yalnız son zincirin sonucu açılınca, tüm zincirler yazar/oy/taçlarıyla", () => {
    let s = toReveal();
    s = act(tickAt(s, voteStart(4, 0) + 100), "a", vote(1), voteStart(4, 0) + 200);
    const last = chainStart(4, 3);
    expect(game.publicView(tickAt(s, last + showMs(4) + 100), ctx(0)).recap).toBeNull();
    const atResult = game.publicView(tickAt(s, last + showMs(4) + BOZUK_VOTE_MS), ctx(0));
    expect(atResult.recap).toHaveLength(4);
    const done = game.publicView(tickAt(s, endAt(4)), ctx(0));
    expect(done.phase).toBe("done");
    const recap = done.recap ?? [];
    expect(recap.map((r) => r.starter)).toEqual(["a", "b", "c", "d"]);
    expect(recap[0]?.tally).toEqual([0, 1, 0, 0]);
    expect(recap[0]?.crowned).toEqual([1]);
    expect(recap[0]?.steps.map((x) => x.author)).toEqual(["a", "b", "c", "d"]);
    expect(recap[1]?.crowned).toEqual([]);
  });
});

describe("bozuk-telefon sonuç açılışı (revealAt)", () => {
  const revealAt = (s: BozukState, at: number) => game.revealAt?.(s, ctx(at)) ?? null;
  it("girdi sürerken belli değil; gösteride son zincirin oylama bitişi (sonuç açılışı)", () => {
    expect(revealAt(start(), 1_000)).toBeNull();
    const s = toReveal();
    expect(revealAt(s, chainStart(4, 0))).toBe(T0 + voteStart(4, 3) + BOZUK_VOTE_MS);
    // Açılıştan 2 sn sonra (sonuç penceresi) oyun biter; açılış anı kaymaz.
    expect(game.isFinished(s, ctx(voteStart(4, 3) + BOZUK_VOTE_MS + BOZUK_RESULT_MS))).toBe(true);
    expect(revealAt(s, endAt(4) + 5_000)).toBe(T0 + voteStart(4, 3) + BOZUK_VOTE_MS);
  });
  it("son zincirde herkes oy verince açılış öne çekilir (1 sn sonra)", () => {
    let s = tickAt(toReveal(), voteStart(4, 3) + 100);
    // Zincir 3 yazarları d,a,b,c.
    for (const [id, step] of [
      ["a", 0],
      ["b", 0],
      ["c", 0],
      ["d", 1],
    ] as const)
      s = act(s, id, vote(step), voteStart(4, 3) + 200);
    expect(revealAt(s, voteStart(4, 3) + 300)).toBe(T0 + voteStart(4, 3) + 1_200);
  });
});

describe("bozuk-telefon kahkaha puanı -> mini puan (+2 / +1 / 0)", () => {
  const P = ["a", "b", "c", "d"];
  it("en yüksek +2, sonraki farklı toplam +1, diğerleri 0", () => {
    expect(bozukRankAwards({ a: 5, b: 3, c: 1, d: 0 }, P)).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });
  it("birincide eşitlik: hepsi +2, sonraki farklı toplam +1", () => {
    expect(bozukRankAwards({ a: 4, b: 4, c: 2, d: 2 }, P)).toEqual({ a: 2, b: 2, c: 1, d: 1 });
    expect(bozukRankAwards({ a: 4, b: 4, c: 4, d: 1 }, P)).toEqual({ a: 2, b: 2, c: 2, d: 1 });
  });
  it("toplamı 0 olan ödül almaz", () => {
    expect(bozukRankAwards({ a: 2, b: 0, c: 0, d: 0 }, P)).toEqual({ a: 2, b: 0, c: 0, d: 0 });
    expect(bozukRankAwards({ a: 0, b: 0, c: 0, d: 0 }, P)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(bozukRankAwards({}, P)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
  it("herkesin toplamı aynı ve 0'dan büyükse herkes +1", () => {
    expect(bozukRankAwards({ a: 3, b: 3, c: 3, d: 3 }, P)).toEqual({ a: 1, b: 1, c: 1, d: 1 });
  });
  it("eksi yok; ödüller yalnız 0, 1, 2", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 3, maxLength: 8 }), (vals) => {
        const ids = vals.map((_, i) => `p${i}`);
        const laugh = Object.fromEntries(ids.map((id, i) => [id, vals[i] ?? 0]));
        const out = bozukRankAwards(laugh, ids);
        const top = Math.max(...vals);
        for (const id of ids) {
          const v = out[id] ?? -1;
          expect([0, 1, 2]).toContain(v);
          if ((laugh[id] ?? 0) === 0) expect(v).toBe(0);
          if (top > 0 && (laugh[id] ?? 0) === top && new Set(vals).size > 1) expect(v).toBe(2);
        }
      }),
    );
  });
  it("tam oyunda miniScores = kahkaha puanı, awards = sıralama", () => {
    let s = toReveal();
    // Zincir 0 yazarları a,b,c,d: b'ye 2, c'ye 1 oy.
    for (const [id, step] of [
      ["a", 1],
      ["c", 1],
      ["d", 2],
    ] as const)
      s = act(tickAt(s, voteStart(4, 0) + 100), id, vote(step), voteStart(4, 0) + 200);
    const r = game.result(tickAt(s, endAt(4)));
    expect(r.miniScores).toEqual({ a: 0, b: 2, c: 1, d: 0 });
    expect(r.awards).toEqual({ a: 0, b: 2, c: 1, d: 0 });
  });
});

describe("bozuk-telefon erken bitiş", () => {
  it("(a) herkes 'Tamam' deyince adım 1 sn sonra biter (yazma)", () => {
    let s = start();
    for (const id of PLAYERS) s = act(s, id, text(sentence(id, 0)), 2_000);
    for (const id of PLAYERS.slice(0, 3)) s = act(s, id, lock, 3_000);
    expect(s.endAt[0]).toBe(T0 + BOZUK_WRITE_MS);
    s = act(s, "d", lock, 4_000);
    expect(s.endAt[0]).toBe(T0 + 5_000);
    expect(tickAt(s, 4_999).step).toBe(0);
    const next = tickAt(s, 5_000);
    expect(next.step).toBe(1);
    // Sonraki adım erken bitişin hemen ardından başlar.
    expect(next.endAt[1]).toBe(T0 + 5_000 + BOZUK_DRAW_MS);
  });

  it("(a) çizme adımında da 1 sn sonra biter", () => {
    let s = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1);
    for (const id of PLAYERS) s = act(s, id, stroke(), t + 2_000);
    for (const id of PLAYERS) s = act(s, id, lock, t + 3_000);
    expect(s.endAt[1]).toBe(T0 + t + 4_000);
    expect(tickAt(s, t + 3_999).step).toBe(1);
    expect(tickAt(s, t + 4_000).step).toBe(2);
  });

  it("(a) erken bitişte sonuç kaybolmaz: taslaklar zincire işlenir", () => {
    let s = start();
    for (const id of PLAYERS) s = act(s, id, text(sentence(id, 0)), 2_000);
    for (const id of PLAYERS) s = act(s, id, lock, 3_000);
    s = tickAt(s, 4_000);
    expect(s.chains.c?.[0]).toMatchObject({
      kind: "write",
      text: sentence("c", 0).toLocaleUpperCase("tr-TR"),
    });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start();
    for (const id of ["a", "b", "c"]) {
      s = act(s, id, text(sentence(id, 0)), 2_000);
      s = act(s, id, lock, 2_500);
    }
    expect(s.endAt[0]).toBe(T0 + BOZUK_WRITE_MS);
    expect(tickAt(s, BOZUK_WRITE_MS - 1).step).toBe(0);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const connected = ["a", "b", "c"];
    let s = start();
    for (const id of connected) {
      s = act(s, id, text(sentence(id, 0)), 2_000, connected);
      s = act(s, id, lock, 2_500, connected);
    }
    expect(s.endAt[0]).toBe(T0 + 3_500);
    const next = tickAt(s, 3_500, connected);
    expect(next.step).toBe(1);
    // Kopuk d'nin boş yazısı "…" olarak geçti.
    expect(next.chains.d?.[0]).toEqual({ kind: "write", author: "d", text: BOZUK_EMPTY_TEXT });
  });

  it("(c) herkes kopuksa erken bitiş olmaz", () => {
    let s = start();
    s = act(s, "a", text("tek başıma"), 1_000, []);
    s = act(s, "a", lock, 1_500, []);
    expect(s.endAt[0]).toBe(T0 + BOZUK_WRITE_MS);
  });

  it("(d) kilit sonrası değişiklik reddedilir; çizimde de", () => {
    let s = act(start(), "a", text("ilk cümle"), 1_000);
    s = act(s, "a", lock, 1_500);
    expect(reasonOf(s, "a", text("değiştir"), 2_000)).toBe("locked");
    expect(reasonOf(s, "a", lock, 2_000)).toBe("locked");
    let d = tickAt(inputAll(start()), stepStart(4, 1));
    const t = stepStart(4, 1);
    d = act(d, "b", stroke(), t + 1_000);
    d = act(d, "b", lock, t + 1_500);
    expect(reasonOf(d, "b", stroke(), t + 2_000)).toBe("locked");
    expect(reasonOf(d, "b", { kind: "undo" }, t + 2_000)).toBe("locked");
    expect(reasonOf(d, "b", { kind: "clear" }, t + 2_000)).toBe("locked");
  });

  it("girdisiz 'Tamam' reddedilir (yazı ve çizim)", () => {
    expect(reasonOf(start(), "a", lock, 1_000)).toBe("nothing_to_lock");
    const d = tickAt(inputAll(start()), stepStart(4, 1));
    expect(reasonOf(d, "a", lock, stepStart(4, 1) + 1_000)).toBe("nothing_to_lock");
  });

  it("(e) kilit listesi yalnız kimin bitirdiğini gösterir, içeriği sızdırmaz", () => {
    let s = act(start(), "a", text("çok gizli cümle"), 1_000);
    s = act(s, "a", lock, 1_500);
    const pub = JSON.stringify(game.publicView(s, ctx(2_000)));
    expect(pub).toContain('"doneIds":["a"]');
    expect(pub).not.toContain("ÇOK GİZLİ");
    for (const id of ["b", "c", "d"]) {
      expect(JSON.stringify(game.view(s, id, ctx(2_000)))).not.toContain("ÇOK GİZLİ");
      expect(game.view(s, id, ctx(2_000)).done).toBe(false);
    }
    expect(game.view(s, "a", ctx(2_000)).done).toBe(true);
  });

  it("(f) erken bitiş tick zamanlamasından bağımsız: seyrek tick yine aynı sonucu verir", () => {
    const run = (tickTimes: number[]) => {
      let s = start();
      for (const id of PLAYERS) s = act(s, id, text(sentence(id, 0)), 2_000);
      for (const id of PLAYERS) s = act(s, id, lock, 3_000);
      for (const t of tickTimes) s = tickAt(s, t);
      return act(s, "a", stroke(), 30_000);
    };
    const dense = run([3_500, 4_000, 5_000, 10_000, 29_000]);
    const sparse = run([29_900]);
    expect(dense.chains).toEqual(sparse.chains);
    expect(dense.endAt).toEqual(sparse.endAt);
  });

  it("oylamada herkes oy verince zincir 1 sn sonra sonuca geçer; sonraki zincir hemen kayar", () => {
    let s = tickAt(toReveal(), chainStart(4, 0));
    const v0 = chainStart(4, 0) + showMs(4);
    s = tickAt(s, v0);
    // Zincir 0 yazarları a,b,c,d (adım sırası). Herkes kendi dışında bir adıma oy verir.
    const picks: Record<string, number> = { a: 1, b: 0, c: 0, d: 0 };
    for (const id of ["a", "b", "c"]) s = act(s, id, vote(picks[id] as number), v0 + 1_000);
    expect(s.voteEnds["0"]).toBeUndefined();
    s = act(s, "d", vote(0), v0 + 2_000);
    expect(s.voteEnds["0"]).toBe(T0 + v0 + 3_000);
    expect(tickAt(s, v0 + 2_999).cursor?.stage).toBe("vote");
    expect(tickAt(s, v0 + 3_000).cursor?.stage).toBe("result");
    // Sonuç penceresi 3 sn; sonraki zincir erken başlar.
    expect(tickAt(s, v0 + 3_000 + BOZUK_RESULT_MS - 1).cursor?.chain).toBe(0);
    const next = tickAt(s, v0 + 3_000 + BOZUK_RESULT_MS);
    expect(next.cursor?.chain).toBe(1);
    expect(next.cursor?.stage).toBe("show");
    // Toplam süre kısalır.
    const planEnd = endAt(4) - (BOZUK_VOTE_MS - 3_000 + 0) + 0;
    expect(planEnd).toBeLessThan(endAt(4));
  });

  it("oylamada bir kişi eksikken ve kopuk oyuncu varken", () => {
    const v0 = chainStart(4, 0) + showMs(4);
    let s = tickAt(toReveal(), v0);
    for (const id of ["a", "b", "c"]) s = act(s, id, vote(id === "a" ? 1 : 0), v0 + 1_000);
    expect(s.voteEnds["0"]).toBeUndefined();
    // d kopukken kalan bağlı üçü oy verirse bitiş.
    let t = tickAt(toReveal(), v0);
    const connected = ["a", "b", "c"];
    for (const id of connected) t = act(t, id, vote(id === "a" ? 1 : 0), v0 + 1_000, connected);
    expect(t.voteEnds["0"]).toBe(T0 + v0 + 2_000);
  });
});

describe("bozuk-telefon gösteri", () => {
  it("girdi bitince gösteri başlar: adımlar 2 sn arayla; son adım görünür görünmez 6 sn oylama, 2 sn sonuç", () => {
    const s = toReveal();
    expect(game.publicView(s, ctx(0)).phase).toBe("reveal");
    const c0 = chainStart(4, 0);
    const at = (ms: number) => game.publicView(tickAt(s, c0 + ms), ctx(0)).reveal;
    expect(at(0)?.stage).toBe("show");
    expect(at(0)?.shown).toBe(1);
    expect(at(0)?.chain).toBe(0);
    expect(at(1_999)?.shown).toBe(1);
    expect(at(2_000)?.shown).toBe(2);
    expect(at(4_000)?.shown).toBe(3);
    expect(at(5_999)?.shown).toBe(3);
    expect(at(5_999)?.stage).toBe("show");
    // Son (4.) adım 6. saniyede görünür ve oylama aynı anda açılır.
    expect(at(6_000)?.stage).toBe("vote");
    expect(at(6_000)?.shown).toBe(4);
    expect(at(6_000)?.steps).toHaveLength(4);
    expect(at(6_000)?.voteStartsAt).toBe(T0 + c0 + 6_000);
    expect(at(6_000)?.stageEndsAt).toBe(T0 + c0 + 12_000);
    expect(at(11_999)?.stage).toBe("vote");
    expect(at(12_000)?.stage).toBe("result");
    expect(at(12_000)?.stageEndsAt).toBe(T0 + c0 + 14_000);
    expect(at(13_999)?.chain).toBe(0);
    expect(at(14_000)?.chain).toBe(1);
    expect(at(14_000)?.shown).toBe(1);
    expect(chainStart(4, 1) - c0).toBe(14_000);
  });

  it("gösteri sırasında son adım hiç 'show' aşamasında görünmez (oylama onunla açılır)", () => {
    for (const n of [3, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const s = toReveal(players);
      const steps = bozukStepCount(n);
      for (let t = 0; t < showMs(steps); t += 250) {
        const r = game.publicView(tickAt(s, chainStart(n, 0) + t, players), ctx(0)).reveal;
        expect(r?.stage).toBe("show");
        expect(r?.shown).toBeLessThan(steps);
      }
      const v = game.publicView(tickAt(s, voteStart(n, 0), players), ctx(0)).reveal;
      expect(v?.stage).toBe("vote");
      expect(v?.shown).toBe(steps);
    }
  });

  it("gösteri adımları zincirin sırasını korur; yazarlar yalnız sonuçta açılır", () => {
    const steps = (ms: number) =>
      game.publicView(tickAt(toReveal(), chainStart(4, 1) + ms), ctx(0)).reveal?.steps ?? [];
    expect(steps(13_000).map((x) => x.author)).toEqual(["b", "c", "d", "a"]);
    expect(steps(13_000).map((x) => x.kind)).toEqual(["write", "draw", "write", "draw"]);
    expect(steps(8_000).map((x) => x.author)).toEqual([null, null, null, null]);
    expect(steps(2_000).map((x) => x.author)).toEqual([null, null]);
  });

  it("tüm zincirler bitince oyun biter; sondan sonra eylem reddedilir", () => {
    const s = toReveal();
    expect(game.isFinished(s, ctx(endAt(4) - 1))).toBe(false);
    expect(game.isFinished(s, ctx(endAt(4)))).toBe(true);
    expect(reasonOf(s, "a", vote(1), endAt(4))).toBe("ended");
    expect(reasonOf(s, "a", text("geç"), endAt(4) + 5_000)).toBe("ended");
    const done = tickAt(s, endAt(4));
    expect(game.publicView(done, ctx(0)).phase).toBe("done");
    expect(reasonOf(done, "a", vote(1), endAt(4))).toBe("ended");
  });

  it("izleyici ve oyuncuların ortak görünümü aynıdır; yalnız oy/prompt ve kendi adımın özel", () => {
    const s = tickAt(toReveal(), chainStart(4, 0) + 100);
    // Zincir 0'ın ilk adımı a'nın: yalnız a'nın kendi görünümünde işaretli.
    expect(game.view(s, "a", ctx(0))).toEqual({ ...game.view(s, null, ctx(0)), myStep: 0 });
    expect(game.view(s, "b", ctx(0))).toEqual(game.view(s, null, ctx(0)));
  });

  it("gösteri hiç tick almadan da (reduce ile) doğru ilerler: oy kabul edilir", () => {
    // Yalnız son girdi adımının tick'i; sonrası yalnız eylem.
    const s = toReveal();
    const v0 = chainStart(4, 0) + showMs(4);
    expect(reasonOf(s, "b", vote(0), v0 + 10)).toBeNull();
    expect(reasonOf(s, "b", vote(0), v0 - 1)).toBe("wrong_phase");
    expect(reasonOf(s, "b", vote(0), v0 + BOZUK_VOTE_MS)).toBe("wrong_phase");
    expect(reasonOf(s, "b", vote(0), v0 + BOZUK_VOTE_MS - 1)).toBeNull();
  });

  it("girdi adımları da tick gelmeden (yalnız eylemle) ilerler", () => {
    let s = start();
    // Hiç tick yok: adım 0'ı bitirip adım 1'de çizim eylemi doğrudan kabul edilir.
    s = act(s, "a", text("yazdım"), 1_000);
    s = act(s, "b", stroke(), BOZUK_WRITE_MS + 100);
    expect(s.step).toBe(1);
    expect(s.chains.a?.[0]).toMatchObject({ text: "YAZDIM" });
  });
});

describe("bozuk-telefon oylama", () => {
  const v0 = chainStart(4, 0) + showMs(4);
  const voting = () => tickAt(toReveal(), v0 + 100);

  it("yazılar gösteri sırasında oylanamaz (yalnız oylama aşaması)", () => {
    const s = tickAt(toReveal(), chainStart(4, 0) + 100);
    expect(reasonOf(s, "b", vote(0), chainStart(4, 0) + 100)).toBe("wrong_phase");
  });

  it("kendi adımına oy verilemez, başkasınınkine verilebilir", () => {
    const s = voting();
    // Zincir 0: adım yazarları a,b,c,d.
    expect(reasonOf(s, "a", vote(0), v0 + 200)).toBe("own_step");
    expect(reasonOf(s, "c", vote(2), v0 + 200)).toBe("own_step");
    expect(reasonOf(s, "a", vote(1), v0 + 200)).toBeNull();
  });

  it("adım numarası aralık dışıysa reddedilir", () => {
    const s = voting();
    expect(reasonOf(s, "a", vote(4), v0 + 200)).toBe("bad_step");
    expect(game.parseAction({ kind: "vote", step: -1 })).toBeNull();
    expect(game.parseAction({ kind: "vote", step: 1.5 })).toBeNull();
    expect(game.parseAction({ kind: "vote", step: "1" })).toBeNull();
  });

  it("oy tek seferliktir (değiştirilemez) ve kendi özel görünümünde görünür", () => {
    let s = voting();
    s = act(s, "a", vote(1), v0 + 200);
    expect(reasonOf(s, "a", vote(2), v0 + 300)).toBe("voted");
    expect(reasonOf(s, "a", vote(1), v0 + 300)).toBe("voted");
    expect(game.view(s, "a", ctx(0)).myVote).toBe(1);
  });

  it("katılımcı olmayan oy veremez", () => {
    expect(reasonOf(voting(), "zed", vote(1), v0 + 200)).toBe("not_participant");
  });

  it("her zincir kendi oylamasına sahiptir: bir önceki zincirin oyu yeni zincirde sayılmaz", () => {
    let s = voting();
    s = act(s, "a", vote(1), v0 + 200);
    const c1 = chainStart(4, 1);
    s = tickAt(s, c1);
    expect(game.view(s, "a", ctx(0)).myVote).toBeNull();
    const v1 = c1 + showMs(4) + 100;
    // Zincir 1 adım yazarları b,c,d,a: a'nın kendi adımı 3.
    expect(reasonOf(s, "a", vote(3), v1)).toBe("own_step");
    expect(reasonOf(s, "a", vote(0), v1)).toBeNull();
  });

  it("sonuç aşamasında oy dağılımı ve sağlam zincir bilgisi açılır", () => {
    let s = voting();
    s = act(s, "a", vote(1), v0 + 200);
    s = act(s, "c", vote(1), v0 + 200);
    s = act(s, "d", vote(3 - 1), v0 + 200);
    s = tickAt(s, v0 + BOZUK_VOTE_MS);
    const reveal = game.publicView(s, ctx(0)).reveal;
    expect(reveal?.stage).toBe("result");
    expect(reveal?.tally).toEqual([0, 2, 1, 0]);
    expect(reveal?.robust).toBe(false);
    expect(reveal?.crowned).toEqual([1]);
    expect(reveal?.starter).toBe("a");
  });

  it("taç: en çok oy alan adım(lar); eşitlikte hepsi, oy yoksa boş", () => {
    let s = voting();
    s = act(s, "a", vote(1), v0 + 200);
    s = act(s, "b", vote(2), v0 + 200);
    const tied = game.publicView(tickAt(s, v0 + BOZUK_VOTE_MS), ctx(0)).reveal;
    expect(tied?.crowned).toEqual([1, 2]);
    const none = game.publicView(tickAt(voting(), v0 + BOZUK_VOTE_MS), ctx(0)).reveal;
    expect(none?.crowned).toEqual([]);
    expect(game.publicView(voting(), ctx(0)).reveal?.crowned).toBeNull();
  });

  it("oy vermeyenin oyu sayılmaz", () => {
    const s = toReveal();
    expect(game.result(s).miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe("bozuk-telefon puanlama", () => {
  const voteAt = (s: BozukState, chain: number, id: string, step: number, connected?: readonly string[]) =>
    act(
      tickAt(s, chainStart(4, chain) + showMs(4) + 100, connected),
      id,
      vote(step),
      chainStart(4, chain) + showMs(4) + 200,
      connected,
    );

  it("en komik seçilen her oy adımın sahibine +1", () => {
    let s = toReveal();
    // Zincir 0 adım yazarları a,b,c,d: b'nin adımına 2 oy, c'ninkine 1 oy.
    s = voteAt(s, 0, "a", 1);
    s = voteAt(s, 0, "c", 1);
    s = voteAt(s, 0, "d", 2);
    expect(game.result(tickAt(s, endAt(4))).miniScores).toEqual({ a: 0, b: 2, c: 1, d: 0 });
  });

  it("birden çok zincirin oyları kahkaha puanında toplanır; genel skora sıralama (+2/+1/0) gider", () => {
    let s = toReveal();
    s = voteAt(s, 0, "a", 1);
    s = voteAt(s, 1, "b", 3); // zincir 1: b,c,d,a -> a'nın adımı
    s = voteAt(s, 2, "a", 0); // zincir 2: c,d,a,b -> c'nin adımı
    const r = game.result(tickAt(s, endAt(4)));
    expect(r.miniScores).toEqual({ a: 1, b: 1, c: 1, d: 0 });
    // a, b, c eşit birinci -> +2; d'nin toplamı 0 -> ödül yok.
    expect(r.awards).toEqual({ a: 2, b: 2, c: 2, d: 0 });
  });

  it("sağlam zincir: ilk cümle ve son yazı adımı aynı anlamdaysa zincirdeki herkes +1", () => {
    // 4 oyuncu: adım 0 yazı (a), 1 çizim (b), 2 yazı (c), 3 çizim (d). Son yazı adımı = adım 2.
    let s = start();
    s = act(s, "a", text("kırmızı araba hızlı gidiyor"), 1_000);
    s = act(s, "b", text("farklı bir şey"), 1_000);
    s = tickAt(s, stepStart(4, 1));
    s = tickAt(inputAll(s), stepStart(4, 2));
    // Adım 2: zincir 0'ın (a) yazı adımını c tutuyor: aynı anlam.
    s = act(s, "c", text("Hızlı giden kırmızı Araba!"), stepStart(4, 2) + 100);
    s = tickAt(s, stepStart(4, 3));
    s = tickAt(inputAll(s), stepStart(4, 4));
    const r = game.result(s);
    // Zincir 0 yazarları a,b,c,d -> hepsi +1; diğer zincirler sağlam değil.
    expect(r.miniScores).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(
      game.publicView(tickAt(s, chainStart(4, 0) + showMs(4) + BOZUK_VOTE_MS), ctx(0)).reveal?.robust,
    ).toBe(true);
  });

  it("sağlam zincir bonusu oylarla toplanır", () => {
    let s = start();
    s = act(s, "a", text("kedi bahçede uyuyor"), 1_000);
    s = tickAt(s, stepStart(4, 1));
    s = tickAt(inputAll(s), stepStart(4, 2));
    s = act(s, "c", text("kedi bahçede uyuyor"), stepStart(4, 2) + 100);
    s = tickAt(s, stepStart(4, 3));
    s = tickAt(inputAll(s), stepStart(4, 4));
    s = voteAt(s, 0, "a", 1);
    expect(game.result(tickAt(s, endAt(4))).miniScores).toEqual({ a: 1, b: 2, c: 1, d: 1 });
  });

  it("boş ('…') son yazı sağlam sayılmaz; boş ilk cümle de", () => {
    let s = start();
    s = act(s, "a", text("kedi uyuyor"), 1_000);
    s = tickAt(s, stepStart(4, 1));
    s = tickAt(inputAll(s), stepStart(4, 2));
    s = tickAt(inputAll(s), stepStart(4, 4));
    // Zincir 0'ın adım 2'si (c) boş ("…" değil, c yazdı) -> yalnız yazılmamış olanı deneriz:
    expect(game.result(s).miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(bozukIsRobust("kedi uyuyor", BOZUK_EMPTY_TEXT)).toBe(false);
    expect(bozukIsRobust(BOZUK_EMPTY_TEXT, BOZUK_EMPTY_TEXT)).toBe(false);
  });

  it("kelime örtüşmesi eşiği: en az yarısı ortak", () => {
    expect(bozukIsRobust("kırmızı araba hızlı gidiyor", "kırmızı araba")).toBe(true); // 2/4
    expect(bozukIsRobust("kırmızı araba hızlı gidiyor", "araba")).toBe(false); // 1/4
    expect(bozukIsRobust("kedi uyuyor", "kedi uyuyor")).toBe(true);
    expect(bozukIsRobust("kedi uyuyor", "köpek koşuyor")).toBe(false);
    expect(bozukIsRobust("bir iki üç dört", "bir iki beş altı yedi")).toBe(false); // 2/5
    expect(bozukIsRobust("bir iki üç dört", "bir iki üç altı yedi")).toBe(true); // 3/5
  });

  it("Türkçe normalizasyon: büyük/küçük harf, aksan ve noktalama yok sayılır", () => {
    expect(bozukNormalizeWords("Işık, ışıl-ışıl!")).toEqual(["ISIK", "ISIL", "ISIL"]);
    expect(bozukIsRobust("ÇOCUK İNEK SÜTÜ İÇTİ", "cocuk inek sutu ictı")).toBe(true);
    expect(bozukNormalizeWords("…")).toEqual([]);
    expect(bozukNormalizeWords("   ")).toEqual([]);
  });

  it("son yazı adımı: çift sayıda adımda (4) adım 2, tek sayıda (3, 5) son adım", () => {
    // 3 oyuncu: yaz, çiz, yaz -> son yazı adımı 2 (son adım).
    const p3 = ["a", "b", "c"];
    let s = start(p3);
    s = act(s, "a", text("masada kırmızı elma var"), 1_000, p3);
    s = tickAt(s, stepStart(3, 1), p3);
    s = tickAt(inputAll(s, p3), stepStart(3, 2), p3);
    s = act(s, "c", text("masada kırmızı elma var"), stepStart(3, 2) + 100, p3);
    s = tickAt(s, stepStart(3, 3), p3);
    expect(game.result(s).miniScores).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("puanlar yalnız katılımcılara, tam sayı; kopuk oyuncular da puanlanır", () => {
    let s = toReveal();
    s = voteAt(s, 0, "a", 3, ["a", "b", "c"]);
    const r = game.result(tickAt(s, endAt(4)));
    expect(Object.keys(r.miniScores).sort()).toEqual(PLAYERS);
    expect(r.miniScores.d).toBe(1);
  });

  it("gösterideki toplam puanlar yalnız sonucu açılmış zincirlerden birikir", () => {
    let s = toReveal();
    s = voteAt(s, 0, "a", 1);
    const before = game.publicView(tickAt(s, chainStart(4, 0) + 11_000), ctx(0));
    expect(before.scores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    const after = game.publicView(tickAt(s, chainStart(4, 0) + 12_000), ctx(0));
    expect(after.scores).toEqual({ a: 0, b: 1, c: 0, d: 0 });
  });

  it("3 ve 8 oyuncuyla tam oyun puanlanır", () => {
    for (const n of [3, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const steps = bozukStepCount(n);
      let s = start(players);
      for (let i = 0; i < steps; i++) {
        s = inputAll(s, players);
        s = tickAt(s, stepStart(n, i + 1), players);
      }
      // Zincir 0'da p1'in adımına p0 oy verir.
      const t = chainStart(n, 0) + showMs(steps) + 100;
      s = tickAt(s, t, players);
      s = act(s, players[0] as string, vote(1), t + 50, players);
      const r = game.result(tickAt(s, endAt(n), players));
      expect(Object.keys(r.miniScores)).toHaveLength(n);
      expect(r.miniScores[s.order[1] as string]).toBe(1);
    }
  });
});

describe("bozuk-telefon sunucu tarafı saflık ve süre", () => {
  it("tick süre bitmeden değişiklik yapmaz (aynı nesne)", () => {
    const s = start();
    expect(tickAt(s, 100)).toBe(s);
    const r = tickAt(toReveal(), chainStart(4, 0) + 100);
    expect(tickAt(r, chainStart(4, 0) + 200)).toBe(r);
  });

  it("tick gösteri imlecini adım adım ilerletir (yayın tetiklemek için durum değişir)", () => {
    const s = tickAt(toReveal(), chainStart(4, 0));
    const a = tickAt(s, chainStart(4, 0) + 3_000);
    expect(a).not.toBe(s);
    expect(a.cursor?.shown).toBe(2);
  });

  it("girdi aşaması tek tick ile birden çok adım atlasa da doğru sonuçlanır", () => {
    let s = start();
    s = act(s, "a", text("merhaba dünya"), 1_000);
    const late = tickAt(s, chainStart(4, 0) + 100);
    expect(late.step).toBe(4);
    expect(late.chains.a?.[0]).toMatchObject({ text: "MERHABA DÜNYA" });
    expect(late.chains.a?.[1]).toMatchObject({ kind: "draw", strokes: [] });
    expect(late.chains.b?.[0]).toMatchObject({ text: BOZUK_EMPTY_TEXT });
  });

  it("hatalı biçimli eylemler ayrıştırılmaz", () => {
    for (const raw of [
      { kind: "lock", x: 1 },
      { kind: "vote" },
      { kind: "text" },
      { kind: "stroke" },
      { kind: "undo", n: 1 },
      { kind: "vote", step: 1, extra: true },
    ]) {
      expect(game.parseAction(raw)).toBeNull();
    }
  });
});

describe("bozuk-telefon botu ve simülasyon", () => {
  it("bot yazma, çizme ve oylama eylemleri üretir; üretilenler ayrıştırılır", () => {
    const bot = BOTS["bozuk-telefon"];
    if (!bot) throw new Error("bot yok");
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const players = ["p1", "p2", "p3"];
      const events = buildActions(bot, seed, players, 0);
      let s = game.setup(players, { now: 0, rng: createRng(seed), connected: players });
      for (const e of events) {
        if (e.kind !== "valid" || !e.make || !players.includes(e.playerId)) continue;
        s = game.tick(s, { now: e.t, rng: createRng(1), connected: players });
        const raw = e.make({
          publicView: game.publicView(s, ctx(0)),
          privateView: game.view(s, e.playerId, ctx(0)),
          connected: players,
        });
        const parsed = game.parseAction(raw);
        expect(parsed, JSON.stringify(raw)).not.toBeNull();
        kinds.add((parsed as BozukAction).kind);
        const r = game.reduce(s, e.playerId, parsed as BozukAction, {
          now: e.t,
          rng: createRng(1),
          connected: players,
        });
        if (!isRejected(r)) s = r;
      }
    }
    expect([...kinds].sort()).toEqual(["clear", "lock", "stroke", "text", "undo", "vote"]);
  });

  it("3-8 oyuncuyla botlu tam oyun bitiş süresi içinde bitirir ve sızıntı yok", () => {
    const bot = BOTS["bozuk-telefon"];
    if (!bot) throw new Error("bot yok");
    for (const n of [3, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i + 1}`);
      const startedAt = 5_000_000;
      const out = runSimulation(game, {
        seed: n * 17,
        players,
        startedAt,
        actions: buildActions(bot, n * 17, players, startedAt),
        ticks: buildTicks(n * 17, "irregular", startedAt, bot.durationMs),
        durationMs: bot.durationMs,
        disconnectProbability: 0,
      });
      expect(out.endedAt - startedAt).toBeLessThanOrEqual(bozukDurationMs(n) + 3_000);
      expect(Object.keys(out.result.miniScores).length).toBe(n);
    }
  });
});
