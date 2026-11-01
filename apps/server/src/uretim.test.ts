/** Üretim Merkezi uçları (`/api/uretim/*`, sözleşme bölüm 3) ve önizleme sayfasının başlıkları (bölüm 4). */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONTENT_POOLS, COSMETIC_ITEMS, dailyDeals, poolById, setPreviewItems } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { k, useServer } from "./testkit.js";
import { tokenMatches, URETIM_AUDIT_ACTOR, URETIM_MAX_ROWS, URETIM_WRITES_PER_MINUTE } from "./uretim.js";

const TOKEN = "uretim-test-anahtari-0123456789";
const CAG = "cagrisim-agi/kelimeler";

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${TOKEN}` },
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`http://127.0.0.1:${k.srv.port}/api/uretim${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: (await res.json()) as Record<string, unknown> };
}

interface PoolOut {
  id: string;
  kayitlar: { anahtar: string; alanlar: Record<string, string>; kaynak: string; acik: boolean }[];
}
const pool = async (id: string): Promise<PoolOut> => {
  const r = await call("GET", "/havuzlar");
  const p = (r.data.havuzlar as PoolOut[]).find((x) => x.id === id);
  if (!p) throw new Error(id);
  return p;
};

describe("Üretim Merkezi uçları kapalı (anahtar yok)", () => {
  useServer();
  it("bütün uçlar 404", async () => {
    for (const [m, p] of [
      ["GET", "/saglik"],
      ["GET", "/havuzlar"],
      ["POST", `/havuzlar/${CAG}/ekle`],
      ["GET", "/magaza/istatistik"],
    ] as const) {
      const r = await call(m, p, m === "POST" ? { satirlar: ["deneme"] } : undefined);
      expect(r.status, p).toBe(404);
    }
  });
});

