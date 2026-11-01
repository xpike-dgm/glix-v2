/**
 * Oyun alanı (test2) taslak katmanı (`oyunAlani.ts`, sözleşme bölüm 13): uçlar yalnız test2'de; canlıda ve test'te
 * 404 ve sağlık yanıtı değişmez. Taslak ürün oyunun doğrulayıcılarıyla denetlenir, satın alınıp kuşanılabilir,
 * görselleri veri klasöründen servis edilir; katman kimliği gece sıfırlamasıyla değişir.
 */
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COSMETIC_ITEMS, cosmeticItem, itemsOfType, parseStickerId } from "@glix/engine";
import { afterEach, describe, expect, it } from "vitest";
import { veritabaniniSil } from "./ortamYenile.js";
import { gorselTuru, OyunAlaniKatmani, oyunAlaniKlasoru, taslakYolu } from "./oyunAlani.js";
import { type RunningServer, startServer } from "./server.js";
import { k, useServer } from "./testkit.js";

const TOKEN = "oyun-alani-test-anahtari-0123456789";
const AUTH = { Authorization: `Bearer ${TOKEN}` };

/** En küçük geçerli imzalar (sunucu yalnız imzayı denetler; çizim istemcinin işidir). */
const WEBP = Buffer.concat([Buffer.from("RIFF\x10\x00\x00\x00WEBPVP8L", "latin1"), Buffer.alloc(16, 1)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 2),
]);
const b64 = (b: Buffer): string => b.toString("base64");

const CERCEVE = {
  id: "cerceve-oyun-alani",
  type: "cerceve",
  rarity: "nadir",
  price: 450,
  name: "Oyun Alanı Halkası",
  description: "Taslak bir halka.",
  satista: true,
  efekt: {
    motor: "doku-katmani",
    parametreler: { doku: "cerceve/oyun-alani-halka.webp", karisim: "normal", hareket: "yok" },
  },
};
const CERCEVE_DOSYA = [
  { yol: "apps/client/public/assets/shop/cerceve/oyun-alani-halka.webp", veri: b64(WEBP) },
];

