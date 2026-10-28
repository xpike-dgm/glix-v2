import { describe, expect, it } from "vitest";
import { balanceText, glixInline, glixLines, glixText, guestGlixText, parseGlixEarned } from "./glixRules.js";

const ok = {
  total: 85,
  parts: [
    { kind: "mac", amount: 10 },
    { kind: "sira", amount: 10 },
    { kind: "gununIlki", amount: 20 },
    { kind: "rozet", amount: 25, badgeId: "ilk-mac" },
    { kind: "rozet", amount: 20, badgeId: "x" },
  ],
  balance: 120,
  capped: false,
};

describe("glixEarned doğrulama", () => {
  it("geçerli mesaj kabul edilir", () => {
    expect(parseGlixEarned(ok)?.total).toBe(85);
    expect(parseGlixEarned({ ...ok, parts: [{ kind: "mac", amount: 10 }], total: 10 })?.parts).toHaveLength(
      1,
    );
  });

  it("toplamı tutmayan, bozuk ya da boş mesaj reddedilir", () => {
    expect(parseGlixEarned({ ...ok, total: 84 })).toBeNull();
    expect(parseGlixEarned({ ...ok, balance: -1 })).toBeNull();
    expect(parseGlixEarned({ ...ok, balance: 1.5 })).toBeNull();
    expect(parseGlixEarned({ ...ok, capped: "evet" })).toBeNull();
    expect(parseGlixEarned({ ...ok, parts: "x" })).toBeNull();
    expect(parseGlixEarned({ ...ok, parts: [{ kind: "hile", amount: 85 }], total: 85 })).toBeNull();
    expect(parseGlixEarned({ ...ok, parts: [{ kind: "rozet", amount: 85 }], total: 85 })).toBeNull();
    expect(
      parseGlixEarned({ ...ok, parts: [{ kind: "mac", amount: 85, badgeId: "a" }], total: 85 }),
    ).toBeNull();
    expect(
      parseGlixEarned({ ...ok, parts: [{ kind: "rozet", amount: 85, badgeId: "A B" }], total: 85 }),
    ).toBeNull();
    expect(
      parseGlixEarned({ ...ok, parts: Array(31).fill({ kind: "mac", amount: 1 }), total: 31 }),
    ).toBeNull();
    expect(parseGlixEarned({ total: 0, parts: [], balance: 5, capped: false })).toBeNull();
    expect(parseGlixEarned(null)).toBeNull();
  });

  it("kazanç 0 ama sınır doluysa kabul edilir", () => {
    expect(parseGlixEarned({ total: 0, parts: [], balance: 300, capped: true })?.capped).toBe(true);
  });
});

describe("Glix metinleri", () => {
  it("kısa döküm satırları: rozetler tek satırda toplanır", () => {
    const info = parseGlixEarned(ok);
    if (!info) throw new Error("geçerli olmalı");
    const lines = glixLines(info, 2);
    expect(lines).toEqual([
      { label: "Maç", amount: 10 },
      { label: "2.", amount: 10 },
      { label: "İlk maç ×2", amount: 20 },
      { label: "Rozet", amount: 45 },
    ]);
    expect(glixInline(lines)).toBe("Maç +10 · 2. +10 · İlk maç ×2 +20 · Rozet +45");
    expect(glixLines(info, null)[1]?.label).toBe("Sıra");
  });

  it("toplam, bakiye ve misafir metni", () => {
    expect(glixText(25)).toBe("+25 Glix");
    expect(balanceText(1250)).toMatch(/^1[. ]?250$/);
    expect(guestGlixText(1)).toBe("Hesap açsan +25 Glix kazanırdın");
    expect(guestGlixText(3)).toBe("Hesap açsan +15 Glix kazanırdın");
    expect(guestGlixText(7)).toBe("Hesap açsan +10 Glix kazanırdın");
  });
});
