/**
 * SSH kanalı (UM-G3, sözleşme bölüm 7), sitenin tarafı:
 * - Sahip alana SSH açık anahtarı ekler/kaldırır. Site `URETIM_SSH_YETKI_DIR/<alan>.authorized_keys` dosyasını
 *   (`restrict` önekiyle) ve alanın SSH kanal anahtarını (`<alan>.anahtar`, 0600) yazar; sunucudaki eşitleme betiği
 *   (deploy/uretim/ssh/eslestir.sh) bunları sshd'nin ve chroot'un yerine kopyalar.
 * - `URETIM_SSH_KOK/<alan>/gelen/<paket>/` klasörüne bırakılan ve içinde `TAMAM` olan paket alınır, ön kontrolden
 *   geçirilir, sonuç `okunur/sonuclar/<paket>.json`a yazılır ve paket klasörden kaldırılır.
 * - `okunur/` altına talimat, işler, geri bildirim ve katalog kopyası yazılır.
 * Bağlantı (sembolik/sert) ve klasör dışına çıkan her dosya reddedilir.
 */
import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Anahtarlar } from "./anahtar.js";
import type { Db } from "./db.js";
import type { Denetim } from "./denetim.js";
import { kayit } from "./http.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { ALAN_IDLERI, type AlanId, alanTanimi } from "./ortak/alanlar.js";
import { teslimAyristir } from "./teslimGirdisi.js";

export const PAKET_ADI = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const DOSYA_ADI = /^[a-z0-9][a-z0-9._-]{0,119}$/;
const EN_COK_PAKET_DOSYASI = 41;
const EN_COK_PAKET_BOYUTU = 200 * 1024 * 1024;
const ANAHTAR_TURLERI = [
  "ssh-ed25519",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "ssh-rsa",
];

export interface AcikAnahtar {
  tur: string;
  govde: string;
  parmakIzi: string;
}

/** `tur base64 [açıklama]` biçimi; seçenek öneki, satır sonu ve kısa RSA reddedilir. */
export function acikAnahtarAyristir(metin: string): AcikAnahtar | null {
  const t = metin.trim();
  if (t.length > 4096 || /[\r\n\0]/.test(t)) return null;
  const [tur, govde] = t.split(/\s+/);
  if (!tur || !govde || !ANAHTAR_TURLERI.includes(tur) || !/^[A-Za-z0-9+/]+={0,2}$/.test(govde)) return null;
  const blob = Buffer.from(govde, "base64");
  if (blob.length < 4) return null;
  const n = blob.readUInt32BE(0);
  if (n !== tur.length || blob.toString("latin1", 4, 4 + n) !== tur) return null;
  if (tur === "ssh-rsa" && blob.length < 390) return null;
  return {
    tur,
    govde,
    parmakIzi: `SHA256:${createHash("sha256").update(blob).digest("base64").replace(/=+$/, "")}`,
  };
}

export interface SshAyar {
  /** Sitenin anahtar dosyalarını yazdığı klasör (eşitleme betiği okur). Boşsa SSH kanalı kapalı. */
  yetkiDir: string | null;
  /** Chroot kökü: `<alan>/gelen`, `<alan>/okunur`. */
  kok: string | null;
}

export class SshKanal {
  constructor(
    private readonly db: Db,
    private readonly denetim: Denetim,
    private readonly anahtarlar: Anahtarlar,
    private readonly merkez: Merkez,
    readonly ayar: SshAyar,
  ) {}

  get acik(): boolean {
    return this.ayar.yetkiDir !== null;
  }

  liste(alan: AlanId): { id: number; parmakIzi: string; aciklama: string; olusturma: number; tur: string }[] {
    return (
      this.db
        .prepare(
          "SELECT id, acik, parmak_izi, aciklama, olusturma FROM ssh_anahtar WHERE alan = ? ORDER BY id",
        )
        .all(alan) as {
        id: number;
        acik: string;
        parmak_izi: string;
        aciklama: string;
        olusturma: number;
      }[]
    ).map((r) => ({
      id: r.id,
      parmakIzi: r.parmak_izi,
      aciklama: r.aciklama,
      olusturma: r.olusturma,
      tur: r.acik.split(" ")[0] ?? "",
    }));
  }

  async ekle(
    alan: AlanId,
    metin: string,
    aciklama: string,
    kim: string,
    now: number,
  ): Promise<{ parmakIzi: string }> {
    if (!this.acik) throw new IsHatasi(503, "SSH kanalı bu sunucuda açık değil.");
    const a = acikAnahtarAyristir(metin);
    if (!a) throw new IsHatasi(400, "Açık anahtar tanınmadı. ssh-ed25519 ile başlayan tek satırı yapıştır.");
    if (this.liste(alan).length >= 5) throw new IsHatasi(409, "Bir alana en çok 5 SSH anahtarı eklenebilir.");
    try {
      this.db
        .prepare(
          "INSERT INTO ssh_anahtar (alan, acik, parmak_izi, aciklama, olusturma) VALUES (?, ?, ?, ?, ?)",
        )
        .run(alan, `${a.tur} ${a.govde}`, a.parmakIzi, aciklama.slice(0, 60), now);
    } catch {
      throw new IsHatasi(409, "Bu anahtar bu alanda zaten var.");
    }
    this.denetim.yaz(now, kim, "ssh_anahtari_eklendi", alan, a.parmakIzi);
    await this.yetkiYaz(alan, now, kim);
    return { parmakIzi: a.parmakIzi };
  }

