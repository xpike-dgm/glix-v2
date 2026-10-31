/** UM-R1/R2/R3: istekten işe ve isteme. Canlı API asla çağrılmaz; bütün model yanıtları sahte fetch'tir. */
import { afterEach, describe, expect, it } from "vitest";
import { komutAyristir } from "./cli/uretim.js";
import { openDb } from "./db.js";
import {
  AI_MODEL,
  type AiFetch,
  donusturucuKur,
  gizliVarMi,
  istemDoldur,
  istemUret,
  kaliptanTaslak,
  taslakAyristir,
} from "./istekYaz.js";
import type { IsKaydi } from "./ortak/tipler.js";
import { type Ortam, ortamKur } from "./test/ortam.js";

const GIRDI = {
  metin: "Neon gece koleksiyonu için 6 ürün. Biri efsanevi olsun.",
  alan: "magaza" as const,
  baglanti: "mcp" as const,
  fikirTuru: false,
  sonTarih: null,
};

function sahte(
  yanit: unknown,
  durum = 200,
): {
  fetch: AiFetch;
  cagrilar: { url: string; govde: Record<string, unknown>; basliklar: Record<string, string> }[];
} {
  const cagrilar: { url: string; govde: Record<string, unknown>; basliklar: Record<string, string> }[] = [];
  return {
    cagrilar,
    fetch: async (url, init) => {
      cagrilar.push({
        url,
        govde: JSON.parse(init.body) as Record<string, unknown>,
        basliklar: init.headers,
      });
      return { status: durum, json: async () => yanit };
    },
  };
}
const modelYaniti = (metin: string, stop = "end_turn") => ({
  stop_reason: stop,
  content: [{ type: "text", text: metin }],
});
const IYI = JSON.stringify({
  baslik: "Neon Gece koleksiyonu",
  aciklama: "Altı ürünlük koleksiyon.",
  adet: 6,
  kisitlar: ["biri efsanevi"],
  kabul: ["fiyatlar aralıkta"],
  ozet: "Neon Gece: 6 ürün, biri efsanevi",
});

