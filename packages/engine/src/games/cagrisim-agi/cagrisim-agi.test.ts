import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { replay } from "../../replay.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/invariants.js";
import { runSimulation } from "../../testing/simulate.js";
import {
  CAGRISIM_POOL,
  type CagrisimAgiState,
  type CagrisimWord,
  cagrisimAgi,
  groupAnswers,
  matchKey,
  normalizeAnswer,
  oneLetterApart,
} from "./index.js";
import {
  CAGRISIM_ANSWER_MS,
  CAGRISIM_CONTENT_MEMORY,
  CAGRISIM_FINAL_MS,
  CAGRISIM_MINI_MS,
  CAGRISIM_TOTAL_MS,
  cagrisimAwards,
} from "./types.js";
import { CAGRISIM_ENTRIES, CAGRISIM_WORDS } from "./words.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
/** Kelime r'nin cevap aşamasının başı (erken bitiş yoksa). */
const ROUND = (r: number) => r * (CAGRISIM_ANSWER_MS + CAGRISIM_MINI_MS);
const ctx = (now: number, connected: readonly string[] = PLAYERS, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players = PLAYERS, seed = 1): CagrisimAgiState =>
  cagrisimAgi.setup(players, ctx(T0, players, seed));

function answer(
  state: CagrisimAgiState,
  id: string,
  text: string,
  at = 1_000,
  connected: readonly string[] = PLAYERS,
): CagrisimAgiState {
  const r = cagrisimAgi.reduce(state, id, { kind: "answer", text }, ctx(T0 + at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const rejection = (state: CagrisimAgiState, id: string, text: string, at = 1_000) => {
  const r = cagrisimAgi.reduce(state, id, { kind: "answer", text }, ctx(T0 + at));
  return isRejected(r) ? r.rejected : null;
};
const tickAt = (s: CagrisimAgiState, at: number) => cagrisimAgi.tick(s, ctx(T0 + at));
const pubAt = (s: CagrisimAgiState, at: number) => cagrisimAgi.publicView(s, ctx(T0 + at));

/** Üç kelimeyi verilen cevaplarla oynar (kelime başına oyuncu -> cevap). */
function playSeries(players: string[], rounds: Record<string, string>[]): CagrisimAgiState {
  let s = start(players);
  rounds.forEach((answers, r) => {
    s = tickAt(s, ROUND(r));
    for (const [id, text] of Object.entries(answers)) s = answer(s, id, text, ROUND(r) + 500, players);
  });
  return tickAt(s, CAGRISIM_TOTAL_MS);
}

describe("cagrisim-agi eşleşme (CG-M3)", () => {
  it("boşluk ve tire yok sayılır", () => {
    expect(matchKey("deniz kenarı")).toBe(matchKey("denizkenarı"));
    expect(matchKey("deniz-kenarı")).toBe(matchKey("Deniz  Kenari"));
  });

  it("çoğul eki atılır; kök 3 harften kısa kalırsa dokunulmaz", () => {
    expect(matchKey("dalgalar")).toBe(matchKey("dalga"));
    expect(matchKey("BALIKLAR")).toBe(matchKey("balık"));
    expect(matchKey("dolar")).toBe("dolar");
    expect(matchKey("kiler")).toBe("kiler");
    expect(matchKey("güller")).toBe(matchKey("gül"));
  });

  it("tek harf farkı yalnız 6+ harfte ve aynı uzunlukta", () => {
    expect(oneLetterApart("kumsal", "kumsak")).toBe(true);
    expect(oneLetterApart("kumsal", "kumsal")).toBe(false);
    expect(oneLetterApart("kumsal", "kumsaal")).toBe(false);
    expect(oneLetterApart("dalga", "dalgo")).toBe(false);
    expect(oneLetterApart("kumsal", "kumsek")).toBe(false);
  });

  it("tek kalan, tek harf uzaktaki en büyük kümeye katılır; gösterilen yazılış kümeninki", () => {
    const r = groupAnswers(["a", "b", "c", "d"], { a: "kumsal", b: "Kumsal", c: "kumsak", d: "deniz" });
    expect(r.groups).toEqual([
      { text: "kumsal", members: ["a", "b", "c"], points: 3, variants: ["kumsal", "kumsak"] },
    ]);
    expect(r.singles).toEqual([{ playerId: "d", text: "deniz" }]);
  });

  it("zincirleme yok: A~B ve B~C diye A ile C birleşmez", () => {
    // gemici ~ gemiri ~ gemari (her biri bir öncekine bir harf uzak; gemici ile gemari iki harf).
    const r = groupAnswers(["a", "b", "c", "d"], { a: "gemiri", b: "gemiri", c: "gemici", d: "gemari" });
    // En büyük küme (gemiri, 2) ikisini de doğrudan alır: ikisi de ona bir harf uzak.
    expect(r.groups[0]?.members).toEqual(["a", "b", "c", "d"]);
    const chain = groupAnswers(["a", "b", "c", "d", "e"], {
      a: "gemici",
      b: "gemici",
      c: "gemiri",
      d: "gamiri",
      e: "gamiri",
    });
    // gemiri iki büyük kümeye de yakın; eşit büyüklükteki kümeler birbirine iki harf uzak: biri gemiriyi alır.
    expect(chain.groups.map((g) => g.points).sort()).toEqual([2, 3]);
    expect(chain.groups[0]?.members).toEqual(["a", "b", "c"]);
  });

  it("eşit büyüklükte iki küme bir harf uzaksa birleşir; yazılış ilk cevap verenin kümesinden", () => {
    const r = groupAnswers(["a", "b", "c", "d"], { a: "kumsak", b: "kumsak", c: "kumsal", d: "kumsal" }, [
      "c",
      "a",
      "d",
      "b",
    ]);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.text).toBe("kumsal");
    expect(r.groups[0]?.points).toBe(4);
  });

  it("oyuncunun yazdığı biçim gösterilir (küçük harfe çevrilmez); Türkçe harfli yazılış öne geçer", () => {
    const r = groupAnswers(["a", "b", "c"], { a: "Izmir", b: "İzmir", c: "  İzmir " });
    expect(r.groups[0]?.text).toBe("İzmir");
    const s = groupAnswers(["a", "b"], { a: "Ördek  Gölü", b: "x" });
    expect(s.singles[0]?.text).toBe("Ördek Gölü");
    expect(normalizeAnswer("  IŞIK ")).toBe("ışık");
  });

  it("anlamca eş cevaplar birleşmez", () => {
    expect(groupAnswers(["a", "b"], { a: "araba", b: "otomobil" }).groups).toEqual([]);
  });
});

describe("cagrisim-agi genel skor (CG-M1)", () => {
  it("en büyük ağ(lar) +2, sonraki +1, tek kalan ve yazmayan 0", () => {
    expect(cagrisimAwards({ a: 3, b: 3, c: 3, d: 2, e: 2, f: 0 })).toEqual({
      a: 2,
      b: 2,
      c: 2,
      d: 1,
      e: 1,
      f: 0,
    });
  });
  it("aynı büyüklükte iki ağ ve dışarıda kalan varsa ağdakiler +2", () => {
    expect(cagrisimAwards({ a: 3, b: 3, c: 3, d: 3, e: 3, f: 3, g: 0, h: 0 })).toMatchObject({
      a: 2,
      f: 2,
      g: 0,
    });
  });
  it("herkes aynı puandaysa herkes +1; kimse ağ kurmadıysa kimse", () => {
    expect(cagrisimAwards({ a: 4, b: 4, c: 4, d: 4 })).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(cagrisimAwards({ a: 2, b: 2 })).toEqual({ a: 1, b: 1 });
    expect(cagrisimAwards({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe("cagrisim-agi üç kelimelik seri (CG-M2, CG-M5)", () => {
  it("2-8 oyuncu; üç farklı kelime, kolaydan zora; 20 sn cevap", () => {
    expect(cagrisimAgi.minPlayers).toBe(2);
    expect(cagrisimAgi.maxPlayers).toBe(8);
    const s = start();
    expect(s.words).toHaveLength(3);
    expect(s.words.map((w) => w.level)).toEqual(["kolay", "orta", "zor"]);
    expect(new Set(s.words.map((w) => w.key)).size).toBe(3);
    for (const w of s.words) expect(CAGRISIM_WORDS).toContain(w.text);
    expect(s.answerEndsAt - s.startedAt).toBe(20_000);
    expect(CAGRISIM_TOTAL_MS).toBe(76_000);
    expect(start(PLAYERS, 1).words).toEqual(s.words);
    const seen = new Set(Array.from({ length: 40 }, (_, i) => start(PLAYERS, i + 1).words[0]?.text));
    expect(seen.size).toBeGreaterThan(10);
  });

  it("yerleşik havuzda her zorlukta en az 60 kelime", () => {
    for (const level of ["kolay", "orta", "zor"])
      expect(CAGRISIM_ENTRIES.filter((e) => e.level === level).length).toBeGreaterThanOrEqual(60);
  });

  it("bir zorlukta kelime yoksa komşudan çekilir; etiketsiz kelime orta sayılır", () => {
    const mk = (text: string, level: CagrisimWord["level"]) => ({ text, level });
    const pool = [
      ...Array.from({ length: 8 }, (_, i) => mk(`ORTA${"ABCDEFGH"[i]}`, null)),
      mk("KOLAYA", "kolay"),
      mk("KOLAYB", "kolay"),
    ];
    const s = cagrisimAgi.setup(PLAYERS, { ...ctx(T0), content: { [CAGRISIM_POOL.id]: pool } });
    expect(s.words[0]?.level).toBe("kolay");
    expect(s.words[1]?.level).toBe("orta");
    // Zor yok: ortadan çekilir.
    expect(s.words[2]?.level).toBe("orta");
    expect(new Set(s.words.map((w) => w.text)).size).toBe(3);
    // Eski (düz metin) kayıtlar da okunur.
    const legacy = Array.from({ length: 10 }, (_, i) => `ESKİ${"ABCDEFGHIJ"[i]}`);
    const t = cagrisimAgi.setup(PLAYERS, { ...ctx(T0), content: { [CAGRISIM_POOL.id]: legacy } });
    expect(t.words.every((w) => w.level === "orta")).toBe(true);
  });

  it("akış: kelime → 4 sn mini açılış → sonraki kelime; üçüncüden sonra büyük açılış", () => {
    let s = start();
    s = answer(s, "a", "beyaz");
    s = answer(s, "b", "beyaz");
    expect(pubAt(s, 1_000).phase).toBe("answer");
    s = tickAt(s, CAGRISIM_ANSWER_MS);
    let p = pubAt(s, CAGRISIM_ANSWER_MS);
    expect(p.phase).toBe("mini");
    expect(p.results).toHaveLength(1);
    expect(p.results[0]?.reveal.groups[0]?.members).toEqual(["a", "b"]);
    expect(p.totals).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    expect(p.awards).toBeNull();
    expect(p.revealEndsAt).toBe(T0 + CAGRISIM_ANSWER_MS + CAGRISIM_MINI_MS);
    expect(rejection(s, "c", "geç", CAGRISIM_ANSWER_MS + 100)).toBe("ended");
    // Mini açılış sürerken sıradaki kelime gelmez.
    expect(tickAt(s, ROUND(1) - 1)).toBe(s);
    s = tickAt(s, ROUND(1));
    p = pubAt(s, ROUND(1));
    expect(p.phase).toBe("answer");
    expect(p.round).toBe(1);
    expect(p.word).toBe(s.words[1]?.text);
    expect(p.answeredIds).toEqual([]);
    expect(cagrisimAgi.view(s, "a", ctx(T0)).myAnswer).toBeNull();
    s = answer(s, "c", "mavi", ROUND(1) + 1_000);
    s = tickAt(s, ROUND(2));
    expect(pubAt(s, ROUND(2)).round).toBe(2);
    expect(cagrisimAgi.revealAt?.(s, ctx(T0 + ROUND(2)))).toBe(T0 + ROUND(2) + CAGRISIM_ANSWER_MS);
    s = tickAt(s, ROUND(2) + CAGRISIM_ANSWER_MS);
    p = pubAt(s, ROUND(2) + CAGRISIM_ANSWER_MS);
    expect(p.phase).toBe("final");
    expect(p.results).toHaveLength(3);
    expect(p.awards).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    expect(cagrisimAgi.isFinished(s, ctx(T0 + CAGRISIM_TOTAL_MS - 1))).toBe(false);
    expect(cagrisimAgi.isFinished(s, ctx(T0 + CAGRISIM_TOTAL_MS))).toBe(true);
  });

  it("revealAt yalnız son kelimede belli olur", () => {
    expect(cagrisimAgi.revealAt?.(start(), ctx(T0))).toBeNull();
  });

  it("tick gecikse bile geçiş anları değişmez (tek tick ile sona atlanır)", () => {
    const s = tickAt(start(), CAGRISIM_TOTAL_MS + 5_000);
    expect(s.phase).toBe("final");
    expect(s.round).toBe(2);
    expect(s.roundStartedAt).toBe(T0 + ROUND(2));
  });

  it("ağ puanları üç kelimede toplanır; ödül toplam üzerinden", () => {
    const s = playSeries(
      ["a", "b", "c", "d"],
      [
        { a: "kış", b: "KIŞ", c: "beyaz", d: "beyaz" },
        { a: "bal", b: "bal", c: "bal" },
        { a: "x1", b: "y1" },
      ],
    );
    const r = cagrisimAgi.result(s);
    expect(r.miniScores).toEqual({ a: 5, b: 5, c: 5, d: 2 });
    expect(r.awards).toEqual({ a: 2, b: 2, c: 2, d: 1 });
    expect(pubAt(s, CAGRISIM_TOTAL_MS).totals).toEqual(r.miniScores);
  });

  it("herkes tek ağdaysa herkes +1; yazmayan bir kelimede 0 alır, sonrakinde oynar", () => {
    const s = playSeries(["a", "b"], [{ a: "kar", b: "kar" }, { a: "arı" }, { a: "bal", b: "BAL" }]);
    expect(cagrisimAgi.result(s).miniScores).toEqual({ a: 4, b: 4 });
    expect(cagrisimAgi.result(s).awards).toEqual({ a: 1, b: 1 });
  });

  it("erken bitiş her kelimede ayrı: bağlı herkes gönderince 1 sn sonra mini açılış, takvim öne gelir", () => {
    const all = ["a", "b", "c"];
    let s = start(all);
    s = answer(s, "a", "deniz", 2_000, all);
    s = answer(s, "b", "deniz", 3_000, all);
    expect(s.answerEndsAt).toBe(T0 + CAGRISIM_ANSWER_MS);
    s = answer(s, "c", "kum", 4_000, all);
    expect(s.answerEndsAt).toBe(T0 + 5_000);
    expect(pubAt(tickAt(s, 4_999), 4_999).phase).toBe("answer");
    s = tickAt(s, 5_000);
    expect(s.phase).toBe("mini");
    expect(pubAt(s, 5_000).endsAt).toBe(T0 + CAGRISIM_TOTAL_MS - 15_000);
    s = tickAt(s, 5_000 + CAGRISIM_MINI_MS);
    expect(s.round).toBe(1);
    expect(s.roundStartedAt).toBe(T0 + 9_000);
    expect(s.answerEndsAt).toBe(T0 + 29_000);
    expect(cagrisimAgi.nextWake?.(s, ctx(T0 + 9_000))).toBe(T0 + 29_000);
  });

  it("bir kişi eksikken bitmez; bağlantısı kopan beklenmez", () => {
    let s = start(["a", "b", "c"]);
    s = answer(s, "a", "x1", 2_000, ["a", "b", "c"]);
    s = answer(s, "b", "x2", 3_000, ["a", "b", "c"]);
    expect(s.answerEndsAt).toBe(T0 + CAGRISIM_ANSWER_MS);
    let t = start(["a", "b", "c"]);
    t = answer(t, "a", "ay", 2_000, ["a", "b"]);
    t = answer(t, "b", "ay", 3_000, ["a", "b"]);
    expect(t.answerEndsAt).toBe(T0 + 4_000);
  });
});

describe("cagrisim-agi eylemler", () => {
  it("bir kelimede birden fazla cevap gönderilemez; ilk cevap kalır", () => {
    let s = start();
    s = answer(s, "a", "mavi");
    expect(rejection(s, "a", "kırmızı")).toBe("already_answered");
    expect(s.answers[0]?.a).toBe("mavi");
  });

  it("boş, yalnız boşluk ve yalnız noktalama reddedilir (hak harcanmaz)", () => {
    let s = start();
    expect(rejection(s, "a", "")).toBe("empty");
    expect(rejection(s, "a", " \t  ")).toBe("empty");
    expect(rejection(s, "a", "!!!")).toBe("empty");
    s = answer(s, "a", "mavi");
    expect(s.answers[0]?.a).toBe("mavi");
  });

  it("parseAction: tür/şekil doğrulanır, 60 karakter teknik sınır, kırpılır", () => {
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "  mavi " })).toEqual({
      kind: "answer",
      text: "mavi",
    });
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "x".repeat(60) })).not.toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "x".repeat(61) })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: 5 })).toBeNull();
    expect(cagrisimAgi.parseAction({ kind: "answer", text: "a", extra: 1 })).toBeNull();
    expect(cagrisimAgi.parseAction(["answer", "a"])).toBeNull();
  });

  it("katılımcı olmayan reddedilir; süre bitiminde ve sonrasında reddedilir", () => {
    expect(rejection(start(), "ghost", "mavi")).toBe("not_participant");
    const s = start();
    expect(rejection(s, "a", "mavi", CAGRISIM_ANSWER_MS - 1)).toBeNull();
    expect(rejection(s, "a", "mavi", CAGRISIM_ANSWER_MS)).toBe("ended");
    expect(rejection(s, "a", "mavi", CAGRISIM_TOTAL_MS + 5_000)).toBe("ended");
  });

  it("tick'lenmemiş durumda da sonraki kelimeye cevap kabul edilir (takvimden hesaplanır)", () => {
    const s = start();
    const r = cagrisimAgi.reduce(s, "a", { kind: "answer", text: "mavi" }, ctx(T0 + ROUND(1) + 10));
    if (isRejected(r)) throw new Error(r.rejected);
    expect(r.round).toBe(1);
    expect(r.answers[1]).toEqual({ a: "mavi" });
  });
});