  async kaldir(alan: AlanId, id: number, kim: string, now: number): Promise<void> {
    const r = this.db
      .prepare("DELETE FROM ssh_anahtar WHERE id = ? AND alan = ? RETURNING parmak_izi")
      .get(id, alan) as { parmak_izi: string } | undefined;
    if (!r) throw new IsHatasi(404, "Anahtar bulunamadı.");
    this.denetim.yaz(now, kim, "ssh_anahtari_kaldirildi", alan, r.parmak_izi);
    await this.yetkiYaz(alan, now, kim);
  }

  /** Alanın SSH kanal anahtarını yeniler (eskisi hemen geçersiz olur). */
  async kanalAnahtariYenile(alan: AlanId, kim: string, now: number): Promise<void> {
    if (!this.ayar.yetkiDir) throw new IsHatasi(503, "SSH kanalı bu sunucuda açık değil.");
    await rm(join(this.ayar.yetkiDir, `${alan}.anahtar`), { force: true });
    await this.yetkiYaz(alan, now, kim);
  }

  private async yetkiYaz(alan: AlanId, now: number, kim: string): Promise<void> {
    const dir = this.ayar.yetkiDir;
    if (!dir) return;
    await mkdir(dir, { recursive: true });
    const anahtarlar = this.db
      .prepare("SELECT id, acik FROM ssh_anahtar WHERE alan = ? ORDER BY id")
      .all(alan) as { id: number; acik: string }[];
    const yetkili = join(dir, `${alan}.authorized_keys`);
    const kanal = join(dir, `${alan}.anahtar`);
    if (!anahtarlar.length) {
      await rm(yetkili, { force: true });
      await rm(kanal, { force: true });
      this.anahtarlar.sshIptal(alan, now);
      return;
    }
    const satirlar = anahtarlar.map((k) => `restrict ${k.acik} uretim-${alan}-${k.id}`);
    await atomikYaz(yetkili, `${satirlar.join("\n")}\n`, 0o644);
    let var_ = true;
    try {
      await lstat(kanal);
    } catch {
      var_ = false;
    }
    if (!var_) {
      this.anahtarlar.sshIptal(alan, now);
      const { anahtar } = this.anahtarlar.uret(alan, "ssh", now, kim);
      await atomikYaz(kanal, `${anahtar}\n`, 0o600);
    }
  }

  // ---- gelen / okunur ------------------------------------------------------------------------------------

  private alanKoku(alan: AlanId): string | null {
    return this.ayar.kok ? resolve(this.ayar.kok, alan) : null;
  }

  /** SSH kanal anahtarının kimliği (gelen paketler bu anahtarla sayılır). */
  private sshAnahtarId(alan: AlanId): number | null {
    const r = this.db
      .prepare(
        "SELECT id FROM anahtar WHERE alan = ? AND kanal = 'ssh' AND iptal IS NULL ORDER BY id DESC LIMIT 1",
      )
      .get(alan) as { id: number } | undefined;
    return r?.id ?? null;
  }

  /** Bütün alanların `gelen/` klasörünü tarar. İşlenen paket sayısı. */
  async gelenTara(now: number): Promise<number> {
    if (!this.ayar.kok) return 0;
    let n = 0;
    for (const alan of ALAN_IDLERI) {
      const kok = this.alanKoku(alan);
      if (!kok) continue;
      const gelen = join(kok, "gelen");
      let adlar: string[];
      try {
        adlar = await readdir(gelen);
      } catch {
        continue;
      }
      for (const ad of adlar) {
        if (!PAKET_ADI.test(ad)) continue;
        const yol = join(gelen, ad);
        const st = await lstat(yol).catch(() => null);
        if (!st?.isDirectory()) continue;
        const tamam = await lstat(join(yol, "TAMAM")).catch(() => null);
        if (!tamam?.isFile()) continue;
        const sonuc = await this.paketIsle(alan, yol, now).catch((err: unknown) => ({
          hatalar: [err instanceof IsHatasi ? err.message : "Paket işlenemedi."],
        }));
        await this.okunurYaz(alan, `sonuclar/${ad}.json`, JSON.stringify(sonuc, null, 2));
        await rm(yol, { recursive: true, force: true });
        n += 1;
      }
    }
    return n;
  }