describe("dönüştürücü", () => {
  it("anahtar yoksa hiç istek atmadan sabit kalıp", async () => {
    const s = sahte(modelYaniti(IYI));
    const d = donusturucuKur(openDb(":memory:"), null, { fetch: s.fetch });
    const r = await d.taslak(GIRDI, Date.now());
    expect(r.kaynak).toBe("kalip");
    expect(r.taslak.adet).toBe(6);
    expect(s.cagrilar).toHaveLength(0);
  });

  it("model yanıtı doğrulanır; istek biçimi oyundaki desenle aynı", async () => {
    const s = sahte(modelYaniti(`İşte:\n${IYI}`));
    const d = donusturucuKur(openDb(":memory:"), "test-anahtari", { fetch: s.fetch });
    const r = await d.taslak(GIRDI, Date.now());
    expect(r.kaynak).toBe("model");
    expect(r.taslak).toMatchObject({
      baslik: "Neon Gece koleksiyonu",
      adet: 6,
      kabul: ["fiyatlar aralıkta"],
    });
    const c = s.cagrilar[0];
    expect(c?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(c?.govde.model).toBe(AI_MODEL);
    expect(AI_MODEL).toBe("claude-haiku-5-5");
    expect(c?.govde.thinking).toEqual({ type: "disabled" });
    expect(c?.basliklar["x-api-key"]).toBe("test-anahtari");
    expect(JSON.stringify(c?.govde)).not.toContain("test-anahtari");
  });

  it("yarım yanıt, HTTP hatası, bozuk JSON ve gizli bilgi sabit kalıba düşer", async () => {
    for (const s of [
      sahte(modelYaniti(IYI, "max_tokens")),
      sahte({ hata: true }, 500),
      sahte(modelYaniti("JSON değil")),
      sahte(
        modelYaniti(
          JSON.stringify({ baslik: "Bağlan", ozet: "um_magaza_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 ile bağlan" }),
        ),
      ),
    ]) {
      const d = donusturucuKur(openDb(":memory:"), "k", { fetch: s.fetch });
      expect((await d.taslak(GIRDI, Date.now())).kaynak).toBe("kalip");
    }
    const atan: AiFetch = async () => {
      throw new Error("ağ yok, anahtar k");
    };
    expect(
      (await donusturucuKur(openDb(":memory:"), "k", { fetch: atan }).taslak(GIRDI, Date.now())).kaynak,
    ).toBe("kalip");
  });

  it("günlük istek sınırı", async () => {
    const s = sahte(modelYaniti(IYI));
    const d = donusturucuKur(openDb(":memory:"), "k", { fetch: s.fetch, gunluk: 2 });
    const now = Date.now();
    for (let i = 0; i < 3; i++) await d.taslak(GIRDI, now);
    expect(s.cagrilar).toHaveLength(2);
    expect(d.kullanim(now)).toEqual({ bugun: 2, sinir: 2 });
  });

  it("taslak ayrıştırıcı sınırları uygular", () => {
    expect(taslakAyristir(null)).toBeNull();
    expect(taslakAyristir(JSON.stringify({ baslik: "x", ozet: "y" }))).toBeNull();
    expect(kaliptanTaslak({ ...GIRDI, metin: "Lobi müziği yap" }).adet).toBeNull();
  });
});

describe("istem", () => {
  const is = (id: number, ozet: string): IsKaydi =>
    ({
      id,
      alan: "magaza",
      baslik: ozet,
      aciklama: "",
      adet: null,
      sonTarih: null,
      ornek: "",
      kaynak: "sahip",
      durum: "acik",
      sira: id,
      olusturma: 0,
      varyant: null,
      fikirTuru: false,
      secilenFikir: null,
      kisitlar: [],
      kabul: [],
      ozet,
      basladi: null,
      teslimEdildi: null,
      kilit: null,
    }) as IsKaydi;

  it("MCP ve SSH kalıpları; birden çok iş kapsanır; sır yok", () => {
    const m = istemUret("magaza", "mcp", [is(12, "Neon Gece: 6 ürün"), is(13, "Kış çerçeveleri")]);
    expect(m).toMatch(/talimat_oku/);
    expect(m).toMatch(/is_oku \(id: 12\)/);
    expect(m).toMatch(/Sırada 2 iş var: #12 Neon Gece: 6 ürün; #13 Kış çerçeveleri/);
    expect(m).toMatch(/"devam"/);
    const s = istemUret("magaza", "ssh", [is(12, "Neon Gece")]);
    expect(s).toMatch(/ssh \{\{SSH_KULLANICI\}\}@\{\{SSH_ADRES\}\} uretim talimat-oku/);
    expect(s).toMatch(/Parola: \{\{SSH_PAROLA\}\}/);
    expect(m).toMatch(/\{\{MCP_ANAHTAR\}\}/);
    expect(
      istemDoldur(s, { "{{SSH_KULLANICI}}": "uretim-magaza", "{{SSH_ADRES}}": "dgmcraft.online" }),
    ).toMatch(/ssh uretim-magaza@dgmcraft.online uretim talimat-oku/);
    expect(s).toMatch(/uretim is-oku 12/);
    expect(gizliVarMi(m) || gizliVarMi(s)).toBe(false);
    expect(komutAyristir("uretim is-oku 12")).toEqual({ komut: "is-oku", args: ["12"] });
  });
});

describe("uçtan uca (UM-R1, R2)", () => {
  let o: Ortam;
  afterEach(async () => {
    await o.kapat();
  });

  it("istek yaz → taslak → iş → istemi kopyala → ilk is_oku 'başladı' → teslim 'teslim edildi'", async () => {
    o = await ortamKur();
    const c = await o.giris();
    const t = await o.api(
      "POST",
      "/api/istek-yaz",
      { metin: "Sızma için 3 mutfak çifti", alan: "icerik", baglanti: "mcp", fikirTuru: false },
      c,
    );
    expect(t.json.kaynak).toBe("kalip");
    const taslak = t.json.taslak as {
      baslik: string;
      aciklama: string;
      adet: number;
      kisitlar: string[];
      kabul: string[];
      ozet: string;
    };
    const is = await o.api(
      "POST",
      "/api/alan/icerik/is",
      { ...taslak, baslik: `${taslak.baslik} (düzeltildi)` },
      c,
    );
    const isId = (is.json.is as { id: number }).id;
    await o.api("POST", "/api/alan/icerik/uygulama", { not: "ChatGPT – İçerik sohbeti", baglanti: "mcp" }, c);
    const ist = await o.api("GET", `/api/alan/icerik/istem?baglanti=mcp&is=${isId}`, undefined, c);
    expect(String(ist.json.istem)).toMatch(new RegExp(`is_oku \\(id: ${isId}\\)`));
    expect(ist.json.uygulama).toBe("ChatGPT – İçerik sohbeti");
    const k = await o.anahtarUret("icerik", c);
    expect(String(ist.json.istem)).not.toContain(k);
    await o.arac(k, "is_oku", { id: isId });
    expect(o.u.merkez.is(isId)?.basladi).not.toBeNull();
    await o.arac(k, "teslim_et", {
      isId,
      tur: "yeni",
      ogeler: [
        { ad: "Mutfak", satirlar: [{ havuz: "sizma/ciftler", alanlar: { a: "tencere", b: "tava" } }] },
      ],
    });
    expect(o.u.merkez.is(isId)?.teslimEdildi).not.toBeNull();
    const pano = await o.api("GET", "/api/pano", undefined, c);
    expect(pano.json.ai).toMatchObject({ acik: false });
  });
});
