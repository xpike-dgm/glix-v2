/**
 * SSH paketi tek istekte (`ssh_paket`): site `gelen/<paket>/`i kendisi okur; yüzlerce dosyalı paket dakikada 60 istek
 * sınırına takılmaz. Alan anahtardan gelir; başka alanın paketi, yol kaçışı ve bağlantılar reddedilir.
 */
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type CliOrtami, calistirKomut } from "./cli/uretim.js";
import { EN_COK_PAKET_DOSYASI, PAKET_SINIRLARI } from "./ortak/paketBicimi.js";
import { type Ortam, ortamKur } from "./test/ortam.js";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur({ ssh: true });
});
afterEach(async () => {
  await o.kapat();
});

/** İstek sayan CLI ortamı. */
function cli(anahtar: string, gelen: string): CliOrtami & { istekler: number } {
  const c = {
    url: `${o.url}/mcp`,
    anahtar,
    gelen,
    stdin: () => Buffer.alloc(0),
    istekler: 0,
    fetchImpl: ((u: string, init: RequestInit) => {
      c.istekler += 1;
      return fetch(u, init);
    }) as typeof fetch,
  };
  return c;
}

/** `n` senaryo dosyalı test paketi (öğe başına en çok 40 dosya). */
function senaryoPaketi(gelen: string, ad: string, n: number): void {
  const p = join(gelen, ad);
  mkdirSync(p, { recursive: true });
  const ogeler: { ad: string; dosyalar: { dosya: string; hedefYol: string }[] }[] = [];
  for (let i = 0; i < n; i++) {
    const dosya = `senaryo-${i}.json`;
    writeFileSync(
      join(p, dosya),
      JSON.stringify({
        oyun: "butona-bas",
        oyuncu: 2 + (i % 6),
        strateji: `strateji ${i}`,
        beklenen: "biter",
      }),
    );
    const k = Math.floor(i / 25);
    ogeler[k] ??= { ad: `Senaryolar ${k + 1}`, dosyalar: [] };
    ogeler[k].dosyalar.push({ dosya, hedefYol: `docs/qa/senaryolar/${dosya}` });
  }
  writeFileSync(join(p, "teslim.json"), JSON.stringify({ tur: "yeni", ogeler }));
}

