import { describe, expect, it } from "vitest";
import type { ContentSet } from "../../content.js";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { KENDIM_TOPIC_POOL, kendim, kendimCards } from "./index.js";
import {
  KENDIM_DEFAULT_TOPIC,
  KENDIM_DURATION_MS,
  KENDIM_MATCH_LARGE_MS,
  KENDIM_MATCH_MS,
  KENDIM_REVEAL_CARD_MS,
  KENDIM_REVEAL_TAIL_MS,
  KENDIM_WRITE_MS,
  type KendimPublicView,
  type KendimView,
  kendimAwards,
  kendimRevealMs,
} from "./types.js";

type State = ReturnType<typeof start>;
const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const MATCH_AT = T0 + KENDIM_WRITE_MS + 1_000;
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1, content?: ContentSet) => ({
  now,
  rng: createRng(seed),
  connected,
  ...(content ? { content } : {}),
});
const start = (players: string[] = ALL, seed = 1, content?: ContentSet) =>
  kendim.setup(players, ctx(T0, players, seed, content));

function act(
  s: State,
  who: string,
  action: unknown,
  at: number,
  connected: readonly string[] = s.players,
): State {
  const parsed = kendim.parseAction(action);
  if (parsed === null) throw new Error("geçersiz eylem");
  const r = kendim.reduce(s, who, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function reject(
  s: State,
  who: string,
  action: unknown,
  at: number,
  connected: readonly string[] = s.players,
): string {
  const parsed = kendim.parseAction(action);
  if (parsed === null) throw new Error("geçersiz eylem");
  const r = kendim.reduce(s, who, parsed, ctx(at, connected));
  if (!isRejected(r)) throw new Error("kabul edildi");
  return r.rejected;
}
const tick = (s: State, at: number): State => kendim.tick(s, ctx(at, s.players));
const pub = (s: State, at: number) => kendim.publicView(tick(s, at), ctx(at, s.players)) as KendimPublicView;
const priv = (s: State, who: string | null, at: number) =>
  kendim.view(tick(s, at), who, ctx(at, s.players)) as KendimView;

/** Herkes kelimesini yazar (kilitlemeden). */
function writeAll(words: Record<string, string>, players = ALL, seed = 1): State {
  let s = start(players, seed);
  for (const [id, text] of Object.entries(words)) s = act(s, id, { kind: "write", text }, T0 + 1_000);
  return s;
}
/** `owner`ın kartının numarası. */
const cardOf = (s: State, owner: string): number => {
  const c = kendimCards(s).find((x) => x.owner === owner);
  if (!c) throw new Error("kart yok");
  return c.id;
};
const pair = (s: State, who: string, owner: string, target: string, at = MATCH_AT): State =>
  act(s, who, { kind: "match", card: cardOf(s, owner), target }, at);
const minis = (s: State) => kendim.result(s).miniScores;
/** 4 kart: açılış 4 × 3 sn + 3 sn. */
const REVEAL4 = kendimRevealMs(4);

describe("kendim meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok; anlatımda ceza yok", () => {
    expect(kendim.minPlayers).toBe(3);
    expect(kendim.maxPlayers).toBe(8);
    expect(kendim.orientation).toBe("portrait");
    expect(kendim.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(kendim.briefing)).not.toMatch(/server|debug|protocol|stage/i);
    expect(kendim.briefing.steps[2]).toBe("Doğru eşleme +1, yanlış ceza yok");
  });

  it("KN-M4 süreler: 30 sn yazma; eşleştirme 3–5 oyuncuda 30 sn, 6–8 oyuncuda 40 sn", () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      const ids = "abcdefgh".slice(0, n).split("");
      const s = start(ids);
      expect(s.writeEndsAt - s.startedAt).toBe(30_000);
      expect(s.matchEndsAt - s.writeEndsAt).toBe(n >= 6 ? KENDIM_MATCH_LARGE_MS : KENDIM_MATCH_MS);
    }
    expect(KENDIM_MATCH_MS).toBe(30_000);
    expect(KENDIM_MATCH_LARGE_MS).toBe(40_000);
    expect(KENDIM_DURATION_MS).toBe(30_000 + 40_000 + 27_000);
  });

  it("KN-U4 açılış süresi: kart sayısı × 3 sn + 3 sn", () => {
    expect(KENDIM_REVEAL_CARD_MS).toBe(3_000);
    expect(KENDIM_REVEAL_TAIL_MS).toBe(3_000);
    expect(kendimRevealMs(0)).toBe(3_000);
    expect(kendimRevealMs(3)).toBe(12_000);
    expect(kendimRevealMs(8)).toBe(27_000);
    const s = tick(writeAll({ a: "elma", b: "armut", c: "kiraz" }), T0 + KENDIM_WRITE_MS);
    expect(s.finishAt).toBe(s.matchEndsAt + kendimRevealMs(3));
    expect(kendim.revealAt?.(s, ctx(s.matchEndsAt))).toBe(s.matchEndsAt);
  });
});

