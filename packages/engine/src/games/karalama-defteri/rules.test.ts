import { describe, expect, it } from "vitest";
import { pairSuggestion, parseEntry, poolEntries } from "../../content.js";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { findLeaks } from "../../testing/index.js";
import {
  closenessOf,
  karalamaDefteri as game,
  KARALAMA_PAIRS,
  KARALAMA_POOL,
  KARALAMA_WORD_MEMORY_ID,
  type KaralamaPair,
  type KaralamaState,
  karalamaGuessMatch,
  pickKaralamaPair,
} from "./index.js";
import {
  KARALAMA_DRAW_MS,
  KARALAMA_FINAL_MS,
  KARALAMA_GUESS_MS,
  KARALAMA_UNMASK_MS,
  type KaralamaAction,
  karalamaVoteMs,
} from "./types.js";

const T0 = 1_000_000;
const PLAYERS = ["a", "b", "c", "d"];
const ctx = (at: number, connected: readonly string[] = PLAYERS, seed = 1) => ({
  now: T0 + at,
  rng: createRng(seed),
  connected,
});
const VOTE_AT = KARALAMA_DRAW_MS + 1_000;
const VOTE_END_AT = KARALAMA_DRAW_MS + karalamaVoteMs(4);
const GUESS_AT = VOTE_END_AT + KARALAMA_UNMASK_MS;
const GUESS_END_AT = GUESS_AT + KARALAMA_GUESS_MS;

