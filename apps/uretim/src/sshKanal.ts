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

import { createHash, randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { Anahtarlar } from "./anahtar.js";
import type { Db } from "./db.js";
import type { Denetim } from "./denetim.js";
import { ozet } from "./giris.js";
import { cryptTuzu, Kasa, parolaUret, sha512Crypt } from "./gizli.js";
import { kayit } from "./http.js";
import { IsHatasi, type Merkez } from "./merkez.js";
import { ALAN_IDLERI, type AlanId, alanTanimi } from "./ortak/alanlar.js";
import { EN_COK_PAKET_DOSYASI, EN_COK_PAKET_MB } from "./ortak/paketBicimi.js";
import { teslimAyristir } from "./teslimGirdisi.js";

export const PAKET_ADI = /^[a-z0-9][a-z0-9._-]{0,80}$/;
const DOSYA_ADI = /^[a-z0-9][a-z0-9._-]{0,119}$/;
/** Paket sınırları (ortak/paketBicimi.ts; talimat ve ornek-paket aynı sayıları yazar). */
const EN_COK_PAKET_BOYUTU = EN_COK_PAKET_MB * 1024 * 1024;
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

export const YENILEME_GUNLERI = [7, 30, 90] as const;
const GUN_MS = 24 * 3600 * 1000;

export interface GirisKaydi {
  zaman: string;
  basarili: boolean;
  yontem: string;
  ip: string;
}

/**
 * `ssh/girisler.sh` satırı: `ISO_ZAMAN|basarili|başarısız|kullanıcı|yöntem|ip`. IP'nin son parçası gizlenir.
 * Biçime uymayan satır yok sayılır.
 */
export function girisSatiri(satir: string, kullanici: string): GirisKaydi | null {
  const p = satir.trim().split("|");
  if (p.length !== 5) return null;
  const [zaman, sonuc, k, yontem, ip] = p as [string, string, string, string, string];
  if (
    k !== kullanici ||
    !/^\d{4}-\d{2}-\d{2}T[\d:.+\-Z]+$/.test(zaman) ||
    (sonuc !== "basarili" && sonuc !== "basarisiz")
  )
    return null;
  const maske = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)
    ? ip.replace(/\.\d{1,3}$/, ".x")
    : /^[0-9a-f:]+$/i.test(ip)
      ? `${ip.split(":").slice(0, 3).join(":")}::x`
      : "";
  return {
    zaman,
    basarili: sonuc === "basarili",
    yontem: /^(password|publickey)$/.test(yontem) ? yontem : "",
    ip: maske,
  };
}

export interface SshAyar {
  /** Sitenin anahtar dosyalarını yazdığı klasör (eşitleme betiği okur). Boşsa SSH kanalı kapalı. */
  yetkiDir: string | null;
  /** Chroot kökü: `<alan>/gelen`, `<alan>/okunur`. */
  kok: string | null;
  /** Sunucudaki giriş kayıtları dosyası (salt okunur). */
  gunluk?: string | null;
}

export class SshKanal {
  constructor(
    private readonly db: Db,
    private readonly denetim: Denetim,
    private readonly anahtarlar: Anahtarlar,
    private readonly merkez: Merkez,
    readonly ayar: SshAyar,
    private readonly kasa: Kasa = new Kasa(null),
  ) {}

  // ---- SSH parolası (sözleşme bölüm 9) --------------------------------------------------------------------

  get parolaAcik(): boolean {
    return this.acik && this.kasa.acik;
  }

  parolaDurumu(alan: AlanId): { var: boolean; olusturma: number | null; yenilemeGun: number | null } {
    const r = this.db.prepare("SELECT olusturma, yenileme_gun FROM ssh_parola WHERE alan = ?").get(alan) as
      | { olusturma: number; yenileme_gun: number | null }
      | undefined;
    return { var: !!r, olusturma: r?.olusturma ?? null, yenilemeGun: r?.yenileme_gun ?? null };
  }

