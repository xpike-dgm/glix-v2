/** Günlük görevler: depo (ödül bir kez, silme, dışa aktarma, göç), maç hattı (açık/kapalı), yönetici anahtarı, canlı akış. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AdminContent,
  dailyQuests,
  istanbulDayNumber,
  QUEST_POOL,
  type QuestCompleted,
  questReward,
} from "@glix/engine";
import { afterAll, describe, expect, it } from "vitest";
import { createAccountRecorder } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { istanbulDayStart } from "./badges.js";
import { buildExport } from "./kvkk.js";
import { settleQuests } from "./quests.js";
import { noopSocial } from "./social.js";
import { Client, k, loginCookie, press, sync, until, useServer } from "./testkit.js";
import { ADMIN, base, createAdminKit, MAIL } from "./yoneticiKit.js";

/** 2026-10-26 12:00 İstanbul. */
const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);
const DAY = 24 * 3600 * 1000;
const DAY_NO = istanbulDayNumber(NOON);

function mk(db: AccountStore, name: string): number {
  const r = db.create(name, `${name.toLowerCase()}@t.local`, "x", 1);
  if (!r.ok) throw new Error("hesap");
  return r.account.id;
}

/** `dailyQuests`'in o gün için verdiği kimlikler. */
const idsOf = (accountId: number, dayNo = DAY_NO): string[] => dailyQuests(accountId, dayNo).map((q) => q.id);

/** Verilen görevi içeren bir hesap kimliği bulana dek boş hesaplar açar; sonuncusu döner. */
function accountWith(db: AccountStore, questId: string, dayNo = DAY_NO): number {
  for (let i = 0; i < 300; i++) {
    const id = mk(db, `Dolgu${i}`);
    if (idsOf(id, dayNo).includes(questId)) return id;
  }
  throw new Error("hesap bulunamadı");
}

describe("günlük görev deposu", () => {
  it("ödül bir kez yazılır (çift çağrı, yarış, ertesi gün yeniden); defter ve bakiye tutarlı", () => {
    const db = createAccounts(":memory:");
    const a = mk(db, "Ali");
    const start = istanbulDayStart(NOON);
    const first = db.creditQuests(a, start, NOON, [{ id: "mac-3", reward: 30 }]);
    expect(first).toEqual({ paid: [{ id: "mac-3", reward: 30 }], balance: 30 });
    // Aynı görev ikinci kez ödenmez; yeni olanlar ödenir.
    const second = db.creditQuests(a, start, NOON + 1, [
      { id: "mac-3", reward: 30 },
      { id: "ilk3", reward: 50 },
    ]);
    expect(second).toEqual({ paid: [{ id: "ilk3", reward: 50 }], balance: 80 });
    expect(db.creditQuests(a, start, NOON + 2, [{ id: "ilk3", reward: 50 }])?.paid).toEqual([]);
    expect(db.glixBalance(a)).toBe(80);
    expect(
      db
        .glixLedger(a, 10)
        .filter((r) => r.reason === "gorev")
        .map((r) => [r.amount, r.ref])
        .sort(),
    ).toEqual([
      [30, "mac-3"],
      [50, "ilk3"],
    ]);
    expect(db.questsPaid(a, start).sort()).toEqual(["ilk3", "mac-3"]);
    // Ertesi gün aynı görev yeniden ödenebilir.
    expect(db.creditQuests(a, start + DAY, NOON + DAY, [{ id: "mac-3", reward: 30 }])?.paid).toHaveLength(1);
    // Görev ödülü günlük maç sınırına sayılmaz.
    expect(db.glixEarnedToday(a, NOON)).toBe(0);
    expect(db.creditQuests(9999, start, NOON, [{ id: "mac-3", reward: 30 }])).toBeNull();
    db.close();
  });

  it("hesap silinince görev satırları da gider; dışa aktarma görevleri içerir", () => {
    const db = createAccounts(":memory:");
    const a = mk(db, "Ali");
    const b = mk(db, "Veli");
    const start = istanbulDayStart(NOON);
    db.creditQuests(a, start, NOON, [{ id: "mac-3", reward: 30 }]);
    db.creditQuests(b, start, NOON, [{ id: "mac-3", reward: 30 }]);
    expect(db.exportData(a)?.quests).toEqual([{ day: start, questId: "mac-3", at: NOON, reward: 30 }]);
    expect(buildExport(db, noopSocial, a, NOON)?.daily_quests).toEqual([
      { quest_id: "mac-3", day: "2026-10-26", paid_at: new Date(NOON).toISOString(), reward: 30 },
    ]);
    expect(db.deleteAccount(a)).toBe(true);
    expect(db.questsPaid(a, start)).toEqual([]);
    expect(db.questsPaid(b, start)).toEqual(["mac-3"]);
    // Verilerimi sil: hesap kalır, görev satırları gider.
    db.deleteAccountData(b);
    expect(db.questsPaid(b, start)).toEqual([]);
    db.close();
  });

  it("olgular yalnız o İstanbul gününün satırlarından hesaplanır", () => {
    const db = createAccounts(":memory:");
    const a = mk(db, "Ali");
    const start = istanbulDayStart(NOON);
    const game = (gameId: string, rank: number, at: number) =>
      db.recordGame(at, [{ accountId: a, gameId, players: 4, miniScore: 3, rank }]);
    const match = (place: number, score: number, at: number) =>
      db.recordMatch(at, [{ accountId: a, players: 4, games: 3, score, place }], []);
    game("butona-bas", 1, NOON);
    game("kule-ustasi", 3, NOON + 1);
    game("butona-bas", 2, NOON + 2);
    game("kule-ustasi", 1, start - 1); // dün
    match(2, 12, NOON);
    match(1, 4, NOON + 10);
    match(4, 20, NOON + 20);
    match(1, 1, start - 5); // dün
    const f = db.questFacts(a, start);
    expect(f).toMatchObject({
      matches: 3,
      top3Matches: 2,
      bestScore: 20,
      gamesFinished: 3,
      distinctGames: 2,
      gameWins: 1,
      friendMatches: 0,
      top3Streak: 2,
    });
    db.close();
  });

  it("arkadaşla oynanan maç sayılır, arkadaş olmayanla sayılmaz", () => {
    const db = createAccounts(":memory:");
    const a = mk(db, "Ali");
    const b = mk(db, "Veli");
    const c = mk(db, "Can");
    const start = istanbulDayStart(NOON);
    const rows = [a, b, c].map((id) => ({ accountId: id, players: 3, games: 1, score: 1, place: 1 }));
    db.recordMatch(NOON, rows, [
      [a, b],
      [a, c],
      [b, c],
    ]);
    expect(db.questFacts(a, start).friendMatches).toBe(0);
    db.requestFriend(a, b, NOON);
    expect(db.acceptFriend(b, a, NOON)).toBe("ok");
    expect(db.questFacts(a, start).friendMatches).toBe(1);
    expect(db.questFacts(c, start).friendMatches).toBe(0);
    db.close();
  });
});