describe("Üretim Merkezi uçları", () => {
  useServer({ uretimToken: TOKEN });

  it("anahtar sabit sürede denetlenir; yanlış/eksik anahtar 401, vekilden gelen istek 404", async () => {
    expect((await call("GET", "/saglik")).data).toEqual({ ok: true, revision: "t" });
    expect((await call("GET", "/saglik", undefined, {})).status).toBe(401);
    expect((await call("GET", "/saglik", undefined, { Authorization: `Bearer ${TOKEN}x` })).status).toBe(401);
    expect((await call("GET", "/saglik", undefined, { Authorization: TOKEN })).status).toBe(401);
    expect(
      (
        await call("GET", "/saglik", undefined, {
          Authorization: `Bearer ${TOKEN}`,
          "X-Forwarded-For": "1.2.3.4",
        })
      ).status,
    ).toBe(404);
    expect((await call("GET", "/yok")).status).toBe(404);
    expect(tokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(tokenMatches(`Bearer ${TOKEN.slice(1)}`, TOKEN)).toBe(false);
    expect(tokenMatches(undefined, TOKEN)).toBe(false);
  });

  it("havuzlar: canlıdaki etkin liste (yerleşik + panel), alan şemasıyla", async () => {
    const r = await call("GET", "/havuzlar");
    const list = r.data.havuzlar as (PoolOut & { gameId: string; label: string; fields: unknown[] })[];
    expect(list.map((p) => p.id)).toEqual(CONTENT_POOLS.map((p) => p.id));
    const cag = list.find((p) => p.id === CAG);
    const def = poolById(CAG);
    expect(cag?.kayitlar.length).toBe(def?.builtin.length);
    expect(cag?.kayitlar.every((e) => e.kaynak === "yerlesik" && e.acik)).toBe(true);
    expect(cag?.fields).toEqual([
      { key: "text", label: "Kelime", hint: "tek sözcük", min: 2, max: 16 },
      { key: "level", label: "Zorluk", hint: "kolay, orta ya da zor (boş: orta)", min: 0, max: 5 },
    ]);
  });

  it("ekle: doğrular, tekrarı ve geçersizi atlar; geri al kaldırır; ikinci geri alma 409; işlem kaydı uretim", async () => {
    const before = (await pool(CAG)).kayitlar.length;
    const builtinWord = (await pool(CAG)).kayitlar[0]?.alanlar.text ?? "";
    const r = await call("POST", `/havuzlar/${CAG}/ekle`, {
      satirlar: ["Lavantalık", { text: "Pusulacılık" }, builtinWord, "x", { yanlis: "alan" }],
    });
    expect(r.status).toBe(200);
    expect(r.data.eklenen).toBe(2);
    expect((r.data.atlanan as { satir: number }[]).map((a) => a.satir)).toEqual([3, 4, 5]);
    const id = r.data.aktarimId as string;
    expect(id).toMatch(/^\d{8}-[0-9a-f]{12}$/);
    const after = await pool(CAG);
    expect(after.kayitlar.length).toBe(before + 2);
    // Havuz kelimeyi kendi kuralıyla yazar (büyük harf).
    expect(after.kayitlar.filter((e) => e.kaynak === "panel").map((e) => e.alanlar.text)).toEqual([
      "LAVANTALIK",
      "PUSULACILIK",
    ]);
    const audit = k.srv.accounts.adminAuditTail(5);
    expect(audit[0]).toMatchObject({ accountId: URETIM_AUDIT_ACTOR, action: "uretim_havuz_ekle" });
    expect(audit[0]?.detail).toContain(id);

    expect((await call("POST", `/aktarim/${id}/geri-al`, {})).data).toEqual({ ok: true });
    expect((await pool(CAG)).kayitlar.length).toBe(before);
    expect((await call("POST", `/aktarim/${id}/geri-al`, {})).status).toBe(409);
    expect((await call("POST", "/aktarim/20260101-000000000000/geri-al", {})).status).toBe(404);
    expect(k.srv.accounts.adminAuditTail(1)[0]?.action).toBe("uretim_geri_al");
  });

  it("kapat: yerleşik girdiyi kapatır, silmez; geri al yeniden açar", async () => {
    const start = await pool(CAG);
    const keys = start.kayitlar.slice(0, 3).map((e) => e.anahtar);
    const r = await call("POST", `/havuzlar/${CAG}/kapat`, {
      anahtarlar: [...keys, "boyle-bir-anahtar-yok"],
    });
    expect(r.data.kapatilan).toBe(3);
    const closed = await pool(CAG);
    expect(closed.kayitlar.length).toBe(start.kayitlar.length);
    expect(closed.kayitlar.filter((e) => !e.acik).map((e) => e.anahtar)).toEqual(keys);
    // Zaten kapalı olan yeniden sayılmaz.
    expect((await call("POST", `/havuzlar/${CAG}/kapat`, { anahtarlar: keys })).data.kapatilan).toBe(0);
    await call("POST", `/aktarim/${r.data.aktarimId as string}/geri-al`, {});
    expect((await pool(CAG)).kayitlar.every((e) => e.acik)).toBe(true);
  });

  it("satır sınırı 500, bilinmeyen havuz 404, gövde JSON olmalı", async () => {
    const many = Array.from({ length: URETIM_MAX_ROWS + 1 }, (_, i) => `kelime${i}`);
    expect((await call("POST", `/havuzlar/${CAG}/ekle`, { satirlar: many })).status).toBe(413);
    expect((await call("POST", "/havuzlar/yok/ekle", { satirlar: ["a"] })).status).toBe(404);
    expect((await call("POST", `/havuzlar/${CAG}/ekle`, { satir: [] })).status).toBe(400);
    const res = await fetch(`http://127.0.0.1:${k.srv.port}/api/uretim/moderasyon/ekle`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "text/plain" },
      body: "x",
    });
    expect(res.status).toBe(415);
  });

  it("yazma hız sınırı: dakikada 30", async () => {
    for (let i = 0; i < URETIM_WRITES_PER_MINUTE; i++)
      expect((await call("POST", "/moderasyon/ekle", { kaliplar: [`kalip${i}x`] })).status).toBe(200);
    expect((await call("POST", "/moderasyon/ekle", { kaliplar: ["fazla"] })).status).toBe(429);
    expect((await call("GET", "/saglik")).status).toBe(200);
    k.clock.advance(60_000);
    expect((await call("POST", "/moderasyon/ekle", { kaliplar: ["sonra"] })).status).toBe(200);
  });

  it("moderasyon: yerleşik ve panel kalıpları; ekle ve geri al", async () => {
    const list0 = (await call("GET", "/moderasyon")).data.kaliplar as {
      kalip: string;
      tur: string;
      kaynak: string;
    }[];
    expect(list0.some((p) => p.kaynak === "yerlesik" && p.tur === "kufur-onek")).toBe(true);
    const r = await call("POST", "/moderasyon/ekle", { kaliplar: ["zıbıdı", { kalip: "Zibidi" }, "a", 3] });
    expect(r.data.eklenen).toBe(1);
    expect((r.data.atlanan as { satir: number; neden: string }[]).map((a) => a.satir)).toEqual([2, 3, 4]);
    expect(k.srv.bannedWords.matches("zibidi_42")).toBe(true);
    const list1 = (await call("GET", "/moderasyon")).data.kaliplar as { kalip: string; kaynak: string }[];
    expect(list1.filter((p) => p.kaynak === "panel").map((p) => p.kalip)).toEqual(["zıbıdı"]);
    await call("POST", `/aktarim/${r.data.aktarimId as string}/geri-al`, {});
    expect(k.srv.bannedWords.matches("zibidi_42")).toBe(false);
  });

  it("mağaza istatistiği: son 30 gün, ürün başına toplu; kişisel veri yok", async () => {
    const db = k.srv.accounts;
    const now = k.clock.now();
    const mk = (n: string): number => {
      const r = db.create(n, `${n}@gizli.local`, "x", now);
      if (!r.ok) throw new Error("hesap");
      db.adjustGlix(r.account.id, 10_000, "test", now);
      return r.account.id;
    };
    const a = mk("gizlikullanici");
    const b = mk("ikincikisi");
    const deal = dailyDeals(now)[0];
    const plain = COSMETIC_ITEMS.find((i) => i.price > 0 && !dailyDeals(now).some((d) => d.itemId === i.id));
    if (!deal || !plain) throw new Error("ürün");
    expect(db.purchaseCosmetic(a, deal.itemId, now).ok).toBe(true);
    expect(db.purchaseCosmetic(b, deal.itemId, now).ok).toBe(true);
    expect(db.purchaseCosmetic(a, plain.id, now).ok).toBe(true);
    // 31 gün önceki alım dönemin dışında; armağan (fiyat 0) satış sayılmaz.
    expect(db.purchaseCosmetic(b, plain.id, now - 31 * 24 * 3600 * 1000).ok).toBe(true);
    db.grantCosmetic(b, "unvan-efsane", now);
    const dealType = COSMETIC_ITEMS.find((i) => i.id === deal.itemId)?.type;
    if (dealType && dealType !== "tepki") {
      db.equipCosmetic(a, dealType, deal.itemId);
      db.equipCosmetic(b, dealType, deal.itemId);
    }
    const r = await call("GET", "/magaza/istatistik");
    expect(r.data.donem).toBe("30g");
    const rows = r.data.urunler as { id: string; satis: number; kusanan: number; firsatSatis: number }[];
    expect(rows.map((x) => x.id)).toEqual(COSMETIC_ITEMS.map((i) => i.id));
    expect(rows.find((x) => x.id === deal.itemId)).toMatchObject({ satis: 2, firsatSatis: 2 });
    if (dealType && dealType !== "tepki") expect(rows.find((x) => x.id === deal.itemId)?.kusanan).toBe(2);
    expect(rows.find((x) => x.id === plain.id)).toMatchObject({ satis: 1, firsatSatis: 0 });
    expect(rows.find((x) => x.id === "unvan-efsane")?.satis).toBe(0);
    const text = JSON.stringify(r.data);
    for (const leak of ["gizlikullanici", "ikincikisi", "@gizli.local", `"${a}"`])
      expect(text).not.toContain(leak);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["firsatSatis", "id", "kusanan", "satis"]);
  });

  it("hiçbir yanıt hesap kimliği, takma ad ya da e-posta taşımaz", async () => {
    const db = k.srv.accounts;
    const r0 = db.create("sizintiyok", "sizinti@gizli.local", "x", k.clock.now());
    if (!r0.ok) throw new Error("hesap");
    const all = [
      await call("GET", "/havuzlar"),
      await call("GET", "/moderasyon"),
      await call("GET", "/magaza/istatistik"),
      await call("GET", "/saglik"),
      await call("POST", `/havuzlar/${CAG}/ekle`, { satirlar: ["Sızıntısız"] }),
    ];
    for (const r of all) {
      const text = JSON.stringify(r.data);
      expect(text).not.toContain("sizintiyok");
      expect(text).not.toContain("@gizli.local");
      expect(text).not.toMatch(/"(accountId|account_id|username|email|nickname)"/);
    }
  });
});

