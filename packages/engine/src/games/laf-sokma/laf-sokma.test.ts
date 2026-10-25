import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import {
  createLafSokma,
  LAF_ANSWER_MAX,
  LAF_EMPTY_REVEAL_MS,
  LAF_FINAL_ID,
  LAF_FINAL_REVEAL_MS,
  LAF_FINAL_VOTE_MS,
  LAF_FINAL_WRITE_MS,
  LAF_PROMPTS,
  LAF_REVEAL_MS,
  LAF_TONES,
  LAF_VOTE_MS,
  LAF_WRITE_MS,
  type LafPublicView,
  type LafState,
  type LafView,
  lafAdvance,
  lafAssign,
  lafCards,
  lafMaxDurationMs,
  lafSokma,
  lafStepKind,
} from "./index.js";

const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players: string[] = ["a", "b", "c", "d"], seed = 1, tone?: "aile" | "arkadas" | "ofis") =>
  (tone ? createLafSokma(tone) : lafSokma).setup(players, ctx(T0, players, seed));
const pub = (s: LafState, at: number) => lafSokma.publicView(s, ctx(at, s.players)) as LafPublicView;
const priv = (s: LafState, who: string | null, at: number) =>
  lafSokma.view(s, who, ctx(at, s.players)) as LafView;

type Act = Parameters<typeof lafSokma.reduce>[2];
function act(s: LafState, who: string, a: Act, at: number, connected?: readonly string[]): LafState {
  const r = lafSokma.reduce(s, who, a, ctx(at, connected ?? s.players));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function reason(s: LafState, who: string, a: Act, at: number, connected?: readonly string[]): string {
  const r = lafSokma.reduce(s, who, a, ctx(at, connected ?? s.players));
  if (!isRejected(r)) throw new Error("kabul edildi");
  return r.rejected;
}
const tick = (s: LafState, at: number) => lafSokma.tick(s, ctx(at, s.players));

/** Adım başlangıç/bitiş zamanı yardımcıları (erken bitişsiz tam süreler). */
const stepsStart = (n: number) => {
  const starts: number[] = [T0];
  const dur = [LAF_WRITE_MS];
  for (let i = 0; i < n; i++) dur.push(LAF_VOTE_MS, LAF_REVEAL_MS);
  dur.push(LAF_FINAL_WRITE_MS, LAF_FINAL_VOTE_MS, LAF_FINAL_REVEAL_MS);
  for (const d of dur) starts.push((starts[starts.length - 1] as number) + d);
  return starts; // starts[k] = k. adımın başlangıcı; sonuncu = oyun sonu
};

const duelOf = (s: LafState, who: string) => s.duels.filter((d) => d.authors.includes(who));

/** Herkes iki sorusuna cevap yazar (metin = `${id}-${who}`), tamamı kilitlenmeden. */
function writeAll(s: LafState, at = T0 + 1_000): LafState {
  let st = s;
  for (const who of st.players) {
    for (const d of duelOf(st, who)) {
      st = act(st, who, { kind: "answer", prompt: d.id, text: `cevap ${d.id} ${who}` }, at);
    }
  }
  return st;
}

/** Düelloya (adım) geç: tick ile. */
const goTo = (s: LafState, n: number, step: number, extra = 0) =>
  tick(s, (stepsStart(n)[step] as number) + extra);

describe("laf-sokma meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(lafSokma.id).toBe("laf-sokma");
    expect(lafSokma.minPlayers).toBe(3);
    expect(lafSokma.maxPlayers).toBe(8);
    expect(lafSokma.orientation).toBe("portrait");
    expect(lafSokma.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(lafSokma.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("süreler: yazma 60, oylama 10, final yazma 45", () => {
    const s = start();
    expect(s.stepEndsAt - s.startedAt).toBe(60_000);
    expect(LAF_VOTE_MS).toBe(10_000);
    expect(LAF_FINAL_WRITE_MS).toBe(45_000);
    expect(LAF_ANSWER_MAX).toBe(80);
  });

  it("varsayılan ton arkadaş; üç ton seçilebilir ve soru o havuzdan gelir", () => {
    expect(start().tone).toBe("arkadas");
    for (const tone of LAF_TONES) {
      const s = start(["a", "b", "c"], 3, tone);
      expect(s.tone).toBe(tone);
      for (const d of s.duels) expect(LAF_PROMPTS[tone]).toContain(d.prompt);
      expect(LAF_PROMPTS[tone]).toContain(s.finalPrompt);
    }
  });
});

describe("soru dağıtımı", () => {
  it("özellik: her soru 2 farklı oyuncuya, her oyuncu 2 soruya, çift tekrarı yok (3-8 oyuncu)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 8 }), fc.integer({ min: 0, max: 2 ** 31 - 1 }), (n, seed) => {
        const players = ALL.slice(0, n);
        const pairs = lafAssign(players, createRng(seed));
        expect(pairs).toHaveLength(n);
        const perPlayer = new Map<string, number>(players.map((p) => [p, 0]));
        const seen = new Set<string>();
        for (const [x, y] of pairs) {
          expect(x).not.toBe(y);
          perPlayer.set(x, (perPlayer.get(x) ?? 0) + 1);
          perPlayer.set(y, (perPlayer.get(y) ?? 0) + 1);
          const key = [x, y].sort().join("|");
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
        for (const c of perPlayer.values()) expect(c).toBe(2);
      }),
      { numRuns: 300 },
    );
  });

  it("3 oyuncuda üçgen: üç farklı çift", () => {
    const pairs = lafAssign(["a", "b", "c"], createRng(7)).map((p) => [...p].sort().join(""));
    expect(pairs.sort()).toEqual(["ab", "ac", "bc"]);
  });

  it("kurulumda sorular birbirinden farklı (N düello + final), setup bu dağıtımı kullanır", () => {
    for (const n of [3, 5, 8]) {
      const s = start(ALL.slice(0, n), 11);
      const prompts = [...s.duels.map((d) => d.prompt), s.finalPrompt];
      expect(new Set(prompts).size).toBe(n + 1);
      for (const p of s.players) expect(duelOf(s, p)).toHaveLength(2);
    }
  });

  it("havuz: her ton 110 benzersiz soru, makul uzunlukta", () => {
    for (const tone of LAF_TONES) {
      const list = LAF_PROMPTS[tone];
      expect(list).toHaveLength(110);
      expect(new Set(list).size).toBe(110);
      for (const q of list) {
        expect(q.length).toBeLessThanOrEqual(90);
        expect(q.endsWith("?")).toBe(true);
      }
    }
    const all = LAF_TONES.flatMap((t) => LAF_PROMPTS[t]);
    expect(new Set(all).size).toBe(330);
  });
});

