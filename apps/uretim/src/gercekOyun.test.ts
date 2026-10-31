/**
 * Gerçek oyun sunucusuna karşı entegrasyon (sözleşme bölüm 3): `apps/server` derlenmiş hâliyle, geçici veritabanı ve
 * `GLIX_URETIM_TOKEN` ile ayrı süreçte başlatılır. Site uçtan uca: ekle → oku → kapat → geri al, moderasyon ekle,
 * mağaza istatistiği ve sağlık (canlı sürüm denetimi).
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OyunIstemcisi } from "./oyun.js";
import { type Ortam, ortamKur } from "./test/ortam.js";

const SUNUCU = resolve(import.meta.dirname, "../../server/dist/index.js");
const TOKEN = "gercek-sunucu-test-anahtari";
const SURUM = "abcdef1234567890abcdef1234567890abcdef12";
const VAR = existsSync(SUNUCU);

let surec: ChildProcess | null = null;
let url = "";
let dir = "";

beforeAll(async () => {
  if (!VAR) return;
  dir = mkdtempSync(join(tmpdir(), "uretim-oyun-"));
  const port = 40000 + Math.floor(Math.random() * 9999);
  url = `http://127.0.0.1:${port}`;
  surec = spawn(process.execPath, [SUNUCU], {
    env: {
      PATH: process.env.PATH ?? "",
      PORT: String(port),
      HOST: "127.0.0.1",
      STATS_DB: join(dir, "glix.db"),
      GLIX_URETIM_TOKEN: TOKEN,
      GIT_SHA: SURUM,
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${url}/health`)).ok) return;
    } catch {
      // henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("oyun sunucusu açılmadı");
});

afterAll(() => {
  surec?.kill();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!VAR)("gerçek oyun sunucusu", () => {
  it("istemci: sağlık, havuzlar, mağaza istatistiği, yanlış anahtar", async () => {
    const o = new OyunIstemcisi(url, TOKEN);
    expect(await o.saglik()).toEqual({ ok: true, revision: SURUM });
    const h = await o.havuzlar();
    expect(h.find((x) => x.id === "sizma/ciftler")?.kayitlar.length).toBeGreaterThan(10);
    const ist = await o.magazaIstatistik();
    expect(ist.donem).toBe("30g");
    expect(ist.urunler.length).toBeGreaterThan(0);
    await expect(new OyunIstemcisi(url, "yanlis").havuzlar()).rejects.toThrow(/anahtar/i);
  });

  it("site uçtan uca: ekle → oku → kapat → geri al; moderasyon; canlı sürüm", async () => {
    const o: Ortam = await ortamKur({ oyunUrl: url, oyunToken: TOKEN });
    try {
      const c = await o.giris();
      const k = await o.anahtarUret("icerik", c);
      // Ekle: onaylanan satırlar gerçek havuza gider.
      const t = await o.arac(k, "teslim_et", {
        tur: "yeni",
        ogeler: [
          {
            ad: "Gerçek çiftler",
            satirlar: [{ havuz: "sizma/ciftler", alanlar: { a: "zımba", b: "ataş" } }],
          },
        ],
      });
      const id = (t.veri.ogeler as { ogeId: number; durum: string }[])[0]?.ogeId ?? 0;
      expect(o.u.merkez.oge(id)?.durum).toBe("bekliyor");
      await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
      const a = await o.api("POST", `/api/oge/${id}/aktar`, {}, c);
      expect(a.durum).toBe(200);
      const ak = (a.json.aktarimlar as { id: number; oyunAktarimId: string; ozet: string }[])[0];
      expect(ak?.oyunAktarimId).toMatch(/^\d{8}-[0-9a-f]{12}$/);
      expect(ak?.ozet).toMatch(/1 satır eklendi/);
      // Oku: canlı havuzda açık.
      const oyun = new OyunIstemcisi(url, TOKEN);
      const bul = async () =>
        (await oyun.havuzlar())
          .find((h) => h.id === "sizma/ciftler")
          ?.kayitlar.find((x) => x.alanlar.a === "zımba");
      const eklenen = await bul();
      expect(eklenen?.acik).toBe(true);
      expect(eklenen?.kaynak).toBe("panel");
      // Geri al → kapanır; ikinci kez 409.
      expect((await o.api("POST", `/api/aktarim/${ak?.id}/geri-al`, {}, c)).durum).toBe(200);
      // Panelden eklenen girdi geri alınınca listeden kalkar (yerleşik değil, kapatılacak yeri yok).
      expect((await bul())?.acik ?? false).toBe(false);
      await expect(oyun.geriAl(ak?.oyunAktarimId ?? "")).rejects.toThrow(/zaten geri alınmış/);

      // Kapat: yerleşik bir kaydı kaldırma önerisiyle kapat, sonra geri al.
      const yerlesik = (await oyun.havuzlar())
        .find((h) => h.id === "sizma/ciftler")
        ?.kayitlar.find((x) => x.kaynak === "yerlesik" && x.acik);
      const t2 = await o.arac(k, "teslim_et", {
        tur: "kaldirma-onerisi",
        ogeler: [
          {
            ad: "Kapatılacak çift",
            gerekce: "Çok sık atlanıyor",
            satirlar: [{ havuz: "sizma/ciftler", anahtar: yerlesik?.anahtar, neden: "atlanıyor" }],
          },
        ],
      });
      const id2 = (t2.veri.ogeler as { ogeId: number }[])[0]?.ogeId ?? 0;
      await o.api("POST", `/api/oge/${id2}/karar`, { karar: "onay" }, c);
      const a2 = await o.api("POST", `/api/oge/${id2}/aktar`, {}, c);
      expect((a2.json.aktarimlar as { ozet: string }[])[0]?.ozet).toMatch(/1 kayıt kapatıldı/);
      const durum = async () =>
        (await oyun.havuzlar())
          .find((h) => h.id === "sizma/ciftler")
          ?.kayitlar.find((x) => x.anahtar === yerlesik?.anahtar)?.acik;
      expect(await durum()).toBe(false);
      await o.api("POST", `/api/aktarim/${(a2.json.aktarimlar as { id: number }[])[0]?.id}/geri-al`, {}, c);
      expect(await durum()).toBe(true);

      // Moderasyon ekle.
      const km = await o.anahtarUret("moderasyon", c);
      const t3 = await o.arac(km, "teslim_et", {
        tur: "yeni",
        ogeler: [{ ad: "Kalıp", satirlar: [{ kalip: "kotukelimeci", tur: "kufur" }] }],
      });
      const id3 = (t3.veri.ogeler as { ogeId: number }[])[0]?.ogeId ?? 0;
      await o.api("POST", `/api/oge/${id3}/karar`, { karar: "onay" }, c);
      expect((await o.api("POST", `/api/oge/${id3}/aktar`, {}, c)).durum).toBe(200);
      expect((await oyun.moderasyon()).some((x) => x.kalip === "kotukelimeci" && x.kaynak === "panel")).toBe(
        true,
      );

      // Mağaza istatistiği katalog_oku'ya gelir.
      const kmg = await o.anahtarUret("magaza", c);
      const kat = await o.arac(kmg, "katalog_oku");
      expect((kat.veri.istatistik as { donem: string }).donem).toBe("30g");

      // Sağlık: paket bu sürümde eklendiyse canlıda sayılır.
      o.u.merkez.db
        .prepare(
          "INSERT INTO paket (klasor, olusturma, oge_sayisi, revizyon, durum) VALUES ('x', 1, 0, ?, 'oyuna_eklendi')",
        )
        .run(SURUM.slice(0, 12));
      const { canliKontrol } = await import("./paket.js");
      expect(await canliKontrol(o.u.merkez, o.saat.simdi)).toBe(1);
    } finally {
      await o.kapat();
    }
  });
});
