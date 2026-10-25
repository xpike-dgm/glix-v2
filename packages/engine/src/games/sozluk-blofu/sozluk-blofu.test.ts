import { describe, expect, it } from "vitest";
import { isRejected } from "../../game.js";
import { createRng } from "../../rng.js";
import { sozlukBlofu, sozlukCards, sozlukScores } from "./index.js";
import { bluffDisplayForm, charCount, compareKey, sanitizeText } from "./text.js";
import {
  SOZLUK_DURATION_MS,
  SOZLUK_PICK_MS,
  SOZLUK_REVEAL_MS,
  SOZLUK_WRITE_MS,
  type SozlukPublicView,
  type SozlukView,
} from "./types.js";
import { SOZLUK_ENTRIES } from "./words.js";

const T0 = 1_000_000;
const WRITE_END = T0 + SOZLUK_WRITE_MS;
const PICK_AT = WRITE_END + 1_000;
const PICK_END = WRITE_END + SOZLUK_PICK_MS;
const ctx = (now: number, connected: readonly string[] = ["a", "b", "c", "d", "e"], seed = 1) => ({
  now,
  rng: createRng(seed),
  connected,
});
type S = ReturnType<typeof sozlukBlofu.setup>;

const start = (players: string[] = ["a", "b", "c"], seed = 1): S =>
  sozlukBlofu.setup(players, ctx(T0, players, seed));
const tick = (s: S, at: number, connected: readonly string[] = s.players) =>
  sozlukBlofu.tick(s, ctx(at, connected));
const pub = (s: S, at: number): SozlukPublicView => sozlukBlofu.publicView(tick(s, at), ctx(at, s.players));
const priv = (s: S, who: string | null, at: number): SozlukView =>
  sozlukBlofu.view(tick(s, at), who, ctx(at, s.players));

function ok(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players): S {
  const parsed = sozlukBlofu.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sozlukBlofu.reduce(s, id, parsed, ctx(at, connected));
  if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
  return r;
}
function rej(s: S, id: string, action: unknown, at: number, connected: readonly string[] = s.players) {
  const parsed = sozlukBlofu.parseAction(action);
  if (!parsed) throw new Error("parseAction reddetti");
  const r = sozlukBlofu.reduce(s, id, parsed, ctx(at, connected));
  return isRejected(r) ? r.rejected : null;
}

const write = (s: S, id: string, text: string, at = T0 + 5_000, connected?: readonly string[]) =>
  ok(s, id, { kind: "bluff", text }, at, connected);
/** Herkes (yazanlar) sahte tanımını yazmış durum; metinler "tanım-<id>". */
const written = (players: string[], writers: string[] = players, seed = 1): S => {
  let s = start(players, seed);
  // Kimse bağlı değilmiş gibi: son yazıda erken bitiş tetiklenmesin (süre tam 50 sn).
  for (const id of writers) s = write(s, id, `tanım ${id} burada`, T0 + 5_000, []);
  return s;
};
const cardOf = (s: S, author: string): string => {
  const c = sozlukCards(s).find((x) => x.author === author);
  if (!c) throw new Error(`${author} kartı yok`);
  return c.id;
};
const realOf = (s: S): string => {
  const c = sozlukCards(s).find((x) => x.author === null);
  if (!c) throw new Error("gerçek kart yok");
  return c.id;
};
const pickCard = (s: S, id: string, card: string, at = PICK_AT, connected?: readonly string[]) =>
  ok(s, id, { kind: "pick", card }, at, connected);
const finalAwards = (s: S) => sozlukBlofu.result(tick(s, PICK_END + 1)).awards;

describe("sözlük blöfü meta ve havuz", () => {
  it("3-8 oyuncu, dikey, açılış en çok 3 madde ve teknik kelime yok", () => {
    expect(sozlukBlofu.minPlayers).toBe(3);
    expect(sozlukBlofu.maxPlayers).toBe(8);
    expect(sozlukBlofu.orientation).toBe("portrait");
    expect(sozlukBlofu.briefing.steps.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(sozlukBlofu.briefing)).not.toMatch(/protocol|server|debug|stage/i);
  });

  it("süreler: 50 sn yazma, 30 sn seçme", () => {
    expect(SOZLUK_WRITE_MS).toBe(50_000);
    expect(SOZLUK_PICK_MS).toBe(30_000);
    const s = start();
    expect(s.writeEndsAt).toBe(T0 + 50_000);
    expect(s.pickEndsAt).toBe(T0 + 80_000);
    expect(s.finishAt).toBe(T0 + SOZLUK_DURATION_MS);
  });

  it("havuz: geniş, kelimeler tekrarsız, tanımlar dolu ve 100 karakteri aşmaz", () => {
    expect(SOZLUK_ENTRIES.length).toBeGreaterThanOrEqual(80);
    const words = new Set<string>();
    for (const e of SOZLUK_ENTRIES) {
      expect(e.word).toBe(e.word.toLocaleUpperCase("tr-TR"));
      expect(words.has(e.word)).toBe(false);
      words.add(e.word);
      expect(e.definition.length).toBeGreaterThan(5);
      expect(charCount(e.definition)).toBeLessThanOrEqual(100);
      expect(sanitizeText(e.definition)).toBe(e.definition);
    }
  });

  it("kurulum havuzdan bir girdi seçer; her girdi seçilebilir (rastgele)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 600; seed++) {
      const s = start(["a", "b", "c"], seed);
      const entry = SOZLUK_ENTRIES.find((e) => e.word === s.word);
      expect(entry?.definition).toBe(s.definition);
      seen.add(s.word);
    }
    expect(seen.size).toBeGreaterThan(60);
  });
});

