import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GLIX_DAILY_MATCH_CAP } from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { createAccountRecorder, type GlixEarned } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { BADGES, istanbulDayStart } from "./badges.js";
import { Client, k, loginCookie, press, sync, until, useServer } from "./testkit.js";

/** 2026-10-26 12:00 İstanbul. */
const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);
const DAY = 24 * 3600 * 1000;

function setup() {
  const db: AccountStore = createAccounts(":memory:");
  const mk = (n: string): number => {
    const r = db.create(n, `${n.toLowerCase()}@t.local`, "x", 1);
    if (!r.ok) throw new Error("hesap");
    return r.account.id;
  };
  const sent: [number, GlixEarned][] = [];
  const rec = createAccountRecorder(
    db,
    () => {},
    (id, e) => sent.push([id, e]),
  );
  let at = NOON;
  const finish = (rows: { id: number; place: number }[], when?: number): void => {
    at += 60_000;
    rec.matchFinished({
      endedAt: when ?? at,
      rows: rows.map((r) => ({ accountId: r.id, players: 4, games: 3, score: 5, place: r.place })),
      pairs: [],
    });
  };
  return { db, mk, sent, finish };
}

describe("rozet ödülleri", () => {
  it("her rozetin ödülü var; kademeye göre 25 / 50 / 100", () => {
    for (const b of BADGES) expect([25, 50, 100], b.id).toContain(b.glix);
    const g = Object.fromEntries(BADGES.map((b) => [b.id, b.glix]));
    expect(g).toMatchObject({
      "ilk-mac": 25,
      "on-mac": 50,
      "elli-mac": 100,
      "yuz-mac": 100,
      "ilk-galibiyet": 25,
      "on-galibiyet": 50,
      "yirmibes-galibiyet": 100,
      "cok-yonlu": 50,
      "kalabalik-sampiyonu": 50,
      "can-dost": 50,
      seri: 50,
      "kahin-on": 50,
      "kule-ustasi": 50,
    });
    for (const b of BADGES.filter((x) => x.secret)) expect(b.glix).toBe(100);
  });

  it("İstanbul günü sınırı gece yarısı UTC+3", () => {
    const start = Date.UTC(2026, 9, 25, 21, 0, 0); // 26 Ekim 00:00 İstanbul
    expect(istanbulDayStart(start)).toBe(start);
    expect(istanbulDayStart(start - 1)).toBe(start - DAY);
    expect(istanbulDayStart(NOON)).toBe(start);
  });
});

describe("Glix göçü", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-defter-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("bakiye ve defter yeniden açılışta kalır; göç ikinci açılışta tekrar çalışmaz", () => {
    const path = join(dir, "hesap.db");
    const first = createAccounts(path);
    const r = first.create("Ali", "ali@t.local", "x", 1);
    if (!r.ok) throw new Error("hesap");
    first.creditMatchGlix(r.account.id, NOON, 2);
    first.close();
    const again = createAccounts(path);
    expect(again.glixBalance(r.account.id)).toBe(40);
    expect(again.glixLedger(r.account.id, 5)).toHaveLength(1);
    again.close();
  });
});

