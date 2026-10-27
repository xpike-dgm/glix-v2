import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GAMES } from "@glix/engine";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { scrubText, topFrame, toStoredError, uaFamily } from "./errorScrub.js";
import {
  type ClientErrorRecord,
  createStats,
  loadSqlite,
  MAX_ERROR_ROWS_PER_DAY,
  RETENTION_MS,
} from "./statsStore.js";
import { type Client, k, setupRoom, until, useServer } from "./testkit.js";

const dir = mkdtempSync(join(tmpdir(), "glix-hata-"));
const dbFile = join(dir, "glix.db");
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbFile + suffix, { force: true });
});

function rows<T = Record<string, unknown>>(sql: string): T[] {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return db.prepare(sql).all() as T[];
  } finally {
    db.close();
  }
}

const DAY = 24 * 3600 * 1000;
const rec = (over: Partial<ClientErrorRecord> = {}): ClientErrorRecord => ({
  message: "boom",
  frame: "f index.js:1:2",
  platform: "ios",
  browser: "safari",
  version: "0.1.0",
  ...over,
});

describe("hata metni temizleme", () => {
  it("adres sorgusu/parçası, e-posta, IP ve uzun belirteçler atılır", () => {
    const text = scrubText(
      "Hata https://glix.test/oda/ABCDE?token=SIR&x=1#parca ali@example.com 10.1.2.3 " +
        `oturum ${"A".repeat(43)} son`,
    );
    expect(text).toBe("Hata https://glix.test/oda/ABCDE [e-posta] [ip] oturum [belirteç] son");
    expect(text).not.toMatch(/SIR|ali@|10\.1\.2\.3|AAAA/);
  });

  it("200 karaktere kısaltılır, boşluklar toplanır", () => {
    expect(scrubText("kelime ".repeat(100))).toHaveLength(200);
    expect(scrubText("  a \n\t b  ")).toBe("a b");
  });

  it("yığının tepe karesi: Chrome ve Firefox/Safari biçimleri, yalnız taban dosya adı", () => {
    expect(
      topFrame(
        "TypeError: x\n    at render (https://glix.test/assets/index-ab12.js?v=3:10:20)\n    at y (z.js:1:1)",
      ),
    ).toBe("render index-ab12.js:10:20");
    expect(topFrame("Error: x\n    at https://glix.test/assets/a.js:5:6")).toBe("a.js:5:6");
    expect(topFrame("run@https://glix.test/assets/b.js:7:8\nother@c.js:1:1")).toBe("run b.js:7:8");
    expect(topFrame("Error: sadece metin")).toBe("-");
    expect(topFrame(null)).toBe("-");
  });

  it("kullanıcı aracısı yalnız platform ve tarayıcı ailesine indirgenir", () => {
    expect(
      uaFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Version/17.0 Mobile Safari/604.1"),
    ).toEqual({
      platform: "ios",
      browser: "safari",
    });
    expect(uaFamily("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile Safari/537.36")).toEqual({
      platform: "android",
      browser: "chrome",
    });
    expect(uaFamily("Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/121.0")).toEqual({
      platform: "diger",
      browser: "firefox",
    });
    expect(uaFamily("Mozilla/5.0 Chrome/120 Edg/120")).toMatchObject({ browser: "edge" });
    expect(uaFamily(null)).toEqual({ platform: "diger", browser: "diger" });
  });

  it("kalıcı kayıtta ham kullanıcı aracısı ve sürüm dışı karakter yok", () => {
    const r = toStoredError({ message: "m", stack: null, version: "0.1.0 <x>", ua: "Mozilla iPhone" });
    expect(r).toEqual({ message: "m", frame: "-", platform: "ios", browser: "diger", version: "bilinmiyor" });
    expect(JSON.stringify(r)).not.toContain("Mozilla");
  });
});

