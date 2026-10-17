import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GAMES } from "@glix/engine";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createStats, loadSqlite, RETENTION_MS } from "./statsStore.js";
import { summarize } from "./statsSummary.js";
import { type Client, k, press, setupRoom, startPlaying, sync, until, useServer } from "./testkit.js";

const dir = mkdtempSync(join(tmpdir(), "glix-stats-"));
const dbFile = join(dir, "glix.db");
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Dosyayı ayrı bir bağlantıyla okur (sunucu yazarken WAL ile tutarlıdır). */
function rows<T = Record<string, unknown>>(sql: string): T[] {
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    return db.prepare(sql).all() as T[];
  } finally {
    db.close();
  }
}

function resetDb(): void {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbFile + suffix, { force: true });
}

async function finishMatch(cs: Client[]): Promise<void> {
  await startPlaying(cs);
  await press(cs[0] as Client);
  k.clock.advance(45_100);
  await until(() => (cs[0] as Client).room.phase === "results", "sonuç");
  k.clock.advance(7_100);
  await until(() => (cs[0] as Client).room.phase === "final", "final");
}

beforeEach(resetDb);

describe("istatistik kaydı", () => {
  useServer({ statsDb: dbFile });

  it("tam Butona Bas maçı: maç, oyun ve geri bildirim satırları; kişisel veri yok", async () => {
    const cs = await setupRoom(["Ayşe", "Mehmet"], ["butona-bas"]);
    const [a, b] = cs as [Client, Client];
    // Final dışında geri bildirim reddedilir.
    a.send({ type: "feedback", rating: 5 });
    await until(() => a.lastError?.code === "wrong_phase", "yanlış aşama");
    await finishMatch(cs);

    const m = rows<Record<string, number | string>>("SELECT * FROM matches");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ player_count: 2, selection_mode: "manual", game_count: 1, completed: 1 });
    expect(m[0]?.ended_at).not.toBeNull();
    const g = rows<Record<string, number | string>>("SELECT * FROM game_plays");
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({
      match_id: m[0]?.id,
      game_id: "butona-bas",
      player_count: 2,
      outcome: "finished",
    });
    expect(Number(g[0]?.duration_ms)).toBeGreaterThanOrEqual(44_900);
    expect(Number(g[0]?.duration_ms)).toBeLessThanOrEqual(46_000);

    // Geri bildirim: temizlenmiş metin, oyuncu başına bir kez.
    a.send({ type: "feedback", rating: 5, text: "  çok\u0007 eğlenceli \n" });
    a.send({ type: "feedback", rating: 1, text: "ikinci" });
    b.send({ type: "feedback", rating: 3 });
    b.send({ type: "feedback", rating: 2 });
    b.send({ type: "ping", t: 1 });
    await until(() => rows("SELECT * FROM feedback").length === 2, "geri bildirim");
    await sync();
    const f = rows<Record<string, number | string | null>>("SELECT * FROM feedback ORDER BY rowid");
    expect(f).toHaveLength(2);
    expect(f[0]).toMatchObject({ match_id: m[0]?.id, rating: 5, text: "çok eğlenceli" });
    expect(f[1]).toMatchObject({ rating: 3, text: null });
    expect(a.of("error").filter((e) => e.code !== "wrong_phase")).toHaveLength(0);

    // Takma ad, oyuncu kimliği, oda kodu ya da belirteç hiçbir yerde yok.
    const dump = JSON.stringify([rows("SELECT * FROM matches"), g, f]);
    for (const secret of ["Ayşe", "Mehmet", a.session.playerId, a.session.roomCode, a.session.token]) {
      expect(dump).not.toContain(secret);
    }
    const tables = rows<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'").map(
      (t) => t.name,
    );
    expect(tables).toEqual(expect.arrayContaining(["matches", "game_plays", "feedback", "schema_version"]));
    expect(rows("SELECT * FROM schema_version")).toEqual([{ version: 1 }]);

    // Özet Türkçe ve bu verilerden üretilir.
    const text = summarize(dbFile, k.clock.now());
    expect(text).toContain("Maç sayısı: 1");
    expect(text).toContain("butona-bas");
    expect(text).toContain("çok eğlenceli");
  });

  it("herkes oyun sırasında çıkarsa oyun ve maç 'aborted', tamamlanmadı", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    await startPlaying(cs);
    k.clock.advance(10_000);
    for (const c of cs) c.send({ type: "leaveRoom" });
    await until(() => rows("SELECT * FROM game_plays").length === 1, "aborted satırı");
    const g = rows<Record<string, number | string>>("SELECT * FROM game_plays");
    expect(g[0]).toMatchObject({ outcome: "aborted" });
    expect(Number(g[0]?.duration_ms)).toBeGreaterThanOrEqual(10_000);
    expect(rows("SELECT completed FROM matches")).toEqual([{ completed: 0 }]);
  });

  it("sunucu kapanırken süren maç 'aborted' olur", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    await startPlaying(cs);
    await k.srv.close(1012);
    expect(rows("SELECT outcome FROM game_plays")).toEqual([{ outcome: "aborted" }]);
    expect(rows("SELECT completed FROM matches")).toEqual([{ completed: 0 }]);
  });

  it("briefing'de iptal edilen maçın oyun satırı yoktur", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    (cs[0] as Client).send({ type: "startMatch" });
    await until(() => (cs[0] as Client).room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "leaveRoom" });
    await until(
      () => rows("SELECT * FROM matches WHERE completed = 0 AND ended_at IS NOT NULL").length === 1,
    );
    expect(rows("SELECT * FROM game_plays")).toEqual([]);
  });
});

