import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { COSMETIC_ITEMS } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { hashPassword, verifyPassword } from "./auth.js";
import { BADGES } from "./badges.js";
import {
  ICERIK_TABLOLARI,
  type IcerikPaketi,
  icerikDisaAktar,
  KOPYALANMAYAN_TABLOLAR,
} from "./ortamIcerikDisa.js";
import {
  icerikIceAktar,
  icerikPaketiDogrula,
  ortamYenile,
  ortamYenileKomut,
  SAHTE_HESAPLAR,
  ZENGIN_GLIX,
} from "./ortamYenile.js";
import { createStats } from "./statsStore.js";

const NOW = 1_800_000_000_000;
const yeniDosya = (): string => join(mkdtempSync(join(tmpdir(), "glix-ortam-icerik-")), "glix.db");

/** Gerçek oyuncu verisi ve içerik taşıyan bir "canlı" veritabanı. */
async function canliKur(path: string): Promise<void> {
  createStats(path).close();
  const a = createAccounts(path);
  const made = a.create("GercekOyuncu", "gercek.oyuncu@ornek.com", await hashPassword("gercek-sifre-1"), NOW);
  if (!made.ok) throw new Error("kurulamadı");
  const id = made.account.id;
  a.createSession(id, "oturum-ozeti-gizli", NOW);
  a.pushSet(id, { endpoint: "https://fcm.googleapis.com/gizli-uc", p256dh: "p", auth: "q" }, NOW);
  a.adjustGlix(id, 777, "test", NOW);
  a.awardBadges(id, ["ilk-mac"], NOW);
  a.contentOverridePut(
    { poolId: "laf-sokma/sorular", key: "yeni-soru", action: "add", value: '{"q":"Canlı soru"}' },
    NOW,
  );
  a.contentOverridePut(
    { poolId: "laf-sokma/sorular", key: "eski-soru", action: "disable", value: null },
    NOW,
  );
  a.bannedWordAdd("Yasakli", "yasakli", NOW, 1000);
  a.settingSet("games", '{"butona-bas":false}', NOW);
  a.settingSet("gunlukGorevler", "1", NOW);
  a.settingSet("announcement", '{"text":"Canlı duyuru"}', NOW);
  a.settingSet("maintenance", "1", NOW);
  a.settingSet("broadcast_last", "{}", NOW);
  a.close();
}

function disaAktar(path: string): IcerikPaketi {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return icerikDisaAktar(db, NOW);
  } finally {
    db.close();
  }
}

function tablolar(path: string): string[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
    ).map((r) => r.name);
  } finally {
    db.close();
  }
}

describe("içerik tablolarının sınıflandırılması", () => {
  it("veritabanındaki her tablo ya içerik ya kopyalanmayan listesinde (yeni tablo sınıflandırılmadan geçmez)", async () => {
    const path = yeniDosya();
    await canliKur(path);
    const icerik = new Set(ICERIK_TABLOLARI.map((t) => t.tablo));
    for (const t of tablolar(path)) {
      const sinifli = icerik.has(t) || t in KOPYALANMAYAN_TABLOLAR;
      expect(sinifli, `sınıflandırılmamış tablo: ${t}`).toBe(true);
    }
    for (const t of icerik) expect(t in KOPYALANMAYAN_TABLOLAR).toBe(false);
  });

  it("kopyalanan tablolar yalnız içerik: havuz değişiklikleri, yasaklı kelimeler, oyun ve görev anahtarları", () => {
    expect(ICERIK_TABLOLARI.map((t) => t.tablo).sort()).toEqual([
      "banned_words",
      "content_overrides",
      "server_settings",
    ]);
    expect(ICERIK_TABLOLARI.find((t) => t.tablo === "server_settings")?.yalniz?.degerler).toEqual([
      "games",
      "gunlukGorevler",
    ]);
    for (const t of ["accounts", "sessions", "email_tokens", "account_push", "glix_ledger", "cosmetic_owned"])
      expect(KOPYALANMAYAN_TABLOLAR).toHaveProperty(t);
  });

  it("dışa aktarma kendi başınadır: yalnız node: modüllerini içe aktarır (canlı kapta stdin'den çalışır)", () => {
    const src = readFileSync(new URL("./ortamIcerikDisa.ts", import.meta.url), "utf8");
    const imports = [...src.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) expect(m).toMatch(/^node:/);
  });
});

