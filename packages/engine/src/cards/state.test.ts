import { describe, expect, it } from "vitest";
import { isRejected } from "../game.js";
import { GAMES } from "../games/index.js";
import {
  CARD_IDS,
  CARDS,
  type CardId,
  type CardSettings,
  DEFAULT_CARD_SETTINGS,
  MAX_HAND,
} from "./catalog.js";
import {
  applyCardEvent,
  type CardEvent,
  CardRecorder,
  type CardsState,
  createCardsState,
  type PlayContext,
  pickDone,
  replayCards,
} from "./state.js";
import { mineCards, parseCardsMine, parseCardsPublic, publicCards } from "./view.js";

const PL = ["a", "b", "c"];
const scores = { a: 6, b: 3, c: 0 };

function ok(state: CardsState, ev: CardEvent): CardsState {
  const r = applyCardEvent(state, ev);
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
const reason = (state: CardsState, ev: CardEvent): string | null => {
  const r = applyCardEvent(state, ev);
  return isRejected(r) ? r.rejected : null;
};
const open = (s: CardsState, present = PL): CardsState => ok(s, { k: "open", scores, present });
const ctx = (over: Partial<PlayContext> = {}): PlayContext => ({
  participants: PL,
  present: PL,
  remaining: ["g1", "g2", "g3"],
  selectable: ["g2", "g9"],
  ...over,
});
/** Elini doğrudan kurar (testin konusu çekiliş değilse). */
function withHand(s: CardsState, id: string, hand: CardId[]): CardsState {
  const c = JSON.parse(JSON.stringify(s)) as CardsState;
  (c.by[id] as { hand: CardId[] }).hand = hand;
  return c;
}
/** Seçeneklerinden `want` sınıfında bir kart bulunana dek tohum arar. */
function seedWhere(
  pred: (s: CardsState) => boolean,
  settings: CardSettings = DEFAULT_CARD_SETTINGS,
): CardsState {
  for (let seed = 1; seed < 5000; seed++) {
    const s = open(createCardsState(seed, PL, settings));
    if (pred(s)) return createCardsState(seed, PL, settings);
  }
  throw new Error("uygun tohum yok");
}
const optionsOf = (s: CardsState, id: string): CardId[] => s.picking?.[id]?.options ?? [];

describe("kart kimlikleri", () => {
  it("oyun kimlikleriyle çakışmaz", () => {
    for (const id of CARD_IDS) expect(Object.hasOwn(GAMES, id)).toBe(false);
  });
});

describe("aşama açılışı", () => {
  it("her oyuncuya 3 seçenek verir ve oyuncular bağımsızdır", () => {
    const s = open(createCardsState(11, PL, DEFAULT_CARD_SETTINGS));
    for (const id of PL) expect(optionsOf(s, id)).toHaveLength(3);
    const lists = PL.map((id) => optionsOf(s, id).join());
    expect(new Set(lists).size).toBeGreaterThan(1);
  });
  it("aynı tohum aynı seçenekleri verir; durum girdisi değişmez", () => {
    const base = createCardsState(99, PL, DEFAULT_CARD_SETTINGS);
    const before = JSON.stringify(base);
    const a = open(base);
    expect(JSON.stringify(base)).toBe(before);
    expect(optionsOf(open(createCardsState(99, PL, DEFAULT_CARD_SETTINGS)), "b")).toEqual(optionsOf(a, "b"));
  });
  it("odada olmayan oyuncuya seçenek verilmez", () => {
    const s = open(createCardsState(5, PL, DEFAULT_CARD_SETTINGS), ["a", "b"]);
    expect(s.picking?.c).toBeUndefined();
  });
  it("hiç etkin kart yoksa herkes bitmiş sayılır", () => {
    const s = open(createCardsState(5, PL, { enabled: true, off: [...CARD_IDS] }));
    expect(pickDone(s).sort()).toEqual(PL);
  });
  it("ana anahtar kapalıysa etkin kart yoktur", () => {
    expect(createCardsState(1, PL, { enabled: false, off: [] }).enabled).toEqual([]);
  });
});

describe("seçim, el sınırı, değiştirme", () => {
  const goodFirst = () => seedWhere((s) => !CARDS[optionsOf(s, "a")[0] as CardId].rarity.startsWith("kotu"));
  it("iyi kart ele girer ve oyuncu biter", () => {
    const s = ok(open(goodFirst()), { k: "pick", p: "a", i: 0 });
    const card = optionsOf(s, "a")[0] as CardId;
    expect(s.by.a?.hand).toEqual([card]);
    expect(s.picking?.a?.done).toBe(true);
  });
  it("aynı seçeneği ikinci kez ya da biten oyuncu tekrar seçemez", () => {
    const s = ok(open(goodFirst()), { k: "pick", p: "a", i: 0 });
    expect(reason(s, { k: "pick", p: "a", i: 1 })).toBe("not_picking");
    expect(reason(open(goodFirst()), { k: "pick", p: "a", i: 9 })).toBe("bad_option");
    expect(reason(open(goodFirst()), { k: "pick", p: "z", i: 0 })).toBe("not_picking");
  });
  it("el doluyken iyi kart değiştirme bekler; elden atınca yer değişir", () => {
    const s0 = withHand(goodFirst(), "a", ["kalkan", "takviye"]);
    const s1 = ok(open(s0), { k: "pick", p: "a", i: 0 });
    const card = optionsOf(s1, "a")[0] as CardId;
    expect(s1.picking?.a?.held).toBe(card);
    expect(s1.picking?.a?.done).toBe(false);
    expect(reason(s1, { k: "pick", p: "a", i: 1 })).toBe("not_picking");
    const s2 = ok(s1, { k: "discard", p: "a", drop: 0 });
    expect(s2.by.a?.hand).toEqual(["takviye", card]);
    expect(s2.picking?.a?.done).toBe(true);
  });
  it("yeni kartı atmak eli korur", () => {
    const s1 = ok(open(withHand(goodFirst(), "a", ["kalkan", "takviye"])), { k: "pick", p: "a", i: 0 });
    const s2 = ok(s1, { k: "discard", p: "a", drop: "new" });
    expect(s2.by.a?.hand).toEqual(["kalkan", "takviye"]);
  });
  it("değiştirme geçersiz dizinle reddedilir; değiştirme yokken karar istenemez", () => {
    const s1 = ok(open(withHand(goodFirst(), "a", ["kalkan", "takviye"])), { k: "pick", p: "a", i: 0 });
    expect(reason(s1, { k: "discard", p: "a", drop: 2 })).toBe("bad_card");
    expect(reason(open(goodFirst()), { k: "discard", p: "a", drop: "new" })).toBe("not_discarding");
  });
  it("süre dolunca değiştirme bekleyen yeni kart atılır, elde kalanlar korunur", () => {
    const s1 = ok(open(withHand(goodFirst(), "a", ["kalkan", "takviye"])), { k: "pick", p: "a", i: 0 });
    const closed = ok(s1, { k: "close" });
    expect(closed.by.a?.hand).toEqual(["kalkan", "takviye"]);
    expect(closed.picking).toBeNull();
  });
  it("süre dolunca seçmeyen herkese rastgele (deterministik) kart verilir", () => {
    const a = ok(open(createCardsState(21, PL, DEFAULT_CARD_SETTINGS)), { k: "close" });
    const b = ok(open(createCardsState(21, PL, DEFAULT_CARD_SETTINGS)), { k: "close" });
    expect(a.by).toEqual(b.by);
    for (const id of PL) {
      const pc = a.by[id];
      const got =
        (pc?.hand.length ?? 0) +
        (pc?.pending.length ?? 0) +
        (a.announce.filter((x) => x.playerId === id).length > 0 ? 0 : 0);
      expect(
        got + a.announce.filter((x) => x.playerId === id && !pc?.pending.includes(x.cardId)).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });
  it("el hiçbir zaman 2 kartı aşmaz", () => {
    for (let seed = 0; seed < 200; seed++) {
      let s = createCardsState(seed, PL, DEFAULT_CARD_SETTINGS);
      for (let round = 0; round < 6; round++)
        s = ok(ok(open(s), { k: "close" }), { k: "commit", ctx: ctx() });
      for (const id of PL) expect(s.by[id]?.hand.length).toBeLessThanOrEqual(MAX_HAND);
    }
  });
});

describe("kötü kartların zamanlaması", () => {
  const only = (...ids: CardId[]): CardSettings => ({
    enabled: true,
    off: CARD_IDS.filter((c) => !ids.includes(c)),
  });
  const pickAll = (s: CardsState, card: CardId): CardsState => {
    let cur = open(s);
    for (const id of PL) {
      const i = optionsOf(cur, id).indexOf(card);
      if (i >= 0) cur = ok(cur, { k: "pick", p: id, i });
    }
    return cur;
  };
  it("Talihsizlik ele girmez, sonraki oyuna bekler ve duyurulur", () => {
    const s = pickAll(createCardsState(1, PL, only("talihsizlik", "kalkan")), "talihsizlik");
    const holder = PL.find((id) => s.by[id]?.pending.includes("talihsizlik"));
    expect(holder).toBeDefined();
    expect(s.by[holder as string]?.hand).not.toContain("talihsizlik");
    expect(s.announce.some((a) => a.cardId === "talihsizlik" && a.playerId === holder)).toBe(true);
  });
  it("Boş El elindeki rastgele kartı yakar; el boşsa etkisiz", () => {
    const base = createCardsState(3, PL, only("bos-el"));
    const full = pickAll(withHand(base, "a", ["kalkan", "takviye"]), "bos-el");
    expect(full.by.a?.hand).toHaveLength(1);
    const empty = pickAll(base, "bos-el");
    expect(empty.by.b?.hand).toEqual([]);
    expect(empty.announce).toHaveLength(3);
  });
  it("Sessizlik bir sonraki aşamayı kaçırtır ve diğer bayrakları bekletir", () => {
    const s1 = pickAll(createCardsState(4, PL, only("sessizlik", "kor-secim")), "sessizlik");
    const silenced = PL.filter((id) => s1.by[id]?.silenced);
    expect(silenced.length).toBeGreaterThan(0);
    const s2 = open(ok(ok(s1, { k: "close" }), { k: "commit", ctx: ctx() }));
    for (const id of silenced) {
      expect(s2.picking?.[id]?.silenced).toBe(true);
      expect(s2.picking?.[id]?.done).toBe(true);
      expect(s2.by[id]?.silenced).toBe(false);
    }
    expect(publicCards(s2, false).phase?.silenced.sort()).toEqual(silenced.sort());
  });
  it("Sessizlikli oyuncunun Kör Seçim bayrağı sonraki aşamaya kalır", () => {
    let s = createCardsState(4, PL, only("sessizlik"));
    s = withFlags(s, "a", { silenced: true, blind: true });
    s = open(s);
    expect(s.picking?.a?.silenced).toBe(true);
    expect(s.by.a?.blind).toBe(true);
    const next = open(ok(s, { k: "close" }));
    expect(next.picking?.a?.blind).toBe(true);
  });
  it("Kör Seçim: sonraki aşamada seçenekler gizli gelir, yalnız o aşamada", () => {
    let s = withFlags(createCardsState(5, PL, DEFAULT_CARD_SETTINGS), "a", { blind: true });
    s = open(s);
    expect(s.picking?.a?.blind).toBe(true);
    expect(mineCards(s, "a")?.pick?.options).toEqual([null, null, null]);
    expect(mineCards(s, "b")?.pick?.options.every((o) => o !== null)).toBe(true);
    const after = open(ok(s, { k: "close" }));
    expect(after.picking?.a?.blind).toBe(false);
  });
  it("Geniş Seçim 4 kart verir ve tüketilir", () => {
    let s = withFlags(createCardsState(6, PL, DEFAULT_CARD_SETTINGS), "a", { wide: true });
    s = open(s);
    expect(optionsOf(s, "a")).toHaveLength(4);
    expect(optionsOf(s, "b")).toHaveLength(3);
    expect(optionsOf(open(ok(s, { k: "close" })), "a")).toHaveLength(3);
  });
  it("Kumarbaz: 2 seçim hakkı, ikincisi kalan seçeneklerden; bayrak tüketilir", () => {
    let s = withFlags(createCardsState(7, PL, only("kalkan", "takviye", "sigorta", "ayna")), "a", {
      gamble: true,
    });
    s = open(s);
    expect(s.picking?.a?.total).toBe(2);
    s = ok(s, { k: "pick", p: "a", i: 0 });
    expect(s.picking?.a?.done).toBe(false);
    expect(reason(s, { k: "pick", p: "a", i: 0 })).toBe("bad_option");
    s = ok(s, { k: "pick", p: "a", i: 1 });
    expect(s.picking?.a?.done).toBe(true);
    expect(s.by.a?.hand).toHaveLength(2);
    expect(open(ok(s, { k: "close" })).picking?.a?.total).toBe(1);
  });
  it("Lanetli Hediye: sonraki çekilişte nadir/efsanevi artar (bayrak tüketilir, bir kez)", () => {
    const rare = (boost: boolean): number => {
      let n = 0;
      for (let seed = 0; seed < 600; seed++) {
        let s = createCardsState(seed, ["a"], DEFAULT_CARD_SETTINGS);
        if (boost) s = withFlags(s, "a", { boost: true });
        const o = ok(s, { k: "open", scores: { a: 0 }, present: ["a"] });
        n += (o.picking?.a?.options ?? []).filter((c) =>
          ["nadir", "efsanevi"].includes(CARDS[c].rarity),
        ).length;
      }
      return n;
    };
    expect(rare(true)).toBeGreaterThan(rare(false) * 1.4);
    const s = withFlags(createCardsState(1, ["a"], DEFAULT_CARD_SETTINGS), "a", { boost: true });
    expect(ok(s, { k: "open", scores: { a: 0 }, present: ["a"] }).by.a?.boost).toBe(false);
  });
  it("kötü kart bayrağı aşama içinde çekilince aynı aşamayı etkilemez", () => {
    const s = pickAll(createCardsState(8, PL, only("kor-secim")), "kor-secim");
    for (const id of PL) expect(s.picking?.[id]?.blind).toBe(false);
    const holder = PL.find((id) => s.by[id]?.blind);
    expect(holder).toBeDefined();
  });
});

function withFlags(
  s: CardsState,
  id: string,
  flags: Partial<Record<"wide" | "blind" | "silenced" | "gamble" | "boost", boolean>>,
): CardsState {
  const c = JSON.parse(JSON.stringify(s)) as CardsState;
  Object.assign(c.by[id] as object, flags);
  return c;
}

describe("kart oynama", () => {
  const start = (hands: Partial<Record<string, CardId[]>>): CardsState => {
    let s = createCardsState(1, PL, DEFAULT_CARD_SETTINGS);
    for (const [id, h] of Object.entries(hands)) s = withHand(s, id, h ?? []);
    return s;
  };
  it("elinden kart oynar: elden çıkar, sahibine görünür, kesinleşmeden herkese gizli", () => {
    const s = ok(start({ a: ["takviye", "kalkan"] }), { k: "play", p: "a", card: "takviye", ctx: ctx() });
    expect(s.by.a?.hand).toEqual(["kalkan"]);
    expect(mineCards(s, "a")?.staged?.cardId).toBe("takviye");
    expect(publicCards(s, false).plays).toEqual([]);
    expect(mineCards(s, "b")?.staged).toBeNull();
  });
  it("oyuncu başına en çok 1 kart; geri alınca ele döner ve yeniden oynanabilir", () => {
    const s1 = ok(start({ a: ["takviye", "kalkan"] }), { k: "play", p: "a", card: "takviye", ctx: ctx() });
    expect(reason(s1, { k: "play", p: "a", card: "kalkan", ctx: ctx() })).toBe("already_played");
    const s2 = ok(s1, { k: "unplay", p: "a" });
    expect(s2.by.a?.hand.sort()).toEqual(["kalkan", "takviye"]);
    expect(reason(s2, { k: "unplay", p: "a" })).toBe("nothing_played");
    ok(s2, { k: "play", p: "a", card: "kalkan", ctx: ctx() });
  });
  it("elde olmayan kart, aşama sürerken ya da katılımcı olmayan oynayamaz", () => {
    const s = start({ a: ["takviye"] });
    expect(reason(s, { k: "play", p: "a", card: "kalkan", ctx: ctx() })).toBe("no_card");
    expect(reason(s, { k: "play", p: "a", card: "takviye", ctx: ctx({ participants: ["b", "c"] }) })).toBe(
      "not_participant",
    );
    expect(reason(open(s), { k: "play", p: "a", card: "takviye", ctx: ctx() })).toBe("wrong_phase");
    expect(reason(s, { k: "play", p: "z", card: "takviye", ctx: ctx() })).toBe("wrong_phase");
  });
  it("hedef kuralları: hedefsiz kart hedef almaz, hedefli kart hedef ister, kendine yalnız Koruma", () => {
    const s = start({ a: ["takviye", "celme", "koruma"] });
    expect(reason(s, { k: "play", p: "a", card: "takviye", target: "b", ctx: ctx() })).toBe("bad_target");
    expect(reason(s, { k: "play", p: "a", card: "celme", ctx: ctx() })).toBe("bad_target");
    expect(reason(s, { k: "play", p: "a", card: "celme", target: "a", ctx: ctx() })).toBe("bad_target");
    expect(reason(s, { k: "play", p: "a", card: "celme", target: "zz", ctx: ctx() })).toBe("bad_target");
    expect(
      reason(s, { k: "play", p: "a", card: "celme", target: "c", ctx: ctx({ present: ["a", "b"] }) }),
    ).toBe("bad_target");
    expect(reason(s, { k: "play", p: "a", card: "celme", target: "b", gameId: "g1", ctx: ctx() })).toBe(
      "bad_target",
    );
    ok(s, { k: "play", p: "a", card: "koruma", target: "a", ctx: ctx() });
    ok(s, { k: "play", p: "a", card: "celme", target: "b", ctx: ctx() });
  });
  it("Veto: kalan listeden bir oyun, sonra en az 1 oyun kalmalı", () => {
    const s = start({ a: ["veto"] });
    ok(s, { k: "play", p: "a", card: "veto", gameId: "g2", ctx: ctx() });
    expect(reason(s, { k: "play", p: "a", card: "veto", gameId: "yok", ctx: ctx() })).toBe("bad_game");
    expect(reason(s, { k: "play", p: "a", card: "veto", ctx: ctx() })).toBe("bad_target");
    expect(
      reason(s, { k: "play", p: "a", card: "veto", gameId: "g1", ctx: ctx({ remaining: ["g1"] }) }),
    ).toBe("bad_game");
    ok(s, { k: "play", p: "a", card: "veto", gameId: "g1", ctx: ctx({ remaining: ["g1", "g2"] }) });
  });
  it("Oyunu Seç: yalnız seçilebilir oyunlardan, sonraki oyun varken", () => {
    const s = start({ a: ["oyunu-sec"] });
    ok(s, { k: "play", p: "a", card: "oyunu-sec", gameId: "g9", ctx: ctx() });
    expect(reason(s, { k: "play", p: "a", card: "oyunu-sec", gameId: "g1", ctx: ctx() })).toBe("bad_game");
    expect(
      reason(s, { k: "play", p: "a", card: "oyunu-sec", gameId: "g9", ctx: ctx({ remaining: [] }) }),
    ).toBe("bad_game");
  });
});

describe("kesinleştirme", () => {
  const play = (s: CardsState, p: string, card: CardId, extra: { target?: string; gameId?: string } = {}) =>
    ok(s, { k: "play", p, card, ...extra, ctx: ctx() });
  const base = (): CardsState => {
    let s = createCardsState(1, PL, DEFAULT_CARD_SETTINGS);
    s = withHand(s, "a", ["veto", "takviye"]);
    s = withHand(s, "b", ["veto", "oyunu-sec"]);
    s = withHand(s, "c", ["oyunu-sec", "genis-secim"]);
    return s;
  };
  it("Veto seçilen oyunu listeden çıkarır; kesinleşince oyun açıklanır", () => {
    const s = ok(play(base(), "a", "veto", { gameId: "g2" }), { k: "commit", ctx: ctx() });
    expect(s.remaining).toEqual(["g1", "g3"]);
    expect(publicCards(s, false).plays).toEqual([{ playerId: "a", cardId: "veto", gameId: "g2" }]);
    expect(s.staged).toEqual([]);
  });
  it("iki Veto oynanma sırasıyla uygulanır; sonra 1 oyun kalacaksa üçüncü etkisiz", () => {
    let s = base();
    s = play(s, "a", "veto", { gameId: "g1" });
    s = play(s, "b", "veto", { gameId: "g2" });
    const done = ok(s, { k: "commit", ctx: ctx() });
    expect(done.remaining).toEqual(["g3"]);
    const two = ok(play(play(base(), "a", "veto", { gameId: "g1" }), "b", "veto", { gameId: "g1" }), {
      k: "commit",
      ctx: ctx(),
    });
    expect(two.remaining).toEqual(["g2", "g3"]);
    expect(two.plays.map((p) => p.void ?? false)).toEqual([false, true]);
  });
  it("Oyunu Seç: listede varsa öne alır (uzunluk aynı), yoksa sıradakinin yerine geçer", () => {
    const inList = ok(play(base(), "b", "oyunu-sec", { gameId: "g2" }), { k: "commit", ctx: ctx() });
    expect(inList.remaining).toEqual(["g2", "g1", "g3"]);
    const outside = ok(play(base(), "b", "oyunu-sec", { gameId: "g9" }), { k: "commit", ctx: ctx() });
    expect(outside.remaining).toEqual(["g9", "g2", "g3"]);
  });
  it("birden çok Oyunu Seç'ten ilk oynanan geçerlidir", () => {
    const s = ok(play(play(base(), "b", "oyunu-sec", { gameId: "g9" }), "c", "oyunu-sec", { gameId: "g2" }), {
      k: "commit",
      ctx: ctx(),
    });
    expect(s.remaining?.[0]).toBe("g9");
    expect(s.plays.map((p) => p.void ?? false)).toEqual([false, true]);
  });
  it("Geniş Seçim bayrağı kesinleşince kurulur", () => {
    const s = ok(play(base(), "c", "genis-secim"), { k: "commit", ctx: ctx() });
    expect(s.by.c?.wide).toBe(true);
    expect(optionsOf(open(s), "c")).toHaveLength(4);
  });
  it("gizli kartlar (Ayna, Koruma) açıklamada yer almaz ama sahibi görür", () => {
    let s = withHand(createCardsState(1, PL, DEFAULT_CARD_SETTINGS), "a", ["ayna"]);
    s = withHand(s, "b", ["koruma", "celme"]);
    s = ok(ok(s, { k: "play", p: "a", card: "ayna", ctx: ctx() }), {
      k: "play",
      p: "b",
      card: "koruma",
      target: "b",
      ctx: ctx(),
    });
    s = ok(s, { k: "commit", ctx: ctx() });
    expect(publicCards(s, false).plays).toEqual([]);
    expect(mineCards(s, "a")?.played?.cardId).toBe("ayna");
    expect(mineCards(s, "c")?.played).toBeNull();
  });
  it("ayrılan oyuncunun kartı etkisiz sayılır", () => {
    const s = ok(play(base(), "a", "veto", { gameId: "g2" }), {
      k: "commit",
      ctx: ctx({ present: ["b", "c"] }),
    });
    expect(s.remaining).toEqual(["g1", "g2", "g3"]);
  });
});

describe("oyun sonu hesabı", () => {
  const resolveEv = (over: Partial<Extract<CardEvent, { k: "resolve" }>> = {}): CardEvent => ({
    k: "resolve",
    participants: PL,
    present: PL,
    miniScores: { a: 5, b: 3, c: 1 },
    awards: { a: 2, b: 1, c: 0 },
    gameIndex: 0,
    ...over,
  });
  it("oynanan kart yanar, bekleyen kötü kart tüketilir, satırlar saklanır", () => {
    let s = withHand(createCardsState(1, PL, DEFAULT_CARD_SETTINGS), "a", ["cift-puan", "kalkan"]);
    (s.by.b as { pending: CardId[] }).pending = ["talihsizlik"];
    s = ok(ok(s, { k: "play", p: "a", card: "cift-puan", ctx: ctx() }), { k: "commit", ctx: ctx() });
    s = ok(s, resolveEv());
    expect(s.resolved?.awards).toEqual({ a: 4, b: 0, c: 0 });
    expect(s.by.a?.hand).toEqual(["kalkan"]);
    expect(s.by.b?.pending).toEqual([]);
    expect(s.plays).toEqual([]);
    expect(publicCards(s, true).lines.map((l) => l.cardId)).toEqual(["cift-puan", "talihsizlik"]);
    expect(publicCards(s, false).lines).toEqual([]);
  });
  it("Kart Çal elleri değiştirir", () => {
    let s = withHand(createCardsState(1, PL, DEFAULT_CARD_SETTINGS), "a", ["kart-cal"]);
    s = withHand(s, "b", ["kalkan"]);
    s = ok(ok(s, { k: "play", p: "a", card: "kart-cal", target: "b", ctx: ctx() }), {
      k: "commit",
      ctx: ctx(),
    });
    s = ok(s, resolveEv());
    expect(s.by.a?.hand).toEqual(["kalkan"]);
    expect(s.by.b?.hand).toEqual([]);
    expect(publicCards(s, false).hands).toEqual({ a: 1, b: 0, c: 0 });
  });
  it("oyuna katılmayan oyuncunun bekleyen kartı tüketilmez", () => {
    const s0 = createCardsState(1, PL, DEFAULT_CARD_SETTINGS);
    (s0.by.c as { pending: CardId[] }).pending = ["talihsizlik"];
    const s = ok(s0, resolveEv({ participants: ["a", "b"], present: ["a", "b"] }));
    expect(s.by.c?.pending).toEqual(["talihsizlik"]);
  });
});

describe("kayıt ve tekrar oynatma", () => {
  it("kayıttaki olaylar aynı durumu yeniden kurar", () => {
    const settings = DEFAULT_CARD_SETTINGS;
    const rec = new CardRecorder(42, PL, settings);
    let s = createCardsState(42, PL, settings);
    const step = (ev: CardEvent): void => {
      const r = applyCardEvent(s, ev);
      if (isRejected(r)) return;
      s = r;
      rec.record(1, ev);
    };
    for (let round = 0; round < 3; round++) {
      step({ k: "open", scores, present: PL });
      step({ k: "pick", p: "a", i: 1 });
      step({ k: "pick", p: "b", i: 0 });
      step({ k: "discard", p: "a", drop: 0 });
      step({ k: "close" });
      const hand = s.by.a?.hand[0];
      if (hand && !CARDS[hand].hidden && CARDS[hand].target === "none")
        step({ k: "play", p: "a", card: hand, ctx: ctx() });
      step({ k: "commit", ctx: ctx() });
      step({
        k: "resolve",
        participants: PL,
        present: PL,
        miniScores: { a: 3, b: 2, c: 1 },
        awards: { a: 2, b: 1, c: 0 },
        gameIndex: round,
      });
    }
    expect(rec.log.events.length).toBeGreaterThan(10);
    expect(replayCards(rec.log)).toEqual(s);
  });
  it("reddedilen olay kayda girmez; kayıtta reddedilecek olay varsa tekrar oynatma hata verir", () => {
    const rec = new CardRecorder(1, PL, DEFAULT_CARD_SETTINGS);
    rec.record(0, { k: "pick", p: "a", i: 0 });
    expect(() => replayCards(rec.log)).toThrow();
  });
});

describe("görünümler", () => {
  it("başkasının seçenekleri ve eli sahibi dışında hiçbir görünümde yer almaz", () => {
    let s = open(createCardsState(31, PL, DEFAULT_CARD_SETTINGS));
    s = withHand(s, "a", ["kalkan"]);
    const pub = JSON.stringify(publicCards(s, false));
    const mineB = JSON.stringify(mineCards(s, "b"));
    for (const o of optionsOf(s, "a")) expect(pub).not.toContain(`"${o}"`);
    expect(pub).not.toContain("kalkan");
    expect(mineB).not.toContain("kalkan");
    expect(mineCards(s, "z")).toBeNull();
  });
  it("seçilen seçenek görünümde null olur; seçilen kart 'got' listesinde", () => {
    let s = open(createCardsState(32, PL, DEFAULT_CARD_SETTINGS));
    const card = optionsOf(s, "a")[0] as CardId;
    s = ok(s, { k: "pick", p: "a", i: 0 });
    const m = mineCards(s, "a")?.pick;
    expect(m?.options[0]).toBeNull();
    expect(m?.got).toEqual([card]);
  });
  it("doğrulayıcılar kendi çıktılarını geri okur, bozuk veriyi reddeder", () => {
    let s = open(createCardsState(33, PL, DEFAULT_CARD_SETTINGS));
    s = withHand(s, "a", ["kalkan"]);
    const wire = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));
    const mine = mineCards(s, "a", { veto: [{ id: "g1", name: "Bir" }], pick: [] });
    expect(parseCardsMine(wire(mine))).toEqual(mine);
    const pub = publicCards(s, true);
    expect(parseCardsPublic(wire(pub))).toEqual(pub);
    expect(parseCardsMine({ hand: ["yok"] })).toBeNull();
    expect(
      parseCardsPublic({ phase: null, hands: { a: "x" }, announce: [], plays: [], lines: [] }),
    ).toBeNull();
    expect(parseCardsPublic(null)).toBeNull();
  });
});
