/**
 * Ortam içerik aktarımı, dışa aktarma yarısı (UM-O2): canlı veritabanından YALNIZ içerik tablolarını okur ve JSON
 * olarak standart çıktıya yazar. Gerçek oyuncu verisi (hesaplar, e-postalar, oturumlar, ilerleme, bildirimler,
 * istatistik) hiç okunmaz: sorgular yalnız aşağıdaki izin listesindeki tablo ve sütunlara gider.
 *
 * Bu dosya bilerek kendi başınadır (yalnız `node:` modülleri): canlı kap eski bir sürümde olsa bile betik onun içinde
 * standart girdiden çalıştırılır (bkz. `deploy/ortamlar/ortak.sh`):
 *
 *   docker exec -i -e GLIX_ICERIK_DISA=1 glix-glix-1 node --no-warnings --input-type=module - < ortamIcerikDisa.js
 *
 * Veritabanı salt okunur açılır; canlı sunucu çalışırken güvenle okunur (WAL).
 */
import type { DatabaseSync } from "node:sqlite";

export const ICERIK_PAKET_SURUMU = 1;

/** Kopyalanan bir tablo: tam sütun listesi ve (gerekirse) yalnız belirli anahtarların satırları. */
export interface IcerikTablosu {
  tablo: string;
  sutunlar: readonly string[];
  /** Verilirse yalnız `sutun` değeri listede olan satırlar kopyalanır. */
  yalniz?: { sutun: string; degerler: readonly string[] };
  aciklama: string;
}

/** Kopyalanan içerik tabloları (izin listesi). Yeni bir tablo buraya açıkça eklenmedikçe kopyalanmaz. */
export const ICERIK_TABLOLARI: readonly IcerikTablosu[] = [
  {
    tablo: "content_overrides",
    sutunlar: ["pool_id", "entry_key", "action", "value", "created_at", "updated_at"],
    aciklama: "İçerik havuzu değişiklikleri: yönetici ve Üretim Merkezi eklemeleri ve kapatmaları",
  },
  {
    tablo: "banned_words",
    sutunlar: ["folded", "word", "added_at"],
    aciklama: "Moderasyon: yönetici yasaklı kelime listesi",
  },
  {
    tablo: "server_settings",
    sutunlar: ["key", "value", "updated_at"],
    yalniz: { sutun: "key", degerler: ["games", "gunlukGorevler"] },
    aciklama: "Yalnız oyun açma/kapama anahtarları ve günlük görev anahtarı",
  },
];

/**
 * Kopyalanmayan tablolar ve nedeni. Testler veritabanındaki her tablonun ya `ICERIK_TABLOLARI`'nda ya burada
 * olduğunu doğrular: yeni bir göç tablo eklerse sınıflandırılmadan testler geçmez.
 */
export const KOPYALANMAYAN_TABLOLAR: Readonly<Record<string, string>> = {
  accounts: "gerçek oyuncu hesapları (kullanıcı adı, e-posta, şifre özeti, Google kimliği, Glix bakiyesi)",
  sessions: "oturumlar",
  email_tokens: "e-posta doğrulama ve şifre sıfırlama belirteçleri",
  account_games: "oyuncu oyun geçmişi",
  account_matches: "oyuncu maç geçmişi",
  account_coplay: "kimin kimle oynadığı",
  friends: "arkadaşlıklar",
  blocks: "engellemeler",
  badges: "oyuncuların kazandığı rozetler (rozet tanımları koddadır, imajla gelir)",
  account_game_stats: "oyuncu oyun sayaçları",
  admin_audit: "yönetici işlem kaydı",
  admin_otp: "yönetici giriş kodları",
  admin_sessions: "yönetici oturumları",
  account_push: "web bildirimi abonelikleri",
  server_starts: "canlı sunucunun açılış kayıtları",
  reports: "oyuncu bildirimleri (kanıt metni, oda kodu)",
  glix_ledger: "oyuncu Glix hareketleri",
  cosmetic_owned: "oyuncuların sahip olduğu ürünler (mağaza kataloğu koddadır, imajla gelir)",
  cosmetic_equipped: "oyuncuların kuşandığı ürünler",
  quest_rewards: "ödenen günlük görevler",
  wiki_feedback: "yönetici ansiklopedi notları ve ekran görüntüleri",
  uretim_transfers: "canlıdaki Üretim Merkezi aktarım geçmişi (geri alma kaydı)",
  account_schema_version: "şema sürümü (hedef kendi göçünü uygular)",
  matches: "anonim maç istatistiği",
  game_plays: "anonim oyun istatistiği",
  feedback: "oyuncu geri bildirimleri",
  perf: "anonim başarım ölçümleri",
  client_errors: "istemci hata kaydı",
  game_failures: "oyun hata kaydı",
  mail_stats: "e-posta gönderim sayaçları",
  content_stats: "anonim havuz bilinirlik sayaçları (canlı oyuncu davranışı)",
  content_play: "anonim kelime karnesi sayaçları (canlı oyuncu davranışı)",
  schema_version: "istatistik şema sürümü",
  sqlite_sequence: "SQLite iç sayaç tablosu",
};