describe("cagrisim-agi gizlilik", () => {
  it("cevap süresince cevaplar hiçbir görünümde yok; yalnız kimin cevapladığı görünür", () => {
    let s = start();
    s = answer(s, "a", "gizlicevap");
    s = answer(s, "b", "gizlicevap");
    const pub = pubAt(s, 2_000);
    expect(JSON.stringify(pub)).not.toContain("gizlicevap");
    expect(pub.results).toEqual([]);
    expect(pub.answeredIds).toEqual(["a", "b"]);
    expect(cagrisimAgi.view(s, "a", ctx(T0)).myAnswer).toBe("gizlicevap");
    expect(cagrisimAgi.view(s, "c", ctx(T0)).myAnswer).toBeNull();
    expect(cagrisimAgi.view(s, null, ctx(T0)).myAnswer).toBeNull();
    expect(findLeaks(cagrisimAgi, s, PLAYERS, T0 + 2_000)).toEqual([]);
  });

  it("sonraki kelimede önceki cevaplar açık, yeni cevaplar gizli", () => {
    let s = start();
    s = answer(s, "a", "ilkcevap");
    s = tickAt(s, ROUND(1));
    s = answer(s, "b", "ikincicevap", ROUND(1) + 500);
    const pub = JSON.stringify(pubAt(s, ROUND(1) + 600));
    expect(pub).toContain("ilkcevap");
    expect(pub).not.toContain("ikincicevap");
    expect(findLeaks(cagrisimAgi, s, PLAYERS, T0 + ROUND(1) + 600)).toEqual([]);
  });

  it("secrets: sahibi kendisi; daha uzun cevabı içeren de hak sahibi; açılışta boş", () => {
    let s = start();
    s = answer(s, "a", "deniz");
    s = answer(s, "b", "mavi deniz");
    s = answer(s, "c", "ab");
    expect(cagrisimAgi.secrets(s).find((e) => e.value === "deniz")?.ownerIds).toEqual(["a", "b"]);
    expect(cagrisimAgi.secrets(s).some((e) => e.value === "ab")).toBe(false);
    expect(findLeaks(cagrisimAgi, s, PLAYERS, T0 + 3_000)).toEqual([]);
    expect(cagrisimAgi.secrets(tickAt(s, CAGRISIM_ANSWER_MS))).toEqual([]);
  });
});

