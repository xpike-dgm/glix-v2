import { describe, expect, it } from "vitest";
import { hasWord, typedWord } from "./wordInput.js";

describe("kelime girişi", () => {
  it("giriş büyük harfe ve en çok 24 karaktere çevrilir", () => {
    expect(typedWord("ışık evi")).toBe("IŞIK EVİ");
    expect(typedWord("iı")).toBe("İI");
    expect(typedWord("a".repeat(40))).toHaveLength(24);
    expect(typedWord("a\nb")).toBe("A B");
  });
  it("harf ya da rakam olmayan giriş gönderilemez", () => {
    expect(hasWord("")).toBe(false);
    expect(hasWord(" !! ")).toBe(false);
    expect(hasWord("ev")).toBe(true);
    expect(hasWord("7")).toBe(true);
  });
});