describe("metin temizliği", () => {
  it("denetim ve görünmez karakterler atılır, boşluklar sadeleşir", () => {
    const zwsp = String.fromCodePoint(0x200b);
    const bom = String.fromCodePoint(0xfeff);
    const rlo = String.fromCodePoint(0x202e);
    const nbsp = String.fromCodePoint(0xa0);
    expect(sanitizeText(`  a${zwsp}b\tc\n\nd   e${bom}${rlo}  `)).toBe("ab c d e");
    expect(sanitizeText(`x${nbsp}${nbsp}y`)).toBe("x y");
    expect(sanitizeText(`a${String.fromCodePoint(0)}b${String.fromCodePoint(7)}c`)).toBe("abc");
    expect(sanitizeText(`${String.fromCodePoint(0x3164)}${String.fromCodePoint(0x2800)}`)).toBe("");
    expect(sanitizeText("   ")).toBe("");
  });

  it("karakter sayısı kod noktasına göredir", () => {
    expect(charCount("a😀b")).toBe(3);
    expect(charCount("İıĞğ")).toBe(4);
  });

  it("karşılaştırma klavyeden, büyük/küçük harften ve noktalamadan bağımsız", () => {
    expect(compareKey("ince ve hafif yağan yağmur")).toBe(compareKey("İNCE VE HAFİF YAĞAN YAĞMUR"));
    expect(compareKey("ısı")).toBe(compareKey("ISI"));
    expect(compareKey("ısı")).toBe(compareKey("isi")); // İngilizce klavye ı yazamaz: bilerek eşit
    expect(compareKey("a, b; c.")).toBe(compareKey("A  B   C"));
  });

  it("kart biçimi: sondaki nokta atılır, ilk harf küçülür (kısaltma korunur)", () => {
    expect(bluffDisplayForm("Eski bir kayık türü.")).toBe("eski bir kayık türü");
    expect(bluffDisplayForm("Isı ölçen alet...")).toBe("ısı ölçen alet");
    expect(bluffDisplayForm("TDK sözlüğündeki bir ad")).toBe("TDK sözlüğündeki bir ad");
    expect(bluffDisplayForm("İnce bir ip")).toBe("ince bir ip");
    expect(bluffDisplayForm("zaten küçük")).toBe("zaten küçük");
  });
});

