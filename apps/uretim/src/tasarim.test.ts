/**
 * Oyun Tasarımı alanı (13. alan, sözleşme bölüm 15): kart şeması, teslim kuralları, oyun kataloğu, Geliştir sürüm
 * zinciri, başka yapay zekâya eleştiri, çoklu yapay zekâ işi ve öneri dosyası (model + kalıp).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AiFetch } from "./istekYaz.js";
import { KURALLAR_YOLU } from "./katalog.js";
import type { FikirKarti } from "./ortak/fikir.js";
import { tasarimDogrula } from "./ortak/tasarim.js";
import { ORNEK_TASARIM } from "./ortak/tasarimOrnek.js";
import { maddeOneki, oneriGecerli } from "./tasarimIsleri.js";
import { type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam | null = null;
afterEach(async () => {
  await o?.kapat();
  o = null;
});
async function kur(ek?: Parameters<typeof ortamKur>[0]): Promise<Ortam> {
  o = await ortamKur(ek);
  return o;
}

const YENI = ORNEK_TASARIM[0] as Record<string, unknown> & { tasarim: Record<string, unknown> };
const SISTEM = ORNEK_TASARIM[1] as Record<string, unknown> & { tasarim: Record<string, unknown> };

type OgeSonucu = { ogeId: number; durum: string; satirlar: { mesaj: string; sonuc: string }[] };

/** Ada göre anahtar: alanın anahtar listesinden kimlik. */
async function anahtar(x: Ortam, c: string, ad: string): Promise<{ deger: string; id: number }> {
  const r = await x.api("POST", "/api/alan/oyun-tasarim/anahtar", { ad }, c);
  const sayfa = await x.api("GET", "/api/alan/oyun-tasarim", undefined, c);
  const id = (sayfa.json.anahtarlar as { id: number; ad: string }[]).find((k) => k.ad === ad)?.id ?? 0;
  return { deger: String(r.json.anahtar), id };
}