describe("Glix deposu", () => {
  it("maç: ilk maç ikiye katlanır, defter ve bakiye birlikte yazılır", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    const first = db.creditMatchGlix(a, NOON, 2);
    expect(first).toMatchObject({ total: 40, capped: false, balance: 40 });
    expect(first?.parts.map((p) => p.kind)).toEqual(["mac", "sira", "gununIlki"]);
    const second = db.creditMatchGlix(a, NOON + 1000, 4);
    expect(second).toMatchObject({ total: 10, balance: 50 });
    expect(db.glixBalance(a)).toBe(50);
    expect(db.glixEarnedToday(a, NOON)).toBe(50);
    expect(db.glixLedger(a, 10).map((r) => [r.amount, r.reason, r.ref])).toEqual([
      [10, "mac", "yer:4"],
      [40, "mac", "yer:2"],
    ]);
    db.close();
  });

  it("gün sınırı: yarın yeniden ilk maç, dünün toplamı sınıra sayılmaz", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    db.creditMatchGlix(a, NOON, 1);
    const next = db.creditMatchGlix(a, NOON + DAY, 1);
    expect(next?.total).toBe(50);
    expect(db.glixEarnedToday(a, NOON + DAY)).toBe(50);
    expect(db.glixEarnedToday(a, NOON)).toBe(50);
    // Gece yarısından önce/sonra ayrı günler.
    const midnight = istanbulDayStart(NOON) + 3 * DAY;
    expect(db.creditMatchGlix(a, midnight - 1, 4)?.total).toBe(20);
    expect(db.creditMatchGlix(a, midnight - 1, 4)?.total).toBe(10);
    expect(db.creditMatchGlix(a, midnight, 4)?.total).toBe(20);
    db.close();
  });

  it("günlük sınır: kısmi ödeme, sonra 0; rozet ödülü sınıra sayılmaz", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    // 1. maç 50 (ikiye katlı), sonra 25'lik maçlar: 50 + 10*25 = 300 tam.
    expect(db.creditMatchGlix(a, NOON, 1)?.total).toBe(50);
    for (let i = 0; i < 10; i++) expect(db.creditMatchGlix(a, NOON + 1000 + i, 1)?.total).toBe(25);
    expect(db.glixEarnedToday(a, NOON)).toBe(GLIX_DAILY_MATCH_CAP - 0);
    const over = db.creditMatchGlix(a, NOON + 5000, 1);
    expect(over).toMatchObject({ total: 0, capped: true, parts: [] });
    // Rozet sınırdan bağımsız verilir ve sınırı değiştirmez.
    expect(db.creditBadgeGlix(a, [{ badgeId: "ilk-mac", amount: 25 }], NOON + 6000)).toBe(325);
    expect(db.glixEarnedToday(a, NOON)).toBe(300);
    expect(db.creditMatchGlix(a, NOON + 7000, 1)?.total).toBe(0);
    db.close();
  });

  it("sınırı aşan maç kısmen ödenir", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    db.creditMatchGlix(a, NOON, 4); // 20
    for (let i = 0; i < 11; i++) db.creditMatchGlix(a, NOON + 1 + i, 1); // 11 x 25 = 275 -> 295
    const part = db.creditMatchGlix(a, NOON + 100, 1);
    expect(part).toMatchObject({ total: 5, capped: true, balance: 300 });
    expect(part?.parts).toEqual([{ kind: "mac", amount: 5 }]);
    db.close();
  });

  it("yönetici düzeltmesi: 0'ın altına inmez, hesap yoksa missing", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    expect(db.adjustGlix(a, 40, "telafi", 5)).toEqual({ ok: true, balance: 40 });
    expect(db.adjustGlix(a, -41, "fazla", 6)).toEqual({ ok: false, reason: "negative" });
    expect(db.adjustGlix(a, -40, "geri al", 7)).toEqual({ ok: true, balance: 0 });
    expect(db.adjustGlix(999, 5, "x", 8)).toEqual({ ok: false, reason: "missing" });
    expect(db.glixLedger(a, 10).map((r) => [r.amount, r.reason, r.ref])).toEqual([
      [-40, "yonetici", "geri al"],
      [40, "yonetici", "telafi"],
    ]);
    db.close();
  });

  it("silinen ya da olmayan hesaba yazılmaz", () => {
    const { db } = setup();
    expect(db.creditMatchGlix(999, NOON, 1)).toBeNull();
    expect(db.creditBadgeGlix(999, [{ badgeId: "ilk-mac", amount: 25 }], NOON)).toBeNull();
    expect(db.glixBalance(999)).toBe(0);
    db.close();
  });

  it("deleteAccountData ve hesap silme defteri de siler; başkasınınki kalır", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    const b = mk("Bora");
    db.creditMatchGlix(a, NOON, 1);
    db.creditMatchGlix(b, NOON, 1);
    db.deleteAccountData(a);
    expect(db.glixLedger(a, 10)).toEqual([]);
    expect(db.glixBalance(a)).toBe(0);
    expect(db.glixLedger(b, 10)).toHaveLength(1);
    expect(db.deleteAccount(b)).toBe(true);
    expect(db.glixLedger(b, 10)).toEqual([]);
    db.close();
  });

  it("dışa aktarma bakiye ve hareketleri içerir", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    db.creditMatchGlix(a, NOON, 3);
    expect(db.exportData(a)?.glix).toEqual({
      balance: 30,
      ledger: [{ at: NOON, amount: 30, reason: "mac", ref: "yer:3" }],
    });
    db.close();
  });
});