describe("konu kartı (KN-M2)", () => {
  it("havuz verilmezse yerleşik listeden konu çekilir; listenin başı bugünkü konu", () => {
    const s = start();
    expect(KENDIM_TOPIC_POOL.builtin).toContainEqual(s.topic);
    expect(KENDIM_TOPIC_POOL.builtin[0]).toEqual(KENDIM_DEFAULT_TOPIC);
    const p = pub(s, T0 + 1);
    expect(p.topic).toBe(s.topic.topic);
    expect(p.hint).toBe(s.topic.hint);
  });

  it("havuzdan konu çekilir; boş ya da bozuk havuzda yerleşik liste", () => {
    const content: ContentSet = {
      [KENDIM_TOPIC_POOL.id]: [
        { topic: "Hayvan olsaydın?", hint: "Ben bir…" },
        { topic: "Sabah ilk ne yaparsın?", hint: "Ben…" },
      ],
    };
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) seen.add(start(ALL, seed, content).topic.topic);
    expect([...seen].sort()).toEqual(["Hayvan olsaydın?", "Sabah ilk ne yaparsın?"]);
    expect(KENDIM_TOPIC_POOL.builtin).toContainEqual(start(ALL, 3, { [KENDIM_TOPIC_POOL.id]: [] }).topic);
    expect(KENDIM_TOPIC_POOL.builtin).toContainEqual(
      start(ALL, 3, { [KENDIM_TOPIC_POOL.id]: [{ topic: "<x>", hint: "Ben" }, 5] }).topic,
    );
  });

  it("konu kart sırasını değiştirmez (tohum önce çekilir)", () => {
    const words = { a: "elma", b: "armut", c: "kiraz", d: "üzüm" };
    const plain = writeAll(words, ALL, 9);
    let other = start(ALL, 9, {
      [KENDIM_TOPIC_POOL.id]: [
        { topic: "Hayvan olsaydın?", hint: "Ben bir…" },
        { topic: "Tatil yerin?", hint: "Ben…" },
      ],
    });
    for (const [id, text] of Object.entries(words))
      other = act(other, id, { kind: "write", text }, T0 + 1_000);
    expect(kendimCards(other)).toEqual(kendimCards(plain));
  });

  it("tekrar belleği: havuz 5'ten uzunsa son 5, kısaysa yalnız bir önceki", () => {
    const many = (n: number): ContentSet => ({
      [KENDIM_TOPIC_POOL.id]: Array.from({ length: n }, (_, i) => ({
        topic: `Konu numara ${i}`,
        hint: "Ben…",
      })),
    });
    const used = (s: State) => kendim.contentUsed?.(s) ?? [];
    expect(used(start(ALL, 1, many(12)))[0]).toMatchObject({ poolId: KENDIM_TOPIC_POOL.id, memory: 5 });
    expect(used(start(ALL, 1, many(5)))[0]?.memory).toBe(4);
    expect(used(start(ALL, 1, many(3)))[0]?.memory).toBe(1);
    expect(used(start(ALL, 1, many(1)))[0]).toEqual({
      poolId: KENDIM_TOPIC_POOL.id,
      key: "konu numara 0",
      memory: 1,
    });
    expect(used(start())[0]?.memory).toBe(5);
  });

  it("havuz girdisi doğrulanır: konu 3–40, ipucu 2–16 karakter", () => {
    expect(KENDIM_TOPIC_POOL.fromFields({ topic: "Hayvan olsaydın?", hint: "Ben bir…" })).toEqual({
      ok: true,
      entry: { topic: "Hayvan olsaydın?", hint: "Ben bir…" },
    });
    expect(KENDIM_TOPIC_POOL.fromFields({ topic: "ab", hint: "Ben" }).ok).toBe(false);
    expect(KENDIM_TOPIC_POOL.fromFields({ topic: "Hayvan olsaydın?", hint: "" }).ok).toBe(false);
    expect(KENDIM_TOPIC_POOL.fromFields({ topic: "a".repeat(41), hint: "Ben" }).ok).toBe(false);
    expect(KENDIM_TOPIC_POOL.unpack({ topic: "x" })).toBeNull();
  });

  it("konuyla aynı kelime gizlilik denetiminde sızıntı sayılmaz", () => {
    const s = act(start(), "a", { kind: "write", text: "anlat" }, T0 + 1);
    expect(kendim.secrets(s).map((e) => e.value)).not.toContain("ANLAT");
  });
});

