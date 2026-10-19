import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { replay } from "../../replay.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/invariants.js";
import { runSimulation } from "../../testing/simulate.js";
import { type CagrisimAgiState, cagrisimAgi, groupAnswers, normalizeAnswer } from "./index.js";
import { CAGRISIM_ANSWER_MS, CAGRISIM_REVEAL_MS, CAGRISIM_TOTAL_MS } from "./types.js";
import { CAGRISIM_WORDS } from "./words.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
const ctx = (now: number, connected: readonly string[] = PLAYERS, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players = PLAYERS, seed = 1): CagrisimAgiState =>
  cagrisimAgi.setup(players, ctx(T0, players, seed));

function answer(state: CagrisimAgiState, id: string, text: string, at = 1_000): CagrisimAgiState {
  const r = cagrisimAgi.reduce(state, id, { kind: "answer", text }, ctx(T0 + at));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (state: CagrisimAgiState, id: string, text: string, at = 1_000) => {
  const r = cagrisimAgi.reduce(state, id, { kind: "answer", text }, ctx(T0 + at));
  return isRejected(r) ? r.rejected : null;
};
const tickAt = (s: CagrisimAgiState, at: number) => cagrisimAgi.tick(s, ctx(T0 + at));

describe("cagrisim-agi kuralları", () => {
  it("2-8 oyuncu, 30 sn cevap + kısa açılış; ana kelime havuzdan, rng ile belirli", () => {
    expect(cagrisimAgi.minPlayers).toBe(2);
    expect(cagrisimAgi.maxPlayers).toBe(8);
    const s = start();
    expect(s.answerEndsAt - s.startedAt).toBe(30_000);
    expect(s.endsAt - s.startedAt).toBe(CAGRISIM_TOTAL_MS);
    expect(CAGRISIM_WORDS).toContain(s.word);
    expect(start(PLAYERS, 1).word).toBe(s.word);
    const words = new Set(Array.from({ length: 40 }, (_, i) => start(PLAYERS, i + 1).word));
    expect(words.size).toBeGreaterThan(10);
  });

  it("herkes aynı ana kelimeyi görür (publicView), kelime havuzda büyük harf", () => {
    const s = start();
    expect(cagrisimAgi.publicView(s, ctx(T0)).word).toBe(s.word);
    expect(s.word).toBe(s.word.toLocaleUpperCase("tr"));
  });

  it("normalleştirme: Türkçe küçük harf, kırpma, iç boşluk teke iner", () => {
    expect(normalizeAnswer("  IŞIK ")).toBe("ışık");
    expect(normalizeAnswer("İSTANBUL")).toBe("istanbul");
    expect(normalizeAnswer("deniz   kenarı\t")).toBe("deniz kenarı");
    expect(normalizeAnswer("ISPARTA")).toBe("ısparta");
  });

  it("aynı normalleştirilmiş cevap grup olur; üyeler grup büyüklüğü kadar puan alır", () => {
    let s = start();
    s = answer(s, "a", "Işık");
    s = answer(s, "b", "  IŞIK  ");
    s = answer(s, "c", "ışık");
    s = answer(s, "d", "karanlık");
    const r = cagrisimAgi.result(s);
    expect(r.miniScores).toEqual({ a: 3, b: 3, c: 3, d: 0 });
    // Genel skor: eşit liderler +1, grup kuramayan 0.
    expect(r.awards).toEqual({ a: 1, b: 1, c: 1 });
  });

  it("iki ayrı grup birlikte puanlanır; gruplar büyükten küçüğe sıralanır", () => {
    let s = start(["a", "b", "c", "d", "e", "f"]);
    s = answer(s, "a", "mavi");
    s = answer(s, "b", "kırmızı");
    s = answer(s, "c", "Mavi");
    s = answer(s, "d", "kırmızı");
    s = answer(s, "e", "mavi");
    s = answer(s, "f", "yeşil");
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 3, b: 2, c: 3, d: 2, e: 3, f: 0 });
    // Eşit liderler (3) +1; ikinci sıradakiler ödül almaz (lider eşitliğinde yalnız liderler).
    expect(cagrisimAgi.result(s).awards).toEqual({ a: 1, c: 1, e: 1 });
    const reveal = groupAnswers(s.players, s.answers);
    expect(reveal.groups.map((g) => [g.text, g.members])).toEqual([
      ["mavi", ["a", "c", "e"]],
      ["kırmızı", ["b", "d"]],
    ]);
    expect(reveal.singles).toEqual([{ playerId: "f", text: "yeşil" }]);
  });

  it("tek kalan cevap 0, cevap vermeyen 0, negatif puan yok", () => {
    let s = start();
    s = answer(s, "a", "x1y");
    s = answer(s, "b", "x2y");
    const r = cagrisimAgi.result(s);
    expect(r.miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(Math.min(...Object.values(r.miniScores))).toBeGreaterThanOrEqual(0);
  });

  it("kimse cevap vermezse herkes 0", () => {
    const s = tickAt(start(), CAGRISIM_TOTAL_MS);
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(cagrisimAgi.result(s).awards).toEqual({});
  });

  it("iki kişilik oyunda aynı cevap iki oyuncuya 2 puan verir", () => {
    let s = start(["a", "b"]);
    s = answer(s, "a", "deniz");
    s = answer(s, "b", "DENİZ");
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 2, b: 2 });
  });

  it("sekiz kişi aynı cevabı verirse herkes 8 alır", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    let s = start(ids);
    for (const id of ids) s = answer(s, id, "yaz");
    expect(Object.values(cagrisimAgi.result(s).miniScores)).toEqual(Array(8).fill(8));
  });

  it("birden fazla cevap gönderilemez; ilk cevap kalır", () => {
    let s = start();
    s = answer(s, "a", "mavi");
    expect(rejection(s, "a", "kırmızı")).toBe("already_answered");
    expect(rejection(s, "a", "mavi")).toBe("already_answered");
    expect(s.answers.a).toBe("mavi");
  });

  it("boş ve yalnız boşluktan oluşan cevap reddedilir (ve hak harcanmaz)", () => {
    let s = start();
    expect(rejection(s, "a", "")).toBe("empty");
    expect(rejection(s, "a", " \t  ")).toBe("empty");
    s = answer(s, "a", "mavi");
    expect(s.answers.a).toBe("mavi");
  });

  it("parseAction: tür/şekil doğrulanır, 60 karakter teknik sınır, kırpılır", () => {
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "  mavi " })).toEqual({
      kind: "answer",
      text: "mavi",
    });
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "x".repeat(60) })).not.toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "x".repeat(61) })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: 5 })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer" })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "a", extra: 1 })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "press" })).toBeNull();
    expect(cagrisimAgi.parseAction(["answer", "a"])).toBeNull();
  });

  it("katılımcı olmayan oyuncunun cevabı reddedilir", () => {
    expect(rejection(start(), "ghost", "mavi")).toBe("not_participant");
    expect(rejection(start(), "__proto__", "mavi")).toBe("not_participant");
  });

  it("süre bitiminde (30. sn) ve sonrasında cevap reddedilir; bitimden hemen önce kabul edilir", () => {
    const s = start();
    expect(rejection(s, "a", "mavi", CAGRISIM_ANSWER_MS - 1)).toBeNull();
    expect(rejection(s, "a", "mavi", CAGRISIM_ANSWER_MS)).toBe("ended");
    expect(rejection(s, "a", "mavi", CAGRISIM_TOTAL_MS + 5_000)).toBe("ended");
  });

  it("tick henüz tick'lenmemiş olsa bile süre dolunca eylem reddedilir (tick takvimine bağlı değil)", () => {
    const s = start();
    expect(s.revealed).toBe(false);
    expect(rejection(s, "b", "mavi", CAGRISIM_ANSWER_MS + 1)).toBe("ended");
  });

  it("cevaplayamayan (bağlantısı kopuk) oyuncu 0 alır; bağlı olmayan olarak da cevap verebilir", () => {
    let s = start();
    const r = cagrisimAgi.reduce(s, "a", { kind: "answer", text: "mavi" }, ctx(T0 + 500, ["b", "c", "d"]));
    expect(isRejected(r)).toBe(false);
    s = answer(s, "b", "mavi");
    s = answer(s, "c", "mavi");
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 0, b: 2, c: 2, d: 0 });
  });

  it("cevap süresince cevaplar hiçbir görünümde yoktur; yalnız kimin cevapladığı görünür", () => {
    let s = start();
    s = answer(s, "a", "gizlicevap");
    s = answer(s, "b", "gizlicevap");
    const pub = JSON.stringify(cagrisimAgi.publicView(s, ctx(T0 + 2_000)));
    expect(pub).not.toContain("gizlicevap");
    expect(cagrisimAgi.publicView(s, ctx(T0)).phase).toBe("answer");
    expect(cagrisimAgi.publicView(s, ctx(T0)).reveal).toBeNull();
    expect(cagrisimAgi.publicView(s, ctx(T0)).answeredIds).toEqual(["a", "b"]);
    expect(cagrisimAgi.view(s, "a", ctx(T0)).myAnswer).toBe("gizlicevap");
    expect(cagrisimAgi.view(s, "c", ctx(T0)).myAnswer).toBeNull();
    expect(cagrisimAgi.view(s, null, ctx(T0)).myAnswer).toBeNull();
    expect(findLeaks(cagrisimAgi, s, PLAYERS, T0 + 2_000)).toEqual([]);
  });

  it("gizli bilgi: her cevap secrets()'ta, sahibi kendisi (kısa cevaplar hariç)", () => {
    let s = start();
    s = answer(s, "a", "gizlicevap");
    s = answer(s, "b", "ab");
    const secrets = cagrisimAgi.secrets(s);
    expect(secrets).toEqual([{ ownerIds: ["a"], value: "gizlicevap", label: "a cevabı" }]);
  });

  it("başka oyuncunun cevabını içeren daha uzun cevap sahibi de hak sahibidir (sızıntı denetimi doğru)", () => {
    let s = start();
    s = answer(s, "a", "deniz");
    s = answer(s, "b", "mavi deniz");
    const secret = cagrisimAgi.secrets(s).find((e) => e.value === "deniz");
    expect(secret?.ownerIds).toEqual(["a", "b"]);
    expect(findLeaks(cagrisimAgi, s, PLAYERS, T0 + 3_000)).toEqual([]);
  });

  it("çok kısa cevaplar (<3 karakter) yapısal olarak gizli: başkasının görünümünde ve herkese açık görünümde yok", () => {
    let s = start();
    s = answer(s, "a", "ZZ");
    s = answer(s, "b", "q");
    const pubKeys = Object.keys(cagrisimAgi.publicView(s, ctx(T0))).sort();
    expect(pubKeys).toEqual([
      "answerEndsAt",
      "answeredIds",
      "endsAt",
      "phase",
      "reveal",
      "startedAt",
      "word",
    ]);
    const pub = cagrisimAgi.publicView(s, ctx(T0));
    expect(pub.reveal).toBeNull();
    expect(JSON.stringify(pub)).not.toMatch(/ZZ|"q"/);
    for (const viewer of ["b", "c", "d", null]) {
      const v = cagrisimAgi.view(s, viewer, ctx(T0));
      if (viewer === "b") expect(v.myAnswer).toBe("q");
      else expect(v.myAnswer).toBeNull();
      if (viewer !== "a") expect(JSON.stringify(v)).not.toContain("ZZ");
    }
  });

  it("süre dolunca tick cevapları açar: gruplar, tekler ve susanlar herkese açık görünümde", () => {
    let s = start();
    s = answer(s, "a", "Mavi");
    s = answer(s, "b", "mavi");
    s = answer(s, "c", "kırmızı");
    expect(cagrisimAgi.tick(s, ctx(T0 + CAGRISIM_ANSWER_MS - 1))).toBe(s);
    const t = tickAt(s, CAGRISIM_ANSWER_MS);
    const pub = cagrisimAgi.publicView(t, ctx(T0 + CAGRISIM_ANSWER_MS));
    expect(pub.phase).toBe("reveal");
    expect(pub.reveal).toEqual({
      groups: [{ text: "mavi", members: ["a", "b"], points: 2 }],
      singles: [{ playerId: "c", text: "kırmızı" }],
      silent: ["d"],
    });
    expect(cagrisimAgi.secrets(t)).toEqual([]);
    expect(tickAt(t, CAGRISIM_ANSWER_MS + 100)).toBe(t);
  });

  it("açılış bölümü sonunda oyun biter; ondan önce bitmez", () => {
    const s = start();
    expect(cagrisimAgi.isFinished(s, ctx(T0 + CAGRISIM_TOTAL_MS - 1))).toBe(false);
    expect(cagrisimAgi.isFinished(s, ctx(T0 + CAGRISIM_TOTAL_MS))).toBe(true);
  });

  it("açılıştan sonra eylem reddedilir ve sonuç değişmez", () => {
    let s = start();
    s = answer(s, "a", "mavi");
    const t = tickAt(s, CAGRISIM_ANSWER_MS + 10);
    expect(rejection(t, "b", "mavi", CAGRISIM_ANSWER_MS + 20)).toBe("ended");
    expect(cagrisimAgi.result(t)).toEqual(cagrisimAgi.result(s));
  });

  it("tam simülasyon: sonuç, kayıttan tekrar oynatmayla aynı; ödüller mini puanlara eşit", () => {
    const players = ["p1", "p2", "p3"];
    const actions = [
      { t: T0 + 1_000, playerId: "p1", raw: { kind: "answer", text: "Mavi" }, kind: "valid" as const },
      { t: T0 + 2_000, playerId: "p2", raw: { kind: "answer", text: "mavi " }, kind: "valid" as const },
      { t: T0 + 3_000, playerId: "p3", raw: { kind: "answer", text: "kırmızı" }, kind: "valid" as const },
    ];
    const out = runSimulation(cagrisimAgi, {
      seed: 7,
      players,
      startedAt: T0,
      actions,
      ticks: [T0 + 10_000, T0 + 31_000, T0 + 40_000],
      durationMs: CAGRISIM_TOTAL_MS,
      disconnectProbability: 0,
    });
    expect(out.result.miniScores).toEqual({ p1: 2, p2: 2, p3: 0 });
    expect(out.result.awards).toEqual({ p1: 1, p2: 1 });
    expect(replay(cagrisimAgi, out.log)).toEqual(out.result);
  });
});

