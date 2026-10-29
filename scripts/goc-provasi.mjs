#!/usr/bin/env node
/**
 * Hesap veritabanı göç provası (canlıya benzer ölçekte, canlı veriye dokunmadan).
 *
 *   pnpm build
 *   node scripts/goc-provasi.mjs build   <db> [hesap=20000] [defter=500000]   # canlı şemada (ilk N göç) tohumlu DB
 *   node scripts/goc-provasi.mjs migrate <db>                                  # createAccounts ile göç: süre, kopya boyutu, bellek
 *   node scripts/goc-provasi.mjs steps   <db>                                  # her göçün süresi (db üzerinde, doğrudan)
 *   node scripts/goc-provasi.mjs verify  <db>                                  # göç sonrası bütünlük (db.oncesi-vN ile karşılaştırır)
 *   node scripts/goc-provasi.mjs crash   <db>                                  # #17 içinde hata: DB yarım kalmamalı
 *
 * `LIVE_VERSION` ortam değişkeni canlıdaki göç sayısıdır (varsayılan 14: f1e4ad4 anındaki canlı şema).
 * Çıktı JSON'dur. Büyük geçici dosyaları işin sonunda silin.
 */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

const LIVE_VERSION = Number(process.env.LIVE_VERSION ?? 14);
const store = await import(
  pathToFileURL(join(import.meta.dirname, "../apps/server/dist/accountStore.js")).href
);
const { ACCOUNT_MIGRATIONS, createAccounts } = store;

const [cmd, dbPath, a1, a2] = process.argv.slice(2);
if (!cmd || !dbPath) {
  console.error("kullanım: goc-provasi.mjs build|migrate|steps|verify|crash <db>");
  process.exit(2);
}
const out = (o) => console.log(JSON.stringify(o, null, 2));
const ms = (t0) => Math.round(performance.now() - t0);
const mb = (n) => Math.round((n / 1048576) * 10) / 10;
const rmDb = (p) => {
  for (const s of ["", "-wal", "-shm"]) rmSync(p + s, { force: true });
};

// Deterministik rastgele (tekrarlanabilir veri).
let seed = 12345;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const ri = (n) => Math.floor(rnd() * n);
const pick = (arr) => arr[ri(arr.length)];

