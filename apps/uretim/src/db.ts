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
    olusturma INTEGER NOT NULL, iptal INTEGER, son_kullanim INTEGER, kanal TEXT NOT NULL DEFAULT 'mcp',
    ad TEXT NOT NULL DEFAULT '', sifreli TEXT
  );
  CREATE TABLE ssh_anahtar (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, acik TEXT NOT NULL, parmak_izi TEXT NOT NULL, aciklama TEXT NOT NULL,
    olusturma INTEGER NOT NULL, UNIQUE (alan, parmak_izi)
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
    anahtar_id INTEGER, aciklama TEXT NOT NULL DEFAULT '', olusturma INTEGER NOT NULL,
    kanal TEXT NOT NULL DEFAULT 'elle', anahtar_ad TEXT NOT NULL DEFAULT '', arac TEXT, model TEXT
  );
  CREATE TABLE oge (
    id INTEGER PRIMARY KEY, teslim_id INTEGER NOT NULL REFERENCES teslim(id), alan TEXT NOT NULL,
    is_id INTEGER, tur TEXT NOT NULL, ad TEXT NOT NULL, anahtar TEXT NOT NULL, aciklama TEXT NOT NULL,
    gerekce TEXT NOT NULL, durum TEXT NOT NULL, gorunum TEXT NOT NULL, surum INTEGER NOT NULL,
    onceki_id INTEGER, kaynak TEXT NOT NULL, dosyalar TEXT NOT NULL, satirlar TEXT NOT NULL,
    degisiklikler TEXT NOT NULL, kaldirilacaklar TEXT NOT NULL, onizleme TEXT, rapor TEXT,
    kontrol TEXT NOT NULL, sonuc TEXT NOT NULL, onayli_satirlar TEXT, paket_id INTEGER,
    olusturma INTEGER NOT NULL, karar INTEGER, guncelleme INTEGER NOT NULL,
    talimat_surum INTEGER, onaylayan TEXT, otomatik INTEGER NOT NULL DEFAULT 0, denetim INTEGER NOT NULL DEFAULT 0,
    varyant_is INTEGER, gorunus TEXT NOT NULL DEFAULT ''
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
    sira INTEGER NOT NULL, olusturma INTEGER NOT NULL, istek_id INTEGER, ilgili_oge INTEGER,
    varyant INTEGER, fikir_turu INTEGER NOT NULL DEFAULT 0, secilen_fikir INTEGER, secim_notu TEXT,
    kisitlar TEXT, kabul TEXT, ozet TEXT, basladi INTEGER, teslim_edildi INTEGER,
    kilit_anahtar INTEGER, kilit_ad TEXT, kilit_zaman INTEGER
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
  CREATE TABLE ssh_parola (
    alan TEXT PRIMARY KEY, ozet TEXT NOT NULL, sifreli TEXT NOT NULL, olusturma INTEGER NOT NULL, yenileme_gun INTEGER
  );
  CREATE TABLE zevk (
    id INTEGER PRIMARY KEY, alan TEXT NOT NULL, oge_id INTEGER NOT NULL UNIQUE, tur TEXT NOT NULL, ad TEXT NOT NULL,
    not_metni TEXT NOT NULL DEFAULT '', onemli INTEGER NOT NULL DEFAULT 0, cikarildi INTEGER NOT NULL DEFAULT 0,
    olusturma INTEGER NOT NULL
  );
  CREATE INDEX zevk_alan ON zevk(alan, olusturma);
  CREATE TABLE katalog (
    yol TEXT PRIMARY KEY, icerik TEXT NOT NULL, revizyon TEXT NOT NULL, zaman INTEGER NOT NULL
  );
  `,
  // Giriş kodu istekleri kalıcı: yeniden başlatma günlük kod sınırını sıfırlamaz.
  `
  CREATE TABLE giris_istegi (id INTEGER PRIMARY KEY, eposta TEXT NOT NULL, zaman INTEGER NOT NULL);
  CREATE INDEX giris_istegi_eposta ON giris_istegi(eposta, zaman);
  `,
  // Üretim Merkezi 2: yapılandırılmış fikir, fikri uygulayan öğe ve "onaylananları uygula" işi.
  `
  ALTER TABLE oge ADD COLUMN fikir TEXT;
  ALTER TABLE oge ADD COLUMN fikir_id INTEGER;
  CREATE INDEX oge_fikir_id ON oge(fikir_id);
  CREATE TABLE is_fikir (
    is_id INTEGER NOT NULL, fikir_id INTEGER NOT NULL, PRIMARY KEY (is_id, fikir_id)
  );
  CREATE INDEX is_fikir_fikir ON is_fikir(fikir_id);
  `,
  // Üretim Merkezi 2, aşama 3: oyun alanına (test2) yüklenen teslimler (sözleşme bölüm 13).
  `
  CREATE TABLE oyun_alani (
    oge_id INTEGER PRIMARY KEY, tur TEXT NOT NULL, durum TEXT NOT NULL, katman TEXT,
    aktarimlar TEXT NOT NULL DEFAULT '[]', taslaklar TEXT NOT NULL DEFAULT '[]', ozet TEXT NOT NULL DEFAULT '',
    hata TEXT, elle INTEGER NOT NULL DEFAULT 0, guncelleme INTEGER NOT NULL
  );
  `,
  // Aşama 3 ikinci dilim: test2 bot koşuları ve yapay zekânın açtığı oyun alanı odaları (sözleşme bölüm 14).
  `
  CREATE TABLE kosu (
    id INTEGER PRIMARY KEY, oyun_id TEXT NOT NULL, istek TEXT NOT NULL, baslatan TEXT NOT NULL, durum TEXT NOT NULL,
    baslama INTEGER NOT NULL, bitis INTEGER, sonuc TEXT, oge_id INTEGER, hata TEXT
  );
  CREATE INDEX kosu_baslama ON kosu(baslama);
  CREATE TABLE oyun_alani_oda (
    kod TEXT PRIMARY KEY, alan TEXT NOT NULL, oyun TEXT NOT NULL, olusturma INTEGER NOT NULL, kapandi INTEGER
  );
  `,
  // 13. alan Oyun Tasarımı (sözleşme bölüm 15): belirli bir anahtara yönelik iş (geliştir, eleştiri, çoklu yapay
  // zekâ), iş türü ve aynı istekten açılan işlerin grubu.
  `
  ALTER TABLE isler ADD COLUMN hedef_anahtar INTEGER;
  ALTER TABLE isler ADD COLUMN is_turu TEXT;
  ALTER TABLE isler ADD COLUMN grup TEXT;
  CREATE INDEX isler_ilgili ON isler(ilgili_oge);
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
