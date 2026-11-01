/**
 * Sahip girişi (UM-G1): izinli e-postaya 6 haneli kod; 10 dk geçerli, en çok 5 deneme, iki istek arası 60 sn.
 * Güvenilir cihazda oturum 30 gün, değilse 12 saat (tarayıcı kapanınca da biter). Kod ve oturum belirteci
 * veritabanında yalnız özet olarak durur; günlüğe ve denetim kaydına ham hâli yazılmaz.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Db } from "./db.js";
import { type Denetim, kisaOzet } from "./denetim.js";

export const KOD_SURESI_MS = 10 * 60 * 1000;
export const KOD_DENEME = 5;
export const KOD_ARALIGI_MS = 60 * 1000;
export const KOD_GUNLUK = 10;
export const OTURUM_GUVENILIR_MS = 30 * 24 * 3600 * 1000;
export const OTURUM_KISA_MS = 12 * 3600 * 1000;
export const OTURUM_CEREZI = "uretim_oturum";
const GUN_MS = 24 * 3600 * 1000;

export interface Postaci {
  gonder(alici: string, konu: string, metin: string, html: string): Promise<boolean>;
}

export type FetchBenzeri = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    redirect: "manual";
    signal: AbortSignal;
  },
) => Promise<{ status: number }>;

/** Resend HTTPS API'si (oyunla aynı servis, aynı anahtar değişkenleri). */
export function resendPostaci(
  anahtar: string,
  gonderen: string,
  fetchImpl: FetchBenzeri = fetch as unknown as FetchBenzeri,
): Postaci {
  return {
    async gonder(alici, konu, metin, html) {
      try {
        const r = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${anahtar}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: gonderen, to: [alici], subject: konu, text: metin, html }),
          redirect: "manual",
          signal: AbortSignal.timeout(10_000),
        });
        return r.status >= 200 && r.status < 300;
      } catch {
        return false;
      }
    },
  };
}

export const ozet = (v: string): string => createHash("sha256").update(v).digest("hex");
const ayniHex = (a: string, b: string): boolean => {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
};

export function kodEpostasi(kod: string): { konu: string; metin: string; html: string } {
  const st = "font-family:Arial,Helvetica,sans-serif;";
  return {
    konu: "GLIX Üretim Merkezi — giriş kodu",
    metin: `Üretim Merkezi giriş kodun: ${kod}\n\nKod 10 dakika geçerli ve bir kez kullanılır.\nBu isteği sen yapmadıysan bu e-postayı yok say.`,
    html: `<!doctype html><html lang="tr"><body style="margin:0;padding:24px;background:#111318;${st}"><div style="max-width:480px;margin:0 auto;padding:28px;background:#1a1d24;border-radius:14px;color:#e8eaf0;${st}"><h1 style="margin:0 0 16px;font-size:22px;color:#fff;">Üretim Merkezi giriş kodu</h1><p style="margin:0 0 24px;font-size:34px;letter-spacing:8px;font-weight:bold;color:#33d6e8;">${kod}</p><p style="margin:0;font-size:13px;color:#a4a9b6;">Kod 10 dakika geçerli ve bir kez kullanılır. Bu isteği sen yapmadıysan bu e-postayı yok say.</p></div></body></html>`,
  };
}

export type KodSonucu = "gonderildi" | "izinsiz" | "erken" | "posta_yok" | "posta_hatasi";
export type DogrulaSonucu =
  | { ok: true; belirtec: string; sure: number | null }
  | { ok: false; neden: "hatali" | "kilitli" | "suresi_doldu" };

export class Giris {
  constructor(
    private readonly db: Db,
    private readonly denetim: Denetim,
    private readonly izinli: readonly string[],
    private readonly postaci: Postaci | null,
  ) {}

  izinliMi(eposta: string): boolean {
    return this.izinli.includes(eposta);
  }

