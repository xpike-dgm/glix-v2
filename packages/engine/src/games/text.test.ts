import { describe, expect, it } from "vitest";
import { isRejected } from "../game.js";
import { createRng } from "../rng.js";
import { bozukNormalizeWords } from "./bozuk-telefon/index.js";
import { groupAnswers } from "./cagrisim-agi/index.js";
import { KENDIM_WRITE_MS, kendim, kendimCards } from "./kendim/index.js";
import { sozlukBlofu } from "./sozluk-blofu/index.js";
import { compareKey } from "./sozluk-blofu/text.js";
import { foldKey } from "./text.js";
import { YAZI_YAZ_TALK_MS, YAZI_YAZ_WRITE_MS, yaziYaz, yaziYazJudge } from "./yazi-yaz/index.js";

describe("foldKey: Türkçe ve İngilizce klavye eşleşir", () => {
  it.each([
    ["KAŞIK", "kasik"],
    ["KİTAP", "KITAP"],
    ["kitap", "KİTAP"],
    ["ılık", "ILIK"],
    ["Çiçek", "cicek"],
    ["ÖĞRETMEN", "ogretmen"],
    ["üzüm", "UZUM"],
    ["kâğıt", "kagit"],
    ["  deniz   kenarı! ", "deniz kenari"],
  ])("%s = %s", (a, b) => {
    expect(foldKey(a)).toBe(foldKey(b));
  });

  it("farklı kelimeler ayrı kalır", () => {
    expect(foldKey("KEDİ")).not.toBe(foldKey("KÖPEK"));
  });
});

describe("oyunlarda klavyeden bağımsız eşleşme", () => {
  it("Çağrışım: kaşık ve kasik aynı grupta", () => {
    const r = groupAnswers(["a", "b", "c"], { a: "Kaşık", b: "kasik", c: "çatal" });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]?.members).toEqual(["a", "b"]);
    expect(r.groups[0]?.text).toBe("kaşık");
  });

  it("Yazı Yaz: KITAP tahmini KİTAP kelimesini bulur", () => {
    const state = { writers: ["w1", "w2"], texts: { w1: "KİTAP", w2: "ELMA" } };
    expect(yaziYazJudge(state, "x", "w1", "KITAP").wordOk).toBe(true);
    expect(yaziYazJudge(state, "x", "w1", "KALEM").wordOk).toBe(false);
  });

  it("Sözlük: İngilizce klavyeyle yazılan gerçek tanım da aynı sayılır", () => {
    expect(compareKey("şakul: duvarın dikliğini ölçen ip")).toBe(
      compareKey("SAKUL duvarin dikligini olcen ip"),
    );
  });
});

// ---- ÖNERİ (sahip onayı bekliyor): oyun akışı düzeyinde İngilizce klavye senaryoları ----------------------------