describe("yazma aşaması", () => {
  it("her oyuncu tek kelime yazar; giriş temizlenir ve Türkçe büyük harfe çevrilir", () => {
    const s = start();
    const r = act(s, "a", { kind: "write", text: "  ışıklı  " }, T0 + 1);
    expect(priv(r, "a", T0 + 2).myText).toBe("IŞIKLI");
  });

  it("KN-M3: boşluklu yazı reddedilir; tire serbest; sınır 24 harf", () => {
    expect(kendim.parseAction({ kind: "write", text: "çok neşeli" })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "ışık\tevi" })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "tatlı-sert" })).toEqual({
      kind: "write",
      text: "TATLI-SERT",
    });
    expect(kendim.parseAction({ kind: "write", text: "a".repeat(24) })).not.toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "a".repeat(25) })).toBeNull();
  });

  it("kelime Tamam'a kadar değiştirilebilir, Tamam'dan sonra değil; yazmadan Tamam olmaz", () => {
    const s = start();
    expect(reject(s, "a", { kind: "lock" }, T0 + 1)).toBe("nothing_to_lock");
    let r = act(s, "a", { kind: "write", text: "elma" }, T0 + 1);
    r = act(r, "a", { kind: "write", text: "armut" }, T0 + 2);
    r = act(r, "a", { kind: "lock" }, T0 + 3);
    expect(reject(r, "a", { kind: "write", text: "kiraz" }, T0 + 4)).toBe("locked");
    expect(priv(r, "a", T0 + 5).myText).toBe("ARMUT");
  });

  it("aynı kelimeyi birden çok oyuncu yazabilir", () => {
    const s = writeAll({ a: "kedi", b: "KEDİ", c: "köpek" });
    expect(s.texts.a).toBe(s.texts.b);
    expect(kendimCards(s)).toHaveLength(3);
  });

  it("bozuk girişler ayrıştırılmaz; süre bitince yazma reddedilir", () => {
    expect(kendim.parseAction({ kind: "write", text: "a".repeat(25) })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "   " })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "a‮b" })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: 5 })).toBeNull();
    expect(kendim.parseAction({ kind: "write", text: "ev", x: 1 })).toBeNull();
    expect(kendim.parseAction({ kind: "match", card: -1, target: "a" })).toBeNull();
    expect(kendim.parseAction({ kind: "match", card: 1.5, target: "a" })).toBeNull();
    expect(kendim.parseAction({ kind: "match", card: 1, target: 3 })).toBeNull();
    expect(kendim.parseAction({ kind: "match", card: 1 })).toBeNull();
    const s = start();
    expect(reject(s, "a", { kind: "write", text: "ev" }, T0 + KENDIM_WRITE_MS)).toBe("not_writing");
    expect(reject(s, "ghost", { kind: "write", text: "ev" }, T0 + 1)).toBe("not_participant");
    expect(reject(s, "a", { kind: "write", text: "ev" }, T0 - 1)).toBe("not_started");
  });

  it("yazma sırasında eşleştirme yok", () => {
    const s = writeAll({ a: "ev", b: "kedi", c: "çay", d: "mavi" });
    expect(reject(s, "a", { kind: "match", card: 0, target: "b" }, T0 + 2_000)).toBe("not_matching");
  });
});