async function call(
  port: number,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = AUTH,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

describe("taslak uçları canlıda ve test'te yok", () => {
  for (const ortam of ["canli", "test"] as const) {
    describe(ortam, () => {
      useServer({ uretimToken: TOKEN, ortam });
      it("GET/POST/DELETE taslak 404, genel katman ucu yok, sağlık yanıtı değişmez", async () => {
        const p = k.srv.port;
        expect((await call(p, "GET", "/api/uretim/magaza/taslak")).status).toBe(404);
        expect(
          (await call(p, "POST", "/api/uretim/magaza/taslak", { urun: CERCEVE, dosyalar: CERCEVE_DOSYA }))
            .status,
        ).toBe(404);
        expect((await call(p, "DELETE", `/api/uretim/magaza/taslak/${CERCEVE.id}`)).status).toBe(404);
        expect((await call(p, "GET", "/api/uretim/saglik")).data).toEqual({ ok: true, revision: "t" });
        const genel = await call(p, "GET", "/api/oyun-alani/magaza", undefined, {});
        expect(genel.data.ok).not.toBe(true);
        expect(cosmeticItem(CERCEVE.id)).toBeUndefined();
        // Canlı mağaza davranışı: katalog olduğu gibi (taslak yok).
        expect(itemsOfType("cerceve").map((i) => i.id)).toEqual(
          COSMETIC_ITEMS.filter((i) => i.type === "cerceve").map((i) => i.id),
        );
      });
    });
  }
});

describe("oyun alanı (test2) taslak katmanı", () => {
  useServer({ uretimToken: TOKEN, ortam: "test2", oyunAlaniDir: null });

  it("sağlık yanıtı katman kimliğini taşır; geçerli taslak yüklenir, satın alınır, kuşanılır, silinir", async () => {
    const p = k.srv.port;
    const s = await call(p, "GET", "/api/uretim/saglik");
    expect(s.data).toMatchObject({ ok: true, revision: "t", ortam: "test2", taslak: 0 });
    expect(String(s.data.katman)).toMatch(/^[0-9a-f]{24}$/);

    const r = await call(p, "POST", "/api/uretim/magaza/taslak", { urun: CERCEVE, dosyalar: CERCEVE_DOSYA });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ ok: true, id: CERCEVE.id, katman: s.data.katman });
    const liste = await call(p, "GET", "/api/uretim/magaza/taslak");
    expect(liste.data.urunler).toEqual([
      expect.objectContaining({ id: CERCEVE.id, dosyalar: ["cerceve/oyun-alani-halka.webp"] }),
    ]);

    // İstemcinin katmanı: satır + oyundaki yol -> taslak görsel adresi (giriş gerekmez; Caddy test2'yi korur).
    const genel = await call(p, "GET", "/api/oyun-alani/magaza", undefined, {});
    expect((genel.data.urunler as { id: string }[]).map((u) => u.id)).toEqual([CERCEVE.id]);
    const adres = (genel.data.dosyalar as Record<string, string>)[
      "/assets/shop/cerceve/oyun-alani-halka.webp"
    ];
    expect(adres).toMatch(/^\/api\/oyun-alani\/dosya\/[0-9a-f]{64}\.webp$/);
    const img = await fetch(`http://127.0.0.1:${p}${adres}`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/webp");
    expect(Buffer.from(await img.arrayBuffer()).equals(WEBP)).toBe(true);
    expect((await fetch(`http://127.0.0.1:${p}/api/oyun-alani/dosya/${"0".repeat(64)}.webp`)).status).toBe(
      404,
    );

    // Sunucu taslağı katalog gibi doğrular: satın alma ve kuşanma çalışır.
    expect(cosmeticItem(CERCEVE.id)?.name).toBe(CERCEVE.name);
    const now = k.clock.now();
    const made = k.srv.accounts.create("Zengin", "zengin@oyun-alani.invalid", "x", now);
    if (!made.ok) throw new Error("hesap");
    k.srv.accounts.adjustGlix(made.account.id, 5000, "test", now);
    expect(k.srv.accounts.purchaseCosmetic(made.account.id, CERCEVE.id, now).ok).toBe(true);
    expect(k.srv.accounts.equipCosmetic(made.account.id, "cerceve", CERCEVE.id)).toBe("ok");

    // Aynı kimlik yeniden yüklenince değiştirilir (ikinci bir taslak olmaz).
    const yeni = await call(p, "POST", "/api/uretim/magaza/taslak", {
      urun: { ...CERCEVE, price: 500 },
      dosyalar: CERCEVE_DOSYA,
    });
    expect(yeni.data).toMatchObject({ ok: true, degisti: true });
    expect(cosmeticItem(CERCEVE.id)?.price).toBe(500);
    expect(((await call(p, "GET", "/api/uretim/magaza/taslak")).data.urunler as unknown[]).length).toBe(1);

    const sil = await call(p, "DELETE", `/api/uretim/magaza/taslak/${CERCEVE.id}`);
    expect(sil.data).toMatchObject({ ok: true, silindi: true });
    expect((await call(p, "DELETE", `/api/uretim/magaza/taslak/${CERCEVE.id}`)).data.silindi).toBe(false);
    expect(cosmeticItem(CERCEVE.id)).toBeUndefined();
    expect((await fetch(`http://127.0.0.1:${p}${adres}`)).status).toBe(404);
    // Anahtarsız istek reddedilir.
    expect((await call(p, "GET", "/api/uretim/magaza/taslak", undefined, {})).status).toBe(401);
  });

  it("tepki paketi taslağının çıkartmaları tepki olarak geçerlidir", async () => {
    const p = k.srv.port;
    const urun = {
      id: "tepki-oyun-alani",
      type: "tepki",
      rarity: "siradan",
      price: 150,
      name: "Oyun Alanı Paketi",
      description: "Altı taslak çıkartma.",
      satista: true,
      asset: "oyun-alani",
    };
    const dosyalar = [1, 2, 3, 4, 5, 6].map((n) => ({ yol: `tepki/oyun-alani-${n}.webp`, veri: b64(PNG) }));
    expect((await call(p, "POST", "/api/uretim/magaza/taslak", { urun, dosyalar })).status).toBe(200);
    expect(parseStickerId("pack:oyun-alani:3")?.item.id).toBe("tepki-oyun-alani");
    const genel = await call(p, "GET", "/api/oyun-alani/magaza", undefined, {});
    expect(Object.values(genel.data.dosyalar as Record<string, string>)[0]).toMatch(/\.png$/);
  });

  it("bozuk taslak reddedilir: kural, tekrar, tür, eksik/fazla dosya, bozuk görsel", async () => {
    const p = k.srv.port;
    const yukle = (urun: unknown, dosyalar: unknown = CERCEVE_DOSYA) =>
      call(p, "POST", "/api/uretim/magaza/taslak", { urun, dosyalar });
    const hatalar = async (urun: unknown, dosyalar?: unknown): Promise<string> => {
      const r = await yukle(urun, dosyalar);
      expect(r.status).toBe(400);
      expect(r.data.code).toBe("invalid_item");
      return JSON.stringify(r.data.errors);
    };
    expect(await hatalar({ ...CERCEVE, price: 50 })).toMatch(/price/);
    expect(await hatalar({ ...CERCEVE, gizli: 1 })).toMatch(/bilinmeyen alan/);
    expect(await hatalar({ ...CERCEVE, efekt: undefined })).toMatch(/efekt/);
    const var_olan = COSMETIC_ITEMS.find((i) => i.type === "cerceve");
    expect(await hatalar({ ...CERCEVE, id: var_olan?.id })).toMatch(/zaten var/);
    expect(await hatalar({ ...CERCEVE, name: var_olan?.name })).toMatch(/aynı türde/);
    expect(
      await hatalar(
        {
          ...CERCEVE,
          id: "sapka-oyun-alani",
          type: "sapka",
          rarity: "nadir",
          asset: "sapka",
          efekt: undefined,
        },
        [],
      ),
    ).toMatch(/taslak olarak yüklenemez/);
    expect(await hatalar(CERCEVE, [])).toMatch(/oyun-alani-halka\.webp eksik/);
    expect(
      await hatalar(CERCEVE, [...CERCEVE_DOSYA, { yol: "cerceve/baska.webp", veri: b64(WEBP) }]),
    ).toMatch(/kullandığı bir görsel değil/);
    const varOlanPaket = COSMETIC_ITEMS.find((i) => i.type === "tepki");
    expect(
      await hatalar(
        {
          id: "tepki-cakisan",
          type: "tepki",
          rarity: "siradan",
          price: 150,
          name: "Çakışan",
          description: "Aynı görsel adı.",
          satista: true,
          asset: varOlanPaket?.asset,
        },
        [],
      ),
    ).toMatch(/zaten kullanılıyor/);
    const bozukGorsel = await yukle(CERCEVE, [
      { yol: "cerceve/oyun-alani-halka.webp", veri: b64(Buffer.from("merhaba")) },
    ]);
    expect(bozukGorsel.status).toBe(400);
    expect(bozukGorsel.data.message).toMatch(/WebP ya da PNG/);
    const kacis = await yukle(CERCEVE, [{ yol: "../../etc/passwd.webp", veri: b64(WEBP) }]);
    expect(kacis.status).toBe(400);
    expect((await call(p, "GET", "/api/uretim/magaza/taslak")).data.urunler).toEqual([]);
    expect(cosmeticItem(CERCEVE.id)).toBeUndefined();
  });
});

