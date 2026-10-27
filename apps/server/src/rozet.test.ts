import { GAMES } from "@glix/engine";
import { describe, expect, it } from "vitest";
import { createAccountRecorder } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { BADGES, badgeViews, randomPoolIds } from "./badges.js";
import { Client, k, loginCookie, press, sync, until, useServer } from "./testkit.js";

/** 2026-10-26 12:00 İstanbul (gece değil). */
const NOON = Date.UTC(2026, 9, 26, 9, 0, 0);

function setup() {
  const db: AccountStore = createAccounts(":memory:");
  const mk = (n: string): number => {
    const r = db.create(n, `${n.toLowerCase()}@t.local`, "x", 1);
    if (!r.ok) throw new Error("hesap");
    return r.account.id;
  };
  const earned: [number, string[]][] = [];
  const rec = createAccountRecorder(db, (id, ids) => earned.push([id, ids]));
  let at = NOON;
  /** Bir maç bitirir (maç zamanı her çağrıda 1 dk ilerler); yeni rozetler `earned`e düşer. */
  const finish = (
    id: number,
    opt: { place?: number; players?: number; at?: number; others?: number[] } = {},
  ): void => {
    at += 60_000;
    const place = opt.place ?? 2;
    rec.matchFinished({
      endedAt: opt.at ?? at,
      rows: [{ accountId: id, players: opt.players ?? 3, games: 3, score: 5, place }],
      pairs: (opt.others ?? []).map((o) => [id, o] as const),
    });
  };
  const ids = (id: number): string[] => db.earnedBadges(id).map((b) => b.badgeId);
  return { db, mk, earned, finish, ids };
}

describe("rozet tanımları", () => {
  it("kimlikler benzersiz; adlar ve açıklamalar dolu; gizli olanlar işaretli", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    for (const b of BADGES) {
      expect(b.name.length).toBeGreaterThan(2);
      expect(b.description.length).toBeGreaterThan(5);
    }
    expect(BADGES.filter((b) => b.secret).map((b) => b.id)).toEqual(["gece-kusu", "hepsi-bir-arada"]);
  });

  it("rastgele havuz randomPool:false oyunları içermez", () => {
    const pool = randomPoolIds();
    for (const id of pool) expect(GAMES[id]?.randomPool).not.toBe(false);
    expect(pool.length).toBeGreaterThan(10);
  });
});

