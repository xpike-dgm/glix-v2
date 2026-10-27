import { describe, expect, it } from "vitest";
import { BANNED_WORD_LENGTH_MAX, cleanBannedWord, foldBanned, matchesBanned } from "./bannedWords.js";

const folded = (...words: string[]): string[] => words.map((w) => foldBanned(w).squashed);

describe("yasaklı kelime normalleştirme", () => {
  it.each([
    ["OROSPU", "orospu"],
    ["Şiş", "sis"],
    ["ığdır", "igdir"],
    ["İSTANBUL", "istanbul"],
    ["Çağrı", "cagri"],
    ["Öğüt", "ogut"],
    ["Güneş", "gunes"],
    ["s1kt1r", "siktir"],
    ["0r0spu", "orospu"],
    ["p3zev3nk", "pezevenk"],
    ["4m1n4", "amina"],
    ["5ik7ir", "siktir"],
    ["s.i.k.t.i.r", "siktir"],
    ["o_r o-s.p u", "orospu"],
    ["S!kt!r", "siktir"],
    ["a@k", "aak"],
  ])("%s -> %s", (input, want) => {
    expect(foldBanned(input).squashed).toBe(want);
  });
});

describe("yasaklı kelime eşleştirme", () => {
  const list = folded("orospu", "siktir", "amk", "göt", "Pezevenk");

  it.each([
    "orospu",
    "OROSPU",
    "Orospu_çocuğu",
    "xxorospuxx",
    "S1KT1R",
    "s.i.k.t.i.r",
    "s i k t i r",
    "0r0spu",
    "Pezevenk123",
    "ali_amk",
    "AMK",
    "a m k",
    "a.m.k",
    "göt",
    "Göt_1",
    "p3z3v3nk",
  ])("takılır: %s", (name) => {
    expect(matchesBanned(name, list)).toBe(true);
  });

  it.each([
    "Ahmet",
    "Ayşe_42",
    "Kamkum", // "amk" başka sözcüğün içinde
    "Amasya",
    "Sıkıntı",
    "Sikke",
    "Gotham", // "göt" kısa kelime, sözcüğün içinde
    "Götürmek",
    "Kitap",
    "Pasta",
    "Mehmet",
    "Gül",
    "Siyah_Kedi",
    "Orman",
    "bozuk_telefon",
  ])("takılmaz: %s", (name) => {
    expect(matchesBanned(name, list)).toBe(false);
  });

  it("boş liste hiçbir şeyi engellemez", () => {
    expect(matchesBanned("orospu", [])).toBe(false);
  });

  it("yalnız ayraçtan oluşan metin eşleşmez", () => {
    expect(matchesBanned("___", list)).toBe(false);
    expect(matchesBanned("", list)).toBe(false);
  });
});

describe("yasaklı kelime girdisi", () => {
  it("kırpar, boşlukları sadeleştirir, normalleşmiş hâli döner", () => {
    expect(cleanBannedWord("  Ş.i  K ")).toEqual({ word: "Ş.i K", folded: "sik" });
  });
  it("geçersizleri reddeder", () => {
    for (const bad of [
      "",
      "   ",
      "a", // tek harf herkesi engellerdi
      "1", // yalnız rakam: "i" olur, tek harf
      "---",
      "x".repeat(BANNED_WORD_LENGTH_MAX + 1),
      "a\u0000b",
      "<b>",
      5,
      null,
    ])
      expect(cleanBannedWord(bad), String(bad)).toBeNull();
    expect(cleanBannedWord("x".repeat(BANNED_WORD_LENGTH_MAX))).not.toBeNull();
  });
});
