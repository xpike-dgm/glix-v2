/**
 * Teslim paketi biçimi (sözleşme bölüm 11): `uretim ornek-paket` / MCP `paket_bicimi`, teslim.json eksikken açık
 * hata, istemde ve talimatta sabit satır, test alanının şimdilik yapamadıkları.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliOrtami, calistirKomut, komutAyristir, YARDIM } from "./cli/uretim.js";
import { istemUret } from "./istekYaz.js";
import { ALAN_IDLERI, alanTanimi } from "./ortak/alanlar.js";
import { PAKET_SATIRI, paketBicimi, TEST_SINIRI } from "./ortak/paketBicimi.js";
import { teslimAyristir } from "./teslimGirdisi.js";
import { gorsel, type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
let gelen: string;
beforeEach(async () => {
  o = await ortamKur({ ssh: true });
  gelen = mkdtempSync(join(tmpdir(), "gelen-"));
});
afterEach(async () => {
  await o.kapat();
  rmSync(gelen, { recursive: true, force: true });
});

const cli = (anahtar: string): CliOrtami => ({
  url: `${o.url}/mcp`,
  anahtar,
  gelen,
  stdin: () => Buffer.alloc(0),
  fetchImpl: fetch,
});

/** SSH biçimindeki `dosya` alanlarını MCP biçimine (dosyaId) çevirir. */
const mcpBicimi = (t: Record<string, unknown>): unknown =>
  JSON.parse(JSON.stringify(t).replace(/"dosya":"[^"]+"/g, '"dosyaId":"AAAAAAAAAAAAAAAAAAAAAAAA"'));

describe("örnek paket", () => {
  it("her alanın örneği teslim biçimine uyar (bilinmeyen alan yok, hedef yollar alanın)", () => {
    for (const a of ALAN_IDLERI) {
      const p = paketBicimi(a);
      expect(p.dosyaAdi).toBe("teslim.json");
      const r = teslimAyristir(mcpBicimi(p.teslimJson), alanTanimi(a));
      expect(r.ok ? [] : r.hatalar, a).toEqual([]);
    }
    expect(paketBicimi("magaza").teslimJson.uretimYontemi).toBe("gorsel-model");
    expect(JSON.stringify(paketBicimi("icerik").teslimJson)).toMatch(/"satirlar"/);
    expect(paketBicimi("test").alanlar.join(" ")).toMatch(/rapor/);
    expect(paketBicimi("test").alanlar).toContain(TEST_SINIRI);
  });

  it("uretim ornek-paket (ve paket-bicimi) alana uygun örneği verir; MCP paket_bicimi aynı", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("test", c);
    const r = (await calistirKomut(cli(k), "ornek-paket")) as {
      alan: string;
      teslimJson: { ogeler: unknown[] };
    };
    expect(r.alan).toBe("test");
    expect(JSON.stringify(r.teslimJson)).toMatch(/"dosya":"butona-bas-5\.json"/);
    expect(await calistirKomut(cli(k), "uretim paket-bicimi")).toEqual(r);
    expect((await o.arac(k, "paket_bicimi")).veri).toEqual(r);
  });

  it("örnekteki gibi kurulan test paketi SSH'tan ön kontrolü geçer", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("test", c);
    const p = paketBicimi("test").teslimJson;
    const { isId: _i, ...isSiz } = p;
    mkdirSync(join(gelen, "qa3"));
    writeFileSync(join(gelen, "qa3/teslim.json"), JSON.stringify(isSiz));
    writeFileSync(
      join(gelen, "qa3/butona-bas-5.json"),
      JSON.stringify({
        oyun: "butona-bas",
        oyuncu: 5,
        strateji: "biri kopar, geri gelsin",
        beklenen: "skor doğru",
      }),
    );
    const r = (await calistirKomut(cli(k), "on-kontrol qa3")) as { ogeler: { sonuc: string }[] };
    expect(r.ogeler[0]?.sonuc).not.toBe("kaldi");
  });
});

