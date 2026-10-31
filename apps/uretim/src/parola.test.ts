/** Sözleşme bölüm 9: SSH parolası, yer tutuculu istem, kopyalamada doldurma, modele sır gitmemesi, giriş kayıtları. */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Kasa, sha512Crypt } from "./gizli.js";
import type { AiFetch } from "./istekYaz.js";
import { girisSatiri } from "./sshKanal.js";
import { type Ortam, ortamKur } from "./test/ortam.js";


describe("kasa ve crypt", () => {
  it("şifreli kayıt yalnız aynı anahtarla çözülür; SHA-512 crypt glibc vektörüyle aynı", () => {
    const k = new Kasa("anahtar-0123456789abcdef");
    const s = k.sifrele("gizli-deger");
    expect(s).not.toContain("gizli");
    expect(k.coz(s)).toBe("gizli-deger");
    expect(new Kasa("baska-anahtar-0123456789").coz(s)).toBeNull();
    expect(new Kasa(null).acik).toBe(false);
    expect(sha512Crypt("Hello world!", "saltstring")).toBe(
      "$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1",
    );
  });

  it("giriş kaydı satırı ayrıştırılır, IP'nin sonu gizlenir", () => {
    expect(girisSatiri("2026-10-31T21:00:00+03:00|basarisiz|uretim-magaza|password|203.0.113.45", "uretim-magaza")).toEqual({
      zaman: "2026-10-31T21:00:00+03:00",
      basarili: false,
      yontem: "password",
      ip: "203.0.113.x",
    });
    expect(girisSatiri("2026-10-31T21:00:00+03:00|basarili|uretim-rozet|publickey|1.2.3.4", "uretim-magaza")).toBeNull();
    expect(girisSatiri("bozuk satır", "uretim-magaza")).toBeNull();
  });
});