describe("istatistik: oyun hatası", () => {
  useServer({ statsDb: dbFile });
  const failing = {
    ...GAMES["butona-bas"],
    id: "test-fail",
    tick: () => {
      throw new Error("kasıtlı");
    },
  };
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  beforeAll(() => {
    GAMES[failing.id] = failing as never;
  });
  afterAll(() => {
    delete GAMES[failing.id];
  });

  it("game_failed -> outcome 'failed'", async () => {
    const cs = await setupRoom(["A", "B"], ["test-fail"]);
    const host = cs[0] as Client;
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of cs) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "lobby", "lobiye dönüş");
    expect(rows("SELECT game_id, outcome FROM game_plays")).toEqual([
      { game_id: "test-fail", outcome: "failed" },
    ]);
    expect(rows("SELECT completed FROM matches")).toEqual([{ completed: 0 }]);
  });
});

describe("istatistik: kapalı", () => {
  useServer();
  it("STATS_DB yokken maç ve geri bildirim sorunsuz çalışır, dosya oluşmaz", async () => {
    const cs = await setupRoom(["A", "B"], ["butona-bas"]);
    await finishMatch(cs);
    (cs[0] as Client).send({ type: "feedback", rating: 4, text: "iyi" });
    (cs[0] as Client).send({ type: "ping", t: 1 });
    await sync();
    expect((cs[0] as Client).of("error")).toHaveLength(0);
    expect(createStats(undefined).enabled).toBe(false);
  });
});

describe("saklama", () => {
  it("90 günden eski satırlar silinir, yenilere dokunulmaz", () => {
    const store = createStats(dbFile);
    const now = 200 * 24 * 3600 * 1000;
    const old = now - RETENTION_MS - 1000;
    const fresh = now - RETENTION_MS + 60_000;
    const info = { playerCount: 3, selectionMode: "random" as const, gameCount: 2 };
    const oldId = store.matchStarted(old, info);
    const freshId = store.matchStarted(fresh, info);
    for (const [id, at] of [
      [oldId, old],
      [freshId, fresh],
    ] as const) {
      store.gamePlayed(id, {
        gameId: "butona-bas",
        playerCount: 3,
        startedAt: at,
        durationMs: 1000,
        outcome: "finished",
      });
      store.feedback(id, at, 4, "x");
    }
    store.purge(now);
    store.close();
    expect(rows("SELECT id FROM matches")).toEqual([{ id: freshId }]);
    expect(rows("SELECT match_id FROM game_plays")).toEqual([{ match_id: freshId }]);
    expect(rows("SELECT match_id FROM feedback")).toEqual([{ match_id: freshId }]);
  });

  it("açılamayan veritabanı sunucuyu durdurmaz (devre dışı kalır)", () => {
    const orig = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      expect(createStats(join(dir, "yok", "x.db")).enabled).toBe(false);
    } finally {
      process.stderr.write = orig;
    }
  });
});