function start(outsider = "c", main = "elma", near = "armut"): KaralamaState {
  const s = game.setup(PLAYERS, ctx(0));
  return { ...s, outsider, mainWord: main, nearWord: near, pairKey: [main, near].sort().join("|") };
}
function act(
  s: KaralamaState,
  id: string,
  action: KaralamaAction,
  at: number,
  connected?: readonly string[],
) {
  const r = game.reduce(s, id, action, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reasonOf = (s: KaralamaState, id: string, action: KaralamaAction, at: number) => {
  const r = game.reduce(s, id, action, ctx(at));
  return isRejected(r) ? r.rejected : null;
};
const guess = (text: string): KaralamaAction => ({ kind: "guess", text });
const vote = (target: string): KaralamaAction => ({ kind: "vote", target });
/** Oylama "a,b -> c" (yakalandı) ile son şansa kadar. */
const toGuess = (s = start()) => {
  let r = act(s, "a", vote("c"), VOTE_AT);
  r = act(r, "b", vote("c"), VOTE_AT);
  return game.tick(r, ctx(GUESS_AT));
};

describe("KD-M1 son şans", () => {
  it("parseAction: guess yalnız kind + metin", () => {
    expect(game.parseAction({ kind: "guess", text: "elma" })).toEqual({ kind: "guess", text: "elma" });
    expect(game.parseAction({ kind: "guess" })).toBeNull();
    expect(game.parseAction({ kind: "guess", text: "" })).toBeNull();
    expect(game.parseAction({ kind: "guess", text: 3 })).toBeNull();
    expect(game.parseAction({ kind: "guess", text: "x".repeat(200) })).toBeNull();
    expect(game.parseAction({ kind: "guess", text: "a", extra: 1 })).toBeNull();
  });

  it("açılış 5 sn, son şans 12 sn; yalnız bilgisiz ve yalnız son şansta tahmin eder", () => {
    let s = act(start(), "a", vote("c"), VOTE_AT);
    expect(reasonOf(s, "c", guess("elma"), VOTE_AT + 10)).toBe("not_guess");
    s = game.tick(s, ctx(VOTE_END_AT));
    expect(s.stage).toBe("unmask");
    expect(reasonOf(s, "c", guess("elma"), VOTE_END_AT + 100)).toBe("not_guess");
    s = game.tick(s, ctx(GUESS_AT));
    expect(s.stage).toBe("guess");
    expect(reasonOf(s, "a", guess("elma"), GUESS_AT + 100)).toBe("not_outsider");
    expect(reasonOf(s, "c", guess("   "), GUESS_AT + 100)).toBe("bad_guess");
    expect(reasonOf(s, "c", guess("elma"), GUESS_END_AT)).toBe("not_guess");
  });

  it("doğru tahmin +1; yakalansa da kurtulsa da (en çok +2)", () => {
    const caught = act(toGuess(), "c", guess("Elma"), GUESS_AT + 2_000);
    expect(game.result(game.tick(caught, ctx(GUESS_END_AT + 10_000))).awards).toEqual({
      a: 1,
      b: 1,
      c: 1,
      d: 0,
    });
    const free = game.tick(act(start(), "a", vote("b"), VOTE_AT), ctx(GUESS_AT));
    const s = act(free, "c", guess("elma"), GUESS_AT + 1_000);
    expect(game.result(game.tick(s, ctx(GUESS_END_AT + 10_000))).awards.c).toBe(2);
  });

  it("tek tahmin, kesin; gönderilince kelimeler 1 sn sonra açılır", () => {
    const s = act(toGuess(), "c", guess("kiraz"), GUESS_AT + 2_000);
    expect(s.guessEndsAt).toBe(T0 + GUESS_AT + 3_000);
    expect(s.finishAt).toBe(T0 + GUESS_AT + 3_000 + KARALAMA_FINAL_MS);
    expect(reasonOf(s, "c", guess("elma"), GUESS_AT + 2_500)).toBe("locked");
    expect(game.publicView(s, ctx(GUESS_AT + 2_500)).reveal?.guessSent).toBe(true);
    // Yazdığı kelime açılışa kadar gizli.
    expect(JSON.stringify(game.publicView(s, ctx(GUESS_AT + 2_500)))).not.toContain("kiraz");
    const done = game.tick(s, ctx(GUESS_AT + 3_000));
    expect(done.stage).toBe("done");
    expect(game.publicView(done, ctx(GUESS_AT + 3_000)).reveal?.final).toEqual({
      mainWord: "elma",
      guess: "kiraz",
      guessed: false,
      scores: { a: 1, b: 1, c: 0, d: 0 },
    });
    expect(game.revealAt?.(done, ctx(GUESS_AT + 3_000))).toBe(T0 + GUESS_AT + 3_000);
    expect(game.isFinished(done, ctx(GUESS_AT + 3_000 + KARALAMA_FINAL_MS - 1))).toBe(false);
    expect(game.isFinished(done, ctx(GUESS_AT + 3_000 + KARALAMA_FINAL_MS))).toBe(true);
  });

  it("revealAt son şans bitmeden yok; tahmin gelmezse 12 sn sonunda", () => {
    const s = toGuess();
    expect(game.revealAt?.(s, ctx(GUESS_AT + 100))).toBeNull();
    expect(game.revealAt?.(s, ctx(GUESS_END_AT))).toBe(T0 + GUESS_END_AT);
  });

  it("eşleşme: klavyeden bağımsız, 6+ harfte tek harf farkı; yakın kelime hiç doğru sayılmaz", () => {
    expect(karalamaGuessMatch("ELMA", "elma", "armut")).toBe(true);
    expect(karalamaGuessMatch("cicek", "çiçek", "gül")).toBe(true);
    expect(karalamaGuessMatch("elmaa", "elma", "armut")).toBe(false);
    expect(karalamaGuessMatch("alma", "elma", "armut")).toBe(false);
    expect(karalamaGuessMatch("bisiklat", "bisiklet", "motosiklet")).toBe(true);
    expect(karalamaGuessMatch("bisikle", "bisiklet", "motosiklet")).toBe(false);
    expect(karalamaGuessMatch("armut", "elma", "armut")).toBe(false);
    expect(karalamaGuessMatch("kaplan", "aslan", "kaplan")).toBe(false);
  });

  it("bilgisiz oylama bitiminde bağlı değilse son şans hiç açılmaz, oyun beklemez", () => {
    let s = act(start(), "a", vote("c"), VOTE_AT);
    s = game.onPresence?.(s, ctx(VOTE_AT + 100, ["a", "b", "d"])) ?? s;
    expect(s.outsiderAway).toBe(true);
    s = game.tick(s, ctx(VOTE_END_AT));
    expect(s.guessEndsAt).toBe(s.guessOpensAt);
    const done = game.tick(s, ctx(GUESS_AT));
    expect(done.stage).toBe("done");
    expect(game.isFinished(done, ctx(GUESS_AT + KARALAMA_FINAL_MS))).toBe(true);
  });

  it("bilgisiz son şans sürerken koparsa 1 sn sonra açılır (tahmin 0)", () => {
    const s = toGuess();
    const away = game.onPresence?.(s, ctx(GUESS_AT + 2_000, ["a", "b", "d"])) ?? s;
    expect(away.guessEndsAt).toBe(T0 + GUESS_AT + 3_000);
    expect(game.result(away).awards.c).toBe(0);
  });

  it("açılış ve son şans sürerken ana kelime hiçbir ekranda yok; bilgisizin kelimesi açık", () => {
    const opened = game.tick(act(start(), "a", vote("c"), VOTE_AT), ctx(VOTE_END_AT));
    for (const s of [opened, toGuess()]) {
      const at = s.stage === "unmask" ? VOTE_END_AT + 10 : GUESS_AT + 10;
      expect(findLeaks(game, s, PLAYERS, T0 + at)).toEqual([]);
      for (const id of ["a", "b", "d", null]) expect(game.view(s, id, ctx(at)).word).toBeNull();
      expect(game.view(s, "c", ctx(at)).word).toBe("armut");
      const pub = JSON.stringify(game.publicView(s, ctx(at)));
      expect(pub).not.toContain("elma");
      expect(pub).toContain("armut");
      expect(game.publicView(s, ctx(at)).reveal?.final).toBeNull();
    }
  });
});

describe("KD-M4 çift yönü", () => {
  const one = (pair: KaralamaPair): readonly KaralamaPair[] => Array.from({ length: 10 }, () => pair);
  const content = (pair: KaralamaPair) => ({
    [KARALAMA_POOL.id]: one(pair).map((p) => KARALAMA_POOL.toFields(p)),
  });

  it("yön rastgele: aynı çiftte bazen Kelime 1, bazen Kelime 2 çoğunluğun", () => {
    const pair: KaralamaPair = { main: "elma", near: "armut", closeness: null, fixed: false };
    const mains = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = game.setup(PLAYERS, { ...ctx(0, PLAYERS, seed), content: content(pair) });
      mains.add(s.mainWord);
      expect([s.mainWord, s.nearWord].sort()).toEqual(["armut", "elma"]);
      expect(s.pairKey).toBe("armut|elma");
    }
    expect(mains).toEqual(new Set(["elma", "armut"]));
  });

  it("yön sabit: Kelime 1 hep çoğunluğun", () => {
    const pair: KaralamaPair = { main: "elma", near: "armut", closeness: null, fixed: true };
    for (let seed = 1; seed <= 30; seed++) {
      const s = game.setup(PLAYERS, { ...ctx(0, PLAYERS, seed), content: content(pair) });
      expect(s.mainWord).toBe("elma");
    }
  });
});

describe("KD-M5 tekrar önleme", () => {
  it("çift (yönden bağımsız anahtar) 50 oyun, iki kelime 10 oyun (20 kelime) hafızaya bildirilir", () => {
    const used = game.contentUsed?.(start("c", "armut", "elma")) ?? [];
    expect(used).toEqual([
      { poolId: KARALAMA_POOL.id, key: "armut|elma", memory: 50 },
      { poolId: KARALAMA_WORD_MEMORY_ID, key: "armut", memory: 20 },
      { poolId: KARALAMA_WORD_MEMORY_ID, key: "elma", memory: 20 },
    ]);
    expect(KARALAMA_POOL.related?.id).toBe(KARALAMA_WORD_MEMORY_ID);
    const pair = KARALAMA_PAIRS.find((p) => p.main === "kuğu");
    expect(pair && KARALAMA_POOL.related?.keys(pair)).toEqual(["kuğu", "ördek"]);
  });
});

describe("KD-M6 yakınlık", () => {
  const P = (main: string, near: string, closeness: KaralamaPair["closeness"]): KaralamaPair => ({
    main,
    near,
    closeness,
    fixed: false,
  });
  const pool = [
    P("aaa", "bbb", "çok yakın"),
    P("ccc", "ddd", "yakın"),
    P("eee", "fff", "uzak"),
    P("ggg", "hhh", null),
  ];

  it("3–5 oyuncu yalnız yakın (etiketsiz = yakın); uzak hiç çekilmez", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) seen.add(pickKaralamaPair(pool, 5, ctx(0, PLAYERS, seed)).main);
    expect(seen).toEqual(new Set(["ccc", "ggg"]));
  });

  it("6–8 oyuncu yaklaşık yarı yarıya yakın / çok yakın", () => {
    let close = 0;
    for (let seed = 1; seed <= 200; seed++)
      if (pickKaralamaPair(pool, 8, ctx(0, PLAYERS, seed)).main === "aaa") close++;
    expect(close).toBeGreaterThan(60);
    expect(close).toBeLessThan(140);
  });

  it("uygun etiket kalmazsa şart düşer", () => {
    expect(pickKaralamaPair([P("aaa", "bbb", "çok yakın")], 3, ctx(0)).main).toBe("aaa");
    expect(pickKaralamaPair([P("eee", "fff", "uzak")], 3, ctx(0)).main).toBe("eee");
  });

  it("yerleşik havuzda uzak çift kurulumda çıkmaz; etiketler dağılımı", () => {
    const far = KARALAMA_PAIRS.filter((p) => closenessOf(p) === "uzak").map((p) => p.main);
    expect(far.length).toBeGreaterThan(0);
    for (let seed = 1; seed <= 200; seed++) {
      const s = game.setup(PLAYERS, ctx(0, PLAYERS, seed));
      expect(far.includes(s.mainWord) || far.includes(s.nearWord)).toBe(false);
    }
    expect(KARALAMA_PAIRS.filter((p) => closenessOf(p) === "çok yakın").length).toBeGreaterThan(20);
  });

  it("havuz alanları: Kelime 1/2, isteğe bağlı Yakınlık ve Yön; eski kayıt okunur", () => {
    expect(KARALAMA_POOL.fields.map((f) => f.label)).toEqual(["Kelime 1", "Kelime 2", "Yakınlık", "Yön"]);
    expect(parseEntry(KARALAMA_POOL, { main: "elma", near: "armut" })).toEqual({
      main: "elma",
      near: "armut",
      closeness: null,
      fixed: false,
    });
    const ok = KARALAMA_POOL.fromFields({
      main: "Kiraz",
      near: "vişne",
      closeness: "Çok Yakın",
      direction: "sabit",
    });
    expect(ok).toEqual({
      ok: true,
      entry: { main: "kiraz", near: "vişne", closeness: "çok yakın", fixed: true },
    });
    expect(
      KARALAMA_POOL.fromFields({ main: "elma", near: "armut", closeness: "orta", direction: "" }).ok,
    ).toBe(false);
    expect(
      KARALAMA_POOL.fromFields({ main: "elma", near: "armut", closeness: "", direction: "ters" }).ok,
    ).toBe(false);
    const back = KARALAMA_POOL.toFields({ main: "elma", near: "armut", closeness: "uzak", fixed: true });
    expect(back).toEqual({ main: "elma", near: "armut", closeness: "uzak", direction: "sabit" });
    expect(KARALAMA_POOL.unpack({ main: "elma", near: "armut", closeness: 3 })).toBeNull();
  });

  it("etiketli özel havuz kurulumda kullanılır", () => {
    const list = Array.from({ length: 10 }, (_, i) => ({
      main: `kel${"abcdefghij"[i]}`,
      near: `yak${"abcdefghij"[i]}`,
      closeness: i === 0 ? "uzak" : "",
      direction: "sabit",
    }));
    const pairs = poolEntries(KARALAMA_POOL, { [KARALAMA_POOL.id]: list });
    expect(pairs).toHaveLength(10);
    for (let seed = 1; seed <= 40; seed++) {
      const s = game.setup(PLAYERS, { ...ctx(0, PLAYERS, seed), content: { [KARALAMA_POOL.id]: list } });
      expect(s.mainWord).not.toBe("kela");
    }
  });
});