describe("sahte tanım yazma (50 sn)", () => {
  it("yazılan tanım temizlenir ve kartta sade biçimde görünür", () => {
    const zwsp = String.fromCodePoint(0x200b);
    const s = write(start(), "a", `  Küçük\t\tbir${zwsp}  alet.  `);
    expect(priv(s, "a", T0 + 6_000).myBluff).toBe("küçük bir alet");
  });

  it("1-100 karakter: boş/boşluk-yalnız reddedilir, 100 kabul, 101 reddedilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "bluff", text: "" }, T0 + 5_000)).toBe("empty");
    expect(rej(s, "a", { kind: "bluff", text: "  \t\n " }, T0 + 5_000)).toBe("empty");
    expect(rej(s, "a", { kind: "bluff", text: String.fromCodePoint(0x200b) }, T0 + 5_000)).toBe("empty");
    expect(rej(s, "a", { kind: "bluff", text: "." }, T0 + 5_000)).toBe("empty");
    expect(rej(s, "a", { kind: "bluff", text: "x".repeat(100) }, T0 + 5_000)).toBeNull();
    expect(rej(s, "a", { kind: "bluff", text: "x".repeat(101) }, T0 + 5_000)).toBe("too_long");
    // Boşluk sadeleşince sığan metin kabul edilir; emoji tek karakterdir.
    expect(
      rej(s, "a", { kind: "bluff", text: `${"x ".repeat(40)}${" ".repeat(50)}` }, T0 + 5_000),
    ).toBeNull();
    expect(rej(s, "a", { kind: "bluff", text: "😀".repeat(100) }, T0 + 5_000)).toBeNull();
    expect(rej(s, "a", { kind: "bluff", text: "😀".repeat(101) }, T0 + 5_000)).toBe("too_long");
  });

  it("gerçek tanımın aynısı dostça reddedilir (Türkçe büyük/küçük harf ve noktalama farkı da)", () => {
    const s = start(["a", "b", "c"], 3);
    const real = s.definition;
    expect(rej(s, "a", { kind: "bluff", text: real }, T0 + 5_000)).toBe("same_as_real");
    expect(rej(s, "a", { kind: "bluff", text: real.toLocaleUpperCase("tr-TR") }, T0 + 5_000)).toBe(
      "same_as_real",
    );
    expect(rej(s, "a", { kind: "bluff", text: `  ${real}.  ` }, T0 + 5_000)).toBe("same_as_real");
    expect(rej(s, "a", { kind: "bluff", text: real.replace(/ /g, "   ") }, T0 + 5_000)).toBe("same_as_real");
    // Reddedilen eylem hakkı harcamaz.
    expect(rej(s, "a", { kind: "bluff", text: "başka bir şey" }, T0 + 5_000)).toBeNull();
    // Benzer ama farklı metin kabul edilir.
    expect(rej(s, "a", { kind: "bluff", text: `${real} ve daha fazlası` }, T0 + 5_000)).toBeNull();
  });

  it("gönderilen tanım kesindir: ikinci gönderim reddedilir", () => {
    const s = write(start(), "a", "birinci");
    expect(rej(s, "a", { kind: "bluff", text: "ikinci" }, T0 + 6_000)).toBe("already_written");
    expect(priv(s, "a", T0 + 7_000).myBluff).toBe("birinci");
  });

  it("süre bitince ve sonrasında gönderim reddedilir; 1 ms önce kabul edilir", () => {
    const s = start();
    expect(rej(s, "a", { kind: "bluff", text: "x" }, WRITE_END - 1)).toBeNull();
    expect(rej(s, "a", { kind: "bluff", text: "x" }, WRITE_END)).toBe("not_writing");
    expect(rej(s, "a", { kind: "bluff", text: "x" }, PICK_END)).toBe("ended");
  });

  it("katılımcı olmayan oyuncu reddedilir; yazma sırasında seçme ve Tamam reddedilir", () => {
    const s = start();
    expect(rej(s, "ghost", { kind: "bluff", text: "x" }, T0 + 1_000)).toBe("not_participant");
    expect(rej(s, "a", { kind: "pick", card: "k1" }, T0 + 1_000)).toBe("not_picking_yet");
    expect(rej(s, "a", { kind: "lock" }, T0 + 1_000)).toBe("not_picking_yet");
  });

  it("yazma sırasında kimsenin tanımı başkasına görünmez; yalnız gönderenler listelenir", () => {
    const s = write(start(), "a", "gizli tanım a");
    expect(pub(s, T0 + 6_000).ready).toEqual(["a"]);
    expect(pub(s, T0 + 6_000).cards).toBeNull();
    expect(JSON.stringify(pub(s, T0 + 6_000))).not.toContain("gizli tanım a");
    expect(JSON.stringify(priv(s, "b", T0 + 6_000))).not.toContain("gizli tanım a");
    expect(priv(s, "a", T0 + 6_000).myBluff).toBe("gizli tanım a");
  });

  it("yazma sırasında gerçek tanım hiçbir görünümde yoktur", () => {
    const s = start();
    for (const at of [T0 + 1, WRITE_END - 1]) {
      expect(JSON.stringify(pub(s, at))).not.toContain(s.definition);
      for (const who of [...s.players, null]) {
        expect(JSON.stringify(priv(s, who, at))).not.toContain(s.definition);
      }
    }
  });
});

describe("kartlar", () => {
  it("gerçek tanım + yazan herkesin tanımı karışık gösterilir; yazmayanın kartı olmaz", () => {
    const s = written(["a", "b", "c", "d"], ["a", "c"]);
    const cards = pub(s, PICK_AT).cards ?? [];
    expect(cards.length).toBe(3);
    expect(cards.map((c) => c.text).sort()).toEqual(
      ["tanım a burada", "tanım c burada", s.definition].sort(),
    );
    expect(new Set(cards.map((c) => c.id)).size).toBe(3);
    expect(priv(s, "b", PICK_AT).myCard).toBeNull();
    expect(priv(s, "d", PICK_AT).myCard).toBeNull();
    expect(priv(s, "a", PICK_AT).myCard).toBe(cardOf(s, "a"));
  });

  it("gerçek kartın yeri rastgele ve oyuncu sırasına bağlı değil", () => {
    const places = new Set<number>();
    for (let seed = 1; seed <= 120; seed++) {
      const s = written(["a", "b", "c", "d"], ["a", "b", "c", "d"], seed);
      places.add(sozlukCards(s).findIndex((c) => c.author === null));
    }
    expect(places.size).toBe(5);
  });

  it("kartlar yazma bitince sabittir (tick takvimine bağlı değil)", () => {
    const s = written(["a", "b", "c"]);
    expect(pub(s, PICK_AT).cards).toEqual(pub(s, PICK_END - 1).cards);
  });

  it("yazma sürerken kart yok; tick yazma bitişinde durumu bir kez değiştirir", () => {
    const s = written(["a", "b", "c"]);
    expect(tick(s, WRITE_END - 1)).toBe(s);
    const picking = tick(s, WRITE_END);
    expect(picking).not.toBe(s);
    expect(picking.stage).toBe("pick");
    expect(tick(picking, PICK_END - 1)).toBe(picking);
    const done = tick(picking, PICK_END);
    expect(done.stage).toBe("reveal");
    expect(tick(done, PICK_END + 99_999)).toBe(done);
    expect(tick(s, PICK_END + 5).stage).toBe("reveal");
  });

  it("hiç sahte tanım yazılmasa da yalnız gerçek kartla oyun işler; seçen +1 alır", () => {
    const s = start();
    expect(sozlukCards(s).length).toBe(1);
    const p = pickCard(s, "a", realOf(s));
    expect(finalAwards(p)).toEqual({ a: 1, b: 0, c: 0 });
  });
});

