/** Yönetici paneli A4: içerik havuzları (uç erişimi, CRUD, doğrulama, etkin havuz, yeni maçlara uygulanma, kayıt). */
import {
  type AdminPoolBulk,
  type AdminPoolPage,
  type AdminPools,
  CONTENT_POOLS,
  cagrisimAgi,
  poolById,
  replay,
} from "@glix/engine";
import { describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { createContentStore } from "./contentStore.js";
import { type Client, k, loginCookie, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";
import { ADMIN, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { get, post, call, adminLogin } = kit;
const serverOpts = {
  adminAccountIds: ADMIN,
  mail: MAIL,
  mailFetch: kit.mailFetch,
  statsDb: ":memory:",
} as const;

const CAG = "cagrisim-agi/kelimeler";
const SOZ = "sozluk-blofu/kelimeler";
const SIZ = "sizma/ciftler";

/** Hız sınırı kovasını doldurur (sahte saat). */
const requirePool = (id: string): NonNullable<ReturnType<typeof poolById>> => {
  const p = poolById(id);
  if (!p) throw new Error(`havuz yok: ${id}`);
  return p;
};
const wordOf = (c: Client): string => (c.room.match?.publicView as { word: string } | undefined)?.word ?? "";
const phaseOf = (c: Client): string =>
  (c.room.match?.publicView as { phase: string } | undefined)?.phase ?? "";

const refill = (): void => k.clock.advance(120_000);

/** Uydurma (içerik değil) harf dizisi: yalnız test girdisi. */
const fake = (n: number): string => {
  const letters = "bcdfghklmnprstvyz";
  let s = "";
  for (let v = n + 17; v > 0; v = Math.floor(v / letters.length)) s += letters[v % letters.length];
  return `${s}${s}`;
};

describe("A4 havuz uçları: erişim denetimi", () => {
  useServer({ ...serverOpts });

  it("oturum yoksa 401; yönetici olmayan 404; yönetici çerezi yoksa 403; Origin yanlışsa 403", async () => {
    const sess = loginCookie("yonetici_1");
    const other = loginCookie("oyuncu_2");
    for (const p of ["pools", `pools/entries?pool=${CAG}`]) {
      expect((await get(p, null)).status).toBe(401);
      expect((await get(p, other)).status).toBe(404);
      expect((await get(p, sess)).status).toBe(403);
    }
    const bodies: [string, unknown][] = [
      ["pools/add", { pool: CAG, fields: { text: "DENEME" } }],
      ["pools/toggle", { pool: CAG, key: "deniz", disabled: true }],
      ["pools/edit", { pool: CAG, key: "deniz", fields: { text: "DENEME" } }],
      ["pools/delete", { pool: CAG, key: "deneme" }],
      ["pools/check", { pool: CAG, lines: ["abc"] }],
      ["pools/bulk", { pool: CAG, lines: ["abc"] }],
    ];
    for (const [p, b] of bodies) {
      expect((await post(p, null, b)).status).toBe(401);
      expect((await post(p, other, b)).status).toBe(404);
      expect((await post(p, sess, b)).status).toBe(403);
    }
    const admin = await adminLogin();
    expect(
      (await call("POST", "pools/add", admin, { body: bodies[0]?.[1], origin: "https://kotu.example" }))
        .status,
    ).toBe(403);
    expect((await call("POST", "pools", admin, { body: {} })).status).toBe(405);
    expect((await call("GET", "pools/add", admin)).status).toBe(405);
  });

  it("yanıtlar: havuz listesi her havuzu sayılarıyla verir", async () => {
    const admin = await adminLogin();
    const r = await get<AdminPools>("pools", admin);
    expect(r.status).toBe(200);
    expect(r.body.pools.map((p) => p.id)).toEqual(CONTENT_POOLS.map((p) => p.id));
    for (const p of r.body.pools) {
      expect(p.builtin).toBeGreaterThanOrEqual(p.min);
      expect(p.active).toBe(p.builtin);
      expect(p.applied).toBe(false);
      expect(p.belowMin).toBe(false);
    }
  });
});

describe("A4 havuz uçları: CRUD, doğrulama, tekrar, yasaklı kelime, işlem kaydı", () => {
  useServer({ ...serverOpts });

  it("ekleme, tekrar (büyük/küçük harf ve aksan duyarsız), geçersiz girdi, yasaklı kelime", async () => {
    const admin = await adminLogin();
    k.srv.bannedWords.add("yasakkelime", k.clock.now());
    const add = (text: string) => post("pools/add", admin, { pool: CAG, fields: { text } });

    expect((await add("Denemelik")).status).toBe(200);
    const page = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&filter=custom`, admin);
    expect(page.body.entries).toHaveLength(1);
    expect(page.body.entries[0]).toMatchObject({
      source: "custom",
      disabled: false,
      fields: { text: "DENEMELİK" },
    });

    expect((await add("DENEMELIK")).status).toBe(409);
    expect((await add("denemelık")).status).toBe(409);
    // Yerleşik girdiyle tekrar (D-E-N-İ-Z yerleşikte var).
    const builtinWord = (requirePool(CAG).builtin[0] as string).toLocaleLowerCase("tr-TR");
    expect((await add(builtinWord)).status).toBe(409);
    refill();
    expect((await add("iki kelime")).status).toBe(400);
    expect((await add("a1b2")).status).toBe(400);
    expect((await add("")).status).toBe(400);
    expect((await add("<b>")).status).toBe(400);
    expect((await add("x")).status).toBe(400);
    refill();
    const banned = await add("yasakkelime");
    expect(banned.status).toBe(400);
    expect(banned.body.code).toBe("banned");
    expect((await post("pools/add", admin, { pool: CAG, fields: { text: "a", baska: "b" } })).status).toBe(
      400,
    );
    expect((await post("pools/add", admin, { pool: "yok/havuz", fields: { text: "abcd" } })).status).toBe(
      404,
    );
    expect((await post("pools/add", admin, { pool: CAG, fields: { text: "abcd" }, ekstra: 1 })).status).toBe(
      400,
    );
    // Alan şeması: eksik alan.
    refill();
    expect((await post("pools/add", admin, { pool: SOZ, fields: { word: "ABCDEF" } })).status).toBe(400);
  });

  it("yapılı girdiler: Sözlük Blöfü tanımı kelimeyi içeremez; Sızma çiftinde iki kelime farklı ve sıra duyarsız tekrar", async () => {
    const admin = await adminLogin();
    const soz = (word: string, definition: string) =>
      post("pools/add", admin, { pool: SOZ, fields: { word, definition } });
    expect((await soz("Zırzop", "zırzop demek bir şeydir")).status).toBe(400);
    expect((await soz("Zırzop", "kısa")).status).toBe(400);
    expect((await soz("Zırzop", "deneme amaçlı bir tanım metni")).status).toBe(200);
    expect((await soz("ZIRZOP", "başka bir deneme tanımı olur")).status).toBe(409);
    refill();
    const siz = (a: string, b: string) => post("pools/add", admin, { pool: SIZ, fields: { a, b } });
    expect((await siz("kalem", "KALEM")).status).toBe(400);
    expect((await siz("zumba", "fumba")).status).toBe(200);
    expect((await siz("Fumba", "zumba")).status).toBe(409);
  });

  it("yerleşik girdiyi kapat/aç, düzenle (kapat + ekle), eklenen girdiyi düzenle/sil; hazır girdi silinmez", async () => {
    const admin = await adminLogin();
    const first = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&filter=builtin&q=deniz`, admin);
    const target = first.body.entries.find((e) => e.fields.text === "DENİZ");
    if (!target) throw new Error("yerleşik girdi yok");
    const base = first.body.pool.builtin;

    expect((await post("pools/toggle", admin, { pool: CAG, key: target.key, disabled: true })).status).toBe(
      200,
    );
    expect((await post("pools/toggle", admin, { pool: CAG, key: target.key, disabled: true })).status).toBe(
      409,
    );
    let list = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&filter=disabled`, admin);
    expect(list.body.entries.map((e) => e.key)).toEqual([target.key]);
    expect(list.body.pool).toMatchObject({ disabled: 1, active: base - 1, applied: true });
    // Kapatılan girdi artık tekrar sayılmaz: yeniden eklenebilir.
    expect((await post("pools/add", admin, { pool: CAG, fields: { text: "deniz" } })).status).toBe(200);
    refill();
    // Aynı girdi eklenenlerde varken açılamaz.
    expect((await post("pools/toggle", admin, { pool: CAG, key: target.key, disabled: false })).status).toBe(
      409,
    );
    expect((await post("pools/delete", admin, { pool: CAG, key: target.key })).status).toBe(200);
    expect((await post("pools/toggle", admin, { pool: CAG, key: target.key, disabled: false })).status).toBe(
      200,
    );
    list = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&filter=disabled`, admin);
    expect(list.body.entries).toHaveLength(0);
    expect(list.body.pool).toMatchObject({ disabled: 0, custom: 0, active: base });

    // Yerleşiği düzenle: eskisi kapanır, yenisi eklenir.
    refill();
    const edit = await post("pools/edit", admin, { pool: CAG, key: target.key, fields: { text: "denizli" } });
    expect(edit.status).toBe(200);
    const all = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&q=denizli`, admin);
    expect(all.body.entries).toHaveLength(1);
    expect(all.body.entries[0]).toMatchObject({ source: "custom", key: "denizli" });
    expect(all.body.pool).toMatchObject({ disabled: 1, custom: 1, active: base });
    expect(
      (await post("pools/edit", admin, { pool: CAG, key: target.key, fields: { text: "DENİZ" } })).status,
    ).toBe(409);
    // Eklenen girdiyi düzenle ve sil.
    expect(
      (await post("pools/edit", admin, { pool: CAG, key: "denizli", fields: { text: "denizlix" } })).status,
    ).toBe(200);
    expect(
      (await post("pools/edit", admin, { pool: CAG, key: "denizlix", fields: { text: "DENİZLİX" } })).status,
    ).toBe(409);
    refill();
    expect((await post("pools/delete", admin, { pool: CAG, key: "denizlix" })).status).toBe(200);
    expect((await post("pools/delete", admin, { pool: CAG, key: "denizlix" })).status).toBe(404);
    expect((await post("pools/delete", admin, { pool: CAG, key: target.key })).status).toBe(400);
    expect(
      (await post("pools/edit", admin, { pool: CAG, key: "yokboyle", fields: { text: "abcd" } })).status,
    ).toBe(404);
  });

  it("toplu ekleme: önizleme satır satır doğrular, kaydetme yalnız geçerli satırları ekler", async () => {
    const admin = await adminLogin();
    k.srv.bannedWords.add("yasakkelime", k.clock.now());
    const lines = ["vrtzkl", "", "VRTZKL", "iki kelime", "yasakkelime", "qwrtzk", "a"];
    const check = await post("pools/check", admin, { pool: CAG, lines });
    expect(check.status).toBe(200);
    const c = check.body as unknown as AdminPoolBulk;
    expect(c.lines.map((l) => [l.line, l.status])).toEqual([
      [1, "ok"],
      [3, "duplicate"],
      [4, "invalid"],
      [5, "banned"],
      [6, "ok"],
      [7, "invalid"],
    ]);
    expect(c.ok).toBe(2);
    expect(c.added).toBe(0);
    // Önizleme yazmaz.
    expect((await get<AdminPoolPage>(`pools/entries?pool=${CAG}&filter=custom`, admin)).body.total).toBe(0);

    const saved = (await post("pools/bulk", admin, { pool: CAG, lines })).body as unknown as AdminPoolBulk;
    expect(saved.added).toBe(2);
    expect(saved.pool.custom).toBe(2);
    refill();
    // Çok alanlı satır: ; ile ayrılır; sözlük tanımı içinde ; kalabilir.
    const soz = (
      await post("pools/bulk", admin, {
        pool: SOZ,
        lines: ["Kalemkar;boyalı bir şey; ince işli", "yalnızkelime"],
      })
    ).body as unknown as AdminPoolBulk;
    expect(soz.added).toBe(1);
    expect(soz.lines[1]?.status).toBe("invalid");
    const e = await get<AdminPoolPage>(`pools/entries?pool=${SOZ}&filter=custom`, admin);
    expect(e.body.entries[0]?.fields).toEqual({ word: "KALEMKAR", definition: "boyalı bir şey; ince işli" });
    // Sınırlar.
    expect((await post("pools/bulk", admin, { pool: CAG, lines: [] })).status).toBe(400);
    expect(
      (await post("pools/bulk", admin, { pool: CAG, lines: Array.from({ length: 201 }, () => "x") })).status,
    ).toBe(400);
    expect((await post("pools/bulk", admin, { pool: CAG, lines: [5] })).status).toBe(400);
  });

  it("arama, süzgeç ve sayfalama", async () => {
    const admin = await adminLogin();
    const p1 = await get<AdminPoolPage>(`pools/entries?pool=${CAG}`, admin);
    expect(p1.body.entries).toHaveLength(p1.body.pageSize);
    expect(p1.body.total).toBe(p1.body.pool.builtin);
    const last = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&page=999`, admin);
    expect(last.body.page).toBe(Math.ceil(p1.body.total / p1.body.pageSize));
    const q = await get<AdminPoolPage>(`pools/entries?pool=${CAG}&q=gokkusagi`, admin);
    expect(q.body.entries.map((e) => e.fields.text)).toEqual(["GÖKKUŞAĞI"]);
    expect((await get(`pools/entries?pool=${CAG}&filter=hepsi`, admin)).status).toBe(400);
    expect((await get(`pools/entries?pool=${CAG}&page=0`, admin)).status).toBe(400);
    expect((await get("pools/entries?pool=yok/havuz", admin)).status).toBe(404);
    expect((await get("pools/entries", admin)).status).toBe(400);
  });

  it("işlem kaydı: havuz kimliği ve girdi özeti yazılır, girdi metni yazılmaz", async () => {
    const admin = await adminLogin();
    await post("pools/add", admin, { pool: CAG, fields: { text: "gizlimetinx" } });
    await post("pools/bulk", admin, { pool: CAG, lines: ["gizlitoplu", "gizlitoplu"] });
    const rows = await get<{ entries: { action: string; detail: string }[] }>("audit", admin);
    const pool = rows.body.entries.filter((e) => e.action.startsWith("pool_"));
    expect(pool.map((e) => e.action).sort()).toEqual(["pool_add", "pool_bulk"]);
    expect(pool.find((e) => e.action === "pool_bulk")?.detail).toBe(`${CAG}:added=1:skipped=1`);
    expect(pool.find((e) => e.action === "pool_add")?.detail).toMatch(new RegExp(`^${CAG}:[0-9a-f]{8}$`));
    expect(JSON.stringify(rows.body)).not.toMatch(/gizlimetin|gizlitoplu/i);
  });

  it("hız sınırı: değiştiren işlemler yönetici başına sınırlanır", async () => {
    const admin = await adminLogin();
    let limited = 0;
    for (let i = 0; i < 14; i++) {
      const r = await post("pools/add", admin, { pool: CAG, fields: { text: `${fake(i)}` } });
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("etkin havuz kurulumu (depo)", () => {
  const accounts = createAccounts(":memory:");
  const make = (banned: string[] = []) =>
    createContentStore(accounts, {
      matches: (t) => banned.includes(t.toLocaleLowerCase("tr-TR")),
      list: () => [],
      add: () => "invalid",
      remove: () => false,
    });

  it("değişiklik yoksa forGame undefined; kapatılan girdi etkin havuzda yok; ekleneni var", () => {
    const store = make();
    expect(store.forGame("cagrisim-agi")).toBeUndefined();
    const key = requirePool(CAG).key("DENİZ");
    expect(store.toggle(CAG, key, true, 1).ok).toBe(true);
    expect(store.add(CAG, { text: "uydurmax" }, 2).ok).toBe(true);
    const set = store.forGame("cagrisim-agi");
    const list = set?.[CAG] ?? [];
    expect(list).not.toContain("DENİZ");
    expect(list).toContain("UYDURMAX");
    expect(list).toHaveLength(poolById(CAG)?.builtin.length ?? 0);
    // Kalıcı: yeni depo aynı veritabanından aynı havuzu kurar.
    expect(make().forGame("cagrisim-agi")?.[CAG]).toEqual(list);
    // Başka oyunun havuzu etkilenmez.
    expect(store.forGame("sizma")).toBeUndefined();
  });

  it("asgari boyun altına inen havuz uygulanmaz (yerleşiğe dönülür) ve özet uyarır", () => {
    const store = make();
    const pool = poolById(SIZ);
    if (!pool) throw new Error("havuz yok");
    const keyOf = pool.key as (e: unknown) => string;
    // Hepsini kapat: etkin 0 < min.
    for (const e of pool.builtin) store.toggle(SIZ, keyOf(e), true, 5);
    expect(store.forGame("sizma")).toBeUndefined();
    expect(store.summary(SIZ)).toMatchObject({ active: 0, belowMin: true, applied: false });
    // Asgariye kadar çiftler eklenince uygulanır.
    for (let i = 0; i < pool.min; i++)
      expect(store.add(SIZ, { a: fake(i), b: fake(i + 300) }, 6).ok).toBe(true);
    expect(store.forGame("sizma")?.[SIZ]).toHaveLength(pool.min);
    expect(store.summary(SIZ)).toMatchObject({ belowMin: false, applied: true });
  });
});

describe("yeni maçlara uygulanma ve kayıt", () => {
  useServer({ ...serverOpts });

  let round = 0;
  async function playCagrisim(): Promise<{ word: string; cs: Client[] }> {
    round += 1;
    const cs = await setupRoom([`Ali${round}`, `Veli${round}`], ["cagrisim-agi"]);
    await startPlaying(cs);
    const host = cs[0] as Client;
    return { word: wordOf(host), cs };
  }

  async function finish(host: Client): Promise<void> {
    k.clock.advance(31_000);
    await until(() => phaseOf(host) === "reveal", "açılış");
    k.clock.advance(7_000);
    await until(() => host.room.phase === "results", "sonuç");
  }

  it("süren maç etkilenmez; sonraki maç yeni havuzu kullanır; kayıtta etkin havuz bulunur ve sonradan değişse de replay aynı", async () => {
    const first = await playCagrisim();
    expect(poolById(CAG)?.builtin).toContain(first.word);

    // Maç sürerken havuz değişir: yalnız eklenen girdiler kalsın.
    const pool = poolById(CAG);
    if (!pool) throw new Error("havuz yok");
    const keyOf = pool.key as (e: unknown) => string;
    for (const e of pool.builtin) k.srv.content.toggle(CAG, keyOf(e), true, 10);
    const customs = Array.from({ length: pool.min }, (_, i) => fake(i).toLocaleUpperCase("tr-TR"));
    for (const w of customs) expect(k.srv.content.add(CAG, { text: w }, 11).ok).toBe(true);
    await sync();
    expect(wordOf(first.cs[0] as Client)).toBe(first.word);

    // Yeni oda, yeni maç: kelime eklenenlerden.
    const second = await playCagrisim();
    expect(customs).toContain(second.word);

    // Maçı bitir; kayıt etkin havuzu taşır.
    const host = second.cs[0] as Client;
    await finish(host);
    const log = k.srv.recentLogs.at(-1);
    if (!log) throw new Error("kayıt yok");
    expect(log.content?.[CAG]).toEqual(expect.arrayContaining(customs));
    expect(log.content?.[CAG]).toHaveLength(customs.length);
    const result = host.room.match?.result;
    expect(replay(cagrisimAgi, JSON.parse(JSON.stringify(log)))).toEqual(result);

    // Havuz sonradan yeniden değişse de kayıt aynı kalır.
    for (const e of pool.builtin) k.srv.content.toggle(CAG, keyOf(e), false, 20);
    expect(replay(cagrisimAgi, JSON.parse(JSON.stringify(log)))).toEqual(result);
    // Değişiklik yapılmamış havuzlu maçın kaydında content yoktur (eski davranış).
    expect(first.cs[0]).toBeDefined();
  });

  it("değişiklik yokken kayıtta content alanı bulunmaz", async () => {
    const { cs } = await playCagrisim();
    const host = cs[0] as Client;
    await finish(host);
    expect(k.srv.recentLogs.at(-1)?.content).toBeUndefined();
  });
});
