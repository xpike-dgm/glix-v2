import { describe, expect, it } from "vitest";
import type { CardId } from "../../cards/catalog.js";
import { type PlayedCard, resolveCards } from "../../cards/resolve.js";
import type { ContentSet } from "../../content.js";
import { isRejected } from "../../game.js";
import { GameRecorder, replay } from "../../replay.js";
import { createRng } from "../../rng.js";
import { YAZI_YAZ_TOPIC_POOL, yaziYaz, yaziYazWordMatch } from "./index.js";
import {
  YAZI_YAZ_FREE_TOPIC,
  YAZI_YAZ_TALK_MS,
  YAZI_YAZ_WRITE_MS,
  type YaziYazAction,
  type YaziYazPublicView,
  yaziYazAwards,
  yaziYazLetterCount,
} from "./types.js";

type State = ReturnType<typeof yaziYaz.setup>;
const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d", "e"];
const GUESS_AT = T0 + YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + 1_000;
const TALK_AT = T0 + YAZI_YAZ_WRITE_MS + 1_000;
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1, content?: ContentSet) => ({
  now,
  rng: createRng(seed),
  connected,
  ...(content ? { content } : {}),
});
const TOPICS = { [YAZI_YAZ_TOPIC_POOL.id]: ["meyve", "Meslek", "MUTFAKTA BULUNUR"] };

function act(s: State, who: string, a: YaziYazAction, at: number, connected = s.players): State {
  const parsed = yaziYaz.parseAction(a);
  if (parsed === null) throw new Error("geçersiz");
  const r = yaziYaz.reduce(s, who, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const pub = (s: State, at: number) =>
  yaziYaz.publicView(yaziYaz.tick(s, ctx(at)), ctx(at)) as YaziYazPublicView;

/** a ve b yazan; kelimeleri verilir, masumlar MASUM. */
function fixed(players = ALL, words: [string, string] = ["ELMA", "KARPUZ"]): State {
  let s: State = {
    ...yaziYaz.setup(players, ctx(T0, players)),
    writers: [players[0], players[1]] as string[],
  };
  if (words[0] !== "") s = act(s, players[0] as string, { kind: "write", text: words[0] }, T0 + 1);
  if (words[1] !== "") s = act(s, players[1] as string, { kind: "write", text: words[1] }, T0 + 1);
  for (const id of players.slice(2)) s = act(s, id, { kind: "write", text: "MASUM" }, T0 + 1);
  return s;
}
const pick = (s: State, who: string, target: string, word = ""): State => {
  let r = act(s, who, { kind: "guessPlayer", target }, GUESS_AT);
  if (word !== "") r = act(r, who, { kind: "guessWord", text: word }, GUESS_AT);
  return r;
};
const scores = (s: State) => yaziYaz.result(s).miniScores;

describe("konu kartı (YY-M1)", () => {
  it("havuz yoksa yerleşik tek kayıt SERBEST: konusuz oynanır (bugünkü oyun)", () => {
    expect(YAZI_YAZ_TOPIC_POOL.builtin).toEqual([YAZI_YAZ_FREE_TOPIC]);
    const s = yaziYaz.setup(ALL, ctx(T0));
    expect(s.topic).toBeNull();
    expect(pub(s, T0 + 1).topic).toBeNull();
    expect(yaziYaz.contentUsed?.(s)).toEqual([{ poolId: "yazi-yaz/konular", key: "serbest", memory: 10 }]);
  });

  it("panelden gelen konular: maç tohumuyla seçilir, büyük harf, herkese açık, her aşamada", () => {
    const seen = new Set<string | null>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = yaziYaz.setup(ALL, ctx(T0, ALL, seed, TOPICS));
      seen.add(s.topic);
      const again = yaziYaz.setup(ALL, ctx(T0, ALL, seed, TOPICS));
      expect(again.topic).toBe(s.topic);
      for (const t of [T0 + 1, TALK_AT, GUESS_AT, s.guessEndsAt]) expect(pub(s, t).topic).toBe(s.topic);
    }
    expect([...seen].sort()).toEqual(["MESLEK", "MEYVE", "MUTFAKTA BULUNUR"]);
  });

  it("konu, yazanların seçimini değiştirmez (rastgele sayı sırası korunur)", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(yaziYaz.setup(ALL, ctx(T0, ALL, seed, TOPICS)).writers).toEqual(
        yaziYaz.setup(ALL, ctx(T0, ALL, seed)).writers,
      );
    }
  });

  it("havuz kaydı doğrulanır: 2-24 karakter, büyük harfe çevrilir", () => {
    expect(YAZI_YAZ_TOPIC_POOL.fromFields({ text: "  mutfakta   bulunur " })).toEqual({
      ok: true,
      entry: "MUTFAKTA BULUNUR",
    });
    expect(YAZI_YAZ_TOPIC_POOL.fromFields({ text: "i" }).ok).toBe(false);
    expect(YAZI_YAZ_TOPIC_POOL.fromFields({ text: "x".repeat(25) }).ok).toBe(false);
    expect(YAZI_YAZ_TOPIC_POOL.fromFields({ text: "<b>" }).ok).toBe(false);
  });
});

