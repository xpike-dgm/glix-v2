/**
 * Sıcak yol sınamaları (İnceleme 3): odaya giriş, yayın yükü, maç sonu hattı, mağaza ucu ve yönetici ekonomi sorgusu.
 * Süre sınırları gevşektir (yoğun makinede de geçsin); asıl kanıt sorgu sayıları ve sorgu planlarıdır.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COSMETIC_ITEMS,
  COSMETIC_TYPES,
  type Cosmetics,
  cosmeticsFromEquipped,
  type RoomSnapshot,
} from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { buildGameRecord, buildMatchRecord, createAccountRecorder } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { createManualClock } from "./clock.js";
import { createRoom, createRuntime } from "./rooms.js";
import type { Connection, Player } from "./runtime.js";
import { createShopApi } from "./shopApi.js";
import { createSocial } from "./social.js";
import { loadSqlite } from "./statsStore.js";

const dir = mkdtempSync(join(tmpdir(), "glix-sicak-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let seq = 0;
const newPath = (): string => join(dir, `s${seq++}.db`);

/** Depo yöntemlerinin çağrı sayısını tutan sarmalayıcı. */
function counted(store: AccountStore): { store: AccountStore; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const proxy = new Proxy(store, {
    get(target, key: string) {
      const v = (target as unknown as Record<string, unknown>)[key];
      if (typeof v !== "function") return v;
      return (...args: unknown[]) => {
        calls[key] = (calls[key] ?? 0) + 1;
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { store: proxy, calls };
}

function allEquipped(): Record<string, string> {
  const equipped: Record<string, string> = {};
  for (const t of COSMETIC_TYPES) {
    const item = COSMETIC_ITEMS.find((i) => i.type === t.id);
    if (item) equipped[t.id] = item.id;
  }
  return equipped;
}

describe("odaya giriş: kozmetik okuma", () => {
  it("girişte yalnız kuşanılanlar okunur (sahip listesi okunmaz); çıkartma sahipliği tek aramadır", () => {
    const base = createAccounts(":memory:");
    const made = base.create("Ali", "ali@t.local", "x", 1);
    if (!made.ok) throw new Error("hesap");
    const id = made.account.id;
    const { store, calls } = counted(base);
    const rt = createRuntime(createManualClock());
    const social = createSocial(rt, store);
    expect(social.cosmeticsOf(id)).toBeUndefined();
    expect(social.ownsCosmetic(id, "yok")).toBe(false);
    expect(calls.cosmetics).toBeUndefined();
    expect(calls.equippedCosmetics).toBe(1);
    expect(calls.ownsCosmetic).toBe(1);
    base.close();
  });
});

describe("yayın yükü: PlayerInfo kozmetik alanları", () => {
  function snapshotBytes(withCosmetics: Cosmetics | undefined): { full: number; patch: number } {
    const clock = createManualClock();
    const rt = createRuntime(clock);
    const room = createRoom(rt);
    room.gameIds = ["butona-bas"];
    const raw: string[] = [];
    for (let i = 0; i < 8; i++) {
      const conn = {
        player: null,
        stage: null,
        lastSent: null,
        sentVer: -1,
        ip: "x",
        failedJoins: 0,
        account: null,
        close() {},
        send() {},
        sendRaw(t: string) {
          if (i === 0) raw.push(t);
        },
      } as unknown as Connection;
      const player: Player = {
        id: `p${i}`,
        nickname: `Oyuncu${i}`,
        avatar: i,
        token: `t${i}`,
        score: 0,
        spectator: false,
        accountId: i + 1,
        username: `kullanici${i}`,
        cosmetics: withCosmetics,
        joinOrder: i,
        conn,
        room,
        graceCancel: null,
        lobbyReady: false,
        lastReactAt: Number.NEGATIVE_INFINITY,
        lastRenameAt: Number.NEGATIVE_INFINITY,
        lastContinueAt: Number.NEGATIVE_INFINITY,
        hidden: false,
        push: null,
        lastPushAt: Number.NEGATIVE_INFINITY,
      };
      conn.player = player;
      room.players.set(player.id, player);
      if (i === 0) room.hostId = player.id;
    }
    rt.rooms.set(room.code, room);
    rt.broadcaster.flush(room);
    clock.advance(100);
    const p3 = room.players.get("p3");
    if (p3) p3.score = 7; // tek alan değişir
    rt.broadcaster.flush(room);
    expect(raw).toHaveLength(2);
    expect((JSON.parse(raw[0] ?? "") as { snapshot: RoomSnapshot }).snapshot.players).toHaveLength(8);
    return { full: (raw[0] ?? "").length, patch: (raw[1] ?? "").length };
  }

  it("8 oyuncu: tam snapshot büyümesi sınırlı; oyuncu listesi dizi olduğundan yama listeyi bütün taşır (bilinen sınır)", () => {
    const none = snapshotBytes(undefined);
    const cos = cosmeticsFromEquipped(allEquipped());
    expect(cos && Object.keys(cos).length).toBeGreaterThanOrEqual(8);
    const full = snapshotBytes(cos);
    const perPlayer = (full.full - none.full) / 8;
    console.log(
      `snapshot (8 oyuncu): kozmetiksiz ${none.full} B, tam kozmetikli ${full.full} B (+${perPlayer.toFixed(0)} B/oyuncu); yama ${none.patch} B / ${full.patch} B`,
    );
    expect(perPlayer).toBeLessThan(400);
    // Merge Patch dizileri bütün değiştirir: bir oyuncunun puanı değişince 8 oyuncunun alanları yamada yeniden gider.
    expect(full.patch - none.patch).toBeLessThan(8 * 400);
  });
});

describe("maç sonu hattı (8 hesap)", () => {
  it("sorgu sayısı oyuncu başına sabit; 1500 maçlık geçmişle bile olay döngüsünü tutmaz", () => {
    const path = newPath();
    createAccounts(path).close();
    const { DatabaseSync: Db } = loadSqlite();
    const raw = new Db(path);
    raw.exec("PRAGMA foreign_keys = ON; BEGIN");
    const games = ["butona-bas", "rus-ruleti", "kule-ustasi", "zehirli-kadeh", "kara-borsa"];
    for (let a = 1; a <= 8; a++) {
      raw
        .prepare("INSERT INTO accounts (username, username_lc, email, created_at) VALUES (?, ?, ?, 0)")
        .run(`u${a}`, `u${a}`, `e${a}`);
      for (let i = 0; i < 1500; i++) {
        const at = 1_700_000_000_000 + i * 1000;
        raw
          .prepare(
            "INSERT INTO account_matches (account_id, ended_at, players, games, score, place, won) VALUES (?, ?, 8, 3, 10, ?, ?)",
          )
          .run(a, at, 1 + (i % 8), i % 8 === 0 ? 1 : 0);
        for (let g = 0; g < 3; g++) {
          raw
            .prepare(
              "INSERT INTO account_games (account_id, game_id, ended_at, players, mini_score, rank, won) VALUES (?, ?, ?, 8, 3, ?, ?)",
            )
            .run(a, games[(i + g) % 5] as string, at, 1 + (i % 8), i % 8 === 0 ? 1 : 0);
          raw
            .prepare(
              "INSERT INTO account_game_stats (account_id, game_id, ended_at, key, value) VALUES (?, ?, ?, 'kahin', 1)",
            )
            .run(a, games[(i + g) % 5] as string, at);
        }
      }
    }
    raw.exec("COMMIT");
    raw.close();

    const { store, calls } = counted(createAccounts(path));
    const rec = createAccountRecorder(
      store,
      () => {},
      () => {},
      () => true,
      () => {},
    );
    const now = 1_800_000_000_000;
    const entrants = Array.from({ length: 8 }, (_, i) => ({
      playerId: `p${i}`,
      accountId: i + 1,
      score: 100 - i * 5,
    }));
    rec.gameFinished(buildGameRecord("butona-bas", now, entrants));
    for (const key of Object.keys(calls)) delete calls[key];
    const t0 = performance.now();
    rec.matchFinished(buildMatchRecord(3, now, entrants));
    const ms = performance.now() - t0;
    console.log(
      `maç sonu hattı (8 hesap, 1500 maç geçmişi): ${ms.toFixed(1)} ms, çağrılar ${JSON.stringify(calls)}`,
    );
    expect(calls.recordMatch).toBe(1);
    for (const m of ["earnedBadges", "badgeStats", "creditMatchGlix", "questFacts"])
      expect(calls[m], m).toBe(8);
    expect(ms).toBeLessThan(250);
    store.close();
  });
});

describe("mağaza durumu (GET /api/shop)", () => {
  it("oturum çözme + kuşanılan/sahip + bakiye: en çok 4 depo çağrısı", async () => {
    const base = createAccounts(":memory:");
    const made = base.create("Ali", "ali@t.local", "x", 1);
    if (!made.ok) throw new Error("hesap");
    const clock = createManualClock();
    const token = randomBytes(32).toString("base64url");
    base.createSession(made.account.id, createHash("sha256").update(token).digest("hex"), clock.now());
    const { store, calls } = counted(base);
    const api = createShopApi({
      accounts: store,
      social: createSocial(createRuntime(clock), store),
      clock,
      allowedOrigins: null,
    });
    let status = 0;
    const finished = new Promise<void>((done) => {
      const res = {
        headersSent: false,
        writeHead(s: number) {
          status = s;
        },
        end() {
          done();
        },
      } as unknown as ServerResponse;
      const req = {
        url: "/api/shop",
        method: "GET",
        headers: { cookie: `glix_sess=${token}` },
      } as unknown as IncomingMessage;
      api(req, res);
    });
    await finished;
    expect(status).toBe(200);
    expect(Object.values(calls).reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(4);
    expect(calls.cosmetics).toBe(1);
    base.close();
  });
});

describe("yönetici ekonomi sorgusu (100 bin defter satırı)", () => {
  it("zaman aralığı indeksle taranır ve 90 günlük pencere hızlıdır", () => {
    const path = newPath();
    createAccounts(path).close();
    const { DatabaseSync: Db } = loadSqlite();
    const raw = new Db(path);
    raw.exec("PRAGMA foreign_keys = ON; BEGIN");
    for (let i = 1; i <= 2000; i++)
      raw
        .prepare("INSERT INTO accounts (username, username_lc, email, created_at) VALUES (?, ?, ?, 0)")
        .run(`u${i}`, `u${i}`, `e${i}`);
    const ins = raw.prepare(
      "INSERT INTO glix_ledger (account_id, at, amount, reason, ref) VALUES (?, ?, ?, ?, 'x')",
    );
    const day = 86_400_000;
    const t0 = 1_760_000_000_000;
    const reasons = ["mac", "mac", "mac", "rozet", "satin-alma", "gorev"];
    for (let i = 0; i < 100_000; i++) {
      const reason = reasons[i % 6] as string;
      ins.run(
        1 + (i % 2000),
        t0 + Math.floor((i * 90 * day) / 100_000),
        reason === "satin-alma" ? -50 : 15,
        reason,
      );
    }
    raw.exec("COMMIT");
    for (const q of [
      "SELECT (at + 10800000) / 86400000 AS d, reason, SUM(amount) FROM glix_ledger WHERE at >= 1 AND at < 2 GROUP BY d, reason",
      "SELECT account_id FROM glix_ledger WHERE reason = 'mac' AND at >= 1 AND at < 2 GROUP BY account_id",
      "SELECT SUM(amount), COUNT(*) FROM glix_ledger WHERE account_id = 5 AND reason = 'mac' AND at >= 1 AND at < 2",
      "SELECT COUNT(*) FROM cosmetic_owned WHERE price_paid > 0 AND acquired_at >= 1 AND acquired_at < 2",
    ]) {
      const plan = (raw.prepare(`EXPLAIN QUERY PLAN ${q}`).all() as { detail: string }[])
        .map((r) => r.detail)
        .join(" | ");
      expect(plan, q).not.toMatch(/SCAN (glix_ledger|cosmetic_owned)\b/);
      expect(plan, q).toMatch(/USING (COVERING )?INDEX/);
    }
    raw.close();
    const store = createAccounts(path);
    const to = t0 + 90 * day;
    const started = performance.now();
    const eco = store.economy(to - 90 * day, to, 150, [], to);
    const ms = performance.now() - started;
    console.log(`ekonomi sorgusu (100k satır, 90 gün): ${ms.toFixed(1)} ms`);
    expect(eco.ledger.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
    store.close();
  });
});
