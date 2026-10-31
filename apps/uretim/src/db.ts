/** Sitenin SQLite veritabanı (UM-A2): yerleşik `node:sqlite`, yeni bağımlılık yok. */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

type SqliteModule = typeof import("node:sqlite");

/** `node:sqlite` deneysel uyarısı günlüğü kirletmesin diye bastırılır (oyun sunucusuyla aynı desen). */
function loadSqlite(): SqliteModule {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : warning.message;
    if (/SQLite/i.test(text)) return;
    (original as (...a: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return createRequire(import.meta.url)("node:sqlite") as SqliteModule;
  } finally {
    process.emitWarning = original;
  }
}

const SEMA: readonly string[] = [
  // 1: ilk şema
  `
  CREATE TABLE giris_kodu (
    eposta TEXT PRIMARY KEY, tuz TEXT NOT NULL, ozet TEXT NOT NULL, bitis INTEGER NOT NULL,
    deneme INTEGER NOT NULL DEFAULT 0, olusturma INTEGER NOT NULL
  );
  CREATE TABLE oturum (
    ozet TEXT PRIMARY KEY, eposta TEXT NOT NULL, olusturma INTEGER NOT NULL, bitis INTEGER NOT NULL,
    guvenilir INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE anahtar (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, ozet TEXT NOT NULL UNIQUE, onek TEXT NOT NULL,
    olusturma INTEGER NOT NULL, iptal INTEGER, son_kullanim INTEGER
  );
  CREATE TABLE dosya (
    ozet TEXT PRIMARY KEY, tur TEXT NOT NULL, boyut INTEGER NOT NULL, meta TEXT,
    ilk INTEGER NOT NULL, son INTEGER NOT NULL
  );
  CREATE TABLE yukleme (
    id TEXT PRIMARY KEY, alan TEXT NOT NULL, anahtar_id INTEGER, ozet TEXT NOT NULL, ad TEXT NOT NULL,
    olusturma INTEGER NOT NULL
  );
  CREATE INDEX yukleme_anahtar ON yukleme(anahtar_id, olusturma);
  CREATE TABLE teslim (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, is_id INTEGER, tur TEXT NOT NULL, kaynak TEXT NOT NULL,
    anahtar_id INTEGER, aciklama TEXT NOT NULL DEFAULT '', olusturma INTEGER NOT NULL
  );
  CREATE TABLE oge (
    id INTEGER PRIMARY KEY, teslim_id INTEGER NOT NULL REFERENCES teslim(id), alan TEXT NOT NULL,
    is_id INTEGER, tur TEXT NOT NULL, ad TEXT NOT NULL, anahtar TEXT NOT NULL, aciklama TEXT NOT NULL,
    gerekce TEXT NOT NULL, durum TEXT NOT NULL, gorunum TEXT NOT NULL, surum INTEGER NOT NULL,
    onceki_id INTEGER, kaynak TEXT NOT NULL, dosyalar TEXT NOT NULL, satirlar TEXT NOT NULL,
    degisiklikler TEXT NOT NULL, kaldirilacaklar TEXT NOT NULL, onizleme TEXT, rapor TEXT,
    kontrol TEXT NOT NULL, sonuc TEXT NOT NULL, onayli_satirlar TEXT, paket_id INTEGER,
    olusturma INTEGER NOT NULL, karar INTEGER, guncelleme INTEGER NOT NULL
  );
  CREATE INDEX oge_alan_durum ON oge(alan, durum, olusturma);
  CREATE INDEX oge_anahtar ON oge(alan, anahtar);
  CREATE TABLE notlar (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, oge_id INTEGER, tur TEXT NOT NULL, hazir TEXT,
    metin TEXT NOT NULL, olusturma INTEGER NOT NULL
  );
  CREATE INDEX notlar_alan ON notlar(alan, olusturma);
  CREATE TABLE talimat (
    alan TEXT NOT NULL, surum INTEGER NOT NULL, metin TEXT NOT NULL, olusturma INTEGER NOT NULL,
    yazan TEXT NOT NULL, PRIMARY KEY (alan, surum)
  );
  CREATE TABLE talimat_oneri (
    alan TEXT NOT NULL, hazir TEXT NOT NULL, durum TEXT NOT NULL, guncelleme INTEGER NOT NULL,
    PRIMARY KEY (alan, hazir)
  );
  CREATE TABLE isler (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, baslik TEXT NOT NULL, aciklama TEXT NOT NULL,
    adet INTEGER, son_tarih TEXT, ornek TEXT NOT NULL DEFAULT '', kaynak TEXT NOT NULL, durum TEXT NOT NULL,
    sira INTEGER NOT NULL, olusturma INTEGER NOT NULL, istek_id INTEGER, ilgili_oge INTEGER
  );
  CREATE TABLE istek_karti (
    id INTEGER PRIMARY KEY, acan_alan TEXT NOT NULL, istenen_alan TEXT NOT NULL, ne TEXT NOT NULL,
    neden TEXT NOT NULL, son_tarih TEXT, durum TEXT NOT NULL, is_id INTEGER, sonuc_oge INTEGER,
    olusturma INTEGER NOT NULL
  );
  CREATE TABLE kod_istegi (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, baslik TEXT NOT NULL, gerekce TEXT NOT NULL,
    ornek TEXT NOT NULL, etki TEXT NOT NULL, durum TEXT NOT NULL, olusturma INTEGER NOT NULL
  );
  CREATE TABLE paket (
    id INTEGER PRIMARY KEY, klasor TEXT NOT NULL, olusturma INTEGER NOT NULL, oge_sayisi INTEGER NOT NULL,
    revizyon TEXT, durum TEXT NOT NULL
  );
  CREATE TABLE aktarim (
    id INTEGER PRIMARY KEY, oge_id INTEGER NOT NULL, tur TEXT NOT NULL, hedef TEXT NOT NULL,
    oyun_aktarim TEXT NOT NULL, ozet TEXT NOT NULL, olusturma INTEGER NOT NULL, geri_alindi INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE denetim (
    id INTEGER PRIMARY KEY, zaman INTEGER NOT NULL, kim TEXT NOT NULL, eylem TEXT NOT NULL,
    hedef TEXT NOT NULL DEFAULT '', ayrinti TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX denetim_zaman ON denetim(zaman);
  CREATE TABLE abonelik (
    endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, olusturma INTEGER NOT NULL
  );
  CREATE TABLE ayar (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL);
  CREATE TABLE katalog (
    yol TEXT PRIMARY KEY, icerik TEXT NOT NULL, revizyon TEXT NOT NULL, zaman INTEGER NOT NULL
  );
  `,
];

export type Db = DatabaseSync;
export type Param = SQLInputValue;

export function openDb(path: string): Db {
  const { DatabaseSync: D } = loadSqlite();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new D(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 2000;");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE IF NOT EXISTS sema_surumu (surum INTEGER NOT NULL)");
  const row = db.prepare("SELECT surum FROM sema_surumu").get() as { surum: number } | undefined;
  let surum = row?.surum ?? 0;
  if (!row) db.prepare("INSERT INTO sema_surumu (surum) VALUES (0)").run();
  while (surum < SEMA.length) {
    const sql = SEMA[surum];
    if (sql === undefined) break;
    db.exec("BEGIN");
    try {
      db.exec(sql);
      surum += 1;
      db.prepare("UPDATE sema_surumu SET surum = ?").run(surum);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return db;
}

/** İşlem içinde çalıştırır (hata olursa geri alınır). */
export function islem<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function json<T>(text: string | null | undefined, fallback: T): T {
  if (text === null || text === undefined) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