describe("rozet değerlendirme", () => {
  it("ilk maç ve ilk galibiyet; ikinci kez verilmez", () => {
    const { db, mk, finish, ids, earned } = setup();
    const a = mk("Ali");
    finish(a, { place: 2 });
    expect(ids(a)).toEqual(["ilk-mac"]);
    finish(a, { place: 1 });
    expect(ids(a).sort()).toEqual(["ilk-galibiyet", "ilk-mac"]);
    // Yeni rozet bildirimleri yalnız ilk kazanışta gelir.
    expect(earned).toEqual([
      [a, ["ilk-mac"]],
      [a, ["ilk-galibiyet"]],
    ]);
    finish(a, { place: 1 });
    finish(a, { place: 2 });
    expect(earned).toHaveLength(2);
    expect(db.earnedBadges(a)).toHaveLength(2);
    db.close();
  });

  it("10 / 50 / 100 maç eşikleri", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    for (let i = 0; i < 9; i++) finish(a);
    expect(ids(a)).not.toContain("on-mac");
    finish(a);
    expect(ids(a)).toContain("on-mac");
    for (let i = 0; i < 39; i++) finish(a);
    expect(ids(a)).not.toContain("elli-mac");
    finish(a);
    expect(ids(a)).toContain("elli-mac");
    for (let i = 0; i < 49; i++) finish(a);
    expect(ids(a)).not.toContain("yuz-mac");
    finish(a);
    expect(ids(a)).toContain("yuz-mac");
    db.close();
  });

  it("10 ve 25 galibiyet", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    for (let i = 0; i < 9; i++) finish(a, { place: 1 });
    expect(ids(a)).not.toContain("on-galibiyet");
    finish(a, { place: 1 });
    expect(ids(a)).toContain("on-galibiyet");
    for (let i = 0; i < 14; i++) finish(a, { place: 1 });
    expect(ids(a)).not.toContain("yirmibes-galibiyet");
    finish(a, { place: 1 });
    expect(ids(a)).toContain("yirmibes-galibiyet");
    db.close();
  });

  it("10 farklı oyunda birincilik: aynı oyunu tekrar kazanmak sayılmaz", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    const win = (gameId: string, rank = 1): void =>
      db.recordGame(NOON, [{ accountId: a, gameId, players: 3, miniScore: 1, rank }]);
    for (let i = 0; i < 12; i++) win("ayni-oyun");
    for (let i = 0; i < 8; i++) win(`oyun-${i}`);
    win("oyun-9", 2);
    finish(a);
    expect(ids(a)).not.toContain("cok-yonlu");
    win("oyun-8");
    finish(a);
    expect(ids(a)).toContain("cok-yonlu");
    db.close();
  });

  it("8 kişilik maçı kazan: 7 kişide ya da kaybedince verilmez", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    finish(a, { place: 1, players: 7 });
    finish(a, { place: 2, players: 8 });
    expect(ids(a)).not.toContain("kalabalik-sampiyonu");
    finish(a, { place: 1, players: 8 });
    expect(ids(a)).toContain("kalabalik-sampiyonu");
    db.close();
  });

  it("Can Dost: kabul edilmiş arkadaşla 10 maç; arkadaş olmayanla verilmez", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    const f = mk("Veli");
    const y = mk("Yabanci");
    db.requestFriend(a, f, 1);
    db.acceptFriend(f, a, 2);
    for (let i = 0; i < 10; i++) finish(a, { others: [y] });
    expect(ids(a)).not.toContain("can-dost");
    for (let i = 0; i < 9; i++) finish(a, { others: [f] });
    expect(ids(a)).not.toContain("can-dost");
    finish(a, { others: [f] });
    expect(ids(a)).toContain("can-dost");
    db.close();
  });

  it("Can Dost: yalnız bekleyen istek sayılmaz", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    const f = mk("Veli");
    db.requestFriend(a, f, 1);
    for (let i = 0; i < 10; i++) finish(a, { others: [f] });
    expect(ids(a)).not.toContain("can-dost");
    db.close();
  });

  it("Seri Galip: üst üste 3 galibiyet; araya giren kayıp seriyi böler", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    finish(a, { place: 1 });
    finish(a, { place: 1 });
    finish(a, { place: 2 });
    finish(a, { place: 1 });
    finish(a, { place: 1 });
    expect(ids(a)).not.toContain("seri");
    finish(a, { place: 1 });
    expect(ids(a)).toContain("seri");
    db.close();
  });

  it("Gece Kuşu: İstanbul 02:00-05:00 arası bitişte (gizli)", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    finish(a, { at: Date.UTC(2026, 9, 26, 22, 59) }); // 01:59
    finish(a, { at: Date.UTC(2026, 9, 27, 2, 0) }); // 05:00
    expect(ids(a)).not.toContain("gece-kusu");
    finish(a, { at: Date.UTC(2026, 9, 26, 23, 0) }); // 02:00
    expect(ids(a)).toContain("gece-kusu");
    const b = mk("Bora");
    finish(b, { at: Date.UTC(2026, 9, 27, 1, 59) }); // 04:59
    expect(ids(b)).toContain("gece-kusu");
    db.close();
  });

  it("Hepsi Bir Arada: havuzdaki her oyun; biri eksikse verilmez", () => {
    const { db, mk, finish, ids } = setup();
    const a = mk("Ali");
    const pool = randomPoolIds();
    const play = (gameId: string): void =>
      db.recordGame(NOON, [{ accountId: a, gameId, players: 3, miniScore: 1, rank: 2 }]);
    for (const id of pool.slice(1)) play(id);
    play("havuz-disi-oyun");
    finish(a);
    expect(ids(a)).not.toContain("hepsi-bir-arada");
    play(pool[0] as string);
    finish(a);
    expect(ids(a)).toContain("hepsi-bir-arada");
    db.close();
  });

  it("silinmiş hesap için değerlendirme hata fırlatmaz, rozet yazılmaz", () => {
    const { db, mk, finish, earned } = setup();
    const a = mk("Ali");
    finish(9999);
    expect(earned).toEqual([]);
    finish(a);
    expect(earned).toHaveLength(1);
    db.close();
  });

  it("yazıcı hatayı yutar: rozet adımı bozulsa da maç satırı kalır", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    const bad: AccountStore = {
      ...db,
      earnedBadges: () => {
        throw new Error("bozuk");
      },
    };
    const rec = createAccountRecorder(bad, () => {});
    expect(() =>
      rec.matchFinished({
        endedAt: NOON,
        rows: [{ accountId: a, players: 2, games: 1, score: 1, place: 1 }],
        pairs: [],
      }),
    ).not.toThrow();
    expect(db.profile(a, false)?.totals.matches).toBe(1);
    db.close();
  });
});

