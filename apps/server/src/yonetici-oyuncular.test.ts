/**
 * Yönetici paneli: oyuncu listesi (imleçli sayfalama), canlı durum, Glix "bakiyeyi ayarla", kozmetik kuşanmayı kaldırma,
 * oda atma koruması ve `me` yanıtındaki yönetici işareti.
 */
import type { DatabaseSync } from "node:sqlite";
import type { AdminAccountDetail, AdminPlayerPage, AdminPlayerRow } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { ACCOUNT_MIGRATIONS, type AdminPlayerListQuery, playerListSql } from "./accountStore.js";
import {
  decodeCursor,
  encodeCursor,
  GLIX_ADJUST_MAX,
  PLAYER_PAGE_MAX,
  parseAction,
  parsePlayerQuery,
} from "./admin.js";
import { loadSqlite } from "./statsStore.js";
import { Client, create, k, loginCookie, sync, until, useServer } from "./testkit.js";
import { ADMIN, base, createAdminKit, MAIL, type Reply } from "./yoneticiKit.js";

const kit = createAdminKit();
const DAY = 24 * 3600 * 1000;

const idOf = (name: string): number => {
  const found = k.srv.accounts.findByUsername(name);
  if (!found) throw new Error(`hesap yok: ${name}`);
  return found.id;
};

describe("oyuncu listesi girdileri", () => {
  it("sorgu dizgesi: varsayılanlar, yönler ve sınır", () => {
    const q = (s: string) => parsePlayerQuery(new URLSearchParams(s));
    expect(q("")).toMatchObject({ filter: "all", sort: "seen", dir: "desc", prefix: null, limit: 25 });
    expect(q("sort=name")).toMatchObject({ sort: "name", dir: "asc" });
    expect(q("sort=glix&dir=asc")).toMatchObject({ sort: "glix", dir: "asc" });
    expect(q("q=Ali_1")).toMatchObject({ prefix: "ali_1" });
    expect(q(`limit=${PLAYER_PAGE_MAX + 500}`)?.limit).toBe(PLAYER_PAGE_MAX);
    for (const bad of [
      "filter=hepsi",
      "sort=email",
      "dir=yukari",
      "limit=0",
      "limit=-3",
      "limit=abc",
      "q=a%25",
      "q=kisi@ornek.com",
    ])
      expect(q(bad), bad).toBeNull();
  });

  it("imleç: yalnız sıralamaya uyan tip kabul edilir, bozuk metin reddedilir", () => {
    expect(decodeCursor(encodeCursor(500, 7), "glix")).toEqual({ value: 500, id: 7 });
    expect(decodeCursor(encodeCursor("ali", 7), "name")).toEqual({ value: "ali", id: 7 });
    expect(decodeCursor(encodeCursor("ali", 7), "glix")).toBeNull();
    expect(decodeCursor(encodeCursor(5, 7), "name")).toBeNull();
    expect(decodeCursor(encodeCursor(5, 0), "glix")).toBeNull();
    expect(decodeCursor(encodeCursor(5.5, 1), "glix")).toBeNull();
    expect(decodeCursor("!!!", "glix")).toBeNull();
    expect(decodeCursor("e30", "glix")).toBeNull();
    expect(decodeCursor("A".repeat(300), "glix")).toBeNull();
  });

  it("yeni işlem gövdeleri: tam anahtar kümesi, sınırlar", () => {
    expect(parseAction("glix-set", { id: 2, balance: 0, reason: "sıfırla" })).toEqual({
      op: "glix-set",
      id: 2,
      balance: 0,
      reason: "sıfırla",
    });
    for (const bad of [
      { id: 2, balance: -1, reason: "x" },
      { id: 2, balance: 1.5, reason: "x" },
      { id: 2, balance: 10_000_001, reason: "x" },
      { id: 2, balance: 5, reason: "  " },
      { id: 2, balance: "5", reason: "x" },
      { id: 2, balance: 5 },
      { id: 2, balance: 5, reason: "x", fazla: 1 },
    ])
      expect(parseAction("glix-set", bad), JSON.stringify(bad)).toBeNull();
    expect(parseAction("cosmetic-unequip", { id: 2, slot: "unvan" })).toEqual({
      op: "cosmetic-unequip",
      id: 2,
      slot: "unvan",
    });
    for (const bad of [
      { id: 2, slot: "yok-boyle" },
      { id: 2, slot: "" },
      { id: 2 },
      { id: 2, slot: "unvan", x: 1 },
      { id: 2, slot: 5 },
    ])
      expect(parseAction("cosmetic-unequip", bad), JSON.stringify(bad)).toBeNull();
  });
});