describe("katman diskte kalır; gece sıfırlaması kimliği değiştirir", () => {
  let srv: RunningServer | null = null;
  afterEach(async () => {
    await srv?.close();
    srv = null;
  });
  const ac = (db: string): Promise<RunningServer> =>
    startServer({
      host: "127.0.0.1",
      port: 0,
      clientDir: mkdtempSync(join(tmpdir(), "glix-oa-istemci-")),
      allowedOrigins: null,
      revision: "t",
      heartbeatMs: 1_000_000_000,
      accountsDb: db,
      uretimToken: TOKEN,
      ortam: "test2",
    });

  it("yeniden açılışta taslak ve kimlik aynı; veritabanı silinince ikisi de gider", async () => {
    const dir = mkdtempSync(join(tmpdir(), "glix-oa-veri-"));
    mkdirSync(dir, { recursive: true });
    const db = join(dir, "glix.db");
    srv = await ac(db);
    const k1 = (await call(srv.port, "GET", "/api/uretim/saglik")).data.katman;
    expect(
      (await call(srv.port, "POST", "/api/uretim/magaza/taslak", { urun: CERCEVE, dosyalar: CERCEVE_DOSYA }))
        .status,
    ).toBe(200);
    await srv.close();
    // Kapanışta motorun katmanı boşalır.
    expect(cosmeticItem(CERCEVE.id)).toBeUndefined();
    srv = await ac(db);
    expect((await call(srv.port, "GET", "/api/uretim/saglik")).data).toMatchObject({ katman: k1, taslak: 1 });
    expect(cosmeticItem(CERCEVE.id)).toBeDefined();
    await srv.close();
    veritabaniniSil(db);
    expect(existsSync(oyunAlaniKlasoru(db))).toBe(false);
    srv = await ac(db);
    const s = (await call(srv.port, "GET", "/api/uretim/saglik")).data;
    expect(s.katman).not.toBe(k1);
    expect(s.taslak).toBe(0);
    expect(cosmeticItem(CERCEVE.id)).toBeUndefined();
  });
});

describe("yardımcılar", () => {
  it("yol ve görsel imzası", () => {
    expect(taslakYolu("apps/client/public/assets/shop/zafer/x-1.webp")).toBe("zafer/x-1.webp");
    expect(taslakYolu("/assets/shop/zafer/x-1.webp")).toBe("zafer/x-1.webp");
    expect(taslakYolu("zafer/../x.webp")).toBeNull();
    expect(taslakYolu("zafer/x.png")).toBeNull();
    expect(gorselTuru(WEBP)).toBe("webp");
    expect(gorselTuru(PNG)).toBe("png");
    expect(gorselTuru(Buffer.from("GIF89a"))).toBeNull();
    const kat = new OyunAlaniKatmani(null, null);
    expect(kat.liste()).toEqual([]);
    kat.kapat();
  });
});
