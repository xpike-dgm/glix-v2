import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";
import { ACCOUNT_MIGRATIONS, createAccounts } from "./accountStore.js";
import { loadSqlite } from "./statsStore.js";

const dir = mkdtempSync(join(tmpdir(), "glix-hesap-gocu-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let seq = 0;
const newPath = (): string => join(dir, `g${seq++}.db`);

const GLIX_FIRST = ACCOUNT_MIGRATIONS.findIndex((m) => m.includes("ADD COLUMN glix"));
const LEDGER_REBUILD = ACCOUNT_MIGRATIONS.findIndex((m) => m.includes("DROP TABLE glix_ledger"));

function open(path: string): DatabaseSync {
  const { DatabaseSync: Db } = loadSqlite();
  const db = new Db(path);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

/** Üretimdeki gibi eski sürümle kurulmuş veritabanı: ilk `upTo` göç uygulanmış. */
function buildAt(path: string, upTo: number): DatabaseSync {
  const db = open(path);
  db.exec("CREATE TABLE account_schema_version (version INTEGER NOT NULL)");
  for (let i = 0; i < upTo; i++) {
    db.exec("BEGIN");
    db.exec(ACCOUNT_MIGRATIONS[i] as string);
    db.prepare("INSERT INTO account_schema_version (version) VALUES (?)").run(i + 1);
    db.exec("COMMIT");
  }
  return db;
}

const count = (db: DatabaseSync, table: string, where = "1"): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get() as { n: number }).n;

/** Glix öncesi şemaya gerçekçi satırlar yazar: 5 hesap, oturum, rozet, arkadaş, maç, bildirim. */
function seedLegacy(db: DatabaseSync): void {
  const acc = db.prepare(
    "INSERT INTO accounts (username, username_lc, email, email_verified, pass_hash, created_at) VALUES (?, ?, ?, 1, 'h', ?)",
  );
  for (let i = 1; i <= 5; i++) acc.run(`Oyuncu${i}`, `oyuncu${i}`, `o${i}@x.com`, 1000 * i);
  for (let i = 1; i <= 5; i++) {
    db.prepare("INSERT INTO sessions (id_hash, account_id, created_at, last_seen) VALUES (?, ?, 1, 2)").run(
      `s${i}`,
      i,
    );
    db.prepare(
      "INSERT INTO email_tokens (kind, token_hash, account_id, expires_at) VALUES ('v', ?, ?, 9)",
    ).run(`t${i}`, i);
    db.prepare("INSERT INTO badges (account_id, badge_id, earned_at) VALUES (?, 'ilk-mac', 5)").run(i);
    db.prepare("INSERT INTO badges (account_id, badge_id, earned_at) VALUES (?, 'ilk-galibiyet', 6)").run(i);
    for (let m = 0; m < 4; m++) {
      db.prepare(
        "INSERT INTO account_matches (account_id, ended_at, players, games, score, place, won) VALUES (?, ?, 5, 3, ?, ?, ?)",
      ).run(i, 100 + m, 10 * m, 1 + (m % 3), m % 3 === 0 ? 1 : 0);
      db.prepare(
        "INSERT INTO account_games (account_id, game_id, ended_at, players, mini_score, rank, won) VALUES (?, 'butona-bas', ?, 5, 3, 1, 1)",
      ).run(i, 100 + m);
      db.prepare(
        "INSERT INTO account_game_stats (account_id, game_id, ended_at, key, value) VALUES (?, 'rus-ruleti', ?, 'kahin', 1)",
      ).run(i, 100 + m);
    }
  }
  db.prepare(
    "INSERT INTO friends (a, b, state, requested_by, created_at, updated_at) VALUES (1, 2, 'accepted', 1, 1, 2)",
  ).run();
  db.prepare(
    "INSERT INTO friends (a, b, state, requested_by, created_at, updated_at) VALUES (2, 3, 'pending', 3, 1, 1)",
  ).run();
  db.prepare("INSERT INTO blocks (blocker, blocked, created_at) VALUES (4, 5, 1)").run();
  db.prepare(
    "INSERT INTO account_coplay (account_id, other_account_id, matches, last_at) VALUES (1, 2, 4, 103)",
  ).run();
  db.prepare(
    "INSERT INTO account_coplay (account_id, other_account_id, matches, last_at) VALUES (2, 1, 4, 103)",
  ).run();
  db.prepare(
    "INSERT INTO account_push (account_id, endpoint, p256dh, auth, created_at) VALUES (3, 'https://p', 'k', 'a', 1)",
  ).run();
  db.prepare(
    "INSERT INTO admin_audit (account_id, action, detail, at, target_id) VALUES (1, 'x', 'd', 1, 2)",
  ).run();
  db.prepare(
    "INSERT INTO admin_sessions (token_hash, account_id, session_hash, created_at, expires_at) VALUES ('a', 1, 's1', 1, 9)",
  ).run();
  db.prepare(
    "INSERT INTO reports (created_at, reporter_account_id, target_account_id, target_name, target_player_id, room_code, reason, note) VALUES (1, 1, 2, 'x', 'p', 'ABCD', 'r', 'n')",
  ).run();
  db.prepare(
    "INSERT INTO content_overrides (pool_id, entry_key, action, value, created_at, updated_at) VALUES ('laf-sokma/sorular', 'k', 'add', 'v', 1, 1)",
  ).run();
  db.prepare("INSERT INTO server_settings (key, value, updated_at) VALUES ('duyuru', 'merhaba', 1)").run();
}

const TABLES = [
  "accounts",
  "sessions",
  "email_tokens",
  "badges",
  "account_matches",
  "account_games",
  "account_game_stats",
  "friends",
  "blocks",
  "account_coplay",
  "account_push",
  "admin_audit",
  "admin_sessions",
  "reports",
  "content_overrides",
  "server_settings",
];

describe("hesap veritabanı göçleri (üretim güvenliği)", () => {
  it("test varsayımları: Glix göçü ve defter yeniden kurulumu bulunur", () => {
    expect(GLIX_FIRST).toBeGreaterThan(0);
    expect(LEDGER_REBUILD).toBeGreaterThan(GLIX_FIRST);
  });

  it("Glix öncesi veritabanı sırayla göç eder: veri korunur, bütünlük ve basamaklı silme çalışır", () => {
    const path = newPath();
    const legacy = buildAt(path, GLIX_FIRST);
    seedLegacy(legacy);
    const before = Object.fromEntries(TABLES.map((t) => [t, count(legacy, t)]));
    const accountsBefore = legacy.prepare("SELECT * FROM accounts ORDER BY id").all();
    legacy.close();

    const store = createAccounts(path); // tüm bekleyen göçler
    expect(store.glixBalance(1)).toBe(0);
    store.close();

    const db = open(path);
    const versions = (
      db.prepare("SELECT version FROM account_schema_version ORDER BY version").all() as {
        version: number;
      }[]
    ).map((r) => r.version);
    expect(versions).toEqual(Array.from({ length: ACCOUNT_MIGRATIONS.length }, (_, i) => i + 1));
    for (const t of TABLES) expect(count(db, t), t).toBe(before[t]);
    const accountsAfter = db.prepare("SELECT * FROM accounts ORDER BY id").all();
    expect(accountsAfter).toHaveLength(accountsBefore.length);
    for (const [i, row] of accountsAfter.entries())
      expect(row).toMatchObject({ ...accountsBefore[i], glix: 0 });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect((db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check).toBe(
      "ok",
    );
    // Yeni tablolar ve indeksler
    const names = new Set(
      (db.prepare("SELECT name FROM sqlite_master").all() as { name: string }[]).map((r) => r.name),
    );
    for (const n of [
      "glix_ledger",
      "glix_ledger_account",
      "glix_ledger_at",
      "cosmetic_owned",
      "cosmetic_equipped",
      "cosmetic_owned_at",
      "quest_rewards",
    ])
      expect(names.has(n), n).toBe(true);
    expect(names.has("glix_ledger_new")).toBe(false);

    // Hesap silinince bağlı satırlar (yeni tablolar dahil) gider; diğer hesaplar etkilenmez.
    db.prepare(
      "INSERT INTO glix_ledger (account_id, at, amount, reason) VALUES (2, 1, 5, 'mac'), (3, 1, 5, 'gorev')",
    ).run();
    db.prepare(
      "INSERT INTO cosmetic_owned (account_id, item_id, acquired_at, price_paid) VALUES (2, 'x', 1, 5)",
    ).run();
    db.prepare(
      "INSERT INTO quest_rewards (account_id, day, quest_id, at, reward) VALUES (2, 1, 'q', 1, 5)",
    ).run();
    db.prepare("DELETE FROM accounts WHERE id = 2").run();
    for (const t of [
      "sessions",
      "badges",
      "account_matches",
      "account_games",
      "account_game_stats",
      "glix_ledger",
      "cosmetic_owned",
      "quest_rewards",
    ])
      expect(count(db, t, "account_id = 2"), t).toBe(0);
    expect(count(db, "friends")).toBe(0);
    expect(count(db, "account_coplay")).toBe(0);
    expect(count(db, "glix_ledger", "account_id = 3")).toBe(1);
    expect(count(db, "badges", "account_id = 1")).toBe(2);
    db.close();
  });

  it("göçten önce tutarlı kopya alınır (eski sürüm verisiyle); güncel veritabanında alınmaz", () => {
    const path = newPath();
    const legacy = buildAt(path, GLIX_FIRST);
    seedLegacy(legacy);
    legacy.close();
    createAccounts(path).close();
    const copy = `${path}.oncesi-v${GLIX_FIRST}`;
    expect(existsSync(copy)).toBe(true);
    const c = open(copy);
    expect(count(c, "accounts")).toBe(5);
    expect(c.prepare("SELECT MAX(version) AS v FROM account_schema_version").get()).toEqual({
      v: GLIX_FIRST,
    });
    c.close();
    const fresh = newPath();
    createAccounts(fresh).close();
    createAccounts(fresh).close();
    expect(existsSync(`${fresh}.oncesi-v${ACCOUNT_MIGRATIONS.length}`)).toBe(false);
  });

  /** Defter yeniden kurulumundan hemen önceki durum: kimlik boşluklu 60 satır. */
  function ledgerBeforeRebuild(path: string): void {
    const db = buildAt(path, LEDGER_REBUILD);
    seedLegacy(db);
    const ins = db.prepare(
      "INSERT INTO glix_ledger (account_id, at, amount, reason, ref) VALUES (?, ?, ?, ?, ?)",
    );
    const reasons = ["mac", "rozet", "yonetici", "satin-alma"];
    for (let i = 1; i <= 60; i++)
      ins.run(
        1 + (i % 5),
        1000 + i,
        i % 7 === 0 ? -i : i,
        reasons[i % 4] as string,
        i % 3 === 0 ? null : `r${i}`,
      );
    db.prepare("DELETE FROM glix_ledger WHERE id > 50").run(); // sayaç 60'ta kalır
    db.prepare("UPDATE accounts SET glix = 10 WHERE id = 1").run();
    db.close();
  }

  it("defter yeniden kurulumu: satırlar, kimlikler, indeksler, yabancı anahtar ve kimlik sayacı korunur", () => {
    const path = newPath();
    ledgerBeforeRebuild(path);
    const pre = open(path);
    const rowsBefore = pre.prepare("SELECT * FROM glix_ledger ORDER BY id").all();
    pre.close();

    const store = createAccounts(path);
    store.close();
    const db = open(path);
    expect(db.prepare("SELECT * FROM glix_ledger ORDER BY id").all()).toEqual(rowsBefore);
    expect(rowsBefore).toHaveLength(50);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    const idx = (db.prepare("PRAGMA index_list(glix_ledger)").all() as { name: string }[]).map((r) => r.name);
    expect(idx).toEqual(expect.arrayContaining(["glix_ledger_account", "glix_ledger_at"]));
    expect(db.prepare("PRAGMA foreign_key_list(glix_ledger)").all()).toMatchObject([
      { table: "accounts", from: "account_id", on_delete: "CASCADE" },
    ]);
    // Yeni neden kabul edilir, eski dışı reddedilir
    db.prepare("INSERT INTO glix_ledger (account_id, at, amount, reason) VALUES (1, 1, 5, 'gorev')").run();
    expect(() =>
      db.prepare("INSERT INTO glix_ledger (account_id, at, amount, reason) VALUES (1, 1, 5, 'hile')").run(),
    ).toThrow();
    // Kimlik sayacı eski değerden devam eder (silinmiş 51..60 yeniden kullanılmaz)
    expect((db.prepare("SELECT id FROM glix_ledger WHERE reason = 'gorev'").get() as { id: number }).id).toBe(
      61,
    );
    // Basamaklı silme
    db.prepare("DELETE FROM accounts WHERE id = 3").run();
    expect(count(db, "glix_ledger", "account_id = 3")).toBe(0);
    expect(count(db, "glix_ledger", "account_id = 4")).toBeGreaterThan(0);
    db.close();
  });

  it("göç ortasında hata: işlem geri alınır, veri ve sürüm değişmez; sorun giderilince tamamlanır", () => {
    const path = newPath();
    ledgerBeforeRebuild(path);
    const sabotage = open(path);
    sabotage.exec("CREATE TABLE glix_ledger_new (x INTEGER)"); // yeniden kurulumun ilk adımını çökertir
    const rowsBefore = sabotage.prepare("SELECT * FROM glix_ledger ORDER BY id").all();
    sabotage.close();

    expect(() => createAccounts(path)).toThrow();

    const mid = open(path);
    expect(mid.prepare("SELECT MAX(version) AS v FROM account_schema_version").get()).toEqual({
      v: LEDGER_REBUILD,
    });
    expect(mid.prepare("SELECT * FROM glix_ledger ORDER BY id").all()).toEqual(rowsBefore);
    expect(count(mid, "accounts")).toBe(5);
    expect(mid.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    mid.exec("DROP TABLE glix_ledger_new");
    mid.close();

    const store = createAccounts(path);
    store.close();
    const done = open(path);
    expect(done.prepare("SELECT MAX(version) AS v FROM account_schema_version").get()).toEqual({
      v: ACCOUNT_MIGRATIONS.length,
    });
    expect(done.prepare("SELECT * FROM glix_ledger ORDER BY id").all()).toEqual(rowsBefore);
    done.close();
  });
});