describe("oyuncu listesi sorgu planı", () => {
  function plan(q: Partial<AdminPlayerListQuery>, withCursor: boolean): string {
    const { DatabaseSync: Db } = loadSqlite();
    const db: DatabaseSync = new Db(":memory:");
    for (const m of ACCOUNT_MIGRATIONS) db.exec(m);
    const query: AdminPlayerListQuery = {
      suspendedOnly: false,
      ids: null,
      prefix: null,
      sort: "glix",
      dir: "desc",
      cursor: withCursor ? { value: q.sort === "name" ? "m" : 100, id: 5 } : null,
      limit: 25,
      ...q,
    };
    const built = playerListSql(query, 1000);
    const rows = db.prepare(`EXPLAIN QUERY PLAN ${built.pageSql}`).all(...built.pageArgs) as unknown as {
      detail: string;
    }[];
    db.close();
    return rows.map((r) => r.detail).join(" | ");
  }

  it("Glix, kayıt tarihi ve ad sıralamaları indeksle okunur (tablo taraması ve geçici sıralama yok)", () => {
    for (const withCursor of [false, true]) {
      for (const sort of ["glix", "created", "name"] as const) {
        for (const dir of ["asc", "desc"] as const) {
          const p = plan({ sort, dir }, withCursor);
          expect(p, `${sort}/${dir}/${withCursor}`).toMatch(/USING (COVERING )?INDEX/);
          expect(p, `${sort}/${dir}/${withCursor}`).not.toMatch(/SCAN a(?! USING)/);
          expect(p, `${sort}/${dir}/${withCursor}`).not.toMatch(/TEMP B-TREE/);
        }
      }
    }
  });

  it("askıdakiler süzgeci kısmi indeksi kullanır; son görülme son hareket indeksiyle okunur", () => {
    expect(plan({ sort: "created", suspendedOnly: true }, false)).toMatch(
      /accounts_suspended|accounts_created/,
    );
    expect(plan({ sort: "seen" }, false)).toMatch(/sessions_seen/);
  });
});