  async kodIste(eposta: string, now: number): Promise<KodSonucu> {
    if (!this.izinliMi(eposta)) return "izinsiz";
    if (!this.postaci) return "posta_yok";
    // Sınırlar veritabanında: süreç yeniden başlasa da günlük kod sayısı ve aralık korunur.
    const r = this.db
      .prepare("SELECT COUNT(*) AS n, MAX(zaman) AS son FROM giris_istegi WHERE eposta = ? AND zaman > ?")
      .get(eposta, now - GUN_MS) as { n: number; son: number | null };
    if ((r.son !== null && now - r.son < KOD_ARALIGI_MS) || r.n >= KOD_GUNLUK) return "erken";
    this.db.prepare("INSERT INTO giris_istegi (eposta, zaman) VALUES (?, ?)").run(eposta, now);
    const kod = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const e = kodEpostasi(kod);
    if (!(await this.postaci.gonder(eposta, e.konu, e.metin, e.html))) {
      this.denetim.yaz(now, eposta, "giris_kodu_istendi", "", "e-posta gönderilemedi");
      return "posta_hatasi";
    }
    const tuz = randomBytes(16).toString("hex");
    this.db
      .prepare(
        "INSERT INTO giris_kodu (eposta, tuz, ozet, bitis, deneme, olusturma) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(eposta) DO UPDATE SET tuz = excluded.tuz, ozet = excluded.ozet, bitis = excluded.bitis, deneme = 0, olusturma = excluded.olusturma",
      )
      .run(eposta, tuz, ozet(tuz + kod), now + KOD_SURESI_MS, now);
    this.denetim.yaz(now, eposta, "giris_kodu_istendi");
    return "gonderildi";
  }

  dogrula(eposta: string, kod: string, guvenilir: boolean, now: number): DogrulaSonucu {
    const r = this.db
      .prepare("SELECT tuz, ozet, bitis, deneme FROM giris_kodu WHERE eposta = ?")
      .get(eposta) as { tuz: string; ozet: string; bitis: number; deneme: number } | undefined;
    if (!r || r.bitis < now || !this.izinliMi(eposta)) {
      this.denetim.yaz(now, eposta, "giris_kodu_reddedildi", "", "süresi doldu");
      return { ok: false, neden: "suresi_doldu" };
    }
    if (r.deneme >= KOD_DENEME) return { ok: false, neden: "kilitli" };
    if (!ayniHex(ozet(r.tuz + kod), r.ozet)) {
      this.db.prepare("UPDATE giris_kodu SET deneme = deneme + 1 WHERE eposta = ?").run(eposta);
      this.denetim.yaz(now, eposta, "giris_kodu_reddedildi", "", "hatalı kod");
      return { ok: false, neden: r.deneme + 1 >= KOD_DENEME ? "kilitli" : "hatali" };
    }
    this.db.prepare("DELETE FROM giris_kodu WHERE eposta = ?").run(eposta);
    const belirtec = randomBytes(32).toString("base64url");
    const sure = guvenilir ? OTURUM_GUVENILIR_MS : OTURUM_KISA_MS;
    this.db
      .prepare("INSERT INTO oturum (ozet, eposta, olusturma, bitis, guvenilir) VALUES (?, ?, ?, ?, ?)")
      .run(ozet(belirtec), eposta, now, now + sure, guvenilir ? 1 : 0);
    this.denetim.yaz(now, eposta, "giris", kisaOzet(ozet(belirtec)), guvenilir ? "güvenilir cihaz" : "");
    return { ok: true, belirtec, sure: guvenilir ? sure : null };
  }

  /** Çerezdeki belirtecin sahibi; geçersizse null. */
  oturum(belirtec: string | null, now: number): string | null {
    if (!belirtec) return null;
    const r = this.db.prepare("SELECT eposta, bitis FROM oturum WHERE ozet = ?").get(ozet(belirtec)) as
      | { eposta: string; bitis: number }
      | undefined;
    if (!r || r.bitis < now || !this.izinliMi(r.eposta)) return null;
    return r.eposta;
  }

  cikis(belirtec: string, now: number): void {
    const e = this.oturum(belirtec, now);
    this.db.prepare("DELETE FROM oturum WHERE ozet = ?").run(ozet(belirtec));
    if (e) this.denetim.yaz(now, e, "cikis");
  }

  temizle(now: number): void {
    this.db.prepare("DELETE FROM oturum WHERE bitis < ?").run(now);
    this.db.prepare("DELETE FROM giris_kodu WHERE bitis < ?").run(now);
    this.db.prepare("DELETE FROM giris_istegi WHERE zaman < ?").run(now - GUN_MS);
  }
}

export function oturumCerezi(belirtec: string, sureMs: number | null, guvenli: boolean): string {
  const omur = sureMs === null ? "" : `; Max-Age=${Math.floor(sureMs / 1000)}`;
  return `${OTURUM_CEREZI}=${belirtec}; HttpOnly; SameSite=Strict; Path=/${omur}${guvenli ? "; Secure" : ""}`;
}
