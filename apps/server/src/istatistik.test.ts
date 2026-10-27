import { describe, expect, it } from "vitest";
import { buildGameRecord, buildMatchRecord, type Entrant, rankEntrants } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { Client, k, loginCookie, press, sync, until, useServer } from "./testkit.js";

const e = (playerId: string, accountId: number | null, score: number): Entrant => ({
  playerId,
  accountId,
  score,
});

describe("sıralama ve kayıt kurma", () => {
  it("eşit puan aynı sırayı paylaşır (1, 1, 3)", () => {
    const ranks = rankEntrants([e("a", 1, 5), e("b", 2, 9), e("c", 3, 5), e("d", 4, -2)]);
    expect([...ranks]).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
    expect([...rankEntrants([e("a", 1, 3), e("b", 2, 3), e("c", 3, 1)])]).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ]);
  });

  it("oyun kaydı sonuç sayaçlarını yalnız hesaplı oyuncuya taşır", () => {
    const rec = buildGameRecord("kule-ustasi", 1000, [
      { ...e("g", null, 7), stats: { perfects: 5 } },
      { ...e("a", 11, 4), stats: { perfects: 3 } },
      e("b", 12, 2),
    ]);
    expect(rec.rows.map((r) => [r.accountId, r.stats])).toEqual([
      [11, { perfects: 3 }],
      [12, undefined],
    ]);
  });

  it("oyun kaydı: misafir sıralamaya girer ama satırı yazılmaz", () => {
    const rec = buildGameRecord("kule-ustasi", 1000, [e("g", null, 7), e("a", 11, 4), e("b", 12, 7)]);
    expect(rec.rows).toEqual([
      { accountId: 11, gameId: "kule-ustasi", players: 3, miniScore: 4, rank: 3 },
      { accountId: 12, gameId: "kule-ustasi", players: 3, miniScore: 7, rank: 1 },
    ]);
  });

  it("maç kaydı: yer genel skora göre, çiftler yalnız hesaplılar arasında", () => {
    const rec = buildMatchRecord(5, 2000, [e("a", 1, 10), e("g", null, 10), e("b", 2, 4), e("c", 3, 4)]);
    expect(rec.rows.map((r) => [r.accountId, r.place, r.players, r.games])).toEqual([
      [1, 1, 4, 5],
      [2, 3, 4, 5],
      [3, 3, 4, 5],
    ]);
    expect(rec.pairs).toEqual([
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it("aynı hesap iki oyuncu olarak girerse bir kez sayılır", () => {
    const rec = buildMatchRecord(1, 1, [e("a", 1, 3), e("a2", 1, 2), e("b", 2, 1)]);
    expect(rec.rows.map((r) => r.accountId)).toEqual([1, 2]);
    expect(rec.pairs).toEqual([[1, 2]]);
  });

  it("hesaplı kimse yoksa satır yok", () => {
    expect(buildGameRecord("x", 1, [e("g", null, 1), e("h", null, 2)]).rows).toEqual([]);
    expect(buildMatchRecord(1, 1, [e("g", null, 1)]).pairs).toEqual([]);
  });
});

function store(): { db: AccountStore; ids: number[] } {
  const db = createAccounts(":memory:");
  const ids = ["Ali", "Veli", "Can", "Deniz"].map((n, i) => {
    const made = db.create(n, `${n.toLowerCase()}@t.local`, "x", 1000 + i);
    if (!made.ok) throw new Error("hesap açılamadı");
    return made.account.id;
  });
  return { db, ids };
}

describe("istatistik deposu", () => {
  it("yeni hesabın profili boş", () => {
    const { db, ids } = store();
    const p = db.profile(ids[0] as number, true);
    expect(p).toMatchObject({
      username: "Ali",
      createdAt: 1000,
      totals: { matches: 0, wins: 0, winRate: 0, games: 0, gameWins: 0 },
      favoriteGame: null,
      perGame: [],
      recent: [],
      coPlayers: [],
    });
    expect(db.profile(9999, true)).toBeNull();
    db.close();
  });

  it("oyun ve maç toplamları SQL ile hesaplanır", () => {
    const { db, ids } = store();
    const [a, b] = ids as [number, number];
    const row = (accountId: number, gameId: string, miniScore: number, rank: number) => ({
      accountId,
      gameId,
      players: 3,
      miniScore,
      rank,
    });
    db.recordGame(10, [row(a, "kule", 6, 1), row(b, "kule", 3, 2)]);
    db.recordGame(20, [row(a, "kule", 2, 2), row(b, "kule", 5, 1)]);
    db.recordGame(30, [row(a, "sizma", 9, 1)]);
    db.recordGame(40, [row(a, "kule", 4, 1)]);
    const p = db.profile(a, true);
    expect(p?.totals).toMatchObject({ games: 4, gameWins: 3 });
    expect(p?.favoriteGame).toEqual({ id: "kule", plays: 3 });
    expect(p?.perGame).toEqual([
      { gameId: "kule", plays: 3, wins: 2, bestMini: 6, avgMini: 4 },
      { gameId: "sizma", plays: 1, wins: 1, bestMini: 9, avgMini: 9 },
    ]);
    db.recordMatch(50, [{ accountId: a, players: 3, games: 2, score: 4, place: 1 }], []);
    db.recordMatch(60, [{ accountId: a, players: 3, games: 2, score: 1, place: 2 }], []);
    db.recordMatch(70, [{ accountId: a, players: 4, games: 2, score: 3, place: 1 }], []);
    const t = db.profile(a, true);
    expect(t?.totals).toMatchObject({ matches: 3, wins: 2, winRate: 0.667 });
    expect(t?.recent.map((r) => r.endedAt)).toEqual([70, 60, 50]);
    expect(t?.recent[0]).toEqual({ endedAt: 70, players: 4, place: 1, score: 3 });
    db.close();
  });

  it("son maçlar 10 ile sınırlı, birlikte oynayanlar en çok 5 ve maç sayısına göre", () => {
    const { db, ids } = store();
    const a = ids[0] as number;
    for (let i = 0; i < 12; i++)
      db.recordMatch(100 + i, [{ accountId: a, players: 2, games: 1, score: i, place: 2 }], []);
    expect(db.profile(a, true)?.recent).toHaveLength(10);
    expect(db.profile(a, true)?.recent[0]?.endedAt).toBe(111);
    // Ali-Veli iki, Ali-Can bir, Ali-Deniz bir maç.
    db.recordMatch(200, [], [[a, ids[1] as number]]);
    // Boş satırla çiftler yazılmaz (maçta hesaplı oyuncu olmadan çift olamaz).
    expect(db.profile(a, true)?.coPlayers).toEqual([]);
    const m = (others: number[]) =>
      db.recordMatch(
        300,
        [{ accountId: a, players: 3, games: 1, score: 0, place: 1 }],
        others.map((o) => [a, o] as const),
      );
    m([ids[1] as number, ids[2] as number]);
    m([ids[1] as number]);
    m([ids[3] as number]);
    const co = db.profile(a, true)?.coPlayers;
    expect(co?.[0]).toEqual({ username: "Veli", matches: 2 });
    expect(co?.map((c) => c.username).sort()).toEqual(["Can", "Deniz", "Veli"]);
    // Karşı taraf da sayılır.
    expect(db.profile(ids[1] as number, true)?.coPlayers).toEqual([{ username: "Ali", matches: 2 }]);
    db.close();
  });

  it("herkese açık görünümde son maçlar ve birlikte oynayanlar yok", () => {
    const { db, ids } = store();
    const [a, b] = ids as [number, number];
    db.recordMatch(
      5,
      [
        { accountId: a, players: 2, games: 1, score: 1, place: 1 },
        { accountId: b, players: 2, games: 1, score: 0, place: 2 },
      ],
      [[a, b]],
    );
    const p = db.profile(a, false);
    expect(p?.totals.matches).toBe(1);
    expect(p?.recent).toEqual([]);
    expect(p?.coPlayers).toEqual([]);
    db.close();
  });

  it("yazma tek işlemdir: hata olursa hiçbir satır kalmaz", () => {
    const { db, ids } = store();
    const [a, b] = ids as [number, number];
    expect(() =>
      db.recordMatch(
        5,
        [
          { accountId: a, players: 2, games: 1, score: 1, place: 1 },
          { accountId: b, players: 2, games: 1, score: null as unknown as number, place: 2 },
        ],
        [[a, b]],
      ),
    ).toThrow();
    expect(db.profile(a, true)?.totals.matches).toBe(0);
    expect(db.profile(a, true)?.coPlayers).toEqual([]);
    // İşlem açık kalmadı: sonraki yazma çalışır.
    db.recordMatch(6, [{ accountId: a, players: 2, games: 1, score: 1, place: 1 }], []);
    expect(db.profile(a, true)?.totals.matches).toBe(1);
    db.close();
  });

  it("var olmayan hesabın satırı atlanır, diğerleri yazılır", () => {
    const { db, ids } = store();
    const a = ids[0] as number;
    db.recordMatch(
      5,
      [
        { accountId: 9999, players: 2, games: 1, score: 1, place: 1 },
        { accountId: a, players: 2, games: 1, score: 0, place: 2 },
      ],
      [[a, 9999]],
    );
    expect(db.profile(a, true)?.totals.matches).toBe(1);
    expect(db.profile(a, true)?.coPlayers).toEqual([]);
    db.close();
  });

  it("deleteAccountData: hesabın satırları ve karşı taraftaki sayaçlar silinir", () => {
    const { db, ids } = store();
    const [a, b] = ids as [number, number];
    db.recordGame(1, [{ accountId: a, gameId: "x", players: 2, miniScore: 1, rank: 1 }]);
    db.recordMatch(
      2,
      [
        { accountId: a, players: 2, games: 1, score: 1, place: 1 },
        { accountId: b, players: 2, games: 1, score: 0, place: 2 },
      ],
      [[a, b]],
    );
    db.deleteAccountData(a);
    expect(db.profile(a, true)?.totals).toMatchObject({ matches: 0, games: 0 });
    expect(db.profile(a, true)?.coPlayers).toEqual([]);
    expect(db.profile(b, true)?.coPlayers).toEqual([]);
    expect(db.profile(b, true)?.totals.matches).toBe(1);
    db.close();
  });

  it("findByUsername e-postayla eşleşmez", () => {
    const { db } = store();
    expect(db.findByUsername("ALI")?.username).toBe("Ali");
    expect(db.findByUsername("ali@t.local")).toBeNull();
    db.close();
  });
});

describe("profil ucu", () => {
  useServer();
  const base = () => `http://127.0.0.1:${k.srv.port}`;
  const get = async (path: string, cookie?: string) => {
    const res = await fetch(`${base()}${path}`, { headers: cookie ? { Cookie: cookie } : {} });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("oturum yoksa 401", async () => {
    const r = await get("/api/profile");
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ ok: false, code: "login_required" });
    expect((await get("/api/profile/Ali_1")).status).toBe(401);
  });

  it("yalnız GET kabul edilir", async () => {
    const res = await fetch(`${base()}/api/profile`, { method: "POST", headers: { Cookie: loginCookie() } });
    expect(res.status).toBe(405);
  });

  it("boş hesap: sıfırlar, favori oyun yok", async () => {
    const cookie = loginCookie("Yeni_1");
    const r = await get("/api/profile", cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      ok: true,
      username: "Yeni_1",
      totals: { matches: 0, wins: 0, winRate: 0, games: 0, gameWins: 0 },
      favoriteGame: null,
      perGame: [],
      recent: [],
      coPlayers: [],
    });
    expect(typeof r.body.createdAt).toBe("number");
  });

  it("toplamlar oyun adıyla gelir; e-posta ve kimlik sızmaz", async () => {
    const cookie = loginCookie("Veri_1");
    const acc = k.srv.accounts.findByUsername("Veri_1");
    const id = acc?.id as number;
    k.srv.accounts.recordGame(5, [
      { accountId: id, gameId: "butona-bas", players: 2, miniScore: 3, rank: 1 },
    ]);
    k.srv.accounts.recordGame(4, [
      { accountId: id, gameId: "butona-bas", players: 2, miniScore: 1, rank: 2 },
    ]);
    k.srv.accounts.recordGame(6, [
      { accountId: id, gameId: "silinmis-oyun", players: 2, miniScore: 1, rank: 2 },
    ]);
    const r = await get("/api/profile", cookie);
    expect(r.body.favoriteGame).toMatchObject({ id: "butona-bas", name: "Butona Bas", plays: 2 });
    const per = r.body.perGame as { gameId: string; name: string }[];
    expect(per.find((g) => g.gameId === "butona-bas")?.name).toBe("Butona Bas");
    expect(per.find((g) => g.gameId === "silinmis-oyun")?.name).toBe("Eski oyun");
    const text = JSON.stringify(r.body);
    expect(text).not.toContain("@test.local");
    expect(text).not.toContain(`"id":${id},`);
  });

  it("kendi adıyla bakınca yalnız herkese açık bölümler; başkası ve bilinmeyen 404", async () => {
    const mine = loginCookie("Ben_1");
    loginCookie("O_Biri");
    const own = await get("/api/profile/ben_1", mine);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ username: "Ben_1" });
    expect(own.body).not.toHaveProperty("recent");
    expect(own.body).not.toHaveProperty("coPlayers");
    expect((await get("/api/profile/O_Biri", mine)).status).toBe(404);
    expect((await get("/api/profile/yok_hesap", mine)).status).toBe(404);
    expect((await get("/api/profile/a%20b", mine)).status).toBe(404);
    expect((await get("/api/profile/%E0%A4%A", mine)).status).toBe(404);
    // E-posta ile aranamaz.
    expect((await get("/api/profile/ben_1@test.local", mine)).status).toBe(404);
  });
});