describe("paket hataları açık", () => {
  it("teslim.json yoksa (paket.json varsa) adıyla söylenir ve örnek komutu gösterilir", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("test", c);
    mkdirSync(join(gelen, "qa3"));
    writeFileSync(join(gelen, "qa3/paket.json"), JSON.stringify({ isId: 1, paket: "qa3", dosyalar: [] }));
    await expect(calistirKomut(cli(k), "on-kontrol qa3")).rejects.toThrow(
      "Pakette teslim.json yok (paket.json değil). Biçim için: uretim ornek-paket",
    );
  });

  it("eksik dosya yalnız adıyla söylenir (yol sızmaz)", async () => {
    const c = await o.giris();
    const k = await o.anahtarUret("rozet", c);
    mkdirSync(join(gelen, "p1"));
    writeFileSync(
      join(gelen, "p1/teslim.json"),
      JSON.stringify({ tur: "yeni", ogeler: [{ ad: "Usta", dosyalar: [{ dosya: "usta.png" }] }] }),
    );
    const hata = await calistirKomut(cli(k), "on-kontrol p1").catch((e: Error) => e.message);
    expect(hata).toBe("Pakette dosya bulunamadı: usta.png.");
    expect(hata).not.toContain(gelen);
  });

  it("gelen/ klasörüne TAMAM ile bırakılan pakette de aynı açıklama", async () => {
    const c = await o.giris();
    await o.api(
      "POST",
      "/api/alan/rozet/ssh",
      { acik: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk2Vn2u0pJkJm4n0yQ2kQe7mS3c4Rr0bJ7Zq3c9yR1a x" },
      c,
    );
    const p = join(o.dir, "ssh/rozet/gelen/qa3");
    mkdirSync(p, { recursive: true });
    writeFileSync(join(p, "paket.json"), "{}");
    writeFileSync(join(p, "usta.png"), gorsel(64, 64));
    writeFileSync(join(p, "TAMAM"), "");
    await o.u.ssh.gelenTara(o.saat.simdi);
    const { readFileSync } = await import("node:fs");
    const s = JSON.parse(readFileSync(join(o.dir, "ssh/rozet/okunur/sonuclar/qa3.json"), "utf8")) as {
      hatalar: string[];
    };
    expect(s.hatalar[0]).toBe("Pakette teslim.json yok (paket.json değil). Biçim için: uretim ornek-paket");
  });
});

describe("istem, talimat ve yardım", () => {
  it("SSH isteminde teslim.json satırı her zaman var; yardımda da", () => {
    for (const a of ALAN_IDLERI) expect(istemUret(a, "ssh", [])).toContain(PAKET_SATIRI);
    expect(istemUret("test", "mcp", [])).toMatch(/paket_bicimi/);
    expect(YARDIM).toMatch(/teslim\.json/);
    expect(YARDIM).toMatch(/ornek-paket/);
    expect(komutAyristir("uretim yardim").komut).toBe("yardim");
    expect(() => komutAyristir("paket-olustur")).toThrow(/uretim yardim/);
  });

  it("talimatta teslim paketi bölümü (sahip silse de); test alanında koşu/zamanlayıcı sınırı", async () => {
    const c = await o.giris();
    await o.api(
      "POST",
      "/api/alan/test/talimat",
      { metin: "# Test\nYalnız senaryo yaz, başka bir şey yok." },
      c,
    );
    const k = await o.anahtarUret("test", c);
    const t = String((await o.arac(k, "talimat_oku")).veri.metin);
    expect(t).toContain("## Teslim paketi");
    expect(t).toContain(PAKET_SATIRI);
    expect(t).toContain(TEST_SINIRI);
    const km = await o.anahtarUret("magaza", c);
    const tm = String((await o.arac(km, "talimat_oku")).veri.metin);
    expect(tm).toContain(PAKET_SATIRI);
    expect(tm).not.toContain(TEST_SINIRI);
  });
});
