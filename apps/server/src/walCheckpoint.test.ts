import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { createStats, loadSqlite } from "./statsStore.js";
import { startWalCheckpointer } from "./walCheckpoint.js";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "glix-wal-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function open(path: string) {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 2000");
  db.exec("CREATE TABLE IF NOT EXISTS t (a INTEGER, b TEXT)");
  return db;
}
const autocheckpoint = (db: ReturnType<typeof open>): number =>
  (db.prepare("PRAGMA wal_autocheckpoint").get() as { wal_autocheckpoint: number }).wal_autocheckpoint;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond() && Date.now() < end) await sleep(20);
  expect(cond()).toBe(true);
}

describe("WAL checkpoint worker", () => {
  it("bellek içi veritabanında worker başlatmaz", () => {
    const db = open(":memory:");
    expect(startWalCheckpointer(db, ":memory:")).toBeNull();
    expect(autocheckpoint(db)).toBe(1000);
    db.close();
  });

  it("ana bağlantıda otomatik checkpoint kapanır ve worker WAL'ı küçültür", async () => {
    const path = join(tmp(), "a.db");
    const db = open(path);
    const cp = startWalCheckpointer(db, path, { intervalMs: 50 });
    expect(cp).not.toBeNull();
    expect(autocheckpoint(db)).toBe(0);
    const ins = db.prepare("INSERT INTO t VALUES (?, ?)");
    db.exec("BEGIN");
    for (let i = 0; i < 5000; i++) ins.run(i, "x".repeat(100));
    db.exec("COMMIT");
    const wal = `${path}-wal`;
    const before = statSync(wal).size;
    expect(before).toBeGreaterThan(100_000);
    // Checkpoint sonrası yeni yazılar WAL'ın başına döner; dosya büyümez, çerçeveler geri alınır.
    await sleep(300);
    const row = db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get() as {
      log: number;
      checkpointed: number;
    };
    expect(row.checkpointed).toBe(row.log);
    cp?.stop();
    db.close();
  });

  it("kapanış sırası: worker bağlantısı kapanır, sonra ana bağlantı; WAL temizlenir", async () => {
    const path = join(tmp(), "b.db");
    const db = open(path);
    const cp = startWalCheckpointer(db, path, { intervalMs: 50 });
    db.exec("INSERT INTO t VALUES (1, 'a')");
    await sleep(120);
    cp?.stop();
    cp?.stop(); // tekrar çağrı zararsız
    db.close();
    // Son bağlantı kapanınca SQLite WAL dosyasını siler: worker bağlantısı gerçekten kapanmıştı.
    expect(() => statSync(`${path}-wal`)).toThrow();
    const again = open(path);
    expect((again.prepare("SELECT COUNT(*) AS n FROM t").get() as { n: number }).n).toBe(1);
    again.close();
  });

  it("hemen kapatma (worker henüz açılırken) takılmaz", () => {
    const path = join(tmp(), "c.db");
    const db = open(path);
    const cp = startWalCheckpointer(db, path);
    const t0 = Date.now();
    cp?.stop();
    db.close();
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("worker açılamazsa ana bağlantı varsayılan otomatik checkpoint'e döner", async () => {
    const path = join(tmp(), "d.db");
    const db = open(path);
    const cp = startWalCheckpointer(db, path, { workerSource: "throw new Error('açılamadı')" });
    await until(() => autocheckpoint(db) === 1000);
    const t0 = Date.now();
    cp?.stop();
    expect(Date.now() - t0).toBeLessThan(500);
    db.close();
  });

  it("worker ölürse ana bağlantı varsayılan otomatik checkpoint'e döner", async () => {
    const path = join(tmp(), "e.db");
    const db = open(path);
    const cp = startWalCheckpointer(db, path, {
      workerSource: "setTimeout(() => process.exit(1), 100)",
    });
    expect(autocheckpoint(db)).toBe(0);
    await until(() => autocheckpoint(db) === 1000);
    cp?.stop();
    db.close();
  });

  it("hesap ve istatistik depoları dosyada çalışır ve temiz kapanır", async () => {
    const dir = tmp();
    const accounts = createAccounts(join(dir, "accounts.db"));
    const stats = createStats(join(dir, "stats.db"));
    await sleep(100);
    accounts.close();
    stats.close();
    accounts.close();
    stats.close();
    expect(() => statSync(join(dir, "accounts.db-wal"))).toThrow();
    expect(() => statSync(join(dir, "stats.db-wal"))).toThrow();
  });
});
