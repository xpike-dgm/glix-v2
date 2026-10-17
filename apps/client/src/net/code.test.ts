import { describe, expect, it } from "vitest";
import { inviteLink, isCompleteCode, normalizeCode } from "./code.js";

describe("oda kodu girdisi", () => {
  it("büyük harfe çevirir ve 5 karakterde keser", () => {
    expect(normalizeCode("kx7qpzz")).toBe("KX7QP");
  });
  it("boşluk ve işaretleri atar", () => {
    expect(normalizeCode(" k-x 7.q p ")).toBe("KX7QP");
  });
  it("Türkçe i/ı harflerini I yapar", () => {
    expect(normalizeCode("ıİiab")).toBe("IIIAB");
  });
  it("yapıştırılan bağlantıdan kodu alır", () => {
    expect(normalizeCode("https://glix.example/?oda=ab12c")).toBe("AB12C");
  });
  it("tamlık ve davet bağlantısı", () => {
    expect(isCompleteCode("KX7QP")).toBe(true);
    expect(isCompleteCode("KX7")).toBe(false);
    expect(inviteLink("https://glix.example", "KX7QP")).toBe("https://glix.example/?oda=KX7QP");
  });
});