  /** Yeni parola: özet + şifreli kayıt; sistem için yalnız SHA-512 crypt özeti eşitleyiciye yazılır. */
  async parolaYenile(alan: AlanId, kim: string, now: number): Promise<void> {
    if (!this.parolaAcik || !this.ayar.yetkiDir)
      throw new IsHatasi(503, "SSH parolası bu sunucuda ayarlı değil.");
    const p = parolaUret(28);
    const gun = this.parolaDurumu(alan).yenilemeGun;
    this.db
      .prepare(
        "INSERT INTO ssh_parola (alan, ozet, sifreli, olusturma, yenileme_gun) VALUES (?, ?, ?, ?, ?) ON CONFLICT(alan) DO UPDATE SET ozet = excluded.ozet, sifreli = excluded.sifreli, olusturma = excluded.olusturma",
      )
      .run(alan, ozet(p), this.kasa.sifrele(p), now, gun);
    await mkdir(this.ayar.yetkiDir, { recursive: true });
    // Yalnız özet: kullanıcı adını eşitleme betiği kendisi kurar (dosyadan asla almaz).
    await atomikYaz(join(this.ayar.yetkiDir, `${alan}.parola`), `${sha512Crypt(p, cryptTuzu())}\n`, 0o600);
    // Parola yenilenince kanal anahtarı da yenilenir: eski parolayla okunmuş anahtar artık çalışmaz.
    await rm(join(this.ayar.yetkiDir, `${alan}.anahtar`), { force: true });
    await this.yetkiYaz(alan, now, kim);
    this.denetim.yaz(now, kim, "ssh_anahtari_eklendi", alan, "SSH parolası ve kanal anahtarı yenilendi");
  }

  parolaYenilemeAyarla(alan: AlanId, gun: number | null, kim: string, now: number): void {
    if (gun !== null && !(YENILEME_GUNLERI as readonly number[]).includes(gun))
      throw new IsHatasi(400, "Yenileme 7, 30 ya da 90 gün olabilir.");
    const r = this.db.prepare("UPDATE ssh_parola SET yenileme_gun = ? WHERE alan = ?").run(gun, alan);
    if (r.changes === 0) throw new IsHatasi(409, "Önce bir parola oluştur.");
    this.denetim.yaz(now, kim, "ayar", alan, `SSH parolası kendiliğinden yenileme: ${gun ?? "kapalı"}`);
  }

  /** Açık parola: yalnız kopyalama anında, sahip oturumunda. */
  parolaCoz(alan: AlanId): string | null {
    const r = this.db.prepare("SELECT sifreli FROM ssh_parola WHERE alan = ?").get(alan) as
      | { sifreli: string }
      | undefined;
    return r ? this.kasa.coz(r.sifreli) : null;
  }

  /** Süresi dolan parolaları kendiliğinden yeniler. Yenilenen alan sayısı. */
  async parolalariYenile(now: number): Promise<number> {
    if (!this.parolaAcik) return 0;
    const r = this.db
      .prepare("SELECT alan, olusturma, yenileme_gun FROM ssh_parola WHERE yenileme_gun IS NOT NULL")
      .all() as {
      alan: AlanId;
      olusturma: number;
      yenileme_gun: number;
    }[];
    let n = 0;
    for (const x of r)
      if (now - x.olusturma >= x.yenileme_gun * GUN_MS) {
        await this.parolaYenile(x.alan, "otomatik", now);
        n += 1;
      }
    return n;
  }