describe("yazma", () => {
  it("kişi yalnız kendine verilen iki soruya yazar; başkasının sorusu reddedilir", () => {
    const s = start();
    const mine = duelOf(s, "a");
    const other = s.duels.find((d) => !d.authors.includes("a"));
    expect(mine).toHaveLength(2);
    expect(priv(s, "a", T0).tasks.map((t) => t.id)).toEqual(mine.map((d) => d.id));
    expect(reason(s, "a", { kind: "answer", prompt: other?.id ?? "", text: "merhaba" }, T0 + 5)).toBe(
      "not_yours",
    );
    expect(reason(s, "a", { kind: "answer", prompt: "final", text: "merhaba" }, T0 + 5)).toBe("not_yours");
  });

  it("cevap değiştirilebilir ve silinebilir; son hali geçerli", () => {
    let s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    s = act(s, "a", { kind: "answer", prompt: id, text: "ilk" }, T0 + 1);
    s = act(s, "a", { kind: "answer", prompt: id, text: "ikinci cevap" }, T0 + 2);
    expect(priv(s, "a", T0 + 3).tasks.find((t) => t.id === id)?.answer).toBe("ikinci cevap");
    s = act(s, "a", { kind: "answer", prompt: id, text: "  " }, T0 + 4);
    expect(priv(s, "a", T0 + 5).tasks.find((t) => t.id === id)?.answer).toBeNull();
  });

  it("cevap sunucuda temizlenir: boşluklar sadeleşir, harf büyüklüğü korunur", () => {
    let s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    s = act(s, "a", { kind: "answer", prompt: id, text: "  Çok\n\t  KOMİK   cevap  " }, T0 + 1);
    expect(priv(s, "a", T0 + 2).tasks.find((t) => t.id === id)?.answer).toBe("Çok KOMİK cevap");
  });

  it("80 karakter sınırı (Unicode karakter sayılır); 81 reddedilir", () => {
    const s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    const ok = "ş".repeat(80);
    expect(isRejected(lafSokma.reduce(s, "a", { kind: "answer", prompt: id, text: ok }, ctx(T0 + 1)))).toBe(
      false,
    );
    expect(reason(s, "a", { kind: "answer", prompt: id, text: `${ok}x` }, T0 + 1)).toBe("too_long");
    // emoji tek karakter sayılır
    expect(
      isRejected(lafSokma.reduce(s, "a", { kind: "answer", prompt: id, text: "😀".repeat(80) }, ctx(T0 + 1))),
    ).toBe(false);
  });

  it("görünmez karakter, harfsiz metin reddedilir; boş metin cevabı siler", () => {
    const s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    expect(
      reason(s, "a", { kind: "answer", prompt: id, text: `a${String.fromCodePoint(0x200b)}b` }, T0 + 1),
    ).toBe("invalid");
    expect(reason(s, "a", { kind: "answer", prompt: id, text: "!!! ???" }, T0 + 1)).toBe("empty");
  });

  it("moderasyon: kaba cevap dostça bir nedenle reddedilir, durum değişmez", () => {
    const s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    expect(reason(s, "a", { kind: "answer", prompt: id, text: "siktir git" }, T0 + 1)).toBe("inappropriate");
    expect(reason(s, "a", { kind: "answer", prompt: id, text: "s.i.k.t.i.r" }, T0 + 1)).toBe("inappropriate");
    expect(priv(s, "a", T0 + 2).tasks.every((t) => t.answer === null)).toBe(true);
  });

  it("yazma bitince yeni cevap reddedilir (not_writing)", () => {
    const s = start();
    const id = duelOf(s, "a")[0]?.id ?? "";
    expect(reason(s, "a", { kind: "answer", prompt: id, text: "geç" }, T0 + LAF_WRITE_MS)).toBe(
      "not_writing",
    );
  });

  it("katılımcı olmayan ve çöp eylem reddedilir", () => {
    const s = start();
    expect(reason(s, "zz", { kind: "lock" }, T0 + 1)).toBe("not_participant");
    expect(lafSokma.parseAction({ kind: "answer", prompt: "q1" })).toBeNull();
    expect(lafSokma.parseAction({ kind: "answer", prompt: "q1", text: "x".repeat(401) })).toBeNull();
    expect(lafSokma.parseAction({ kind: "vote", card: 3 })).toBeNull();
    expect(lafSokma.parseAction({ kind: "lock", extra: 1 })).toBeNull();
  });
});