describe("istemci hatası kalıcı kayıt", () => {
  it("aynı gün + aynı hata tek satır, sayaç artar; farklı platform ayrı satır", () => {
    const store = createStats(dbFile);
    const now = 100 * DAY + 5000;
    store.clientError(now, rec());
    store.clientError(now + 1000, rec());
    store.clientError(now + 2000, rec({ platform: "android", browser: "chrome" }));
    store.clientError(now + DAY, rec());
    store.close();
    const r = rows<{ day: number; platform: string; count: number; first_seen: number; last_seen: number }>(
      "SELECT day, platform, count, first_seen, last_seen FROM client_errors ORDER BY day, platform",
    );
    expect(r).toEqual([
      { day: 100 * DAY, platform: "android", count: 1, first_seen: now + 2000, last_seen: now + 2000 },
      { day: 100 * DAY, platform: "ios", count: 2, first_seen: now, last_seen: now + 1000 },
      { day: 101 * DAY, platform: "ios", count: 1, first_seen: now + DAY, last_seen: now + DAY },
    ]);
  });

  it("günlük satır sınırı: sürekli değişen metin tabloyu şişirmez", () => {
    const store = createStats(dbFile);
    const now = 100 * DAY;
    for (let i = 0; i < MAX_ERROR_ROWS_PER_DAY + 20; i++) store.clientError(now, rec({ message: `m${i}` }));
    store.close();
    expect(rows<{ n: number }>("SELECT COUNT(*) AS n FROM client_errors")[0]?.n).toBe(MAX_ERROR_ROWS_PER_DAY);
  });

  it("90 günden eski hata ve çöken oyun satırları silinir, yenilere dokunulmaz", () => {
    const store = createStats(dbFile);
    const now = 200 * DAY;
    const old = now - RETENTION_MS - 1000;
    const fresh = now - RETENTION_MS + 60_000;
    store.clientError(old, rec({ message: "eski" }));
    store.clientError(fresh, rec({ message: "yeni" }));
    store.gameFailure(old, { gameId: "butona-bas", fn: "tick", message: "eski" });
    store.gameFailure(fresh, { gameId: "butona-bas", fn: "tick", message: "yeni" });
    store.purge(now);
    store.close();
    expect(rows<{ message: string }>("SELECT message FROM client_errors")).toEqual([{ message: "yeni" }]);
    expect(rows<{ message: string }>("SELECT message FROM game_failures")).toEqual([{ message: "yeni" }]);
  });

  it("yönetici okuyucusu: gruplama, platform dağılımı, ilk/son görülme", () => {
    const store = createStats(dbFile);
    const now = 100 * DAY + 3 * 3600 * 1000;
    store.clientError(now, rec());
    store.clientError(now + 1000, rec({ platform: "android", browser: "chrome", version: "0.2.0" }));
    store.clientError(now + 2000, rec({ message: "baska" }));
    const e = store.reader?.errors(now + 3000);
    store.close();
    expect(e?.groups.map((g) => g.message)).toEqual(["baska", "boom"]);
    const boom = e?.groups.find((g) => g.message === "boom");
    expect(boom).toMatchObject({
      count: 2,
      firstSeen: now,
      lastSeen: now + 1000,
      platforms: { ios: 1, android: 1, diger: 0 },
    });
    expect([...(boom?.versions ?? [])].sort()).toEqual(["0.1.0", "0.2.0"]);
    expect(e?.perDay.at(-1)?.count).toBe(3);
  });
});

describe("istemci hatası uç noktası kalıcılığı", () => {
  useServer({ statsDb: dbFile });
  beforeEach(() => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("POST /api/client-error temizlenmiş satırı yazar", async () => {
    const res = await fetch(`http://127.0.0.1:${k.srv.port}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Kötü https://x.test/a?k=GIZLI",
        stack: "Error\n    at f (https://x.test/assets/a-1.js:3:4)",
        url: "/oda/ABCDE",
        version: "0.1.0",
        ua: "Mozilla/5.0 (Linux; Android 14) Chrome/120",
      }),
    });
    expect(res.status).toBe(204);
    const r = rows<Record<string, unknown>>("SELECT * FROM client_errors");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      message: "Kötü https://x.test/a",
      frame: "f a-1.js:3:4",
      platform: "android",
      browser: "chrome",
      version: "0.1.0",
      count: 1,
    });
    expect(JSON.stringify(r)).not.toMatch(/GIZLI|ABCDE|Mozilla/);
  });
});

describe("çöken oyun kaydı", () => {
  useServer({ statsDb: dbFile });
  const failing = {
    ...GAMES["butona-bas"],
    id: "test-cokme",
    tick: () => {
      throw new Error("kasıtlı https://x.test/?t=GIZLI");
    },
  };
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => vi.restoreAllMocks());
  beforeAll(() => {
    GAMES[failing.id] = failing as never;
  });
  afterAll(() => {
    delete GAMES[failing.id];
  });

  it("game_failed: oyun, işlev ve kısaltılmış hata yazılır; maç kaydı yazılmaz", async () => {
    const cs = await setupRoom(["Ayşe", "Mehmet"], ["test-cokme"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "lobby", "lobiye dönüş");
    const r = rows<Record<string, unknown>>("SELECT game_id, fn, message, at FROM game_failures");
    expect(r).toEqual([
      { game_id: "test-cokme", fn: "tick", message: "kasıtlı https://x.test/", at: expect.any(Number) },
    ]);
    expect(Object.keys(rows("SELECT * FROM game_failures")[0] ?? {}).sort()).toEqual([
      "at",
      "fn",
      "game_id",
      "id",
      "message",
    ]);
    expect(JSON.stringify(r)).not.toMatch(/Ayşe|Mehmet|GIZLI/);
  });
});