describe("kart seçme (30 sn)", () => {
  const P = ["a", "b", "c", "d"];

  it("kendi blöfünü seçemez; olmayan kart reddedilir; yazmayan her kartı seçebilir", () => {
    const s = written(P, ["a", "b", "c"]);
    expect(rej(s, "a", { kind: "pick", card: cardOf(s, "a") }, PICK_AT)).toBe("own_card");
    expect(rej(s, "a", { kind: "pick", card: "k99" }, PICK_AT)).toBe("unknown_card");
    expect(rej(s, "a", { kind: "pick", card: cardOf(s, "b") }, PICK_AT)).toBeNull();
    for (const c of sozlukCards(s)) expect(rej(s, "d", { kind: "pick", card: c.id }, PICK_AT)).toBeNull();
  });

  it("seçim kilitlenene kadar değiştirilebilir (son seçim geçerli)", () => {
    let s = written(P);
    s = pickCard(s, "a", cardOf(s, "b"));
    s = pickCard(s, "a", realOf(s));
    expect(priv(s, "a", PICK_AT).myPick).toBe(realOf(s));
    expect(pickCard(s, "a", realOf(s))).toBe(s);
    expect(finalAwards(s).a).toBe(1);
    expect(finalAwards(s).b).toBe(0);
  });

  it("süre bitince ve sonrasında seçim reddedilir; 1 ms önce kabul edilir", () => {
    const s = written(P);
    const act = { kind: "pick", card: realOf(s) };
    expect(rej(s, "a", act, PICK_END - 1)).toBeNull();
    expect(rej(s, "a", act, PICK_END)).toBe("ended");
    expect(rej(s, "a", { kind: "lock" }, PICK_END)).toBe("ended");
    expect(rej(s, "a", act, T0 + SOZLUK_DURATION_MS + 5)).toBe("ended");
    expect(rej(s, "a", { kind: "bluff", text: "x" }, PICK_END)).toBe("ended");
  });

  it("seçme aşamasında yeni tanım yazılamaz", () => {
    expect(rej(start(), "a", { kind: "bluff", text: "geç kaldım" }, PICK_AT)).toBe("not_writing");
  });

  it("seçimler süre bitene kadar yalnız sahibine görünür; kilit listesi seçimleri sızdırmaz", () => {
    let s = written(P);
    s = pickCard(s, "a", realOf(s));
    expect(priv(s, "a", PICK_AT).myPick).toBe(realOf(s));
    expect(priv(s, "b", PICK_AT).myPick).toBeNull();
    expect(priv(s, null, PICK_AT).myPick).toBeNull();
    expect(pub(s, PICK_AT).reveal).toBeNull();
    expect(JSON.stringify(pub(s, PICK_AT))).not.toMatch(/picks|authors|realCard|scores/);
  });

  it("bağlantısı kopmuş oyuncunun seçimi de sayılır", () => {
    let s = written(P);
    s = pickCard(s, "a", realOf(s));
    const done = tick(s, PICK_END + 1, ["b"]);
    expect(sozlukBlofu.result(done).awards.a).toBe(1);
  });

  it("parseAction yalnız tam biçimi kabul eder", () => {
    expect(sozlukBlofu.parseAction({ kind: "bluff", text: "x" })).toEqual({ kind: "bluff", text: "x" });
    expect(sozlukBlofu.parseAction({ kind: "pick", card: "k1" })).toEqual({ kind: "pick", card: "k1" });
    expect(sozlukBlofu.parseAction({ kind: "lock" })).toEqual({ kind: "lock" });
    for (const bad of [
      { kind: "bluff" },
      { kind: "bluff", text: 3 },
      { kind: "bluff", text: "x", extra: 1 },
      { kind: "bluff", text: "x".repeat(401) },
      { kind: "pick" },
      { kind: "pick", card: "" },
      { kind: "pick", card: 3 },
      { kind: "pick", card: "x".repeat(17) },
      { kind: "lock", extra: 1 },
      { kind: "vote", card: "k1" },
      ["bluff", "x"],
      "k1",
    ]) {
      expect(sozlukBlofu.parseAction(bad)).toBeNull();
    }
  });
});