describe("erken bitiş: yazma (Tamam)", () => {
  const writers = ["a", "b", "c", "d"];
  const writeAndLock = (s: LafState, who: string, at: number, connected?: readonly string[]) => {
    let st = s;
    const d = duelOf(st, who)[0];
    st = act(st, who, { kind: "answer", prompt: d?.id ?? "", text: `cevap ${who}` }, at - 1, connected);
    return act(st, who, { kind: "lock" }, at, connected);
  };

  it("(a) bağlı herkes kilitleyince aşama 1 sn sonra biter", () => {
    let s = start(writers);
    for (const [i, w] of writers.entries()) s = writeAndLock(s, w, T0 + 2_000 + i * 100);
    const last = T0 + 2_000 + 3 * 100;
    expect(s.stepEndsAt).toBe(last + 1_000);
    expect(tick(s, last + 999).step).toBe(0);
    expect(tick(s, last + 1_000).step).toBe(1);
  });

  it("(b) bir kişi eksikken bitmez", () => {
    let s = start(writers);
    for (const [i, w] of writers.slice(0, 3).entries()) s = writeAndLock(s, w, T0 + 2_000 + i * 100);
    expect(s.stepEndsAt).toBe(T0 + LAF_WRITE_MS);
    expect(pub(s, T0 + 3_000).ready).toEqual(["a", "b", "c"]);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const online = ["a", "b", "c"];
    let s = start(writers);
    for (const [i, w] of online.entries()) s = writeAndLock(s, w, T0 + 2_000 + i * 100, online);
    expect(s.stepEndsAt).toBe(T0 + 2_000 + 200 + 1_000);
  });

  it("(d) kilit sonrası değişiklik ve ikinci kilit reddedilir", () => {
    let s = start(writers);
    s = writeAndLock(s, "a", T0 + 2_000);
    const d = duelOf(s, "a")[0]?.id ?? "";
    expect(reason(s, "a", { kind: "answer", prompt: d, text: "değiştir" }, T0 + 2_100)).toBe("locked");
    expect(reason(s, "a", { kind: "lock" }, T0 + 2_100)).toBe("locked");
  });

  it("(e) herkese açık görünümde yalnız kimlerin kilitlediği var; cevap metni yok", () => {
    let s = start(writers);
    s = writeAndLock(s, "a", T0 + 2_000);
    const json = JSON.stringify(pub(s, T0 + 2_100));
    expect(json).not.toContain("cevap a");
    expect(pub(s, T0 + 2_100).ready).toEqual(["a"]);
    expect(priv(s, "a", T0 + 2_100).locked).toBe(true);
    expect(priv(s, "b", T0 + 2_100).locked).toBe(false);
  });

  it("cevabı olmayan kilitleyemez", () => {
    const s = start(writers);
    expect(reason(s, "a", { kind: "lock" }, T0 + 500)).toBe("nothing_to_lock");
  });

  it("final yazmasında da aynı: herkes kilitleyince 1 sn sonra biter", () => {
    const n = writers.length;
    let s = goTo(writeAll(start(writers)), n, 2 * n + 1);
    expect(lafStepKind(s.step, n).phase).toBe("finalWrite");
    const at = (stepsStart(n)[2 * n + 1] as number) + 2_000;
    for (const w of writers) {
      s = act(s, w, { kind: "answer", prompt: LAF_FINAL_ID, text: `final ${w}` }, at);
      s = act(s, w, { kind: "lock" }, at + 10);
    }
    expect(s.stepEndsAt).toBe(at + 10 + 1_000);
  });
});