describe("tasarım kartı şeması", () => {
  it("örnek yeni oyun ve sistem kartı geçer; bozuk kartlar nedenleriyle reddedilir", () => {
    const h: string[] = [];
    expect(tasarimDogrula(YENI.tasarim, "1", h)).toMatchObject({
      tur: "yeni-oyun",
      oyuncu: { enAz: 4, enCok: 8 },
    });
    expect(tasarimDogrula(SISTEM.tasarim, "2", h)).toMatchObject({ tur: "sistem", kapsam: { tur: "tum" } });
    expect(h).toEqual([]);
    const hata = (v: unknown, oyunVar?: (id: string) => boolean): string => {
      const x: string[] = [];
      expect(tasarimDogrula(v, "k", x, oyunVar)).toBeNull();
      return x.join(" | ");
    };
    expect(hata({ ...YENI.tasarim, oyuncu: { enAz: 2, enCok: 12 } })).toMatch(/oyuncu/);
    expect(hata({ ...YENI.tasarim, kurallar: ["tek"] })).toMatch(/kurallar/);
    expect(hata({ ...YENI.tasarim, oyunTuru: ["dans"] })).toMatch(/oyunTuru/);
    expect(hata({ ...YENI.tasarim, gizli: 1 })).toMatch(/bilinmeyen alan "gizli"/);
    expect(hata({ ...YENI.tasarim }, () => false)).toMatch(/bozuk-telefon" GLIX'te yok/);
    expect(hata({ ...SISTEM.tasarim, tur: "oyuna-ek" })).toMatch(/oyuna-ek fikri kapsam/);
    expect(hata({ ...SISTEM.tasarim, kapsam: { tur: "bazi", oyunlar: ["sizma"] } })).toMatch(
      /bazı oyunlarda/,
    );
    expect(hata({ tur: "baska" })).toMatch(/tur "yeni-oyun"/);
    expect(maddeOneki("Fısıltı Zinciri")).toBe("FZ");
    expect(maddeOneki("Seri")).toBe("SE");
  });
});

describe("Oyun Tasarımı alanı", () => {
  it("teslim: kart geçer; tasarimsız ya da dosyalı teslim kalır; araçlar ve talimat alana özel", async () => {
    const x = await kur();
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const araclar = (
      (await x.mcp(a.deger, "tools/list")).json.result as { tools: { name: string }[] }
    ).tools.map((t) => t.name);
    expect(araclar).toEqual(expect.arrayContaining(["oyun_katalogu_oku", "elestiri_yaz"]));
    const t = await x.arac(a.deger, "teslim_et", {
      tur: "fikir",
      arac: "Claude",
      model: "opus",
      ogeler: ORNEK_TASARIM,
    });
    expect((t.veri.ogeler as OgeSonucu[]).map((g) => g.durum)).toEqual(["bekliyor", "bekliyor"]);
    const k = await x.arac(a.deger, "teslim_et", {
      tur: "fikir",
      ogeler: [{ ad: "Düz fikir", ozet: "Kısa bir fikir.", kategori: "x", etki: "orta", zahmet: "kucuk" }],
    });
    const og = (k.veri.ogeler as OgeSonucu[])[0];
    expect(og?.durum).toBe("kaldi");
    expect(JSON.stringify(og?.satirlar)).toMatch(/tasarim nesnesi gerekli/);
    expect(
      (await x.arac(a.deger, "teslim_et", { tur: "yeni", ogeler: [{ ad: "x", aciklama: "y" }] })).veri,
    ).toMatchObject({});
    // Pano: kartlar türü, kaynağı ve sürümüyle.
    const pano = await x.api("GET", "/api/fikirler?alan=oyun-tasarim", undefined, c);
    const kartlar = pano.json.fikirler as FikirKarti[];
    expect(kartlar.map((f) => f.tasarim?.tur).sort()).toEqual(["sistem", "yeni-oyun"]);
    expect(kartlar[0]?.kaynak).toMatchObject({ ad: "Claude", arac: "Claude", model: "opus" });
    const talimat = String((await x.arac(a.deger, "talimat_oku")).veri.metin);
    expect(talimat).toContain("Oyun tasarımı kartı (zorunlu biçim)");
    const ist = await x.api("GET", "/api/alan/oyun-tasarim/istem?baglanti=mcp", undefined, c);
    expect(String((ist.json.istemler as { mcp: string }).mcp)).toMatch(/oyun_katalogu_oku/);
  });

  it("oyun kataloğu: oyunlar, kart sistemi, bir oyunun kuralları ve mevcut fikirler", async () => {
    const x = await kur();
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const yaz = (yol: string, icerik: string): void => {
      x.u.merkez.db
        .prepare("INSERT INTO katalog (yol, icerik, revizyon, zaman) VALUES (?, ?, 'r', 1)")
        .run(yol, icerik);
    };
    yaz(
      KURALLAR_YOLU,
      "# GLIX\n## Projenin değişmeyen genel çerçevesi\nTelefonda oynanır.\n# 0. Maç düzeyi kuralları: Kartlar (KİLİTLİ)\n## K1. Genel akış\nKart seçilir.\n# A. Daha önce\n## 6. Butona Bas — `butona-bas`\nAynı anda bas.\n## 7. Rus Ruleti — `rus-ruleti`\nX\n",
    );
    yaz(
      "docs/wiki/oyunlar/butona-bas.json",
      JSON.stringify({ id: "butona-bas", slogan: "Birlikte bas!", oyuncu: { min: 2, max: 8 } }),
    );
    await x.arac(a.deger, "teslim_et", { tur: "fikir", ogeler: [ORNEK_TASARIM[0]] });
    const g = (await x.arac(a.deger, "oyun_katalogu_oku")).veri;
    expect(String(g.kartSistemi)).toMatch(/^# 0\. Maç düzeyi kuralları: Kartlar[\s\S]*Kart seçilir\.$/);
    expect(String(g.cerceve)).toMatch(/Telefonda oynanır/);
    expect((g.oyunlar as { id: string; slogan?: string }[]).find((y) => y.id === "butona-bas")?.slogan).toBe(
      "Birlikte bas!",
    );
    expect((g.mevcutFikirler as { ad: string; tur: string }[])[0]).toMatchObject({
      ad: "Fısıltı Zinciri",
      tur: "Yeni oyun",
    });
    const tek = (await x.arac(a.deger, "oyun_katalogu_oku", { oyun: "butona-bas" })).veri;
    expect(String(tek.kurallar)).toBe("## 6. Butona Bas — `butona-bas`\nAynı anda bas.");
    expect((await x.arac(a.deger, "oyun_katalogu_oku", { oyun: "yok" })).hata).toBe(true);
  });

  it("Geliştir: iş yalnız kartı yazan yapay zekâya; yeni sürüm aynı kartta, geçmiş ve not ayrıntıda", async () => {
    const x = await kur();
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const b = await anahtar(x, c, "Gemini");
    const t = await x.arac(a.deger, "teslim_et", {
      tur: "fikir",
      arac: "Claude",
      ogeler: [ORNEK_TASARIM[0]],
    });
    const kart = (t.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    expect((await x.api("POST", `/api/fikir/${kart}/gelistir`, { not: "x" }, c)).durum).toBe(400);
    const g = await x.api(
      "POST",
      `/api/fikir/${kart}/gelistir`,
      { not: "Süre 2 dakikaya insin, TV'de oylama olsun." },
      c,
    );
    const is = g.json.is as { id: number; isTuru: string; hedefAnahtar: { id: number } };
    expect(is).toMatchObject({ isTuru: "gelistir", hedefAnahtar: { id: a.id } });
    // B görmez ve alamaz; A işi kartla birlikte okur.
    expect(
      ((await x.arac(b.deger, "isleri_listele")).veri.isler as { id: number }[]).map((i) => i.id),
    ).not.toContain(is.id);
    expect((await x.arac(b.deger, "is_oku", { id: is.id })).veri.mesaj).toMatch(/başka bir yapay zekâya/);
    const oku = (await x.arac(a.deger, "is_oku", { id: is.id })).veri;
    expect(oku.kart).toMatchObject({ kartId: kart, surum: 1, ad: "Fısıltı Zinciri" });
    expect(JSON.stringify(oku.kart)).toMatch(/Süre 2 dakikaya insin/);
    // Yeni sürüm (oncekiOge yazılmadan; iş kartı kullanılır).
    const yeni = {
      ...ORNEK_TASARIM[0],
      tasarim: { ...(ORNEK_TASARIM[0] as { tasarim: Record<string, unknown> }).tasarim, sureDk: 2 },
    };
    const t2 = await x.arac(a.deger, "teslim_et", {
      tur: "fikir",
      isId: is.id,
      arac: "Claude",
      ogeler: [yeni],
    });
    const kart2 = (t2.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    expect(x.u.merkez.oge(kart)?.durum).toBe("arsiv");
    const pano = (await x.api("GET", "/api/fikirler?alan=oyun-tasarim", undefined, c)).json
      .fikirler as FikirKarti[];
    expect(pano.map((f) => [f.id, f.surum])).toEqual([[kart2, 2]]);
    const ayr = await x.api("GET", `/api/fikir/${kart2}`, undefined, c);
    const surumler = ayr.json.surumler as {
      id: number;
      surum: number;
      fikir: { tasarim: { sureDk: number } };
    }[];
    expect(surumler.map((s) => [s.surum, s.fikir.tasarim.sureDk])).toEqual([
      [2, 2],
      [1, 3],
    ]);
    expect(JSON.stringify(ayr.json.notlar)).toMatch(/Süre 2 dakikaya insin/);
    expect((ayr.json.isler as { isTuru: string }[])[0]?.isTuru).toBe("gelistir");
  });

  it("Eleştirt: seçilen başka yapay zekâya iş; eleştiri kartın altına not, iş tamam", async () => {
    const x = await kur();
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const b = await anahtar(x, c, "Gemini");
    const t = await x.arac(a.deger, "teslim_et", { tur: "fikir", ogeler: [ORNEK_TASARIM[1]] });
    const kart = (t.veri.ogeler as OgeSonucu[])[0]?.ogeId ?? 0;
    expect((await x.api("POST", `/api/fikir/${kart}/elestirt`, { anahtarId: a.id }, c)).json.mesaj).toMatch(
      /kendi kartını/,
    );
    const e = await x.api("POST", `/api/fikir/${kart}/elestirt`, { anahtarId: b.id }, c);
    const isId = (e.json.is as { id: number }).id;
    expect((await x.arac(a.deger, "elestiri_yaz", { isId, metin: "a".repeat(30) })).veri.mesaj).toMatch(
      /başka bir yapay/,
    );
    expect((await x.arac(b.deger, "elestiri_yaz", { isId, metin: "kısa" })).hata).toBe(true);
    const y = await x.arac(b.deger, "elestiri_yaz", {
      isId,
      metin: "Seri ödülü iyi ama önde olanı fazla itebilir; yakalama kartı şart.",
      guclu: ["Kart sistemine doğal bağlanıyor"],
      zayif: ["Kartopu etkisi"],
      oneriler: ["Seri en çok 2 oyun sürsün"],
    });
    expect(y.veri).toMatchObject({ ok: true, kartId: kart });
    expect(x.u.merkez.is(isId)?.durum).toBe("tamam");
    const ayr = await x.api("GET", `/api/fikir/${kart}`, undefined, c);
    const n = (ayr.json.notlar as { tur: string; metin: string }[]).find((z) => z.tur === "elestiri");
    expect(n?.metin).toMatch(/^Eleştiri — Gemini\nSeri ödülü[\s\S]*Öneriler:\n- Seri en çok 2 oyun sürsün$/);
    const pano = (await x.api("GET", "/api/fikirler?alan=oyun-tasarim", undefined, c)).json
      .fikirler as FikirKarti[];
    expect(pano[0]?.elestiri).toBe(1);
    // Kartı yazan yapay zekâ eleştiriyi geri bildiriminde görür.
    expect(JSON.stringify((await x.arac(a.deger, "geri_bildirim_oku")).veri)).toMatch(/Kartopu etkisi/);
  });

  it("çoklu yapay zekâ: aynı istek her seçilene ayrı iş (ortak grup); her biri yalnız kendininkini görür", async () => {
    const x = await kur();
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const b = await anahtar(x, c, "Gemini");
    const r = await x.api(
      "POST",
      "/api/alan/oyun-tasarim/is",
      { baslik: "5 yeni blöf oyunu fikri", aciklama: "4–8 kişi, 3 dk", hedefler: [a.id, b.id] },
      c,
    );
    expect(r.durum).toBe(200);
    const isler = r.json.isler as { id: number; grup: string; hedefAnahtar: { ad: string } }[];
    expect(isler.map((i) => i.hedefAnahtar.ad)).toEqual(["Claude", "Gemini"]);
    expect(isler[0]?.grup).toBe(isler[1]?.grup);
    const gor = async (k: string) =>
      ((await x.arac(k, "isleri_listele")).veri.isler as { id: number }[]).map((i) => i.id);
    expect(await gor(a.deger)).toEqual([isler[0]?.id]);
    expect(await gor(b.deger)).toEqual([isler[1]?.id]);
    // Fikirleri yan yana: kart kaynağı farklı.
    await x.arac(a.deger, "teslim_et", {
      tur: "fikir",
      isId: isler[0]?.id,
      arac: "Claude",
      ogeler: [ORNEK_TASARIM[0]],
    });
    await x.arac(b.deger, "teslim_et", {
      tur: "fikir",
      isId: isler[1]?.id,
      arac: "Gemini",
      model: "2.5",
      ogeler: [{ ...ORNEK_TASARIM[0], ad: "Fısıltı Zinciri 2" }],
    });
    const pano = (await x.api("GET", "/api/fikirler?alan=oyun-tasarim", undefined, c)).json
      .fikirler as FikirKarti[];
    expect(pano.map((f) => f.kaynak?.ad).sort()).toEqual(["Claude", "Gemini"]);
    expect(
      (await x.api("POST", "/api/alan/oyun-tasarim/is", { baslik: "x y z", hedefler: [999] }, c)).durum,
    ).toBe(400);
  });

  it("öneri dosyası: onaylı karttan model ya da kalıpla; kabul havuzuna, oradan pakete", async () => {
    const md = (on: string) =>
      `# Fısıltı Zinciri — yeni oyun önerisi\n\nBu dosya onay içindir.\n\n## 2. Mekanik (M)\n\n### ${on}-M1 · Kurallar — **önerim: EVET**\n${"Ayrıntı. ".repeat(80)}\n`;
    const aiFetch: AiFetch = async () => ({
      status: 200,
      json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: md("FZ") }] }),
    });
    const x = await kur({ aiFetch });
    const c = await x.giris();
    const a = await anahtar(x, c, "Claude");
    const t = await x.arac(a.deger, "teslim_et", { tur: "fikir", ogeler: ORNEK_TASARIM });
    const [yeni, sistem] = (t.veri.ogeler as OgeSonucu[]).map((g) => g.ogeId);
    expect((await x.api("POST", `/api/fikir/${yeni}/oneri-dosyasi`, {}, c)).json.mesaj).toMatch(
      /Önce kartı onayla/,
    );
    await x.api("POST", `/api/oge/${yeni}/karar`, { karar: "onay" }, c);
    await x.api("POST", `/api/oge/${sistem}/karar`, { karar: "onay" }, c);
    const r = await x.api("POST", `/api/fikir/${yeni}/oneri-dosyasi`, {}, c);
    expect(r.json).toMatchObject({
      kaynak: "model",
      yol: `docs/oneriler/tasarim-fisilti-zinciri-${yeni}.md`,
    });
    // Yeniden hazırlanırsa eski taslağın yerine geçer.
    const r2 = await x.api("POST", `/api/fikir/${yeni}/oneri-dosyasi`, {}, c);
    expect(x.u.merkez.oge(Number(r.json.ogeId))?.durum).toBe("arsiv");
    // Model yanıtı biçime uymazsa kalıp (sistem kartı: madde kodları kalıptan).
    const k = await x.api("POST", `/api/fikir/${sistem}/oneri-dosyasi`, {}, c);
    expect(k.json.kaynak).toBe("kalip");
    const ayr = await x.api("GET", `/api/fikir/${sistem}`, undefined, c);
    expect(ayr.json.oneri).toMatchObject({
      durum: "havuzda",
      yol: `docs/oneriler/tasarim-seri-bonusu-${sistem}.md`,
    });
    // Fikir panosunda kart "kabul edildi".
    const pano = (await x.api("GET", "/api/fikirler?alan=oyun-tasarim", undefined, c)).json
      .fikirler as FikirKarti[];
    expect(pano.find((f) => f.id === sistem)?.asama).toBe("kabul_edildi");
    // Yöneticiye gönder: iki öneri dosyası pakette, depo yollarıyla.
    const p = await x.api("POST", "/api/paket", {}, c);
    expect(p.durum).toBe(200);
    const klasor = join(x.config.aktarimDir, (p.json.paket as { klasor: string }).klasor);
    const sis = readFileSync(join(klasor, `dosyalar/docs/oneriler/tasarim-seri-bonusu-${sistem}.md`), "utf8");
    expect(sis).toMatch(/^# Seri Bonusu — sistem önerisi/);
    expect(sis).toMatch(/### SB-M1 · Nasıl çalışır — \*\*önerim: EVET\*\*/);
    expect(sis).toMatch(/Kaynak: Üretim Merkezi, Oyun Tasarımı kartı #\d+ \(sürüm 1, Claude/);
    expect(
      readFileSync(join(klasor, `dosyalar/docs/oneriler/tasarim-fisilti-zinciri-${yeni}.md`), "utf8"),
    ).toBe(`${md("FZ").trim()}\n`);
    expect(Number(r2.json.ogeId)).toBeGreaterThan(Number(r.json.ogeId));
    expect(oneriGecerli("# x", "FZ")).toBe(false);
  });
});