describe("sözlük blöfü puanlama", () => {
  const P = ["a", "b", "c", "d"];

  it("gerçek tanımı seçen +1; yanlış seçim 0 (eksi yok)", () => {
    let s = written(P);
    s = pickCard(s, "a", realOf(s));
    s = pickCard(s, "b", cardOf(s, "c"));
    s = pickCard(s, "c", cardOf(s, "d"));
    s = pickCard(s, "d", realOf(s));
    expect(finalAwards(s)).toEqual({ a: 1, b: 0, c: 1, d: 2 });
  });

  it("blöfü seçilen her seçim için sahibine ayrı ayrı +1", () => {
    let s = written(["a", "b", "c", "d", "e"]);
    const target = cardOf(s, "a");
    for (const id of ["b", "c", "d"]) s = pickCard(s, id, target);
    s = pickCard(s, "e", realOf(s));
    expect(finalAwards(s)).toEqual({ a: 3, b: 0, c: 0, d: 0, e: 1 });
  });

  it("gerçeği seçen hem +1 alır hem de blöfü seçildiyse blöf puanını da alır", () => {
    let s = written(P);
    s = pickCard(s, "a", realOf(s));
    s = pickCard(s, "b", cardOf(s, "a"));
    expect(finalAwards(s)).toEqual({ a: 2, b: 0, c: 0, d: 0 });
  });

  it("seçim yapmayan 0 alır; kimse seçmezse herkes 0", () => {
    expect(finalAwards(written(P))).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(sozlukBlofu.result(tick(written(P), PICK_END + 1)).miniScores).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });

  it("yazmayan oyuncunun kartı olmaz: kimse ona puan kazandıramaz, o gerçeği seçerse +1", () => {
    let s = written(P, ["a", "b"]);
    s = pickCard(s, "c", realOf(s));
    s = pickCard(s, "d", cardOf(s, "a"));
    expect(finalAwards(s)).toEqual({ a: 1, b: 0, c: 1, d: 0 });
  });

  it("toplam puan seçim sayısına eşittir (her seçim tam bir puan)", () => {
    for (const n of [3, 5, 8]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      let s = written(players, players, n);
      const cards = sozlukCards(s);
      let picks = 0;
      for (const id of players) {
        const options = cards.filter((c) => c.author !== id);
        s = pickCard(s, id, (options[picks % options.length] as (typeof options)[number]).id);
        picks++;
      }
      expect(Object.values(finalAwards(s)).reduce((x, y) => x + y, 0)).toBe(n);
    }
  });

  it("awards = miniScores (ayrı bonus yok) ve sonuç tick'ten bağımsız", () => {
    let s = written(P);
    s = pickCard(s, "a", realOf(s));
    const r = sozlukBlofu.result(s);
    expect(r.awards).toEqual(r.miniScores);
    expect(sozlukBlofu.result(tick(s, PICK_END + 1))).toEqual(r);
    expect(sozlukScores(s)).toEqual(r.miniScores);
  });

  it("geçersiz seçim (bilinmeyen kart) kayda girmez; sonuç bozulmaz", () => {
    const s = written(P);
    expect(rej(s, "a", { kind: "pick", card: "k99" }, PICK_AT)).toBe("unknown_card");
    expect(finalAwards(s)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
  });
});

describe("sözlük blöfü sonuç açılışı", () => {
  const P = ["a", "b", "c", "d"];
  let s = written(P);
  s = pickCard(s, "a", realOf(s));
  s = pickCard(s, "b", cardOf(s, "a"));

  it("seçme bitince tick'ten sonra gerçek kart, kart sahipleri, seçimler ve puanlar herkese açılır", () => {
    const p = pub(s, PICK_END);
    expect(p.phase).toBe("reveal");
    expect(p.reveal?.realCard).toBe(realOf(s));
    expect(p.reveal?.authors[cardOf(s, "a")]).toBe("a");
    expect(Object.keys(p.reveal?.authors ?? {}).length).toBe(4);
    expect(p.reveal?.picks).toEqual({ a: realOf(s), b: cardOf(s, "a") });
    expect(p.reveal?.scores).toEqual({ a: 2, b: 0, c: 0, d: 0 });
  });

  it("tick atılmadan açılış görünmez", () => {
    expect(sozlukBlofu.publicView(s, ctx(PICK_END, P)).reveal).toBeNull();
  });

  it("açılış süresi dolana kadar bitmez", () => {
    expect(sozlukBlofu.isFinished(s, ctx(PICK_END))).toBe(false);
    expect(sozlukBlofu.isFinished(s, ctx(PICK_END + SOZLUK_REVEAL_MS - 1))).toBe(false);
    expect(sozlukBlofu.isFinished(s, ctx(PICK_END + SOZLUK_REVEAL_MS))).toBe(true);
  });

  it("kimse bir şey yapmazsa oyun yine tam süresinde biter", () => {
    const idle = start();
    expect(sozlukBlofu.isFinished(idle, ctx(T0 + SOZLUK_DURATION_MS - 1))).toBe(false);
    expect(sozlukBlofu.isFinished(idle, ctx(T0 + SOZLUK_DURATION_MS))).toBe(true);
    expect(sozlukBlofu.result(idle).awards).toEqual({ a: 0, b: 0, c: 0 });
  });
});

describe("sözlük blöfü gizlilik (kart numarası ve oyuncu kimliği kısa; yapısal kontrol)", () => {
  const players = ["pa1", "pb2", "pc3", "pd4"];
  const TEXTS = ["tanım bir", "tanım iki", "tanım üç", "tanım dört"];
  const build = (order: number[]): S => {
    let s = start(players, 5);
    for (const [i, id] of players.entries())
      s = write(s, id, TEXTS[order[i] as number] as string, T0 + 5_000, []);
    return s;
  };
  const A = build([0, 1, 2, 3]);
  // Aynı metinler, tersine çevrilmiş sahiplik.
  const B = build([3, 2, 1, 0]);

  it("seçme aşamasında publicView kartları sahipsiz verir (yalnız id ve metin); sahiplik değişse de kart kümesi aynı", () => {
    for (const at of [PICK_AT, PICK_END - 1]) {
      const a = sozlukBlofu.publicView(tick(A, at), ctx(at, players));
      const b = sozlukBlofu.publicView(tick(B, at), ctx(at, players));
      const json = JSON.stringify({ ...a, players: [] });
      expect(json).not.toMatch(/author|realCard|picks|scores|pa1|pb2|pc3|pd4/);
      expect((a.cards ?? []).map((c) => c.id)).toEqual((b.cards ?? []).map((c) => c.id));
      expect((a.cards ?? []).map((c) => c.text).sort()).toEqual((b.cards ?? []).map((c) => c.text).sort());
      for (const card of a.cards ?? []) expect(Object.keys(card).sort()).toEqual(["id", "text"]);
      expect(Object.keys(a).sort()).toEqual(
        [
          "cards",
          "finishAt",
          "phase",
          "pickEndsAt",
          "players",
          "ready",
          "reveal",
          "startedAt",
          "word",
          "writeEndsAt",
        ].sort(),
      );
    }
  });

  it("kart sırası yazarların kimliğinden türemez: aynı tohum ve sayıyla yer aynı kalır", () => {
    const orderA = sozlukCards(A).map((c) => c.id);
    const orderB = sozlukCards(B).map((c) => c.id);
    expect(orderA).toEqual(orderB);
    // Gerçek kartın yeri de sahiplikten bağımsız.
    expect(realOf(A)).toBe(realOf(B));
  });

  it("view yalnız kendi tanımını, kartını ve seçimini verir; başkasının kartı/seçimi görünmez", () => {
    for (const who of players) {
      expect(Object.keys(priv(A, who, PICK_AT)).sort()).toEqual(["locked", "myBluff", "myCard", "myPick"]);
    }
    expect(priv(A, "pa1", PICK_AT).myCard).toBe(cardOf(A, "pa1"));
    expect(priv(A, "pb2", PICK_AT).myCard).toBe(cardOf(A, "pb2"));
    expect(priv(A, null, PICK_AT)).toEqual({ myBluff: null, myCard: null, myPick: null, locked: false });
    expect(priv(A, "ghost", PICK_AT).myCard).toBeNull();
  });

  it("gerçek kartın numarası hiçbir oyuncunun view'ında yoktur", () => {
    const real = realOf(A);
    for (const who of players) {
      const v = priv(A, who, PICK_AT);
      expect(v.myCard).not.toBe(real);
      expect(JSON.stringify(v)).not.toContain(`"${real}"`);
    }
    expect(JSON.stringify(pub(A, PICK_AT))).not.toContain(`"realCard"`);
  });

  it("secrets: yazmada gerçek tanım kimseye, her sahte tanım yalnız sahibine ait; seçmede ve açılışta boş", () => {
    const secrets = sozlukBlofu.secrets(A);
    expect(secrets.find((x) => x.value === A.definition)?.ownerIds).toEqual([]);
    expect(secrets.find((x) => x.value === "tanım bir")?.ownerIds).toEqual(["pa1"]);
    expect(sozlukBlofu.secrets(tick(A, WRITE_END))).toEqual([]);
    expect(sozlukBlofu.secrets(tick(A, PICK_END))).toEqual([]);
  });

  it("çok kısa tanım secrets()'a girmez ama yazma sırasında yalnız sahibine görünür", () => {
    const s = write(start(players), "pa1", "ip", T0 + 2_000);
    expect(sozlukBlofu.secrets(s).map((x) => x.label)).toEqual(["gerçek tanım"]);
    expect(priv(s, "pa1", T0 + 3_000).myBluff).toBe("ip");
    expect(JSON.stringify(pub(s, T0 + 3_000))).not.toMatch(/"ip"/);
    expect(JSON.stringify(priv(s, "pb2", T0 + 3_000))).not.toMatch(/"ip"/);
  });
});

describe("sözlük blöfü erken bitiş", () => {
  const P = ["a", "b", "c"];

  describe("yazma: herkes gönderdi", () => {
    it("(a) bağlı herkes yazınca yazma 1 sn sonra biter; seçme süresi 30 sn kalır", () => {
      let s = start(P);
      for (const id of P) s = write(s, id, `tanım ${id}`, T0 + 10_000);
      expect(s.writeEndsAt).toBe(T0 + 11_000);
      expect(pub(s, T0 + 10_999).phase).toBe("write");
      expect(pub(s, T0 + 11_000).phase).toBe("pick");
      expect(pub(s, T0 + 11_000).pickEndsAt).toBe(T0 + 11_000 + SOZLUK_PICK_MS);
      expect(pub(s, T0 + 11_000).finishAt).toBe(T0 + 11_000 + SOZLUK_PICK_MS + SOZLUK_REVEAL_MS);
      expect(rej(s, "a", { kind: "pick", card: realOf(s) }, T0 + 11_000)).toBeNull();
    });

    it("(b) bir kişi eksikken bitmez", () => {
      let s = start(P);
      s = write(s, "a", "x1", T0 + 10_000);
      s = write(s, "b", "x2", T0 + 10_000);
      expect(s.writeEndsAt).toBe(WRITE_END);
      expect(pub(s, T0 + 30_000).phase).toBe("write");
    });

    it("(c) bağlantısı kopan oyuncu beklenmez", () => {
      let s = start(P);
      const conn = ["a", "b"];
      s = write(s, "a", "x1", T0 + 10_000, conn);
      s = write(s, "b", "x2", T0 + 10_000, conn);
      expect(s.writeEndsAt).toBe(T0 + 11_000);
      // Kopuk c'nin kartı olmaz (yazmadı).
      expect(sozlukCards(s).length).toBe(3);
    });

    it("(d) gönderdikten sonra değiştirme reddedilir; kapanış penceresinde geç kalan hâlâ yazabilir", () => {
      let s = start(P);
      const conn = ["a", "b"];
      s = write(s, "a", "x1", T0 + 10_000, conn);
      s = write(s, "b", "x2", T0 + 10_000, conn);
      expect(rej(s, "a", { kind: "bluff", text: "yeni" }, T0 + 10_100, conn)).toBe("already_written");
      expect(rej(s, "c", { kind: "bluff", text: "geç" }, T0 + 10_500)).toBeNull();
      expect(rej(s, "c", { kind: "bluff", text: "geç" }, T0 + 11_000)).toBe("not_writing");
    });

    it("(e) gönderenler herkese açık, tanımlar sızmaz", () => {
      let s = start(P);
      s = write(s, "b", "gizli b tanımı", T0 + 10_000);
      const p = pub(s, T0 + 10_100);
      expect(p.ready).toEqual(["b"]);
      expect(JSON.stringify(p)).not.toContain("gizli b tanımı");
      expect(priv(s, "b", T0 + 10_100).locked).toBe(true);
      expect(priv(s, "a", T0 + 10_100).locked).toBe(false);
    });

    it("(f) tick bağlantıya bakmaz", () => {
      let s = start(P);
      for (const id of P) s = write(s, id, `t ${id}`, T0 + 10_000);
      expect(tick(s, T0 + 12_000, [])).toEqual(tick(s, T0 + 12_000, P));
    });

    it("reddedilen (gerçekle aynı) yazı bitişi tetiklemez", () => {
      let s = start(P);
      s = write(s, "a", "x1", T0 + 10_000);
      s = write(s, "b", "x2", T0 + 10_000);
      expect(rej(s, "c", { kind: "bluff", text: s.definition }, T0 + 10_200)).toBe("same_as_real");
      expect(s.writeEndsAt).toBe(WRITE_END);
    });
  });

  describe("seçme: Tamam", () => {
    const base = (): S => written(P);

    it("(a) herkes kilitleyince seçme 1 sn sonra biter, kartlar açılır; puanlama aynı", () => {
      let s = base();
      s = pickCard(s, "a", realOf(s));
      s = pickCard(s, "b", cardOf(s, "a"));
      s = pickCard(s, "c", cardOf(s, "a"));
      for (const id of P) s = ok(s, id, { kind: "lock" }, PICK_AT + 2_000);
      expect(s.pickEndsAt).toBe(PICK_AT + 3_000);
      expect(pub(s, PICK_AT + 2_999).phase).toBe("pick");
      expect(pub(s, PICK_AT + 3_000).phase).toBe("reveal");
      expect(pub(s, PICK_AT + 3_000).reveal?.scores).toEqual({ a: 3, b: 0, c: 0 });
      expect(sozlukBlofu.isFinished(s, ctx(PICK_AT + 3_000 + SOZLUK_REVEAL_MS - 1, P))).toBe(false);
      expect(sozlukBlofu.isFinished(s, ctx(PICK_AT + 3_000 + SOZLUK_REVEAL_MS, P))).toBe(true);
      expect(sozlukBlofu.result(s).awards).toEqual({ a: 3, b: 0, c: 0 });
    });

    it("(b) bir kişi eksikken bitmez; seçimsiz kilitlenemez", () => {
      let s = base();
      s = pickCard(s, "a", realOf(s));
      s = pickCard(s, "b", realOf(s));
      s = ok(s, "a", { kind: "lock" }, PICK_AT + 2_000);
      s = ok(s, "b", { kind: "lock" }, PICK_AT + 2_000);
      expect(s.pickEndsAt).toBe(PICK_END);
      expect(rej(s, "c", { kind: "lock" }, PICK_AT + 2_000)).toBe("nothing_to_lock");
    });

    it("(c) bağlantısı kopan oyuncu beklenmez", () => {
      const conn = ["a", "b"];
      let s = base();
      s = pickCard(s, "a", realOf(s), PICK_AT, conn);
      s = pickCard(s, "b", realOf(s), PICK_AT, conn);
      s = ok(s, "a", { kind: "lock" }, PICK_AT + 1_000, conn);
      s = ok(s, "b", { kind: "lock" }, PICK_AT + 1_000, conn);
      expect(s.pickEndsAt).toBe(PICK_AT + 2_000);
    });

    it("(d) kilitten sonra seçim değiştirme ve ikinci kilit reddedilir; kapanış penceresinde yeni seçim kabul edilmez", () => {
      let s = base();
      s = pickCard(s, "a", realOf(s));
      s = ok(s, "a", { kind: "lock" }, PICK_AT + 500);
      expect(rej(s, "a", { kind: "lock" }, PICK_AT + 600)).toBe("locked");
      expect(rej(s, "a", { kind: "pick", card: cardOf(s, "b") }, PICK_AT + 600)).toBe("locked");
      const conn = ["a", "b"];
      let t = base();
      t = pickCard(t, "a", realOf(t), PICK_AT, conn);
      t = pickCard(t, "b", realOf(t), PICK_AT, conn);
      t = ok(t, "a", { kind: "lock" }, PICK_AT + 500, conn);
      t = ok(t, "b", { kind: "lock" }, PICK_AT + 500, conn);
      expect(rej(t, "c", { kind: "pick", card: realOf(t) }, PICK_AT + 800)).toBe("closed");
      expect(rej(t, "c", { kind: "pick", card: realOf(t) }, PICK_AT + 1_500)).toBe("ended");
    });

    it("(e) kilit listesi seçimleri sızdırmaz", () => {
      let s = base();
      s = pickCard(s, "a", cardOf(s, "b"));
      s = ok(s, "a", { kind: "lock" }, PICK_AT + 500);
      const p = pub(s, PICK_AT + 600);
      expect(p.ready).toEqual(["a"]);
      expect(JSON.stringify(p)).not.toMatch(/picks|authors|realCard|scores|myPick/);
      expect(priv(s, "a", PICK_AT + 600)).toMatchObject({ myPick: cardOf(s, "b"), locked: true });
      expect(priv(s, "b", PICK_AT + 600)).toMatchObject({ myPick: null, locked: false });
    });

    it("(f) tick bağlantıya bakmaz", () => {
      let s = base();
      s = pickCard(s, "a", realOf(s));
      s = ok(s, "a", { kind: "lock" }, PICK_AT + 500);
      expect(tick(s, PICK_END + 5, [])).toEqual(tick(s, PICK_END + 5, P));
    });

    it("yazmadan seçmeye erken geçiş sonrası da Tamam ile hızlı kapanış zinciri çalışır", () => {
      let s = start(P);
      for (const id of P) s = write(s, id, `tanım ${id}`, T0 + 10_000);
      const at = T0 + 11_000;
      for (const id of P) s = pickCard(s, id, realOf(s) === cardOf(s, id) ? "k1" : realOf(s), at + 100);
      for (const id of P) s = ok(s, id, { kind: "lock" }, at + 2_000);
      expect(s.pickEndsAt).toBe(at + 3_000);
      expect(sozlukBlofu.isFinished(s, ctx(at + 3_000 + SOZLUK_REVEAL_MS, P))).toBe(true);
    });
  });
});
