import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { sanitizeWord } from "../text.js";
import { yaziYaz } from "./index.js";
import {
  YAZI_YAZ_DURATION_MS,
  YAZI_YAZ_GUESS_MS,
  YAZI_YAZ_REVEAL_MS,
  YAZI_YAZ_TALK_MS,
  YAZI_YAZ_WRITE_MS,
  type YaziYazAction,
  type YaziYazPublicView,
  type YaziYazView,
} from "./types.js";

type State = ReturnType<typeof start>;
const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d", "e"];
const TALK_AT = T0 + YAZI_YAZ_WRITE_MS + 1_000;
const GUESS_AT = T0 + YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + 1_000;
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players: string[] = ALL, seed = 1) => yaziYaz.setup(players, ctx(T0, players, seed));

function act(
  s: State,
  who: string,
  action: YaziYazAction,
  at: number,
  connected: readonly string[] = s.players,
): State {
  const parsed = yaziYaz.parseAction(action);
  if (parsed === null) throw new Error("geçersiz eylem");
  const r = yaziYaz.reduce(s, who, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reject = (
  s: State,
  who: string,
  action: YaziYazAction,
  at: number,
  connected: readonly string[] = s.players,
): string => {
  const parsed = yaziYaz.parseAction(action);
  if (parsed === null) throw new Error("geçersiz eylem");
  const r = yaziYaz.reduce(s, who, parsed, ctx(at, connected));
  if (!isRejected(r)) throw new Error("kabul edildi");
  return r.rejected;
};
const tick = (s: State, at: number): State => yaziYaz.tick(s, ctx(at, s.players));
const pub = (s: State, at: number) =>
  yaziYaz.publicView(tick(s, at), ctx(at, s.players)) as YaziYazPublicView;
const priv = (s: State, who: string | null, at: number) =>
  yaziYaz.view(tick(s, at), who, ctx(at, s.players)) as YaziYazView;
const innocentsOf = (s: State) => s.players.filter((p) => !s.writers.includes(p));

/** Herkes yazar (yazanlar verilen kelimeleri, masumlar MASUM) ve kilitler. */
function writeAll(s: State, words: [string, string], lock = true, at = T0 + 2_000): State {
  let st = s;
  const [w1, w2] = s.writers as [string, string];
  st = act(st, w1, { kind: "write", text: words[0] }, at);
  st = act(st, w2, { kind: "write", text: words[1] }, at);
  for (const id of innocentsOf(s)) st = act(st, id, { kind: "write", text: "masum" }, at);
  if (lock) for (const id of s.players) st = act(st, id, { kind: "lock" }, at);
  return st;
}

describe("yazı yaz meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(yaziYaz.minPlayers).toBe(3);
    expect(yaziYaz.maxPlayers).toBe(8);
    expect(yaziYaz.orientation).toBe("portrait");
    expect(yaziYaz.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(yaziYaz.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("süreler: 30 sn yazma, 60 sn tartışma, 30 sn tahmin", () => {
    const s = start();
    expect(s.writeEndsAt - s.startedAt).toBe(30_000);
    expect(s.talkEndsAt - s.writeEndsAt).toBe(60_000);
    expect(s.guessEndsAt - s.talkEndsAt).toBe(30_000);
    expect(s.finishAt - s.startedAt).toBe(YAZI_YAZ_DURATION_MS);
    expect(YAZI_YAZ_REVEAL_MS).toBeLessThanOrEqual(10_000);
  });
});

describe("yazan seçimi", () => {
  it("her oyuncu sayısında ve tohumda tam iki farklı yazan seçilir, katılımcı sırasıyla", () => {
    const seen = new Set<string>();
    for (let n = 3; n <= 8; n++) {
      const players = Array.from({ length: n }, (_, i) => `p${i + 1}`);
      for (let seed = 1; seed <= 30; seed++) {
        const s = start(players, seed);
        expect(s.writers).toHaveLength(2);
        expect(new Set(s.writers).size).toBe(2);
        for (const w of s.writers) expect(players).toContain(w);
        expect(s.writers).toEqual(players.filter((p) => s.writers.includes(p)));
        seen.add(s.writers.join());
      }
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it("aynı tohum aynı yazanları verir", () => {
    expect(start(ALL, 7).writers).toEqual(start(ALL, 7).writers);
  });
});

describe("yazma aşaması", () => {
  it("yazan kendi kelimesini yazar; giriş büyük harfe çevrilir (Türkçe)", () => {
    const s = start();
    const w = s.writers[0] as string;
    const r = act(
      s,
      w,
      yaziYaz.parseAction({ kind: "write", text: " ışık  istanbul " }) as YaziYazAction,
      T0 + 1,
    );
    expect(priv(r, w, T0 + 2).myText).toBe("IŞIK İSTANBUL");
  });

  it("masum yalnız MASUM yazabilir (büyük/küçük harf farkı etkilemez)", () => {
    const s = start();
    const i = innocentsOf(s)[0] as string;
    expect(yaziYaz.parseAction({ kind: "write", text: "masum" })).toEqual({ kind: "write", text: "MASUM" });
    expect(yaziYaz.parseAction({ kind: "write", text: "Masum" })).toEqual({ kind: "write", text: "MASUM" });
    expect(reject(s, i, { kind: "write", text: "ELMA" }, T0 + 1)).toBe("innocent_text");
    const ok = act(s, i, { kind: "write", text: "MASUM" }, T0 + 1);
    expect(priv(ok, i, T0 + 2).myText).toBe("MASUM");
  });

  it("iki yazan aynı kelimeyi yazabilir", () => {
    const s = writeAll(start(), ["KEDİ", "kedi".toLocaleUpperCase("tr-TR")]);
    const [a, b] = s.writers as [string, string];
    expect(s.texts[a]).toBe(s.texts[b]);
  });

  it("yazan MASUM da yazabilir", () => {
    const s = start();
    const w = s.writers[0] as string;
    expect(priv(act(s, w, { kind: "write", text: "MASUM" }, T0 + 1), w, T0 + 2).myText).toBe("MASUM");
  });

  it("kelime girişi sunucuda temizlenir ve sınırlanır", () => {
    expect(sanitizeWord("  merhaba\t\ndünya ")).toBe("MERHABA DÜNYA");
    expect(sanitizeWord("iı")).toBe("İI");
    expect(sanitizeWord("")).toBeNull();
    expect(sanitizeWord("   ")).toBeNull();
    expect(sanitizeWord("!!!")).toBeNull();
    expect(sanitizeWord("a‮b")).toBeNull(); // yön değiştirme
    expect(sanitizeWord("a​b")).toBeNull(); // sıfır genişlik
    expect(sanitizeWord("a\u0000b")).toBe("A B");
    expect(sanitizeWord("a".repeat(24))).toHaveLength(24);
    expect(sanitizeWord("a".repeat(25))).toBeNull();
    expect(sanitizeWord("a".repeat(5000))).toBeNull();
    expect(sanitizeWord(`e${"́".repeat(4)}`)).toBeNull(); // yığılan işaretler
    expect(sanitizeWord(42)).toBeNull();
    expect(yaziYaz.parseAction({ kind: "write", text: "a".repeat(25) })).toBeNull();
    expect(yaziYaz.parseAction({ kind: "write", text: "ok", extra: 1 })).toBeNull();
    expect(yaziYaz.parseAction({ kind: "write" })).toBeNull();
  });

  it("süre bitince yazma reddedilir, yazılmamış kalan yazan boş kalır", () => {
    const s = start();
    const w = s.writers[0] as string;
    expect(reject(s, w, { kind: "write", text: "ELMA" }, T0 + YAZI_YAZ_WRITE_MS)).toBe("not_writing");
    expect(reject(s, w, { kind: "write", text: "ELMA" }, T0 - 1)).toBe("not_started");
  });

  it("Tamam'dan sonra değişiklik reddedilir; yazmadan Tamam olmaz", () => {
    const s = start();
    const w = s.writers[0] as string;
    expect(reject(s, w, { kind: "lock" }, T0 + 1)).toBe("nothing_to_lock");
    let r = act(s, w, { kind: "write", text: "ELMA" }, T0 + 1);
    r = act(r, w, { kind: "write", text: "ARMUT" }, T0 + 2);
    r = act(r, w, { kind: "lock" }, T0 + 3);
    expect(reject(r, w, { kind: "write", text: "KİRAZ" }, T0 + 4)).toBe("locked");
    expect(reject(r, w, { kind: "lock" }, T0 + 4)).toBe("locked");
    expect(priv(r, w, T0 + 5).myText).toBe("ARMUT");
  });

  it("katılımcı olmayan eylem yapamaz", () => {
    expect(reject(start(), "ghost", { kind: "write", text: "MASUM" }, T0 + 1)).toBe("not_participant");
  });
});

describe("erken bitiş: yazma", () => {
  it("(a) herkes kilitleyince yazma 1 sn sonra biter", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"]);
    expect(s.writeEndsAt).toBe(T0 + 2_000 + 1_000);
    expect(s.talkEndsAt).toBe(s.writeEndsAt + YAZI_YAZ_TALK_MS);
    expect(s.finishAt).toBe(s.writeEndsAt + YAZI_YAZ_TALK_MS + YAZI_YAZ_GUESS_MS + YAZI_YAZ_REVEAL_MS);
    expect(pub(s, T0 + 2_500).stage).toBe("write");
    expect(pub(s, T0 + 3_000).stage).toBe("talk");
  });

  it("(b) bir kişi eksikken bitmez", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"], false);
    let r = s;
    const last = s.players[s.players.length - 1] as string;
    for (const id of s.players.filter((p) => p !== last)) r = act(r, id, { kind: "lock" }, T0 + 2_000);
    expect(r.writeEndsAt).toBe(T0 + YAZI_YAZ_WRITE_MS);
    expect(pub(r, T0 + 2_000).ready).toHaveLength(s.players.length - 1);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"], false);
    const online = s.players.slice(0, 4);
    let r = s;
    for (const id of online) r = act(r, id, { kind: "lock" }, T0 + 2_000, online);
    expect(r.writeEndsAt).toBe(T0 + 3_000);
  });

  it("(d) kilit sonrası değişiklik reddedilir; kapanış penceresinde de", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"]);
    const w = s.writers[0] as string;
    expect(reject(s, w, { kind: "write", text: "YENİ" }, T0 + 2_500)).toBe("locked");
  });

  it("(e) hazır listesi yalnız kimlerin kilitlediğini gösterir; kelime ve rol sızmaz", () => {
    const s = writeAll(start(), ["ELMASIZ", "ARMUTSUZ"], false);
    const [w] = s.writers as [string];
    const r = act(s, w, { kind: "lock" }, T0 + 2_000);
    const json = JSON.stringify(pub(r, T0 + 2_100));
    expect(pub(r, T0 + 2_100).ready).toEqual([w]);
    expect(json).not.toContain("ELMASIZ");
    expect(json).not.toContain("writer");
    expect(json).not.toContain("MASUM");
  });
});

describe("tartışma aşaması", () => {
  it("tartışmada yazma ve tahmin yok", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"], false);
    const w = s.writers[0] as string;
    expect(reject(s, w, { kind: "write", text: "X1" }, TALK_AT)).toBe("not_writing");
    expect(reject(s, w, { kind: "guessPlayer", target: "a" === w ? "b" : "a" }, TALK_AT)).toBe(
      "not_guessing",
    );
    expect(reject(s, w, { kind: "guessWord", text: "ELMA" }, TALK_AT)).toBe("not_guessing");
    expect(reject(s, w, { kind: "lock" }, TALK_AT)).toBe("not_locking");
  });

  it("tartışma sırasında 'Tahmine geçelim' yalnız tartışmada geçerli", () => {
    const s = writeAll(start(), ["ELMA", "ARMUT"], false);
    expect(reject(s, "a", { kind: "skip" }, T0 + 5_000)).toBe("not_talking");
    expect(reject(s, "a", { kind: "skip" }, GUESS_AT)).toBe("not_talking");
  });

  it("herkes atlamak isterse tartışma 1 sn sonra biter ve tahmin süresi kayar", () => {
    let s = writeAll(start(), ["ELMA", "ARMUT"]);
    const at = s.writeEndsAt + 5_000;
    for (const id of s.players) s = act(s, id, { kind: "skip" }, at);
    expect(s.talkEndsAt).toBe(at + 1_000);
    expect(s.guessEndsAt).toBe(at + 1_000 + YAZI_YAZ_GUESS_MS);
    expect(pub(s, at + 500).stage).toBe("talk");
    expect(pub(s, at + 1_000).stage).toBe("guess");
  });

  it("bir kişi eksikken tartışma bitmez; kopan oyuncu beklenmez", () => {
    let s = writeAll(start(), ["ELMA", "ARMUT"]);
    const at = s.writeEndsAt + 5_000;
    for (const id of s.players.slice(0, 4)) s = act(s, id, { kind: "skip" }, at);
    expect(s.talkEndsAt).toBe(s.writeEndsAt + YAZI_YAZ_TALK_MS);
    const online = s.players.slice(0, 4);
    const r = act(writeAll(start(), ["ELMA", "ARMUT"]), "a", { kind: "skip" }, at, ["a"]);
    expect(r.talkEndsAt).toBe(at + 1_000);
    expect(online).toHaveLength(4);
  });

  it("atlama listesi herkese açık, roller değil", () => {
    let s = writeAll(start(), ["ELMA", "ARMUT"]);
    const at = s.writeEndsAt + 5_000;
    s = act(s, "c", { kind: "skip" }, at);
    expect(pub(s, at + 10).ready).toEqual(["c"]);
    expect(priv(s, "c", at + 10).locked).toBe(true);
    expect(priv(s, "a", at + 10).locked).toBe(false);
  });
});

describe("tahmin aşaması ve puanlama", () => {
  /** a ve b yazan olacak biçimde kurar (rol sabitlemek için doğrudan durum). */
  const fixed = (players = ALL, words: [string, string] = ["ELMA", "ARMUT"]): State => {
    const s0 = { ...start(players), writers: [players[0] as string, players[1] as string] };
    let s = s0;
    s = act(s, "a", { kind: "write", text: words[0] }, T0 + 1);
    s = act(s, "b", { kind: "write", text: words[1] }, T0 + 1);
    for (const id of players.slice(2)) s = act(s, id, { kind: "write", text: "MASUM" }, T0 + 1);
    return s;
  };
  const guess = (s: State, who: string, target: string | null, word: string, at = GUESS_AT): State => {
    let r = s;
    if (target !== null) r = act(r, who, { kind: "guessPlayer", target }, at);
    if (word !== "") r = act(r, who, { kind: "guessWord", text: word }, at);
    return r;
  };
  const scoresOf = (s: State) => yaziYaz.result(s).miniScores;

  it("masum doğru yazanı ve kelimesini bilir: +1 kişi +1 kelime", () => {
    const s = guess(fixed(), "c", "a", "elma");
    expect(scoresOf(s).c).toBe(2);
    expect(yaziYaz.result(s).awards.c).toBe(2);
  });

  it("doğru kişi, yanlış kelime: yalnız +1", () => {
    expect(scoresOf(guess(fixed(), "c", "a", "armut")).c).toBe(1);
    expect(scoresOf(guess(fixed(), "c", "b", "armut")).c).toBe(2);
  });

  it("yanlış kişi (masum) seçilirse kelime doğru olsa da 0", () => {
    expect(scoresOf(guess(fixed(), "c", "d", "elma")).c).toBe(0);
    expect(scoresOf(guess(fixed(), "c", "d", "MASUM")).c).toBe(0);
  });

  it("yazan, diğer yazanı ve kelimesini bilirse aynı puanı alır", () => {
    const s = guess(fixed(), "a", "b", "armut");
    expect(scoresOf(s).a).toBe(2);
    expect(scoresOf(guess(fixed(), "b", "a", "elma")).b).toBe(2);
  });

  it("yazan masumu seçerse 0; kendini seçemez", () => {
    const s = fixed();
    expect(scoresOf(guess(s, "a", "c", "elma")).a).toBe(0);
    expect(reject(s, "a", { kind: "guessPlayer", target: "a" }, GUESS_AT)).toBe("self_target");
  });

  it("tahmin vermeyen 0 alır, eksi puan yok", () => {
    const s = fixed();
    for (const v of Object.values(scoresOf(s))) expect(v).toBe(0);
    const only = guess(s, "c", "a", "");
    expect(scoresOf(only)).toEqual({ a: 0, b: 0, c: 1, d: 0, e: 0 });
  });

  it("kelime tahmini boş bırakılırsa yalnız kişi puanı", () => {
    expect(scoresOf(guess(fixed(), "d", "b", "")).d).toBe(1);
  });

  it("kelimesini hiç yazmayan yazanın kelimesi bilinemez", () => {
    let s = { ...start(ALL), writers: ["a", "b"] } as State;
    s = act(s, "a", { kind: "write", text: "ELMA" }, T0 + 1);
    s = guess(s, "c", "b", "ARMUT");
    expect(scoresOf(s).c).toBe(1);
    s = guess(s, "d", "b", "MASUM");
    expect(scoresOf(s).d).toBe(1);
  });

  it("iki yazan aynı kelimeyi yazdıysa her iki yazanın tahmini kelimeyi verir", () => {
    const s = fixed(ALL, ["KEDİ", "KEDİ"]);
    expect(scoresOf(guess(s, "c", "a", "kedi")).c).toBe(2);
    expect(scoresOf(guess(s, "d", "b", "kedi")).d).toBe(2);
  });

  it("karşılaştırma temizlenmiş biçimle yapılır (boşluk, Türkçe harf)", () => {
    const s = fixed(ALL, ["IŞIK  EVİ", "ARMUT"]);
    const g = yaziYaz.parseAction({ kind: "guessWord", text: " ışık   evi " }) as YaziYazAction;
    let r = act(s, "c", { kind: "guessPlayer", target: "a" }, GUESS_AT);
    r = act(r, "c", g, GUESS_AT);
    expect(scoresOf(r).c).toBe(2);
  });

  it("tahmin değiştirilebilir (son seçim geçerli) ve Tamam'a kadar", () => {
    let s = fixed();
    s = guess(s, "c", "d", "yanlis");
    s = guess(s, "c", "a", "elma");
    expect(priv(s, "c", GUESS_AT).myGuess).toEqual({ target: "a", word: "ELMA" });
    s = act(s, "c", { kind: "lock" }, GUESS_AT);
    expect(reject(s, "c", { kind: "guessPlayer", target: "b" }, GUESS_AT)).toBe("locked");
    expect(reject(s, "c", { kind: "guessWord", text: "X1" }, GUESS_AT)).toBe("locked");
    expect(scoresOf(s).c).toBe(2);
  });

  it("kişi seçmeden Tamam olmaz; bilinmeyen hedef reddedilir; süre sonunda tahmin yok", () => {
    const s = fixed();
    expect(reject(s, "c", { kind: "lock" }, GUESS_AT)).toBe("nothing_to_lock");
    expect(reject(s, "c", { kind: "guessPlayer", target: "zzz" }, GUESS_AT)).toBe("unknown_target");
    expect(reject(s, "c", { kind: "guessPlayer", target: "a" }, s.guessEndsAt)).toBe("ended");
    expect(reject(s, "c", { kind: "write", text: "MASUM" }, s.finishAt + 5)).toBe("ended");
  });

  it("bağlantısı kopmuş bir yazan da tahmin edilebilir", () => {
    const s = fixed();
    const online = ["b", "c", "d", "e"];
    const r = act(s, "c", { kind: "guessPlayer", target: "a" }, GUESS_AT, online);
    expect(scoresOf(r).c).toBe(1);
  });

  it("awards = miniScores ve ayrı bonus yok", () => {
    let s = fixed();
    s = guess(s, "c", "a", "elma");
    s = guess(s, "d", "b", "armut");
    s = guess(s, "e", "d", "x1");
    s = guess(s, "a", "b", "armut");
    const res = yaziYaz.result(s);
    expect(res.awards).toEqual(res.miniScores);
    expect(res.miniScores).toEqual({ a: 2, b: 0, c: 2, d: 2, e: 0 });
  });
});

describe("erken bitiş: tahmin", () => {
  const ready = (): State => {
    let s = writeAll(start(), ["ELMA", "ARMUT"]);
    const at = s.writeEndsAt + 2_000;
    for (const id of s.players) s = act(s, id, { kind: "skip" }, at);
    return s;
  };
  const pickAll = (s: State, at: number, ids: readonly string[], connected?: readonly string[]): State => {
    let r = s;
    for (const id of ids) {
      const target = s.players.find((p) => p !== id) as string;
      r = act(r, id, { kind: "guessPlayer", target }, at, connected);
      r = act(r, id, { kind: "lock" }, at, connected);
    }
    return r;
  };

  it("(a) herkes kilitleyince tahmin 1 sn sonra biter", () => {
    const s0 = ready();
    const at = s0.talkEndsAt + 3_000;
    const s = pickAll(s0, at, s0.players);
    expect(s.guessEndsAt).toBe(at + 1_000);
    expect(s.finishAt).toBe(at + 1_000 + YAZI_YAZ_REVEAL_MS);
    expect(pub(s, at + 1_000).stage).toBe("reveal");
    expect(pub(s, at + 1_000).reveal).not.toBeNull();
  });

  it("(b) bir kişi eksikken bitmez", () => {
    const s0 = ready();
    const at = s0.talkEndsAt + 3_000;
    const s = pickAll(s0, at, s0.players.slice(0, 4));
    expect(s.guessEndsAt).toBe(s0.talkEndsAt + YAZI_YAZ_GUESS_MS);
  });

  it("(c) bağlantısı kopan oyuncu beklenmez", () => {
    const s0 = ready();
    const at = s0.talkEndsAt + 3_000;
    const online = s0.players.slice(0, 3);
    const s = pickAll(s0, at, online, online);
    expect(s.guessEndsAt).toBe(at + 1_000);
  });

  it("(d)(e) kilit sonrası değişiklik reddedilir; hazır listesi seçim içermez", () => {
    const s0 = ready();
    const at = s0.talkEndsAt + 3_000;
    const s = pickAll(s0, at, ["a"]);
    expect(reject(s, "a", { kind: "guessPlayer", target: "c" }, at + 1)).toBe("locked");
    const json = JSON.stringify(pub(s, at + 1));
    expect(pub(s, at + 1).ready).toEqual(["a"]);
    expect(json).not.toContain('"target"');
    expect(json).not.toContain('"guesses"');
  });
});

describe("açılış ve gizlilik", () => {
  const playTo = (seed: number): State => {
    let s = start(ALL, seed);
    s = writeAll(s, ["ELMASIZ", "ARMUTSUZ"]);
    return s;
  };

  it("sonuç yalnız tahmin bittikten sonra açılır; yazanlar, kelimeler ve tahminler birlikte", () => {
    let s = playTo(3);
    const c = innocentsOf(s)[0] as string;
    const [w1] = s.writers as [string];
    const at = s.talkEndsAt + 1_000;
    s = act(s, c, { kind: "guessPlayer", target: w1 }, at);
    s = act(s, c, { kind: "guessWord", text: "elmasız" }, at);
    expect(pub(s, at).reveal).toBeNull();
    const end = s.guessEndsAt;
    const rev = pub(s, end).reveal;
    expect(rev?.writers).toEqual(s.writers);
    expect(Object.values(rev?.words ?? {}).sort()).toEqual(["ARMUTSUZ", "ELMASIZ"]);
    expect(rev?.guesses[c]).toEqual({ target: w1, word: "ELMASIZ", personOk: true, wordOk: true });
    expect(rev?.scores[c]).toBe(2);
  });

  it("(yapısal) herkese açık görünüm hiçbir aşamada rol ya da kelime içermez, sonuç öncesi", () => {
    const s = playTo(5);
    const times = [T0 + 1, TALK_AT, s.talkEndsAt + 5_000, s.guessEndsAt - 1];
    for (const t of times) {
      const json = JSON.stringify(pub(s, t));
      expect(json).not.toContain("ELMASIZ");
      expect(json).not.toContain("ARMUTSUZ");
      expect(json).not.toContain("role");
      expect(json).not.toContain("writers");
    }
  });

  it("(yapısal) masum yazanı, yazan da diğer yazanı kendi görünümünden öğrenemez", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = playTo(seed);
      for (const t of [T0 + 5, TALK_AT, s.talkEndsAt + 5_000]) {
        for (const id of s.players) {
          const v = priv(s, id, t);
          expect(v.role).toBe(s.writers.includes(id) ? "writer" : "innocent");
          const json = JSON.stringify(v);
          // Kendi rolü dışında hiçbir oyuncu kimliği/rolü görünümde yok.
          for (const other of s.players) if (other !== id) expect(json).not.toContain(`"${other}"`);
        }
        const spectator = JSON.stringify(priv(s, null, t));
        expect(spectator).not.toContain("ELMASIZ");
        expect(priv(s, null, t).role).toBeNull();
        expect(priv(s, "ghost", t).role).toBeNull();
      }
    }
  });

  it("secrets: yazanın kelimesi yalnız sahibinde; sonuç açılınca boş", () => {
    const s = playTo(2);
    const entries = yaziYaz.secrets(s);
    expect(entries.map((e) => e.value).sort()).toEqual(["ARMUTSUZ", "ELMASIZ"]);
    for (const e of entries) expect(e.ownerIds).toHaveLength(1);
    expect(yaziYaz.secrets(tick(s, s.guessEndsAt))).toEqual([]);
  });

  it("MASUM yazan yazan için gizli kelime olarak innocentlara sızmış sayılmaz", () => {
    const s0 = start();
    const w = s0.writers[0] as string;
    const s = act(s0, w, { kind: "write", text: "MASUM" }, T0 + 1);
    const e = yaziYaz.secrets(s).find((x) => x.value === "MASUM");
    expect(e).toBeDefined();
  });
});

describe("görünüm zamanlaması", () => {
  it("aşamalar tick ile ilerler ve her geçişte durum değişir (yayın tetiklenir)", () => {
    const s = start();
    const t1 = tick(s, s.writeEndsAt);
    expect(t1).not.toBe(s);
    expect(tick(t1, s.writeEndsAt + 5)).toBe(t1);
    const t2 = tick(t1, s.talkEndsAt);
    const t3 = tick(t2, s.guessEndsAt);
    expect([t1.stage, t2.stage, t3.stage]).toEqual(["talk", "guess", "reveal"]);
    expect(tick(s, s.guessEndsAt).stage).toBe("reveal");
  });

  it("bitiş", () => {
    const s = start();
    expect(yaziYaz.isFinished(s, ctx(s.finishAt - 1))).toBe(false);
    expect(yaziYaz.isFinished(s, ctx(s.finishAt))).toBe(true);
  });
});