describe("oylama", () => {
  const players = ["a", "b", "c", "d", "e"];
  const n = players.length;

  function atVote(i: number, seed = 5): { s: LafState; t: number } {
    const s = goTo(writeAll(start(players, seed)), n, 1 + 2 * i, 1);
    return { s, t: (stepsStart(n)[1 + 2 * i] as number) + 100 };
  }

  it("her soru sırayla gelir: iki isimsiz kart, oy verenler cevap sahibi olmayanlar", () => {
    for (let i = 0; i < n; i++) {
      const { s, t } = atVote(i);
      const p = pub(s, t);
      const d = s.duels[i];
      expect(p.phase).toBe("vote");
      expect(p.index).toBe(i);
      expect(p.duel?.prompt).toBe(d?.prompt);
      expect(p.duel?.cards).toHaveLength(2);
      expect(p.voters).toEqual(players.filter((x) => !d?.authors.includes(x)));
      expect(p.reveal).toBeNull();
    }
  });

  it("cevap sahipleri oy veremez; kendi kartı ve olmayan kart reddedilir", () => {
    const { s, t } = atVote(0);
    const d = s.duels[0];
    const author = d?.authors[0] ?? "";
    const card = pub(s, t).duel?.cards[0]?.id ?? "k1";
    expect(reason(s, author, { kind: "vote", card }, t)).toBe("cannot_vote");
    const voter = players.find((x) => !d?.authors.includes(x)) ?? "";
    expect(reason(s, voter, { kind: "vote", card: "k9" }, t)).toBe("unknown_card");
  });

  it("oy tek seferliktir", () => {
    const { s, t } = atVote(0);
    const voter = pub(s, t).voters[0] ?? "";
    const next = act(s, voter, { kind: "vote", card: "k1" }, t);
    expect(reason(next, voter, { kind: "vote", card: "k2" }, t + 10)).toBe("already_voted");
  });

  it("oylar ve cevap sahipleri o soru açılınca görünür", () => {
    let { s, t } = atVote(0);
    const d = s.duels[0];
    const voters = pub(s, t).voters;
    const cards = lafCards(s, d?.id ?? "");
    const target = cards[0];
    for (const v of voters) s = act(s, v, { kind: "vote", card: target?.id ?? "k1" }, t);
    const before = pub(s, t);
    expect(JSON.stringify(before)).not.toContain(`"author"`);
    s = tick(s, t + 1_001);
    const open = pub(s, t + 1_001);
    expect(open.phase).toBe("reveal");
    const r = open.reveal;
    expect(r?.cards.find((c) => c.id === target?.id)?.author).toBe(target?.author);
    expect(r?.cards.find((c) => c.id === target?.id)?.voters).toEqual(voters);
  });

  it("(a) oy verebilen herkes oy verince 1 sn sonra biter; (b) biri eksikken bitmez", () => {
    let { s, t } = atVote(0);
    const voters = pub(s, t).voters;
    for (const v of voters.slice(0, -1)) s = act(s, v, { kind: "vote", card: "k1" }, t);
    expect(s.stepEndsAt).toBe(s.stepStartedAt + LAF_VOTE_MS);
    s = act(s, voters[voters.length - 1] ?? "", { kind: "vote", card: "k1" }, t + 50);
    expect(s.stepEndsAt).toBe(t + 50 + 1_000);
  });

  it("(c) bağlantısı kopan oy verici beklenmez", () => {
    let { s, t } = atVote(0);
    const voters = pub(s, t).voters;
    const online = [...(s.duels[0]?.authors ?? []), ...voters.slice(0, -1)];
    for (const v of voters.slice(0, -1)) s = act(s, v, { kind: "vote", card: "k1" }, t, online);
    expect(s.stepEndsAt).toBe(t + 1_000);
  });

  it("(e) oy veren listesi kime verdiklerini sızdırmaz", () => {
    let { s, t } = atVote(0);
    const voters = pub(s, t).voters;
    s = act(s, voters[0] ?? "", { kind: "vote", card: "k2" }, t);
    const p = pub(s, t);
    expect(p.ready).toEqual([voters[0]]);
    expect(JSON.stringify(p)).not.toContain('k2":');
    expect(priv(s, voters[0] ?? "", t).myVote).toBe("k2");
    expect(priv(s, voters[1] ?? "", t).myVote).toBeNull();
  });

  it("süre bitince oy verilmeyen sayılmaz (0 oy), vermeyen cezalandırılmaz", () => {
    const { s } = atVote(0);
    const end = goTo(s, n, 2, 1);
    const r = pub(end, (stepsStart(n)[2] as number) + 10).reveal;
    expect(r?.cards.every((c) => c.voters.length === 0 && c.points === 0)).toBe(true);
  });

  it("oylama bittikten sonra oy reddedilir", () => {
    const { s } = atVote(0);
    const late = (stepsStart(n)[2] as number) + 5;
    expect(reason(s, pub(s, late).voters[0] ?? "", { kind: "vote", card: "k1" }, late)).toBe("not_voting");
  });
});

