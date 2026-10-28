/** Kozmetik mağaza (U18 M2): depo işlemleri, HTTP uçları ve odadaki oyunculara görünürlük. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COSMETIC_ITEMS, dailyDeals, nextIstanbulMidnight, parseCosmetics } from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { parseBuy, parseEquip } from "./shopApi.js";
import { Client, k, loginCookie, sync, until, useServer } from "./testkit.js";

const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);

function setup() {
  const db: AccountStore = createAccounts(":memory:");
  const mk = (n: string, glix = 0): number => {
    const r = db.create(n, `${n.toLowerCase()}@t.local`, "x", 1);
    if (!r.ok) throw new Error("hesap");
    if (glix > 0) db.adjustGlix(r.account.id, glix, "test", 1);
    return r.account.id;
  };
  const dealIds = new Set(dailyDeals(NOON).map((d) => d.itemId));
  const plain = (rarity: string) => COSMETIC_ITEMS.find((i) => i.rarity === rarity && !dealIds.has(i.id));
  return { db, mk, dealIds, plain };
}

describe("mağaza göçü", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-magaza-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("sahip olunanlar ve kuşanılanlar yeniden açılışta kalır", () => {
    const path = join(dir, "hesap.db");
    const first = createAccounts(path);
    const r = first.create("Ali", "ali@t.local", "x", 1);
    if (!r.ok) throw new Error("hesap");
    first.adjustGlix(r.account.id, 500, "t", 1);
    expect(first.purchaseCosmetic(r.account.id, "unvan-efsane", NOON).ok).toBe(false);
    expect(first.purchaseCosmetic(r.account.id, "unvan-sansli", NOON).ok).toBe(true);
    first.equipCosmetic(r.account.id, "unvan", "unvan-sansli");
    first.close();
    const again = createAccounts(path);
    const dump = again.cosmetics(r.account.id);
    expect(dump.owned.map((o) => o.itemId)).toEqual(["unvan-sansli"]);
    expect(dump.equipped).toEqual({ unvan: "unvan-sansli" });
    again.close();
  });
});

describe("satın alma işlemi", () => {
  it("bakiye düşer, sahiplik ve defter satırı (negatif, ref = ürün) birlikte yazılır", () => {
    const { db, mk, dealIds, plain } = setup();
    const id = mk("Ali", 1000);
    const it = plain("siradan");
    if (!it) throw new Error("ürün");
    expect(dealIds.has(it.id)).toBe(false);
    const r = db.purchaseCosmetic(id, it.id, NOON);
    expect(r).toEqual({ ok: true, balance: 850, price: 150 });
    expect(db.glixBalance(id)).toBe(850);
    expect(db.glixLedger(id, 5)[0]).toMatchObject({ amount: -150, reason: "satin-alma", ref: it.id });
    expect(db.cosmetics(id).owned).toEqual([{ itemId: it.id, acquiredAt: NOON, pricePaid: 150 }]);
  });

  it("fırsattaki ürün indirimli fiyattan alınır (sunucu hesaplar)", () => {
    const { db, mk } = setup();
    const id = mk("Ali", 1000);
    const deal = dailyDeals(NOON)[0];
    if (!deal) throw new Error("fırsat");
    const r = db.purchaseCosmetic(id, deal.itemId, NOON);
    expect(r).toEqual({ ok: true, balance: 1000 - deal.price, price: deal.price });
    expect(deal.price).toBeLessThan(deal.listPrice);
    expect(db.cosmetics(id).owned[0]?.pricePaid).toBe(deal.price);
  });

  it("fırsat ertesi gün biter: liste fiyatı", () => {
    const { db, mk } = setup();
    const id = mk("Ali", 5000);
    const deal = dailyDeals(NOON)[0];
    if (!deal) throw new Error("fırsat");
    const tomorrow = nextIstanbulMidnight(NOON) + 1000;
    const stillDeal = dailyDeals(tomorrow).some((d) => d.itemId === deal.itemId);
    const r = db.purchaseCosmetic(id, deal.itemId, tomorrow);
    expect(r.ok && r.price).toBe(stillDeal ? deal.price : deal.listPrice);
  });

  it("zaten sahip, yetersiz bakiye, bilinmeyen ürün, bilinmeyen hesap: hiçbir şey yazılmaz", () => {
    const { db, mk, plain } = setup();
    const id = mk("Ali", 160);
    const it = plain("siradan");
    if (!it) throw new Error("ürün");
    expect(db.purchaseCosmetic(id, it.id, NOON).ok).toBe(true);
    expect(db.purchaseCosmetic(id, it.id, NOON)).toEqual({ ok: false, reason: "owned" });
    const rare = plain("nadir");
    if (!rare) throw new Error("ürün");
    expect(db.purchaseCosmetic(id, rare.id, NOON)).toMatchObject({
      ok: false,
      reason: "insufficient",
      balance: 10,
    });
    expect(db.purchaseCosmetic(id, "yok-boyle", NOON)).toEqual({ ok: false, reason: "unknown" });
    expect(db.purchaseCosmetic(999, it.id, NOON)).toEqual({ ok: false, reason: "missing" });
    expect(db.glixBalance(id)).toBe(10);
    expect(db.glixLedger(id, 10)).toHaveLength(2); // yükleme + tek alış
    expect(db.cosmetics(id).owned).toHaveLength(1);
  });

  it("ardışık alışlar bakiyeyi aşamaz (tek işlem): yalnız biri geçer", () => {
    const { db, mk, plain } = setup();
    const id = mk("Ali", 150);
    const a = plain("siradan");
    const b = COSMETIC_ITEMS.find(
      (i) => i.rarity === "siradan" && i.id !== a?.id && !dailyDeals(NOON).some((d) => d.itemId === i.id),
    );
    if (!a || !b) throw new Error("ürün");
    const results = [db.purchaseCosmetic(id, a.id, NOON), db.purchaseCosmetic(id, b.id, NOON)];
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(db.glixBalance(id)).toBe(0);
  });
});

describe("kuşanma", () => {
  it("yalnız sahip olunan ve türü tutan ürün kuşanılır; null temel seçimdir", () => {
    const { db, mk } = setup();
    const id = mk("Ali", 1000);
    expect(db.equipCosmetic(id, "unvan", "unvan-sansli")).toBe("not_owned");
    db.purchaseCosmetic(id, "unvan-sansli", NOON);
    expect(db.equipCosmetic(id, "unvan", "unvan-sansli")).toBe("ok");
    expect(db.cosmetics(id).equipped).toEqual({ unvan: "unvan-sansli" });
    // Başka türün yuvasına konamaz.
    expect(db.equipCosmetic(id, "cerceve", "unvan-sansli")).toBe("unknown");
    expect(db.equipCosmetic(id, "unvan", "yok-boyle")).toBe("unknown");
    expect(db.equipCosmetic(999, "unvan", null)).toBe("missing");
    expect(db.equipCosmetic(id, "unvan", null)).toBe("ok");
    expect(db.cosmetics(id).equipped).toEqual({});
  });

  it("armağan: fiyat 0, bakiye ve defter değişmez; geri alma kuşanılanı da çıkarır", () => {
    const { db, mk } = setup();
    const id = mk("Ali", 0);
    expect(db.grantCosmetic(id, "cerceve-cift", NOON)).toBe("granted");
    expect(db.grantCosmetic(id, "cerceve-cift", NOON)).toBe("owned");
    expect(db.grantCosmetic(id, "yok", NOON)).toBe("unknown");
    expect(db.grantCosmetic(999, "cerceve-cift", NOON)).toBe("missing");
    expect(db.glixBalance(id)).toBe(0);
    expect(db.glixLedger(id, 5)).toEqual([]);
    expect(db.cosmetics(id).owned[0]).toMatchObject({ itemId: "cerceve-cift", pricePaid: 0 });
    db.equipCosmetic(id, "cerceve", "cerceve-cift");
    expect(db.revokeCosmetic(id, "cerceve-cift")).toBe(true);
    expect(db.revokeCosmetic(id, "cerceve-cift")).toBe(false);
    expect(db.cosmetics(id)).toEqual({ owned: [], equipped: {} });
  });

  it("hesap silinince sahiplik ve kuşanma da silinir (başkasınınki kalır)", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    const b = mk("Bora");
    db.grantCosmetic(a, "unvan-efsane", NOON);
    db.equipCosmetic(a, "unvan", "unvan-efsane");
    db.grantCosmetic(b, "unvan-efsane", NOON);
    expect(db.deleteAccount(a)).toBe(true);
    expect(db.cosmetics(a)).toEqual({ owned: [], equipped: {} });
    expect(db.cosmetics(b).owned).toHaveLength(1);
  });
});

describe("kürsü karakteri: dans, şapka, üst", () => {
  it("satın alma ve kuşanma yuva başına tek; yuvalar birbirini bozmaz", () => {
    const { db, mk } = setup();
    const id = mk("Ali", 5000);
    for (const item of ["dans-twist", "dans-makarena", "sapka-neon-kep", "ust-neon-bomber"]) {
      expect(db.purchaseCosmetic(id, item, NOON).ok).toBe(true);
    }
    expect(db.glixBalance(id)).toBe(5000 - 150 - 400 - 150 - 400);
    expect(db.equipCosmetic(id, "dans", "dans-twist")).toBe("ok");
    expect(db.equipCosmetic(id, "dans", "dans-makarena")).toBe("ok");
    expect(db.equipCosmetic(id, "sapka", "sapka-neon-kep")).toBe("ok");
    expect(db.equipCosmetic(id, "ust", "ust-neon-bomber")).toBe("ok");
    // dans yuvasında tek ürün: ikincisi birincinin yerini aldı
    expect(db.cosmetics(id).equipped).toEqual({
      dans: "dans-makarena",
      sapka: "sapka-neon-kep",
      ust: "ust-neon-bomber",
    });
    // yanlış yuva ve alınmamış ürün
    expect(db.equipCosmetic(id, "ust", "sapka-neon-kep")).toBe("unknown");
    expect(db.equipCosmetic(id, "dans", "dans-kazacok")).toBe("not_owned");
    expect(db.equipCosmetic(id, "dans", null)).toBe("ok");
    expect(db.cosmetics(id).equipped).toEqual({ sapka: "sapka-neon-kep", ust: "ust-neon-bomber" });
  });

  it("efsanevi dans 600 Glix ile alınamaz; varsayılan dans satılmaz", () => {
    const { db, mk } = setup();
    // fırsat indirimi en çok %30: 600 Glix hangi gün olursa olsun 1000'lik dansa yetmez
    const id = mk("Ali", 600);
    expect(db.purchaseCosmetic(id, "dans-kazacok", NOON)).toMatchObject({
      ok: false,
      reason: "insufficient",
    });
    // varsayılan dans ürün değildir: satın alınamaz
    expect(db.purchaseCosmetic(id, "dans-sevinc", NOON)).toMatchObject({ ok: false, reason: "unknown" });
  });

  it("armağan ve geri alma kuşanılan dansı çıkarır", () => {
    const { db, mk } = setup();
    const id = mk("Ali");
    expect(db.grantCosmetic(id, "dans-cizgi-film", NOON)).toBe("granted");
    expect(db.equipCosmetic(id, "dans", "dans-cizgi-film")).toBe("ok");
    expect(db.cosmetics(id).equipped).toEqual({ dans: "dans-cizgi-film" });
    expect(db.revokeCosmetic(id, "dans-cizgi-film")).toBe(true);
    expect(db.cosmetics(id).equipped).toEqual({});
  });

  it("istek gövdesi yeni türleri tanır", () => {
    expect(parseEquip({ type: "dans", itemId: "dans-twist" })).toEqual({
      type: "dans",
      itemId: "dans-twist",
    });
    expect(parseEquip({ type: "sapka", itemId: null })).toEqual({ type: "sapka", itemId: null });
    expect(parseEquip({ type: "ust", itemId: "ust-neon-bomber" })?.type).toBe("ust");
    expect(parseEquip({ type: "alt", itemId: null })).toBeNull();
  });
});

describe("istek gövdeleri", () => {
  it("satın alma: yalnız itemId", () => {
    expect(parseBuy({ itemId: "unvan-sansli" })).toEqual({ itemId: "unvan-sansli" });
    for (const bad of [
      null,
      [],
      {},
      { itemId: 3 },
      { itemId: "" },
      { itemId: "a", x: 1 },
      { itemId: "x".repeat(65) },
    ])
      expect(parseBuy(bad)).toBeNull();
  });
  it("kuşanma: tür + ürün ya da null", () => {
    expect(parseEquip({ type: "unvan", itemId: null })).toEqual({ type: "unvan", itemId: null });
    expect(parseEquip({ type: "cerceve", itemId: "x" })).toEqual({ type: "cerceve", itemId: "x" });
    for (const bad of [
      {},
      { type: "unvan" },
      { type: "kart", itemId: null },
      { type: "unvan", itemId: 4 },
      { type: "unvan", itemId: null, x: 1 },
    ])
      expect(parseEquip(bad)).toBeNull();
  });
});

describe("mağaza uçları", () => {
  useServer();
  const base = () => `http://127.0.0.1:${k.srv.port}`;
  async function call(
    method: "GET" | "POST",
    path: string,
    cookie: string | null,
    body?: unknown,
    origin = true,
  ) {
    const res = await fetch(`${base()}/api/shop${path}`, {
      method,
      headers: {
        ...(origin ? { Origin: base() } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }
  const idOf = (name: string): number => {
    const found = k.srv.accounts.findByUsername(name);
    if (!found) throw new Error("hesap");
    return found.id;
  };
  const notDeal = (rarity: string) =>
    COSMETIC_ITEMS.find(
      (i) => i.rarity === rarity && !dailyDeals(k.clock.now()).some((d) => d.itemId === i.id),
    );

  it("oturum şart: misafir 401, yanlış yöntem 405, Origin yoksa 403", async () => {
    expect((await call("GET", "", null)).status).toBe(401);
    expect((await call("POST", "/buy", null, { itemId: "unvan-sansli" })).status).toBe(401);
    const c = loginCookie("Magaza_A");
    expect((await call("POST", "", c, {})).status).toBe(405);
    expect((await call("GET", "/buy", c)).status).toBe(405);
    expect((await call("POST", "/buy", c, { itemId: "unvan-sansli" }, false)).status).toBe(403);
    expect((await call("GET", "/yok", c)).status).toBe(404);
  });

  it("durum: bakiye, sahip olunanlar, kuşanılanlar, fırsat ve gece yarısı", async () => {
    const c = loginCookie("Magaza_B");
    k.srv.accounts.adjustGlix(idOf("Magaza_B"), 300, "t", k.clock.now());
    const r = await call("GET", "", c);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      balance: 300,
      owned: [],
      equipped: {},
      deals: dailyDeals(k.clock.now()),
      dealEndsAt: nextIstanbulMidnight(k.clock.now()),
      serverNow: k.clock.now(),
    });
  });

  it("geçersiz gövde 400, bilinmeyen ürün 404", async () => {
    const c = loginCookie("Magaza_C");
    expect((await call("POST", "/buy", c, {})).status).toBe(400);
    expect((await call("POST", "/buy", c, { itemId: 5 })).status).toBe(400);
    expect((await call("POST", "/buy", c, { itemId: "yok-boyle" })).status).toBe(404);
    expect((await call("POST", "/equip", c, { type: "kart", itemId: null })).status).toBe(400);
    expect((await call("POST", "/equip", c, { type: "unvan", itemId: "yok-boyle" })).status).toBe(404);
    const raw = await fetch(`${base()}/api/shop/buy`, {
      method: "POST",
      headers: { Origin: base(), Cookie: c, "Content-Type": "text/plain" },
      body: "{}",
    });
    expect(raw.status).toBe(400);
  });

  it("satın alma: yetersiz bakiye 409 (eksik tutar), sonra başarı; ikinci kez 409", async () => {
    const c = loginCookie("Magaza_D");
    const id = idOf("Magaza_D");
    const it = notDeal("siradan");
    if (!it) throw new Error("ürün");
    k.srv.accounts.adjustGlix(id, 100, "t", k.clock.now());
    const short = await call("POST", "/buy", c, { itemId: it.id });
    expect(short.status).toBe(409);
    expect(short.body).toMatchObject({ code: "insufficient_glix", balance: 100, price: 150 });
    k.srv.accounts.adjustGlix(id, 100, "t", k.clock.now());
    const ok = await call("POST", "/buy", c, { itemId: it.id });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ balance: 50, price: 150, itemId: it.id });
    const again = await call("POST", "/buy", c, { itemId: it.id });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("already_owned");
    expect(k.srv.accounts.glixBalance(id)).toBe(50);
  });

  it("fırsattaki ürün indirimli fiyattan çıkar", async () => {
    const c = loginCookie("Magaza_E");
    const id = idOf("Magaza_E");
    k.srv.accounts.adjustGlix(id, 2000, "t", k.clock.now());
    const deal = dailyDeals(k.clock.now())[0];
    if (!deal) throw new Error("fırsat");
    const r = await call("POST", "/buy", c, { itemId: deal.itemId });
    expect(r.body).toMatchObject({ price: deal.price, balance: 2000 - deal.price });
    expect(deal.price).toBeLessThan(deal.listPrice);
  });

  it("kuşanma: sahip değilken 409; alınca kuşanılır, durumda görünür, null ile çıkar", async () => {
    const c = loginCookie("Magaza_F");
    const id = idOf("Magaza_F");
    k.srv.accounts.adjustGlix(id, 1000, "t", k.clock.now());
    const it = notDeal("siradan");
    if (!it) throw new Error("ürün");
    const type = it.type;
    expect((await call("POST", "/equip", c, { type, itemId: it.id })).body.code).toBe("not_owned");
    await call("POST", "/buy", c, { itemId: it.id });
    const eq = await call("POST", "/equip", c, { type, itemId: it.id });
    expect(eq.status).toBe(200);
    expect(eq.body.equipped).toEqual({ [type]: it.id });
    expect(((await call("GET", "", c)).body as { equipped: unknown }).equipped).toEqual({ [type]: it.id });
    // Başka türün yuvasına konamaz.
    const other = type === "unvan" ? "cerceve" : "unvan";
    expect((await call("POST", "/equip", c, { type: other, itemId: it.id })).status).toBe(404);
    expect((await call("POST", "/equip", c, { type, itemId: null })).body.equipped).toEqual({});
  });

  it("hız sınırı: yazma uçları dolunca 429", async () => {
    const c = loginCookie("Magaza_G");
    const codes: number[] = [];
    for (let i = 0; i < 22; i++) codes.push((await call("POST", "/buy", c, { itemId: "yok-boyle" })).status);
    expect(codes.slice(0, 20).every((s) => s === 404)).toBe(true);
    expect(codes[21]).toBe(429);
  });
});

describe("kuşanılanlar odadaki herkese görünür", () => {
  useServer();

  async function enter(cookie: string | undefined, nickname: string, code?: string): Promise<Client> {
    const c = await Client.connect(cookie);
    if (code) c.send({ type: "joinRoom", code, nickname });
    else c.send({ type: "createRoom", nickname });
    await until(() => c.updates.length > 0 || c.of("error").length > 0, "oda");
    return c;
  }
  const equip = (cookie: string, body: unknown) =>
    fetch(`http://127.0.0.1:${k.srv.port}/api/shop/equip`, {
      method: "POST",
      headers: {
        Origin: `http://127.0.0.1:${k.srv.port}`,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const me = (c: Client, nick: string) => c.room.players.find((p) => p.nickname === nick);

  it("girişte DB'den gelir; lobide kuşanınca herkes görür; misafirde alan yok; çıkarınca düşer", async () => {
    const aliCookie = loginCookie("Kz_Ali");
    const aliId = k.srv.accounts.findByUsername("Kz_Ali")?.id as number;
    k.srv.accounts.grantCosmetic(aliId, "unvan-efsane", k.clock.now());
    k.srv.accounts.grantCosmetic(aliId, "cerceve-donen-neon", k.clock.now());
    k.srv.accounts.equipCosmetic(aliId, "unvan", "unvan-efsane");

    const ali = await enter(aliCookie, "Kz_Ali");
    const code = ali.session.roomCode;
    const bora = await enter(loginCookie("Kz_Bora"), "Bora", code);
    const misafir = await enter(undefined, "Misafir", code);
    await sync();
    for (const c of [ali, bora, misafir]) {
      expect(me(c, "Kz_Ali")?.cosmetics).toEqual({ title: "unvan-efsane" });
      expect(me(c, "Bora")?.cosmetics).toBeUndefined();
      expect(me(c, "Misafir")?.cosmetics).toBeUndefined();
    }

    expect((await equip(aliCookie, { type: "cerceve", itemId: "cerceve-donen-neon" })).status).toBe(200);
    await until(() => me(bora, "Kz_Ali")?.cosmetics?.frame === "cerceve-donen-neon", "çerçeve");
    expect(me(misafir, "Kz_Ali")?.cosmetics).toEqual({ title: "unvan-efsane", frame: "cerceve-donen-neon" });
    expect(bora.gaps + misafir.gaps + ali.gaps).toBe(0);

    expect((await equip(aliCookie, { type: "unvan", itemId: null })).status).toBe(200);
    await until(() => me(bora, "Kz_Ali")?.cosmetics?.title === undefined, "unvan düştü");
    expect(me(bora, "Kz_Ali")?.cosmetics).toEqual({ frame: "cerceve-donen-neon" });
    expect(parseCosmetics(me(bora, "Kz_Ali")?.cosmetics)).toEqual({ frame: "cerceve-donen-neon" });
  });

  it("dans ve giysi de odadaki herkese gider", async () => {
    const cookie = loginCookie("Kz_Dans");
    const id = k.srv.accounts.findByUsername("Kz_Dans")?.id as number;
    for (const item of ["dans-lambada", "sapka-neon-kep", "ust-neon-bomber"])
      k.srv.accounts.grantCosmetic(id, item, k.clock.now());
    const dans = await enter(cookie, "Kz_Dans");
    const bora = await enter(loginCookie("Kz_Bora2"), "Bora2", dans.session.roomCode);
    await sync();
    expect((await equip(cookie, { type: "dans", itemId: "dans-lambada" })).status).toBe(200);
    expect((await equip(cookie, { type: "sapka", itemId: "sapka-neon-kep" })).status).toBe(200);
    expect((await equip(cookie, { type: "ust", itemId: "ust-neon-bomber" })).status).toBe(200);
    await until(() => me(bora, "Kz_Dans")?.cosmetics?.top === "ust-neon-bomber", "üst giysi");
    expect(me(bora, "Kz_Dans")?.cosmetics).toEqual({
      dance: "dans-lambada",
      hat: "sapka-neon-kep",
      top: "ust-neon-bomber",
    });
    expect((await equip(cookie, { type: "dans", itemId: "dans-twist" })).status).toBe(409);
  });
});