describe("Glix kayıtçı akışı", () => {
  it("maç + rozet ödülü ve bildirim: ilk maç 1. sıra", () => {
    const { db, mk, sent, finish } = setup();
    const a = mk("Ali");
    finish([{ id: a, place: 1 }]);
    // mac 10 + sıra 15 + ilk gün 25 = 50; rozetler: ilk-mac 25 + ilk-galibiyet 25.
    expect(sent).toHaveLength(1);
    const e = sent[0]?.[1];
    expect(e?.total).toBe(100);
    expect(e?.balance).toBe(100);
    expect(e?.capped).toBe(false);
    expect(e?.parts).toEqual([
      { kind: "mac", amount: 10 },
      { kind: "sira", amount: 15 },
      { kind: "gununIlki", amount: 25 },
      { kind: "rozet", amount: 25, badgeId: "ilk-mac" },
      { kind: "rozet", amount: 25, badgeId: "ilk-galibiyet" },
    ]);
    expect(db.glixBalance(a)).toBe(100);
    db.close();
  });

  it("eşit sıra aynı ödülü alır; 4. sıra yalnız tamamlama", () => {
    const { db, mk, sent, finish } = setup();
    const [a, b, c] = [mk("Ali"), mk("Bora"), mk("Can")];
    // Her biri ilk maçı; ikiye katlama + ilk-mac rozeti dahil.
    finish([
      { id: a, place: 1 },
      { id: b, place: 1 },
      { id: c, place: 4 },
    ]);
    const by = (id: number) => sent.find(([x]) => x === id)?.[1];
    expect(by(a)?.total).toBe(by(b)?.total);
    expect(by(c)?.parts).toEqual([
      { kind: "mac", amount: 10 },
      { kind: "gununIlki", amount: 10 },
      { kind: "rozet", amount: 25, badgeId: "ilk-mac" },
    ]);
    db.close();
  });

  it("günlük sınır birkaç maç boyunca korunur; sınır dolunca capped bildirimi gelir", () => {
    const { db, mk, sent, finish } = setup();
    const a = mk("Ali");
    for (let i = 0; i < 14; i++) finish([{ id: a, place: 1 }]);
    // Maç Glix'i tam 300; rozetler (ilk-mac, ilk-galibiyet, on-mac, on-galibiyet) ayrıca.
    expect(db.glixEarnedToday(a, NOON)).toBe(GLIX_DAILY_MATCH_CAP);
    const last = sent.at(-1)?.[1];
    expect(last?.capped).toBe(true);
    // Bu maçlardan hiçbir şey ödenmedi ama rozet varsa total > 0 olabilir; yeni maç artık yalnız sınır uyarısı.
    const before = db.glixBalance(a);
    finish([{ id: a, place: 1 }]);
    const again = sent.at(-1)?.[1];
    expect(again?.capped).toBe(true);
    expect(again?.total).toBe(0);
    expect(again?.parts).toEqual([]);
    expect(db.glixBalance(a)).toBe(before);
    // Ertesi gün yeniden ödenir ve ilk maç ikiye katlanır.
    finish([{ id: a, place: 1 }], NOON + DAY);
    expect(sent.at(-1)?.[1].parts.map((p) => p.kind)).toContain("gununIlki");
    db.close();
  });

  it("Glix hatası yutulur: maç ve rozet kaydı kalır", () => {
    const { db, mk, sent } = setup();
    const a = mk("Ali");
    const bad: AccountStore = {
      ...db,
      creditMatchGlix: () => {
        throw new Error("bozuk");
      },
    };
    const rec = createAccountRecorder(
      bad,
      () => {},
      (id, e) => sent.push([id, e]),
    );
    expect(() =>
      rec.matchFinished({
        endedAt: NOON,
        rows: [{ accountId: a, players: 2, games: 1, score: 1, place: 1 }],
        pairs: [],
      }),
    ).not.toThrow();
    expect(db.profile(a, false)?.totals.matches).toBe(1);
    expect(db.earnedBadges(a).length).toBeGreaterThan(0);
    expect(sent).toEqual([]);
    db.close();
  });
});

