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
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";

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
    // Canlıda katman kimliği yoktur (yalnız oyun alanı, test2).
    expect(await o.saglik()).toEqual({ ok: true, revision: SURUM, katman: null, taslak: 0 });
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

/**
 * Gerçek oyun alanı (test2): `apps/server` derlenmiş hâliyle `GLIX_ORTAM=test2` ve kendi anahtarıyla. Site teslimi
 * kendiliğinden yükler (mağaza taslak katmanı ve içerik havuzu), ret geri alır; sunucu yeniden başlayınca katman
 * aynı kalır, veritabanı silinince (gece sıfırlaması) kimlik değişir ve site yeniden yükler.
 */
describe.skipIf(!VAR)("gerçek oyun alanı (test2)", () => {
  const T2_TOKEN = "gercek-test2-anahtari";
  let t2: ChildProcess | null = null;
  let t2Url = "";
  let t2Dir = "";
  // Yeniden açılışta aynı kapı (site aynı adrese gider).
  const port = 50000 + Math.floor(Math.random() * 9999);
  const ac = async (): Promise<void> => {
    t2Url = `http://127.0.0.1:${port}`;
    t2 = spawn(process.execPath, [SUNUCU], {
      env: {
        PATH: process.env.PATH ?? "",
        PORT: String(port),
        HOST: "127.0.0.1",
        STATS_DB: join(t2Dir, "glix.db"),
        GLIX_URETIM_TOKEN: T2_TOKEN,
        GLIX_ORTAM: "test2",
        GIT_SHA: SURUM,
      },
      stdio: "ignore",
    });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${t2Url}/health`)).ok) return;
      } catch {
        // henüz açılmadı
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("oyun alanı açılmadı");
  };
  const kapat = async (): Promise<void> => {
    const s = t2;
    t2 = null;
    if (!s) return;
    await new Promise<void>((r) => {
      s.once("exit", () => r());
      s.kill("SIGINT");
    });
  };
  beforeAll(async () => {
    if (!VAR) return;
    t2Dir = mkdtempSync(join(tmpdir(), "uretim-test2-"));
    await ac();
  });
  afterAll(async () => {
    await kapat();
    if (t2Dir) rmSync(t2Dir, { recursive: true, force: true });
  });

  it("mağaza ve içerik teslimi test2'ye gider, ret geri alır; sıfırlamadan sonra yeniden yüklenir", async () => {
    const o: Ortam = await ortamKur({ test2Url: t2Url, test2Token: T2_TOKEN });
    try {
      const c = await o.giris();
      const km = await o.anahtarUret("magaza", c);
      const y = await o.arac(km, "dosya_yukle", { ad: "halka.png", icerik_base64: b64(gorsel(384, 384)) });
      const t = await o.arac(km, "teslim_et", {
        tur: "yeni",
        uretimYontemi: "gorsel-model",
        ogeler: [
          {
            ad: "Test2 Halkası",
            dosyalar: [
              {
                dosyaId: y.veri.dosyaId,
                hedefYol: "apps/client/public/assets/shop/cerceve/test2-halka.webp",
              },
            ],
            satirlar: [
              {
                id: "cerceve-test2-halka",
                type: "cerceve",
                rarity: "nadir",
                price: 450,
                name: "Test2 Halkası",
                description: "Oyun alanında denenen halka.",
                satista: true,
                efekt: {
                  motor: "doku-katmani",
                  parametreler: { doku: "cerceve/test2-halka.webp", karisim: "normal", hareket: "yok" },
                },
              },
            ],
          },
        ],
      });
      const magazaId = (t.veri.ogeler as { ogeId: number; durum: string }[])[0]?.ogeId ?? 0;
      expect(o.u.merkez.oge(magazaId)?.durum).toBe("bekliyor");
      await o.u.oyunAlani.bosalt();
      expect(o.u.merkez.oge(magazaId)?.test2).toMatchObject({ durum: "yuklu", hata: null });
      const katman = async () =>
        (await (await fetch(`${t2Url}/api/oyun-alani/magaza`)).json()) as {
          urunler: { id: string }[];
          dosyalar: Record<string, string>;
        };
      const k1 = await katman();
      expect(k1.urunler.map((u) => u.id)).toEqual(["cerceve-test2-halka"]);
      const adres = k1.dosyalar["/assets/shop/cerceve/test2-halka.webp"] ?? "";
      const img = await fetch(`${t2Url}${adres}`);
      expect(img.status).toBe(200);
      expect(img.headers.get("content-type")).toMatch(/^image\/(webp|png)$/);

      // İçerik satırları test2 havuzuna (panel kaydı olarak) gider.
      const ki = await o.anahtarUret("icerik", c);
      const ti = await o.arac(ki, "teslim_et", {
        tur: "yeni",
        ogeler: [
          {
            ad: "Test2 çiftleri",
            satirlar: [{ havuz: "sizma/ciftler", alanlar: { a: "pergel", b: "cetvel" } }],
          },
        ],
      });
      const icerikId = (ti.veri.ogeler as { ogeId: number }[])[0]?.ogeId ?? 0;
      await o.u.oyunAlani.bosalt();
      const test2Oyun = new OyunIstemcisi(t2Url, T2_TOKEN);
      const bul = async () =>
        (await test2Oyun.havuzlar())
          .find((h) => h.id === "sizma/ciftler")
          ?.kayitlar.find((x) => x.alanlar.a === "pergel");
      expect((await bul())?.acik).toBe(true);

      // Ret → test2'den kalkar.
      await o.api("POST", `/api/oge/${magazaId}/karar`, { karar: "ret", hazir: "tarz" }, c);
      await o.u.oyunAlani.bosalt();
      expect((await katman()).urunler).toEqual([]);
      expect((await fetch(`${t2Url}${adres}`)).status).toBe(404);

      // Gece sıfırlaması: veritabanı ve katman klasörü silinir, sunucu yeniden açılır → site içeriği yeniden yükler.
      await o.u.oyunAlani.esitle();
      const once = o.u.merkez.pano(o.saat.simdi, { kullanilan: 0, sinir: 1 }).test2?.katman;
      await kapat();
      rmSync(join(t2Dir, "glix.db"), { force: true });
      rmSync(join(t2Dir, "glix.db-wal"), { force: true });
      rmSync(join(t2Dir, "glix.db-shm"), { force: true });
      rmSync(join(t2Dir, "oyun-alani"), { recursive: true, force: true });
      await ac();
      expect(await bul()).toBeUndefined();
      await o.u.oyunAlani.esitle();
      const sonra = o.u.merkez.pano(o.saat.simdi, { kullanilan: 0, sinir: 1 }).test2;
      expect(sonra?.katman).not.toBe(once);
      expect(sonra?.sonSifirlama).not.toBeNull();
      expect((await bul())?.acik).toBe(true);
      expect(o.u.merkez.oge(icerikId)?.test2?.durum).toBe("yuklu");
      // Reddedilen mağaza ürünü geri gelmez.
      expect((await katman()).urunler).toEqual([]);
    } finally {
      await o.kapat();
    }
  });
});