describe("kartlar", () => {
  it("kartlar yazılan kelimelerdir, karışık sırada, sahipleri görünümde yok; kendi kartını görmezsin", () => {
    const s = writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });
    const v = priv(s, "a", MATCH_AT);
    expect(v.cards.map((c) => c.text).sort()).toEqual(["ARMUT", "KİRAZ", "ÜZÜM"]);
    expect(v.cards.map((c) => c.text)).not.toContain("ELMA");
    for (const id of ALL) {
      const own = s.texts[id];
      expect(priv(s, id, MATCH_AT).cards.some((c) => c.text === own && own !== undefined)).toBe(false);
    }
    expect(JSON.stringify(v)).not.toContain('"owner"');
  });

  it("kart sırası katılımcı sırasına bağlı değildir (tohuma göre karışık)", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" }, ALL, seed);
      orders.add(
        kendimCards(s)
          .map((c) => c.owner)
          .join(""),
      );
    }
    expect(orders.size).toBeGreaterThan(10);
  });

  it("kelime yazmayan oyuncunun kartı olmaz", () => {
    const s = writeAll({ a: "elma", b: "armut", c: "kiraz" });
    expect(kendimCards(s)).toHaveLength(3);
    expect(pub(s, MATCH_AT).owners).toEqual(["a", "b", "c"]);
    expect(priv(s, "d", MATCH_AT).cards).toHaveLength(3);
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "b"), target: "d" }, MATCH_AT)).toBe("no_word");
  });
});

describe("eşleştirme kuralları", () => {
  const base = () => writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });

  it("kendi kartını eşleştiremez ve kendini seçemez", () => {
    const s = base();
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "a"), target: "b" }, MATCH_AT)).toBe("own_card");
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "b"), target: "a" }, MATCH_AT)).toBe(
      "self_target",
    );
    expect(reject(s, "a", { kind: "match", card: 50, target: "b" }, MATCH_AT)).toBe("unknown_card");
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "b"), target: "zzz" }, MATCH_AT)).toBe(
      "unknown_target",
    );
  });

  it("her kart en çok bir kişiye, her kişi en çok bir karta eşlenir; eşleştirme değiştirilebilir", () => {
    let s = base();
    s = pair(s, "a", "b", "c");
    s = pair(s, "a", "b", "d"); // kart başka kişiye
    expect(priv(s, "a", MATCH_AT).myPairs).toEqual({ [String(cardOf(s, "b"))]: "d" });
    s = pair(s, "a", "c", "d"); // d artık başka karta: eski kart boşalır
    expect(priv(s, "a", MATCH_AT).myPairs).toEqual({ [String(cardOf(s, "c"))]: "d" });
    s = act(s, "a", { kind: "match", card: cardOf(s, "c"), target: null }, MATCH_AT);
    expect(priv(s, "a", MATCH_AT).myPairs).toEqual({});
  });

  it("tüm kartları eşleştirmek zorunlu değil; eşleştirmeler gizli (başkasının görünümünde yok)", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    expect(priv(s, "b", MATCH_AT).myPairs).toEqual({});
    expect(priv(s, null, MATCH_AT).myPairs).toEqual({});
    expect(JSON.stringify(pub(s, MATCH_AT))).not.toContain('"pairs"');
    expect(pub(s, MATCH_AT).reveal).toBeNull();
  });

  it("süre sonunda ve Tamam'dan sonra eşleştirme reddedilir", () => {
    let s = base();
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "b"), target: "b" }, s.matchEndsAt)).toBe("ended");
    s = act(s, "a", { kind: "lock" }, MATCH_AT);
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "b"), target: "b" }, MATCH_AT)).toBe("locked");
    expect(reject(s, "a", { kind: "lock" }, MATCH_AT)).toBe("locked");
  });
});

