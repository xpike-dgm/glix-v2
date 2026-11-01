/**
 * Test ve Performans bot koşuları ve oyun alanı araçları (kosu.ts, kosuRaporu.ts; sözleşme bölüm 14): koşu MCP ile
 * başlar, aynı anda tek koşu, bitince geçerli rapor teslim edilir (bulgular kendiliğinden), iptal, dönemli plan,
 * oyun alanı odaları (alan sınırı ve sahiplik), SSH komut ayrıştırma.
 */
import { afterEach, describe, expect, it } from "vitest";
import { komutAyristir } from "./cli/uretim.js";
import { kosuOlcumuOku, kosuRaporu } from "./kosuRaporu.js";
import { raporDogrula, type YapiliRapor } from "./ortak/rapor.js";
import { type Ortam, ornekKosuSonucu, ortamKur } from "./test/ortam.js";

let o: Ortam | null = null;
afterEach(async () => {
  await o?.kapat();
  o = null;
});

async function yeniOrtam(ek?: Parameters<typeof ortamKur>[0]): Promise<Ortam> {
  const x = await ortamKur(ek);
  o = x;
  return x;
}

const adlar = async (x: Ortam, k: string): Promise<string[]> =>
  ((await x.mcp(k, "tools/list")).json.result as { tools: { name: string }[] }).tools.map((t) => t.name);