describe("harf sayısı ipucu (YY-M2)", () => {
  it("yalnız harf ve rakam sayılır", () => {
    expect(yaziYazLetterCount("BUZ DOLABI")).toBe(9);
    expect(yaziYazLetterCount("Çİ-ĞÖ!")).toBe(4);
    expect(yaziYazLetterCount("R2D2")).toBe(4);
  });

  it("tartışmadan itibaren küçükten büyüğe; yazmada yok; kimin olduğu yok", () => {
    const s = fixed(ALL, ["KARPUZ", "ELMA"]);
    expect(pub(s, T0 + 2).letters).toBeNull();
    expect(pub(s, TALK_AT).letters).toEqual([4, 6]);
    expect(pub(s, GUESS_AT).letters).toEqual([4, 6]);
    expect(pub(fixed(ALL, ["KEDİ", "ELMA"]), TALK_AT).letters).toEqual([4, 4]);
  });

  it("kelime yazmayan yazan: yazılmadı (null, sonda)", () => {
    expect(pub(fixed(ALL, ["", "KİRAZ"]), TALK_AT).letters).toEqual([5, null]);
    expect(pub(fixed(ALL, ["MASUM", ""]), TALK_AT).letters).toEqual([null, null]);
  });
});

describe("İz bırakmadın (YY-M3)", () => {
  it("hiçbir masumun seçmediği yazan +1; masum seçerse bozulur", () => {
    let s = fixed();
    s = pick(s, "c", "a");
    s = pick(s, "d", "c");
    const r = pub(s, s.guessEndsAt).reveal;
    expect(r?.hidden).toEqual(["b"]);
    expect(scores(s)).toMatchObject({ a: 0, b: 1 });
  });

  it("yalnız masumların seçimi sayılır: diğer yazanın seçmesi bozmaz", () => {
    const s = pick(fixed(), "a", "b", "karpuz");
    expect(pub(s, s.guessEndsAt).reveal?.hidden).toEqual(["a", "b"]);
    expect(scores(s)).toMatchObject({ a: 3, b: 1 });
  });

  it("kelime yazmayan (ya da MASUM bırakan) yazan bu ödülü alamaz", () => {
    expect(pub(fixed(ALL, ["", "ELMA"]), GUESS_AT + YAZI_YAZ_TALK_MS).reveal?.hidden).toEqual(["b"]);
    const s = fixed(ALL, ["MASUM", "ELMA"]);
    expect(scores(s)).toMatchObject({ a: 0, b: 1 });
  });

  it("3 oyuncu: tek masum birini seçer, seçilmeyen yazan +1", () => {
    const P = ["a", "b", "c"];
    const s = pick(fixed(P), "c", "a", "elma");
    expect(scores(s)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("yazanın en yüksek dedektif puanı 3, masumun 2", () => {
    const s = pick(pick(fixed(), "a", "b", "karpuz"), "c", "b", "karpuz");
    expect(scores(s).a).toBe(3);
    expect(scores(s).c).toBe(2);
  });
});

describe("sıralama ödülü (YY-M4)", () => {
  it("en yüksek +2, sonraki farklı toplam +1, diğerleri 0", () => {
    expect(yaziYazAwards({ a: 3, b: 2, c: 1, d: 0 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
  });
  it("birincide eşitlik: hepsi +2; sonraki +1", () => {
    expect(yaziYazAwards({ a: 2, b: 2, c: 1, d: 0 })).toEqual({ a: 2, b: 2, c: 1, d: 0 });
  });
  it("toplamı 0 olan ödül almaz", () => {
    expect(yaziYazAwards({ a: 1, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
  });
  it("herkes eşit ve >0: herkes +1; herkes 0: kimse", () => {
    expect(yaziYazAwards({ a: 1, b: 1, c: 1 })).toEqual({ a: 1, b: 1, c: 1 });
    expect(yaziYazAwards({ a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
  });
  it("oyunda: awards sıralamadan, miniScores dedektif puanından", () => {
    let s = fixed();
    s = pick(s, "c", "a", "elma"); // c: 2
    s = pick(s, "d", "a"); // d: 1
    s = pick(s, "e", "c"); // e: 0; b iz bırakmadı: 1
    const res = yaziYaz.result(s);
    expect(res.miniScores).toEqual({ a: 0, b: 1, c: 2, d: 1, e: 0 });
    expect(res.awards).toEqual({ a: 0, b: 1, c: 2, d: 1, e: 0 });
  });
});

describe("maç kartlarıyla (sıralama dedektif puanına göre)", () => {
  const P = ["a", "b", "c", "d"];
  const mini = { a: 3, b: 1, c: 0, d: 0 };
  const run = (plays: PlayedCard[], ms: Record<string, number> = mini) =>
    resolveCards({
      participants: P,
      present: P,
      miniScores: ms,
      awards: yaziYazAwards(ms),
      plays,
      pending: {},
      hands: {},
      seed: 1,
      gameIndex: 0,
    }).awards;
  const play = (playerId: string, cardId: CardId): PlayedCard => ({ playerId, cardId });

  it("Kendine Güven: birinci +2 daha, değilse -1; Sigorta: en düşük dedektif puanı sonuncu", () => {
    expect(run([play("a", "kendine-guven")]).a).toBe(4);
    expect(run([play("b", "kendine-guven")]).b).toBe(0);
    expect(run([play("c", "sigorta")]).c).toBe(1);
  });
  it("herkes eşitse herkes birinci, kimse sonuncu değil", () => {
    const eq = { a: 1, b: 1, c: 1, d: 1 };
    expect(run([play("b", "kendine-guven")], eq).b).toBe(3);
    expect(run([play("b", "sigorta")], eq).b).toBe(1);
  });
});

describe("yazım hatası toleransı (YY-M7)", () => {
  it("6+ harfte, aynı uzunlukta tek harf farkı doğru", () => {
    expect(yaziYazWordMatch("KARPIZ", "KARPUZ")).toBe(true);
    expect(yaziYazWordMatch("karpuz", "KARPUZ")).toBe(true);
    expect(yaziYazWordMatch("KARPIX", "KARPUZ")).toBe(false);
  });
  it("eksik/fazla harf ve 5 harf altı kabul edilmez; klavye toleransı sürer", () => {
    expect(yaziYazWordMatch("KARPU", "KARPUZ")).toBe(false);
    expect(yaziYazWordMatch("ELMAS", "ELMA")).toBe(false);
    expect(yaziYazWordMatch("KİRAS", "KİRAZ")).toBe(false);
    expect(yaziYazWordMatch("CICEK", "ÇİÇEK")).toBe(true);
    expect(yaziYazWordMatch("", "ÇİÇEK")).toBe(false);
  });
  it("oyunda kelime puanı verir", () => {
    expect(scores(pick(fixed(), "c", "b", "karpiz")).c).toBe(2);
  });
});

describe("kural boşlukları (YY-M5)", () => {
  it("son eksik oyuncu koparsa aşama 1 sn sonra biter (yazma, tartışma, tahmin)", () => {
    let s = fixed();
    for (const id of ["a", "b", "c", "d"]) s = act(s, id, { kind: "lock" }, T0 + 2_000);
    expect(s.writeEndsAt).toBe(T0 + YAZI_YAZ_WRITE_MS);
    const online = ["a", "b", "c", "d"];
    const r = yaziYaz.onPresence?.(s, ctx(T0 + 3_000, online)) as State;
    expect(r.writeEndsAt).toBe(T0 + 4_000);
    expect(r.writeClosing).toBe(true);
    // Eksik varken ya da kimse bağlı değilken değişmez.
    expect(yaziYaz.onPresence?.(s, ctx(T0 + 3_000))).toBe(s);
    expect(yaziYaz.onPresence?.(s, ctx(T0 + 3_000, []))).toBe(s);

    let t = yaziYaz.tick(fixed(), ctx(TALK_AT));
    for (const id of ["a", "b"]) t = act(t, id, { kind: "skip" }, TALK_AT);
    const t2 = yaziYaz.onPresence?.(t, ctx(TALK_AT + 1, ["a", "b"])) as State;
    expect(t2.talkEndsAt).toBe(TALK_AT + 1 + 1_000);

    let g = pick(fixed(), "c", "a");
    g = act(g, "c", { kind: "lock" }, GUESS_AT);
    const g2 = yaziYaz.onPresence?.(g, ctx(GUESS_AT + 5, ["c"])) as State;
    expect(g2.guessEndsAt).toBe(GUESS_AT + 5 + 1_000);
  });

  it("kayıt tekrarı kopmayla erken bitişi aynı üretir (replay)", () => {
    const players = ["a", "b", "c"];
    let s = yaziYaz.setup(players, ctx(T0, players, 7));
    const rec = new GameRecorder("yazi-yaz", 7, players, T0);
    const [w1, w2] = s.writers as [string, string];
    const inn = players.find((p) => !s.writers.includes(p)) as string;
    const step = (who: string, a: YaziYazAction, at: number, online = players) => {
      s = act(s, who, a, at, online);
      rec.record(at, who, a);
    };
    step(w1, { kind: "write", text: "ELMA" }, T0 + 100);
    step(w1, { kind: "lock" }, T0 + 200);
    step(inn, { kind: "lock" }, T0 + 300);
    rec.presence(T0 + 400, w2, false);
    s = yaziYaz.onPresence?.(s, ctx(T0 + 400, [w1, inn])) as State;
    expect(s.writeEndsAt).toBe(T0 + 1_400);
    const res = replay(yaziYaz, rec.finish(s.finishAt));
    expect(res).toEqual(yaziYaz.result(s));
  });

  it("yazanın MASUM'u reddedilir ama yazması serbest; masumun MASUM dışı yazısı reddedilir", () => {
    const s = fixed(ALL, ["MASUM", "ELMA"]);
    const r = yaziYaz.reduce(s, "a", { kind: "lock" }, ctx(T0 + 2));
    expect(isRejected(r) && r.rejected).toBe("writer_innocent");
    const r2 = yaziYaz.reduce(s, "c", { kind: "write", text: "ELMA" }, ctx(T0 + 2));
    expect(isRejected(r2) && r2.rejected).toBe("innocent_text");
  });
});

describe("hazır işaretleri (YY-M6)", () => {
  it("yazmada kim olduğu gizli, sayı görünür; tartışma ve tahminde kimlikler görünür", () => {
    let s = fixed();
    s = act(s, "a", { kind: "lock" }, T0 + 2);
    s = act(s, "c", { kind: "lock" }, T0 + 2);
    expect(pub(s, T0 + 3)).toMatchObject({ ready: [], readyCount: 2 });
    s = act(yaziYaz.tick(s, ctx(TALK_AT)), "d", { kind: "skip" }, TALK_AT);
    expect(pub(s, TALK_AT)).toMatchObject({ ready: ["d"], readyCount: 1 });
  });
});

describe("gizlilik", () => {
  it("konu ve harf ipucu dışında kelime ya da rol herkese açık görünümde yok", () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = yaziYaz.setup(ALL, ctx(T0, ALL, seed, TOPICS));
      const [w1, w2] = s.writers as [string, string];
      s = act(s, w1, { kind: "write", text: "PORTAKAL" }, T0 + 1);
      s = act(s, w2, { kind: "write", text: "MANDALİNA" }, T0 + 1);
      for (const t of [T0 + 2, TALK_AT, GUESS_AT]) {
        const json = JSON.stringify(pub(s, t));
        expect(json).not.toContain("PORTAKAL");
        expect(json).not.toContain("MANDALİNA");
        expect(json).not.toContain("writer");
      }
    }
  });
});