describe("cagrisim-agi erken bitiş (cevap göndermek kilittir)", () => {
  const ans = (s: CagrisimAgiState, id: string, text: string, at: number, connected: readonly string[]) => {
    const r = cagrisimAgi.reduce(s, id, { kind: "answer", text }, ctx(T0 + at, connected));
    if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
    return r;
  };

  it("(a) herkes cevaplayınca cevap aşaması 1 sn sonra biter", () => {
    let s = start(["a", "b", "c"]);
    const all = ["a", "b", "c"];
    s = ans(s, "a", "deniz", 2_000, all);
    s = ans(s, "b", "deniz", 3_000, all);
    s = ans(s, "c", "kum", 4_000, all);
    expect(s.answerEndsAt).toBe(T0 + 5_000);
    expect(cagrisimAgi.publicView(tickAt(s, 4_999), ctx(T0 + 4_999)).phase).toBe("answer");
    const opened = cagrisimAgi.publicView(tickAt(s, 5_000), ctx(T0 + 5_000));
    expect(opened.phase).toBe("reveal");
    expect(opened.reveal?.groups[0]?.members).toEqual(["a", "b"]);
    expect(cagrisimAgi.isFinished(s, ctx(T0 + 4_999 + CAGRISIM_REVEAL_MS))).toBe(false);
    expect(cagrisimAgi.isFinished(s, ctx(T0 + 5_000 + CAGRISIM_REVEAL_MS))).toBe(true);
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 2, b: 2, c: 0 });
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start(["a", "b", "c"]);
    const all = ["a", "b", "c"];
    s = ans(ans(s, "a", "x1", 2_000, all), "b", "x2", 3_000, all);
    expect(s.answerEndsAt).toBe(T0 + CAGRISIM_ANSWER_MS);
    expect(cagrisimAgi.isFinished(s, ctx(T0 + 10_000))).toBe(false);
    expect(tickAt(s, 10_000)).toBe(s);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    let s = start(["a", "b", "c"]);
    const online = ["a", "b"];
    s = ans(s, "a", "ay", 2_000, online);
    expect(s.answerEndsAt).toBe(T0 + CAGRISIM_ANSWER_MS);
    s = ans(s, "b", "ay", 3_000, online);
    expect(s.answerEndsAt).toBe(T0 + 4_000);
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 2, b: 2, c: 0 });
  });

  it("(d) cevap kesindir: ikinci cevap reddedilir; bitişten sonra da reddedilir", () => {
    let s = start(["a", "b"]);
    s = ans(s, "a", "ilk", 2_000, ["a", "b"]);
    expect(rejection(s, "a", "ikinci", 2_500)).toBe("already_answered");
    s = ans(s, "b", "bir", 3_000, ["a", "b"]);
    expect(rejection(s, "a", "yine", 4_000)).toBe("ended");
  });

  it("(e) cevap bekleme sırasında yalnız kimlerin cevapladığı görünür, metin sızmaz", () => {
    let s = start(["a", "b", "c"]);
    s = ans(s, "a", "gizlikelime", 2_000, ["a", "b", "c"]);
    const pub = JSON.stringify(cagrisimAgi.publicView(s, ctx(T0 + 2_500)));
    expect(pub).not.toContain("gizlikelime");
    expect(cagrisimAgi.publicView(s, ctx(T0 + 2_500)).answeredIds).toEqual(["a"]);
    expect(JSON.stringify(cagrisimAgi.view(s, "b", ctx(T0 + 2_500)))).not.toContain("gizlikelime");
    expect(findLeaks(cagrisimAgi, s, ["a", "b", "c"], T0 + 2_500)).toEqual([]);
  });
});