function build(path, accounts, ledgerRows) {
  rmDb(path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = OFF; PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE account_schema_version (version INTEGER NOT NULL)");
  for (let i = 0; i < LIVE_VERSION; i++) {
    db.exec(ACCOUNT_MIGRATIONS[i]);
    db.prepare("INSERT INTO account_schema_version (version) VALUES (?)").run(i + 1);
  }
  const NOW = Date.UTC(2026, 9, 28, 12);
  const DAY = 86400000;
  const games = [
    "kule",
    "kahin",
    "blof",
    "laf-sokma",
    "sozluk-blofu",
    "gizli-kareler",
    "gizli-hirsiz",
    "ittifak",
  ];
  const items = Array.from({ length: 60 }, (_, i) => `esya-${i}`);
  const slots = [
    "sapka",
    "alt",
    "ayakkabi",
    "aksesuar",
    "kostum",
    "lakap",
    "kart-arkasi",
    "zafer",
    "tepki",
    "giris",
  ];
  const badgeIds = Array.from({ length: 30 }, (_, i) => `rozet-${i}`);
  const tx = (fn) => {
    db.exec("BEGIN");
    fn();
    db.exec("COMMIT");
  };
  tx(() => {
    const ins = db.prepare(
      "INSERT INTO accounts (username, username_lc, email, email_verified, pass_hash, google_sub, created_at, username_changed_at, suspended_at, suspended_until, suspend_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (let i = 1; i <= accounts; i++)
      ins.run(
        `Oyuncu${i}`,
        `oyuncu${i}`,
        `o${i}@ornek.test`,
        i % 3 ? 1 : 0,
        i % 5 ? "pbkdf2$x$y" : null,
        i % 5 ? null : `g${i}`,
        NOW - ri(400) * DAY,
        i % 7 ? null : NOW - ri(90) * DAY,
        i % 500 ? null : NOW - DAY,
        null,
        i % 500 ? null : "test",
      );
  });
  tx(() => {
    const ins = db.prepare(
      "INSERT INTO sessions (id_hash, account_id, created_at, last_seen) VALUES (?,?,?,?)",
    );
    for (let i = 0; i < accounts * 1.5; i++)
      ins.run(`s${i}-${ri(1e9)}`, 1 + ri(accounts), NOW - ri(30) * DAY, NOW - ri(5) * DAY);
  });
  const matchCount = accounts * 8;
  tx(() => {
    const g = db.prepare(
      "INSERT INTO account_games (account_id, game_id, ended_at, players, mini_score, rank, won) VALUES (?,?,?,?,?,?,?)",
    );
    const m = db.prepare(
      "INSERT INTO account_matches (account_id, ended_at, players, games, score, place, won) VALUES (?,?,?,?,?,?,?)",
    );
    const st = db.prepare(
      "INSERT INTO account_game_stats (account_id, game_id, ended_at, key, value) VALUES (?,?,?,?,?)",
    );
    for (let i = 0; i < matchCount; i++) {
      const a = 1 + ri(accounts);
      const at = NOW - ri(120) * DAY - ri(DAY);
      m.run(a, at, 2 + ri(8), 3 + ri(5), ri(5000), 1 + ri(6), ri(4) === 0 ? 1 : 0);
      for (let k = 0; k < 2; k++)
        g.run(a, pick(games), at, 2 + ri(8), ri(900), 1 + ri(6), ri(4) === 0 ? 1 : 0);
      if (i % 2) st.run(a, pick(games), at, "tahmin", ri(10));
    }
    const c = db.prepare(
      "INSERT OR IGNORE INTO account_coplay (account_id, other_account_id, matches, last_at) VALUES (?,?,?,?)",
    );
    for (let i = 0; i < accounts * 10; i++) {
      const a = 1 + ri(accounts);
      const b = 1 + ri(accounts);
      if (a !== b) c.run(a, b, 1 + ri(20), NOW - ri(100) * DAY);
    }
  });
  tx(() => {
    const f = db.prepare(
      "INSERT OR IGNORE INTO friends (a, b, state, requested_by, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    );
    for (let i = 0; i < accounts * 3; i++) {
      const x = 1 + ri(accounts);
      const y = 1 + ri(accounts);
      if (x === y) continue;
      f.run(
        Math.min(x, y),
        Math.max(x, y),
        ri(5) ? "accepted" : "pending",
        x,
        NOW - ri(200) * DAY,
        NOW - ri(50) * DAY,
      );
    }
    const bl = db.prepare("INSERT OR IGNORE INTO blocks (blocker, blocked, created_at) VALUES (?,?,?)");
    for (let i = 0; i < accounts / 4; i++) {
      const x = 1 + ri(accounts);
      const y = 1 + ri(accounts);
      if (x !== y) bl.run(x, y, NOW - ri(100) * DAY);
    }
    const b = db.prepare("INSERT OR IGNORE INTO badges (account_id, badge_id, earned_at) VALUES (?,?,?)");
    for (let i = 0; i < accounts * 4; i++) b.run(1 + ri(accounts), pick(badgeIds), NOW - ri(300) * DAY);
    const r = db.prepare(
      "INSERT INTO reports (created_at, reporter_account_id, target_account_id, target_name, target_player_id, room_code, game_id, reason, note, evidence, status, admin_note, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (let i = 0; i < 5000; i++)
      r.run(
        NOW - ri(170) * DAY,
        1 + ri(accounts),
        1 + ri(accounts),
        "Hedef",
        `p${i}`,
        "ABCD",
        pick(games),
        "hakaret",
        "not ".repeat(10),
        null,
        pick(["new", "reviewed", "dismissed"]),
        "",
        null,
      );
    const au = db.prepare(
      "INSERT INTO admin_audit (account_id, action, detail, at, target_id) VALUES (?,?,?,?,?)",
    );
    for (let i = 0; i < 5000; i++) au.run(1, "askiya-al", "{}", NOW - ri(300) * DAY, 1 + ri(accounts));
    const ss = db.prepare(
      "INSERT INTO server_starts (revision, version, started_at, stopped_at) VALUES (?,?,?,?)",
    );
    for (let i = 0; i < 200; i++) ss.run("abc", "1", NOW - i * 3600000, NOW - i * 3600000 + 1000);
    const co = db.prepare(
      "INSERT INTO content_overrides (pool_id, entry_key, action, value, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    );
    for (let i = 0; i < 1500; i++)
      co.run(
        pick(["laf-sokma/aile", "laf-sokma/ofis", "laf-sokma/arkadas", "sozluk-blofu/kelimeler"]),
        `k${i}`,
        i % 2 ? "add" : "disable",
        i % 2 ? "x" : null,
        i,
        i,
      );
  });
  // Glix defteri: her neden, hesaba göre dağılım; bakiye = defter toplamı. Son satırlar silinerek sayaç > MAX(id) yapılır.
  tx(() => {
    const L = db.prepare("INSERT INTO glix_ledger (account_id, at, amount, reason, ref) VALUES (?,?,?,?,?)");
    for (let i = 0; i < ledgerRows; i++) {
      const a = 1 + ri(accounts);
      const r = rnd();
      const at = NOW - ri(120) * DAY - ri(DAY);
      if (r < 0.7) L.run(a, at, 10 + ri(40), "mac", `yer:${1 + ri(6)}`);
      else if (r < 0.85) L.run(a, at, 50 + ri(200), "rozet", pick(badgeIds));
      else if (r < 0.9) L.run(a, at, ri(2) ? 500 : -200, "yonetici", null);
      else L.run(a, at, -(100 + ri(900)), "satin-alma", pick(items));
    }
    db.exec("DELETE FROM glix_ledger WHERE id > (SELECT MAX(id) - 25 FROM glix_ledger)");
    db.exec(
      "UPDATE accounts SET glix = COALESCE((SELECT SUM(amount) FROM glix_ledger WHERE account_id = accounts.id), 0)",
    );
    const o = db.prepare(
      "INSERT OR IGNORE INTO cosmetic_owned (account_id, item_id, acquired_at, price_paid) VALUES (?,?,?,?)",
    );
    const e = db.prepare(
      "INSERT OR IGNORE INTO cosmetic_equipped (account_id, slot, item_id) VALUES (?,?,?)",
    );
    for (let i = 0; i < accounts * 4; i++)
      o.run(1 + ri(accounts), pick(items), NOW - ri(120) * DAY, ri(6) ? 100 * (1 + ri(10)) : 0);
    for (let i = 0; i < accounts * 2; i++) e.run(1 + ri(accounts), pick(slots), pick(items));
    const p = db.prepare(
      "INSERT OR IGNORE INTO account_push (account_id, endpoint, p256dh, auth, created_at) VALUES (?,?,?,?,?)",
    );
    for (let i = 1; i <= 3000; i++) p.run(i, `https://push.test/${i}`, "k", "a", NOW);
  });
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();
  const counts = tableCounts(path);
  out({ db: path, sizeMB: mb(statSync(path).size), version: LIVE_VERSION, counts });
}

function tableCounts(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  const r = {};
  for (const { name } of names) r[name] = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n;
  db.close();
  return r;
}

function migrate(path) {
  const t0 = performance.now();
  const before = process.memoryUsage().rss;
  const acc = createAccounts(path);
  const total = ms(t0);
  acc.close();
  const ru = process.resourceUsage();
  const copies = readdirSync(dirname(path))
    .filter((f) => f.startsWith(`${basename(path)}.oncesi-v`))
    .map((f) => ({ file: f, sizeMB: mb(statSync(join(dirname(path), f)).size) }));
  out({
    totalMs: total,
    peakRssMB: mb(ru.maxRSS * 1024),
    rssBeforeMB: mb(before),
    copies,
    dbSizeMB: mb(statSync(path).size),
    walMB: existsSync(`${path}-wal`) ? mb(statSync(`${path}-wal`).size) : 0,
  });
}

function steps(path) {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON");
  const v = db.prepare("SELECT MAX(version) AS v FROM account_schema_version").get().v;
  const t = performance.now();
  db.prepare("VACUUM INTO ?").run(`${path}.steps-kopya`);
  const vacuumMs = ms(t);
  const res = [];
  for (let i = v; i < ACCOUNT_MIGRATIONS.length; i++) {
    const t1 = performance.now();
    db.exec("BEGIN");
    db.exec(ACCOUNT_MIGRATIONS[i]);
    db.prepare("INSERT INTO account_schema_version (version) VALUES (?)").run(i + 1);
    db.exec("COMMIT");
    res.push({ migration: i + 1, ms: ms(t1) });
  }
  db.close();
  rmDb(`${path}.steps-kopya`);
  out({ vacuumIntoMs: vacuumMs, steps: res });
}

function verify(path) {
  const copy = `${path}.oncesi-v${LIVE_VERSION}`;
  if (!existsSync(copy)) throw new Error(`kopya yok: ${copy}`);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`ATTACH DATABASE '${copy}' AS eski`);
  const res = { version: db.prepare("SELECT MAX(version) AS v FROM account_schema_version").get().v };
  res.expectedVersion = ACCOUNT_MIGRATIONS.length;
  // Tablo başına satır sayısı (eski tabloların hepsi)
  const names = db
    .prepare(
      "SELECT name FROM eski.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all();
  res.rowCounts = {};
  for (const { name } of names) {
    const o = db.prepare(`SELECT COUNT(*) AS n FROM eski."${name}"`).get().n;
    const n = db.prepare(`SELECT COUNT(*) AS n FROM main."${name}"`).get().n;
    res.rowCounts[name] = o === n ? `${n} ok` : `FARK eski=${o} yeni=${n}`;
  }
  // Defter: kimlik ve içerik birebir
  res.ledger = {
    missingOrChangedRows: db
      .prepare(
        "SELECT COUNT(*) AS n FROM (SELECT id, account_id, at, amount, reason, ref FROM eski.glix_ledger EXCEPT SELECT id, account_id, at, amount, reason, ref FROM main.glix_ledger)",
      )
      .get().n,
    extraRows: db
      .prepare(
        "SELECT COUNT(*) AS n FROM (SELECT id, account_id, at, amount, reason, ref FROM main.glix_ledger EXCEPT SELECT id, account_id, at, amount, reason, ref FROM eski.glix_ledger)",
      )
      .get().n,
    perAccountSumDiffs: db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
         SELECT account_id, SUM(amount) s FROM eski.glix_ledger GROUP BY account_id
         EXCEPT SELECT account_id, SUM(amount) FROM main.glix_ledger GROUP BY account_id)`,
      )
      .get().n,
    balanceMismatches: db
      .prepare(
        "SELECT COUNT(*) AS n FROM main.accounts a WHERE a.glix <> COALESCE((SELECT SUM(amount) FROM main.glix_ledger l WHERE l.account_id = a.id), 0)",
      )
      .get().n,
  };
  const oldSeq = db.prepare("SELECT seq FROM eski.sqlite_sequence WHERE name='glix_ledger'").get()?.seq;
  const newSeqBefore = db.prepare("SELECT seq FROM main.sqlite_sequence WHERE name='glix_ledger'").get()?.seq;
  const maxId = db.prepare("SELECT MAX(id) AS m FROM main.glix_ledger").get().m;
  // Yeni neden ('gorev') kabul edilir, eski neden hâlâ geçerli; sayaç sürer. Deneme satırları geri alınır.
  db.exec("BEGIN");
  const r1 = db
    .prepare("INSERT INTO glix_ledger (account_id, at, amount, reason, ref) VALUES (1, 1, 5, 'gorev', 'x')")
    .run();
  const r2 = db
    .prepare("INSERT INTO glix_ledger (account_id, at, amount, reason, ref) VALUES (1, 1, 5, 'mac', 'x')")
    .run();
  db.exec("ROLLBACK");
  let badReason = "kabul edildi (HATA)";
  try {
    db.exec("INSERT INTO glix_ledger (account_id, at, amount, reason) VALUES (1, 1, 5, 'sacma')");
  } catch {
    badReason = "reddedildi (ok)";
  }
  res.sequence = {
    oldSeq,
    newSeq: newSeqBefore,
    maxIdNow: maxId,
    firstNewInsertId: Number(r1.lastInsertRowid),
    secondNewInsertId: Number(r2.lastInsertRowid),
    continuesAfterOldSeq: Number(r1.lastInsertRowid) === oldSeq + 1,
    badReason,
  };
  res.foreignKeyCheck = db.prepare("PRAGMA main.foreign_key_check").all().length;
  res.integrityCheck = db
    .prepare("PRAGMA main.integrity_check")
    .all()
    .map((r) => r.integrity_check);
  res.indexes = db
    .prepare(
      "SELECT name FROM main.sqlite_master WHERE type='index' AND name IN ('glix_ledger_account','glix_ledger_at','cosmetic_owned_at','account_games_cover','account_matches_cover') ORDER BY name",
    )
    .all()
    .map((r) => r.name);
  const plan = (sql, ...p) =>
    db
      .prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .all(...p)
      .map((r) => r.detail);
  res.plans = {
    gunlukSinir: plan(
      "SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS n FROM glix_ledger WHERE account_id = ? AND reason = 'mac' AND at >= ? AND at < ?",
      1,
      0,
      1,
    ),
    defterSon: plan(
      "SELECT id, at, amount, reason, ref FROM glix_ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?",
      1,
      20,
    ),
    ekonomiAralik: plan(
      "SELECT (at + 10800000) / 86400000 AS d, reason, SUM(amount) FROM glix_ledger WHERE at >= ? AND at < ? GROUP BY d, reason",
      0,
      1,
    ),
    magazaSahip: plan(
      "SELECT item_id, acquired_at, price_paid FROM cosmetic_owned WHERE account_id = ? ORDER BY acquired_at, item_id",
      1,
    ),
    magazaSatis: plan(
      "SELECT item_id, COUNT(*), SUM(price_paid) FROM cosmetic_owned WHERE price_paid > 0 AND acquired_at >= ? AND acquired_at < ? GROUP BY item_id",
      0,
      1,
    ),
    gorevOdenen: plan("SELECT quest_id FROM quest_rewards WHERE account_id = ? AND day = ?", 1, 1),
    gorevTum: plan(
      "SELECT day, quest_id, at, reward FROM quest_rewards WHERE account_id = ? ORDER BY day, at, quest_id",
      1,
    ),
    macSayim: plan("SELECT COUNT(*), COALESCE(SUM(won),0) FROM account_games WHERE account_id = ?", 1),
    farkliOyun: plan("SELECT COUNT(DISTINCT game_id) FROM account_games WHERE account_id = ? AND won = 1", 1),
    macGunluk: plan(
      "SELECT place, score FROM account_matches WHERE account_id = ? AND ended_at >= ? AND ended_at < ? ORDER BY ended_at, rowid",
      1,
      0,
      1,
    ),
  };
  const tables = db.prepare("SELECT name FROM main.sqlite_master WHERE name IN ('glix_ledger_new') ").all();
  res.leftoverTables = tables.map((t) => t.name);
  db.close();
  out(res);
}

function crash(path) {
  const test = `${path}.crash`;
  rmDb(test);
  copyFileSync(path, test);
  if (existsSync(`${path}-wal`)) copyFileSync(`${path}-wal`, `${test}-wal`);
  const idx = ACCOUNT_MIGRATIONS.findIndex((m) => m.includes("DROP TABLE glix_ledger"));
  // Yeniden kurulumun ortasında patlat: tablo bırakılıp yeniden adlandırıldıktan sonra geçersiz ifade.
  ACCOUNT_MIGRATIONS[idx] = `${ACCOUNT_MIGRATIONS[idx]}\n INSERT INTO yok_boyle_bir_tablo VALUES (1);`;
  let error = null;
  try {
    createAccounts(test).close();
  } catch (e) {
    error = String(e.message ?? e);
  }
  const db = new DatabaseSync(test, { readOnly: true });
  const version = db.prepare("SELECT MAX(version) AS v FROM account_schema_version").get().v;
  const r = {
    startThrew: error,
    versionAfterCrash: version,
    expectedPreviousVersion: idx,
    ledgerRows: db.prepare("SELECT COUNT(*) AS n FROM glix_ledger").get().n,
    ledgerNewTableLeft: db
      .prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='glix_ledger_new'")
      .get().n,
    ledgerOldCheck: /'satin-alma'\)/.test(
      db.prepare("SELECT sql FROM sqlite_master WHERE name='glix_ledger'").get().sql,
    ),
    integrity: db.prepare("PRAGMA integrity_check").get().integrity_check,
  };
  db.close();
  // Düzelince (hata kalkınca) yeniden başlatma göçü tamamlar.
  ACCOUNT_MIGRATIONS[idx] = ACCOUNT_MIGRATIONS[idx].replace(
    /\n INSERT INTO yok_boyle_bir_tablo VALUES \(1\);$/,
    "",
  );
  createAccounts(test).close();
  const db2 = new DatabaseSync(test, { readOnly: true });
  r.versionAfterRetry = db2.prepare("SELECT MAX(version) AS v FROM account_schema_version").get().v;
  db2.close();
  for (const f of readdirSync(dirname(test)).filter((f) => f.startsWith(`${basename(test)}`)))
    rmSync(join(dirname(test), f), { force: true });
  out(r);
}

if (cmd === "build") build(dbPath, Number(a1 ?? 20000), Number(a2 ?? 500000));
else if (cmd === "migrate") migrate(dbPath);
else if (cmd === "steps") steps(dbPath);
else if (cmd === "verify") verify(dbPath);
else if (cmd === "crash") crash(dbPath);
else {
  console.error(`bilinmeyen komut: ${cmd}`);
  process.exit(2);
}