describe("puanlama (KN-M1)", () => {
  const base = () => writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });

  it("doğru eşleştirme +1, yanlış 0 (ceza yok), boş kart 0", () => {
    let s = base();
    s = pair(s, "a", "b", "b"); // doğru
    s = pair(s, "a", "c", "d"); // yanlış: 0
    expect(minis(s).a).toBe(1);
    for (const v of Object.values(minis(s))) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("yalnızca tek kişi doğru bulduysa kart sahibine +1 bonus", () => {
    let s = base();
    s = pair(s, "a", "b", "b"); // b'nin kartını yalnız a doğru buldu
    s = pair(s, "c", "b", "d"); // c yanlış: 0
    s = pair(s, "b", "c", "c"); // b doğru +1, c'nin kartını yalnız b buldu: c bonus +1
    expect(minis(s)).toEqual({ a: 1, b: 2, c: 1, d: 0 });
  });

  it("birden çok kişi doğru bulursa bonus yok; kimse bulamazsa da yok", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "c", "b", "b");
    s = pair(s, "d", "a", "c"); // a'nın kartını kimse bulamadı
    s = pair(s, "b", "d", "a"); // b yanlış: 0
    expect(minis(s)).toEqual({ a: 1, b: 0, c: 1, d: 0 });
    const rev = kendim.publicView(tick(s, s.matchEndsAt), ctx(s.matchEndsAt)).reveal;
    expect(rev?.cards.find((c) => c.owner === "b")).toMatchObject({ bonus: false });
    expect(rev?.cards.find((c) => c.owner === "a")).toMatchObject({ bonus: false, finders: [] });
  });

  it("sessiz oyuncu kuralı yok: hiç eşleme yapmasan da kelimeni tek kişi bulursa bonus alırsın", () => {
    let s = base();
    s = pair(s, "a", "d", "d"); // doğru
    s = pair(s, "b", "d", "a"); // yanlış
    s = pair(s, "c", "d", "a"); // yanlış
    expect(minis(s).d).toBe(1);
    expect(minis(s).a).toBe(1);
  });

  it("kelime yazmayan oyuncu eşleyip puan toplar ama bonus alamaz", () => {
    let s = writeAll({ a: "elma", b: "armut", c: "kiraz" });
    s = pair(s, "d", "a", "a");
    s = pair(s, "d", "b", "b");
    expect(minis(s).d).toBe(2);
    expect(kendimCards(s).some((c) => c.owner === "d")).toBe(false);
  });

  it("aynı kelimeyi yazanlar denktir; kartlar ikiz olarak işaretlenir", () => {
    let s = writeAll({ a: "kedi", b: "kedi", c: "çay", d: "mavi" });
    const dup = kendimCards(s).filter((c) => c.text === "KEDİ");
    const first = dup[0];
    const second = dup[1];
    if (!first || !second) throw new Error("kedi kartları yok");
    s = act(s, "c", { kind: "match", card: first.id, target: second.owner }, MATCH_AT);
    s = act(s, "d", { kind: "match", card: second.id, target: second.owner }, MATCH_AT);
    expect(minis(s).c).toBe(1);
    expect(minis(s).d).toBe(1);
    const rev = pub(s, s.matchEndsAt).reveal;
    expect(rev?.cards.filter((c) => c.twin).map((c) => c.text)).toEqual(["KEDİ", "KEDİ"]);
    expect(rev?.cards.find((c) => c.text === "ÇAY")?.twin).toBe(false);
  });

  it("ödül: en yüksek +2, sonraki farklı toplam +1, diğerleri 0", () => {
    expect(kendimAwards({ a: 3, b: 2, c: 1, d: 0 })).toEqual({ a: 2, b: 1, c: 0, d: 0 });
    // Birincide eşitlik: hepsi +2; sonraki farklı toplam +1.
    expect(kendimAwards({ a: 3, b: 3, c: 1, d: 1 })).toEqual({ a: 2, b: 2, c: 1, d: 1 });
    // Tanıma puanı 0 olan ödül almaz.
    expect(kendimAwards({ a: 2, b: 0, c: 0 })).toEqual({ a: 2, b: 0, c: 0 });
    // Herkes eşit ve > 0: herkes +1; hepsi 0: kimse.
    expect(kendimAwards({ a: 2, b: 2, c: 2 })).toEqual({ a: 1, b: 1, c: 1 });
    expect(kendimAwards({ a: 0, b: 0, c: 0 })).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("result: miniScores tanıma puanı, awards +2/+1/0; kimse bulamadıysa ödül yok", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "a", "c", "c");
    s = pair(s, "c", "b", "b");
    // a: 2, b: 0 (kartını a ve c buldu: bonus yok), c: 1 + (kartını yalnız a buldu) 1 = 2, d: 0
    const res = kendim.result(s);
    expect(res.miniScores).toEqual({ a: 2, b: 0, c: 2, d: 0 });
    expect(res.awards).toEqual({ a: 2, b: 0, c: 2, d: 0 });
    let z = base();
    z = pair(z, "a", "b", "c");
    z = pair(z, "b", "a", "c");
    expect(kendim.result(z).awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(kendim.result(base()).awards).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("açılışta kartlar sahipleri, bulanlar, eşleştirmeler, sıra ve ödüllerle açılır", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "a", "c", "d");
    s = pair(s, "b", "d", "a");
    const rev = pub(s, s.matchEndsAt).reveal;
    expect(rev?.cards.find((c) => c.owner === "b")).toMatchObject({
      text: "ARMUT",
      finders: ["a"],
      bonus: true,
      twin: false,
    });
    expect(rev?.pairs.a).toEqual(
      expect.arrayContaining([
        { card: cardOf(s, "b"), target: "b", ok: true },
        { card: cardOf(s, "c"), target: "d", ok: false },
      ]),
    );
    expect(rev?.scores).toEqual({ a: 1, b: 1, c: 0, d: 0 });
    expect(rev?.awards).toEqual({ a: 2, b: 2, c: 0, d: 0 });
    expect([...(rev?.order ?? [])].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("erken bitiş", () => {
  const lockAll = (
    s: State,
    at: number,
    ids = s.players,
    connected: readonly string[] = s.players,
  ): State => {
    let r = s;
    for (const id of ids) r = act(r, id, { kind: "lock" }, at, connected);
    return r;
  };
  const written = () => writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });

  it("(a) yazma: herkes Tamam deyince 1 sn sonra biter; eşleştirme süresi kayar", () => {
    const s = lockAll(written(), T0 + 2_000);
    expect(s.writeEndsAt).toBe(T0 + 3_000);
    expect(s.matchEndsAt).toBe(T0 + 3_000 + KENDIM_MATCH_MS);
    expect(s.finishAt).toBe(s.matchEndsAt + REVEAL4);
    expect(pub(s, T0 + 2_500).stage).toBe("write");
    expect(pub(s, T0 + 3_000).stage).toBe("match");
  });

  it("(b) yazma: bir kişi eksikken bitmez", () => {
    const s = lockAll(written(), T0 + 2_000, ["a", "b", "c"]);
    expect(s.writeEndsAt).toBe(T0 + KENDIM_WRITE_MS);
  });

  it("(c) yazma: bağlantısı kopan oyuncu beklenmez", () => {
    const s = lockAll(written(), T0 + 2_000, ["a", "b", "c"], ["a", "b", "c"]);
    expect(s.writeEndsAt).toBe(T0 + 3_000);
  });

  it("(d)(e) yazma: kilit sonrası değişiklik reddedilir; hazır listesi kelime sızdırmaz", () => {
    const s = lockAll(written(), T0 + 2_000, ["a"]);
    expect(reject(s, "a", { kind: "write", text: "yeni" }, T0 + 2_100)).toBe("locked");
    const json = JSON.stringify(pub(s, T0 + 2_100));
    expect(pub(s, T0 + 2_100).ready).toEqual(["a"]);
    for (const w of ["ELMA", "ARMUT", "KİRAZ"]) expect(json).not.toContain(w);
  });

  it("(a) eşleştirme: herkes Tamam deyince 1 sn sonra biter; boş Tamam serbest", () => {
    const s0 = written();
    const s = lockAll(s0, MATCH_AT);
    expect(s.matchEndsAt).toBe(MATCH_AT + 1_000);
    expect(s.finishAt).toBe(MATCH_AT + 1_000 + REVEAL4);
    expect(pub(s, MATCH_AT + 1_000).stage).toBe("reveal");
  });

  it("(b)(c) eşleştirme: bir kişi eksikken bitmez; kopan oyuncu beklenmez", () => {
    const s0 = written();
    expect(lockAll(s0, MATCH_AT, ["a", "b", "c"]).matchEndsAt).toBe(s0.matchEndsAt);
    expect(lockAll(s0, MATCH_AT, ["a", "b", "c"], ["a", "b", "c"]).matchEndsAt).toBe(MATCH_AT + 1_000);
  });

  it("(d)(e) eşleştirme: kilit sonrası reddedilir; hazır listesi eşleştirme içermez", () => {
    let s = written();
    s = pair(s, "a", "b", "b");
    s = act(s, "a", { kind: "lock" }, MATCH_AT);
    expect(reject(s, "a", { kind: "match", card: cardOf(s, "c"), target: "c" }, MATCH_AT + 5)).toBe("locked");
    const json = JSON.stringify(pub(s, MATCH_AT + 5));
    expect(pub(s, MATCH_AT + 5).ready).toEqual(["a"]);
    expect(json).not.toContain('"card"');
    expect(json).not.toContain('"pairs"');
  });
});

describe("gizlilik", () => {
  it("(yapısal) kart-sahip ilişkisi hiçbir görünümde sonuçtan önce yok", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = writeAll({ a: "elmasız", b: "armutsuz", c: "kirazsız", d: "üzümsüz" }, ALL, seed);
      for (const t of [MATCH_AT, s.matchEndsAt - 1]) {
        const pj = JSON.stringify(pub(s, t));
        expect(pj).not.toContain('"owner"');
        for (const id of ALL) {
          const v = priv(s, id, t);
          const j = JSON.stringify(v);
          expect(j).not.toContain('"owner"');
          expect(v.cards.some((c) => c.text === s.texts[id])).toBe(false);
        }
      }
    }
  });

  it("(yapısal) yazma aşamasında kimse başkasının kelimesini görmez; secrets yalnız yazma aşamasında", () => {
    const s = writeAll({ a: "elmasız", b: "armutsuz", c: "kirazsız", d: "üzümsüz" });
    for (const id of ALL) {
      const j = JSON.stringify(priv(s, id, T0 + 2_000));
      for (const other of ALL) {
        if (other !== id) expect(j).not.toContain(String(s.texts[other]));
      }
    }
    expect(kendim.secrets(s)).toHaveLength(4);
    for (const e of kendim.secrets(s)) expect(e.ownerIds).toHaveLength(1);
    expect(kendim.secrets(tick(s, s.writeEndsAt))).toEqual([]);
  });

  it("KN-U7: eşleştirmede kartlar herkese sahipsiz açık; yazmada yok", () => {
    const s = writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });
    expect(pub(s, T0 + 2_000).cards).toEqual([]);
    const p = pub(s, MATCH_AT);
    expect(p.cards.map((c) => c.text).sort()).toEqual(["ARMUT", "ELMA", "KİRAZ", "ÜZÜM"]);
    expect(p.cards).toEqual(kendimCards(s).map(({ id, text }) => ({ id, text })));
    expect(JSON.stringify(p)).not.toContain('"owner"');
  });

  it("yazma sırasında bitiş anı kaç kişinin yazdığını göstermez", () => {
    const s0 = start();
    const s = act(s0, "a", { kind: "write", text: "elma" }, T0 + 1);
    expect(pub(s, T0 + 2).finishAt).toBe(pub(s0, T0 + 2).finishAt);
  });

  it("izleyici görünümü boştur", () => {
    const s = writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });
    expect(priv(s, null, MATCH_AT)).toEqual({ myText: null, locked: false, cards: [], myPairs: {} });
    expect(priv(s, "ghost", MATCH_AT).cards).toEqual([]);
  });
});

