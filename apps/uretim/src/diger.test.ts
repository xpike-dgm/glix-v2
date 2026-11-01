import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aboneAyristir, sessizMi, VARSAYILAN_AYAR, yerelZaman } from "./bildirim.js";
import { readConfig } from "./config.js";
import { openDb } from "./db.js";
import { Depo } from "./depo.js";
import { Depoayna } from "./katalog.js";
import { ALAN_IDLERI, ALANLAR, talimatTaslagi } from "./ortak/alanlar.js";
import { klasorAdi, paketYolu } from "./paket.js";
import { hedefYolUygun, teslimAyristir } from "./teslimGirdisi.js";
import { eskiYedekleriSil, yedekAl } from "./yedek.js";

describe("alanlar ve talimat taslakları", () => {
  it("13 alan (13. Oyun Tasarımı); her alanın taslağı ön kontrol satırlarını içerir", () => {
    expect(ALAN_IDLERI).toHaveLength(13);
    for (const a of ALANLAR) {
      const t = talimatTaslagi(a.id);
      expect(t).toContain(`# ${a.ad} alanı`);
      for (const k of a.onKontrol) expect(t).toContain(k);
    }
  });
});

describe("teslim biçimi", () => {
  const magaza = ALANLAR[0];
  it("bilinmeyen alan ve aşırı öğe reddedilir", () => {
    if (!magaza) throw new Error();
    expect(teslimAyristir({ tur: "yeni", ogeler: [{ ad: "x", bilinmeyen: 1 }] }, magaza).ok).toBe(false);
    expect(
      teslimAyristir({ tur: "yeni", ogeler: Array.from({ length: 51 }, () => ({ ad: "x" })) }, magaza).ok,
    ).toBe(false);
    expect(teslimAyristir({ tur: "sil", ogeler: [{ ad: "x" }] }, magaza).ok).toBe(false);
    expect(teslimAyristir({ tur: "yeni", ogeler: [{ ad: "x" }] }, magaza).ok).toBe(true);
  });
  it("hedef yol yalnız alanın önekleriyle", () => {
    if (!magaza) throw new Error();
    expect(hedefYolUygun("apps/client/public/assets/shop/cerceve/a.webp", magaza)).toBe(true);
    expect(hedefYolUygun("packages/engine/src/katalog/magaza.json.yama", magaza)).toBe(true);
    for (const y of [
      "apps/client/public/assets/shop/../../../server/x",
      "/etc/passwd",
      "apps/client/public/assets/badges/a.webp",
      "apps/client/public/assets/shop//a.webp",
      "Apps/x",
    ])
      expect(hedefYolUygun(y, magaza), y).toBe(false);
  });
});

describe("paket yolları", () => {
  it("paket dışına çıkamaz; klasör adı tarih-saat", () => {
    expect(() => paketYolu("/tmp/p", "../x")).toThrow();
    expect(() => paketYolu("/tmp/p", "a/../../x")).toThrow();
    expect(paketYolu("/tmp/p", "a/b.webp")).toBe("/tmp/p/a/b.webp");
    expect(klasorAdi(Date.parse("2026-10-31T21:05:00Z"), "Europe/Istanbul")).toBe("20261101-0005");
  });
});

describe("bildirim saatleri", () => {
  it("gece sessiz saatleri ve yerel saat", () => {
    expect(sessizMi(23 * 60 + 30, VARSAYILAN_AYAR)).toBe(true);
    expect(sessizMi(7 * 60, VARSAYILAN_AYAR)).toBe(true);
    expect(sessizMi(12 * 60, VARSAYILAN_AYAR)).toBe(false);
    expect(yerelZaman(Date.parse("2026-10-31T06:00:00Z"), "Europe/Istanbul")).toEqual({
      tarih: "2026-10-31",
      dakika: 9 * 60,
    });
  });
  it("yalnız bilinen push servisleri kabul edilir", () => {
    const keys = { p256dh: "B".repeat(87), auth: "A".repeat(22) };
    expect(aboneAyristir({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys })).not.toBeNull();
    expect(aboneAyristir({ endpoint: "http://127.0.0.1:3910/x", keys })).toBeNull();
    expect(aboneAyristir({ endpoint: "https://kotu.example/x", keys })).toBeNull();
  });
});

describe("katalog aynası (git)", () => {
  it("ana daldan katalog dosyası okur ve atalık denetler", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uretim-repo-"));
    const git = (...a: string[]) =>
      execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a], {
        encoding: "utf8",
      }).trim();
    git("init", "-q", "-b", "main");
    mkdirSync(join(dir, "packages/engine/src/katalog"), { recursive: true });
    writeFileSync(
      join(dir, "packages/engine/src/katalog/magaza.json"),
      JSON.stringify({ surum: 1, urunler: [{ id: "neon", name: "Neon" }] }),
    );
    git("add", "-A");
    git("commit", "-qm", "ilk");
    const ilk = git("rev-parse", "HEAD");
    writeFileSync(join(dir, "x.txt"), "x");
    git("add", "-A");
    git("commit", "-qm", "ikinci");
    const ikinci = git("rev-parse", "HEAD");
    const a = new Depoayna(dir);
    expect(await a.revizyon()).toBe(ikinci);
    expect(await a.listele(ikinci, "packages/engine/src/katalog/")).toEqual([
      "packages/engine/src/katalog/magaza.json",
    ]);
    expect(await a.oku(ikinci, "packages/engine/src/katalog/magaza.json")).toContain("neon");
    expect(await a.oku(ikinci, "../../etc/passwd")).toBeNull();
    expect(await a.iceriyor(ilk, ikinci)).toBe(true);
    expect(await a.iceriyor(ikinci, ilk)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("gece yedeği", () => {
  it("veritabanını kopyalar, 14 günden eskiyi siler", async () => {
    const dir = mkdtempSync(join(tmpdir(), "uretim-yedek-"));
    const db = openDb(join(dir, "u.db"));
    const depo = new Depo(join(dir, "depo"), db);
    mkdirSync(join(dir, "yedek/2026-10-01"), { recursive: true });
    const r = await yedekAl(db, depo, join(dir, "yedek"), "2026-10-31");
    expect(existsSync(join(r.klasor, "uretim.db"))).toBe(true);
    expect(existsSync(join(dir, "yedek/2026-10-01"))).toBe(false);
    mkdirSync(join(dir, "yedek/2026-10-20"), { recursive: true });
    await eskiYedekleriSil(join(dir, "yedek"), "2026-10-31");
    expect(existsSync(join(dir, "yedek/2026-10-20"))).toBe(true);
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("ayarlar", () => {
  it("sözleşme bölüm 6 değişkenleri okunur", () => {
    const c = readConfig({
      URETIM_SAHIP_EPOSTA: "a@b.co, kotu, C@D.com",
      URETIM_OYUN_URL: "http://glix:3900/",
      GLIX_URETIM_TOKEN: "t",
      URETIM_PUBLIC_URL: "https://uretim.dgmcraft.online/",
    });
    expect(c.sahipEpostalar).toEqual(["a@b.co", "c@d.com"]);
    expect(c.oyunUrl).toBe("http://glix:3900");
    expect(c.publicUrl).toBe("https://uretim.dgmcraft.online");
    expect(c.onizlemeUrl).toBe("https://glix.dgmcraft.online/onizleme.html");
  });
});