  /** Paket klasörünü okur: yalnız düz dosyalar, bağlantı yok, alt klasör yok, boyut sınırlı. */
  async paketIsle(alan: AlanId, yol: string, now: number): Promise<unknown> {
    const kok = this.alanKoku(alan);
    if (!kok || !resolve(yol).startsWith(join(kok, "gelen") + sep))
      throw new IsHatasi(400, "Paket yolu geçersiz.");
    const adlar = await readdir(yol);
    if (adlar.length > EN_COK_PAKET_DOSYASI + 2) throw new IsHatasi(400, "Pakette çok fazla dosya var.");
    const dosyalar = new Map<string, Buffer>();
    let toplam = 0;
    let teslimJson: unknown = null;
    for (const ad of adlar) {
      const p = join(yol, ad);
      const st = await lstat(p);
      if (st.isSymbolicLink() || !st.isFile() || st.nlink > 1)
        throw new IsHatasi(
          400,
          `"${ad.slice(0, 60)}" düz bir dosya değil (bağlantı ve klasör kabul edilmez).`,
        );
      if (ad === "TAMAM") continue;
      if (!DOSYA_ADI.test(ad)) throw new IsHatasi(400, `Dosya adı geçersiz: "${ad.slice(0, 60)}".`);
      toplam += st.size;
      if (toplam > EN_COK_PAKET_BOYUTU) throw new IsHatasi(413, "Paket çok büyük.");
      const veri = await readFile(p);
      if (ad === "teslim.json") {
        try {
          teslimJson = JSON.parse(veri.toString("utf8"));
        } catch {
          throw new IsHatasi(400, "teslim.json okunamadı.");
        }
      } else dosyalar.set(ad, veri);
    }
    if (!kayit(teslimJson)) throw new IsHatasi(400, "Pakette teslim.json yok.");
    const anahtarId = this.sshAnahtarId(alan);
    // Dosya adlarını yükleyip dosya kimliklerine çevir.
    const kimlikler = new Map<string, string>();
    const ogeler = Array.isArray(teslimJson.ogeler) ? teslimJson.ogeler : [];
    for (const o of ogeler) {
      if (!kayit(o) || !Array.isArray(o.dosyalar)) continue;
      o.dosyalar = await Promise.all(
        o.dosyalar.map(async (d: unknown) => {
          if (!kayit(d) || typeof d.dosya !== "string") return d;
          const veri = dosyalar.get(d.dosya);
          if (!veri) throw new IsHatasi(400, `teslim.json'daki "${d.dosya.slice(0, 60)}" pakette yok.`);
          let id = kimlikler.get(d.dosya);
          if (!id) {
            if (anahtarId !== null && !this.anahtarlar.dosyaIzni(anahtarId, now))
              throw new IsHatasi(429, "Günlük dosya sınırı doldu.");
            id = (await this.merkez.yukle(alan, anahtarId, d.dosya, veri, now)).dosyaId;
            kimlikler.set(d.dosya, id);
          }
          const { dosya: _d, ...kalan } = d;
          return { ...kalan, dosyaId: id };
        }),
      );
    }
    const p = teslimAyristir(teslimJson, alanTanimi(alan));
    if (!p.ok) return { sonuc: "kaldi", hatalar: p.hatalar };
    const r = await this.merkez.teslimEt(alan, "mcp", anahtarId, p.deger, false, now, `yz:${alan}:ssh`, { kanal: "ssh", ad: "SSH (gelen klasörü)" });
    return {
      teslimId: r.teslimId,
      ogeler: r.ogeler.map((o) => ({
        ad: o.ad,
        ogeId: o.ogeId,
        sonuc: o.sonuc,
        durum: o.durum,
        satirlar: o.satirlar.filter((s) => s.sonuc !== "gecti"),
      })),
    };
  }

  private async okunurYaz(alan: AlanId, gorece: string, icerik: string): Promise<void> {
    const kok = this.alanKoku(alan);
    if (!kok) return;
    const okunur = join(kok, "okunur");
    const p = resolve(okunur, gorece);
    if (!p.startsWith(okunur + sep)) return;
    await mkdir(resolve(p, ".."), { recursive: true });
    await atomikYaz(p, icerik, 0o644);
  }

  /** SSH anahtarı olan alanların `okunur/` kopyalarını tazeler. */
  async okunurTazele(now: number): Promise<void> {
    if (!this.ayar.kok) return;
    const alanlar = (
      this.db.prepare("SELECT DISTINCT alan FROM ssh_anahtar").all() as { alan: AlanId }[]
    ).map((r) => r.alan);
    for (const alan of alanlar) {
      const t = this.merkez.yzTalimati(alan, now);
      await this.okunurYaz(alan, "talimat.md", t.metin);
      await this.okunurYaz(
        alan,
        "isler.json",
        JSON.stringify({ isler: this.merkez.isler(alan, ["acik"]) }, null, 2),
      );
      await this.okunurYaz(
        alan,
        "geri-bildirim.json",
        JSON.stringify({ notlar: this.merkez.geriBildirim(alan, 100) }, null, 2),
      );
      try {
        await this.okunurYaz(
          alan,
          "katalog.json",
          JSON.stringify(await this.merkez.katalog.alanKatalogu(alan, now), null, 2),
        );
      } catch {
        // Katalog alınamazsa eski kopya kalır.
      }
    }
  }
}

async function atomikYaz(yol: string, icerik: string, mod: number): Promise<void> {
  const gecici = `${yol}.${process.pid}.gecici`;
  await writeFile(gecici, icerik, { mode: mod });
  await chmod(gecici, mod);
  await rename(gecici, yol);
}