describe("günlük görev göçü", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-gorev-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("defter yeniden kurulumu eski satırları ve kimlikleri korur; 'gorev' nedeni kabul edilir", () => {
    const path = join(dir, "hesap.db");
    const db = createAccounts(path);
    const a = mk(db, "Ali");
    db.adjustGlix(a, 40, "not", NOON);
    db.creditBadgeGlix(a, [{ badgeId: "ilk-mac", amount: 25 }], NOON + 1);
    db.close();
    const again = createAccounts(path);
    expect(again.glixLedger(a, 10).map((r) => [r.reason, r.amount])).toEqual([
      ["rozet", 25],
      ["yonetici", 40],
    ]);
    again.creditQuests(a, istanbulDayStart(NOON), NOON + 2, [{ id: "mac-3", reward: 30 }]);
    expect(again.glixBalance(a)).toBe(95);
    again.close();
  });
});

describe("maç hattı: anahtar ve ödül", () => {
  function setup(enabled: () => boolean) {
    const db = createAccounts(":memory:");
    const done: [number, QuestCompleted[], number][] = [];
    const rec = createAccountRecorder(
      db,
      () => {},
      () => {},
      enabled,
      (id, q, balance) => done.push([id, q, balance]),
    );
    return { db, rec, done };
  }
  const finish = (
    rec: ReturnType<typeof setup>["rec"],
    id: number,
    place: number,
    score: number,
    at: number,
  ) => {
    rec.gameFinished({
      gameId: "butona-bas",
      endedAt: at,
      rows: [{ accountId: id, gameId: "butona-bas", players: 3, miniScore: score, rank: place }],
    });
    rec.matchFinished({
      endedAt: at,
      rows: [{ accountId: id, players: 3, games: 1, score, place }],
      pairs: [],
    });
  };

  it("açıkken: görev tamamlanır, ödül bir kez gelir, sonraki maçta yinelenmez", () => {
    const { db, rec, done } = setup(() => true);
    const a = accountWith(db, "ilk3");
    finish(rec, a, 1, 5, NOON);
    const day = idsOf(a);
    const q1 = done.at(-1);
    expect(q1?.[1].map((q) => q.id)).toContain("ilk3");
    const expectedIds = dailyQuests(a, DAY_NO)
      .filter((q) => db.questsPaid(a, istanbulDayStart(NOON)).includes(q.id))
      .map((q) => q.id);
    expect(q1?.[1].map((q) => q.id).sort()).toEqual(expectedIds.sort());
    for (const q of q1?.[1] ?? [])
      expect(q.reward).toBe(questReward(QUEST_POOL.find((p) => p.id === q.id) ?? (QUEST_POOL[0] as never)));
    const gorev = db.glixLedger(a, 50).filter((r) => r.reason === "gorev");
    expect(gorev.map((r) => r.ref).sort()).toEqual(expectedIds.sort());
    expect(q1?.[2]).toBe(db.glixBalance(a));
    expect(day).toContain("ilk3");
    // İkinci maç aynı görevleri yeniden ödemez.
    const before = db.glixLedger(a, 100).filter((r) => r.reason === "gorev").length;
    finish(rec, a, 1, 5, NOON + 60_000);
    const after = db.glixLedger(a, 100).filter((r) => r.reason === "gorev").length;
    const newly = (done.at(-1)?.[1] ?? []).length;
    expect(after - before).toBe(done.length > 1 ? newly : 0);
    for (const id of new Set(
      db
        .glixLedger(a, 100)
        .filter((r) => r.reason === "gorev")
        .map((r) => r.ref),
    ))
      expect(db.glixLedger(a, 100).filter((r) => r.reason === "gorev" && r.ref === id)).toHaveLength(1);
    db.close();
  });

  it("kapalıyken: ödül, defter satırı ve bildirim yok; anahtar açılınca günün ilerlemesi yakalanır", () => {
    let on = false;
    const { db, rec, done } = setup(() => on);
    const a = accountWith(db, "ilk3");
    finish(rec, a, 1, 5, NOON);
    expect(done).toEqual([]);
    expect(db.glixLedger(a, 50).filter((r) => r.reason === "gorev")).toEqual([]);
    expect(db.questsPaid(a, istanbulDayStart(NOON))).toEqual([]);
    on = true;
    finish(rec, a, 1, 5, NOON + 60_000);
    expect(done.at(-1)?.[1].map((q) => q.id)).toContain("ilk3");
    db.close();
  });

  it("görev hatası maç kaydını bozmaz", () => {
    const db = createAccounts(":memory:");
    const a = mk(db, "Ali");
    const bad: AccountStore = {
      ...db,
      questFacts: () => {
        throw new Error("bozuk");
      },
    };
    const rec = createAccountRecorder(
      bad,
      () => {},
      () => {},
      () => true,
    );
    expect(() =>
      rec.matchFinished({
        endedAt: NOON,
        rows: [{ accountId: a, players: 3, games: 1, score: 1, place: 1 }],
        pairs: [],
      }),
    ).not.toThrow();
    expect(db.profile(a, false)?.totals.matches).toBe(1);
    expect(settleQuests(db, 424242, NOON)).toBeNull();
    db.close();
  });
});