describe("cevap yok", () => {
  it("cevap yazmayan: 'Cevap yok' kartı (text null), oylanamaz, 0 oy", () => {
    const players = ["a", "b", "c", "d"];
    const n = players.length;
    let s = start(players, 9);
    const d = s.duels[0];
    const writer = d?.authors[0] ?? "";
    s = act(s, writer, { kind: "answer", prompt: d?.id ?? "", text: "tek cevap" }, T0 + 100);
    s = goTo(s, n, 1, 1);
    const t = (stepsStart(n)[1] as number) + 10;
    const cards = pub(s, t).duel?.cards ?? [];
    expect(cards.map((c) => c.text).sort()).toEqual([null, "tek cevap"]);
    const empty = cards.find((c) => c.text === null);
    const filled = cards.find((c) => c.text !== null);
    const voters = pub(s, t).voters;
    expect(reason(s, voters[0] ?? "", { kind: "vote", card: empty?.id ?? "" }, t)).toBe("no_answer");
    for (const v of voters) s = act(s, v, { kind: "vote", card: filled?.id ?? "" }, t);
    s = tick(s, t + 1_001);
    const r = pub(s, t + 1_001).reveal;
    expect(r?.cards.find((c) => c.text === null)?.points).toBe(0);
    expect(r?.cards.find((c) => c.text === null)?.voters).toEqual([]);
    expect(r?.cards.find((c) => c.text !== null)?.voters).toHaveLength(voters.length);
  });

  it("iki taraf da cevapsızsa oylama atlanır, kısa açılış gösterilir", () => {
    const players = ["a", "b", "c"];
    const n = 3;
    let s = start(players, 2);
    s = tick(s, T0 + LAF_WRITE_MS);
    // oylama adımı 0 sürelidir: doğrudan açılışta
    expect(lafStepKind(s.step, n)).toEqual({ phase: "reveal", duel: 0 });
    expect(s.stepEndsAt - s.stepStartedAt).toBe(LAF_EMPTY_REVEAL_MS);
    const r = pub(s, T0 + LAF_WRITE_MS).reveal;
    expect(r?.cards.map((c) => c.text)).toEqual([null, null]);
  });
});