describe("ssh_paket", () => {
  it("100 dosyalı paket tek istekte ön kontrolden geçer, yerinde kalır; teslimde kaldırılır", async () => {
    const c = await o.giris();
    const { anahtar, gelen } = await o.sshKanali("test", c);
    senaryoPaketi(gelen, "qa3", 100);
    const ortam = cli(anahtar, gelen);
    const on = (await calistirKomut(ortam, "on-kontrol qa3")) as { ogeler: { sonuc: string }[] };
    expect(ortam.istekler).toBe(1);
    expect(on.ogeler).toHaveLength(4);
    expect(on.ogeler.every((x) => x.sonuc !== "kaldi")).toBe(true);
    expect(existsSync(join(gelen, "qa3/senaryo-99.json"))).toBe(true);
    // Hemen ardından olağan komutlar da çalışır (istek sınırı tükenmedi).
    for (let i = 0; i < 5; i++) await calistirKomut(ortam, "isleri-listele");
    const t = (await calistirKomut(ortam, "teslim-et qa3")) as { ogeler: { durum: string }[] };
    expect(t.ogeler.every((x) => x.durum === "bekliyor")).toBe(true);
    expect(existsSync(join(gelen, "qa3"))).toBe(false);
    expect(o.u.merkez.bekleyenler("test")).toHaveLength(4);
  });

  it("aynı paketin tekrar ön kontrolü günlük dosya sınırını tüketmez", async () => {
    const c = await o.giris();
    const { anahtar, gelen } = await o.sshKanali("test", c);
    senaryoPaketi(gelen, "qa3", 150);
    const ortam = cli(anahtar, gelen);
    // 4 × 150 = 600 yükleme, ama yalnız 150 farklı içerik: sınır (500) dolmaz, teslim geçer.
    for (let i = 0; i < 4; i++) await calistirKomut(ortam, "on-kontrol qa3");
    const t = (await calistirKomut(ortam, "teslim-et qa3")) as { ogeler: { durum: string }[] };
    expect(t.ogeler.every((x) => x.durum === "bekliyor")).toBe(true);
  });

  it("sınırlar: en çok 200 dosya; talimat sınırları yazar", async () => {
    const c = await o.giris();
    const { anahtar, gelen } = await o.sshKanali("test", c);
    senaryoPaketi(gelen, "cok", EN_COK_PAKET_DOSYASI + 1);
    await expect(calistirKomut(cli(anahtar, gelen), "on-kontrol cok")).rejects.toThrow(
      /en çok 200 dosya olabilir \(gelen 201\)/,
    );
    expect(existsSync(join(gelen, "cok/teslim.json"))).toBe(true);
    const t = (await calistirKomut(cli(anahtar, gelen), "talimat-oku")) as { metin: string };
    expect(t.metin).toContain(PAKET_SINIRLARI);
  });

  it("başka alanın anahtarı bu alanın paketini okuyamaz; MCP anahtarı iç aracı kullanamaz", async () => {
    const c = await o.giris();
    const test = await o.sshKanali("test", c);
    const rozet = await o.sshKanali("rozet", c);
    senaryoPaketi(test.gelen, "qa3", 3);
    // Rozet anahtarı aynı adı kendi alanının gelen/ klasöründe arar.
    await expect(calistirKomut(cli(rozet.anahtar, test.gelen), "on-kontrol qa3")).rejects.toThrow(
      /Paket bulunamadı: qa3/,
    );
    const mcp = await o.anahtarUret("test", c);
    const r = await o.mcp(mcp, "tools/call", {
      name: "ssh_paket",
      arguments: { paket: "qa3", islem: "on_kontrol" },
    });
    expect(r.json.error).toMatchObject({ code: -32602 });
    expect(o.u.merkez.bekleyenler("test")).toHaveLength(0);
    expect(existsSync(join(test.gelen, "qa3/teslim.json"))).toBe(true);
  });

  it("yol kaçışı ve bağlantılar reddedilir", async () => {
    const c = await o.giris();
    const test = await o.sshKanali("test", c);
    const rozet = await o.sshKanali("rozet", c);
    senaryoPaketi(test.gelen, "qa3", 2);
    const cagir = async (paket: string) => {
      const r = await o.mcp(rozet.anahtar, "tools/call", {
        name: "ssh_paket",
        arguments: { paket, islem: "teslim" },
      });
      return r.json.result as { isError: boolean; content: { text: string }[] };
    };
    for (const p of ["../../test/gelen/qa3", "../test", "/etc", "qa3/..", ".."]) {
      const r = await cagir(p);
      expect(r.isError).toBe(true);
      expect(r.content[0]?.text).toMatch(/Paket adı geçersiz/);
    }
    // Klasör bağlantısı (başka alanın paketine) ve paket içinde dosya bağlantısı.
    symlinkSync(join(test.gelen, "qa3"), join(rozet.gelen, "bag"));
    expect((await cagir("bag")).content[0]?.text).toMatch(/bağlantı kabul edilmez/);
    mkdirSync(join(rozet.gelen, "p2"));
    symlinkSync("/etc/passwd", join(rozet.gelen, "p2/sir.json"));
    writeFileSync(
      join(rozet.gelen, "p2/teslim.json"),
      JSON.stringify({ tur: "yeni", ogeler: [{ ad: "X", dosyalar: [{ dosya: "sir.json" }] }] }),
    );
    expect((await cagir("p2")).content[0]?.text).toMatch(/düz bir dosya değil/);
    expect(existsSync(join(test.gelen, "qa3/teslim.json"))).toBe(true);
    expect(o.u.merkez.bekleyenler(null)).toHaveLength(0);
  });
});
