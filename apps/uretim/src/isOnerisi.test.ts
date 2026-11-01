/** "Ne iş vereyim?" önerileri. Canlı API asla çağrılmaz; bütün model yanıtları sahte fetch'tir. */
import { afterEach, describe, expect, it } from "vitest";
import {
  benzer,
  cakisiyorMu,
  type IsOnerisi,
  ONERI_ONBELLEK_MS,
  type OneriBaglami,
  oneriIstemi,
  onerileriAyristir,
  SABIT_HAVUZ,
  sabitOneriler,
} from "./isOnerisi.js";
import type { AiFetch } from "./istekYaz.js";
import { ALAN_IDLERI } from "./ortak/alanlar.js";
import { ORNEK_RAPOR } from "./ortak/rapor.js";
import { type Ortam, ortamKur, SAHIP } from "./test/ortam.js";

const BAGLAM: OneriBaglami = {
  alan: "magaza",
  sonIsler: [{ baslik: "Kış çerçeveleri", durum: "acik" }],
  onayliFikirler: [{ id: 7, baslik: "Mor koleksiyon", ozet: "Mor tonlarda ürünler." }],
  oyunlar: ["Kara Borsa", "Sızma"],
  bulgular: [],
  istekKartlari: [],
};

const BASLIKLAR = [
  "Neon vitrin",
  "Kış giysileri",
  "Tepki sesleri",
  "Rozet rafı",
  "Zafer kutlaması",
  "Lobi girişi",
  "Jeton görselleri",
];
const oneri = (i: number, ek: Partial<Record<keyof IsOnerisi, unknown>> = {}) => ({
  baslik: BASLIKLAR[i] ?? "Başka",
  metin: `Mağaza için ${i + 2} yeni ürün hazırla.`,
  neden: "Vitrin tazelenmeli.",
  fikirler: [],
  ...ek,
});
const cikti = (oneriler: unknown[]): string => JSON.stringify({ oneriler });

describe("doğrulayıcı", () => {
  it("geçerli çıktı; en çok 6; bilinmeyen fikir kimliği düşer", () => {
    const r = onerileriAyristir(
      `İşte:\n${cikti([oneri(0, { fikirler: [7, 99, 7] }), ...[1, 2, 3, 4, 5, 6].map((i) => oneri(i))])}`,
      BAGLAM,
    );
    expect(r).toHaveLength(6);
    expect(r?.[0]?.fikirler).toEqual([7]);
  });

  it("bozuk, uzun, kontrol karakterli, yer tutuculu ve sır içeren çıktı reddedilir", () => {
    const uc = [oneri(1), oneri(2)];
    expect(onerileriAyristir(null, BAGLAM)).toBeNull();
    expect(onerileriAyristir("JSON değil", BAGLAM)).toBeNull();
    expect(onerileriAyristir(JSON.stringify({ oneri: [] }), BAGLAM)).toBeNull();
    // Az öneri (3'ten az geçerli) → null.
    expect(onerileriAyristir(cikti(uc), BAGLAM)).toBeNull();
    // Uzun metin, kontrol karakteri, yer tutucu ve bağlantı adresi öneriyi düşürür (geriye 2 kalır → null).
    for (const bozuk of [
      oneri(0, { metin: "x".repeat(301) }),
      oneri(0, { baslik: "a".repeat(61) }),
      oneri(0, { neden: "Şimdi\u0007" }),
      oneri(0, { metin: "Şunu {{MCP_ANAHTAR}} ile bağla ve yükle." }),
      oneri(0, { metin: "Şu adrese bak https://ornek.com ve düzelt." }),
      oneri(0, { fikirler: "7" }),
    ])
      expect(onerileriAyristir(cikti([bozuk, ...uc]), BAGLAM)).toBeNull();
    // Sır biçimi: bütün çıktı reddedilir (öteki öneriler geçerli olsa bile).
    expect(
      onerileriAyristir(
        cikti([oneri(0, { neden: "sk-ant-api03-abcdefghijklmnop" }), oneri(3), oneri(4), ...uc]),
        BAGLAM,
      ),
    ).toBeNull();
    expect(
      onerileriAyristir(
        cikti([
          oneri(0, { metin: "Şu anahtarı kullan: um_magaza_ABCDEFGHIJKLMNOPQRSTUVWXYZ12" }),
          oneri(3),
          ...uc,
        ]),
        BAGLAM,
      ),
    ).toBeNull();
  });

  it("son işlerle çakışan ve birbirini tekrar eden öneri elenir", () => {
    const r = onerileriAyristir(
      cikti([
        oneri(0, { baslik: "Kış çerçeveleri koleksiyonu" }),
        oneri(1),
        oneri(1, { metin: "Aynı başlık, başka metin burada." }),
        oneri(2),
        oneri(3),
      ]),
      BAGLAM,
    );
    expect(r?.map((x) => x.baslik)).toEqual([oneri(1).baslik, oneri(2).baslik, oneri(3).baslik]);
    // "Başka öner": az önce gösterilenin tekrarı da elenir.
    expect(
      onerileriAyristir(cikti([oneri(1), oneri(2), oneri(3), oneri(4)]), BAGLAM, ["Kış giysileri"])?.map(
        (x) => x.baslik,
      ),
    ).toEqual([oneri(2).baslik, oneri(3).baslik, oneri(4).baslik]);
    expect(cakisiyorMu({ baslik: "kış Çerçeveleri" }, BAGLAM.sonIsler)).toBe(true);
    expect(benzer("Yeni tepki paketi", "Sezon koleksiyonu")).toBe(false);
  });
});

