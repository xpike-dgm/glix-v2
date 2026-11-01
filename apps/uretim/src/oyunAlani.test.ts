/**
 * Oyun alanı (test2) eşitlemesi (sözleşme bölüm 13): teslim → test2'ye kendiliğinden yükleme (sahte test2) → ret
 * geri alır → kabul havuzuna düşer (canlıya gitmez) → gece sıfırlamasından sonra yeniden yükleme.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Test2Bilgisi, Test2Durum } from "./ortak/oyunAlani.js";
import { OYUN_ALANI_SATIRI } from "./ortak/oyunAlani.js";
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
afterEach(async () => {
  await o.kapat();
});

type OgeSonucu = { ogeId: number; durum: string };

const CIFTLER = [
  { havuz: "sizma/ciftler", alanlar: { a: "tencere", b: "tava" } },
  { havuz: "sizma/ciftler", alanlar: { a: "kaşık", b: "çatal" } },
];

async function icerikTeslim(k: string, ad = "Mutfak çiftleri"): Promise<number> {
  const t = await o.arac(k, "teslim_et", {
    tur: "yeni",
    ogeler: [{ ad, gerekce: "Mutfak teması", satirlar: CIFTLER }],
  });
  const og = (t.veri.ogeler as OgeSonucu[])[0];
  expect(og?.durum).toBe("bekliyor");
  await o.u.oyunAlani.bosalt();
  return og?.ogeId ?? 0;
}

const test2Bilgisi = (id: number): Test2Bilgisi | null | undefined => o.u.merkez.oge(id)?.test2;
const canliYazmalari = (): string[] => o.oyun.istekler.filter((i) => i.yontem === "POST").map((i) => i.yol);

describe("oyun alanı (test2) eşitlemesi", () => {
  it("içerik: teslim test2'ye gider; ret geri alır; geri alınan ret yeniden yükler; kabul havuzda kalır", async () => {
    o = await ortamKur({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);

    const id = await icerikTeslim(k);
    const ekle = t2.istekler.find((i) => i.yol === "/api/uretim/havuzlar/sizma%2Fciftler/ekle");
    expect(ekle?.govde).toEqual({ satirlar: CIFTLER.map((s) => s.alanlar) });
    expect(t2.aktarimlar.size).toBe(1);
    expect(test2Bilgisi(id)).toMatchObject({ durum: "yuklu", baglanti: "https://test2.ornek/", hata: null });
    expect(test2Bilgisi(id)?.ozet).toMatch(/2 satır test2'ye yüklendi/);
    // İnceleme uçları da durumu taşır (teslim kartı ve kuyruk).
    const kuyruk = await o.api("GET", "/api/kuyruk?alan=icerik", undefined, c);
    expect((kuyruk.json.ogeler as { test2?: Test2Bilgisi }[])[0]?.test2?.durum).toBe("yuklu");
    // Canlıya hiçbir şey yazılmadı.
    expect(canliYazmalari()).toEqual([]);

    // Ret → test2'den geri alınır.
    const ret = await o.api("POST", `/api/oge/${id}/karar`, { karar: "ret", hazir: "tekrar" }, c);
    expect(ret.durum).toBe(200);
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(0);
    expect(test2Bilgisi(id)?.durum).toBe("geri_alindi");
    // Ret 10 sn içinde geri alınınca öğe yeniden bekliyor: test2'ye yeniden yüklenir.
    o.saat.simdi += 2000;
    expect((await o.api("POST", `/api/oge/${id}/geri-al`, {}, c)).durum).toBe(200);
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(1);
    expect(test2Bilgisi(id)?.durum).toBe("yuklu");

    // Kabul → kabul havuzu; test2'de yüklü kalır, canlıya gitmez.
    o.saat.simdi += 20_000;
    const kabul = await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
    expect((kabul.json.oge as { durum: string }).durum).toBe("havuzda");
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(1);
    expect(canliYazmalari()).toEqual([]);
    const havuz = await o.api("GET", "/api/kabul", undefined, c);
    const kabulde = (havuz.json.basamaklar as { kabulde: { id: number; test2?: Test2Bilgisi }[] }).kabulde;
    expect(kabulde.find((x) => x.id === id)?.test2?.durum).toBe("yuklu");
    // Yöneticiye giden paket içerik satırlarını taşır (icerik.json + ozet.json).
    expect((havuz.json as { paketlenecek: number }).paketlenecek).toBe(1);
    const p = await o.api("POST", "/api/paket", {}, c);
    expect(p.durum).toBe(200);
    const klasor = join(o.config.aktarimDir, (p.json.paket as { klasor: string }).klasor);
    const icerik = JSON.parse(readFileSync(join(klasor, "icerik.json"), "utf8")) as {
      havuzlar: { havuz: string; ekle: unknown[] }[];
    };
    expect(icerik.havuzlar).toEqual([
      { havuz: "sizma/ciftler", ekle: CIFTLER.map((s) => s.alanlar), kapat: [] },
    ]);
    const ozet = JSON.parse(readFileSync(join(klasor, "ozet.json"), "utf8")) as {
      ogeler: { ogeId: number; havuzSatirlari: Record<string, unknown[]> }[];
    };
    expect(ozet.ogeler[0]?.havuzSatirlari["sizma/ciftler"]).toHaveLength(2);
    // Pakette (yöneticide) de test2'de kalır.
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(1);
  });

  it("gece sıfırlaması algılanır: bekleyen ve kabuldeki öğeler yeniden yüklenir, reddedilen yüklenmez", async () => {
    o = await ortamKur({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    await o.u.oyunAlani.esitle();
    const bekleyen = await icerikTeslim(k, "Bekleyen çiftler");
    const kabulde = await icerikTeslim(k, "Kabuldeki çiftler");
    const reddedilen = await icerikTeslim(k, "Reddedilen çiftler");
    await o.api("POST", `/api/oge/${kabulde}/karar`, { karar: "onay" }, c);
    await o.api("POST", `/api/oge/${reddedilen}/karar`, { karar: "ret", hazir: "tekrar" }, c);
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(2);
    const once = (await o.api("GET", "/api/pano", undefined, c)).json.test2 as Test2Durum;
    expect(once).toMatchObject({ ayarli: true, calisiyor: true, katman: t2.katman, sonSifirlama: null });

    t2.sifirla();
    o.saat.simdi += 3600_000;
    await o.u.oyunAlani.esitle();
    expect(t2.aktarimlar.size).toBe(2);
    expect(test2Bilgisi(bekleyen)?.durum).toBe("yuklu");
    expect(test2Bilgisi(kabulde)?.durum).toBe("yuklu");
    expect(test2Bilgisi(reddedilen)?.durum).toBe("geri_alindi");
    const sonra = (await o.api("GET", "/api/pano", undefined, c)).json.test2 as Test2Durum;
    expect(sonra.katman).toBe(t2.katman);
    expect(sonra.sonSifirlama).toBe(o.saat.simdi);
    expect(sonra.revision).toBe("b".repeat(40));
    // Sıfırlamadan sonra ret: eski katmandaki aktarım uzakta aranmaz, yenisi geri alınır.
    await o.api("POST", `/api/oge/${bekleyen}/karar`, { karar: "ret", hazir: "tekrar" }, c);
    await o.u.oyunAlani.bosalt();
    expect(t2.aktarimlar.size).toBe(1);
  });

  it("test2'ye ulaşılamazsa hata yazılır, sonraki eşitlemede yüklenir; elle geri alınan kendiliğinden dönmez", async () => {
    o = await ortamKur({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    t2.kapali = true;
    const id = await icerikTeslim(k);
    expect(test2Bilgisi(id)?.durum).toBe("hata");
    expect(test2Bilgisi(id)?.hata).toMatch(/ulaşılamadı/);
    const p = (await o.api("GET", "/api/pano", undefined, c)).json.test2 as Test2Durum;
    expect(p.calisiyor).toBe(false);
    expect(p.sorun).toBeTruthy();
    t2.kapali = false;
    const e = await o.api("POST", "/api/test2/esitle", {}, c);
    expect((e.json.test2 as Test2Durum).calisiyor).toBe(true);
    expect(test2Bilgisi(id)?.durum).toBe("yuklu");

    // Sahibin "test2'den geri al"ı: öğe bekliyor kalır, test2'den kalkar ve eşitleme geri getirmez.
    const g = await o.api("POST", `/api/oge/${id}/test2-geri-al`, {}, c);
    expect((g.json.oge as { durum: string; test2: Test2Bilgisi }).test2.durum).toBe("geri_alindi");
    expect((g.json.oge as { durum: string }).durum).toBe("bekliyor");
    expect(t2.aktarimlar.size).toBe(0);
    await o.u.oyunAlani.esitle();
    expect(t2.aktarimlar.size).toBe(0);
    const y = await o.api("POST", `/api/oge/${id}/test2-yukle`, {}, c);
    expect((y.json.oge as { test2: Test2Bilgisi }).test2.durum).toBe("yuklu");
    expect(t2.aktarimlar.size).toBe(1);
  });

  it("mağaza: ürün satırı ve görseli taslak katmanına gider; ret kaldırır; bozuk ürün hata olarak görünür", async () => {
    o = await ortamKur({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const k = await o.anahtarUret("magaza", c);
    const y = await o.arac(k, "dosya_yukle", { ad: "neon.png", icerik_base64: b64(gorsel(384, 384)) });
    const urun = {
      id: "cerceve-neon-gece",
      type: "cerceve",
      rarity: "nadir",
      price: 450,
      name: "Neon Gece",
      description: "Gece yarısı parıltısı.",
      satista: true,
      efekt: { motor: "donen-halka", parametreler: { doku: "cerceve/neon-gece.webp", donusHizi: 12 } },
    };
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      uretimYontemi: "gorsel-model",
      ogeler: [
        {
          ad: "Neon Gece Çerçevesi",
          dosyalar: [
            { dosyaId: y.veri.dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/neon-gece.webp" },
          ],
          satirlar: [urun],
        },
      ],
    });
    const og = (t.veri.ogeler as OgeSonucu[])[0];
    expect(og?.durum).toBe("bekliyor");
    await o.u.oyunAlani.bosalt();
    const taslak = t2.taslaklar.get("cerceve-neon-gece");
    expect(taslak?.urun).toEqual(urun);
    expect(taslak?.dosyalar.map((d) => d.yol)).toEqual(["cerceve/neon-gece.webp"]);
    const veri = Buffer.from(taslak?.dosyalar[0]?.veri ?? "", "base64");
    // Paketteki gibi WebP (dönüştürücü yoksa PNG).
    expect(veri.toString("latin1", 8, 12) === "WEBP" || veri.toString("latin1", 1, 4) === "PNG").toBe(true);
    const bilgi = test2Bilgisi(og?.ogeId ?? 0);
    expect(bilgi).toMatchObject({ durum: "yuklu", baglanti: "https://test2.ornek/?ekran=magaza" });
    expect(bilgi?.ozet).toMatch(/TASLAK/);

    await o.api("POST", `/api/oge/${og?.ogeId}/karar`, { karar: "ret", hazir: "tarz" }, c);
    await o.u.oyunAlani.bosalt();
    expect(t2.taslaklar.size).toBe(0);
    expect(
      t2.istekler.some(
        (i) => i.yontem === "DELETE" && i.yol === "/api/uretim/magaza/taslak/cerceve-neon-gece",
      ),
    ).toBe(true);

    // test2 ürünü reddederse (oyunun kuralı) öğenin kartında hata ve neden görünür.
    const t3 = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Lakap",
          satirlar: [
            {
              id: "unvan-red",
              type: "unvan",
              rarity: "siradan",
              price: 150,
              name: "Taslakçı",
              description: "Deneme.",
              satista: true,
            },
          ],
        },
      ],
    });
    const og3 = (t3.veri.ogeler as OgeSonucu[])[0];
    expect(og3?.durum).toBe("bekliyor");
    await o.u.oyunAlani.bosalt();
    expect(test2Bilgisi(og3?.ogeId ?? 0)?.durum).toBe("hata");
    expect(test2Bilgisi(og3?.ogeId ?? 0)?.hata).toMatch(/Oyun alanı ürünü kabul etmedi: asset/);
  });

  it("istem ve talimat sabit satırı taşır (içerik ve mağaza); başka alanda yok", async () => {
    o = await ortamKur({ test2: true });
    const c = await o.giris();
    for (const alan of ["icerik", "magaza"] as const) {
      const ist = await o.api("GET", `/api/alan/${alan}/istem?baglanti=mcp`, undefined, c);
      expect(String((ist.json.istemler as { mcp: string; ssh: string }).mcp)).toContain(OYUN_ALANI_SATIRI);
      expect(String((ist.json.istemler as { mcp: string; ssh: string }).ssh)).toContain(OYUN_ALANI_SATIRI);
      const k = await o.anahtarUret(alan, c);
      expect(String((await o.arac(k, "talimat_oku")).veri.metin)).toContain(OYUN_ALANI_SATIRI);
      const sayfa = await o.api("GET", `/api/alan/${alan}`, undefined, c);
      expect((sayfa.json.test2 as Test2Durum).ayarli).toBe(true);
    }
    const ist = await o.api("GET", "/api/alan/rozet/istem?baglanti=mcp", undefined, c);
    expect(String((ist.json.istemler as { mcp: string }).mcp)).not.toContain(OYUN_ALANI_SATIRI);
    expect((await o.api("GET", "/api/alan/rozet", undefined, c)).json.test2).toBeUndefined();
  });

  it("test2 ayarlı değilse hiçbir istek gitmez; canlıya giden 'Oyuna aktar' aynen çalışır", async () => {
    o = await ortamKur();
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const id = await icerikTeslim(k);
    expect(test2Bilgisi(id)).toBeNull();
    const pano = (await o.api("GET", "/api/pano", undefined, c)).json.test2 as Test2Durum;
    expect(pano.ayarli).toBe(false);
    expect((await o.api("POST", "/api/test2/esitle", {}, c)).durum).toBe(503);
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
    expect((await o.api("POST", `/api/oge/${id}/aktar`, {}, c)).durum).toBe(200);
    expect(canliYazmalari()).toEqual(["/api/uretim/havuzlar/sizma%2Fciftler/ekle"]);
    expect(o.u.merkez.oge(id)?.durum).toBe("canlida");
  });
});