describe("koşu raporu", () => {
  it("ham ölçüm rapor panosu biçiminde geçerli; takılma, çökme, eşik ve red bulguya döner", () => {
    const olcum = kosuOlcumuOku(ornekKosuSonucu("k1"));
    if (!olcum) throw new Error("ölçüm");
    const r = kosuRaporu(olcum, (id) => (id === "butona-bas" ? "Butona Bas" : id));
    const hatalar: string[] = [];
    expect(raporDogrula(r, "rapor", hatalar)).not.toBeNull();
    expect(hatalar).toEqual([]);
    const kutu = (ad: string) => r.ozet.find((x) => x.ad === ad)?.deger;
    expect([kutu("Maç"), kutu("Biten maç"), kutu("Takılan maç"), kutu("Çöken maç")]).toEqual([4, 2, 1, 1]);
    const b = r.bulgular.map((x) => `${x.onem}:${x.baslik}`);
    expect(b.some((x) => /^yuksek:kor-kronometre 3 oyuncuyla sonuç aşamasında takıldı/.test(x))).toBe(true);
    expect(b.some((x) => /^kritik:kor-kronometre oyunu hata verdi \(tick\)/.test(x))).toBe(true);
    expect(b.some((x) => /^orta:Sunucu tick p95 eşiği aştı \(64 ms/.test(x))).toBe(true);
    expect(b.some((x) => /^dusuk:Butona Bas: bot eylemlerinin %33'i reddedildi/.test(x))).toBe(true);
    expect(r.seriler.map((s) => s.ad)).toContain("Sunucu tick p95");
    expect(r.tablolar.find((t) => t.ad === "Skor dağılımı (biten maçlar)")?.satirlar[0]).toEqual([
      "Butona Bas",
      3,
      2,
      6.5,
      1.5,
      5,
      50,
    ]);
    // Bozuk yanıt reddedilir.
    expect(kosuOlcumuOku({ id: 1 })).toBeNull();
  });
});

describe("bot koşusu (site)", () => {
  it("MCP: yalnız Test alanında; aynı anda tek koşu; bitince rapor teslim edilir ve raporlar kartı koşuyu taşır", async () => {
    const o = await yeniOrtam({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const kt = await o.anahtarUret("test", c);
    const km = await o.anahtarUret("magaza", c);
    expect(await adlar(o, kt)).toEqual(expect.arrayContaining(["test_kosusu_baslat", "oyun_alani_oda_ac"]));
    expect(await adlar(o, km)).toContain("oyun_alani_oda_ac");
    expect(await adlar(o, km)).not.toContain("test_kosusu_baslat");
    // Başka alanda araç yoktur (MCP "bilinmeyen araç" hatası).
    const yok = await o.mcp(km, "tools/call", {
      name: "test_kosusu_baslat",
      arguments: { oyunlar: ["butona-bas"] },
    });
    expect(yok.json.error).toBeDefined();

    const istek = { oyunlar: ["butona-bas", "kor-kronometre"], oyuncular: [3], mac: 2 };
    expect((await o.arac(kt, "test_kosusu_baslat", { oyunlar: ["yok-oyun"] })).veri.mesaj).toMatch(
      /Bilinmeyen oyun/,
    );
    const b = await o.arac(kt, "test_kosusu_baslat", istek);
    expect(b.hata).toBe(false);
    const kosu = b.veri.kosu as { id: number; oyunId: string; durum: string };
    expect(kosu.durum).toBe("suruyor");
    expect(t2.istekler.find((x) => x.yol === "/api/uretim/kosu")?.govde).toMatchObject({
      ...istek,
      strateji: "oyna",
    });
    // İkinci koşu reddedilir (site denetler).
    expect((await o.arac(kt, "test_kosusu_baslat", istek)).veri.mesaj).toMatch(/zaten sürüyor/);

    // Sunucu koşuyu bitirir → durum aracı eşitler → rapor Test alanına teslim edilir.
    t2.kosuBitir(kosu.oyunId);
    const d = await o.arac(kt, "test_kosusu_durum", { id: kosu.id });
    const son = d.veri.kosu as { durum: string; ogeId: number; ozet: { mac: number; takilan: number } };
    expect(son.durum).toBe("bitti");
    expect(son.ozet).toMatchObject({ mac: 4, takilan: 1 });
    const oge = o.u.merkez.oge(son.ogeId);
    expect(oge).toMatchObject({ alan: "test", tur: "rapor", durum: "bekliyor", gorunum: "rapor" });
    const rapor = oge?.rapor as YapiliRapor;
    expect(rapor.bulgular.length).toBeGreaterThanOrEqual(3);
    expect(String(rapor.baslik)).toMatch(/^Bot koşusu/);
    // Raporlar sayfası kartı: "Bot koşusu" ve koşu ayrıntısı.
    const rl = await o.api("GET", "/api/raporlar?alan=test", undefined, c);
    const kart = (rl.json.raporlar as { id: number; kosu?: { istek: { oyunlar: string[] } } }[])[0];
    expect(kart?.id).toBe(son.ogeId);
    expect(kart?.kosu?.istek.oyunlar).toEqual(istek.oyunlar);
    // Koşu bitti: yenisi başlayabilir; sahip arayüzünden başlatır ve iptal eder.
    const s = await o.api("POST", "/api/kosu", { oyunlar: ["butona-bas"], oyuncular: [2] }, c);
    expect(s.durum).toBe(200);
    const id2 = (s.json.kosu as { id: number }).id;
    const ip = await o.api("POST", `/api/kosu/${id2}/iptal`, {}, c);
    expect((ip.json.kosu as { durum: string }).durum).toBe("iptal");
    const liste = await o.api("GET", "/api/kosu", undefined, c);
    expect((liste.json.kosular as { id: number; durum: string }[]).map((x) => x.durum)).toEqual([
      "iptal",
      "bitti",
    ]);
  });

  it("dönemli plan: aralık dolunca kendiliğinden başlar, süren koşu varken başlamaz", async () => {
    const o = await yeniOrtam({ test2: true });
    const t2 = o.test2;
    if (!t2) throw new Error("test2");
    const c = await o.giris();
    const ks = o.u.merkez.kosular;
    if (!ks) throw new Error("kosular");
    expect(await ks.planDenetle()).toBeNull();
    const p = await o.api(
      "POST",
      "/api/kosu/plan",
      { acik: true, aralikSaat: 12, istek: { oyunlar: ["butona-bas"], oyuncular: [3, 5], mac: 1 } },
      c,
    );
    expect(p.durum).toBe(200);
    expect((await o.api("POST", "/api/kosu/plan", { acik: true, aralikSaat: 7, istek: {} }, c)).durum).toBe(
      400,
    );
    const ilk = await ks.planDenetle();
    expect(ilk?.baslatan).toBe("plan");
    o.saat.simdi += 13 * 3600_000;
    // Süren koşu varken plan bekler.
    expect(await ks.planDenetle()).toBeNull();
    t2.kosuBitir(ilk?.oyunId ?? "");
    await ks.esitle();
    // Aralık çoktan doldu: koşu biter bitmez sıradaki başlar.
    const ikinci = await ks.planDenetle();
    expect(ikinci?.baslatan).toBe("plan");
    expect(ks.liste().length).toBe(2);
    expect(ks.liste()[1]?.ogeId).not.toBeNull();
    t2.kosuBitir(ikinci?.oyunId ?? "");
    await ks.esitle();
    // Yeni aralık dolmadan başlamaz.
    o.saat.simdi += 3600_000;
    expect(await ks.planDenetle()).toBeNull();
    o.saat.simdi += 12 * 3600_000;
    expect((await ks.planDenetle())?.baslatan).toBe("plan");
  });

  it("oyun alanı odaları: aç, durum, kayıt, kapat; alan sınırı ve sahiplik", async () => {
    const o = await yeniOrtam({ test2: true });
    const c = await o.giris();
    const km = await o.anahtarUret("magaza", c);
    const ki = await o.anahtarUret("icerik", c);
    const a = await o.arac(km, "oyun_alani_oda_ac", { oyun: "butona-bas", bot: 4 });
    expect(a.hata).toBe(false);
    const kod = String(a.veri.kod);
    const d = await o.arac(km, "oyun_alani_durum", { kod });
    expect((d.veri.olaylar as unknown[]).length).toBe(30);
    expect((d.veri.oyuncular as unknown[]).length).toBe(4);
    expect(((await o.arac(km, "oyun_alani_kayit", { kod })).veri.olaylar as unknown[]).length).toBe(40);
    // Başka alan bu odayı göremez.
    expect((await o.arac(ki, "oyun_alani_durum", { kod })).veri.mesaj).toMatch(/senin alanının/);
    await o.arac(km, "oyun_alani_oda_ac", { oyun: "butona-bas" });
    expect((await o.arac(km, "oyun_alani_oda_ac", { oyun: "butona-bas" })).veri.mesaj).toMatch(/en çok 2/);
    expect((await o.arac(km, "oyun_alani_kapat", { kod })).hata).toBe(false);
    expect(o.test2?.odalar.has(kod)).toBe(false);
    expect((await o.arac(km, "oyun_alani_oda_ac", { oyun: "butona-bas" })).hata).toBe(false);
  });

  it("test2 yoksa araçlar kibarca reddeder; SSH komutları ayrışır", async () => {
    const o = await yeniOrtam();
    const c = await o.giris();
    const kt = await o.anahtarUret("test", c);
    expect((await o.arac(kt, "test_kosusu_baslat", { oyunlar: ["butona-bas"] })).veri.mesaj).toMatch(
      /ayarlı değil/,
    );
    expect((await o.api("POST", "/api/kosu", { oyunlar: ["butona-bas"] }, c)).durum).toBe(503);
    expect(komutAyristir("uretim oyun-alani-oda-ac butona-bas 3 rastgele")).toEqual({
      komut: "oyun-alani-oda-ac",
      args: ["butona-bas", "3", "rastgele"],
    });
    expect(komutAyristir("test-kosusu-durum 4").komut).toBe("test-kosusu-durum");
  });
});
