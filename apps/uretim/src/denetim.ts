/**
 * Denetim kaydı (UM-G7): kim, ne zaman, ne yaptı. 1 yıl saklanır. Anahtarlar ve kodlar kayda yalnız özetleriyle
 * (ilk 12 hane) yazılır; ayrıntı alanına ham anahtar asla verilmez.
 */
import type { Db } from "./db.js";

export const DENETIM_SAKLAMA_MS = 365 * 24 * 3600 * 1000;

export type DenetimEylemi =
  | "giris_kodu_istendi"
  | "giris_kodu_reddedildi"
  | "giris"
  | "cikis"
  | "anahtar_uretildi"
  | "anahtar_iptal"
  | "ssh_anahtari_eklendi"
  | "ssh_anahtari_kaldirildi"
  | "teslim"
  | "elle_teslim"
  | "onay"
  | "ret"
  | "duzeltme"
  | "aktarim"
  | "aktarim_geri_al"
  | "paket"
  | "paket_oyuna_eklendi"
  | "is"
  | "talimat"
  | "istek_karti"
  | "kod_istegi"
  | "ayar"
  | "istem_kopyalandi";

export type DenetimDinleyici = (eylem: DenetimEylemi, hedef: string, ayrinti: string) => void;

export class Denetim {
  private readonly dinleyiciler: DenetimDinleyici[] = [];

  constructor(private readonly db: Db) {}

  /** Her kayıttan sonra çağrılır (canlı güncelleme olayları). */
  dinle(f: DenetimDinleyici): void {
    this.dinleyiciler.push(f);
  }

  yaz(now: number, kim: string, eylem: DenetimEylemi, hedef = "", ayrinti = ""): void {
    this.db
      .prepare("INSERT INTO denetim (zaman, kim, eylem, hedef, ayrinti) VALUES (?, ?, ?, ?, ?)")
      .run(now, kim.slice(0, 120), eylem, hedef.slice(0, 200), ayrinti.slice(0, 500));
    for (const f of this.dinleyiciler) {
      try {
        f(eylem, hedef, ayrinti);
      } catch {
        // Dinleyici hatası kaydı bozmaz.
      }
    }
  }

  sayfa(
    onceki: number | null,
    sinir: number,
  ): { id: number; zaman: number; kim: string; eylem: string; hedef: string; ayrinti: string }[] {
    return this.db
      .prepare(
        "SELECT id, zaman, kim, eylem, hedef, ayrinti FROM denetim WHERE id < ? ORDER BY id DESC LIMIT ?",
      )
      .all(onceki ?? Number.MAX_SAFE_INTEGER, sinir) as {
      id: number;
      zaman: number;
      kim: string;
      eylem: string;
      hedef: string;
      ayrinti: string;
    }[];
  }

  temizle(now: number): void {
    this.db.prepare("DELETE FROM denetim WHERE zaman < ?").run(now - DENETIM_SAKLAMA_MS);
  }
}

/** Anahtar/kod özetinin kayda yazılan kısa hâli. */
export const kisaOzet = (ozet: string): string => ozet.slice(0, 12);