describe("puanlama", () => {
  const players = ["a", "b", "c", "d", "e"];
  const n = players.length;

  /** i. düelloda belirtilen oyları ver ve açılışa geç. */
  function vote(i: number, pick: (cards: ReturnType<typeof lafCards>, voter: string) => number | null) {
    let s = goTo(writeAll(start(players, 5)), n, 1 + 2 * i, 1);
    const t = (stepsStart(n)[1 + 2 * i] as number) + 100;
    const id = s.duels[i]?.id ?? "";
    const cards = lafCards(s, id);
    for (const v of pub(s, t).voters) {
      const k = pick(cards, v);
      if (k !== null) s = act(s, v, { kind: "vote", card: cards[k]?.id ?? "" }, t);
    }
    const openAt = s.stepEndsAt + 1;
    s = tick(s, openAt);
    return { s, cards, res: pub(s, openAt).reveal };
  }

  it("aldığın her oy +1", () => {
    const { res, cards } = vote(0, (_c, v) => (v === "x" ? 0 : players.indexOf(v) % 2 === 0 ? 0 : 1));
    const total = res?.cards.reduce((sum, c) => sum + c.voters.length, 0);
    expect(total).toBe(3);
    for (const c of res?.cards ?? []) expect(c.points).toBe(c.voters.length + (c.master ? 1 : 0));
    expect(cards).toHaveLength(2);
  });

  it("tüm oyları (en az 2) alırsan +1 Laf Ustası", () => {
    const { res } = vote(0, () => 0);
    const winner = res?.cards.find((c) => c.voters.length === 3);
    expect(winner?.master).toBe(true);
    expect(winner?.points).toBe(4);
    expect(res?.cards.find((c) => c.voters.length === 0)?.points).toBe(0);
  });

  it("tek oyla Laf Ustası olunmaz (en az 2 oy)", () => {
    const { res } = vote(0, (_c, v) => (v === pub0Voters(0)[0] ? 0 : null));
    expect(res?.cards.every((c) => !c.master)).toBe(true);
    expect(res?.cards.find((c) => c.voters.length === 1)?.points).toBe(1);
  });

  function pub0Voters(i: number): string[] {
    const s = start(players, 5);
    return players.filter((p) => !s.duels[i]?.authors.includes(p));
  }

  it("oylar bölünürse kimse Laf Ustası olmaz", () => {
    const { res } = vote(0, (_c, v) => (v === pub0Voters(0)[0] ? 0 : 1));
    expect(res?.cards.every((c) => !c.master)).toBe(true);
    expect(res?.cards.reduce((sum, c) => sum + c.points, 0)).toBe(3);
  });

  it("tek cevaplı soruda tüm oyları alan Laf Ustası olur; cevapsız kart 0 alır", () => {
    let s = start(players, 5);
    const d = s.duels[0];
    s = act(s, d?.authors[0] ?? "", { kind: "answer", prompt: d?.id ?? "", text: "tek başıma" }, T0 + 10);
    s = goTo(s, n, 1, 1);
    const t = (stepsStart(n)[1] as number) + 10;
    const filled = lafCards(s, d?.id ?? "").find((c) => c.text !== null);
    for (const v of pub(s, t).voters) s = act(s, v, { kind: "vote", card: filled?.id ?? "" }, t);
    const openAt = s.stepEndsAt + 1;
    s = tick(s, openAt);
    const r = pub(s, openAt).reveal;
    expect(r?.cards.find((c) => c.text !== null)?.points).toBe(3 + 1);
  });

  it("toplam puan sonuçta: miniScores = awards (doğrudan genel skora)", () => {
    const players3 = ["a", "b", "c"];
    let s = writeAll(start(players3, 4));
    const total = (res: Record<string, number>) => Object.values(res).reduce((x, y) => x + y, 0);
    expect(total(lafSokma.result(s).miniScores)).toBe(0);
    // her düelloda tek oy verici var: ilk karta oy
    for (let i = 0; i < 3; i++) {
      s = goTo(s, 3, 1 + 2 * i, 1);
      const t = (stepsStart(3)[1 + 2 * i] as number) + 10;
      const voter = pub(s, t).voters[0] ?? "";
      s = act(s, voter, { kind: "vote", card: "k1" }, t);
    }
    s = goTo(s, 3, 2 * 3 + 3, LAF_FINAL_REVEAL_MS);
    const r = lafSokma.result(s);
    expect(r.awards).toEqual(r.miniScores);
    expect(total(r.miniScores)).toBe(3);
  });
});