describe("görünüm zamanlaması", () => {
  it("aşamalar tick ile ilerler ve her geçişte durum değişir (yayın tetiklenir)", () => {
    const s = start();
    const t1 = tick(s, s.writeEndsAt);
    expect(t1).not.toBe(s);
    expect(tick(t1, s.writeEndsAt + 5)).toBe(t1);
    const t2 = tick(t1, s.matchEndsAt);
    expect([t1.stage, t2.stage]).toEqual(["match", "reveal"]);
  });

  it("bitişten sonra eylem reddedilir", () => {
    const s = tick(writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" }), T0 + KENDIM_WRITE_MS);
    expect(s.finishAt).toBe(s.matchEndsAt + REVEAL4);
    expect(reject(s, "a", { kind: "lock" }, s.finishAt + 5)).toBe("ended");
    expect(kendim.isFinished(s, ctx(s.finishAt - 1))).toBe(false);
    expect(kendim.isFinished(s, ctx(s.finishAt))).toBe(true);
    // tick beklenmez: bitiş kart sayısından hesaplanır.
    const raw = writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });
    expect(kendim.isFinished(raw, ctx(raw.matchEndsAt + REVEAL4 - 1))).toBe(false);
    expect(kendim.isFinished(raw, ctx(raw.matchEndsAt + REVEAL4))).toBe(true);
  });
});