describe("maç akışı kaydı", () => {
  useServer();

  async function enter(cookie: string | undefined, nickname: string, code?: string): Promise<Client> {
    const c = await Client.connect(cookie);
    if (code) c.send({ type: "joinRoom", code, nickname });
    else c.send({ type: "createRoom", nickname });
    await until(() => c.updates.length > 0 || c.of("error").length > 0, "oda");
    return c;
  }

  it("iki hesaplı + bir misafir + bir izleyici: yalnız hesaplılar yazılır", async () => {
    const host = await enter(loginCookie("Host_1"), "Host");
    host.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => host.room.gameIds.length === 1, "oyun");
    const code = host.session.roomCode;
    const ikinci = await enter(loginCookie("Ikinci_2"), "Ikinci", code);
    const misafir = await enter(undefined, "Misafir", code);
    await sync();

    host.send({ type: "startMatch" });
    await until(() => host.room.phase === "briefing", "briefing");
    for (const c of [host, ikinci, misafir]) c.send({ type: "ready" });
    await until(() => host.room.phase === "countdown", "countdown");
    k.clock.advance(3000);
    await until(() => host.room.phase === "playing", "playing");
    const startedAt = (host.room.match?.publicView as { startedAt: number } | undefined)?.startedAt ?? 0;

    // Maç sürerken katılan hesaplı kişi izleyici olur; hiçbir şey yazılmaz.
    const izleyici = await enter(loginCookie("Izleyici_3"), "Izleyici", code);
    expect(izleyici.room.players.find((p) => p.nickname === "Izleyici_3")?.spectator).toBe(true);

    // İlk pencerede iki hesaplı basar (+1 +1), misafir basmaz (0): mini sıra 1, 1, 3.
    k.clock.advance(startedAt + 20 - k.clock.now());
    await press(host);
    k.clock.advance(100);
    await press(ikinci);
    // Henüz oyun bitmedi: hiçbir şey yazılmadı.
    const hostId = k.srv.accounts.findByUsername("Host_1")?.id as number;
    const ikinciId = k.srv.accounts.findByUsername("Ikinci_2")?.id as number;
    const izleyiciId = k.srv.accounts.findByUsername("Izleyici_3")?.id as number;
    expect(k.srv.accounts.profile(hostId, true)?.totals.games).toBe(0);

    k.clock.advance(startedAt + 51_000 - k.clock.now());
    await until(() => host.room.phase === "results", "results");
    const mid = k.srv.accounts.profile(hostId, true);
    expect(mid?.totals).toMatchObject({ games: 1, gameWins: 1, matches: 0 });
    expect(mid?.perGame).toEqual([{ gameId: "butona-bas", plays: 1, wins: 1, bestMini: 1, avgMini: 1 }]);
    expect(mid?.recent).toEqual([]);

    k.clock.advance(7_100);
    await until(() => host.room.phase === "final", "final");

    const h = k.srv.accounts.profile(hostId, true);
    const i = k.srv.accounts.profile(ikinciId, true);
    expect(h?.totals).toMatchObject({ matches: 1, wins: 1, winRate: 1, games: 1, gameWins: 1 });
    expect(i?.totals).toMatchObject({ matches: 1, wins: 1, games: 1, gameWins: 1 });
    // Üç oyuncu, bir oyun; beraberlikte ikisi de 1. yer.
    expect(h?.recent).toEqual([{ endedAt: expect.any(Number), players: 3, place: 1, score: 1 }]);
    expect(i?.recent[0]).toMatchObject({ players: 3, place: 1, score: 1 });
    // Birlikte oynama iki yönlü; misafir ve izleyici yok.
    expect(h?.coPlayers).toEqual([{ username: "Ikinci_2", matches: 1 }]);
    expect(i?.coPlayers).toEqual([{ username: "Host_1", matches: 1 }]);
    expect(k.srv.accounts.profile(izleyiciId, true)?.totals).toMatchObject({ matches: 0, games: 0 });

    // Ikinci maç aynı ekiple: sayaçlar artar.
    host.send({ type: "returnToLobby" });
    await until(() => host.room.phase === "lobby", "lobi");
    expect(k.srv.accounts.profile(hostId, true)?.totals.matches).toBe(1);
  });
});