export type IcerikDegeri = string | number | null;
export type IcerikSatiri = Record<string, IcerikDegeri>;

export interface IcerikPaketi {
  surum: typeof ICERIK_PAKET_SURUMU;
  alindi: number;
  /** Tablo adı → satırlar. Kaynakta olmayan tablo pakette de yoktur. */
  tablolar: Record<string, IcerikSatiri[]>;
}

const KIMLIK = /^[a-z_]+$/;

function deger(v: unknown): IcerikDegeri {
  if (v === null || typeof v === "string" || typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  throw new Error("İçerik tablosunda beklenmeyen değer türü");
}

/** İzin listesindeki tabloları okur; hiçbir başka tabloya sorgu gitmez. */
export function icerikDisaAktar(db: DatabaseSync, now: number = Date.now()): IcerikPaketi {
  const mevcut = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (r) => r.name,
    ),
  );
  const tablolar: Record<string, IcerikSatiri[]> = {};
  for (const t of ICERIK_TABLOLARI) {
    if (!mevcut.has(t.tablo)) continue;
    if (!KIMLIK.test(t.tablo) || !t.sutunlar.every((c) => KIMLIK.test(c)))
      throw new Error("Geçersiz tablo tanımı");
    let sql = `SELECT ${t.sutunlar.join(", ")} FROM ${t.tablo}`;
    const params: string[] = [];
    if (t.yalniz) {
      if (!KIMLIK.test(t.yalniz.sutun)) throw new Error("Geçersiz tablo tanımı");
      sql += ` WHERE ${t.yalniz.sutun} IN (${t.yalniz.degerler.map(() => "?").join(", ")})`;
      params.push(...t.yalniz.degerler);
    }
    sql += ` ORDER BY ${t.sutunlar[0]}`;
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    tablolar[t.tablo] = rows.map((r) => {
      const out: IcerikSatiri = {};
      for (const c of t.sutunlar) out[c] = deger(r[c]);
      return out;
    });
  }
  return { surum: ICERIK_PAKET_SURUMU, alindi: now, tablolar };
}

/** Kapta çalışırken: veritabanını salt okunur açar, paketi standart çıktıya yazar. */
function calistir(): void {
  const path = process.env.ACCOUNTS_DB || process.env.STATS_DB || "/data/glix.db";
  // Yalnız kapta çalışırken yüklenir (içe aktaran testler ve sunucu deneysel modül uyarısı görmez).
  const { DatabaseSync: Db } = process.getBuiltinModule("node:sqlite");
  const db = new Db(path, { readOnly: true });
  try {
    db.exec("PRAGMA busy_timeout = 5000");
    process.stdout.write(`${JSON.stringify(icerikDisaAktar(db))}\n`);
  } finally {
    db.close();
  }
}

if (process.env.GLIX_ICERIK_DISA === "1") calistir();