describe("yönetici anahtarı ve uç", () => {
  const kit = createAdminKit();
  const { get, post, adminLogin } = kit;
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch: kit.mailFetch, statsDb: ":memory:" });

  const quests = async (cookie: string) => {
    const res = await fetch(`${base()}/api/quests`, { headers: { Cookie: cookie } });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("varsayılan kapalı; yönetici açar/kapatır; denetim kaydı; kalıcı ayar", async () => {
    const admin = await adminLogin();
    expect((await get<AdminContent>("content", admin)).body.gunlukGorevler).toBe(false);
    expect(k.srv.runtime.gunlukGorevler).toBe(false);
    expect((await post("content/quests", admin, { on: "evet" })).status).toBe(400);
    expect((await post("content/quests", admin, { on: true })).status).toBe(200);
    expect(k.srv.runtime.gunlukGorevler).toBe(true);
    expect(k.srv.accounts.settingGet("gunlukGorevler")).toBe("1");
    expect((await get<AdminContent>("content", admin)).body.gunlukGorevler).toBe(true);
    expect((await post("content/quests", admin, { on: false })).status).toBe(200);
    expect(k.srv.accounts.settingGet("gunlukGorevler")).toBeNull();
    expect(
      k.srv.accounts
        .adminAuditTail(10)
        .filter((a) => a.action.startsWith("quests_"))
        .map((a) => a.action),
    ).toEqual(["quests_off", "quests_on"]);
  });

  it("yönetici olmayan değiştiremez", async () => {
    loginCookie("yonetici_1"); // kimlik 1 yönetici
    expect((await post("content/quests", loginCookie("oyuncu_2"), { on: true })).status).toBe(404);
    expect(k.srv.runtime.gunlukGorevler).toBe(false);
  });

  it("GET /api/quests: misafir 401; kapalıyken yalnız enabled:false; açıkken üç görev ve gece yarısı", async () => {
    expect((await fetch(`${base()}/api/quests`)).status).toBe(401);
    const cookie = loginCookie("Gorevli");
    expect(await quests(cookie)).toEqual({ status: 200, body: { ok: true, enabled: false } });
    k.srv.runtime.gunlukGorevler = true;
    const r = await quests(cookie);
    const list = r.body.quests as {
      id: string;
      target: number;
      progress: number;
      reward: number;
      done: boolean;
    }[];
    expect(r.body.enabled).toBe(true);
    expect(list).toHaveLength(3);
    expect(list.map((q) => q.reward)).toEqual([30, 50, 80]);
    expect(list.every((q) => q.progress === 0 && !q.done)).toBe(true);
    const next = r.body.endsAt as number;
    expect(next).toBeGreaterThan(k.clock.now());
    expect(next - k.clock.now()).toBeLessThanOrEqual(DAY);
    expect((next + 3 * 3600 * 1000) % DAY).toBe(0);
  });
});

