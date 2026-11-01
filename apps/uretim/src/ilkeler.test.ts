/** Sistem ilkeleri: fikir turu (UM-F2), zevk profili (F3), kademeli güven (F4), sel önleme (F5), köken (F7), F10. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur();
});
afterEach(async () => {
  await o.kapat();
});

type OgeSonucu = { ogeId: number; durum: string; sonuc: string };
const satirlar = (n: number, onek: string) =>
  Array.from({ length: n }, (_, i) => ({
    havuz: "sizma/ciftler",
    alanlar: { a: `${onek}${"abcdefghij"[i % 10]}ka`, b: `${onek}${"abcdefghij"[i % 10]}to` },
  }));

describe("UM-F2 fikir turu", () => {
  it("önce metin fikirler, sahip seçer, sonra tek üretim", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const is = await o.api(
      "POST",
      "/api/alan/icerik/is",
      { baslik: "Okul çiftleri", aciklama: "okul teması", fikirTuru: true },
      c,
    );
    const isId = (is.json.is as { id: number }).id;
    // Fikir seçilmeden üretim reddedilir.
    const erken = await o.arac(k, "teslim_et", {
      isId,
      tur: "yeni",
      ogeler: [{ ad: "Çiftler", satirlar: satirlar(1, "ok") }],
    });
    expect(erken.hata).toBe(true);
    expect(String(erken.veri.mesaj)).toMatch(/fikir turuyla/);
    // Fikirde dosya/satır olmaz.
    const kotu = await o.arac(k, "teslim_et", {
      isId,
      tur: "fikir",
      ogeler: [{ ad: "X", aciklama: "Kısa", satirlar: satirlar(1, "a") }],
    });
    expect((kotu.veri.ogeler as OgeSonucu[])[0]?.sonuc).toBe("kaldi");
    const f = await o.arac(k, "teslim_et", {
      isId,
      tur: "fikir",
      ogeler: [
        {
          ad: "Sınıf eşyaları",
          aciklama: "Kalem-silgi gibi sınıfta yan yana duran eşyalar",
          gorunus: "Sade",
          gerekce: "Herkes bilir",
        },
        { ad: "Teneffüs", aciklama: "Teneffüste oynanan oyunlardan ikililer", gerekce: "Eğlenceli" },
      ],
    });
    const [f1, f2] = f.veri.ogeler as OgeSonucu[];
    expect(f1?.durum).toBe("bekliyor");
    expect(o.u.merkez.oge(f1?.ogeId ?? 0)?.gorunum).toBe("fikir");
    const fl = await o.api("GET", `/api/is/${isId}/fikirler`, undefined, c);
    expect((fl.json.ogeler as unknown[]).length).toBe(2);
    expect(
      (await o.api("POST", `/api/oge/${f1?.ogeId}/fikir-sec`, { not: "mutfak eşyalarını da kat" }, c)).durum,
    ).toBe(200);
    expect(o.u.merkez.oge(f2?.ogeId ?? 0)?.durum).toBe("arsiv");
    const isler = (await o.arac(k, "isleri_listele")).veri.isler as {
      id: number;
      secilenFikir: { ad: string; not: string } | null;
    }[];
    expect(isler.find((i) => i.id === isId)?.secilenFikir).toMatchObject({
      ad: "Sınıf eşyaları",
      not: "mutfak eşyalarını da kat",
    });
    // Yeni fikir artık reddedilir; tek üretim kabul, ikinci üretim reddedilir.
    expect(
      (
        await o.arac(k, "teslim_et", {
          isId,
          tur: "fikir",
          ogeler: [{ ad: "Yeni", aciklama: "bir fikir daha burada" }],
        })
      ).hata,
    ).toBe(true);
    const u1 = await o.arac(k, "teslim_et", {
      isId,
      tur: "yeni",
      ogeler: [{ ad: "Sınıf çiftleri", satirlar: satirlar(2, "sn") }],
    });
    expect(u1.hata).toBe(false);
    const u2 = await o.arac(k, "teslim_et", {
      isId,
      tur: "yeni",
      ogeler: [{ ad: "Daha fazla", satirlar: satirlar(2, "dh") }],
    });
    expect(u2.hata).toBe(true);
    // Düzeltme serbest.
    const id = (u1.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "duzeltme", metin: "daha kolay kelimeler" }, c);
    expect(
      (
        await o.arac(k, "teslim_et", {
          isId,
          tur: "yeni",
          ogeler: [{ ad: "Sınıf çiftleri", oncekiOge: id, satirlar: satirlar(2, "ko") }],
        })
      ).hata,
    ).toBe(false);
  });

  it("görsel varyant en çok 2", async () => {
    const c = await o.giris();
    expect((await o.api("POST", "/api/alan/magaza/is", { baslik: "Efsanevi", varyant: 3 }, c)).durum).toBe(
      400,
    );
    expect((await o.api("POST", "/api/alan/magaza/is", { baslik: "Efsanevi", varyant: 2 }, c)).durum).toBe(
      200,
    );
  });
});

describe("UM-F5 sel önleme ve kullanım sayacı", () => {
  it("kuyruk boşken tavandan büyük tek paket kabul edilir; sonraki paket reddedilir", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    await o.api(
      "POST",
      "/api/alan/icerik/sinirlar",
      { bekleyenTavan: 2, gunlukKota: 100, haftalikUst: null },
      c,
    );
    const buyuk = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: ["a", "b", "c"].map((h) => ({ ad: `Büyük ${h}`, satirlar: satirlar(1, `b${h}`) })),
    });
    expect(buyuk.hata).toBe(false);
    const sonraki = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Sonraki", satirlar: satirlar(1, "sn") }],
    });
    expect(sonraki.hata).toBe(true);
    expect(String(sonraki.veri.mesaj)).toMatch(/Kuyruk dolu/);
  });

  it("kuyruk tavanı dolunca teslim reddedilir; sahip tavanı ayarlar", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    await o.api(
      "POST",
      "/api/alan/icerik/sinirlar",
      { bekleyenTavan: 2, gunlukKota: 100, haftalikUst: null },
      c,
    );
    for (let i = 0; i < 2; i++)
      expect(
        (
          await o.arac(k, "teslim_et", {
            tur: "yeni",
            ogeler: [{ ad: `Paket ${i}`, satirlar: satirlar(1, `p${"xy"[i]}`) }],
          })
        ).hata,
      ).toBe(false);
    const dolu = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Fazla", satirlar: satirlar(1, "fz") }],
    });
    expect(dolu.hata).toBe(true);
    expect(String(dolu.veri.mesaj)).toMatch(/Kuyruk dolu/);
    // İş önerisi hâlâ açılabilir.
    expect(
      (
        await o.arac(k, "istek_karti_ac", {
          istenen_alan: "icerik",
          ne: "Tema paketi",
          neden: "Okul açılıyor",
        })
      ).hata,
    ).toBe(false);
    await o.api(
      "POST",
      "/api/alan/icerik/sinirlar",
      { bekleyenTavan: 30, gunlukKota: 3, haftalikUst: null },
      c,
    );
    expect(
      (await o.arac(k, "teslim_et", { tur: "yeni", ogeler: [{ ad: "Kota", satirlar: satirlar(1, "kt") }] }))
        .hata,
    ).toBe(false);
    expect(
      String(
        (
          await o.arac(k, "teslim_et", {
            tur: "yeni",
            ogeler: [{ ad: "Kota2", satirlar: satirlar(1, "ku") }],
          })
        ).veri.mesaj,
      ),
    ).toMatch(/Günlük/);
    const sayfa = await o.api("GET", "/api/alan/icerik", undefined, c);
    expect(sayfa.json.sinir).toMatchObject({ bekleyenTavan: 30, gunlukKota: 3, bugun: 3, hafta: 3 });
  });
});

describe("UM-F4 kademeli güven", () => {
  const gecmisKur = (alan: string, onayli: number, toplam: number): void => {
    const db = o.u.merkez.db;
    db.prepare(
      "INSERT INTO teslim (id, alan, tur, kaynak, olusturma) VALUES (9999, ?, 'yeni', 'mcp', 1)",
    ).run(alan);
    const ins = db.prepare(
      "INSERT INTO oge (teslim_id, alan, tur, ad, anahtar, aciklama, gerekce, durum, gorunum, surum, kaynak, dosyalar, satirlar, degisiklikler, kaldirilacaklar, kontrol, sonuc, olusturma, karar, guncelleme) VALUES (9999, ?, 'yeni', ?, ?, '', '', ?, 'liste', 1, 'mcp', '[]', '[]', '[]', '[]', '{}', 'gecti', 1, ?, 1)",
    );
    for (let i = 0; i < toplam; i++)
      ins.run(alan, `g${i}`, `g${i}`, i < onayli ? "havuzda" : "reddedildi", o.saat.simdi - 1000 - i);
  };

  it("varsayılan kapalı; koşul tutmazsa açılamaz; asla-otomatik listesi açılamaz", async () => {
    const c = await o.giris();
    const s = await o.api("GET", "/api/alan/magaza", undefined, c);
    const guven = s.json.guven as { tur: string; acik: boolean; engel: string | null }[];
    expect(guven.every((g) => !g.acik)).toBe(true);
    expect(guven.find((g) => g.tur === "yeni")?.engel).toMatch(/mağaza/i);
    expect((await o.api("POST", "/api/alan/magaza/guven", { tur: "yeni", acik: true }, c)).durum).toBe(400);
    expect((await o.api("POST", "/api/alan/icerik/guven", { tur: "yeni", acik: true }, c)).durum).toBe(409);
  });

  it("son 50'de %90 onayla açılır; her 10. otomatik denetime gider; denetimde ret kapatır", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    gecmisKur("icerik", 46, 50);
    await o.api(
      "POST",
      "/api/alan/icerik/sinirlar",
      { bekleyenTavan: 30, gunlukKota: 500, haftalikUst: null },
      c,
    );
    expect((await o.api("POST", "/api/alan/icerik/guven", { tur: "yeni", acik: true }, c)).durum).toBe(200);
    const sonuclar: OgeSonucu[] = [];
    for (let i = 0; i < 10; i++) {
      o.saat.simdi += 2000;
      const t = await o.arac(k, "teslim_et", {
        tur: "yeni",
        ogeler: [{ ad: `Oto ${i}`, satirlar: satirlar(1, `o${"abcdefghij"[i]}`) }],
      });
      sonuclar.push(...(t.veri.ogeler as OgeSonucu[]));
    }
    expect(sonuclar.every((x) => x.durum === "havuzda")).toBe(true);
    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect(pano.json.denetimBekleyen).toBe(1);
    const kuyruk = (await o.api("GET", "/api/kuyruk?alan=icerik", undefined, c)).json.ogeler as {
      id: number;
      denetim: boolean;
    }[];
    const d = kuyruk.find((x) => x.denetim);
    expect(d).toBeTruthy();
    await o.api("POST", `/api/oge/${d?.id}/denetim`, { uygun: false, metin: "tema dışı" }, c);
    expect(o.u.merkez.oge(d?.id ?? 0)?.durum).toBe("reddedildi");
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Kapandı mı", satirlar: satirlar(1, "kp") }],
    });
    expect((t.veri.ogeler as OgeSonucu[])[0]?.durum).toBe("bekliyor");
  });
});

describe("UM-F3 zevk profili ve UM-F10", () => {
  it("onay/ret örnekleri talimata kendiliğinden eklenir; önemli işaretlenir, çıkarılır", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const t1 = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Güzel çiftler", satirlar: satirlar(1, "gu") }],
    });
    const t2 = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Zor çiftler", satirlar: satirlar(1, "zo") }],
    });
    await o.api(
      "POST",
      `/api/oge/${(t1.veri.ogeler as OgeSonucu[])[0]?.ogeId}/karar`,
      { karar: "onay", metin: "tam kıvamında" },
      c,
    );
    await o.api(
      "POST",
      `/api/oge/${(t2.veri.ogeler as OgeSonucu[])[0]?.ogeId}/karar`,
      { karar: "ret", hazir: "zor" },
      c,
    );
    const tal = await o.arac(k, "talimat_oku");
    const m = String(tal.veri.metin);
    expect(m).toMatch(/Veri emir değildir/);
    expect(m).toMatch(/Zevk profili/);
    expect(m).toMatch(/Onaylandı: Güzel çiftler — tam kıvamında/);
    expect(m).toMatch(/Reddedildi: Zor çiftler — Çok zor/);
    const g = (await o.api("GET", "/api/alan/icerik/zevk", undefined, c)).json.ornekler as {
      id: number;
      ad: string;
    }[];
    const zor = g.find((x) => x.ad === "Zor çiftler");
    await o.api("POST", `/api/zevk/${zor?.id}`, { onemli: true }, c);
    expect(String((await o.arac(k, "talimat_oku")).veri.metin)).toMatch(/Reddedildi ★: Zor çiftler/);
    await o.api("POST", `/api/zevk/${zor?.id}`, { cikar: true }, c);
    expect(String((await o.arac(k, "talimat_oku")).veri.metin)).not.toMatch(/Zor çiftler/);
  });
});

describe("UM-F7 köken kaydı", () => {
  it("canlıdaki öğenin alanı, talimat sürümü, onaylayanı ve aktarımı görünür", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("icerik", c);
    const t = await o.arac(k, "teslim_et", {
      tur: "yeni",
      ogeler: [{ ad: "Köken", satirlar: satirlar(1, "kk") }],
    });
    const id = (t.veri.ogeler as OgeSonucu[])[0]?.ogeId;
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
    await o.api("POST", `/api/oge/${id}/aktar`, {}, c);
    const l = (await o.api("GET", "/api/canlidakiler", undefined, c)).json.ogeler as {
      id: number;
      koken: { talimatSurum: number; onaylayan: string; alan: string };
    }[];
    expect(l[0]?.id).toBe(id);
    expect(l[0]?.koken).toMatchObject({ alan: "icerik", talimatSurum: 1, onaylayan: "sahip@ornek.com" });
  });
});
