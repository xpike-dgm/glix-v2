import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword, hashToken } from "./auth.js";
import { GoogleFlows } from "./google.js";
import { confirmMatches, EXPORT_PER_DAY, exportDay, FRESH_LOGIN_MS, parseDelete } from "./kvkk.js";
import { loadSqlite } from "./statsStore.js";
import { Client, k, sync, until, useServer } from "./testkit.js";
import type { PushGateway } from "./webpush.js";

const base = () => `http://127.0.0.1:${k.srv.port}`;
const PASSWORD = "gizli-sifre-1";
const DB = pathJoin(mkdtempSync(pathJoin(tmpdir(), "glix-kvkk-")), "hesap.db");

interface Reply {
  status: number;
  headers: Headers;
  text: string;
  body: Record<string, unknown>;
}

async function api(
  cookie: string | null,
  path: "export" | "delete",
  body: unknown = {},
  headers: Record<string, string> = {},
  method = "POST",
): Promise<Reply> {
  const res = await fetch(`${base()}/api/account/${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: base(),
      "Content-Type": "application/json",
      ...headers,
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // gövde JSON değil
  }
  return { status: res.status, headers: res.headers, text, body: parsed };
}

interface Made {
  id: number;
  name: string;
  cookie: string;
  token: string;
}

/** Hesap açar; `google` verilirse şifresiz Google hesabı. Oturum `sessionAt` anında açılmış sayılır. */
async function make(name: string, opts: { google?: boolean; sessionAt?: number } = {}): Promise<Made> {
  const email = `${name.toLowerCase()}@test.local`;
  const made = opts.google
    ? k.srv.accounts.createGoogle(name, email, `sub-${name}`, k.clock.now())
    : k.srv.accounts.create(name, email, await hashPassword(PASSWORD), k.clock.now());
  if (!made.ok) throw new Error("hesap açılamadı");
  const token = randomBytes(32).toString("base64url");
  k.srv.accounts.createSession(made.account.id, hashToken(token), opts.sessionAt ?? k.clock.now());
  return { id: made.account.id, name, cookie: `glix_sess=${token}`, token };
}

function raw() {
  const { DatabaseSync } = loadSqlite();
  return new DatabaseSync(DB);
}

const count = (db: ReturnType<typeof raw>, table: string, where = "1=1", ...args: number[]): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).get(...args) as { n: number }).n;

const OWNED = [
  ["accounts", "id = ?"],
  ["sessions", "account_id = ?"],
  ["email_tokens", "account_id = ?"],
  ["account_games", "account_id = ?"],
  ["account_matches", "account_id = ?"],
  ["account_coplay", "account_id = ? OR other_account_id = ?"],
  ["badges", "account_id = ?"],
  ["friends", "a = ? OR b = ? OR requested_by = ?"],
  ["blocks", "blocker = ? OR blocked = ?"],
] as const;

const countFor = (db: ReturnType<typeof raw>, table: string, where: string, id: number): number =>
  count(db, table, where, ...Array(where.split("?").length - 1).fill(id));

/** Bir hesaba her tabloda satır yazar: istatistik, rozet, arkadaş, istek, engel, belirteç. */
async function seed(me: Made, others: { friend: Made; asker: Made; asked: Made; blocked: Made }) {
  const a = k.srv.accounts;
  a.requestFriend(me.id, others.friend.id, 1000);
  a.acceptFriend(others.friend.id, me.id, 2000);
  a.requestFriend(others.asker.id, me.id, 3000);
  a.requestFriend(me.id, others.asked.id, 4000);
  a.blockAccount(me.id, others.blocked.id, 5000);
  a.recordGame(6000, [
    { accountId: me.id, gameId: "butona-bas", players: 2, miniScore: 10, rank: 1 },
    { accountId: others.friend.id, gameId: "butona-bas", players: 2, miniScore: 5, rank: 2 },
  ]);
  a.recordMatch(
    7000,
    [
      { accountId: me.id, players: 2, games: 1, score: 10, place: 1 },
      { accountId: others.friend.id, players: 2, games: 1, score: 5, place: 2 },
    ],
    [[me.id, others.friend.id]],
  );
  a.awardBadges(me.id, ["ilk-adim"], 8000);
  a.createToken("verify", me.id, "verify-hash-gizli", k.clock.now() + 100000);
  a.createToken("reset", me.id, "reset-hash-gizli", k.clock.now() + 100000);
}

async function world(me: Made) {
  const others = {
    friend: await make("Dost_1"),
    asker: await make("Isteyen_2"),
    asked: await make("Istenen_3"),
    blocked: await make("Engelli_4"),
  };
  await seed(me, others);
  return others;
}

describe("saf yardımcılar", () => {
  it("silme gövdesi: yalnız confirm ve isteğe bağlı password", () => {
    expect(parseDelete({ confirm: "ali" })).toEqual({ confirm: "ali", password: null });
    expect(parseDelete({ confirm: "ali", password: "x" })).toEqual({ confirm: "ali", password: "x" });
    expect(parseDelete({})).toBeNull();
    expect(parseDelete({ confirm: 1 })).toBeNull();
    expect(parseDelete({ confirm: "a", password: 5 })).toBeNull();
    expect(parseDelete({ confirm: "a", extra: 1 })).toBeNull();
    expect(parseDelete([])).toBeNull();
    expect(parseDelete({ confirm: "a".repeat(65) })).toBeNull();
  });

  it("kullanıcı adı eşleşmesi büyük/küçük harf ve boşluk duyarsız", () => {
    expect(confirmMatches(" Ali_01 ", "ali_01")).toBe(true);
    expect(confirmMatches("ali_02", "ali_01")).toBe(false);
    expect(confirmMatches("", "ali_01")).toBe(false);
  });

  it("dosya adındaki tarih Türkiye saatiyle", () => {
    expect(exportDay(Date.UTC(2026, 9, 27, 21, 30))).toBe("2026-10-28");
    expect(exportDay(Date.UTC(2026, 9, 27, 10, 0))).toBe("2026-10-27");
  });

  it("bekleyen Google kayıtları kimliğe ya da e-postaya göre düşer", () => {
    const f = new GoogleFlows();
    const t1 = f.addPending(0, "sub-a", "a@x.com");
    const t2 = f.addPending(0, "sub-b", "b@x.com");
    const t3 = f.addPending(0, "sub-c", "c@x.com");
    f.dropPendingFor("sub-a", "baska@x.com");
    f.dropPendingFor(null, "b@x.com");
    expect(f.peekPending(t1, 1)).toBeNull();
    expect(f.peekPending(t2, 1)).toBeNull();
    expect(f.peekPending(t3, 1)).not.toBeNull();
  });
});

/** Her test boş bir veritabanıyla başlar (useServer'dan önce kayıtlı kanca önce çalışır). */
function freshDb(): void {
  beforeEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(`${DB}${suffix}`, { force: true });
  });
}

function gateway(): PushGateway {
  return { enabled: true, publicKey: "SAHTE", send: () => Promise.resolve("ok") };
}

describe("Verimi indir", () => {
  freshDb();
  useServer({ accountsDb: DB, statsDb: DB, push: gateway() });

  it("döküm indirilir: dosya adı, içerik; şifre özeti ve belirteç özeti yok", async () => {
    const me = await make("Ayse_01");
    await world(me);
    const ws = await Client.connect(me.cookie);
    ws.send({
      type: "pushSubscribe",
      endpoint: "https://fcm.googleapis.com/fcm/send/x",
      p256dh: "B".repeat(87),
      auth: "a".repeat(22),
    });
    await sync();
    const r = await api(me.cookie, "export");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/^application\/json/);
    expect(r.headers.get("content-disposition")).toBe(
      `attachment; filename="glix-verilerim-${exportDay(k.clock.now())}.json"`,
    );
    expect(r.headers.get("cache-control")).toBe("no-store");
    const d = r.body as {
      aciklama: string;
      account: Record<string, unknown>;
      sessions: Record<string, unknown>[];
      stats: { games: unknown[]; matches: unknown[]; coplay: { username: string; matches: number }[] };
      friends: Record<string, { username: string }[]>;
      badges: { id: string; name: string }[];
      push_subscription: boolean;
    };
    expect(d.aciklama).toMatch(/GLIX/);
    expect(d.account).toMatchObject({
      username: "Ayse_01",
      email: "ayse_01@test.local",
      email_verified: false,
      google_linked: false,
      google_sub: null,
      password: "Şifre özeti saklanır, güvenlik nedeniyle dosyaya konmaz.",
    });
    expect(typeof d.account.created_at).toBe("string");
    expect(d.account.username_changed_at).toBeNull();
    expect(Object.keys(d.sessions[0] ?? {}).sort()).toEqual(["created_at", "last_seen"]);
    expect(d.stats.games).toHaveLength(1);
    expect(d.stats.matches).toHaveLength(1);
    expect(d.stats.coplay).toEqual([expect.objectContaining({ username: "Dost_1", matches: 1 })]);
    expect(d.friends.friends?.map((f) => f.username)).toEqual(["Dost_1"]);
    expect(d.friends.incoming_requests?.map((f) => f.username)).toEqual(["Isteyen_2"]);
    expect(d.friends.outgoing_requests?.map((f) => f.username)).toEqual(["Istenen_3"]);
    expect(d.friends.blocked?.map((f) => f.username)).toEqual(["Engelli_4"]);
    expect(d.badges).toEqual([expect.objectContaining({ id: "ilk-adim" })]);
    expect(d.push_subscription).toBe(true);
    // Sızıntı denetimi: ne şifre özeti ne de oturum/belirteç özetleri dosyada.
    const hash = k.srv.accounts.passwordHash(me.id) ?? "";
    expect(hash).toMatch(/^scrypt\$/);
    for (const secret of [
      hash,
      "scrypt$",
      me.token,
      hashToken(me.token),
      "verify-hash-gizli",
      "reset-hash-gizli",
      "pass_hash",
    ])
      expect(r.text).not.toContain(secret);
  });

  it("Google hesabı: sub dosyada, şifre yok notu", async () => {
    const me = await make("Gizem_01", { google: true });
    const r = await api(me.cookie, "export");
    expect(r.body.account).toMatchObject({
      google_linked: true,
      google_sub: "sub-Gizem_01",
      email_verified: true,
      password: "Bu hesapta şifre yok (Google ile giriş).",
    });
    expect(r.body.push_subscription).toBe(false);
  });

  it("oturum yok 401; Origin yok 403; GET 405; günde 3 indirme", async () => {
    const me = await make("Ayse_01");
    expect((await api(null, "export")).status).toBe(401);
    const res = await fetch(`${base()}/api/account/export`, {
      method: "POST",
      headers: { Cookie: me.cookie },
    });
    expect(res.status).toBe(403);
    expect((await api(me.cookie, "export", undefined, {}, "GET")).status).toBe(405);
    for (let i = 0; i < EXPORT_PER_DAY; i++) expect((await api(me.cookie, "export")).status).toBe(200);
    const blocked = await api(me.cookie, "export");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("rate_limited");
    k.clock.advance(24 * 3600 * 1000);
    expect((await api(me.cookie, "export")).status).toBe(200);
  });
});

describe("Hesabımı sil", () => {
  freshDb();
  useServer({ accountsDb: DB, statsDb: DB, push: gateway() });

  it("yanlış kullanıcı adı ve yanlış şifre reddedilir; hiçbir şey silinmez", async () => {
    const me = await make("Ayse_01");
    await world(me);
    const wrongName = await api(me.cookie, "delete", { confirm: "baskasi", password: PASSWORD });
    expect(wrongName.status).toBe(400);
    expect(wrongName.body).toMatchObject({ code: "confirm_mismatch", field: "confirm" });
    const noPass = await api(me.cookie, "delete", { confirm: "Ayse_01" });
    expect(noPass.status).toBe(400);
    expect(noPass.body.field).toBe("password");
    const wrongPass = await api(me.cookie, "delete", { confirm: "Ayse_01", password: "yanlis-sifre-1" });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body).toMatchObject({ code: "bad_credentials", field: "password" });
    expect(k.srv.accounts.findById(me.id)).not.toBeNull();
    expect((await api(me.cookie, "export")).status).toBe(200);
  });

  it("oturum yok 401; Origin yok 403; geçersiz gövde 400; GET 405", async () => {
    const me = await make("Ayse_01");
    expect((await api(null, "delete", { confirm: "x" })).status).toBe(401);
    const res = await fetch(`${base()}/api/account/delete`, {
      method: "POST",
      headers: { Cookie: me.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "Ayse_01", password: PASSWORD }),
    });
    expect(res.status).toBe(403);
    expect((await api(me.cookie, "delete", { nope: 1 })).status).toBe(400);
    expect((await api(me.cookie, "delete", { confirm: "x" }, { "Content-Type": "text/plain" })).status).toBe(
      400,
    );
    expect((await api(me.cookie, "delete", undefined, {}, "GET")).status).toBe(405);
    expect(k.srv.accounts.findById(me.id)).not.toBeNull();
  });

  it("başarılı silme: tablo tablo temizlenir, çerez silinir, oturum gider, karşıdakiler korunur", async () => {
    const me = await make("Ayse_01");
    const o = await world(me);
    const second = await make("Ayse_01_b"); // aynı hesaba ikinci oturum
    k.srv.accounts.createSession(me.id, hashToken("ikinci-oturum"), k.clock.now());
    const db = raw();
    for (const [table, where] of OWNED)
      expect(countFor(db, table, where, me.id), `${table} önce`).toBeGreaterThan(0);
    const friendMatchesBefore = countFor(db, "account_matches", "account_id = ?", o.friend.id);

    const r = await api(me.cookie, "delete", { confirm: "ayse_01", password: PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
    expect(r.headers.get("set-cookie")).toMatch(/^glix_sess=; HttpOnly; SameSite=Lax; Path=\/; Max-Age=0/);

    for (const [table, where] of OWNED) expect(countFor(db, table, where, me.id), `${table} sonra`).toBe(0);
    expect(countFor(db, "sessions", "id_hash = ?", 0)).toBe(0);
    expect(k.srv.accounts.findById(me.id)).toBeNull();
    expect(k.srv.accounts.findByLogin("ayse_01")).toBeNull();
    expect(k.srv.accounts.resolveSession(hashToken(me.token), k.clock.now())).toBeNull();
    expect(k.srv.accounts.resolveSession(hashToken("ikinci-oturum"), k.clock.now())).toBeNull();
    // Diğer hesapların kendi verisi durur; yalnız kişiyle ilgili satırlar gitti.
    expect(countFor(db, "account_matches", "account_id = ?", o.friend.id)).toBe(friendMatchesBefore);
    expect(k.srv.accounts.findById(o.friend.id)).not.toBeNull();
    expect(k.srv.accounts.findById(second.id)).not.toBeNull();
    expect(k.srv.accounts.friendLists(o.friend.id).friends).toEqual([]);
    // Çerez artık geçersiz.
    expect((await api(me.cookie, "export")).status).toBe(401);
    // Kullanıcı adı yeniden alınabilir.
    expect(k.srv.accounts.create("Ayse_01", "yeni@test.local", "x", k.clock.now()).ok).toBe(true);
    db.close();
  });

  it("canlı: arkadaşlara friendsChanged gider, canlı soket misafir olur, odada adıyla kalır", async () => {
    const me = await make("Ayse_01");
    const o = await world(me);
    const mine = await Client.connect(me.cookie);
    mine.send({ type: "createRoom", nickname: "Ayse_01" });
    await until(() => mine.updates.length > 0, "oda");
    const ids = {
      friend: await Client.connect(o.friend.cookie),
      asker: await Client.connect(o.asker.cookie),
      asked: await Client.connect(o.asked.cookie),
      blocked: await Client.connect(o.blocked.cookie),
    };
    await sync();
    const before = Object.values(ids).map((c) => c.of("friendsChanged").length);
    // Hesaplıyken ad değiştirilemez.
    mine.send({ type: "rename", nickname: "Yeni_Ad" });
    await until(() => mine.of("error").some((e) => e.code === "account_name"), "account_name");

    const r = await api(me.cookie, "delete", { confirm: "Ayse_01", password: PASSWORD });
    expect(r.status).toBe(200);
    await until(
      () => Object.values(ids).every((c, i) => c.of("friendsChanged").length > (before[i] ?? 0)),
      "friendsChanged",
    );

    // Soket açık; oyuncu odada mevcut adıyla duruyor; artık misafir: ad değiştirebilir.
    expect(mine.closeCode).toBeNull();
    expect(mine.room.players.map((p) => p.nickname)).toEqual(["Ayse_01"]);
    mine.send({ type: "rename", nickname: "Yeni_Ad" });
    await until(() => mine.room.players.some((p) => p.nickname === "Yeni_Ad"), "misafir adı");
    // Davet için hesap gerekir.
    mine.send({ type: "inviteFriend", username: "Dost_1" });
    await until(() => mine.of("error").some((e) => e.code !== "account_name"), "davet reddi");
    expect(ids.friend.of("invite")).toHaveLength(0);
  });

  it("bildirim aboneliği hesaptan düşer", async () => {
    const me = await make("Ayse_01");
    const ws = await Client.connect(me.cookie);
    ws.send({
      type: "pushSubscribe",
      endpoint: "https://fcm.googleapis.com/fcm/send/y",
      p256dh: "B".repeat(87),
      auth: "a".repeat(22),
    });
    await sync();
    expect((await api(me.cookie, "export")).body.push_subscription).toBe(true);
    const other = await make("Berk_02");
    const own = await api(other.cookie, "export");
    expect(own.body.push_subscription).toBe(false);
    expect((await api(me.cookie, "delete", { confirm: "Ayse_01", password: PASSWORD })).status).toBe(200);
    const again = await make("Ayse_01");
    expect((await api(again.cookie, "export")).body.push_subscription).toBe(false);
  });

  it("anonim istatistik tabloları değişmez ve hesap kimliği taşımaz", async () => {
    const me = await make("Ayse_01");
    await world(me);
    const db = raw();
    const tables = ["matches", "game_plays", "feedback", "perf"];
    for (const t of tables) {
      const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
      expect(
        cols.some((c) => /account|user|email|nick/i.test(c)),
        `${t} sütunları`,
      ).toBe(false);
    }
    db.prepare(
      "INSERT INTO matches (started_at, player_count, selection_mode, game_count) VALUES (1, 3, 'rastgele', 5)",
    ).run();
    db.prepare(
      "INSERT INTO feedback (match_id, rating, text, created_at) VALUES (NULL, 5, 'güzel', 1)",
    ).run();
    const snapshot = () => tables.map((t) => JSON.stringify(db.prepare(`SELECT * FROM ${t}`).all()));
    const before = snapshot();
    expect((await api(me.cookie, "delete", { confirm: "Ayse_01", password: PASSWORD })).status).toBe(200);
    expect(snapshot()).toEqual(before);
    db.close();
  });

  it("yalnız Google hesabı: taze girişle silinir, eski oturumla reddedilir", async () => {
    const stale = await make("Gizem_01", { google: true, sessionAt: k.clock.now() });
    k.clock.advance(FRESH_LOGIN_MS + 1000);
    const denied = await api(stale.cookie, "delete", { confirm: "Gizem_01" });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({
      code: "fresh_login_required",
      message: "Güvenlik için çıkış yapıp tekrar giriş yap, sonra sil.",
    });
    expect(k.srv.accounts.findById(stale.id)).not.toBeNull();
    // Yeni oturum (tekrar giriş) 10 dk içinde silmeye yeter; şifre istenmez.
    const token = randomBytes(32).toString("base64url");
    k.srv.accounts.createSession(stale.id, hashToken(token), k.clock.now());
    k.clock.advance(FRESH_LOGIN_MS - 1000);
    const ok = await api(`glix_sess=${token}`, "delete", { confirm: "gizem_01" });
    expect(ok.status).toBe(200);
    expect(k.srv.accounts.findById(stale.id)).toBeNull();
    expect(k.srv.accounts.findByGoogleSub("sub-Gizem_01")).toBeNull();
  });

  it("Google hesabı yine de kullanıcı adını doğru yazmalı", async () => {
    const g = await make("Gizem_01", { google: true });
    const r = await api(g.cookie, "delete", { confirm: "yanlis" });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("confirm_mismatch");
  });

  it("hız sınırı: saatte 5 deneme; yanlış şifreler giriş sınırına da sayılır", async () => {
    const me = await make("Ayse_01");
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push(
        (await api(me.cookie, "delete", { confirm: "Ayse_01", password: `yanlis-sifre-${i}` })).status,
      );
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes[5]).toBe(429);
    k.clock.advance(3600 * 1000);
    expect((await api(me.cookie, "delete", { confirm: "Ayse_01", password: PASSWORD })).status).toBe(200);
  });
});
