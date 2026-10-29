/** Glix ekonomisi tutarlılığı: bakiye her zaman defterin toplamıdır; eşzamanlı satın alma çift harcamaz. */
import { COSMETIC_ITEMS, dailyDeals } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { istanbulDayStart } from "./badges.js";
import { k, loginCookie, useServer } from "./testkit.js";

const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);
const DAY = 24 * 3600 * 1000;

function ledgerSum(db: AccountStore, id: number): number {
  return db.glixLedger(id, 100_000).reduce((s, r) => s + r.amount, 0);
}

describe("Glix defteri bakiyeyle tutarlı", () => {
  it("karışık işlemlerden sonra bakiye = defter toplamı ve hiç negatif olmaz", () => {
    const db = createAccounts(":memory:");
    const r = db.create("Ali", "ali@t.local", "x", 1);
    if (!r.ok) throw new Error("hesap");
    const id = r.account.id;
    const items = COSMETIC_ITEMS.slice(0, 12);
    let at = NOON;
    for (let i = 0; i < 60; i++) {
      at += 37 * 60_000;
      db.creditMatchGlix(id, at, (i % 5) + 1);
      if (i % 7 === 0) db.creditBadgeGlix(id, [{ badgeId: `b${i}`, amount: 25 }], at);
      if (i % 3 === 0) db.adjustGlix(id, i % 2 === 0 ? 40 : -90, "t", at);
      const it = items[i % items.length];
      if (it) db.purchaseCosmetic(id, it.id, at);
      expect(db.glixBalance(id)).toBe(ledgerSum(db, id));
      expect(db.glixBalance(id)).toBeGreaterThanOrEqual(0);
    }
  });

  it("günlük sınır İstanbul gününe göre: gece yarısından 1 ms önce ve sonra ayrı günler", () => {
    const db = createAccounts(":memory:");
    const r = db.create("Ali", "ali@t.local", "x", 1);
    if (!r.ok) throw new Error("hesap");
    const id = r.account.id;
    const midnight = istanbulDayStart(NOON) + DAY;
    for (let i = 0; i < 40; i++) db.creditMatchGlix(id, midnight - 1 - i, 1);
    expect(db.glixEarnedToday(id, midnight - 1)).toBe(300);
    expect(db.glixEarnedToday(id, midnight)).toBe(0);
    const next = db.creditMatchGlix(id, midnight, 4);
    expect(next?.total).toBe(20);
  });
});

describe("eşzamanlı satın alma (HTTP)", () => {
  useServer();
  const base = () => `http://127.0.0.1:${k.srv.port}`;
  const buy = (cookie: string, itemId: string) =>
    fetch(`${base()}/api/shop/buy`, {
      method: "POST",
      headers: { Origin: base(), "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ itemId }),
    }).then(async (res) => ({ status: res.status, body: (await res.json()) as Record<string, unknown> }));

  it("aynı ürünü aynı anda alan iki istek: biri geçer, bakiye bir kez düşer", async () => {
    const cookie = loginCookie("Eszamanli_A");
    const acc = k.srv.accounts.findByUsername("Eszamanli_A");
    if (!acc) throw new Error("hesap");
    k.srv.accounts.adjustGlix(acc.id, 1000, "t", k.clock.now());
    const deals = new Set(dailyDeals(k.clock.now()).map((d) => d.itemId));
    const it = COSMETIC_ITEMS.find((i) => i.rarity === "siradan" && !deals.has(i.id));
    if (!it) throw new Error("ürün");
    const out = await Promise.all([buy(cookie, it.id), buy(cookie, it.id), buy(cookie, it.id)]);
    expect(out.map((o) => o.status).sort()).toEqual([200, 409, 409]);
    expect(k.srv.accounts.glixBalance(acc.id)).toBe(850);
    expect(ledgerSum(k.srv.accounts, acc.id)).toBe(850);
  });

  it("farklı ürünler aynı anda: bakiye yetmeyen reddedilir, bakiye negatife inmez", async () => {
    const cookie = loginCookie("Eszamanli_B");
    const acc = k.srv.accounts.findByUsername("Eszamanli_B");
    if (!acc) throw new Error("hesap");
    k.srv.accounts.adjustGlix(acc.id, 300, "t", k.clock.now());
    const deals = new Set(dailyDeals(k.clock.now()).map((d) => d.itemId));
    const pool = COSMETIC_ITEMS.filter((i) => i.rarity === "siradan" && !deals.has(i.id)).slice(0, 4);
    const out = await Promise.all(pool.map((i) => buy(cookie, i.id)));
    expect(out.filter((o) => o.status === 200)).toHaveLength(2);
    expect(k.srv.accounts.glixBalance(acc.id)).toBe(0);
  });
});
