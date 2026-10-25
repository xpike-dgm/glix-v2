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
  BOZUK_VOTE_MS,
  BOZUK_WRITE_MS,
  type BozukAction,
  type BozukStep,
  bozukDurationMs,
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
const chainMs = (steps: number) => steps * BOZUK_SHOW_STEP_MS + BOZUK_VOTE_MS + BOZUK_RESULT_MS;
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
  it("3-8 oyuncu; yazma 25 sn, çizme 60 sn; ilk adım yazma", () => {
    expect(game.minPlayers).toBe(3);
    expect(game.maxPlayers).toBe(8);
    expect(BOZUK_WRITE_MS).toBe(25_000);
    expect(BOZUK_DRAW_MS).toBe(60_000);
    expect(BOZUK_SHOW_STEP_MS).toBe(3_000);
    expect(BOZUK_VOTE_MS).toBe(10_000);
    const s = start();
    expect(s.endAt).toEqual([T0 + 25_000]);
    expect(bozukStepKind(0)).toBe("write");
    expect(bozukStepKind(1)).toBe("draw");
    expect(bozukStepKind(2)).toBe("write");
    expect(game.publicView(s, ctx(0)).phase).toBe("write");
  });

  it("adım sayısı = oyuncu sayısı, en çok 6", () => {
    expect([3, 4, 5, 6, 7, 8].map(bozukStepCount)).toEqual([3, 4, 5, 6, 6, 6]);
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      expect(game.setup(players, ctx(0, players)).steps).toBe(bozukStepCount(n));
    }
  });

  it("3 oyuncuda yaz -> çiz -> yaz; 6 oyuncuda yaz, çiz, yaz, çiz, yaz, çiz", () => {
    expect([0, 1, 2].map(bozukStepKind)).toEqual(["write", "draw", "write"]);
    expect([0, 1, 2, 3, 4, 5].map(bozukStepKind)).toEqual([
      "write",
      "draw",
      "write",
      "draw",
      "write",
      "draw",
    ]);
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
    s = act(s, "a", text("ikinci cümle"), 20_000);
    s = tickAt(s, 25_000);
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
    expect(game.parseAction({ kind: "stroke", color: "kirmizi", size: 2, points: [0, 0, 1, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 4, points: [0, 0, 1, 5] })).toBeNull();
    expect(game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: [0, 0, 1.5, 5] })).toBeNull();
    expect(
      game.parseAction({ kind: "stroke", color: "eraser", size: 3, points: Array(240).fill(5) }),
    ).not.toBeNull();
    expect(
      game.parseAction({ kind: "stroke", color: "beyaz", size: 2, points: Array(242).fill(5) }),
    ).toBeNull();
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
    let s = tickAt(toReveal(), chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS + 100);
    s = act(s, "b", vote(2), chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS + 200);
    const pub = JSON.stringify(game.publicView(s, ctx(chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS + 200)));
    expect(pub).toContain('"voted":["b"]');
    expect(game.publicView(s, ctx(0)).reveal?.tally).toBeNull();
    for (const id of ["a", "c", "d"]) expect(game.view(s, id, ctx(0)).myVote).toBeNull();
    expect(game.view(s, "b", ctx(0)).myVote).toBe(2);
    expect(game.view(s, null, ctx(0)).myVote).toBeNull();
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
    expect(tickAt(s, 20_000).step).toBe(0);
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
    const v0 = chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS;
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
    const v0 = chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS;
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
  it("girdi bitince gösteri başlar: zincirler sırayla, her adım 3 sn", () => {
    const s = toReveal();
    expect(game.publicView(s, ctx(0)).phase).toBe("reveal");
    const c0 = chainStart(4, 0);
    const at = (ms: number) => game.publicView(tickAt(s, c0 + ms), ctx(0)).reveal;
    expect(at(0)?.stage).toBe("show");
    expect(at(0)?.shown).toBe(1);
    expect(at(0)?.chain).toBe(0);
    expect(at(0)?.starter).toBe("a");
    expect(at(2_999)?.shown).toBe(1);
    expect(at(3_000)?.shown).toBe(2);
    expect(at(6_000)?.shown).toBe(3);
    expect(at(9_000)?.shown).toBe(4);
    expect(at(11_999)?.shown).toBe(4);
    expect(at(12_000)?.stage).toBe("vote");
    expect(at(12_000)?.steps).toHaveLength(4);
    expect(at(22_000)?.stage).toBe("result");
    expect(at(25_000)?.chain).toBe(1);
    expect(at(25_000)?.shown).toBe(1);
  });

  it("gösteri adımları yazarlarıyla gelir ve zincirin sırasını korur", () => {
    const s = tickAt(toReveal(), chainStart(4, 1) + 20_000);
    const steps = game.publicView(s, ctx(0)).reveal?.steps as BozukStep[];
    expect(steps.map((x) => x.author)).toEqual(["b", "c", "d", "a"]);
    expect(steps.map((x) => x.kind)).toEqual(["write", "draw", "write", "draw"]);
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

  it("izleyici ve oyuncuların ortak görünümü aynıdır; yalnız oy/prompt özel", () => {
    const s = tickAt(toReveal(), chainStart(4, 0) + 100);
    expect(game.view(s, null, ctx(0))).toEqual(game.view(s, "a", ctx(0)));
  });

  it("gösteri hiç tick almadan da (reduce ile) doğru ilerler: oy kabul edilir", () => {
    // Yalnız son girdi adımının tick'i; sonrası yalnız eylem.
    const s = toReveal();
    const v0 = chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS;
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
  const v0 = chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS;
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
    const v1 = c1 + 4 * BOZUK_SHOW_STEP_MS + 100;
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
  });

  it("oy vermeyenin oyu sayılmaz", () => {
    const s = toReveal();
    expect(game.result(s).miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe("bozuk-telefon puanlama", () => {
  const voteAt = (s: BozukState, chain: number, id: string, step: number, connected?: readonly string[]) =>
    act(
      tickAt(s, chainStart(4, chain) + 4 * BOZUK_SHOW_STEP_MS + 100, connected),
      id,
      vote(step),
      chainStart(4, chain) + 4 * BOZUK_SHOW_STEP_MS + 200,
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

  it("birden çok zincirin oyları toplanır; awards = miniScores", () => {
    let s = toReveal();
    s = voteAt(s, 0, "a", 1);
    s = voteAt(s, 1, "b", 3); // zincir 1: b,c,d,a -> a'nın adımı
    s = voteAt(s, 2, "a", 0); // zincir 2: c,d,a,b -> c'nin adımı
    const r = game.result(tickAt(s, endAt(4)));
    expect(r.miniScores).toEqual({ a: 1, b: 1, c: 1, d: 0 });
    expect(r.awards).toEqual(r.miniScores);
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
      game.publicView(tickAt(s, chainStart(4, 0) + 4 * BOZUK_SHOW_STEP_MS + BOZUK_VOTE_MS), ctx(0)).reveal
        ?.robust,
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
    const before = game.publicView(tickAt(s, chainStart(4, 0) + 20_000), ctx(0));
    expect(before.scores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    const after = game.publicView(tickAt(s, chainStart(4, 0) + 22_000), ctx(0));
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
      const t = chainStart(n, 0) + steps * BOZUK_SHOW_STEP_MS + 100;
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