describe("Glix canlı akış", () => {
  useServer();

  async function enter(cookie: string | undefined, nickname: string, code?: string): Promise<Client> {
    const c = await Client.connect(cookie);
    if (code) c.send({ type: "joinRoom", code, nickname });
    else c.send({ type: "createRoom", nickname });
    await until(() => c.updates.length > 0 || c.of("error").length > 0, "oda");
    return c;
  }

  it("biten maç hesaplı oyunculara glixEarned yollar; misafire yollamaz; bakiye profilde", async () => {
    const host = await enter(loginCookie("Gx_Host"), "Host");
    host.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => host.room.gameIds.length === 1, "oyun");
    const code = host.session.roomCode;
    const ikinci = await enter(loginCookie("Gx_Ikinci"), "Ikinci", code);
    const misafir = await enter(undefined, "Misafir", code);
    await sync();
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of [host, ikinci, misafir]) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const startedAt = (host.room.match?.publicView as { startedAt: number } | undefined)?.startedAt ?? 0;
    k.clock.advance(startedAt + 20 - k.clock.now());
    await press(host);
    k.clock.advance(100);
    await press(ikinci);
    k.clock.advance(startedAt + 51_000 - k.clock.now());
    await until(() => host.room.phase === "results", "results");
    expect(host.of("glixEarned")).toEqual([]);
    k.clock.advance(30_100);
    await until(() => host.room.phase === "final", "final");
    await until(() => host.of("glixEarned").length > 0 && ikinci.of("glixEarned").length > 0, "glix");

    const hostId = k.srv.accounts.findByUsername("Gx_Host")?.id as number;
    const msg = host.of("glixEarned")[0];
    expect(host.of("glixEarned")).toHaveLength(1);
    expect(msg?.balance).toBe(k.srv.accounts.glixBalance(hostId));
    expect(msg?.total).toBe(msg?.parts.reduce((s, p) => s + p.amount, 0));
    // Sahte saat 03:16 İstanbul: gece-kusu (100) dahil; ilk maç ikiye katlı.
    const kinds = msg?.parts.map((p) => p.kind) ?? [];
    expect(kinds.slice(0, 1)).toEqual(["mac"]);
    expect(kinds).toContain("gununIlki");
    expect(msg?.parts.filter((p) => p.kind === "rozet").map((p) => p.badgeId)).toContain("gece-kusu");
    expect(msg?.capped).toBe(false);
    expect(misafir.of("glixEarned")).toEqual([]);

    const res = await fetch(`http://127.0.0.1:${k.srv.port}/api/profile`, {
      headers: { Cookie: loginCookie("Gx_Host") },
    });
    expect(((await res.json()) as { glix: number }).glix).toBe(msg?.balance);
  });
});