describe("cagrisim-agi içerik (CG-M4, CG-M6)", () => {
  it("üç kelime tekrar süzgecine bildirilir (son 60 kelime)", () => {
    const s = start();
    expect(cagrisimAgi.contentUsed?.(s)).toEqual(
      s.words.map((w) => ({ poolId: CAGRISIM_POOL.id, key: w.key, memory: CAGRISIM_CONTENT_MEMORY })),
    );
  });

  it("kelime karnesi: en büyük ağ oranı ve tek kalan oranı; cevap metni yok; yazılmayan kelime atlanır", () => {
    const s = playSeries(
      ["a", "b", "c", "d", "e"],
      [{ a: "kış", b: "kış", c: "kış", d: "soğuk" }, {}, { a: "u1", b: "u2" }],
    );
    const fb = cagrisimAgi.contentFeedback?.(s) ?? [];
    expect(fb).toEqual([
      { poolId: CAGRISIM_POOL.id, key: s.words[0]?.key, play: { top: 0.75, single: 0.25 } },
      { poolId: CAGRISIM_POOL.id, key: s.words[2]?.key, play: { top: 0, single: 1 } },
    ]);
    expect(JSON.stringify(fb)).not.toMatch(/kış|soğuk|u1/);
  });
});

describe("cagrisim-agi simülasyon", () => {
  it("tam simülasyon: sonuç kayıttan tekrar oynatmayla aynı", () => {
    const players = ["p1", "p2", "p3"];
    const act = (t: number, playerId: string, text: string) => ({
      t: T0 + t,
      playerId,
      raw: { kind: "answer", text },
      kind: "valid" as const,
    });
    const actions = [
      act(1_000, "p1", "Mavi"),
      act(2_000, "p2", "mavi "),
      act(3_000, "p3", "kırmızı"),
      act(ROUND(1) + 1_000, "p1", "dalgalar"),
      act(ROUND(1) + 2_000, "p3", "dalga"),
      act(ROUND(2) + 1_000, "p2", "kumsal"),
    ];
    const out = runSimulation(cagrisimAgi, {
      seed: 7,
      players,
      startedAt: T0,
      actions,
      ticks: [T0 + 10_000, T0 + 31_000, T0 + 50_000, T0 + 70_000, T0 + 80_000],
      durationMs: CAGRISIM_TOTAL_MS,
      disconnectProbability: 0,
    });
    expect(out.result.miniScores).toEqual({ p1: 4, p2: 2, p3: 2 });
    expect(out.result.awards).toEqual({ p1: 2, p2: 1, p3: 1 });
    expect(replay(cagrisimAgi, out.log)).toEqual(out.result);
  });

  it("büyük açılış süresi en az 8 sn", () => {
    expect(CAGRISIM_FINAL_MS).toBe(8_000);
  });
});
