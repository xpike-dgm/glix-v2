/**
 * Ortam içerik aktarımı, içe aktarma yarısı ve sahte hesaplar (UM-O1/O2). Yalnız test ortamlarının kendi kabının
 * imajıyla, sunucu durmuşken çalışır (bkz. `deploy/ortamlar/ortak.sh`):
 *
 *   node dist/ortamYenile.js --icerik /icerik.json [--sifirla] [--sahte-hesaplar]
 *
 * - `--icerik`: `ortamIcerikDisa` paketini doğrular ve izin listesindeki içerik tablolarını birebir değiştirir.
 * - `--sifirla`: veritabanını (hesaplar, ilerleme, istatistik) tamamen siler; şema baştan kurulur (oyun alanı).
 * - `--sahte-hesaplar`: sahte hesapları (zengin, yeni oyuncu, tüm rozetler) güncel kataloğa göre yeniden üretir.
 *   Ortak şifre `GLIX_SAHTE_SIFRE` ortam değişkeninden okunur, hiçbir yere yazılmaz.
 *
 * `GLIX_ORTAM` test ya da test2 değilse hiçbir şey yapmadan çıkar (canlı veritabanına asla yazmaz).
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { COSMETIC_ITEMS, COSMETIC_TYPES, isEquippable } from "@glix/engine";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN } from "./auth.js";
import { BADGES } from "./badges.js";
import { isTestOrtam, parseOrtam } from "./ortam.js";
import {
  ICERIK_PAKET_SURUMU,
  ICERIK_TABLOLARI,
  type IcerikPaketi,
  type IcerikSatiri,
} from "./ortamIcerikDisa.js";
import { createStats, loadSqlite } from "./statsStore.js";

/** Paketteki bir tablonun en çok satır sayısı (bozuk ya da şişmiş paket reddedilir). */
export const ICERIK_SATIR_SINIRI = 200_000;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Paketi sıkı doğrular: yalnız izin listesindeki tablolar, birebir sütunlar, düz değerler, izinli anahtarlar. */
export function icerikPaketiDogrula(raw: unknown): IcerikPaketi {
  if (!isRecord(raw) || raw.surum !== ICERIK_PAKET_SURUMU) throw new Error("İçerik paketi sürümü tanınmadı");
  if (typeof raw.alindi !== "number" || !Number.isFinite(raw.alindi)) throw new Error("İçerik paketi bozuk");
  if (!isRecord(raw.tablolar)) throw new Error("İçerik paketi bozuk");
  const tablolar: Record<string, IcerikSatiri[]> = {};
  for (const [ad, satirlar] of Object.entries(raw.tablolar)) {
    const tanim = ICERIK_TABLOLARI.find((t) => t.tablo === ad);
    if (!tanim) throw new Error(`İçerik paketinde izin verilmeyen tablo: ${ad}`);
    if (!Array.isArray(satirlar) || satirlar.length > ICERIK_SATIR_SINIRI)
      throw new Error(`İçerik paketi bozuk: ${ad}`);
    tablolar[ad] = satirlar.map((s) => {
      if (!isRecord(s)) throw new Error(`İçerik paketi bozuk: ${ad}`);
      const anahtarlar = Object.keys(s);
      if (anahtarlar.length !== tanim.sutunlar.length || !tanim.sutunlar.every((c) => c in s))
        throw new Error(`İçerik paketinde beklenmeyen sütunlar: ${ad}`);
      const satir: IcerikSatiri = {};
      for (const c of tanim.sutunlar) {
        const v = s[c];
        if (v !== null && typeof v !== "string" && !(typeof v === "number" && Number.isFinite(v)))
          throw new Error(`İçerik paketinde geçersiz değer: ${ad}.${c}`);
        satir[c] = v;
      }
      if (tanim.yalniz && !tanim.yalniz.degerler.includes(String(satir[tanim.yalniz.sutun])))
        throw new Error(`İçerik paketinde izin verilmeyen satır: ${ad}`);
      return satir;
    });
  }
  return { surum: ICERIK_PAKET_SURUMU, alindi: raw.alindi, tablolar };
}

