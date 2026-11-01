import { existsSync, linkSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CliHatasi, type CliOrtami, calistirKomut, gelenYolu, komutAyristir } from "./cli/uretim.js";
import { acikAnahtarAyristir } from "./sshKanal.js";
import { gorsel, type Ortam, ortamKur } from "./test/ortam.js";

const ED = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHk2Vn2u0pJkJm4n0yQ2kQe7mS3c4Rr0bJ7Zq3c9yR1a sahip@dizustu";

let o: Ortam;
beforeEach(async () => {
  o = await ortamKur({ ssh: true });
});
afterEach(async () => {
  await o.kapat();
});

describe("SSH açık anahtarı", () => {
  it("geçerli ed25519 kabul, seçenekli ve bozuk satır reddedilir", () => {
    expect(acikAnahtarAyristir(ED)?.parmakIzi).toMatch(/^SHA256:/);
    expect(acikAnahtarAyristir(`command="sh" ${ED}`)).toBeNull();
    expect(acikAnahtarAyristir(`${ED}\nssh-ed25519 AAAA`)).toBeNull();
    expect(acikAnahtarAyristir("ssh-ed25519 bozuk!!")).toBeNull();
    expect(acikAnahtarAyristir("ssh-dss AAAAB3NzaC1kc3M=")).toBeNull();
  });

  it("sahip ekleyince authorized_keys (restrict) ve 0600 kanal anahtarı yazılır; kaldırınca silinir", async () => {
    const c = await o.giris();
    const r = await o.api("POST", "/api/alan/magaza/ssh", { acik: ED, aciklama: "dizüstü" }, c);
    expect(r.durum).toBe(200);
    const dir = join(o.dir, "ssh-yetki");
    const ak = readFileSync(join(dir, "magaza.authorized_keys"), "utf8");
    expect(ak).toMatch(/^restrict ssh-ed25519 AAAA/);
    const anahtarYolu = join(dir, "magaza.anahtar");
    expect(statSync(anahtarYolu).mode & 0o777).toBe(0o600);
    const anahtar = readFileSync(anahtarYolu, "utf8").trim();
    expect(anahtar).toMatch(/^um_magaza_/);
    // Kanal anahtarı MCP ile aynı yetkide çalışır.
    expect((await o.mcp(anahtar, "tools/list")).durum).toBe(200);
    const sayfa = await o.api("GET", "/api/alan/magaza", undefined, c);
    const id = (sayfa.json.ssh as { id: number }[])[0]?.id;
    await o.api("POST", `/api/alan/magaza/ssh/${id}/kaldir`, {}, c);
    expect(existsSync(anahtarYolu)).toBe(false);
    expect((await o.mcp(anahtar, "tools/list")).durum).toBe(401);
  });
});

describe("kurulum betikleriyle uyum", () => {
  it("alan listesi ve eşitleme betiğinin anahtar deseni siteyle aynı", async () => {
    const { ALAN_IDLERI } = await import("./ortak/alanlar.js");
    const kok = join(import.meta.dirname, "../../../deploy/uretim/ssh");
    expect(readFileSync(join(kok, "alanlar.txt"), "utf8").trim().split("\n")).toEqual([...ALAN_IDLERI]);
    const desen = /DESEN='([^']+)'/.exec(readFileSync(join(kok, "eslestir.sh"), "utf8"))?.[1] ?? "";
    const c = await o.giris();
    await o.api("POST", "/api/alan/ikon/ssh", { acik: ED }, c);
    const satir = readFileSync(join(o.dir, "ssh-yetki/ikon.authorized_keys"), "utf8").trim();
    expect(new RegExp(desen).test(satir)).toBe(true);
    expect(new RegExp(desen).test(`command="sh" ${satir}`)).toBe(false);
  });
});

describe("gelen/ klasörü", () => {
  it("TAMAM'lı paket alınır, ön kontrolden geçer, sonuç okunur/'a yazılır, paket kaldırılır", async () => {
    const c = await o.giris();
    await o.api("POST", "/api/alan/rozet/ssh", { acik: ED }, c);
    const paket = join(o.dir, "ssh/rozet/gelen/20261031-usta");
    mkdirSync(paket, { recursive: true });
    writeFileSync(join(paket, "usta.png"), gorsel(256, 256));
    writeFileSync(
      join(paket, "teslim.json"),
      JSON.stringify({
        tur: "yeni",
        ogeler: [
          {
            ad: "Usta",
            dosyalar: [{ dosya: "usta.png", hedefYol: "apps/client/public/assets/badges/usta.webp" }],
          },
        ],
      }),
    );
    expect(await o.u.ssh.gelenTara(o.saat.simdi)).toBe(0);
    writeFileSync(join(paket, "TAMAM"), "");
    expect(await o.u.ssh.gelenTara(o.saat.simdi)).toBe(1);
    expect(existsSync(paket)).toBe(false);
    const sonuc = JSON.parse(
      readFileSync(join(o.dir, "ssh/rozet/okunur/sonuclar/20261031-usta.json"), "utf8"),
    ) as { ogeler: { durum: string }[] };
    expect(sonuc.ogeler[0]?.durum).toBe("bekliyor");
    expect(o.u.merkez.bekleyenler("rozet")).toHaveLength(1);
    await o.u.ssh.okunurTazele(o.saat.simdi);
    expect(readFileSync(join(o.dir, "ssh/rozet/okunur/talimat.md"), "utf8")).toMatch(/Rozet alanı/);
  });

  it("bağlantı (symlink, sert bağlantı) içeren paket reddedilir", async () => {
    const c = await o.giris();
    await o.api("POST", "/api/alan/rozet/ssh", { acik: ED }, c);
    for (const [ad, kur] of [
      ["sembolik", (p: string) => symlinkSync("/etc/passwd", join(p, "usta.png"))],
      [
        "sert",
        (p: string) => {
          const dis = join(o.dir, "dis.png");
          writeFileSync(dis, gorsel(16, 16));
          linkSync(dis, join(p, "usta.png"));
        },
      ],
    ] as const) {
      const p = join(o.dir, `ssh/rozet/gelen/${ad}`);
      mkdirSync(p, { recursive: true });
      kur(p);
      writeFileSync(
        join(p, "teslim.json"),
        JSON.stringify({ tur: "yeni", ogeler: [{ ad: "X", dosyalar: [{ dosya: "usta.png" }] }] }),
      );
      writeFileSync(join(p, "TAMAM"), "");
    }
    await o.u.ssh.gelenTara(o.saat.simdi);
    for (const ad of ["sembolik", "sert"]) {
      const s = JSON.parse(readFileSync(join(o.dir, `ssh/rozet/okunur/sonuclar/${ad}.json`), "utf8")) as {
        hatalar: string[];
      };
      expect(s.hatalar[0]).toMatch(/düz bir dosya değil/);
    }
    expect(o.u.merkez.bekleyenler("rozet")).toHaveLength(0);
  });
});

