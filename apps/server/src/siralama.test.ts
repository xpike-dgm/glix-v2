import { describe, expect, it } from "vitest";
import { createAccounts } from "./accountStore.js";
import { istanbulHour, istanbulWeekStart } from "./badges.js";
import { gameLeaders, rankStandings } from "./leaderboard.js";
import { k, loginCookie, useServer } from "./testkit.js";

/** 2026-10-26 pazartesi 00:00 (İstanbul) = 2026-10-25 21:00 UTC. */
const MONDAY = Date.UTC(2026, 9, 25, 21, 0, 0);

describe("İstanbul haftası", () => {
  it("pazartesi 00:00 sınırı", () => {
    expect(istanbulWeekStart(MONDAY)).toBe(MONDAY);
    expect(istanbulWeekStart(MONDAY + 1)).toBe(MONDAY);
    // Pazartesiden 1 ms önce (pazar 23:59:59.999) bir önceki haftadır.
    expect(istanbulWeekStart(MONDAY - 1)).toBe(MONDAY - 7 * 86_400_000);
    // Hafta sonu ve haftanın sonu aynı pazartesiye döner.
    expect(istanbulWeekStart(MONDAY + 6 * 86_400_000 + 23 * 3600_000)).toBe(MONDAY);
    expect(istanbulWeekStart(MONDAY + 7 * 86_400_000)).toBe(MONDAY + 7 * 86_400_000);
  });

  it("UTC'de hâlâ pazar olsa da İstanbul'da pazartesi sayılır", () => {
    // Pazar 21:30 UTC = pazartesi 00:30 İstanbul.
    expect(istanbulWeekStart(MONDAY + 30 * 60_000)).toBe(MONDAY);
  });

  it("günün saati İstanbul'a göre", () => {
    expect(istanbulHour(Date.UTC(2026, 9, 26, 23, 0))).toBe(2);
    expect(istanbulHour(Date.UTC(2026, 9, 27, 1, 59))).toBe(4);
    expect(istanbulHour(Date.UTC(2026, 9, 27, 2, 0))).toBe(5);
  });
});

function setup() {
  const db = createAccounts(":memory:");
  const mk = (n: string): number => {
    const r = db.create(n, `${n.toLowerCase()}@t.local`, "x", 1);
    if (!r.ok) throw new Error("hesap");
    return r.account.id;
  };
  const [a, b, c, d] = [mk("Ali"), mk("Bora"), mk("Cem"), mk("Dilek")] as [number, number, number, number];
  const match = (id: number, at: number, place: number, score: number): void =>
    db.recordMatch(at, [{ accountId: id, players: 4, games: 3, score, place }], []);
  return { db, a, b, c, d, match };
}

describe("sıralama hesabı", () => {
  it("eşit değer aynı sırayı paylaşır (1, 1, 3), sıfırlar da dahil", () => {
    const { db, a, b, c, d, match } = setup();
    match(a, MONDAY + 10, 1, 5);
    match(b, MONDAY + 20, 1, 5);
    match(c, MONDAY + 30, 2, 9);
    const rows = rankStandings(db.standings([a, b, c, d], null), "wins", a);
    expect(rows).toEqual([
      { username: "Ali", value: 1, rank: 1, you: true },
      { username: "Bora", value: 1, rank: 1, you: false },
      { username: "Cem", value: 0, rank: 3, you: false },
      { username: "Dilek", value: 0, rank: 3, you: false },
    ]);
    const bySc = rankStandings(db.standings([a, b, c, d], null), "score", b);
    expect(bySc.map((r) => [r.username, r.value, r.rank])).toEqual([
      ["Cem", 9, 1],
      ["Ali", 5, 2],
      ["Bora", 5, 2],
      ["Dilek", 0, 4],
    ]);
    expect(bySc.filter((r) => r.you).map((r) => r.username)).toEqual(["Bora"]);
    const byN = rankStandings(db.standings([a, b, c, d], null), "matches", a);
    expect(byN.map((r) => r.value)).toEqual([1, 1, 1, 0]);
    db.close();
  });

  it("hafta yalnız pazartesi 00:00 sonrasını sayar", () => {
    const { db, a, b, match } = setup();
    match(a, MONDAY - 1, 1, 10);
    match(a, MONDAY, 1, 3);
    match(b, MONDAY + 5, 2, 1);
    const since = istanbulWeekStart(MONDAY + 3 * 86_400_000);
    const week = rankStandings(db.standings([a, b], since), "score", a);
    expect(week.map((r) => [r.username, r.value])).toEqual([
      ["Ali", 3],
      ["Bora", 1],
    ]);
    const all = rankStandings(db.standings([a, b], null), "score", a);
    expect(all[0]).toMatchObject({ username: "Ali", value: 13 });
    db.close();
  });

  it("oyun liderleri: en çok birincilik, eşitlikte oynama; birincilik yoksa listelenmez", () => {
    const { db, a, b, c } = setup();
    const g = (id: number, gameId: string, at: number, rank: number): void =>
      db.recordGame(at, [{ accountId: id, gameId, players: 3, miniScore: 1, rank }]);
    g(a, "butona-bas", 10, 1);
    g(b, "butona-bas", 11, 1);
    g(b, "butona-bas", 12, 1);
    g(c, "butona-bas", 13, 3);
    g(a, "sizma", 14, 2);
    g(c, "kule-ustasi", 15, 1);
    const rows = gameLeaders(db.gameStandings([a, b, c], null), a, (id) =>
      id === "sizma" ? null : id === "butona-bas" ? "Butona Bas" : "Kule",
    );
    expect(rows).toEqual([
      { gameId: "butona-bas", name: "Butona Bas", leader: { username: "Bora", wins: 2 }, you: { wins: 1 } },
      { gameId: "kule-ustasi", name: "Kule", leader: { username: "Cem", wins: 1 }, you: { wins: 0 } },
    ]);
    db.close();
  });
});