describe("final", () => {
  const players = ["a", "b", "c", "d"];
  const n = players.length;
  const fw = 2 * n + 1;

  function atFinalVote(answered: string[] = players): { s: LafState; t: number } {
    let s = goTo(writeAll(start(players, 6)), n, fw);
    const at = (stepsStart(n)[fw] as number) + 1_000;
    for (const w of answered) s = act(s, w, { kind: "answer", prompt: LAF_FINAL_ID, text: `final ${w}` }, at);
    s = tick(s, stepsStart(n)[fw + 1] as number);
    return { s, t: (stepsStart(n)[fw + 1] as number) + 10 };
  }

  it("son turda herkes aynı soruya cevap yazar (45 sn)", () => {
    const s = goTo(writeAll(start(players, 6)), n, fw);
    expect(lafStepKind(s.step, n).phase).toBe("finalWrite");
    expect(s.stepEndsAt - s.stepStartedAt).toBe(LAF_FINAL_WRITE_MS);
    for (const p of players) {
      const tasks = priv(s, p, s.stepStartedAt).tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.prompt).toBe(s.finalPrompt);
    }
  });

  it("herkes kendisi dışında bir cevaba oy verir; kendi cevabına oy reddedilir", () => {
    const { s, t } = atFinalVote();
    const p = pub(s, t);
    expect(p.phase).toBe("finalVote");
    expect(p.duel?.cards).toHaveLength(4);
    expect(p.voters).toEqual(players);
    const mine = priv(s, "a", t).myCard ?? "";
    expect(reason(s, "a", { kind: "vote", card: mine }, t)).toBe("own_card");
    const other = p.duel?.cards.find((c) => c.id !== mine)?.id ?? "";
    expect(isRejected(lafSokma.reduce(s, "a", { kind: "vote", card: other }, ctx(t, players)))).toBe(false);
  });

  it("aldığın her oy +1 (Laf Ustası finalde yok)", () => {
    let { s, t } = atFinalVote();
    const cards = lafCards(s, LAF_FINAL_ID);
    const star = cards[0];
    for (const v of players) {
      const target = v === star?.author ? cards[1] : star;
      s = act(s, v, { kind: "vote", card: target?.id ?? "" }, t);
    }
    expect(s.stepEndsAt).toBe(t + 1_000);
    s = tick(s, t + 1_000);
    const r = pub(s, t + 1_001).reveal;
    expect(r?.cards.find((c) => c.author === star?.author)?.points).toBe(3);
    expect(r?.cards.some((c) => c.master)).toBe(false);
    const res = lafSokma.result(s);
    expect(res.miniScores[star?.author ?? ""]).toBe(3);
    expect(Object.values(res.miniScores).reduce((x, y) => x + y, 0)).toBe(4);
  });

  it("yalnız cevap yazanlar kart olur; yazmayan yine oy verebilir", () => {
    const { s, t } = atFinalVote(["a", "b"]);
    const p = pub(s, t);
    expect(p.duel?.cards).toHaveLength(2);
    expect(p.voters).toEqual(players);
    expect(priv(s, "c", t).myCard).toBeNull();
  });

  it("tek cevap varsa yazarı dışındakiler oy verebilir, yazarı veremez", () => {
    const { s, t } = atFinalVote(["a"]);
    expect(pub(s, t).voters).toEqual(["b", "c", "d"]);
    expect(reason(s, "a", { kind: "vote", card: "k1" }, t)).toBe("cannot_vote");
  });

  it("final cevabı olmayan kimse yoksa oylama atlanır", () => {
    const { s } = atFinalVote([]);
    expect(lafStepKind(s.step, n).phase).toBe("finalReveal");
    expect(s.stepEndsAt - s.stepStartedAt).toBe(LAF_EMPTY_REVEAL_MS);
  });

  it("oyun finalin açılışı bitince biter; sonra eylem reddedilir", () => {
    const { s, t } = atFinalVote();
    const end = stepsStart(n)[stepsStart(n).length - 1] as number;
    const done = tick(s, end);
    expect(lafSokma.isFinished(done, ctx(end))).toBe(true);
    expect(lafSokma.isFinished(done, ctx(end - 1))).toBe(false);
    expect(reason(done, "a", { kind: "vote", card: "k1" }, end)).toBe("ended");
    // tick'lenmemiş durumda bile ret
    expect(reason(s, "a", { kind: "vote", card: "k1" }, end + 5)).toBe("ended");
    expect(t).toBeGreaterThan(0);
  });

  it("toplam süre üst sınırı", () => {
    const end = stepsStart(n)[stepsStart(n).length - 1] as number;
    expect(end - T0).toBe(lafMaxDurationMs(n));
  });
});

