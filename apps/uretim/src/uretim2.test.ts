/**
 * Üretim Merkezi 2, aşama 1: yapılandırılmış fikir ve rapor şemaları, fikrin yaşam döngüsü (fikir → onaylandı →
 * uygulanıyor → teslim edildi → kabul edildi → ana kodda), "Onaylananları uygula" işinin istemi ve is_oku'su, kabul
 * havuzu basamakları.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALAN_IDLERI, alanTanimi } from "./ortak/alanlar.js";
import type { FikirKarti } from "./ortak/fikir.js";
import { fikirAsamasi } from "./ortak/fikir.js";
import { FIKIR_RAPOR_BOLUMU, paketBicimi } from "./ortak/paketBicimi.js";
import { ORNEK_RAPOR, raporDogrula } from "./ortak/rapor.js";
import type { OgeOzeti } from "./ortak/tipler.js";
import { teslimAyristir } from "./teslimGirdisi.js";
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";

const fikir = (i: number, ek: Record<string, unknown> = {}) => ({
  ad: `Fikir ${i}`,
  ozet: `Kısa özet ${i}.`,
  kategori: i % 3 === 0 ? "Koleksiyon" : i % 3 === 1 ? "Ses" : "Oynanış",
  etki: (["dusuk", "orta", "yuksek"] as const)[i % 3],
  zahmet: (["kucuk", "orta", "buyuk"] as const)[(i + 1) % 3],
  gerekce: `Gerekçe ${i}`,
  ...ek,
});

describe("şemalar", () => {
  const magaza = alanTanimi("magaza");
  it("yapılandırılmış fikir geçer; eksik ya da yanlış alan açık hata verir; eski düz fikir de geçer", () => {
    const ok = teslimAyristir({ tur: "fikir", ogeler: [fikir(1)] }, magaza);
    expect(ok.ok).toBe(true);
    if (ok.ok)
      expect(ok.deger.ogeler[0]?.fikir).toEqual({
        ozet: "Kısa özet 1.",
        kategori: "Ses",
        etki: "orta",
        zahmet: "buyuk",
      });
    const kotu = teslimAyristir(
      { tur: "fikir", ogeler: [fikir(1, { etki: "cok", zahmet: undefined })] },
      magaza,
    );
    expect(kotu.ok ? [] : kotu.hatalar.join(" ")).toMatch(/etki.*dusuk, orta ya da yuksek.*zahmet/s);
    const yanlisTur = teslimAyristir({ tur: "yeni", ogeler: [fikir(1)] }, magaza);
    expect(yanlisTur.ok ? "" : yanlisTur.hatalar.join(" ")).toMatch(/yalnız fikir teslimlerinde/);
    const eski = teslimAyristir(
      { tur: "fikir", ogeler: [{ ad: "Eski fikir", aciklama: "Düz metin." }] },
      magaza,
    );
    expect(eski.ok && eski.deger.ogeler[0]?.fikir).toBeNull();
  });

  it("yapılandırılmış rapor sıkı doğrulanır; eski rapor biçimi olduğu gibi kabul edilir", () => {
    const test = alanTanimi("test");
    const ok = teslimAyristir({ tur: "rapor", ogeler: [{ ad: "Gece", rapor: ORNEK_RAPOR }] }, test);
    expect(ok.ok).toBe(true);
    const h: string[] = [];
    raporDogrula(
      {
        ozet: [{ ad: "x", deger: "çok" }],
        seriler: [{ ad: "s", tur: "pasta", etiketler: ["a"], degerler: [1] }],
        tablolar: [{ ad: "t", sutunlar: ["a", "b"], satirlar: [[1]] }],
        bulgular: [{ baslik: "b", onem: "acil" }],
        fazla: 1,
      },
      "1. öğe",
      h,
    );
    const metin = h.join(" | ");
    expect(metin).toMatch(/bilinmeyen alan "fazla"/);
    expect(metin).toMatch(/ozet\[0\]/);
    expect(metin).toMatch(/seriler\[0\]/);
    expect(metin).toMatch(/her satır 2 hücre/);
    expect(metin).toMatch(/kritik \| yuksek \| orta \| dusuk/);
    const uzunluk: string[] = [];
    raporDogrula(
      { seriler: [{ ad: "s", tur: "cizgi", etiketler: ["a", "b"], degerler: [1] }] },
      "x",
      uzunluk,
    );
    expect(uzunluk.join()).toMatch(/aynı uzunlukta/);
    const eski = teslimAyristir(
      { tur: "rapor", ogeler: [{ ad: "Eski", rapor: { geceTest: [{ oyun: "a", gecti: 1, kaldi: 0 }] } }] },
      test,
    );
    expect(eski.ok).toBe(true);
    expect(teslimAyristir({ tur: "rapor", ogeler: [{ ad: "Düz", aciklama: "Metin rapor" }] }, test).ok).toBe(
      true,
    );
  });

  it("paket_bicimi örnekleri (fikir ve rapor) her alanda şemaya uyar", () => {
    for (const a of ALAN_IDLERI) {
      const p = paketBicimi(a);
      for (const t of [p.ornekler.fikir, p.ornekler.rapor]) {
        const r = teslimAyristir(t, alanTanimi(a));
        expect(r.ok ? [] : r.hatalar, a).toEqual([]);
      }
    }
  });

  it("aşama türetme", () => {
    expect(fikirAsamasi("bekliyor", false, null)).toBe("fikir");
    expect(fikirAsamasi("onaylandi", false, null)).toBe("onaylandi");
    expect(fikirAsamasi("onaylandi", true, null)).toBe("uygulaniyor");
    expect(fikirAsamasi("onaylandi", true, "bekliyor")).toBe("teslim_edildi");
    expect(fikirAsamasi("onaylandi", true, "duzeltme_istendi")).toBe("uygulaniyor");
    expect(fikirAsamasi("onaylandi", true, "havuzda")).toBe("kabul_edildi");
    expect(fikirAsamasi("onaylandi", true, "pakette")).toBe("kabul_edildi");
    expect(fikirAsamasi("onaylandi", true, "oyuna_eklendi")).toBe("ana_kodda");
    expect(fikirAsamasi("onaylandi", true, "canlida")).toBe("canlida");
    expect(fikirAsamasi("reddedildi", false, null)).toBe("reddedildi");
  });
});

describe("fikir panosu ve 'Onaylananları uygula'", () => {
  let o: Ortam;
  beforeEach(async () => {
    o = await ortamKur();
  });
  afterEach(async () => {
    await o.kapat();
  });

  const pano = async (c: string): Promise<FikirKarti[]> =>
    (await o.api("GET", "/api/fikirler?alan=magaza", undefined, c)).json.fikirler as FikirKarti[];

  it("30 fikir → toplu onay/ret → uygula işi → teslim (fikirId) → kabul → ana kodda", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("magaza", c);
    // "30 fikir ver" işi (fikir turu değil): 3 fikir sınırı ve seçim kuralı uygulanmaz.
    const is = await o.api(
      "POST",
      "/api/alan/magaza/is",
      { baslik: "30 fikir ver", aciklama: "Koleksiyon fikirleri" },
      c,
    );
    const fikirIsi = (is.json.is as { id: number }).id;
    const t = await o.arac(k, "teslim_et", {
      tur: "fikir",
      isId: fikirIsi,
      ogeler: Array.from({ length: 30 }, (_, i) => fikir(i)),
    });
    expect(t.hata).toBe(false);
    let f = await pano(c);
    expect(f).toHaveLength(30);
    expect(f.every((x) => x.asama === "fikir" && x.yapili)).toBe(true);
    const id = (ad: string): number => f.find((x) => x.baslik === ad)?.id ?? 0;

    // Toplu onay (3) ve not zorunlu toplu ret (1).
    const onay = await o.api(
      "POST",
      "/api/fikir/toplu",
      { idler: [id("Fikir 1"), id("Fikir 2"), id("Fikir 3")], karar: "onay" },
      c,
    );
    expect((onay.json.sonuc as { ok: boolean }[]).every((x) => x.ok)).toBe(true);
    expect((await o.api("POST", "/api/fikir/toplu", { idler: [id("Fikir 4")], karar: "ret" }, c)).durum).toBe(
      400,
    );
    await o.api("POST", "/api/fikir/toplu", { idler: [id("Fikir 4")], karar: "ret", metin: "Zaten var" }, c);
    // Kart notu ("şöyle olsun").
    await o.api("POST", `/api/oge/${id("Fikir 2")}/not`, { metin: "Mor tonlarda olsun" }, c);
    f = await pano(c);
    const asama = (ad: string) => f.find((x) => x.baslik === ad)?.asama;
    expect([asama("Fikir 1"), asama("Fikir 2"), asama("Fikir 4"), asama("Fikir 5")]).toEqual([
      "onaylandi",
      "onaylandi",
      "reddedildi",
      "fikir",
    ]);
    // Bir fikri onaylamak kardeşlerini arşive atmaz.
    expect(f.filter((x) => x.asama === "fikir")).toHaveLength(26);

    // İş isterken seçilen fikirler taslağa (kodla) girer.
    const taslak = await o.api(
      "POST",
      "/api/istek-yaz",
      {
        metin: "Onaylananları uygula",
        alan: "magaza",
        baglanti: "mcp",
        fikirler: [id("Fikir 1"), id("Fikir 2")],
      },
      c,
    );
    const tk = taslak.json.taslak as { aciklama: string; kisitlar: string[]; adet: number };
    expect(tk.aciklama).toMatch(/## Uygulanacak fikirler/);
    expect(tk.aciklama).toContain(`#${id("Fikir 2")} Fikir 2: Kısa özet 2. (sahip notu: Mor tonlarda olsun)`);
    expect(tk.kisitlar[0]).toMatch(/fikirId/);
    // Onaylanmamış fikirle iş açılamaz.
    expect(
      (
        await o.api(
          "POST",
          "/api/alan/magaza/is",
          { baslik: "Uygula", aciklama: "x", fikirler: [id("Fikir 5")] },
          c,
        )
      ).durum,
    ).toBe(400);
    const uyg = await o.api(
      "POST",
      "/api/alan/magaza/is",
      {
        baslik: "Onaylananları uygula",
        aciklama: tk.aciklama,
        kisitlar: tk.kisitlar,
        fikirler: [id("Fikir 1"), id("Fikir 2")],
      },
      c,
    );
    const isId = (uyg.json.is as { id: number }).id;
    f = await pano(c);
    expect(asama("Fikir 1")).toBe("uygulaniyor");
    expect(asama("Fikir 3")).toBe("onaylandi");

    // Kopyalanan istem fikirleri (kimlik + başlık + özet + not) içerir.
    const istem = await o.api("GET", `/api/alan/magaza/istem?is=${isId}`, undefined, c);
    const metin = String((istem.json.istemler as { mcp: string }).mcp);
    expect(metin).toContain(`#${id("Fikir 1")} «Fikir 1 — Kısa özet 1.»`);
    expect(metin).toMatch(/not: Mor tonlarda olsun/);
    expect(metin).toMatch(/fikirId/);
    // is_oku fikirleri döndürür.
    const oku = await o.arac(k, "is_oku", { id: isId });
    const ff = oku.veri.fikirler as { fikirId: number; baslik: string; not: string }[];
    expect(ff.map((x) => x.fikirId)).toEqual([id("Fikir 1"), id("Fikir 2")]);
    expect(ff[1]?.not).toBe("Mor tonlarda olsun");

    // Teslim: her öğe fikirId taşır; onaylanmamış fikre bağlanan öğe kalır.
    const y = await o.arac(k, "dosya_yukle", { ad: "mor.png", icerik_base64: b64(gorsel(384, 384)) });
    const kotu = await o.arac(k, "on_kontrol", {
      tur: "yeni",
      isId,
      ogeler: [{ ad: "Yanlış", fikirId: id("Fikir 5"), dosyalar: [] }],
    });
    expect(JSON.stringify(kotu.veri)).toMatch(/onaylanmamış/);
    const ts = await o.arac(k, "teslim_et", {
      tur: "yeni",
      isId,
      uretimYontemi: "gorsel-model",
      ogeler: [
        {
          ad: "Mor çerçeve",
          fikirId: id("Fikir 2"),
          dosyalar: [
            { dosyaId: y.veri.dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/mor.webp" },
          ],
        },
      ],
    });
    const ogeId = (ts.veri.ogeler as { ogeId: number }[])[0]?.ogeId ?? 0;
    f = await pano(c);
    expect(asama("Fikir 2")).toBe("teslim_edildi");
    expect(f.find((x) => x.baslik === "Fikir 2")?.uygulamaOge).toBe(ogeId);
    await o.api("POST", `/api/oge/${ogeId}/karar`, { karar: "onay" }, c);
    f = await pano(c);
    expect(asama("Fikir 2")).toBe("kabul_edildi");

    // Kabul havuzu: kabulde → yöneticiye gönder → yöneticide → ana kodda → test'te.
    const kabul = async () =>
      (await o.api("GET", "/api/kabul", undefined, c)).json as {
        sayilar: Record<string, number>;
        basamaklar: Record<string, OgeOzeti[]>;
      };
    expect((await kabul()).basamaklar.kabulde?.map((x) => x.id)).toEqual([ogeId]);
    const p = await o.api("POST", "/api/paket", {}, c);
    const paketId = (p.json.paket as { id: number }).id;
    expect((await kabul()).sayilar.yoneticide).toBe(1);
    f = await pano(c);
    expect(asama("Fikir 2")).toBe("kabul_edildi");
    await o.api("POST", `/api/paket/${paketId}/oyuna-eklendi`, { revizyon: "abcdef1" }, c);
    expect((await kabul()).sayilar.ana_kodda).toBe(1);
    f = await pano(c);
    expect(asama("Fikir 2")).toBe("ana_kodda");
    await o.api("POST", `/api/paket/${paketId}/testte`, {}, c);
    const son = await kabul();
    expect([son.sayilar.ana_kodda, son.sayilar.testte]).toEqual([0, 1]);
    expect((await o.api("POST", `/api/paket/${paketId}/testte`, {}, c)).durum).toBe(409);
  });

  it("talimatta fikir ve rapor biçimi sabit; teslim_et şeması yeni alanları tanır", async () => {
    const c = await o.giris();
    await o.api(
      "POST",
      "/api/alan/test/talimat",
      { metin: "# Test\nYalnız rapor yaz, başka bir şey yazma." },
      c,
    );
    const k = await o.anahtarUret("test", c);
    expect(String((await o.arac(k, "talimat_oku")).veri.metin)).toContain(FIKIR_RAPOR_BOLUMU.trim());
    const liste = await o.mcp(k, "tools/list");
    const teslim = (
      liste.json.result as { tools: { name: string; inputSchema: Record<string, unknown> }[] }
    ).tools.find((t) => t.name === "teslim_et");
    const s = JSON.stringify(teslim?.inputSchema);
    for (const x of ["ozet", "kategori", "etki", "zahmet", "fikirId", "seriler", "bulgular", "tablolar"])
      expect(s).toContain(x);
    const r = await o.arac(k, "on_kontrol", { tur: "rapor", ogeler: [{ ad: "Gece", rapor: ORNEK_RAPOR }] });
    expect((r.veri.ogeler as { sonuc: string }[])[0]?.sonuc).not.toBe("kaldi");
    const raporlar = await o.api("GET", "/api/raporlar?alan=test", undefined, c);
    expect(raporlar.json.raporlar).toEqual([]);
    await o.arac(k, "teslim_et", { tur: "rapor", ogeler: [{ ad: "Gece", rapor: ORNEK_RAPOR }] });
    const r2 = (await o.api("GET", "/api/raporlar?alan=test", undefined, c)).json.raporlar as {
      rapor: unknown;
    }[];
    expect(r2[0]?.rapor).toEqual(ORNEK_RAPOR);
  });
});