describe("İngilizce klavye senaryoları (reduce üzerinden)", () => {
  const ctxAt = (now: number, connected: readonly string[]) => ({ now, rng: createRng(1), connected });

  it("Yazı Yaz: İngilizce klavyeyle yazılan tahmin (ISIK EVI) Türkçe yazılan kelimeyi (ışık evi) bulur", () => {
    const players = ["a", "b", "c", "d", "e"];
    const T0 = 1_000_000;
    let s = yaziYaz.setup(players, ctxAt(T0, players));
    const [w1, w2] = s.writers as [string, string];
    const step = (who: string, raw: unknown, at: number) => {
      const action = yaziYaz.parseAction(raw);
      if (action === null) throw new Error("geçersiz eylem");
      const r = yaziYaz.reduce(s, who, action, ctxAt(at, players));
      if (isRejected(r)) throw new Error(`reddedildi: ${r.rejected}`);
      s = r;
    };
    step(w1, { kind: "write", text: "ışık evi" }, T0 + 1_000);
    step(w2, { kind: "write", text: "çiğ köfte" }, T0 + 1_000);
    for (const id of players.filter((p) => !s.writers.includes(p)))
      step(id, { kind: "write", text: "masum" }, T0 + 1_000);
    const guessAt = T0 + YAZI_YAZ_WRITE_MS + YAZI_YAZ_TALK_MS + 1_000;
    const guesser = players.find((p) => !s.writers.includes(p)) as string;
    s = yaziYaz.tick(s, ctxAt(guessAt, players));
    step(guesser, { kind: "guessPlayer", target: w1 }, guessAt);
    // Tipik İngilizce klavye girişi: büyük I, ı/ş/ğ yok.
    step(guesser, { kind: "guessWord", text: "isik EVI" }, guessAt);
    const j = yaziYazJudge(s, guesser, w1, s.guessWord[guesser] ?? "");
    expect(j.personOk && j.wordOk).toBe(true);
    // Başka kelimeyle karışmaz.
    expect(yaziYazJudge(s, guesser, w1, "cig kofte").wordOk).toBe(false);
    expect(yaziYazJudge(s, guesser, w2, "CIG KOFTE").wordOk).toBe(true);
  });

  it("Kendim: İngilizce klavyeyle yazan, Türkçe yazanla denk sayılır (ÇAY = cay)", () => {
    const players = ["a", "b", "c", "d"];
    const T0 = 1_000_000;
    let s = kendim.setup(players, ctxAt(T0, players));
    const write = (who: string, text: string) => {
      const action = kendim.parseAction({ kind: "write", text });
      if (action === null) throw new Error("geçersiz");
      const r = kendim.reduce(s, who, action, ctxAt(T0 + 1_000, players));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    };
    write("a", "çay");
    write("b", "cay");
    write("c", "ağaç");
    write("d", "mavi");
    const matchAt = T0 + KENDIM_WRITE_MS + 1_000;
    s = kendim.tick(s, ctxAt(matchAt, players));
    const cards = kendimCards(s);
    const bCard = cards.find((c) => c.owner === "b");
    const cCard = cards.find((c) => c.owner === "c");
    if (!bCard || !cCard) throw new Error("kart yok");
    // c, "CAY" kartını a'ya bağlar: a "ÇAY" yazdı, kart "CAY" ile aynı kelime sayılır.
    const act = (who: string, card: number, target: string) => {
      const r = kendim.reduce(s, who, { kind: "match", card, target }, ctxAt(matchAt, players));
      if (isRejected(r)) throw new Error(r.rejected);
      s = r;
    };
    act("c", bCard.id, "a");
    act("d", cCard.id, "a");
    const minis = kendim.result(s).miniScores;
    expect(minis.c).toBe(1);
    expect(minis.d).toBe(-1);
  });

  it("Çağrışım: İngilizce ve Türkçe yazılış aynı grupta; ekranda Türkçe harfli yazılış görünür (sıradan bağımsız)", () => {
    for (const order of [
      { a: "kasik", b: "KAŞIK" },
      { a: "KAŞIK", b: "kasik" },
    ]) {
      const r = groupAnswers(["a", "b", "c"], { ...order, c: "bıçak" });
      expect(r.groups).toHaveLength(1);
      expect(r.groups[0]?.text).toBe("kaşık");
      expect(r.groups[0]?.points).toBe(2);
      expect(r.singles).toHaveLength(1);
    }
    // ı/i karışıklığı: ISI (İngilizce klavye) ile ısı aynı grup.
    const r = groupAnswers(["a", "b"], { a: "ISI", b: "ısı" });
    expect(r.groups[0]?.members).toEqual(["a", "b"]);
    expect(r.groups[0]?.text).toBe("ısı");
  });

  it("Çağrışım: anlamca farklı ama klavye açısından aynı iki kelime bilinçli olarak birleşir (kuş = kus)", () => {
    const r = groupAnswers(["a", "b"], { a: "kuş", b: "kus" });
    expect(r.groups).toHaveLength(1);
  });

  it("Sözlük Blöfü: gerçek tanımın İngilizce klavyeyle yazılmış hâli 'same_as_real' ile reddedilir", () => {
    const players = ["a", "b", "c"];
    const T0 = 1_000_000;
    const s0 = sozlukBlofu.setup(players, ctxAt(T0, players));
    const s = { ...s0, definition: "Duvarın dikliğini ölçen, ucuna ağırlık bağlı ip" };
    const r = sozlukBlofu.reduce(
      s,
      "a",
      { kind: "bluff", text: "DUVARIN DIKLIGINI OLCEN UCUNA AGIRLIK BAGLI IP" },
      ctxAt(T0 + 1_000, players),
    );
    expect(isRejected(r) ? r.rejected : null).toBe("same_as_real");
  });

  it("Bozuk Telefon: büyük I / İ / ı ve aksansız yazılış aynı kelime sayılır", () => {
    expect(bozukNormalizeWords("Kapıyı AÇ ışığı")).toEqual(bozukNormalizeWords("KAPIYI AC ISIGI"));
    expect(bozukNormalizeWords("İNCİ")).toEqual(bozukNormalizeWords("inci"));
  });
});