describe("KD-M7 oylama süresi", () => {
  it("3–4: 30 sn, 5–6: 40 sn, 7–8: 50 sn", () => {
    expect([3, 4, 5, 6, 7, 8].map(karalamaVoteMs)).toEqual([30_000, 30_000, 40_000, 40_000, 50_000, 50_000]);
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const s = game.setup(eight, { now: T0, rng: createRng(3), connected: eight });
    expect(s.voteEndsAt - s.drawEndsAt).toBe(50_000);
    expect(game.publicView(s, ctx(0)).voteMs).toBe(50_000);
  });

  it("son eksik oyuncu koparsa (onPresence) erken bitiş denetlenir", () => {
    let s = act(start(), "a", vote("b"), VOTE_AT);
    for (const id of ["b", "c"]) s = act(s, id, vote("a"), VOTE_AT);
    const r = game.onPresence?.(s, ctx(VOTE_AT + 1_000, ["a", "b", "c"])) ?? s;
    expect(r.voteEndsAt).toBe(T0 + VOTE_AT + 4_000);
  });
});

describe("KD-M8 çift karnesi", () => {
  it("oyun sonunda yalnız iki sayı: yakalandı mı, bildi mi", () => {
    const s = act(toGuess(), "c", guess("elma"), GUESS_AT + 1_000);
    expect(game.contentFeedback?.(s)).toEqual([
      { poolId: KARALAMA_POOL.id, key: "armut|elma", play: { top: 1, single: 1 } },
    ]);
    const free = game.tick(start(), ctx(GUESS_END_AT));
    expect(game.contentFeedback?.(free)).toEqual([
      { poolId: KARALAMA_POOL.id, key: "armut|elma", play: { top: 0, single: 0 } },
    ]);
    expect(KARALAMA_POOL.playStats).toBe(true);
    expect(KARALAMA_POOL.playKind).toBe("cift");
  });

  it("öneri eşikleri: en az 8 oyun; yakalanma ≥ %85 uzak, ≤ %15 çok yakın", () => {
    expect(pairSuggestion({ games: 7, top: 1, single: 0 })).toBeNull();
    expect(pairSuggestion({ games: 8, top: 0.85, single: 0 })).toBe("uzak");
    expect(pairSuggestion({ games: 8, top: 0.15, single: 0 })).toBe("çok yakın");
    expect(pairSuggestion({ games: 20, top: 0.5, single: 0.5 })).toBeNull();
  });
});