describe("canlı akış", () => {
  useServer();

  async function playMatch(): Promise<{ host: Client; ikinci: Client; hostId: number }> {
    // Sıradaki hesap kimliği "ilk3" görevini içersin (3 kişilik maçta herkes ilk 3'tedir).
    const dayNo = istanbulDayNumber(k.clock.now());
    for (let i = 0; i < 300; i++) {
      const last = mk(k.srv.accounts, `Dolgu${i}`);
      if (idsOf(last + 1, dayNo).includes("ilk3")) break;
    }
    const host = await Client.connect(loginCookie("Gr_Host"));
    host.send({ type: "createRoom", nickname: "Host" });
    await until(() => host.updates.length > 0, "oda");
    const hostId = k.srv.accounts.findByUsername("Gr_Host")?.id as number;
    host.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => host.room.gameIds.length === 1, "oyun");
    const code = host.session.roomCode;
    const ikinci = await Client.connect(loginCookie("Gr_Ikinci"));
    ikinci.send({ type: "joinRoom", code, nickname: "Ikinci" });
    await until(() => ikinci.updates.length > 0, "katildi");
    const ucuncu = await Client.connect();
    ucuncu.send({ type: "joinRoom", code, nickname: "Misafir" });
    await until(() => ucuncu.updates.length > 0, "katildi 3");
    await sync();
    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of [host, ikinci, ucuncu]) c.send({ type: "ready" });
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
    k.clock.advance(30_100);
    await until(() => host.room.phase === "final", "final");
    return { host, ikinci, hostId };
  }

  it("kapalıyken questsDone gelmez ve deftere görev satırı yazılmaz", async () => {
    const { host, ikinci } = await playMatch();
    await until(() => host.of("glixEarned").length > 0, "glix");
    await sync();
    expect(host.of("questsDone")).toEqual([]);
    expect(ikinci.of("questsDone")).toEqual([]);
    const hostId = k.srv.accounts.findByUsername("Gr_Host")?.id as number;
    expect(k.srv.accounts.glixLedger(hostId, 50).filter((r) => r.reason === "gorev")).toEqual([]);
  });

  it("açıkken tamamlanan görevler questsDone ile gelir ve bakiye tutar; yalnız hesaplıya", async () => {
    k.srv.runtime.gunlukGorevler = true;
    const { host, ikinci } = await playMatch();
    await until(() => host.of("glixEarned").length > 0, "glix");
    await sync();
    const hostId = k.srv.accounts.findByUsername("Gr_Host")?.id as number;
    expect(hostId).toBeGreaterThan(0);
    const dayNo = istanbulDayNumber(k.clock.now());
    expect(idsOf(hostId, dayNo)).toContain("ilk3");
    const paid = k.srv.accounts.questsPaid(hostId, istanbulDayStart(k.clock.now())).sort();
    const msgs = host.of("questsDone");
    expect(paid).toContain("ilk3");
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.quests.map((q) => q.id).sort()).toEqual(paid);
    expect(msgs[0]?.balance).toBe(k.srv.accounts.glixBalance(hostId));
    expect(msgs[0]?.quests.find((q) => q.id === "ilk3")?.reward).toBe(50);
    for (const q of msgs[0]?.quests ?? []) expect(idsOf(hostId, dayNo)).toContain(q.id);
    expect(ikinci.of("questsDone").length).toBeLessThanOrEqual(1);
  });
});
