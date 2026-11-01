/**
 * Alan başına teslim anahtarı (UM-G2): sitede üretilir, bir kez gösterilir, yalnız özeti saklanır; iptal edilebilir.
 * Biçim `um_<alan>_<43 karakter>`. Anahtar başına hız sınırı: dakikada 60 istek, günde 500 dosya.
 * SSH kanalının anahtarı (`kanal = "ssh"`) aynı yetkidedir; site onu kurulum betiğinin okuyacağı dosyaya yazar.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Db } from "./db.js";
import { type Denetim, kisaOzet } from "./denetim.js";
import { ozet } from "./giris.js";
import { Kasa } from "./gizli.js";
import { type AlanId, isAlanId } from "./ortak/alanlar.js";

export const DAKIKA_ISTEK = 60;
export const GUNLUK_DOSYA = 500;
const ANAHTAR = /^um_([a-z-]+)_([A-Za-z0-9_-]{43})$/;

export interface AnahtarKimligi {
  id: number;
  alan: AlanId;
  kanal: "mcp" | "ssh";
  /** Sahibin verdiği ad (ör. "ChatGPT", "OpenCode"); araç başına ayrı anahtar. */
  ad: string;
}

export class Anahtarlar {
  private readonly pencere = new Map<number, number[]>();

  constructor(
    private readonly db: Db,
    private readonly denetim: Denetim,
    private readonly kasa: Kasa = new Kasa(null),
  ) {}

  /** Şifreli kaydı olan, iptal edilmemiş MCP anahtarının açık hâli (yalnız istem kopyalanırken). */
  coz(id: number, alan: AlanId): string | null {
    const r = this.db
      .prepare("SELECT sifreli FROM anahtar WHERE id = ? AND alan = ? AND iptal IS NULL AND kanal = 'mcp'")
      .get(id, alan) as { sifreli: string | null } | undefined;
    return r?.sifreli ? this.kasa.coz(r.sifreli) : null;
  }

  uret(
    alan: AlanId,
    kanal: "mcp" | "ssh",
    now: number,
    kim: string,
    ad = "",
  ): { id: number; anahtar: string } {
    const anahtar = `um_${alan}_${randomBytes(32).toString("base64url")}`;
    const o = ozet(anahtar);
    const r = this.db
      .prepare(
        "INSERT INTO anahtar (alan, ozet, onek, olusturma, kanal, ad, sifreli) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        alan,
        o,
        anahtar.slice(0, alan.length + 8),
        now,
        kanal,
        ad || (kanal === "ssh" ? "SSH" : "MCP"),
        kanal === "mcp" && this.kasa.acik ? this.kasa.sifrele(anahtar) : null,
      );
    this.denetim.yaz(now, kim, "anahtar_uretildi", alan, `${kanal} ${ad} ${kisaOzet(o)}`);
    return { id: Number(r.lastInsertRowid), anahtar };
  }

  iptal(id: number, alan: AlanId, now: number, kim: string): boolean {
    const r = this.db
      .prepare("UPDATE anahtar SET iptal = ? WHERE id = ? AND alan = ? AND iptal IS NULL")
      .run(now, id, alan);
    if (r.changes > 0) this.denetim.yaz(now, kim, "anahtar_iptal", alan, String(id));
    return r.changes > 0;
  }

  /** Alanın SSH anahtarlarını iptal eder (yenilemeden önce). */
  sshIptal(alan: AlanId, now: number): void {
    this.db
      .prepare("UPDATE anahtar SET iptal = ? WHERE alan = ? AND kanal = 'ssh' AND iptal IS NULL")
      .run(now, alan);
  }

  /** Bearer değerini doğrular. Biçim, özet ve iptal denetimi; alan anahtarın içinden değil kayıttan gelir. */
  dogrula(deger: string | null, now: number): AnahtarKimligi | null {
    if (!deger) return null;
    const m = ANAHTAR.exec(deger);
    if (!m) return null;
    const o = ozet(deger);
    const r = this.db.prepare("SELECT id, alan, ozet, iptal, kanal, ad FROM anahtar WHERE ozet = ?").get(o) as
      | { id: number; alan: string; ozet: string; iptal: number | null; kanal: string; ad: string }
      | undefined;
    if (!r || r.iptal !== null || !isAlanId(r.alan)) return null;
    if (!timingSafeEqual(Buffer.from(r.ozet, "hex"), Buffer.from(o, "hex"))) return null;
    this.db.prepare("UPDATE anahtar SET son_kullanim = ? WHERE id = ?").run(now, r.id);
    return { id: r.id, alan: r.alan, kanal: r.kanal === "ssh" ? "ssh" : "mcp", ad: r.ad };
  }

  /** Dakikada 60 istek (kayan pencere, bellekte). */
  istekIzni(id: number, now: number): boolean {
    const p = (this.pencere.get(id) ?? []).filter((t) => now - t < 60_000);
    if (p.length >= DAKIKA_ISTEK) {
      this.pencere.set(id, p);
      return false;
    }
    p.push(now);
    this.pencere.set(id, p);
    return true;
  }

  /**
   * Son 24 saatte bu anahtarla yüklenen farklı dosya (içerik özeti) sayısı sınırın altında mı. Aynı içeriğin yeniden
   * yüklenmesi (ön kontrol, tekrar deneme) sayılmaz.
   */
  dosyaIzni(id: number, now: number): boolean {
    const r = this.db
      .prepare("SELECT COUNT(DISTINCT ozet) AS n FROM yukleme WHERE anahtar_id = ? AND olusturma > ?")
      .get(id, now - 24 * 3600 * 1000) as { n: number };
    return Number(r.n) < GUNLUK_DOSYA;
  }

  liste(alan: AlanId): {
    id: number;
    onek: string;
    olusturma: number;
    iptal: number | null;
    sonKullanim: number | null;
    kanal: string;
    ad: string;
  }[] {
    return (
      this.db
        .prepare(
          "SELECT id, onek, olusturma, iptal, son_kullanim, kanal, ad FROM anahtar WHERE alan = ? ORDER BY id DESC",
        )
        .all(alan) as {
        id: number;
        onek: string;
        olusturma: number;
        iptal: number | null;
        son_kullanim: number | null;
        kanal: string;
        ad: string;
      }[]
    ).map((r) => ({
      id: r.id,
      onek: r.onek,
      olusturma: r.olusturma,
      iptal: r.iptal,
      sonKullanim: r.son_kullanim,
      kanal: r.kanal,
      ad: r.ad,
    }));
  }
}
