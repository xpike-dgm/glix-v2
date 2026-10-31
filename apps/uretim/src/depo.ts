/**
 * İçerik adresli dosya deposu (UM-A2): her dosya sha256 özetiyle saklanır (`ab/abcdef…`); aynı dosya iki kez
 * gelirse tek kopya tutulur. Kota ve 90 gün temizliği burada.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { type Db, json } from "./db.js";
import type { DosyaTuru } from "./ortak/alanlar.js";
import type { DosyaMeta, OgeDosyasi } from "./ortak/tipler.js";

export const OZET = /^[a-f0-9]{64}$/;
export const TEMIZLIK_GUN = 90;
const GUN = 24 * 3600 * 1000;

export const ozetAl = (veri: Buffer): string => createHash("sha256").update(veri).digest("hex");

export class Depo {
  private readonly kok: string;

  constructor(
    dir: string,
    private readonly db: Db,
  ) {
    this.kok = resolve(dir);
  }

  /** Özetin dosya yolu; özet biçimi bozuksa hata (yol enjeksiyonu yok). */
  yol(ozet: string): string {
    if (!OZET.test(ozet)) throw new Error("özet geçersiz");
    const p = resolve(join(this.kok, ozet.slice(0, 2), ozet));
    if (!p.startsWith(this.kok + sep)) throw new Error("yol dışarı taşıyor");
    return p;
  }

  async koy(veri: Buffer, tur: DosyaTuru, meta: DosyaMeta | null, now: number): Promise<string> {
    const ozet = ozetAl(veri);
    const var_ = this.db.prepare("SELECT ozet FROM dosya WHERE ozet = ?").get(ozet);
    if (!var_) {
      const p = this.yol(ozet);
      await mkdir(join(this.kok, ozet.slice(0, 2)), { recursive: true });
      const gecici = `${p}.${process.pid}.gecici`;
      await writeFile(gecici, veri);
      await rename(gecici, p);
      this.db
        .prepare("INSERT INTO dosya (ozet, tur, boyut, meta, ilk, son) VALUES (?, ?, ?, ?, ?, ?)")
        .run(ozet, tur, veri.length, meta ? JSON.stringify(meta) : null, now, now);
    } else this.db.prepare("UPDATE dosya SET son = ? WHERE ozet = ?").run(now, ozet);
    return ozet;
  }

  oku(ozet: string): Promise<Buffer> {
    return readFile(this.yol(ozet));
  }

  bilgi(ozet: string): { tur: DosyaTuru; boyut: number; meta: DosyaMeta | null; ilk: number } | null {
    if (!OZET.test(ozet)) return null;
    const r = this.db.prepare("SELECT tur, boyut, meta, ilk FROM dosya WHERE ozet = ?").get(ozet) as
      | { tur: DosyaTuru; boyut: number; meta: string | null; ilk: number }
      | undefined;
    return r ? { tur: r.tur, boyut: r.boyut, meta: json<DosyaMeta | null>(r.meta, null), ilk: r.ilk } : null;
  }

  kullanilan(): number {
    const r = this.db.prepare("SELECT COALESCE(SUM(boyut), 0) AS t FROM dosya").get() as { t: number };
    return Number(r.t);
  }

  /**
   * Reddedilen, geri dönen ve arşivlenen öğelerin dosyaları 90 gün sonra silinir. Hâlâ bir canlı öğede, onaylananlarda
   * ya da son 90 günün bir yüklemesinde geçen dosya silinmez. Silinen dosya sayısını döner.
   */
  async temizle(now: number): Promise<number> {
    const sinir = now - TEMIZLIK_GUN * GUN;
    const tut = new Set<string>();
    const ogeler = this.db.prepare("SELECT durum, guncelleme, dosyalar FROM oge").all() as {
      durum: string;
      guncelleme: number;
      dosyalar: string;
    }[];
    for (const o of ogeler) {
      const eski = (o.durum === "reddedildi" || o.durum === "arsiv" || o.durum === "kaldi") && o.guncelleme < sinir;
      if (eski) continue;
      for (const d of json<OgeDosyasi[]>(o.dosyalar, [])) tut.add(d.ozet);
    }
    for (const r of this.db.prepare("SELECT ozet FROM yukleme WHERE olusturma >= ?").all(sinir) as { ozet: string }[])
      tut.add(r.ozet);
    const adaylar = this.db.prepare("SELECT ozet FROM dosya WHERE son < ?").all(sinir) as { ozet: string }[];
    let silinen = 0;
    for (const { ozet } of adaylar) {
      if (tut.has(ozet)) continue;
      await rm(this.yol(ozet), { force: true });
      this.db.prepare("DELETE FROM dosya WHERE ozet = ?").run(ozet);
      silinen += 1;
    }
    this.db.prepare("DELETE FROM yukleme WHERE olusturma < ?").run(sinir);
    return silinen;
  }
}