describe("uretim komut aracı", () => {
  const cli = (anahtar: string, gelen: string, stdin = ""): CliOrtami => ({
    url: `${o.url}/mcp`,
    anahtar,
    gelen,
    stdin: () => Buffer.from(stdin),
    fetchImpl: fetch,
  });

  it("yalnız bilinen alt komutlar; kabuk karakterleri reddedilir", () => {
    expect(komutAyristir("talimat-oku")).toEqual({ komut: "talimat-oku", args: [] });
    for (const k of [
      "bash",
      "talimat-oku; rm -rf /",
      "is-oku $(id)",
      "teslim-et ../../etc",
      "dosya-yukle a`id`",
      "internal-sftp2",
    ])
      expect(() => komutAyristir(k), k).toThrow(CliHatasi);
  });

  it("gelen/ dışına çıkan yol, symlink ve klasör adı oyunu reddedilir", () => {
    const g = join(o.dir, "cli-gelen");
    mkdirSync(join(g, "paket"), { recursive: true });
    writeFileSync(join(g, "paket/a.png"), "x");
    symlinkSync("/etc/passwd", join(g, "paket/b.png"));
    symlinkSync("/etc", join(g, "kacak"));
    expect(gelenYolu(g, "paket/a.png", "dosya")).toBe(join(g, "paket/a.png"));
    for (const y of [
      "../x/a.png",
      "paket/../../a.png",
      "/etc/passwd",
      "paket/b.png",
      "kacak",
      "paket/alt/a.png",
    ])
      expect(() => gelenYolu(g, y, y.includes("/") ? "dosya" : "paket"), y).toThrow(CliHatasi);
  });

  it("alt komutlar MCP araçlarına alanın anahtarıyla gider; alan dışı erişim yok", async () => {
    const c = await o.giris();
    const kR = await o.anahtarUret("rozet", c);
    const kM = await o.anahtarUret("magaza", c);
    const is = await o.api(
      "POST",
      "/api/alan/rozet/is",
      { baslik: "Seri rozetleri", aciklama: "bronz gümüş altın" },
      c,
    );
    const isId = (is.json.is as { id: number }).id;
    const { anahtar: sR, gelen: g } = await o.sshKanali("rozet", c);
    mkdirSync(join(g, "seri"), { recursive: true });
    const t = (await calistirKomut(cli(kR, g), "talimat-oku")) as { alan: string };
    expect(t.alan).toBe("rozet");
    expect(((await calistirKomut(cli(kR, g), "isleri-listele")) as { isler: unknown[] }).isler).toHaveLength(
      1,
    );
    await expect(calistirKomut(cli(kM, g), `is-oku ${isId}`)).rejects.toThrow(/bulunamadı/);
    writeFileSync(join(g, "seri/bronz.png"), gorsel(256, 256));
    writeFileSync(
      join(g, "seri/teslim.json"),
      JSON.stringify({
        tur: "yeni",
        ogeler: [
          {
            ad: "Bronz",
            dosyalar: [{ dosya: "bronz.png", hedefYol: "apps/client/public/assets/badges/bronz.webp" }],
          },
        ],
      }),
    );
    // Paket komutları SSH kanal anahtarıyla tek istekte (site gelen/'i kendisi okur); MCP anahtarı reddedilir.
    await expect(calistirKomut(cli(kR, g), "on-kontrol seri")).rejects.toThrow(/geçersiz/);
    const on = (await calistirKomut(cli(sR, g), "on-kontrol seri")) as { ogeler: { sonuc: string }[] };
    expect(on.ogeler[0]?.sonuc).not.toBe("kaldi");
    expect(existsSync(join(g, "seri"))).toBe(true);
    const ts = (await calistirKomut(cli(sR, g), "teslim-et seri")) as { ogeler: { durum: string }[] };
    expect(ts.ogeler[0]?.durum).toBe("bekliyor");
    expect(existsSync(join(g, "seri"))).toBe(false);
    const y = (await calistirKomut(cli(kR, g, '{"esik":3}'), "dosya-yukle kayit.json")) as { tur: string };
    expect(y.tur).toBe("json");
    await expect(calistirKomut(cli("um_rozet_gecersiz", g), "talimat-oku")).rejects.toThrow(CliHatasi);
  });
});