describe("oyuncu listesi ucu", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch: kit.mailFetch, statsDb: ":memory:" });

  /** Yönetici (kimlik 1) + farklı Glix, kayıt zamanı ve adlı hesaplar. */
  function seed(): string[] {
    loginCookie("yonetici_1");
    const names = ["Cemre", "Ali", "Deniz", "Berk", "Ece", "Fatma", "Gizem"];
    names.forEach((n, i) => {
      k.clock.advance(1000 * (i + 1));
      loginCookie(n);
    });
    // Glix: Ali 700, Berk 100, Cemre 100 (eşit: kimlikle ayrılır), Deniz 50, Ece 0, Fatma 900, Gizem 300.
    const glix: Record<string, number> = {
      Ali: 700,
      Berk: 100,
      Cemre: 100,
      Deniz: 50,
      Fatma: 900,
      Gizem: 300,
    };
    for (const [n, g] of Object.entries(glix)) k.srv.accounts.adjustGlix(idOf(n), g, "t", k.clock.now());
    return names;
  }

  async function allPages(
    cookie: string,
    qs: string,
    limit: number,
  ): Promise<{ rows: AdminPlayerRow[]; pages: number; total: number }> {
    const rows: AdminPlayerRow[] = [];
    let after: string | null = null;
    let pages = 0;
    let total = -1;
    for (let guard = 0; guard < 30; guard++) {
      const r: Reply<AdminPlayerPage> = await kit.get<AdminPlayerPage>(
        `accounts/list?${qs}&limit=${limit}${after === null ? "" : `&after=${after}`}`,
        cookie,
      );
      expect(r.status).toBe(200);
      rows.push(...r.body.rows);
      pages += 1;
      total = r.body.total;
      after = r.body.next;
      if (after === null) break;
    }
    return { rows, pages, total };
  }

  it("erişim: oturumsuz 401, yönetici olmayan 404, kodsuz 403, POST 405", async () => {
    seed();
    expect((await kit.get("accounts/list", null)).status).toBe(401);
    expect((await kit.get("accounts/list", loginCookie("Ali"))).status).toBe(404);
    expect((await kit.get("accounts/list", loginCookie("yonetici_1"))).status).toBe(403);
    const admin = await kit.adminLogin();
    expect((await kit.post("accounts/list", admin, {})).status).toBe(405);
    expect((await kit.get("accounts/list", admin)).status).toBe(200);
  });

  it("geçersiz parametreler 400; e-posta listede aranamaz", async () => {
    seed();
    const admin = await kit.adminLogin();
    for (const bad of [
      "filter=x",
      "sort=email",
      "dir=up",
      "limit=0",
      "q=a@b.co",
      "after=%00",
      "after=bozuk",
      `after=${encodeURIComponent(encodeCursor("ali", 3))}`,
    ]) {
      const r = await kit.get(`accounts/list?${bad}`, admin);
      expect(r.status, bad).toBe(400);
      expect(r.body.code).toBe("invalid_input");
    }
  });

  it("tüm hesaplar sayfalanır: her sıralama ve yön tutarlı, tekrar/eksik yok", async () => {
    const names = seed();
    const admin = await kit.adminLogin();
    const everyone = ["yonetici_1", ...names];
    const sorts: [string, (a: AdminPlayerRow, b: AdminPlayerRow) => number][] = [
      ["name", (a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase())],
      ["glix", (a, b) => a.glix - b.glix || a.id - b.id],
      ["created", (a, b) => a.createdAt - b.createdAt || a.id - b.id],
    ];
    for (const [sort, cmp] of sorts) {
      for (const dir of ["asc", "desc"] as const) {
        const { rows, pages, total } = await allPages(admin, `sort=${sort}&dir=${dir}`, 3);
        expect(total, sort).toBe(everyone.length);
        expect(pages, sort).toBe(3);
        expect(new Set(rows.map((r) => r.id)).size, `${sort}/${dir}`).toBe(everyone.length);
        const expected = [...rows].sort(cmp);
        if (dir === "desc") expected.reverse();
        expect(
          rows.map((r) => r.id),
          `${sort}/${dir}`,
        ).toEqual(expected.map((r) => r.id));
      }
    }
  });

  it("son görülme: oturumsuz hesaplar sonda; imleç tekrar etmez", async () => {
    const names = seed();
    const admin = await kit.adminLogin();
    // loginCookie her hesaba bir oturum açar (zaman farklı); Ece'nin oturumunu sil.
    k.srv.accounts.deleteSessionsOf(idOf("Ece"));
    const { rows } = await allPages(admin, "sort=seen", 2);
    expect(rows).toHaveLength(names.length + 1);
    expect(rows.at(-1)?.username).toBe("Ece");
    expect(rows.at(-1)?.lastSeen).toBeNull();
    // Yeniden eskiye: son açılan hesap önde (yönetici kod almak için oturum açtı, en yenisi olabilir).
    const seen = rows.map((r) => r.lastSeen ?? 0);
    expect(seen).toEqual([...seen].sort((a, b) => b - a));
  });

  it("ad önekiyle daraltılır (büyük/küçük harf duyarsız); süzgeçle birleşir", async () => {
    seed();
    k.srv.accounts.suspend(idOf("Deniz"), k.clock.now(), null, "x");
    const admin = await kit.adminLogin();
    const a = await kit.get<AdminPlayerPage>("accounts/list?q=DE&sort=name", admin);
    expect(a.body.rows.map((r) => r.username)).toEqual(["Deniz"]);
    expect(a.body.total).toBe(1);
    const b = await kit.get<AdminPlayerPage>("accounts/list?q=ce&filter=suspended", admin);
    expect(b.body.rows).toEqual([]);
    expect(b.body.total).toBe(0);
  });

  it("süzgeçler: askıda (süresi dolan sayılmaz), yönetici; satır alanları", async () => {
    seed();
    const now = k.clock.now();
    k.srv.accounts.suspend(idOf("Ali"), now, null, "x");
    k.srv.accounts.suspend(idOf("Berk"), now, now + DAY, "x");
    k.srv.accounts.suspend(idOf("Cemre"), now, now + 1000, "x");
    const admin = await kit.adminLogin();
    k.clock.advance(5000);
    const sus = await kit.get<AdminPlayerPage>("accounts/list?filter=suspended&sort=name", admin);
    expect(sus.body.rows.map((r) => r.username)).toEqual(["Ali", "Berk"]);
    expect(sus.body.total).toBe(2);
    expect(sus.body.rows[0]).toMatchObject({
      suspended: true,
      suspendedUntil: null,
      admin: false,
      glix: 700,
    });
    expect(sus.body.rows[1]?.suspendedUntil).toBe(now + DAY);
    const adm = await kit.get<AdminPlayerPage>("accounts/list?filter=admin", admin);
    expect(adm.body.rows.map((r) => [r.username, r.admin])).toEqual([["yonetici_1", true]]);
    // E-posta hiçbir satırda yok.
    expect(JSON.stringify(adm.body)).not.toContain("@test.local");
    expect(JSON.stringify(sus.body)).not.toContain("@test.local");
  });

  it("çevrimiçi: yalnız canlı soketi olanlar; oda kodu ve rol satırda; kopunca düşer", async () => {
    seed();
    const admin = await kit.adminLogin();
    const host = await create("Ali");
    const guestRoom = await Client.connect(loginCookie("Berk"));
    guestRoom.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Berk" });
    await until(() => guestRoom.updates.length > 0, "Berk katıldı");
    const idle = await Client.connect(loginCookie("Cemre"));
    await sync();

    const on = await kit.get<AdminPlayerPage>("accounts/list?filter=online&sort=name", admin);
    expect(on.body.rows.map((r) => r.username)).toEqual(["Ali", "Berk", "Cemre"]);
    expect(on.body.total).toBe(3);
    const byName = Object.fromEntries(on.body.rows.map((r) => [r.username, r.live]));
    expect(byName.Ali).toMatchObject({ online: true, room: { code: host.session.roomCode, role: "host" } });
    expect(byName.Berk).toMatchObject({
      online: true,
      room: { code: host.session.roomCode, role: "player" },
    });
    expect(byName.Cemre).toEqual({ online: true, room: null });
    // Tüm liste: bağlı olmayanlar çevrimdışı.
    const all = await kit.get<AdminPlayerPage>("accounts/list?sort=name&limit=50", admin);
    expect(all.body.rows.find((r) => r.username === "Deniz")?.live).toEqual({ online: false, room: null });

    idle.ws.close();
    await until(() => idle.closeCode !== null, "kapandı");
    const after = await kit.get<AdminPlayerPage>("accounts/list?filter=online&sort=name", admin);
    expect(after.body.rows.map((r) => r.username)).toEqual(["Ali", "Berk"]);
  });

  it("liste hız sınırlı (arama kovası)", async () => {
    seed();
    const admin = await kit.adminLogin();
    let limited = 0;
    for (let i = 0; i < 40; i++) {
      if ((await kit.get("accounts/list", admin)).status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("hesap dökümünde canlı durum, oda atma, Glix ayarı, kuşanmayı kaldırma", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch: kit.mailFetch, statsDb: ":memory:" });
  const detail = (cookie: string, id: number) =>
    kit.get<AdminAccountDetail>(`accounts/detail?id=${id}`, cookie);

  it("döküm: çevrimdışı, odasız çevrimiçi ve odada rol; Odadan çıkar rooms/kick ile çalışır", async () => {
    loginCookie("yonetici_1");
    const admin = await kit.adminLogin();
    loginCookie("Cevrimdisi_1");
    expect((await detail(admin, idOf("Cevrimdisi_1"))).body.live).toEqual({ online: false, room: null });

    const host = await create("Ev_Sahibi");
    const guest = await Client.connect(loginCookie("Misafir_1"));
    guest.send({ type: "joinRoom", code: host.session.roomCode, nickname: "Misafir_1" });
    await until(() => guest.updates.length > 0, "katıldı");
    const code = host.session.roomCode;
    const hd = await detail(admin, idOf("Ev_Sahibi"));
    expect(hd.body.live).toMatchObject({ online: true, room: { code, role: "host" } });
    const gd = await detail(admin, idOf("Misafir_1"));
    expect(gd.body.live.room).toMatchObject({ code, role: "player" });
    const playerId = gd.body.live.room?.playerId ?? "";

    const kick = await kit.post("rooms/kick", admin, { code, playerId });
    expect(kick.status).toBe(200);
    const row = k.srv.accounts.adminAuditTail(5).find((a) => a.action === "room_kick");
    expect(row).toMatchObject({ accountId: 1, targetId: idOf("Misafir_1"), detail: code });
    expect((await detail(admin, idOf("Misafir_1"))).body.live.room).toBeNull();
  });

  it("yönetici hesabının oyuncusu atılamaz (403)", async () => {
    const admin = await kit.adminLogin();
    const host = await Client.connect(loginCookie("yonetici_1"));
    host.send({ type: "createRoom", nickname: "yonetici_1" });
    await until(() => host.updates.length > 0, "oda");
    const code = host.session.roomCode;
    const playerId = (await detail(admin, 1)).body.live.room?.playerId ?? "";
    expect((await kit.post("rooms/kick", admin, { code, playerId })).status).toBe(403);
    expect(host.ws.readyState).toBe(host.ws.OPEN);
  });

  it("askı canlı soketi kapatır ve sayısını döner", async () => {
    loginCookie("yonetici_1");
    const admin = await kit.adminLogin();
    const c = await Client.connect(loginCookie("Askiya_Gidecek"));
    await sync();
    const r = await kit.post("accounts/suspend", admin, {
      id: idOf("Askiya_Gidecek"),
      duration: "1d",
      reason: "deneme",
    });
    expect(r.status).toBe(200);
    expect(r.body.disconnected).toBe(1);
    await until(() => c.closeCode === 4003, "kapandı");
    expect((await detail(admin, idOf("Askiya_Gidecek"))).body.live.online).toBe(false);
  });

  it("Glix ayarı: fark deftere yazılır, bakiye = defter toplamı; aynı değer 409; sınırlar", async () => {
    loginCookie("yonetici_1");
    const admin = await kit.adminLogin();
    loginCookie("Glix_Hedef");
    const id = idOf("Glix_Hedef");
    k.srv.accounts.adjustGlix(id, 120, "t", k.clock.now());
    const ledgerSum = () => k.srv.accounts.glixLedger(id, 100).reduce((a, r) => a + r.amount, 0);

    const down = await kit.post("accounts/glix-set", admin, { id, balance: 30, reason: "hata düzeltme" });
    expect(down.status).toBe(200);
    expect(down.body).toMatchObject({ balance: 30, amount: -90 });
    expect(k.srv.accounts.glixBalance(id)).toBe(30);
    expect(ledgerSum()).toBe(30);
    expect(k.srv.accounts.glixLedger(id, 1)[0]).toMatchObject({
      amount: -90,
      reason: "yonetici",
      ref: "hata düzeltme",
    });
    expect(k.srv.accounts.adminAuditTail(3).find((a) => a.action === "account_glix_set")).toMatchObject({
      accountId: 1,
      targetId: id,
      detail: "120->30: hata düzeltme",
    });

    expect((await kit.post("accounts/glix-set", admin, { id, balance: 30, reason: "x" })).status).toBe(409);
    expect((await kit.post("accounts/glix-set", admin, { id, balance: 0, reason: "sıfırla" })).status).toBe(
      200,
    );
    expect(ledgerSum()).toBe(0);
    const big = await kit.post("accounts/glix-set", admin, { id, balance: GLIX_ADJUST_MAX + 1, reason: "x" });
    expect(big.status).toBe(400);
    expect(big.body.code).toBe("glix_too_big");
    expect((await kit.post("accounts/glix-set", admin, { id, balance: -5, reason: "x" })).status).toBe(400);
    expect((await kit.post("accounts/glix-set", admin, { id, balance: 5 })).status).toBe(400);
    expect((await kit.post("accounts/glix-set", admin, { id: 999, balance: 5, reason: "x" })).status).toBe(
      404,
    );
    expect((await kit.post("accounts/glix-set", admin, { id: 1, balance: 5, reason: "x" })).status).toBe(403);
    expect(ledgerSum()).toBe(0);
  });

  it("kuşanmayı kaldır: sahiplik kalır, odadaki görünüm düşer, kayıt yazılır; kuşanılı değilse 409", async () => {
    loginCookie("yonetici_1");
    const admin = await kit.adminLogin();
    const c = await create("Kozmetik_Hedef");
    const id = idOf("Kozmetik_Hedef");
    k.srv.accounts.grantCosmetic(id, "unvan-sansli", k.clock.now());
    k.srv.accounts.equipCosmetic(id, "unvan", "unvan-sansli");
    expect((await kit.post("accounts/cosmetic-unequip", admin, { id, slot: "dans" })).status).toBe(409);
    const r = await kit.post("accounts/cosmetic-unequip", admin, { id, slot: "unvan" });
    expect(r.status).toBe(200);
    expect(k.srv.accounts.cosmetics(id)).toMatchObject({ equipped: {} });
    expect(k.srv.accounts.cosmetics(id).owned.map((o) => o.itemId)).toEqual(["unvan-sansli"]);
    expect(
      k.srv.accounts.adminAuditTail(3).find((a) => a.action === "account_cosmetic_unequip"),
    ).toMatchObject({
      targetId: id,
      detail: "unvan:unvan-sansli",
    });
    await until(() => c.room.players.every((p) => p.cosmetics === undefined), "görünüm güncellendi");
    expect((await kit.post("accounts/cosmetic-unequip", admin, { id, slot: "unvan" })).status).toBe(409);
    expect((await kit.post("accounts/cosmetic-unequip", admin, { id, slot: "yok" })).status).toBe(400);
    expect((await kit.post("accounts/cosmetic-unequip", admin, { id: 999, slot: "unvan" })).status).toBe(404);
    expect((await kit.post("accounts/cosmetic-unequip", admin, { id: 1, slot: "unvan" })).status).toBe(403);
  });

  it("yeni işlemler Origin ister ve hız sınırı paylaşır", async () => {
    loginCookie("yonetici_1");
    const admin = await kit.adminLogin();
    loginCookie("Sinir_Hedef");
    const id = idOf("Sinir_Hedef");
    const bad = await kit.call("POST", "accounts/glix-set", admin, {
      body: { id, balance: 5, reason: "x" },
      origin: "https://kotu.example",
    });
    expect(bad.status).toBe(403);
    let limited = 0;
    for (let i = 0; i < 14; i++) {
      const r = await kit.post("accounts/glix-set", admin, { id, balance: i + 1, reason: "x" });
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("me yanıtında yönetici işareti", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch: kit.mailFetch, statsDb: ":memory:" });
  it("yalnız yönetici listesindeki hesapta true; misafirde ve sıradan hesapta false", async () => {
    const me = async (cookie?: string) =>
      (await (
        await fetch(`${base()}/api/auth/me`, { headers: cookie ? { Cookie: cookie } : {} })
      ).json()) as {
        admin: boolean;
      };
    const adminCookie = loginCookie("yonetici_1");
    expect((await me(adminCookie)).admin).toBe(true);
    expect((await me(loginCookie("Sade_1"))).admin).toBe(false);
    expect((await me()).admin).toBe(false);
  });
});