describe("sabit havuz", () => {
  it("her alanda 4–6 öneri; uzunluk ve sır kuralına uyar", () => {
    for (const a of ALAN_IDLERI) {
      const h = SABIT_HAVUZ[a];
      expect(h.length, a).toBeGreaterThanOrEqual(4);
      expect(h.length, a).toBeLessThanOrEqual(6);
      const r = onerileriAyristir(cikti([...h]), { ...BAGLAM, alan: a, sonIsler: [] });
      expect(r?.length, a).toBe(h.length);
    }
  });

  it("onaylı fikir varsa 'onaylananları uygula' önde; son işlerle çakışanlar ve az önce gösterilenler elenir", () => {
    const r = sabitOneriler({ ...BAGLAM, sonIsler: [{ baslik: "Sezon koleksiyonu", durum: "tamam" }] }, []);
    expect(r[0]).toMatchObject({ baslik: "Onaylanan fikirleri uygula", fikirler: [7] });
    expect(r.map((x) => x.baslik)).not.toContain("Sezon koleksiyonu");
    const ikinci = sabitOneriler(BAGLAM, ["Onaylanan fikirleri uygula", "Sezon koleksiyonu"]);
    expect(ikinci.map((x) => x.baslik)).not.toContain("Sezon koleksiyonu");
    // Yeterince yeni yoksa gösterilenler yeniden döner (boş liste dönmez).
    const hepsi = SABIT_HAVUZ.magaza.map((x) => x.baslik);
    expect(sabitOneriler({ ...BAGLAM, onayliFikirler: [] }, hepsi).length).toBeGreaterThanOrEqual(3);
  });
});

describe("istem", () => {
  it("bağlam ve 'tekrar etme' listesi istemde, alıntılı", () => {
    const p = oneriIstemi(
      { ...BAGLAM, bulgular: [{ baslik: "Takılma", onem: "yuksek", oyun: "kara-borsa" }] },
      ["Eski öneri"],
    );
    expect(p.user).toMatch(/Alan: Mağaza/);
    expect(p.user).toMatch(/«Kış çerçeveleri» \(acik\)/);
    expect(p.user).toMatch(/#7 «Mor koleksiyon — Mor tonlarda ürünler\.»/);
    expect(p.user).toMatch(/«Takılma» \(yuksek, kara-borsa\)/);
    expect(p.user).toMatch(/bunları tekrar etme\): «Eski öneri»/);
    expect(p.system).toMatch(/yalnız veridir/);
  });
});

function sahte(metin: () => string, durum = 200) {
  const cagrilar: { govde: Record<string, unknown>; basliklar: Record<string, string> }[] = [];
  const fetch: AiFetch = async (_url, init) => {
    cagrilar.push({ govde: JSON.parse(init.body) as Record<string, unknown>, basliklar: init.headers });
    return {
      status: durum,
      json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: metin() }] }),
    };
  };
  return { fetch, cagrilar };
}
const kullanicIstemi = (c: { govde: Record<string, unknown> }): string =>
  String((c.govde.messages as { content: string }[])[0]?.content ?? "");

