import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { KENDIM_SILENT_GETS_BONUS, kendim, kendimCards } from "./index.js";
import {
  KENDIM_DURATION_MS,
  KENDIM_MATCH_MS,
  KENDIM_REVEAL_MS,
  KENDIM_WRITE_MS,
  type KendimPublicView,
  type KendimView,
} from "./types.js";

type State = ReturnType<typeof start>;
const T0 = 1_000_000;
const ALL = ["a", "b", "c", "d"];
const MATCH_AT = T0 + KENDIM_WRITE_MS + 1_000;
const ctx = (now: number, connected: readonly string[] = ALL, seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
const start = (players: string[] = ALL, seed = 1) => kendim.setup(players, ctx(T0, players, seed));

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

describe("kendim meta", () => {
  it("3-8 oyuncu, dikey, briefing en çok 3 madde ve teknik kelime yok", () => {
    expect(kendim.minPlayers).toBe(3);
    expect(kendim.maxPlayers).toBe(8);
    expect(kendim.orientation).toBe("portrait");
    expect(kendim.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(kendim.briefing)).not.toMatch(/server|debug|protocol|stage/i);
  });

  it("süreler: 30 sn yazma, 30 sn eşleştirme", () => {
    const s = start();
    expect(s.writeEndsAt - s.startedAt).toBe(30_000);
    expect(s.matchEndsAt - s.writeEndsAt).toBe(30_000);
    expect(s.finishAt - s.startedAt).toBe(KENDIM_DURATION_MS);
    expect(KENDIM_REVEAL_MS).toBeLessThanOrEqual(10_000);
    expect(KENDIM_MATCH_MS).toBe(30_000);
  });
});

describe("yazma aşaması", () => {
  it("her oyuncu tek kelime yazar; giriş temizlenir ve Türkçe büyük harfe çevrilir", () => {
    const s = start();
    const r = act(s, "a", { kind: "write", text: " ışık   evi " }, T0 + 1);
    expect(priv(r, "a", T0 + 2).myText).toBe("IŞIK EVİ");
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

describe("puanlama", () => {
  const base = () => writeAll({ a: "elma", b: "armut", c: "kiraz", d: "üzüm" });

  it("doğru eşleştirme +1, yanlış −1, boş kart 0", () => {
    let s = base();
    s = pair(s, "a", "b", "b"); // doğru
    s = pair(s, "a", "c", "d"); // yanlış
    // d kartı boş bırakıldı: 0
    expect(minis(s).a).toBe(0); // +1 −1
  });

  it("yalnızca tek kişi doğru bulduysa kart sahibine +1 bonus", () => {
    let s = base();
    s = pair(s, "a", "b", "b"); // b'nin kartını yalnız a doğru buldu
    s = pair(s, "c", "b", "d"); // c yanlış
    s = pair(s, "b", "c", "c"); // b kendi eşleştirmesini doğru yaptı: +1, bonus +1
    expect(minis(s)).toEqual({ a: 1, b: 2, c: -1 + 1, d: 0 });
  });

  it("birden çok kişi doğru bulursa bonus yok; kimse bulamazsa da yok", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "c", "b", "b");
    s = pair(s, "d", "a", "c"); // a'nın kartını kimse bulamadı
    s = pair(s, "b", "d", "a"); // b yanlış: −1 (b'nin kartı iki kişi buldu: bonus yok)
    const m = minis(s);
    expect(m.a).toBe(1);
    expect(m.c).toBe(1);
    expect(m.b).toBe(-1);
    expect(m.d).toBe(-1);
    const rev = kendim.publicView(tick(s, s.matchEndsAt), ctx(s.matchEndsAt)).reveal;
    expect(rev?.cards.find((c) => c.owner === "b")).toMatchObject({ bonus: false });
    expect(rev?.cards.find((c) => c.owner === "a")).toMatchObject({ bonus: false, finders: [] });
  });

  it("bonus: bir doğru + birkaç yanlış eşleştirme yine tek doğru sayılır", () => {
    let s = base();
    s = pair(s, "a", "d", "d"); // doğru
    s = pair(s, "b", "d", "a"); // yanlış
    s = pair(s, "c", "d", "a"); // yanlış
    const m = minis(s);
    expect(m.d).toBe(0 + 0); // d hiç eşleştirme yapmadı: bonus yok (sessiz oyuncu)
    expect(m.a).toBe(1);
  });

  it("hiç eşleştirme yapmayan oyuncu 0 alır (bonus dahil): eksi de artı da yok", () => {
    expect(KENDIM_SILENT_GETS_BONUS).toBe(false);
    let s = base();
    s = pair(s, "a", "d", "d");
    expect(minis(s).d).toBe(0);
    s = pair(s, "d", "a", "a"); // d de oynayınca doğru +1 ve bonus +1 alır
    expect(minis(s).d).toBe(2);
    expect(minis(s).a).toBe(2); // d'yi buldu +1, kartını yalnız d buldu: bonus +1
  });

  it("aynı kelimeyi yazanlar denktir: kelimesi aynı birini seçmek doğrudur", () => {
    let s = writeAll({ a: "kedi", b: "kedi", c: "çay", d: "mavi" });
    const dup = kendimCards(s).filter((c) => c.text === "KEDİ");
    const first = dup[0];
    const second = dup[1];
    if (!first || !second) throw new Error("kedi kartları yok");
    // c, ilk kedi kartını diğer kedi yazarına bağlasa da doğru (kelime ikisini de anlatıyor).
    s = act(s, "c", { kind: "match", card: first.id, target: second.owner }, MATCH_AT);
    s = act(s, "d", { kind: "match", card: second.id, target: second.owner }, MATCH_AT);
    expect(minis(s).c).toBe(1);
    expect(minis(s).d).toBe(1);
  });

  it("genel skor: en yüksek mini puanlı oyuncu +1, eşitse hepsi +1, en yüksek ≤ 0 ise kimse", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "a", "c", "c");
    s = pair(s, "b", "a", "a");
    s = pair(s, "c", "d", "d");
    // a: +2, b: +1 (+bonus: b'nin kartını yalnız a buldu) = 2, c: +1 +bonus(c'yi yalnız a buldu)=2, d: 0+...
    const res = kendim.result(s);
    const top = Math.max(...Object.values(res.miniScores));
    const winners = Object.keys(res.miniScores).filter((id) => res.miniScores[id] === top);
    expect(Object.keys(res.awards).sort()).toEqual(winners.sort());
    for (const id of winners) expect(res.awards[id]).toBe(1);
    expect(top).toBeGreaterThan(0);

    // Kimse puan almadıysa ödül yok; herkes yanlışsa en yüksek 0.
    let z = base();
    z = pair(z, "a", "b", "c");
    z = pair(z, "b", "a", "c");
    expect(kendim.result(z).awards).toEqual({});
    expect(kendim.result(base()).awards).toEqual({});
  });

  it("eşitlikte eşit olanların tamamı +1 alır", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "b", "a", "a");
    s = pair(s, "c", "b", "b");
    s = pair(s, "c", "a", "a");
    // a: +1 (b'yi buldu), b: +1; a'nın kartını b ve c, b'nin kartını a ve c buldu: bonus yok. c: +2.
    expect(minis(s)).toEqual({ a: 1, b: 1, c: 2, d: 0 });
    expect(kendim.result(s).awards).toEqual({ c: 1 });
    // eşit zirve
    let t = base();
    t = pair(t, "a", "b", "b");
    t = pair(t, "c", "d", "d");
    const r = kendim.result(t);
    expect(r.miniScores.a).toBeGreaterThan(0);
    expect(Object.keys(r.awards).length).toBeGreaterThanOrEqual(1);
    for (const id of Object.keys(r.awards))
      expect(r.miniScores[id]).toBe(Math.max(...Object.values(r.miniScores)));
  });

  it("açılışta kartlar sahipleri, bulanlar ve eşleştirmeler birlikte açılır", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    s = pair(s, "a", "c", "d");
    s = pair(s, "b", "d", "a"); // b de oynadı (yanlış): −1, bonus +1
    const rev = pub(s, s.matchEndsAt).reveal;
    expect(rev?.cards.find((c) => c.owner === "b")).toMatchObject({
      text: "ARMUT",
      finders: ["a"],
      bonus: true,
    });
    expect(rev?.pairs.a).toEqual(
      expect.arrayContaining([
        { card: cardOf(s, "b"), target: "b", ok: true },
        { card: cardOf(s, "c"), target: "d", ok: false },
      ]),
    );
    expect(rev?.scores.a).toBe(0);
    expect(rev?.scores.b).toBe(0); // b eşleştirme yapmadı
  });

  it("awards miniScores'tan türer; skorlar tam sayı", () => {
    let s = base();
    s = pair(s, "a", "b", "b");
    const res = kendim.result(s);
    for (const v of Object.values(res.awards)) expect(Number.isInteger(v)).toBe(true);
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
    expect(s.finishAt).toBe(s.matchEndsAt + KENDIM_REVEAL_MS);
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
    expect(s.finishAt).toBe(MATCH_AT + 1_000 + KENDIM_REVEAL_MS);
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
        expect(pj).not.toContain("ELMASIZ");
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
    const s = start();
    expect(reject(s, "a", { kind: "lock" }, s.finishAt + 5)).toBe("ended");
    expect(kendim.isFinished(s, ctx(s.finishAt - 1))).toBe(false);
    expect(kendim.isFinished(s, ctx(s.finishAt))).toBe(true);
  });
});