/**
 * İçerik tablolarını paketteki hâle getirir (tek işlem). Pakette olmayan tabloya dokunulmaz; `yalniz` tanımlı
 * tabloda yalnız izinli anahtarlar silinip yeniden yazılır (ör. duyuru ve bakım kipi yerinde kalır).
 * Şema önceden kurulmuş olmalıdır (`createAccounts`). Tablo başına yazılan satır sayısını döner.
 */
export function icerikIceAktar(path: string, paket: IcerikPaketi): Record<string, number> {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(path);
  const sayilar: Record<string, number> = {};
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const t of ICERIK_TABLOLARI) {
        const satirlar = paket.tablolar[t.tablo];
        if (!satirlar) continue;
        if (t.yalniz) {
          db.prepare(
            `DELETE FROM ${t.tablo} WHERE ${t.yalniz.sutun} IN (${t.yalniz.degerler.map(() => "?").join(", ")})`,
          ).run(...t.yalniz.degerler);
        } else {
          db.prepare(`DELETE FROM ${t.tablo}`).run();
        }
        const ekle = db.prepare(
          `INSERT INTO ${t.tablo} (${t.sutunlar.join(", ")}) VALUES (${t.sutunlar.map(() => "?").join(", ")})`,
        );
        for (const s of satirlar) ekle.run(...t.sutunlar.map((c) => s[c] ?? null));
        sayilar[t.tablo] = satirlar.length;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  } finally {
    db.close();
  }
  return sayilar;
}

/** Veritabanı dosyasını ve WAL eklerini siler (oyun alanının gece sıfırlaması). */
export function veritabaniniSil(path: string): void {
  for (const p of [path, `${path}-wal`, `${path}-shm`]) rmSync(p, { force: true });
}

export type SahteHesapTuru = "zengin" | "yeni" | "rozetli";

export interface SahteHesap {
  tur: SahteHesapTuru;
  kullaniciAdi: string;
  eposta: string;
}

/** Sahte hesaplar. E-postalar `.invalid` alan adındadır (hiçbir gerçek adrese gidemez; e-posta zaten kapalı). */
export const SAHTE_HESAPLAR: readonly SahteHesap[] = [
  { tur: "zengin", kullaniciAdi: "Zengin", eposta: "zengin@oyun-alani.invalid" },
  { tur: "yeni", kullaniciAdi: "YeniOyuncu", eposta: "yeni@oyun-alani.invalid" },
  { tur: "rozetli", kullaniciAdi: "Rozetli", eposta: "rozetli@oyun-alani.invalid" },
];

/** Zengin hesabın Glix bakiyesi. */
export const ZENGIN_GLIX = 1_000_000;
/** Rozetli hesabın bakiyesi (rozet ödüllerine yakın, mağazada birkaç ürün alınabilsin). */
export const ROZETLI_GLIX = 5_000;

export interface SahteHesapSonucu {
  kullaniciAdi: string;
  id: number;
  urun: number;
  rozet: number;
  glix: number;
}

/**
 * Sahte hesapları siler ve güncel kataloğa göre yeniden kurar: zengin (her ürün sahip, her türden biri kuşanılmış,
 * bol Glix), yeni oyuncu (boş), rozetli (her rozet). Başka hesaplara dokunmaz.
 */
export function sahteHesaplariUret(store: AccountStore, passHash: string, now: number): SahteHesapSonucu[] {
  const sonuc: SahteHesapSonucu[] = [];
  for (const h of SAHTE_HESAPLAR) {
    for (const eski of [store.findByUsername(h.kullaniciAdi), store.findByEmail(h.eposta)])
      if (eski) store.deleteAccount(eski.id);
    const made = store.create(h.kullaniciAdi, h.eposta, passHash, now);
    if (!made.ok) throw new Error(`Sahte hesap kurulamadı: ${h.kullaniciAdi}`);
    const id = made.account.id;
    store.markVerified(id);
    let urun = 0;
    let rozet = 0;
    if (h.tur === "zengin") {
      for (const item of COSMETIC_ITEMS) if (store.grantCosmetic(id, item.id, now) === "granted") urun += 1;
      for (const t of COSMETIC_TYPES) {
        if (!isEquippable(t)) continue;
        const ilk = COSMETIC_ITEMS.find((i) => i.type === t.id);
        if (ilk) store.equipCosmetic(id, t.id, ilk.id);
      }
      store.setGlixBalance(id, ZENGIN_GLIX, "oyun alanı", now, ZENGIN_GLIX);
    } else if (h.tur === "rozetli") {
      rozet = store.awardBadges(
        id,
        BADGES.map((b) => b.id),
        now,
      ).length;
      store.setGlixBalance(id, ROZETLI_GLIX, "oyun alanı", now, ROZETLI_GLIX);
    }
    sonuc.push({ kullaniciAdi: h.kullaniciAdi, id, urun, rozet, glix: store.glixBalance(id) });
  }
  return sonuc;
}