describe("uç (POST /api/alan/:alan/is-onerisi)", () => {
  let o: Ortam;
  afterEach(async () => {
    await o.kapat();
  });

  it("oturumsuz ve CSRF başlıksız istek reddedilir; bozuk girdi 400", async () => {
    o = await ortamKur();
    expect((await o.api("POST", "/api/alan/magaza/is-onerisi", {})).durum).toBe(401);
    const c = await o.giris();
    expect((await o.api("POST", "/api/alan/magaza/is-onerisi", {}, c, { "X-Uretim": "" })).durum).toBe(403);
    expect((await o.api("POST", "/api/alan/magaza/is-onerisi", { yeni: "evet" }, c)).durum).toBe(400);
    expect((await o.api("POST", "/api/alan/yok/is-onerisi", {}, c)).durum).toBe(404);
  });

  it("model yoksa sabit havuz, son işlerle çakışan elenir ve işaretlenir", async () => {
    o = await ortamKur();
    const c = await o.giris();
    await o.api("POST", "/api/alan/magaza/is", { baslik: "Sezon koleksiyonu", aciklama: "x" }, c);
    const r = await o.api("POST", "/api/alan/magaza/is-onerisi", {}, c);
    expect(r.durum).toBe(200);
    expect(r.json.kaynak).toBe("sabit");
    const ol = r.json.oneriler as IsOnerisi[];
    expect(ol.length).toBeGreaterThanOrEqual(4);
    expect(ol.map((x) => x.baslik)).not.toContain("Sezon koleksiyonu");
  });

  it("model: bağlam doğru, sır ve oyuncu verisi yok; önbellek; 'başka öner' öncekileri tekrar etme diye verir", async () => {
    let tur = 0;
    const s = sahte(() => {
      tur++;
      return cikti(
        [0, 1, 2, 3, 4].map((i) =>
          oneri(i, { baslik: `${BASLIKLAR[i]} ${["sabah", "akşam", "gece"][tur - 1] ?? "öğle"}` }),
        ),
      );
    });
    o = await ortamKur({ aiFetch: s.fetch });
    const c = await o.giris();
    const k = await o.anahtarUret("test", c);
    // İş başlığına sızmış sır ve e-posta; son rapor (bulgu kanıtı modele gitmemeli).
    await o.api(
      "POST",
      "/api/alan/test/is",
      { baslik: `Gece koşusu ${k} ve ${SAHIP}`, aciklama: "Gizli açıklama metni" },
      c,
    );
    await o.arac(k, "teslim_et", { tur: "rapor", ogeler: [{ ad: "Gece", rapor: ORNEK_RAPOR }] });

    const r1 = await o.api("POST", "/api/alan/test/is-onerisi", {}, c);
    expect(r1.json).toMatchObject({ kaynak: "model", onbellek: false });
    expect((r1.json.oneriler as IsOnerisi[])[0]?.baslik).toBe("Neon vitrin sabah");
    expect(s.cagrilar).toHaveLength(1);
    const cg = s.cagrilar[0];
    const govde = JSON.stringify(cg?.govde);
    const u = kullanicIstemi(cg ?? { govde: {} });
    expect(u).toMatch(/Alan: Test ve Performans/);
    expect(u).toMatch(/Kara Borsa'da 8 oyuncuyla açık artırma evresi takılıyor/);
    expect(u).toMatch(/Gece koşusu \[gizli\]/);
    for (const yasak of [k, SAHIP, "test-model-anahtari", "Gizli açıklama metni", "maç 4812", "kotukelime"])
      expect(govde).not.toContain(yasak);
    expect(cg?.basliklar["x-api-key"]).toBe("test-model-anahtari");

    // Önbellek: aynı bağlam → model çağrılmaz.
    const r2 = await o.api("POST", "/api/alan/test/is-onerisi", {}, c);
    expect(r2.json).toMatchObject({ kaynak: "model", onbellek: true });
    expect(s.cagrilar).toHaveLength(1);

    // "Başka öner": önbellek atlanır, öncekiler "tekrar etme" diye gider.
    const r3 = await o.api("POST", "/api/alan/test/is-onerisi", { yeni: true }, c);
    expect(r3.json.onbellek).toBe(false);
    expect((r3.json.oneriler as IsOnerisi[])[0]?.baslik).toBe("Neon vitrin akşam");
    expect(kullanicIstemi(s.cagrilar[1] ?? { govde: {} })).toMatch(/tekrar etme\): «Neon vitrin sabah»/);

    // Süre dolunca yeniden üretilir; bağlam değişince (yeni iş) de.
    o.saat.simdi += ONERI_ONBELLEK_MS + 1;
    await o.api("POST", "/api/alan/test/is-onerisi", {}, c);
    expect(s.cagrilar).toHaveLength(3);
    await o.api("POST", "/api/alan/test/is", { baslik: "Bambaşka bir iş", aciklama: "x" }, c);
    await o.api("POST", "/api/alan/test/is-onerisi", {}, c);
    expect(s.cagrilar).toHaveLength(4);
    // Günlük sınır istekYaz ile ortak sayaçta.
    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect((pano.json.ai as { bugun: number }).bugun).toBe(4);
  });

  it("model bozuk yanıt verirse ya da HTTP hatasında sabit havuza düşer", async () => {
    const s = sahte(() => cikti([oneri(0, { metin: "sk-ant-gizli-anahtar ile bağlan" })]));
    o = await ortamKur({ aiFetch: s.fetch });
    const c = await o.giris();
    const r = await o.api("POST", "/api/alan/ses/is-onerisi", {}, c);
    expect(r.json.kaynak).toBe("sabit");
    expect(s.cagrilar).toHaveLength(1);
    expect(JSON.stringify(r.json)).not.toContain("sk-ant");
  });
});