  /** Alan kullanıcısının son girişleri (en yeni üstte). */
  async girisler(alan: AlanId, sinir = 30): Promise<GirisKaydi[]> {
    if (!this.ayar.gunluk) return [];
    let metin: string;
    try {
      metin = await readFile(this.ayar.gunluk, "utf8");
    } catch {
      return [];
    }
    const out: GirisKaydi[] = [];
    for (const s of metin.split("\n").slice(-5000).reverse()) {
      const g = girisSatiri(s, `uretim-${alan}`);
      if (g) out.push(g);
      if (out.length >= sinir) break;
    }
    return out;
  }

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
    if (anahtarlar.length) {
      const satirlar = anahtarlar.map((k) => `restrict ${k.acik} uretim-${alan}-${k.id}`);
      await atomikYaz(yetkili, `${satirlar.join("\n")}\n`, 0o644);
    } else await rm(yetkili, { force: true });
    // Kanal anahtarı, alana anahtarla ya da parolayla giriş varsa durur.
    if (!anahtarlar.length && !this.parolaDurumu(alan).var) {
      await rm(kanal, { force: true });
      this.anahtarlar.sshIptal(alan, now);
      return;
    }
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
        // Paket önce yapay zekânın giremediği, sitenin kendi klasörüne taşınır; işlem orada yapılır (yarış yok).
        const isleniyor = join(kok, "okunur", ISLENIYOR);
        await mkdir(isleniyor, { recursive: true, mode: 0o700 });
        await chmod(isleniyor, 0o700);
        const ara = join(isleniyor, `${ad}.${randomBytes(6).toString("hex")}`);
        try {
          await rename(yol, ara);
        } catch {
          continue;
        }
        const sonuc = await this.paketIsle(alan, ara, now).catch((err: unknown) => ({
          hatalar: [err instanceof IsHatasi ? err.message : "Paket işlenemedi."],
        }));
        await this.okunurYaz(alan, `sonuclar/${ad}.json`, JSON.stringify(sonuc, null, 2));
        await rm(ara, { recursive: true, force: true });
        n += 1;
      }
    }
    return n;
  }

  /**
   * SSH komut aracının tek isteği (`ssh_paket`): `gelen/<paket>/` klasörünü site kendisi okur; dosyalar tek tek
   * yüklenmez (60 istek/dk sınırına takılmaz). Paket önce yapay zekânın giremediği klasöre taşınır (yarış ve bağ
   * yok), işlenir; ön kontrolde yerine geri konur, teslimde silinir. Alan her zaman anahtardan gelir.
   */
  async sshPaket(
    alan: AlanId,
    paket: string,
    islem: "on_kontrol" | "teslim",
    uretimYontemi: unknown,
    anahtar: { id: number; ad: string },
    now: number,
  ): Promise<unknown> {
    const kok = this.alanKoku(alan);
    if (!kok) throw new IsHatasi(503, "SSH kanalı bu sunucuda açık değil.");
    if (!PAKET_ADI.test(paket)) throw new IsHatasi(400, "Paket adı geçersiz.");
    const yol = join(kok, "gelen", paket);
    const st = await lstat(yol).catch(() => null);
    if (!st) throw new IsHatasi(404, `Paket bulunamadı: ${paket}.`);
    if (st.isSymbolicLink() || !st.isDirectory())
      throw new IsHatasi(400, "Paket düz bir klasör olmalı (bağlantı kabul edilmez).");
    const isleniyor = join(kok, "okunur", ISLENIYOR);
    await mkdir(isleniyor, { recursive: true, mode: 0o700 });
    await chmod(isleniyor, 0o700);
    const ara = join(isleniyor, `${paket}.${randomBytes(6).toString("hex")}`);
    await rename(yol, ara);
    try {
      const st2 = await lstat(ara);
      if (st2.isSymbolicLink() || !st2.isDirectory())
        throw new IsHatasi(400, "Paket düz bir klasör olmalı (bağlantı kabul edilmez).");
      const icerik = await this.paketOku(ara);
      if (uretimYontemi !== undefined) icerik.teslimJson.uretimYontemi = uretimYontemi;
      return await this.paketCalistir(alan, icerik, islem === "on_kontrol", anahtar, now);
    } finally {
      if (islem === "teslim") await rm(ara, { recursive: true, force: true });
      else
        await rename(ara, yol).catch(async () => {
          // Yapay zekâ aynı adla yeni klasör açtıysa eskisi yan ada konur.
          await rename(ara, `${yol}.kontrol-${randomBytes(3).toString("hex")}`).catch(() =>
            rm(ara, { recursive: true, force: true }),
          );
        });
    }
  }

  /** Paket klasörünü okur: yalnız düz dosyalar, bağlantı yok, alt klasör yok, sayı ve boyut sınırlı. */
  private async paketOku(
    yol: string,
  ): Promise<{ teslimJson: Record<string, unknown>; dosyalar: Map<string, Buffer> }> {
    const adlar = await readdir(yol);
    const sayi = adlar.filter((x) => x !== "TAMAM" && x !== "teslim.json").length;
    if (sayi > EN_COK_PAKET_DOSYASI)
      throw new IsHatasi(400, `Pakette en çok ${EN_COK_PAKET_DOSYASI} dosya olabilir (gelen ${sayi}).`);
    const dosyalar = new Map<string, Buffer>();
    let toplam = 0;
    let teslimJson: unknown = null;
    for (const ad of adlar) {
      if (ad !== "TAMAM" && !DOSYA_ADI.test(ad))
        throw new IsHatasi(400, `Dosya adı geçersiz: "${ad.slice(0, 60)}".`);
      const veri = await duzDosyaOku(join(yol, ad), EN_COK_PAKET_BOYUTU - toplam);
      if (veri === null)
        throw new IsHatasi(
          400,
          `"${ad.slice(0, 60)}" düz bir dosya değil (bağlantı, aygıt ve klasör kabul edilmez).`,
        );
      if (veri === "buyuk")
        throw new IsHatasi(413, `Paket çok büyük (toplam en çok ${EN_COK_PAKET_BOYUTU / 1024 / 1024} MB).`);
      if (ad === "TAMAM") continue;
      toplam += veri.length;
      if (ad === "teslim.json") {
        try {
          teslimJson = JSON.parse(veri.toString("utf8"));
        } catch {
          throw new IsHatasi(400, "teslim.json okunamadı (geçerli JSON değil).");
        }
      } else dosyalar.set(ad, veri);
    }
    if (!kayit(teslimJson)) {
      const baska = [...dosyalar.keys()].find((x) => x.endsWith(".json"));
      throw new IsHatasi(
        400,
        `Pakette teslim.json yok${baska ? ` (${baska.slice(0, 60)} değil)` : ""}. Biçim için: uretim ornek-paket`,
      );
    }
    return { teslimJson, dosyalar };
  }

  /** Paketteki `dosya` adlarını yükleyip kimliğe çevirir, ön kontrol ya da teslim yapar. */
  private async paketCalistir(
    alan: AlanId,
    p0: { teslimJson: Record<string, unknown>; dosyalar: Map<string, Buffer> },
    kuru: boolean,
    anahtar: { id: number; ad: string } | null,
    now: number,
  ): Promise<unknown> {
    const { teslimJson, dosyalar } = p0;
    const anahtarId = anahtar?.id ?? this.sshAnahtarId(alan);
    // Önce bütün adlar denetlenir (eksik dosya varsa hiçbiri yüklenmez, günlük sınır boşa harcanmaz).
    const ogeler = Array.isArray(teslimJson.ogeler) ? teslimJson.ogeler : [];
    for (const o of ogeler)
      if (kayit(o) && Array.isArray(o.dosyalar))
        for (const d of o.dosyalar)
          if (kayit(d) && typeof d.dosya === "string" && !dosyalar.has(d.dosya))
            throw new IsHatasi(400, `Pakette dosya bulunamadı: ${d.dosya.slice(0, 120)}.`);
    const kimlikler = new Map<string, string>();
    for (const o of ogeler) {
      if (!kayit(o) || !Array.isArray(o.dosyalar)) continue;
      const yeni: unknown[] = [];
      for (const d of o.dosyalar as unknown[]) {
        if (!kayit(d) || typeof d.dosya !== "string") {
          yeni.push(d);
          continue;
        }
        const veri = dosyalar.get(d.dosya) as Buffer;
        let id = kimlikler.get(d.dosya);
        if (!id) {
          if (anahtarId !== null && !this.anahtarlar.dosyaIzni(anahtarId, now))
            throw new IsHatasi(429, "Günlük dosya sınırı (500) doldu; yarın yeniden dene.");
          id = (await this.merkez.yukle(alan, anahtarId, d.dosya, veri, now)).dosyaId;
          kimlikler.set(d.dosya, id);
        }
        const { dosya: _d, ...kalan } = d;
        yeni.push({ ...kalan, dosyaId: id });
      }
      o.dosyalar = yeni;
    }
    const p = teslimAyristir(teslimJson, alanTanimi(alan));
    if (!p.ok) return { sonuc: "kaldi", hatalar: p.hatalar };
    const r = await this.merkez.teslimEt(alan, "mcp", anahtarId, p.deger, kuru, now, `yz:${alan}:ssh`, {
      kanal: "ssh",
      ad: anahtar?.ad ?? "SSH (gelen klasörü)",
    });
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

  /** `TAMAM` ile bırakılan paket (taşınmış kopyası): okunur ve teslim edilir. */
  async paketIsle(alan: AlanId, yol: string, now: number): Promise<unknown> {
    const kok = this.alanKoku(alan);
    if (!kok || !resolve(yol).startsWith(join(kok, "okunur", ISLENIYOR) + sep))
      throw new IsHatasi(400, "Paket yolu geçersiz.");
    const kst = await lstat(yol);
    if (!kst.isDirectory()) throw new IsHatasi(400, "Paket yolu geçersiz.");
    return this.paketCalistir(alan, await this.paketOku(yol), false, null, now);
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

/** İşlenen paketlerin taşındığı, yalnız sitenin girebildiği klasör (`okunur/` altında, 0700). */
const ISLENIYOR = ".isleniyor";

/**
 * Bağ takip etmeden açar (O_NOFOLLOW, aygıt/FIFO için O_NONBLOCK), açık tanıtıcıdan doğrular (yalnız düz dosya, tek
 * sert bağ) ve en çok `enCok` bayt okur. Düz dosya değilse null, sınırı aşarsa "buyuk".
 */
export async function duzDosyaOku(yol: string, enCok: number): Promise<Buffer | null | "buyuk"> {
  let fd: Awaited<ReturnType<typeof open>>;
  try {
    fd = await open(yol, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    return null;
  }
  try {
    const st = await fd.stat();
    if (!st.isFile() || st.nlink !== 1) return null;
    if (st.size > enCok) return "buyuk";
    const buf = Buffer.alloc(st.size);
    let n = 0;
    while (n < st.size) {
      const { bytesRead } = await fd.read(buf, n, st.size - n, n);
      if (bytesRead === 0) break;
      n += bytesRead;
    }
    return buf.subarray(0, n);
  } finally {
    await fd.close();
  }
}

async function atomikYaz(yol: string, icerik: string, mod: number): Promise<void> {
  const gecici = `${yol}.${process.pid}.gecici`;
  await writeFile(gecici, icerik, { mode: mod });
  await chmod(gecici, mod);
  await rename(gecici, yol);
}