export interface YenileSecenekleri {
  path: string;
  icerik: IcerikPaketi | null;
  sifirla: boolean;
  /** Sahte hesap şifresi; null ise sahte hesaplara dokunulmaz. */
  sahteSifre: string | null;
  now: number;
}

export interface YenileSonucu {
  sifirlandi: boolean;
  icerik: Record<string, number> | null;
  sahte: SahteHesapSonucu[];
}

/** Sırayla: (isteğe bağlı) sıfırla → şemayı kur → içeriği yaz → sahte hesapları üret. */
export async function ortamYenile(o: YenileSecenekleri): Promise<YenileSonucu> {
  if (o.sahteSifre !== null && (o.sahteSifre.length < PASSWORD_MIN || o.sahteSifre.length > PASSWORD_MAX))
    throw new Error("GLIX_SAHTE_SIFRE uzunluğu geçersiz");
  if (o.sifirla) veritabaniniSil(o.path);
  // Şema: sunucunun kendi göçleri (hesap ve istatistik tabloları aynı dosyada).
  createStats(o.path).close();
  createAccounts(o.path).close();
  const icerik = o.icerik ? icerikIceAktar(o.path, o.icerik) : null;
  let sahte: SahteHesapSonucu[] = [];
  if (o.sahteSifre !== null) {
    const hash = await hashPassword(o.sahteSifre);
    const store = createAccounts(o.path);
    try {
      sahte = sahteHesaplariUret(store, hash, o.now);
    } finally {
      store.close();
    }
  }
  return { sifirlandi: o.sifirla, icerik, sahte };
}

/** Komut satırı: yalnız test ortamlarında çalışır. */
export async function ortamYenileKomut(argv: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  const ortam = parseOrtam(env.GLIX_ORTAM);
  if (!isTestOrtam(ortam)) {
    process.stderr.write("Bu araç yalnız test ortamlarında çalışır (GLIX_ORTAM=test ya da test2).\n");
    return 2;
  }
  let icerikYolu: string | null = null;
  let sifirla = false;
  let sahte = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--icerik") {
      icerikYolu = argv[i + 1] ?? null;
      i += 1;
    } else if (a === "--sifirla") sifirla = true;
    else if (a === "--sahte-hesaplar") sahte = true;
    else {
      process.stderr.write(`Bilinmeyen seçenek: ${a}\n`);
      return 2;
    }
  }
  const sahteSifre = sahte ? (env.GLIX_SAHTE_SIFRE ?? "") : null;
  if (sahte && !sahteSifre) {
    process.stderr.write("GLIX_SAHTE_SIFRE tanımlı değil.\n");
    return 2;
  }
  const path = env.ACCOUNTS_DB || env.STATS_DB || "/data/glix.db";
  if (icerikYolu !== null && !existsSync(icerikYolu)) {
    process.stderr.write("İçerik paketi bulunamadı.\n");
    return 2;
  }
  const icerik = icerikYolu ? icerikPaketiDogrula(JSON.parse(readFileSync(icerikYolu, "utf8"))) : null;
  const sonuc = await ortamYenile({ path, icerik, sifirla, sahteSifre, now: Date.now() });
  // Yalnız sayılar ve kullanıcı adları yazılır (şifre ya da içerik metni yok).
  process.stdout.write(`${JSON.stringify({ ortam, ...sonuc })}\n`);
  return 0;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  ortamYenileKomut(process.argv.slice(2), process.env).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
