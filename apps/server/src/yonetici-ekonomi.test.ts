/** Yönetici paneli: Glix ekonomisi ucu (`GET /api/admin/economy`). */
import type { AdminEconomy } from "@glix/engine";
import { COSMETIC_ITEMS, dailyDeals, GLIX_DAILY_MATCH_CAP } from "@glix/engine";
import { beforeEach, describe, expect, it } from "vitest";
import { buildEconomy } from "./adminData.js";
import { istanbulDayStart } from "./badges.js";
import { createManualClock } from "./clock.js";
import { k, loginCookie, useServer } from "./testkit.js";
import { ADMIN, createAdminKit, MAIL } from "./yoneticiKit.js";

const DAY = 24 * 3600 * 1000;
/** 2026-10-26 12:00 İstanbul. */
const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);
const TODAY = istanbulDayStart(NOON);
const YESTERDAY = TODAY - DAY;

const kit = createAdminKit();
/** Sunucu saati doğrudan bugünün öğlesinde başlar (saati ileri sarmak sunucunun zamanlayıcılarını koşturur). */
const clock = createManualClock(NOON);

describe("Glix ekonomisi ucu", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch: kit.mailFetch, statsDb: ":memory:", clock });
  beforeEach(() => {
    kit.sent.length = 0;
    k.clock = clock;
  });

  const id = (name: string): number => {
    loginCookie(name);
    const found = k.srv.accounts.findByUsername(name);
    if (!found) throw new Error(name);
    return found.id;
  };

  it("giriş ve yönetici kodu olmadan açılmaz; geçersiz aralık reddedilir", async () => {
    id("yonetici_1"); // ilk hesap yöneticidir
    expect((await kit.get("economy", null)).status).toBe(401);
    const user = loginCookie("Sade_Kullanici");
    // Yönetici olmayan hesap için uç yokmuş gibi davranır.
    expect((await kit.get("economy", user)).status).toBe(404);
    const admin = await kit.adminLogin();
    expect((await kit.post("economy", admin)).status).toBe(405);
    for (const bad of ["0", "1", "8", "90", "abc", ""]) {
      const r = await kit.get(`economy?days=${bad}`, admin);
      expect(r.status, bad).toBe(400);
    }
    expect((await kit.get("economy", admin)).status).toBe(200);
  });

  it("OTP girilmemiş yönetici 403 alır", async () => {
    id("yonetici_1");
    const sess = loginCookie("yonetici_1");
    expect((await kit.get("economy?days=7", sess)).status).toBe(403);
  });

  it("aralık: 7 ve 30 gün, eskiden yeniye, son gün bugün", async () => {
    const admin = await kit.adminLogin();
    const a = await kit.get<AdminEconomy>("economy?days=7", admin);
    expect(a.body.daily).toHaveLength(7);
    expect(a.body.daily.at(-1)?.day).toBe("2026-10-26");
    expect(a.body.daily[0]?.day).toBe("2026-10-20");
    const b = await kit.get<AdminEconomy>("economy?days=30", admin);
    expect(b.body.daily).toHaveLength(30);
    expect(b.body.daily[0]?.day).toBe("2026-09-27");
    expect(b.body.dailyCap).toBe(GLIX_DAILY_MATCH_CAP);
  });

  it("seed edilmiş defterde sayılar doğru; İstanbul gün sınırı gece yarısı UTC+3", async () => {
    const admin = await kit.adminLogin();
    const acc = k.srv.accounts;
    const a = id("Ekonomi_A");
    const b = id("Ekonomi_B");
    const c = id("Ekonomi_C");

    // Yönetici düzeltmeleri: dünün son milisaniyesi dünün, bugünün ilk milisaniyesi bugünün sayılır.
    expect(acc.adjustGlix(a, 2000, "kurulum", TODAY - 1).ok).toBe(true);
    // B de fırsat ürününü alabilsin: katalog büyüyünce fırsat nadirlik değiştirir (en pahalısı 700).
    expect(acc.adjustGlix(b, 1000, "kurulum", YESTERDAY + 5).ok).toBe(true);
    expect(acc.adjustGlix(a, 40, "bugun", TODAY).ok).toBe(true);
    expect(acc.adjustGlix(a, -30, "eksi", TODAY + 5).ok).toBe(true);
    acc.creditBadgeGlix(b, [{ badgeId: "ilk-mac", amount: 25 }], TODAY + 10);
    acc.creditBadgeGlix(b, [{ badgeId: "dun", amount: 50 }], YESTERDAY + 10);

    // Günlük sınıra ulaşanlar: C dün, B bugün.
    const fill = (acct: number, start: number): void => {
      for (let i = 0; i < 40 && acc.glixEarnedToday(acct, start + 60_000) < GLIX_DAILY_MATCH_CAP; i++)
        acc.creditMatchGlix(acct, start + 60_000 + i, 1);
    };
    fill(c, YESTERDAY);
    fill(b, TODAY);
    expect(acc.glixEarnedToday(c, YESTERDAY + 60_000)).toBe(GLIX_DAILY_MATCH_CAP);
    // Sınıra ulaşmayan hesap: A bugün tek maç.
    acc.creditMatchGlix(a, TODAY + 90_000, 2);

    // Satışlar: fırsattaki ürün fırsat fiyatıyla, fırsat dışı ürün liste fiyatıyla; biri bir önceki gün.
    const deals = dailyDeals(NOON);
    const dealItem = deals[0];
    if (!dealItem) throw new Error("fırsat yok");
    const plain = COSMETIC_ITEMS.find((i) => i.price > 0 && !deals.some((d) => d.itemId === i.id));
    if (!plain) throw new Error("ürün yok");
    acc.grantCosmetic(c, plain.id, TODAY); // armağan: satış sayılmaz
    expect(acc.purchaseCosmetic(a, dealItem.itemId, TODAY + 1000)).toMatchObject({ ok: true });
    expect(acc.purchaseCosmetic(b, dealItem.itemId, TODAY + 2000)).toMatchObject({ ok: true });
    expect(acc.purchaseCosmetic(a, plain.id, TODAY + 3000)).toMatchObject({ ok: true });

    const r = await kit.get<AdminEconomy>("economy?days=7", admin);
    expect(r.status).toBe(200);
    const e = r.body;
    const byDay = new Map(e.daily.map((d) => [d.day, d]));
    const today = byDay.get("2026-10-26");
    const yesterday = byDay.get("2026-10-25");
    if (!today || !yesterday) throw new Error("gün yok");

    // Maç kazancı, defterden bağımsız toplanır.
    const mac = (acct: number, from: number, to: number): number =>
      acc
        .glixLedger(acct, 1000)
        .filter((x) => x.reason === "mac" && x.at >= from && x.at < to)
        .reduce((s, x) => s + x.amount, 0);
    expect(yesterday.mac).toBe(mac(c, YESTERDAY, TODAY));
    expect(yesterday.mac).toBe(GLIX_DAILY_MATCH_CAP);
    expect(today.mac).toBe(mac(b, TODAY, TODAY + DAY) + mac(a, TODAY, TODAY + DAY));

    expect(yesterday.rozet).toBe(50);
    expect(yesterday.yonetici).toBe(3000);
    expect(today.rozet).toBe(25);
    expect(today.yonetici).toBe(40);
    expect(today.yoneticiEksi).toBe(30);
    expect(today.harcanan).toBe(2 * dealItem.price + plain.price);
    expect(yesterday.harcanan).toBe(0);
    expect(today.kazanilan).toBe(today.mac + 25 + 40);
    expect(today.net).toBe(today.kazanilan - 30 - today.harcanan);
    expect(yesterday.sinirdaki).toBe(1);
    expect(today.sinirdaki).toBe(1);
    expect(e.daily.filter((d) => d.sinirdaki > 0)).toHaveLength(2);

    // Aralık toplamı günlüklerin toplamıdır.
    expect(e.totals.kazanilan).toBe(e.daily.reduce((s, d) => s + d.kazanilan, 0));
    expect(e.totals.harcanan).toBe(today.harcanan);

    // Dolaşım: tüm bakiyelerin toplamı ve bakiyesi olan hesap sayısı.
    const balances = [a, b, c, id("yonetici_1")].map((x) => acc.glixBalance(x));
    expect(e.circulation.total).toBe(balances.reduce((s, x) => s + x, 0));
    expect(e.circulation.holders).toBe(balances.filter((x) => x > 0).length);

    // Satışlar: Türkçe ad, adet, Glix; armağan sayılmaz.
    expect(e.sales).toEqual({ count: 3, glix: 2 * dealItem.price + plain.price });
    expect(e.topItems).toHaveLength(2);
    expect(e.topItems[0]).toMatchObject({ itemId: dealItem.itemId, count: 2, glix: 2 * dealItem.price });
    const names = e.topItems.map((t) => t.name).sort();
    expect(names).toEqual([plain.name, COSMETIC_ITEMS.find((i) => i.id === dealItem.itemId)?.name].sort());
    expect(e.topItems.every((t) => t.typeName !== "")).toBe(true);
    expect(e.byRarity.reduce((s, g) => s + g.glix, 0)).toBe(e.sales.glix);
    expect(e.byType.reduce((s, g) => s + g.count, 0)).toBe(3);

    // Günün fırsatı: yalnız fırsat fiyatıyla bugün satılan sayılır.
    expect(e.deals.map((d) => d.itemId)).toEqual(deals.map((d) => d.itemId));
    expect(e.deals[0]).toMatchObject({ price: dealItem.price, listPrice: dealItem.listPrice, soldToday: 2 });
    expect(e.deals[1]?.soldToday).toBe(0);
    expect(e.dealEndsAt).toBe(TODAY + DAY);
  });

  it("aralık dışı hareketler sayılmaz; en çok satan sıralaması adede göredir", () => {
    const acc = k.srv.accounts;
    const a = id("Ekonomi_D");
    acc.adjustGlix(a, 5000, "kurulum", TODAY - 40 * DAY);
    const paid = COSMETIC_ITEMS.filter((i) => i.price > 0).slice(0, 12);
    // Eski satış (aralık dışı) ve yeni satışlar.
    acc.purchaseCosmetic(a, (paid[0] as (typeof paid)[number]).id, TODAY - 40 * DAY + 1);
    for (const [i, p] of paid.slice(1).entries()) acc.purchaseCosmetic(a, p.id, TODAY - 10 * DAY + i);
    const e7 = buildEconomy(acc, NOON, 7);
    expect(e7.sales.count).toBe(0);
    expect(e7.totals.yonetici).toBe(0);
    const e30 = buildEconomy(acc, NOON, 30);
    expect(e30.sales.count).toBe(paid.length - 1);
    expect(e30.topItems.length).toBeLessThanOrEqual(10);
    expect(e30.topItems.some((t) => t.itemId === (paid[0] as (typeof paid)[number]).id)).toBe(false);
  });
});
