/** Yönetici paneli A3: veritabanı yedeği (tar), günlük sınır, taze giriş ve "son yayınlar" kaydı. */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdminMaintenance } from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { createAccounts, SERVER_START_KEEP } from "./accountStore.js";
import { backupFileName } from "./admin.js";
import { buildReleases } from "./adminData.js";
import { BACKUP_FRESH_MS, BACKUP_PER_DAY, createBackupService } from "./backup.js";
import { createManualClock } from "./clock.js";
import { loadConfig } from "./config.js";
import { startServer } from "./server.js";
import { loadSqlite, noopStats } from "./statsStore.js";
import { tarHeader, tarSize, tarStream } from "./tarArchive.js";
import { k, loginCookie, sleep, useServer } from "./testkit.js";
import { ADMIN, base, createAdminKit, MAIL } from "./yoneticiKit.js";

const kit = createAdminKit();
const { get, post, adminLogin } = kit;
const root = mkdtempSync(join(tmpdir(), "glix-yedek-test-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let seq = 0;
const freshDir = (): string => {
  const d = join(root, `d${++seq}`);
  mkdirSync(d);
  return d;
};

/** Küçük tar çözücü: ad -> içerik. Başlık sağlama toplamını da doğrular. */
function untar(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let off = 0;
  while (off + 512 <= buf.length) {
    const head = buf.subarray(off, off + 512);
    if (head.every((b) => b === 0)) break;
    const name = head.subarray(0, 100).toString("ascii").replace(/\0.*$/s, "");
    const size = Number.parseInt(head.subarray(124, 135).toString("ascii"), 8);
    const stored = Number.parseInt(head.subarray(148, 154).toString("ascii"), 8);
    const copy = Buffer.from(head);
    copy.fill(0x20, 148, 156);
    let sum = 0;
    for (const b of copy) sum += b;
    expect(stored).toBe(sum);
    expect(head.subarray(257, 262).toString("ascii")).toBe("ustar");
    out.set(name, Buffer.from(buf.subarray(off + 512, off + 512 + size)));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  // Sonda iki boş blok.
  expect(buf.length - off).toBe(1024);
  return out;
}

async function download(cookie: string, body: unknown = { ack: true }) {
  const res = await fetch(`${base()}/api/admin/backup`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const data = Buffer.from(await res.arrayBuffer());
  return { res, data };
}

/** Geçici klasör boşalana dek bekler (temizlik akış kapanınca asenkron yapılır). */
async function emptied(dir: string): Promise<boolean> {
  for (let i = 0; i < 100; i++) {
    if (readdirSync(dir).length === 0) return true;
    await sleep(10);
  }
  return false;
}

function openDb(file: string) {
  const { DatabaseSync } = loadSqlite();
  return new DatabaseSync(file, { readOnly: true });
}

describe("tar yazıcı", () => {
  it("boyutlar, sağlama toplamı ve içerik doğru; 512'ye tamamlanır", async () => {
    const d = freshDir();
    const sizes = [0, 1, 511, 512, 513, 5000];
    const entries = sizes.map((size, i) => {
      const path = join(d, `f${i}.bin`);
      writeFileSync(path, Buffer.alloc(size, i + 65));
      return { name: `f${i}.bin`, path, size, mtimeSec: 1_700_000_000 };
    });
    const chunks: Buffer[] = [];
    for await (const c of tarStream(entries)) chunks.push(c as Buffer);
    const all = Buffer.concat(chunks);
    expect(all.length).toBe(tarSize(entries));
    expect(all.length % 512).toBe(0);
    const files = untar(all);
    sizes.forEach((size, i) => {
      expect(files.get(`f${i}.bin`)).toEqual(Buffer.alloc(size, i + 65));
    });
  });

  it("geçersiz adlar reddedilir", () => {
    for (const name of ["", "../x", "a/b", "çay.db", "x".repeat(101)])
      expect(() => tarHeader({ name, path: "/x", size: 0, mtimeSec: 0 })).toThrow();
  });

  it("yedek dosya adı UTC tarih-saat taşır", () => {
    expect(backupFileName(Date.UTC(2026, 9, 27, 21, 5))).toBe("glix-yedek-20261027-2105.tar");
  });
});

describe("yedek servisi", () => {
  it("tutarlı kopya: geçerli SQLite; akış bitince geçici klasör silinir; ikincisi sürerken başlamaz", async () => {
    const dir = freshDir();
    const accounts = createAccounts(join(dir, "kaynak.db"));
    accounts.create("Ayse_01", "ayse@ornek.com", "x", 1);
    const tmp = freshDir();
    const svc = createBackupService(accounts, noopStats, tmp);
    const b = await svc.create(1_700_000_000_000);
    expect(b).not.toBeNull();
    if (!b) return;
    expect(b.files).toEqual(["glix.db"]); // istatistik kapalı: tek dosya
    expect(readdirSync(tmp).length).toBe(1); // geçici klasör var
    expect(await svc.create(1)).toBeNull(); // meşgul
    const chunks: Buffer[] = [];
    for await (const c of b.stream) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).length).toBe(b.size);
    expect(await emptied(tmp)).toBe(true);
    const files = untar(Buffer.concat(chunks));
    const out = join(dir, "geri.db");
    writeFileSync(out, files.get("glix.db") ?? Buffer.alloc(0));
    const db = openDb(out);
    expect(db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(db.prepare("SELECT email FROM accounts").all()).toEqual([{ email: "ayse@ornek.com" }]);
    db.close();
    // Temizlik sonrası yeniden alınabilir.
    const again = await svc.create(2);
    expect(again).not.toBeNull();
    again?.stream.destroy();
    await again?.cleanup();
    expect(await emptied(tmp)).toBe(true);
    accounts.close();
  });

  it("kopya alınamazsa geçici klasör silinir ve hata fırlar", async () => {
    const tmp = freshDir();
    const broken = {
      path: "x.db",
      snapshotTo: () => {
        throw new Error("disk dolu");
      },
    } as unknown as ReturnType<typeof createAccounts>;
    const svc = createBackupService(broken, noopStats, tmp);
    await expect(svc.create(1)).rejects.toThrow("disk dolu");
    expect(readdirSync(tmp)).toEqual([]);
    // Başarısızlık kilidi bırakmaz.
    await expect(svc.create(1)).rejects.toThrow("disk dolu");
  });
});

describe("yedek ucu: ayrı veritabanları", () => {
  const tmp = freshDir();
  useServer({
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: ":memory:",
    accountsDb: ":memory:",
    backupDir: tmp,
  });

  it("iki ayrı geçerli SQLite dosyası içeren tar iner; temizlik yapılır; işlem kaydı yazılır", async () => {
    const cookie = await adminLogin();
    loginCookie("oyuncu_2");
    const { res, data } = await download(cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-tar");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="glix-yedek-\d{8}-\d{4}\.tar"$/,
    );
    expect(Number(res.headers.get("content-length"))).toBe(data.length);
    const files = untar(data);
    expect([...files.keys()].sort()).toEqual(["glix-hesap.db", "glix-istatistik.db"]);
    const dest = freshDir();
    for (const [name, bytes] of files) writeFileSync(join(dest, name), bytes);
    const acc = openDb(join(dest, "glix-hesap.db"));
    expect(acc.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(
      (acc.prepare("SELECT username FROM accounts ORDER BY id").all() as { username: string }[]).map(
        (r) => r.username,
      ),
    ).toEqual(["yonetici_1", "oyuncu_2"]);
    acc.close();
    const st = openDb(join(dest, "glix-istatistik.db"));
    expect(st.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(st.prepare("SELECT COUNT(*) AS n FROM matches").get()).toEqual({ n: 0 });
    st.close();
    expect(await emptied(tmp)).toBe(true);
    const row = k.srv.accounts.adminAuditTail(5).find((a) => a.action === "db_backup");
    expect(row).toMatchObject({ accountId: 1, detail: "2" });
  });

  it("onay (ack) olmadan 400; hiçbir şey kaydedilmez", async () => {
    const cookie = await adminLogin();
    for (const body of [{}, { ack: false }, { ack: "evet" }, { ack: true, x: 1 }, null])
      expect((await download(cookie, body)).res.status).toBe(400);
    expect(k.srv.accounts.adminAuditTail(10).some((a) => a.action === "db_backup")).toBe(false);
    expect(readdirSync(tmp)).toEqual([]);
  });

  it("giriş kodu 30 dakikadan eskiyse taze giriş istenir (kayıtlı, dosya üretilmez)", async () => {
    const cookie = await adminLogin();
    k.clock.advance(BACKUP_FRESH_MS + 1000);
    const { res, data } = await download(cookie);
    expect(res.status).toBe(403);
    expect((JSON.parse(data.toString()) as { code: string }).code).toBe("fresh_required");
    expect(readdirSync(tmp)).toEqual([]);
    expect(k.srv.accounts.adminAuditTail(5).some((a) => a.action === "db_backup_denied")).toBe(true);
    // Yeniden kodla girince iner.
    const again = await adminLogin("yonetici_1");
    expect((await download(again)).res.status).toBe(200);
  });

  it("günde en çok 3 yedek; 24 saat sonra yeniden alınır; sayaç bakım ekranında", async () => {
    const cookie = await adminLogin();
    for (let i = 0; i < BACKUP_PER_DAY; i++) {
      expect((await download(cookie)).res.status).toBe(200);
      expect(await emptied(tmp)).toBe(true); // temizlik bitmeden ikinci yedek başlamaz
    }
    const blocked = await download(cookie);
    expect(blocked.res.status).toBe(429);
    expect((JSON.parse(blocked.data.toString()) as { code: string }).code).toBe("backup_limit");
    const m = (await get<AdminMaintenance>("maintenance", cookie)).body;
    expect(m.backup.usedToday).toBe(3);
    expect(m.backup.limit).toBe(3);
    expect(m.backup.nextAt).not.toBeNull();
    k.clock.advance(24 * 3600 * 1000 + 1000);
    const cookie2 = await adminLogin("yonetici_1");
    expect((await download(cookie2)).res.status).toBe(200);
    expect(await emptied(tmp)).toBe(true);
  });
});

describe("yedek ucu: tek dosya (üretim düzeni)", () => {
  const tmp = freshDir();
  const db = join(root, "tek.db");
  useServer({
    adminAccountIds: ADMIN,
    mail: MAIL,
    mailFetch: kit.mailFetch,
    statsDb: db,
    accountsDb: db,
    backupDir: tmp,
  });

  it("aynı dosya bir kez kopyalanır", async () => {
    const cookie = await adminLogin();
    const { res, data } = await download(cookie);
    expect(res.status).toBe(200);
    const files = untar(data);
    expect([...files.keys()]).toEqual(["glix.db"]);
    const dest = join(freshDir(), "glix.db");
    writeFileSync(dest, files.get("glix.db") ?? Buffer.alloc(0));
    const copy = openDb(dest);
    // Hem hesap hem istatistik tabloları aynı dosyada.
    const tables = (
      copy.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(["accounts", "matches", "server_settings", "account_push", "server_starts"]),
    );
    copy.close();
    expect(statSync(db).size).toBeGreaterThan(0);
  });
});

describe("son yayınlar", () => {
  it("özet: temiz, çökmüş ve süren başlangıçlar süreleriyle", () => {
    const rows = [
      { id: 3, revision: "c", version: "1", startedAt: 3_000_000, stoppedAt: null },
      { id: 2, revision: "b", version: "1", startedAt: 2_000_000, stoppedAt: null },
      { id: 1, revision: "a", version: "1", startedAt: 1_000_000, stoppedAt: 1_005_000 },
    ];
    expect(buildReleases(rows, 3, 3_007_000)).toEqual([
      {
        id: 3,
        revision: "c",
        version: "1",
        startedAt: 3_000_000,
        endedAt: null,
        durationSec: 7,
        state: "running",
      },
      {
        id: 2,
        revision: "b",
        version: "1",
        startedAt: 2_000_000,
        endedAt: 3_000_000,
        durationSec: 1000,
        state: "unclean",
      },
      {
        id: 1,
        revision: "a",
        version: "1",
        startedAt: 1_000_000,
        endedAt: 1_005_000,
        durationSec: 5,
        state: "clean",
      },
    ]);
    // Kayıt yazılamadıysa (runId yok) hiçbiri "süren" olmaz.
    expect(buildReleases(rows, null, 9_000_000)[0]?.state).toBe("unclean");
    expect(buildReleases([], null, 1)).toEqual([]);
  });

  it("kayıtlar en çok SERVER_START_KEEP satır tutulur", () => {
    const accounts = createAccounts(":memory:");
    for (let i = 0; i < SERVER_START_KEEP + 25; i++) accounts.serverStarted(`r${i}`, "0.1.0", i);
    const rows = accounts.serverStarts(1000);
    expect(rows).toHaveLength(SERVER_START_KEEP);
    expect(rows[0]?.revision).toBe(`r${SERVER_START_KEEP + 24}`);
    accounts.close();
  });

  it("revizyon ortamdan: GIT_SHA, yoksa REVISION, yoksa dev", () => {
    expect(loadConfig({ GIT_SHA: "abc1234" }).revision).toBe("abc1234");
    expect(loadConfig({ REVISION: "rev9" }).revision).toBe("rev9");
    expect(loadConfig({}).revision).toBe("dev");
  });

  it("her açılış ve temiz kapanış kaydedilir; kapanış kaydı olmayan çökmüş görünür; en çok 20 satır", async () => {
    const dbFile = join(root, "yayinlar.db");
    const open = async (revision: string, start: number) => {
      k.clock = createManualClock(start);
      k.srv = await startServer({
        host: "127.0.0.1",
        port: 0,
        clientDir: root,
        allowedOrigins: null,
        revision,
        clock: k.clock,
        heartbeatMs: 1_000_000_000,
        accountsDb: dbFile,
        statsDb: null,
        adminAccountIds: ADMIN,
        mail: MAIL,
        mailFetch: kit.mailFetch,
      });
    };
    await open("aaaaaaa", 1_000_000);
    const first = k.srv.accounts.serverStarts(5);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      revision: "aaaaaaa",
      version: "0.1.0",
      startedAt: 1_000_000,
      stoppedAt: null,
    });
    k.clock.advance(5000);
    await k.srv.close(1012);

    // Çökme benzetimi: kapanış kaydı olmayan satır.
    const raw = new (loadSqlite().DatabaseSync)(dbFile);
    raw
      .prepare(
        "INSERT INTO server_starts (revision, version, started_at, stopped_at) VALUES ('bbbbbbb','0.1.0',2000000,NULL)",
      )
      .run();
    raw.close();

    await open("ccccccc", 3_000_000);
    try {
      const cookie = await adminLogin();
      k.clock.advance(7000);
      const m = (await get<AdminMaintenance>("maintenance", cookie)).body;
      expect(m.releases.map((r) => [r.revision, r.state, r.durationSec])).toEqual([
        ["ccccccc", "running", 7],
        ["bbbbbbb", "unclean", 1000],
        ["aaaaaaa", "clean", 5],
      ]);
      // 20 satır sınırı ve saklama sınırı.
      for (let i = 0; i < 30; i++) k.srv.accounts.serverStarted(`x${i}`, "0.1.0", 4_000_000 + i);
      const many = (await get<AdminMaintenance>("maintenance", cookie)).body.releases;
      expect(many).toHaveLength(20);
      expect(many[0]?.revision).toBe("x29");
    } finally {
      await k.srv.close(1001);
    }
    const check = createAccounts(dbFile);
    // Kapanış kaydı yazıldı (SIGINT yolu da temiz sayılır).
    expect(check.serverStarts(1000).some((r) => r.revision === "ccccccc" && r.stoppedAt !== null)).toBe(true);
    check.close();
  });
});