describe("sıralama ucu", () => {
  useServer();
  const base = () => `http://127.0.0.1:${k.srv.port}`;
  const get = async (path: string, cookie?: string) => {
    const res = await fetch(`${base()}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  const idOf = (n: string): number => k.srv.accounts.findByUsername(n)?.id as number;

  it("oturum yoksa 401, geçersiz sorgu 400, POST 405", async () => {
    expect((await get("/api/leaderboard?period=all&metric=wins")).status).toBe(401);
    const c = loginCookie("Sira_1");
    expect((await get("/api/leaderboard?period=yil&metric=wins", c)).status).toBe(400);
    expect((await get("/api/leaderboard?period=all&metric=xp", c)).status).toBe(400);
    expect((await get("/api/leaderboard?metric=wins", c)).status).toBe(400);
    expect((await get("/api/leaderboard/games", c)).status).toBe(400);
    expect((await get("/api/leaderboard/baska?period=all", c)).status).toBe(400);
    const res = await fetch(`${base()}/api/leaderboard?period=all&metric=wins`, {
      method: "POST",
      headers: { Cookie: c },
    });
    expect(res.status).toBe(405);
  });

  it("yalnız sen ve kabul edilmiş arkadaşların; başkaları ve bekleyen istekler yok", async () => {
    const me = loginCookie("Ben_1");
    loginCookie("Dost_1");
    loginCookie("Yabanci_1");
    loginCookie("Bekleyen_1");
    const [m, d, y, bk] = ["Ben_1", "Dost_1", "Yabanci_1", "Bekleyen_1"].map(idOf) as [
      number,
      number,
      number,
      number,
    ];
    k.srv.accounts.requestFriend(m, d, 1);
    k.srv.accounts.acceptFriend(d, m, 2);
    k.srv.accounts.requestFriend(bk, m, 3);
    const row = (id: number, place: number) =>
      k.srv.accounts.recordMatch(
        k.clock.now(),
        [{ accountId: id, players: 3, games: 2, score: 4, place }],
        [],
      );
    row(m, 2);
    row(d, 1);
    row(y, 1);
    row(bk, 1);
    const r = await get("/api/leaderboard?period=all&metric=wins", me);
    expect(r.status).toBe(200);
    expect(r.body.rows).toEqual([
      { username: "Dost_1", value: 1, rank: 1, you: false },
      { username: "Ben_1", value: 0, rank: 2, you: true },
    ]);
    const text = JSON.stringify(r.body);
    expect(text).not.toContain("Yabanci_1");
    expect(text).not.toContain("Bekleyen_1");
    expect(text).not.toContain("@test.local");
  });

  it("hafta sekmesi sahte saate göre pazartesiyi sınır alır", async () => {
    const me = loginCookie("Hafta_1");
    const id = idOf("Hafta_1");
    // Sahte saat 1970'te başlar; hafta sınırı o günün İstanbul pazartesisidir (saati ilerletmek binlerce tick çalıştırır).
    const start = istanbulWeekStart(k.clock.now());
    k.srv.accounts.recordMatch(start - 5, [{ accountId: id, players: 2, games: 1, score: 7, place: 1 }], []);
    k.srv.accounts.recordMatch(start + 5, [{ accountId: id, players: 2, games: 1, score: 2, place: 2 }], []);
    const week = await get("/api/leaderboard?period=week&metric=score", me);
    expect(week.body.rows).toEqual([{ username: "Hafta_1", value: 2, rank: 1, you: true }]);
    const all = await get("/api/leaderboard?period=all&metric=score", me);
    expect((all.body.rows as { value: number }[])[0]?.value).toBe(9);
  });

  it("oyun liderleri ucu oyun adıyla gelir ve arkadaş olmayanı saymaz", async () => {
    const me = loginCookie("Lider_1");
    loginCookie("Lider_2");
    loginCookie("Lider_3");
    const [m, f, o] = ["Lider_1", "Lider_2", "Lider_3"].map(idOf) as [number, number, number];
    k.srv.accounts.requestFriend(m, f, 1);
    k.srv.accounts.acceptFriend(f, m, 2);
    const g = (id: number, rank: number) =>
      k.srv.accounts.recordGame(k.clock.now(), [
        { accountId: id, gameId: "butona-bas", players: 3, miniScore: 1, rank },
      ]);
    g(m, 1);
    g(f, 1);
    g(f, 1);
    g(o, 1);
    g(o, 1);
    g(o, 1);
    const r = await get("/api/leaderboard/games?period=all", me);
    expect(r.status).toBe(200);
    expect(r.body.games).toEqual([
      {
        gameId: "butona-bas",
        name: "Butona Bas",
        leader: { username: "Lider_2", wins: 2 },
        you: { wins: 1 },
      },
    ]);
  });

  it("hız sınırı aşılınca 429", async () => {
    const me = loginCookie("Hizli_1");
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await get("/api/leaderboard?period=all&metric=wins", me)).status;
    expect(last).toBe(429);
  });
});
