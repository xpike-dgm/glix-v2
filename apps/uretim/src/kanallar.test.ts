/** Sözleşme bölüm 8: her alanda MCP ve SSH, adlandırılmış anahtarlar, iş kilidi, araç bilgisi, iki kalıplı istem. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KILIT_SURESI_MS } from "./merkez.js";
import { type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur();
});
afterEach(async () => {
  await o.kapat();
});

const anahtar = async (c: string, alan: string, ad: string): Promise<string> => String((await o.api("POST", `/api/alan/${alan}/anahtar`, { ad }, c)).json.anahtar);

describe("adlandırılmış anahtarlar", () => {
  it("alan başına birden çok MCP anahtarı; ad zorunlu; tek tek iptal", async () => {
    const c = await o.giris();
    expect((await o.api("POST", "/api/alan/magaza/anahtar", {}, c)).durum).toBe(400);
    const a1 = await anahtar(c, "magaza", "ChatGPT");
    const a2 = await anahtar(c, "magaza", "OpenCode");
    const s = await o.api("GET", "/api/alan/magaza", undefined, c);
    const l = s.json.anahtarlar as { id: number; ad: string }[];
    expect(l.map((x) => x.ad).sort()).toEqual(["ChatGPT", "OpenCode"]);
    await o.api("POST", `/api/alan/magaza/anahtar/${l.find((x) => x.ad === "ChatGPT")?.id}/iptal`, {}, c);
    expect((await o.mcp(a1, "ping")).durum).toBe(401);
    expect((await o.mcp(a2, "ping")).durum).toBe(200);
  });
});

describe("iş kilidi", () => {
  it("ilk is_oku kilitler, diğer oturum 'üzerinde çalışılıyor' görür ve sıradakini alır; 2 saatte açılır; sahip açar", async () => {
    const c = await o.giris();
    const a = await anahtar(c, "icerik", "ChatGPT");
    const b = await anahtar(c, "icerik", "OpenCode");
    const is1 = ((await o.api("POST", "/api/alan/icerik/is", { baslik: "Birinci iş" }, c)).json.is as { id: number }).id;
    const is2 = ((await o.api("POST", "/api/alan/icerik/is", { baslik: "İkinci iş" }, c)).json.is as { id: number }).id;
    expect((await o.arac(a, "is_oku", { id: is1 })).veri.uzerindeCalisiliyor).toBe(false);
    const r = await o.arac(b, "is_oku", { id: is1 });
    expect(r.veri).toMatchObject({ uzerindeCalisiliyor: true, kilit: "ChatGPT", siradaki: is2 });
    const liste = (await o.arac(b, "isleri_listele")).veri as { isler: { id: number; kilit: string | null }[]; siradaki: number };
    expect(liste.isler.find((i) => i.id === is1)?.kilit).toMatch(/üzerinde çalışılıyor/);
    expect(liste.siradaki).toBe(is2);
    expect(((await o.arac(a, "isleri_listele")).veri as { siradaki: number }).siradaki).toBe(is1);
    // Kilit sahibi olmayan teslim uyarıyla kabul edilir.
    const t = await o.arac(b, "teslim_et", { isId: is1, tur: "yeni", ogeler: [{ ad: "Çiftler", satirlar: [{ havuz: "sizma/ciftler", alanlar: { a: "tencere", b: "tava" } }] }] });
    const og = (t.veri.ogeler as { durum: string; satirlar: { kod: string }[] }[])[0];
    expect(og?.durum).toBe("bekliyor");
    expect(og?.satirlar.some((s) => s.kod === "kilit")).toBe(true);
    // 2 saat hareketsizlik.
    o.saat.simdi += KILIT_SURESI_MS + 1000;
    expect((await o.arac(b, "is_oku", { id: is1 })).veri.uzerindeCalisiliyor).toBe(false);
    // Sahip elle açar.
    await o.api("POST", `/api/is/${is1}/kilit-ac`, {}, c);
    expect((await o.arac(a, "is_oku", { id: is1 })).veri.uzerindeCalisiliyor).toBe(false);
  });

  it("kilit sahibinin her isteği hareketsizlik sayacını sıfırlar", async () => {
    const c = await o.giris();
    const a = await anahtar(c, "icerik", "ChatGPT");
    const b = await anahtar(c, "icerik", "OpenCode");
    const is1 = ((await o.api("POST", "/api/alan/icerik/is", { baslik: "Uzun iş" }, c)).json.is as { id: number }).id;
    await o.arac(a, "is_oku", { id: is1 });
    o.saat.simdi += KILIT_SURESI_MS - 60_000;
    await o.arac(a, "talimat_oku");
    o.saat.simdi += 120_000;
    expect((await o.arac(b, "is_oku", { id: is1 })).veri.uzerindeCalisiliyor).toBe(true);
  });
});

describe("araç bilgisi ve istem", () => {
  it("teslimde kanal, anahtar adı, araç ve model saklanır; araç başına onay oranı", async () => {
    const c = await o.giris();
    const a = await anahtar(c, "icerik", "ChatGPT");
    const t = await o.arac(a, "teslim_et", { tur: "yeni", arac: "ChatGPT", model: "örnek-model", ogeler: [{ ad: "Çiftler", satirlar: [{ havuz: "sizma/ciftler", alanlar: { a: "kalem", b: "silgi" } }] }] });
    const id = (t.veri.ogeler as { ogeId: number }[])[0]?.ogeId;
    const tes = o.u.merkez.db.prepare("SELECT kanal, anahtar_ad, arac, model FROM teslim").get() as Record<string, string>;
    expect(tes).toEqual({ kanal: "mcp", anahtar_ad: "ChatGPT", arac: "ChatGPT", model: "örnek-model" });
    await o.api("POST", `/api/oge/${id}/karar`, { karar: "onay" }, c);
    const s = await o.api("GET", "/api/alan/icerik", undefined, c);
    expect(s.json.araclar).toEqual([{ arac: "ChatGPT", kanal: "mcp", teslim: 1, onay: 1, oran: 1 }]);
  });

  it("istem her iş için MCP ve SSH kalıbını birlikte üretir", async () => {
    const c = await o.giris();
    const is1 = ((await o.api("POST", "/api/alan/ses/is", { baslik: "Tokmak sesi", ozet: "Kara Borsa tokmağı" }, c)).json.is as { id: number }).id;
    const r = await o.api("GET", `/api/alan/ses/istem?is=${is1}`, undefined, c);
    const ist = r.json.istemler as { mcp: string; ssh: string };
    expect(ist.mcp).toMatch(new RegExp(`is_oku \\(id: ${is1}\\)`));
    expect(ist.ssh).toMatch(new RegExp(`uretim is-oku ${is1}`));
  });
});