describe("gizlilik (yapısal)", () => {
  const players = ["a", "b", "c", "d", "e"];
  const n = players.length;

  it("yazma: kimse başkasının cevabını ya da hangi soruyu aldığını görmez", () => {
    const s = writeAll(start(players, 3));
    for (const p of players) {
      const v = priv(s, p, T0 + 2_000);
      expect(v.tasks).toHaveLength(2);
      const own = new Set(duelOf(s, p).map((d) => d.id));
      expect(v.tasks.every((t) => own.has(t.id))).toBe(true);
      for (const q of players) {
        if (q === p) continue;
        for (const d of duelOf(s, q)) {
          if (!own.has(d.id)) expect(JSON.stringify(v)).not.toContain(`cevap ${d.id} ${q}`);
        }
      }
    }
    const pj = JSON.stringify(pub(s, T0 + 2_000));
    expect(pj).not.toContain("cevap q");
    for (const d of s.duels) expect(pj).not.toContain(d.prompt);
  });

  it("oylama: kartlarda yazar bilgisi yok; sonraki soruların cevapları hiçbir görünümde yok", () => {
    let s = goTo(writeAll(start(players, 3)), n, 1, 1);
    const t = (stepsStart(n)[1] as number) + 10;
    const open = new Set(lafCards(s, s.duels[0]?.id ?? "").flatMap((c) => (c.text === null ? [] : [c.text])));
    const views = [
      JSON.stringify(pub(s, t)),
      ...[...players, null].map((p) => JSON.stringify(priv(s, p, t))),
    ];
    for (const d of s.duels.slice(1)) {
      for (const p of players) {
        const text = `cevap ${d.id} ${p}`;
        if (open.has(text)) continue;
        for (const j of views) expect(j).not.toContain(text);
      }
    }
    const cards = pub(s, t).duel?.cards ?? [];
    for (const c of cards) expect(Object.keys(c).sort()).toEqual(["id", "text"]);
    // cevap sahibi yalnız kendi kartını bilir
    const d0 = s.duels[0];
    const [x, y] = d0?.authors ?? ["", ""];
    const cx = priv(s, x, t).myCard;
    const cy = priv(s, y, t).myCard;
    expect(cx).not.toBe(cy);
    for (const p of players.filter((q) => q !== x && q !== y)) expect(priv(s, p, t).myCard).toBeNull();
    expect(priv(s, null, t).myCard).toBeNull();
    s = tick(s, t);
  });

  it("oylama: oy verenin tercihi başkasının görünümünde yok", () => {
    let s = goTo(writeAll(start(players, 3)), n, 1, 1);
    const t = (stepsStart(n)[1] as number) + 10;
    const voters = pub(s, t).voters;
    s = act(s, voters[0] ?? "", { kind: "vote", card: "k2" }, t);
    expect(priv(s, voters[1] ?? "", t).myVote).toBeNull();
    expect(priv(s, null, t).myVote).toBeNull();
    expect(JSON.stringify(pub(s, t))).not.toContain('"k2"}');
    const p = pub(s, t);
    expect(p.reveal).toBeNull();
    expect(p.history).toEqual([]);
  });

  it("açılışa kadar (kart, yazar) eşleşmesi yok, açılışta var; geçmiş korunur", () => {
    let s = goTo(writeAll(start(players, 3)), n, 2, 5);
    const r = pub(s, (stepsStart(n)[2] as number) + 5);
    expect(r.phase).toBe("reveal");
    expect(r.reveal?.cards.map((c) => c.author).sort()).toEqual([...(s.duels[0]?.authors ?? [])].sort());
    s = goTo(s, n, 3, 5);
    expect(pub(s, (stepsStart(n)[3] as number) + 5).history).toHaveLength(1);
  });
});

describe("zamanlama ve saflık", () => {
  it("tick aşama geçişlerinde durumu değiştirir, değişiklik yoksa aynı nesneyi döner", () => {
    const s = start();
    expect(tick(s, T0 + 1)).toBe(s);
    const next = tick(s, T0 + LAF_WRITE_MS);
    expect(next).not.toBe(s);
    expect(tick(next, T0 + LAF_WRITE_MS)).toBe(next);
  });

  it("seyrek tick ile adım adım ilerlemek aynı durumu verir", () => {
    const s = writeAll(start(["a", "b", "c"], 8));
    const end = stepsStart(3)[stepsStart(3).length - 1] as number;
    const once = lafAdvance(s, end);
    let stepwise = s;
    for (let t = T0; t <= end; t += 1_700) stepwise = lafAdvance(stepwise, t);
    stepwise = lafAdvance(stepwise, end);
    expect(stepwise).toEqual(once);
  });
});
