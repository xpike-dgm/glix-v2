import { describe, expect, it } from "vitest";
import { balanceText, glixLines, glixText, guestGlixText, parseGlixEarned } from "./glixRules.js";

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
  it("döküm satırları", () => {
    const info = parseGlixEarned(ok);
    if (!info) throw new Error("geçerli olmalı");
    const names: Record<string, string> = { "ilk-mac": "İlk Adım" };
    expect(glixLines(info, 2, (id) => names[id])).toEqual([
      { label: "Maç", amount: 10 },
      { label: "2. oldun", amount: 10 },
      { label: "Günün ilk maçı ×2", amount: 20 },
      { label: "Rozet: İlk Adım", amount: 25 },
      { label: "Rozet: Yeni rozet", amount: 20 },
    ]);
    expect(glixLines(info, null, () => undefined)[1]?.label).toBe("Sıralama");
  });

  it("toplam, bakiye ve misafir metni", () => {
    expect(glixText(25)).toBe("+25 Glix");
    expect(balanceText(1250)).toMatch(/^Glix bakiyen: 1[. ]?250$/);
    expect(guestGlixText(1)).toBe("Hesap açsaydın 25 Glix kazanırdın");
    expect(guestGlixText(3)).toBe("Hesap açsaydın 15 Glix kazanırdın");
    expect(guestGlixText(7)).toBe("Hesap açsaydın 10 Glix kazanırdın");
  });
});