describe("SSH parolası ve istem", () => {
  let o: Ortam;
  afterEach(async () => {
    await o.kapat();
  });
  it("parola üretilir, yalnız özet + şifreli kayıt saklanır, eşitleyiciye crypt özeti yazılır; kopyalamada doldurulur", async () => {
    o = await ortamKur({ ssh: true, gizli: true });
    const c = await o.giris();
    expect((await o.api("POST", "/api/alan/magaza/ssh-parola", { yenile: true }, c)).durum).toBe(200);
    const kop = await o.api("POST", "/api/alan/magaza/parola-kopyala", {}, c);
    const parola = String(kop.json.parola);
    expect(parola).toMatch(/^[A-Za-z0-9]{28}$/);
    expect(JSON.stringify(o.u.merkez.db.prepare("SELECT * FROM ssh_parola").all())).not.toContain(parola);
    const dosya = join(o.dir, "ssh-yetki/magaza.parola");
    expect(statSync(dosya).mode & 0o777).toBe(0o600);
    const satir = readFileSync(dosya, "utf8").trim();
    const m = /^uretim-magaza:(\$6\$([./A-Za-z0-9]{16})\$[./A-Za-z0-9]{86})$/.exec(satir);
    expect(m).not.toBeNull();
    expect(sha512Crypt(parola, m?.[2] ?? "")).toBe(m?.[1]);
    expect(readFileSync(dosya, "utf8")).not.toContain(parola);

    const is = ((await o.api("POST", "/api/alan/magaza/is", { baslik: "Neon Gece", ozet: "Neon Gece: 6 ürün" }, c)).json.is as { id: number }).id;
    const ekran = await o.api("GET", `/api/alan/magaza/istem?is=${is}`, undefined, c);
    const ist = ekran.json.istemler as { ssh: string; mcp: string };
    expect(ist.ssh).toContain("Parola: ••••");
    expect(ist.ssh).toContain("uretim-magaza@dgmcraft.online");
    expect(JSON.stringify(ekran.json)).not.toContain(parola);
    const k = String((await o.api("POST", "/api/alan/magaza/anahtar", { ad: "ChatGPT" }, c)).json.anahtar);
    const kid = ((await o.api("GET", "/api/alan/magaza", undefined, c)).json.anahtarlar as { id: number; ad: string }[]).find((x) => x.ad === "ChatGPT")?.id;
    const ssh = await o.api("POST", "/api/alan/magaza/istem-kopyala", { baglanti: "ssh", is }, c);
    expect(String(ssh.json.metin)).toContain(`Parola: ${parola}`);
    const mcp = await o.api("POST", "/api/alan/magaza/istem-kopyala", { baglanti: "mcp", is, anahtarId: kid }, c);
    expect(String(mcp.json.metin)).toContain(k);
    expect(String(mcp.json.metin)).toContain("http://uretim.test/mcp");
    const denetim = JSON.stringify(o.u.merkez.db.prepare("SELECT * FROM denetim").all());
    expect(denetim).toContain("istem_kopyalandi");
    expect(denetim).not.toContain(parola);
    expect(denetim).not.toContain(k);
    // Yenileme eskisini geçersiz kılar.
    await o.api("POST", "/api/alan/magaza/ssh-parola", { yenile: true }, c);
    expect(String((await o.api("POST", "/api/alan/magaza/parola-kopyala", {}, c)).json.parola)).not.toBe(parola);
  });

  it("kendiliğinden yenileme (7/30/90, varsayılan kapalı)", async () => {
    o = await ortamKur({ ssh: true, gizli: true });
    const c = await o.giris();
    await o.api("POST", "/api/alan/ses/ssh-parola", { yenile: true }, c);
    expect((await o.api("GET", "/api/alan/ses", undefined, c)).json.sshParola).toMatchObject({ var: true, yenilemeGun: null });
    expect((await o.api("POST", "/api/alan/ses/ssh-parola", { yenilemeGun: 10 }, c)).durum).toBe(400);
    await o.api("POST", "/api/alan/ses/ssh-parola", { yenilemeGun: 7 }, c);
    const once = String((await o.api("POST", "/api/alan/ses/parola-kopyala", {}, c)).json.parola);
    o.saat.simdi += 6 * 86400_000;
    expect(await o.u.ssh.parolalariYenile(o.saat.simdi)).toBe(0);
    o.saat.simdi += 2 * 86400_000;
    expect(await o.u.ssh.parolalariYenile(o.saat.simdi)).toBe(1);
    expect(String((await o.api("POST", "/api/alan/ses/parola-kopyala", {}, c)).json.parola)).not.toBe(once);
  });

  it("modele (Haiku) parola ve anahtar asla gitmez", async () => {
    const govdeler: string[] = [];
    const sahte: AiFetch = async (_u, init) => {
      govdeler.push(init.body);
      return { status: 200, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ baslik: "Neon Gece", ozet: "Neon Gece: 6 ürün", aciklama: "x" }) }] }) };
    };
    o = await ortamKur({ ssh: true, gizli: true, aiFetch: sahte });
    const c = await o.giris();
    await o.api("POST", "/api/alan/magaza/ssh-parola", { yenile: true }, c);
    const parola = String((await o.api("POST", "/api/alan/magaza/parola-kopyala", {}, c)).json.parola);
    const k = String((await o.api("POST", "/api/alan/magaza/anahtar", { ad: "ChatGPT" }, c)).json.anahtar);
    const r = await o.api("POST", "/api/istek-yaz", { metin: "Neon gece için 6 ürün; SSH ile bağlanacak", alan: "magaza", baglanti: "ssh", fikirTuru: false }, c);
    expect(r.json.kaynak).toBe("model");
    expect(govdeler).toHaveLength(1);
    expect(govdeler[0]).not.toContain(parola);
    expect(govdeler[0]).not.toContain(k);
    expect(govdeler[0]).not.toMatch(/um_magaza_/);
  });

  it("giriş kayıtları alan sayfasında yalnız o alanın kullanıcısıyla görünür", async () => {
    o = await ortamKur({ ssh: true, gizli: true });
    writeFileSync(
      join(o.dir, "girisler.log"),
      [
        "2026-10-31T20:00:00+03:00|basarili|uretim-magaza|password|203.0.113.45",
        "2026-10-31T20:05:00+03:00|basarisiz|uretim-magaza|password|198.51.100.7",
        "2026-10-31T20:06:00+03:00|basarili|uretim-rozet|publickey|10.0.0.1",
      ].join("\n"),
    );
    const c = await o.giris();
    const g = (await o.api("GET", "/api/alan/magaza", undefined, c)).json.girisler as { basarili: boolean; ip: string }[];
    expect(g).toEqual([
      { zaman: "2026-10-31T20:05:00+03:00", basarili: false, yontem: "password", ip: "198.51.100.x" },
      { zaman: "2026-10-31T20:00:00+03:00", basarili: true, yontem: "password", ip: "203.0.113.x" },
    ]);
  });
});