describe("dışa aktarma", () => {
  it("gerçek oyuncu verisi pakete girmez", async () => {
    const path = yeniDosya();
    await canliKur(path);
    const paket = disaAktar(path);
    expect(Object.keys(paket.tablolar).sort()).toEqual([
      "banned_words",
      "content_overrides",
      "server_settings",
    ]);
    const text = JSON.stringify(paket);
    for (const gizli of [
      "gercek.oyuncu@ornek.com",
      "GercekOyuncu",
      "oturum-ozeti-gizli",
      "fcm.googleapis.com",
      "scrypt",
      "Canlı duyuru",
      "777",
    ])
      expect(text).not.toContain(gizli);
    expect(paket.tablolar.server_settings?.map((r) => r.key).sort()).toEqual(["games", "gunlukGorevler"]);
    expect(paket.tablolar.content_overrides).toHaveLength(2);
    expect(paket.tablolar.banned_words?.[0]).toMatchObject({ folded: "yasakli", word: "Yasakli" });
  });

  it("kaynakta olmayan tablo atlanır (eski şemalı canlı)", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(
      "CREATE TABLE banned_words (folded TEXT PRIMARY KEY, word TEXT NOT NULL, added_at INTEGER NOT NULL)",
    );
    expect(Object.keys(icerikDisaAktar(db, NOW).tablolar)).toEqual(["banned_words"]);
    db.close();
  });
});

describe("paket doğrulama", () => {
  const gecerli = (): Record<string, unknown> => ({
    surum: 1,
    alindi: NOW,
    tablolar: { banned_words: [{ folded: "a", word: "A", added_at: 1 }] },
  });
  it("geçerli paket", () => {
    expect(icerikPaketiDogrula(gecerli()).tablolar.banned_words).toHaveLength(1);
  });
  it("izin listesi dışı tablo, fazla sütun, yasak anahtar ve bozuk değer reddedilir", () => {
    const bozuklar: unknown[] = [
      { ...gecerli(), tablolar: { accounts: [{ id: 1, email: "a@b.c" }] } },
      { ...gecerli(), tablolar: { sessions: [] } },
      { ...gecerli(), tablolar: { banned_words: [{ folded: "a", word: "A", added_at: 1, email: "x" }] } },
      { ...gecerli(), tablolar: { banned_words: [{ folded: "a", word: "A" }] } },
      { ...gecerli(), tablolar: { banned_words: [{ folded: "a", word: { x: 1 }, added_at: 1 }] } },
      { ...gecerli(), tablolar: { server_settings: [{ key: "maintenance", value: "1", updated_at: 1 }] } },
      { ...gecerli(), surum: 2 },
      null,
      [],
    ];
    for (const b of bozuklar) expect(() => icerikPaketiDogrula(b)).toThrow();
  });
});