describe("rozet verisi", () => {
  it("awardBadges yalnız yenileri döner; tekrar çağrı boş", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    expect(db.awardBadges(a, ["ilk-mac", "on-mac"], 5)).toEqual(["ilk-mac", "on-mac"]);
    expect(db.awardBadges(a, ["on-mac", "seri"], 9)).toEqual(["seri"]);
    expect(db.earnedBadges(a)).toEqual([
      { badgeId: "ilk-mac", earnedAt: 5 },
      { badgeId: "on-mac", earnedAt: 5 },
      { badgeId: "seri", earnedAt: 9 },
    ]);
    db.close();
  });

  it("deleteAccountData rozetleri de siler; başkasınınki kalır", () => {
    const { db, mk } = setup();
    const a = mk("Ali");
    const b = mk("Bora");
    db.awardBadges(a, ["ilk-mac"], 1);
    db.awardBadges(b, ["ilk-mac"], 1);
    db.deleteAccountData(a);
    expect(db.earnedBadges(a)).toEqual([]);
    expect(db.earnedBadges(b)).toHaveLength(1);
    db.close();
  });

  it("görünüm: gizli kazanılmamış rozetin adı, açıklaması ve kimliği sızmaz", () => {
    const own = badgeViews([{ badgeId: "ilk-mac", earnedAt: 7 }], false);
    expect(own).toHaveLength(BADGES.length);
    expect(own.find((b) => b.id === "ilk-mac")).toMatchObject({ earned: true, earnedAt: 7 });
    expect(own.find((b) => b.id === "on-mac")).toMatchObject({ earned: false, secret: false });
    const hidden = own.filter((b) => b.secret);
    expect(hidden).toHaveLength(2);
    for (const h of hidden)
      expect(h).toMatchObject({ name: "???", description: "Gizli rozet", earned: false });
    const text = JSON.stringify(hidden);
    expect(text).not.toContain("gece");
    expect(text).not.toContain("Gece");
    expect(text).not.toContain("Hepsi");
    // Kazanılan gizli rozet açılır.
    const won = badgeViews([{ badgeId: "gece-kusu", earnedAt: 1 }], false);
    expect(won.find((b) => b.id === "gece-kusu")).toMatchObject({ name: "Gece Kuşu", earned: true });
    // Arkadaş görünümü: yalnız kazanılanlar.
    expect(badgeViews([{ badgeId: "ilk-mac", earnedAt: 7 }], true).map((b) => b.id)).toEqual(["ilk-mac"]);
    expect(badgeViews([], true)).toEqual([]);
  });
});

describe("profil ucunda rozetler", () => {
  useServer();
  const get = async (path: string, cookie: string) => {
    const res = await fetch(`http://127.0.0.1:${k.srv.port}${path}`, { headers: { Cookie: cookie } });
    return (await res.json()) as { badges: { id: string; earned: boolean; name: string }[] };
  };

  it("kendi profilinde hepsi, arkadaşın profilinde yalnız kazanılanlar", async () => {
    const me = loginCookie("Rz_Ben");
    const fr = loginCookie("Rz_Dost");
    const m = k.srv.accounts.findByUsername("Rz_Ben")?.id as number;
    const f = k.srv.accounts.findByUsername("Rz_Dost")?.id as number;
    k.srv.accounts.requestFriend(m, f, 1);
    k.srv.accounts.acceptFriend(f, m, 2);
    k.srv.accounts.awardBadges(f, ["ilk-mac", "gece-kusu"], 3);
    const own = await get("/api/profile", fr);
    expect(own.badges).toHaveLength(BADGES.length);
    expect(own.badges.filter((b) => b.earned).map((b) => b.id)).toEqual(["ilk-mac", "gece-kusu"]);
    const seen = await get("/api/profile/Rz_Dost", me);
    expect(seen.badges.map((b) => b.id)).toEqual(["ilk-mac", "gece-kusu"]);
    expect(seen.badges.every((b) => b.earned)).toBe(true);
    // Hiç rozeti olmayan arkadaşın profilinde gizli rozet ipucu yok.
    const none = await get("/api/profile/Rz_Ben", me);
    expect(none.badges).toEqual([]);
  });
});

describe("rozet bildirimi (canlı bağlantı)", () => {
  useServer();

  async function enter(cookie: string | undefined, nickname: string, code?: string): Promise<Client> {
    const c = await Client.connect(cookie);
    if (code) c.send({ type: "joinRoom", code, nickname });
    else c.send({ type: "createRoom", nickname });
    await until(() => c.updates.length > 0 || c.of("error").length > 0, "oda");
    return c;
  }

  it("maç final'e varınca hesaplı oyuncuya badgesEarned gider; misafire gitmez; ikinci kez gelmez", async () => {
    const host = await enter(loginCookie("Bd_Host"), "Host");
    host.send({ type: "setGames", gameIds: ["butona-bas"] });
    await until(() => host.room.gameIds.length === 1, "oyun");
    const code = host.session.roomCode;
    const ikinci = await enter(loginCookie("Bd_Ikinci"), "Ikinci", code);
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
    expect(host.of("badgesEarned")).toEqual([]);
    k.clock.advance(7_100);
    await until(() => host.room.phase === "final", "final");
    await until(() => host.of("badgesEarned").length > 0 && ikinci.of("badgesEarned").length > 0, "rozet");

    // Sahte saat 1970'te 00:16 UTC = 03:16 İstanbul olduğundan Gece Kuşu da açılır.
    const expected = ["gece-kusu", "ilk-galibiyet", "ilk-mac"];
    expect(host.of("badgesEarned")).toHaveLength(1);
    expect([...(host.of("badgesEarned")[0]?.ids ?? [])].sort()).toEqual(expected);
    expect([...(ikinci.of("badgesEarned")[0]?.ids ?? [])].sort()).toEqual(expected);
    expect(misafir.of("badgesEarned")).toEqual([]);
    const hostId = k.srv.accounts.findByUsername("Bd_Host")?.id as number;
    expect(
      k.srv.accounts
        .earnedBadges(hostId)
        .map((b) => b.badgeId)
        .sort(),
    ).toEqual(expected);
  });
});
