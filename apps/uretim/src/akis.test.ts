/**
 * Uçtan uca: anahtar üret → MCP ile yükle ve teslim et → ön kontrol → sahip onayı → entegrasyon paketi;
 * içerik havuzu için onay → tek tık aktarım sahte oyun ucuna gider → geri al.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ffmpegVar } from "./medya.js";
import { b64, gorsel, type Ortam, ortamKur } from "./test/ortam.js";
import { wavYaz } from "./wav.js";

const FFMPEG = await ffmpegVar();
let o: Ortam;
beforeEach(async () => {
  o = await ortamKur();
});
afterEach(async () => {
  await o.kapat();
});

type OgeSonucu = {
  ad: string;
  ogeId: number;
  sonuc: string;
  durum: string;
  satirlar: { kod: string; sonuc: string; mesaj: string }[];
};

describe("mağaza: teslim → ön kontrol → onay → paket", () => {
  it.skipIf(!FFMPEG)("bütün akış", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("magaza", c);
    const talimat = await o.arac(k, "talimat_oku");
    expect(String(talimat.veri.metin)).toContain("Mağaza alanı");
    const is = await o.api(
      "POST",
      "/api/alan/magaza/is",
      { baslik: "Neon gece koleksiyonu", aciklama: "6 ürün", adet: 6 },
      c,
    );
    const isId = (is.json.is as { id: number }).id;
    const isler = await o.arac(k, "isleri_listele");
    expect((isler.veri.isler as { id: number }[]).map((i) => i.id)).toContain(isId);

    const y1 = await o.arac(k, "dosya_yukle", {
      ad: "neon-cerceve.png",
      icerik_base64: b64(gorsel(384, 384)),
    });
    expect(y1.hata).toBe(false);
    const dolu = await o.arac(k, "dosya_yukle", {
      ad: "kotu.png",
      icerik_base64: b64(gorsel(384, 384, (x) => [x % 255, 10, 10, 255])),
    });
    const teslim = {
      isId,
      tur: "yeni",
      ogeler: [
        {
          ad: "Neon Gece Çerçevesi",
          aciklama: "Mor-camgöbeği çerçeve",
          gerekce: "Koleksiyonun ilk ürünü",
          dosyalar: [
            { dosyaId: y1.veri.dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/neon-gece.webp" },
          ],
          satirlar: [
            {
              id: "neon-gece",
              type: "cerceve",
              rarity: "nadir",
              price: 450,
              name: "Neon Gece",
              description: "Gece yarısı parıltısı.",
            },
          ],
          onizleme: { ekran: "magaza-kart" },
        },
        {
          ad: "Kötü Çerçeve",
          dosyalar: [
            { dosyaId: dolu.veri.dosyaId, hedefYol: "apps/client/public/assets/shop/cerceve/kotu.webp" },
          ],
        },
      ],
    };
    const on = await o.arac(k, "on_kontrol", teslim);
    const onOgeler = on.veri.ogeler as OgeSonucu[];
    expect(onOgeler[0]?.sonuc).not.toBe("kaldi");
    expect(onOgeler[1]?.sonuc).toBe("kaldi");
    expect(onOgeler[0]?.ogeId).toBeNull();
    expect(o.u.merkez.bekleyenler("magaza")).toHaveLength(0);

    const t = await o.arac(k, "teslim_et", teslim);
    const ogeler = t.veri.ogeler as OgeSonucu[];
    expect(ogeler[0]?.durum).toBe("bekliyor");
    expect(ogeler[1]?.durum).toBe("kaldi");
    // "Kaldı" sahibe gitmez, yapay zekâya döner.
    const kuyruk = await o.api("GET", "/api/kuyruk?alan=magaza", undefined, c);
    expect((kuyruk.json.ogeler as unknown[]).length).toBe(1);
    const gb = await o.arac(k, "geri_bildirim_oku");
    expect(JSON.stringify(gb.veri.notlar)).toMatch(/Ön kontrolden geçmedi/);

    const ogeId = ogeler[0]?.ogeId ?? 0;
    const ayr = await o.api("GET", `/api/oge/${ogeId}`, undefined, c);
    expect((ayr.json.oge as { gorunum: string }).gorunum).toBe("gorsel");
    const dosya = (ayr.json.oge as { dosyalar: { ozet: string }[] }).dosyalar[0];
    const img = await fetch(`${o.url}/api/oge/${ogeId}/dosya/${dosya?.ozet}`, { headers: { Cookie: c } });
    expect(img.headers.get("content-type")).toBe("image/png");
    expect(img.headers.get("content-security-policy")).toMatch(/sandbox/);

    // Not olmadan ret olmaz.
    expect((await o.api("POST", `/api/oge/${ogeId}/karar`, { karar: "ret" }, c)).durum).toBe(400);
    const onay = await o.api("POST", `/api/oge/${ogeId}/karar`, { karar: "onay" }, c);
    expect((onay.json.oge as { durum: string }).durum).toBe("havuzda");
    // Geri al (10 sn) ve yeniden onayla.
    o.saat.simdi += 3000;
    expect(
      ((await o.api("POST", `/api/oge/${ogeId}/geri-al`, {}, c)).json.oge as { durum: string }).durum,
    ).toBe("bekliyor");
    await o.api("POST", `/api/oge/${ogeId}/karar`, { karar: "onay" }, c);
    o.saat.simdi += 20_000;
    expect((await o.api("POST", `/api/oge/${ogeId}/geri-al`, {}, c)).durum).toBe(409);

    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect((pano.json.havuz as { paketlenecek: number }).paketlenecek).toBe(1);
    const p = await o.api("POST", "/api/paket", {}, c);
    expect(p.durum).toBe(200);
    const klasor = join(o.config.aktarimDir, (p.json.paket as { klasor: string }).klasor);
    expect((p.json.paket as { klasor: string }).klasor).toMatch(/^\d{8}-\d{4}$/);
    const ozet = JSON.parse(readFileSync(join(klasor, "ozet.json"), "utf8")) as {
      ogeler: { hedefYollar: string[] }[];
    };
    expect(ozet.ogeler[0]?.hedefYollar).toContain("apps/client/public/assets/shop/cerceve/neon-gece.webp");
    const webp = readFileSync(join(klasor, "dosyalar/apps/client/public/assets/shop/cerceve/neon-gece.webp"));
    expect(webp.toString("latin1", 8, 12)).toBe("WEBP");
    const yama = JSON.parse(
      readFileSync(join(klasor, "dosyalar/packages/engine/src/katalog/magaza.json.yama"), "utf8"),
    ) as { ekle: { id: string }[] };
    expect(yama.ekle[0]?.id).toBe("neon-gece");
    expect(o.u.merkez.oge(ogeId)?.durum).toBe("pakette");

    // Oyuna eklendi → sağlık ucu aynı revizyonu verince canlıda.
    const pid = (p.json.paket as { id: number }).id;
    await o.api("POST", `/api/paket/${pid}/oyuna-eklendi`, { revizyon: o.oyun.revizyon }, c);
    expect(o.u.merkez.oge(ogeId)?.durum).toBe("canlida");

    // Benzerini daha üret → yeni iş.
    const b = await o.api("POST", `/api/oge/${ogeId}/benzer`, { adet: 5, fark: "daha sıcak renkler" }, c);
    expect((b.json.is as { kaynak: string }).kaynak).toBe("benzer");
  });

  it("düzeltme istenen öğenin yeni sürümü gelir; eskisi arşive", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    const y = await o.arac(k, "dosya_yukle", { ad: "usta.png", icerik_base64: b64(gorsel(256, 256)) });
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Usta",
          dosyalar: [{ dosyaId: y.veri.dosyaId, hedefYol: "apps/client/public/assets/badges/usta.webp" }],
        },
      ],
    });
    const id1 = (t.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    await o.api(
      "POST",
      `/api/oge/${id1}/karar`,
      { karar: "duzeltme", hazir: "tarz", metin: "biraz daha koyu" },
      c,
    );
    const gb = await o.arac(k, "geri_bildirim_oku");
    expect(JSON.stringify(gb.veri)).toMatch(/Tarz uymuyor — biraz daha koyu/);
    const y2 = await o.arac(k, "dosya_yukle", {
      ad: "usta2.png",
      icerik_base64: b64(
        gorsel(256, 256, (x, yy) =>
          Math.hypot(x - 128, yy - 128) < 80 ? [20, 40, x % 255, 255] : [0, 0, 0, 0],
        ),
      ),
    });
    const t2 = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Usta",
          oncekiOge: id1,
          dosyalar: [{ dosyaId: y2.veri.dosyaId, hedefYol: "apps/client/public/assets/badges/usta.webp" }],
        },
      ],
    });
    const id2 = (t2.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    const o2 = o.u.merkez.oge(id2);
    expect(o2?.surum).toBe(2);
    expect(o2?.oncekiId).toBe(id1);
    expect(o.u.merkez.oge(id1)?.durum).toBe("arsiv");
    expect(o2?.surumler.map((s) => s.surum)).toEqual([2, 1]);
    const ars = await o.api("GET", "/api/arsiv?alan=rozet&ad=usta", undefined, c);
    expect(ars.json.toplam).toBe(2);
  });

  it("aynı hazır not 3 kez verilince talimata ekleme önerilir", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    for (let i = 0; i < 3; i++) {
      const y = await o.arac(k, "dosya_yukle", {
        ad: `r${i}.png`,
        icerik_base64: b64(gorsel(256 + i * 8, 256 + i * 8)),
      });
      const t = await o.arac(k, "teslim_et", {
        tur: "yeni",
        ogeler: [
          {
            ad: `Rozet ${i}`,
            dosyalar: [{ dosyaId: y.veri.dosyaId, hedefYol: `apps/client/public/assets/badges/r${i}.webp` }],
          },
        ],
      });
      await o.api(
        "POST",
        `/api/oge/${(t.veri.ogeler as OgeSonucu[])[0]?.ogeId}/karar`,
        { karar: "ret", hazir: "yazi" },
        c,
      );
    }
    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect(pano.json.talimatOnerileri).toEqual([{ alan: "rozet", hazir: "yazi", sayi: 3 }]);
    await o.api("POST", "/api/alan/rozet/talimat-oneri", { hazir: "yazi", ekle: true }, c);
    const t = await o.arac(k, "talimat_oku");
    expect(t.veri.surum).toBe(2);
    expect(String(t.veri.metin)).toMatch(/Yazı var/);
  });

  it("istek kartı sahip onayıyla istenen alana iş olur; kod isteği sahibe düşer", async () => {
    const c = await o.giris();
    const kM = await o.anahtarUret("magaza", c);
    const kS = await o.anahtarUret("ses", c);
    const kart = await o.arac(kM, "istek_karti_ac", {
      istenen_alan: "ses",
      ne: "Tepki paketi sesi",
      neden: "Yeni tepki paketi",
    });
    expect(((await o.arac(kS, "isleri_listele")).veri.isler as unknown[]).length).toBe(0);
    await o.api("POST", `/api/istek/${kart.veri.id}/karar`, { onay: true }, c);
    const isler = (await o.arac(kS, "isleri_listele")).veri.isler as { baslik: string; kaynak: string }[];
    expect(isler[0]).toMatchObject({ baslik: "Tepki paketi sesi", kaynak: "istek" });
    const kod = await o.arac(kM, "kod_istegi_ac", {
      baslik: "Sohbet balonu türü",
      gerekce: "Oyuncular istiyor",
      etki: "Yeni ürün türü",
    });
    expect(kod.hata).toBe(false);
    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect((pano.json.kodIstekleri as unknown[]).length).toBe(1);
    // Kendi alanına açılan kart = önerilen iş.
    const oneri = await o.arac(kM, "istek_karti_ac", {
      istenen_alan: "magaza",
      ne: "Satılmayan 5 ürünün fiyatı düşsün",
      neden: "30 günde 0 satış",
    });
    await o.api("POST", `/api/istek/${oneri.veri.id}/karar`, { onay: true }, c);
    expect(
      ((await o.arac(kM, "isleri_listele")).veri.isler as { kaynak: string }[]).some(
        (i) => i.kaynak === "yz",
      ),
    ).toBe(true);
  });
});

describe("içerik havuzu: tek tık aktarım", () => {
  it("onaylanan satırlar sahte oyun ucuna gider ve geri alınır", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const kat = await o.arac(k, "katalog_oku");
    expect(kat.veri.kaynak).toBe("canli");
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Mutfak çiftleri",
          gerekce: "Mutfak teması",
          satirlar: [
            { havuz: "sizma/ciftler", alanlar: { a: "tencere", b: "tava" } },
            { havuz: "sizma/ciftler", alanlar: { a: "kaşık", b: "çatal" } },
            { havuz: "sizma/ciftler", alanlar: { a: "bıçak", b: "makas" } },
          ],
        },
      ],
    });
    const og = (t.veri.ogeler as OgeSonucu[])[0];
    expect(og?.durum).toBe("bekliyor");
    const ayr = await o.api("GET", `/api/oge/${og?.ogeId}`, undefined, c);
    expect(ayr.json.tekTik).toBe(true);
    expect((ayr.json.oge as { gorunum: string }).gorunum).toBe("liste");
    await o.api("POST", `/api/oge/${og?.ogeId}/karar`, { karar: "onay", satirlar: [0, 2] }, c);
    const a = await o.api("POST", `/api/oge/${og?.ogeId}/aktar`, {}, c);
    expect(a.durum).toBe(200);
    const ekle = o.oyun.istekler.find((i) => i.yol === "/api/uretim/havuzlar/sizma%2Fciftler/ekle");
    expect(ekle?.yetki).toBe("Bearer oyun-gizli-anahtar");
    expect(ekle?.govde).toEqual({
      satirlar: [
        { a: "tencere", b: "tava" },
        { a: "bıçak", b: "makas" },
      ],
    });
    expect(o.u.merkez.oge(og?.ogeId ?? 0)?.durum).toBe("canlida");
    const aid = (a.json.aktarimlar as { id: number }[])[0]?.id;
    expect((await o.api("POST", `/api/aktarim/${aid}/geri-al`, {}, c)).durum).toBe(200);
    expect(o.oyun.istekler.some((i) => /\/api\/uretim\/aktarim\/ak\d+\/geri-al/.test(i.yol))).toBe(true);
    expect(o.u.merkez.oge(og?.ogeId ?? 0)?.durum).toBe("havuzda");
  });

  it("moderasyon kalıpları da tek tıkla gider", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("moderasyon", c);
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Rakamlı kalıplar", satirlar: [{ kalip: "s1kt1r", tur: "kufur", risk: "dusuk" }] }],
    });
    const id = (t.veri.ogeler as OgeSonucu[])[0]?.ogeId;
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
    expect((await o.api("POST", `/api/oge/${id}/aktar`, {}, c)).durum).toBe(200);
    expect(o.oyun.istekler.find((i) => i.yol === "/api/uretim/moderasyon/ekle")?.govde).toEqual({
      kaliplar: [{ kalip: "s1kt1r", tur: "kufur" }],
    });
  });

  it("CSV dosyasıyla satır teslimi", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const csv = "havuz,a,b\nsizma/ciftler,limon,portakal\nsizma/ciftler,kalem,silgi\n";
    const y = await o.arac(k, "dosya_yukle", {
      ad: "ciftler.csv",
      icerik_base64: Buffer.from(csv).toString("base64"),
    });
    const t = await o.arac(k, "on_kontrol", {
      tur: "yeni",
      ogeler: [{ ad: "CSV çiftler", dosyalar: [{ dosyaId: y.veri.dosyaId, rol: "satirlar" }] }],
    });
    expect((t.veri.ogeler as OgeSonucu[])[0]?.sonuc).toBe("gecti");
  });
});

describe("elle yükleme (UM-G4)", () => {
  it("sahip dosya bırakır, aynı sıradan geçer", async () => {
    const c = await o.giris();
    const wav = wavYaz(
      new Float32Array(48000).map((_, i) => Math.sin(i / 8) * 0.4),
      48000,
    );
    const r = await fetch(`${o.url}/api/yukle?alan=ses&ad=tokmak.wav`, {
      method: "POST",
      headers: {
        Cookie: c,
        Origin: "http://uretim.test",
        "X-Uretim": "1",
        "Content-Type": "application/octet-stream",
      },
      body: wav,
    });
    const y = (await r.json()) as { dosyaId: string };
    expect(r.status).toBe(200);
    const t = await o.api(
      "POST",
      "/api/elle-teslim",
      {
        alan: "ses",
        tur: "yeni",
        ogeler: [
          {
            ad: "Tokmak",
            dosyalar: [
              { dosyaId: y.dosyaId, hedefYol: "apps/client/public/assets/ses/kara-borsa/tokmak.ogg" },
            ],
          },
        ],
      },
      c,
    );
    expect(t.durum).toBe(200);
    const og = (t.json.ogeler as OgeSonucu[])[0];
    expect(o.u.merkez.oge(og?.ogeId ?? 0)?.kaynak).toBe("elle");
    expect(o.u.merkez.oge(og?.ogeId ?? 0)?.gorunum).toBe("ses");
    // Başka alana elle yüklenen dosya bu alanda kullanılamaz.
    const t2 = await o.api(
      "POST",
      "/api/elle-teslim",
      {
        alan: "muzik",
        tur: "yeni",
        ogeler: [
          {
            ad: "Tema",
            dosyalar: [{ dosyaId: y.dosyaId, hedefYol: "apps/client/public/assets/muzik/tema.ogg" }],
          },
        ],
      },
      c,
    );
    expect((t2.json.ogeler as OgeSonucu[])[0]?.sonuc).toBe("kaldi");
  });
});

describe("depo ve yedek", () => {
  it("aynı dosya tek kopya; reddedilen 90 gün sonra silinir, onaylanan kalır", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    const png = b64(gorsel(256, 256));
    const y1 = await o.arac(k, "dosya_yukle", { ad: "a.png", icerik_base64: png });
    const y2 = await o.arac(k, "dosya_yukle", { ad: "b.png", icerik_base64: png });
    expect(y1.veri.ozet).toBe(y2.veri.ozet);
    expect(Number((o.u.merkez.db.prepare("SELECT COUNT(*) AS n FROM dosya").get() as { n: number }).n)).toBe(
      1,
    );
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [
        {
          ad: "Silinecek",
          dosyalar: [{ dosyaId: y1.veri.dosyaId, hedefYol: "apps/client/public/assets/badges/s.webp" }],
        },
      ],
    });
    await o.api(
      "POST",
      `/api/oge/${(t.veri.ogeler as OgeSonucu[])[0]?.ogeId}/karar`,
      { karar: "ret", hazir: "kalitesiz" },
      c,
    );
    const yol = o.u.merkez.depo.yol(String(y1.veri.ozet));
    expect(existsSync(yol)).toBe(true);
    expect(await o.u.merkez.depo.temizle(o.saat.simdi + 30 * 86400_000)).toBe(0);
    expect(await o.u.merkez.depo.temizle(o.saat.simdi + 91 * 86400_000)).toBe(1);
    expect(existsSync(yol)).toBe(false);
  });
});