describe("içe aktarma ve sahte hesaplar", () => {
  it("içerik birebir değişir; hedefin hesapları ve duyurusu yerinde kalır (onay ortamı)", async () => {
    const kaynak = yeniDosya();
    await canliKur(kaynak);
    const paket = icerikPaketiDogrula(JSON.parse(JSON.stringify(disaAktar(kaynak))));

    const hedef = yeniDosya();
    createStats(hedef).close();
    const a = createAccounts(hedef);
    const davetli = a.create("Davetli", "davetli@ornek.com", "x", NOW);
    a.contentOverridePut(
      { poolId: "laf-sokma/sorular", key: "hedefte-eski", action: "add", value: '{"q":"eski"}' },
      NOW,
    );
    a.bannedWordAdd("Eski", "eski", NOW, 1000);
    a.settingSet("announcement", '{"text":"Test duyurusu"}', NOW);
    a.settingSet("games", "{}", NOW);
    a.close();

    const sayilar = icerikIceAktar(hedef, paket);
    expect(sayilar).toEqual({ content_overrides: 2, banned_words: 1, server_settings: 2 });

    const b = createAccounts(hedef);
    expect(
      b
        .contentOverrides()
        .map((r) => r.key)
        .sort(),
    ).toEqual(["eski-soru", "yeni-soru"]);
    expect(b.bannedWordsList().map((w) => w.word)).toEqual(["Yasakli"]);
    expect(b.settingGet("games")).toBe('{"butona-bas":false}');
    expect(b.settingGet("gunlukGorevler")).toBe("1");
    expect(b.settingGet("announcement")).toBe('{"text":"Test duyurusu"}');
    expect(b.settingGet("maintenance")).toBeNull();
    expect(davetli.ok && b.findById(davetli.account.id)?.username).toBe("Davetli");
    // Canlının oyuncusu hedefe hiç gelmez.
    expect(b.findByLogin("gercekoyuncu")).toBeNull();
    expect(b.findByEmail("gercek.oyuncu@ornek.com")).toBeNull();
    b.close();
  });

  it("oyun alanı: sıfırlama eski hesapları siler, sahte hesaplar güncel kataloğa göre kurulur", async () => {
    const kaynak = yeniDosya();
    await canliKur(kaynak);
    const paket = disaAktar(kaynak);

    const hedef = yeniDosya();
    createStats(hedef).close();
    const a = createAccounts(hedef);
    a.create("EskiDeneme", "eski@ornek.com", "x", NOW);
    a.close();

    const sifre = "sahte-sifre-uzun-1";
    for (let tur = 0; tur < 2; tur += 1) {
      const sonuc = await ortamYenile({
        path: hedef,
        icerik: paket,
        sifirla: true,
        sahteSifre: sifre,
        now: NOW,
      });
      expect(sonuc.sifirlandi).toBe(true);
      expect(sonuc.sahte.map((s) => s.kullaniciAdi)).toEqual(SAHTE_HESAPLAR.map((h) => h.kullaniciAdi));
    }

    const b = createAccounts(hedef);
    expect(b.findByLogin("eskideneme")).toBeNull();
    expect(b.findByLogin("gercekoyuncu")).toBeNull();
    expect(b.contentOverrides()).toHaveLength(2);

    const zengin = b.findByLogin("zengin");
    expect(zengin).not.toBeNull();
    if (!zengin) throw new Error("zengin yok");
    expect(await verifyPassword(sifre, zengin.passHash ?? "")).toBe(true);
    expect(b.isVerified(zengin.id)).toBe(true);
    expect(b.glixBalance(zengin.id)).toBe(ZENGIN_GLIX);
    const sahip = new Set(b.cosmetics(zengin.id).owned.map((o) => o.itemId));
    for (const item of COSMETIC_ITEMS) expect(sahip.has(item.id), item.id).toBe(true);
    expect(Object.keys(b.equippedCosmetics(zengin.id)).length).toBeGreaterThan(0);

    const yeni = b.findByLogin("yenioyuncu");
    if (!yeni) throw new Error("yeni yok");
    expect(b.glixBalance(yeni.id)).toBe(0);
    expect(b.cosmetics(yeni.id).owned).toEqual([]);
    expect(b.earnedBadges(yeni.id)).toEqual([]);

    const rozetli = b.findByLogin("rozetli");
    if (!rozetli) throw new Error("rozetli yok");
    expect(
      b
        .earnedBadges(rozetli.id)
        .map((r) => r.badgeId)
        .sort(),
    ).toEqual(BADGES.map((x) => x.id).sort());
    b.close();
  });

  it("sıfırlamasız sahte hesap yenilemesi başka hesaplara dokunmaz", async () => {
    const hedef = yeniDosya();
    createStats(hedef).close();
    const a = createAccounts(hedef);
    a.create("Davetli", "davetli@ornek.com", "x", NOW);
    a.close();
    await ortamYenile({
      path: hedef,
      icerik: null,
      sifirla: false,
      sahteSifre: "sahte-sifre-uzun-1",
      now: NOW,
    });
    await ortamYenile({
      path: hedef,
      icerik: null,
      sifirla: false,
      sahteSifre: "sahte-sifre-uzun-1",
      now: NOW,
    });
    const b = createAccounts(hedef);
    expect(b.findByLogin("davetli")).not.toBeNull();
    expect(b.findByLogin("zengin")).not.toBeNull();
    b.close();
  });

  it("komut canlıda (ya da bayraksız) hiçbir şey yapmaz", async () => {
    const hedef = yeniDosya();
    for (const env of [{}, { GLIX_ORTAM: "canli" }]) {
      expect(await ortamYenileKomut(["--sifirla"], { ...env, ACCOUNTS_DB: hedef })).toBe(2);
    }
    expect(() => tablolar(hedef)).toThrow();
  });
});