describe("satıştan kalkan ürün (MG-3, sunucu denetimi)", () => {
  it("satışta olmayan ya da çıkışı gelmemiş ürün satın alınamaz; sahibi kuşanmaya devam eder", () => {
    const db = createAccounts(":memory:");
    const r = db.create("Ali", "ali@t.local", "x", 1);
    if (!r.ok) throw new Error("hesap");
    const id = r.account.id;
    db.adjustGlix(id, 5000, "t", 1);
    const now = Date.UTC(2026, 10, 20, 9);
    const it = COSMETIC_ITEMS.find((i) => i.id === "cerceve-galaksi");
    const other = COSMETIC_ITEMS.find((i) => i.id === "cerceve-ejderha");
    if (!it || !other) throw new Error("ürün");
    expect(db.purchaseCosmetic(id, it.id, now).ok).toBe(true);
    db.equipCosmetic(id, "cerceve", it.id);
    setPreviewItems([
      { ...it, satista: false },
      { ...other, cikis: "2026-11-21" },
    ]);
    try {
      expect(db.purchaseCosmetic(id, other.id, now)).toEqual({ ok: false, reason: "not_for_sale" });
      expect(db.purchaseCosmetic(id, other.id, Date.UTC(2026, 10, 20, 21)).ok).toBe(true);
      // Satıştan kalkan ürünün sahibi kuşanmaya devam eder.
      expect(db.equipCosmetic(id, "cerceve", null)).toBe("ok");
      expect(db.equipCosmetic(id, "cerceve", it.id)).toBe("ok");
    } finally {
      setPreviewItems(null);
    }
  });
});

describe("önizleme sayfası başlıkları (UM-U4)", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-onizleme-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>oyun</title>");
  writeFileSync(join(dir, "onizleme.html"), "<!doctype html><title>önizleme</title>");
  useServer({ clientDir: dir, previewAncestors: ["https://uretim.dgmcraft.online"] });

  it("yalnız Üretim Merkezi gömebilir; X-Frame-Options yok, önbellek yok; oyunun sayfası gömülemez", async () => {
    const res = await fetch(`http://127.0.0.1:${k.srv.port}/onizleme.html`);
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors https://uretim.dgmcraft.online;");
    expect(csp).toContain("connect-src 'self' data: blob:");
    expect(csp).toContain("script-src 'self';");
    expect(res.headers.get("x-frame-options")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    const game = await fetch(`http://127.0.0.1:${k.srv.port}/`);
    expect(game.headers.get("x-frame-options")).toBe("DENY");
    expect(game.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});
