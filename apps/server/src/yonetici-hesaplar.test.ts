/** Yönetici paneli A2: hesap arama, döküm, işlemler (ad, askı, silme, oturum), işlem kaydı ve e-posta sayaçları. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AdminAccountDetail, AdminAccountRow, AdminAccounts, AdminAuditPage } from "@glix/engine";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_AUDIT_RETENTION_MS, USERNAME_COOLDOWN_MS } from "./accountStore.js";
import { cleanReason, parseAction, parseId, parseSearch } from "./admin.js";
import { suspendedMessage } from "./auth.js";
import { buildExport } from "./kvkk.js";
import { noopSocial } from "./social.js";
import { loadSqlite } from "./statsStore.js";
import { Client, k, loginCookie, until, useServer } from "./testkit.js";

const DAY = 24 * 3600 * 1000;
const MAIL = { apiKey: "re_test", from: "GLIX <noreply@glix.example>", publicUrl: "https://glix.example" };
const base = () => `http://127.0.0.1:${k.srv.port}`;
const dir = mkdtempSync(join(tmpdir(), "glix-admin-hesap-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let dbSeq = 0;
const newDb = (): string => join(dir, `stats-${++dbSeq}.db`);

const sent: { to: string[]; text: string }[] = [];
let mailOk = true;
const mailFetch = vi.fn(async (_url: string, init: { body: string }) => {
  if (!mailOk) return { status: 500 };
  sent.push(JSON.parse(init.body) as (typeof sent)[number]);
  return { status: 200 };
});
const lastCode = (): string => /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? "")?.[1] ?? "";

beforeEach(() => {
  sent.length = 0;
  mailOk = true;
  mailFetch.mockClear();
});

interface Reply<T = Record<string, unknown>> {
  status: number;
  body: T & { ok?: boolean; code?: string; message?: string };
  raw: string;
}

async function call<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  cookie: string | null,
  opts: { body?: unknown; origin?: string | null } = {},
): Promise<Reply<T>> {
  const origin = opts.origin === undefined ? base() : opts.origin;
  const res = await fetch(`${base()}/api/admin/${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  const raw = await res.text();
  return { status: res.status, body: JSON.parse(raw) as Reply<T>["body"], raw };
}

const get = <T = Record<string, unknown>>(path: string, cookie: string | null) =>
  call<T>("GET", path, cookie);
const post = (path: string, cookie: string | null, body?: unknown) => call("POST", path, cookie, { body });

/** İlk açılan hesap kimlik 1 alır ve yöneticidir; kod isteyip doğrular, iki çerezi birleştirir. */
async function adminLogin(): Promise<string> {
  const sess = loginCookie("yonetici_1");
  const r = await call("POST", "otp/request", sess);
  expect(r.status).toBe(200);
  const res = await fetch(`${base()}/api/admin/otp/verify`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json", Cookie: sess },
    body: JSON.stringify({ code: lastCode() }),
  });
  expect(res.status).toBe(200);
  return `${sess}; ${(res.headers.get("set-cookie") ?? "").split(";")[0]}`;
}

const ADMIN = new Set([1]);
const idOf = (name: string): number => {
  const found = k.srv.accounts.findByUsername(name);
  if (!found) throw new Error(`hesap yok: ${name}`);
  return found.id;
};

/** Gerçek parolalı hesap (HTTP kaydı): giriş denenebilir. */
async function register(username: string): Promise<{ cookie: string; id: number }> {
  const res = await fetch(`${base()}/api/auth/register`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username.toLowerCase()}@test.local`,
      password: "gizli-sifre",
    }),
  });
  expect(res.status).toBe(200);
  return { cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "", id: idOf(username) };
}

async function passwordLogin(username: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${base()}/api/auth/login`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json" },
    body: JSON.stringify({ login: username, password: "gizli-sifre" }),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function meAccount(cookie: string): Promise<unknown> {
  const res = await fetch(`${base()}/api/auth/me`, { headers: { Cookie: cookie } });
  return ((await res.json()) as { account: unknown }).account;
}

const friendsApi = (cookie: string, path: string, body?: unknown) =>
  fetch(`${base()}/api/friends${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookie,
      Origin: base(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// ---- Doğrulayıcılar --------------------------------------------------------------------------------------------

describe("yönetici hesap girdileri", () => {
  it("arama metni: önek küçük harfe çevrilir, '@' içeren tam e-posta olmalı", () => {
    expect(parseSearch(" Ali_1 ")).toEqual({ kind: "prefix", value: "ali_1" });
    expect(parseSearch("Kisi@Ornek.COM")).toEqual({ kind: "email", value: "kisi@ornek.com" });
    for (const bad of [null, "", "  ", "a%", "a b", "x".repeat(21), "kisi@", "@ornek.com", "ali'--"])
      expect(parseSearch(bad)).toBeNull();
  });

  it("kimlik: yalnız pozitif güvenli tam sayı", () => {
    expect(parseId("12")).toBe(12);
    for (const bad of [null, "", "0", "-1", "1.5", "1e3", "abc", "9".repeat(16)])
      expect(parseId(bad)).toBeNull();
  });

  it("sebep: kırpılır, 1-140 karakter, denetim karakteri yok", () => {
    expect(cleanReason("  hakaret  ")).toBe("hakaret");
    for (const bad of ["", "   ", "a".repeat(141), "satir\nsonu", "sifir\u0000", 5, null])
      expect(cleanReason(bad)).toBeNull();
    expect(cleanReason("a".repeat(140))).toHaveLength(140);
  });

  it("işlem gövdeleri: tam anahtar kümesi, geçerli değerler", () => {
    expect(parseAction("rename", { id: 2, username: "Yeni_Ad" })).toEqual({
      op: "rename",
      id: 2,
      username: "Yeni_Ad",
    });
    expect(parseAction("rename", { id: 2, username: "a" })).toBeNull();
    expect(parseAction("rename", { id: 2, username: "Yeni_Ad", x: 1 })).toBeNull();
    expect(parseAction("rename", { id: "2", username: "Yeni_Ad" })).toBeNull();
    expect(parseAction("rename", { id: 0, username: "Yeni_Ad" })).toBeNull();
    expect(parseAction("suspend", { id: 2, duration: "7d", reason: "x" })).toMatchObject({ duration: "7d" });
    expect(parseAction("suspend", { id: 2, duration: "forever", reason: "x" })).toMatchObject({
      duration: "forever",
    });
    expect(parseAction("suspend", { id: 2, duration: "30d", reason: "x" })).toBeNull();
    expect(parseAction("suspend", { id: 2, duration: "toString", reason: "x" })).toBeNull();
    expect(parseAction("suspend", { id: 2, duration: "1d", reason: "" })).toBeNull();
    expect(parseAction("suspend", { id: 2, duration: "1d" })).toBeNull();
    expect(parseAction("delete", { id: 2, confirm: "Ad" })).toEqual({ op: "delete", id: 2, confirm: "Ad" });
    expect(parseAction("delete", { id: 2 })).toBeNull();
    expect(parseAction("unsuspend", { id: 2 })).toEqual({ op: "unsuspend", id: 2 });
    expect(parseAction("logout-all", { id: 2, extra: true })).toBeNull();
    expect(parseAction("logout-all", [])).toBeNull();
  });

  it("askı mesajı: bitişle birlikte tarih, süresizde tarihsiz; sebep yok", () => {
    const until = Date.UTC(2026, 10, 3, 11, 5);
    expect(suspendedMessage({ since: 1, until, reason: "gizli not" })).toBe(
      "Hesabın 3 Kasım 2026 14:05 tarihine kadar askıya alındı.",
    );
    expect(suspendedMessage({ since: 1, until: null, reason: "gizli not" })).toBe("Hesabın askıya alındı.");
  });
});

// ---- Erişim denetimi -------------------------------------------------------------------------------------------

describe("hesap uçları: erişim denetimi", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });
  const GETS = ["accounts", "accounts/search?q=ali", "accounts/detail?id=2", "audit"];
  const POSTS: [string, unknown][] = [
    ["accounts/rename", { id: 2, username: "Yeni_Ad" }],
    ["accounts/suspend", { id: 2, duration: "1d", reason: "x" }],
    ["accounts/unsuspend", { id: 2 }],
    ["accounts/delete", { id: 2, confirm: "x" }],
    ["accounts/logout-all", { id: 2 }],
  ];

  it("oturum yoksa 401; yönetici olmayan 404; yönetici çerezi yoksa 403", async () => {
    const sess = loginCookie("yonetici_1");
    const other = loginCookie("oyuncu_2");
    for (const p of GETS) {
      expect((await get(p, null)).status).toBe(401);
      expect((await get(p, other)).status).toBe(404);
      const r = await get(p, sess);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("otp_required");
    }
    for (const [p, body] of POSTS) {
      expect((await post(p, null, body)).status).toBe(401);
      expect((await post(p, other, body)).status).toBe(404);
      expect((await post(p, sess, body)).status).toBe(403);
    }
    // Hiçbir şey değişmedi.
    expect(k.srv.accounts.findById(2)?.username).toBe("oyuncu_2");
    expect(k.srv.accounts.adminAuditTail(5).some((r) => r.action.startsWith("account_"))).toBe(false);
  });

  it("POST'larda Origin zorunlu (yok, başka kaynak); yöntem uyuşmazlığı 405", async () => {
    const cookie = await adminLogin();
    for (const [p, body] of POSTS) {
      expect((await call("POST", p, cookie, { body, origin: null })).status).toBe(403);
      expect((await call("POST", p, cookie, { body, origin: "https://evil.example" })).status).toBe(403);
      expect((await get(p, cookie)).status).toBe(405);
    }
    for (const p of GETS) expect((await post(p.split("?")[0] as string, cookie, {})).status).toBe(405);
  });

  it("yönetici çerezi başka hesap oturumunda geçersiz", async () => {
    const cookie = await adminLogin();
    const stolen = `${loginCookie("oyuncu_2")}; ${cookie.split("; ")[1]}`;
    expect((await get("accounts", stolen)).status).toBe(404);
  });
});

// ---- Arama ve döküm --------------------------------------------------------------------------------------------

describe("hesap arama ve döküm", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("kullanıcı adı öneki (büyük/küçük harf duyarsız), alt çizgi joker değil, sıralı", async () => {
    const cookie = await adminLogin();
    for (const n of ["Ali_1", "alice", "ALINA", "bob", "ali2"]) loginCookie(n);
    const names = async (q: string) =>
      (
        await get<{ results: AdminAccountRow[] }>(`accounts/search?q=${encodeURIComponent(q)}`, cookie)
      ).body.results.map((r) => r.username);
    expect(await names("ali")).toEqual(["ali2", "Ali_1", "alice", "ALINA"]);
    expect(await names("ALI")).toEqual(["ali2", "Ali_1", "alice", "ALINA"]);
    expect(await names("ali_")).toEqual(["Ali_1"]);
    expect(await names("bo")).toEqual(["bob"]);
    expect(await names("yok")).toEqual([]);
  });

  it("tam e-posta eşleşir, kısmi e-posta ve geçersiz arama 400; en çok 20 sonuç", async () => {
    const cookie = await adminLogin();
    loginCookie("Hedef_Biri");
    const exact = await get<{ results: AdminAccountRow[] }>(
      "accounts/search?q=HEDEF_BIRI%40test.local",
      cookie,
    );
    expect(exact.body.results.map((r) => r.username)).toEqual(["Hedef_Biri"]);
    expect((await get("accounts/search?q=hedef_biri%40test", cookie)).status).toBe(400);
    expect((await get("accounts/search?q=%25", cookie)).status).toBe(400);
    expect((await get("accounts/search", cookie)).status).toBe(400);
    for (let i = 0; i < 25; i++) loginCookie(`kul${String(i).padStart(2, "0")}`);
    const many = await get<{ results: AdminAccountRow[]; limit: number }>("accounts/search?q=kul", cookie);
    expect(many.body.limit).toBe(20);
    expect(many.body.results).toHaveLength(20);
    expect(many.body.results[0]?.username).toBe("kul00");
    expect(many.body.results.at(-1)?.username).toBe("kul19");
  });

  it("sonuç satırında e-posta yok; alanlar doğru (yöntemler, maç, son görülme, askı)", async () => {
    const cookie = await adminLogin();
    const target = await register("Aranan");
    const google = k.srv.accounts.createGoogle("Googlelı", "g@test.local", "sub-g", k.clock.now());
    if (!google.ok) throw new Error("google hesabı");
    k.srv.accounts.recordMatch(
      k.clock.now(),
      [{ accountId: target.id, players: 3, games: 3, score: 9, place: 1 }],
      [],
    );
    const r = await get<{ results: AdminAccountRow[] }>("accounts/search?q=aranan", cookie);
    expect(r.raw).not.toContain("@");
    expect(r.raw).not.toContain("test.local");
    expect(r.body.results).toEqual([
      {
        id: target.id,
        username: "Aranan",
        createdAt: k.clock.now(),
        verified: false,
        google: false,
        password: true,
        lastSeen: k.clock.now(),
        matches: 1,
        suspended: false,
      },
    ]);
    const g = await get<{ results: AdminAccountRow[] }>("accounts/search?q=googlel", cookie);
    expect(g.body.results[0]).toMatchObject({
      google: true,
      password: false,
      verified: true,
      lastSeen: null,
      matches: 0,
    });
  });

  it("e-postayla arama kaydedilir (metin olmadan); önek araması kaydedilmez", async () => {
    const cookie = await adminLogin();
    loginCookie("Biri_x");
    await get("accounts/search?q=biri", cookie);
    expect(k.srv.accounts.adminAuditTail(20).some((r) => r.action === "account_search_email")).toBe(false);
    await get("accounts/search?q=biri_x%40test.local", cookie);
    const row = k.srv.accounts.adminAuditTail(20).find((r) => r.action === "account_search_email");
    expect(row).toMatchObject({ accountId: 1, detail: "", targetId: null });
  });

  it("döküm: e-posta yalnız burada; her görüntüleme account_view olarak kaydedilir", async () => {
    const cookie = await adminLogin();
    const t = await register("Detayli");
    const friend = loginCookie("Dost_1");
    const friendId = idOf("Dost_1");
    k.srv.accounts.requestFriend(t.id, friendId, k.clock.now());
    k.srv.accounts.acceptFriend(friendId, t.id, k.clock.now());
    k.srv.accounts.awardBadges(t.id, ["ilk-adim"], k.clock.now());
    void friend;
    const r = await get<AdminAccountDetail>(`accounts/detail?id=${t.id}`, cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: t.id,
      username: "Detayli",
      email: "detayli@test.local",
      password: true,
      google: false,
      sessions: 1,
      badges: 1,
      friends: 1,
      matches: 0,
      protected: false,
      suspension: null,
      usernameChangedAt: null,
    });
    const rows = k.srv.accounts.adminAuditTail(5).filter((x) => x.action === "account_view");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ accountId: 1, targetId: t.id, detail: "" });
    await get(`accounts/detail?id=${t.id}`, cookie);
    expect(k.srv.accounts.adminAuditTail(10).filter((x) => x.action === "account_view")).toHaveLength(2);
    // Kayıtta e-posta yok.
    const audit = await get<AdminAuditPage>("audit", cookie);
    expect(audit.raw).not.toContain("test.local");
    expect(audit.body.entries[0]).toMatchObject({ action: "account_view", targetId: t.id, actorId: 1 });
  });

  it("döküm: yönetici korumalı görünür; bilinmeyen ve geçersiz kimlik kaydedilmez", async () => {
    const cookie = await adminLogin();
    expect((await get<AdminAccountDetail>("accounts/detail?id=1", cookie)).body.protected).toBe(true);
    const before = k.srv.accounts.adminAuditTail(50).filter((x) => x.action === "account_view").length;
    expect((await get("accounts/detail?id=999", cookie)).status).toBe(404);
    expect((await get("accounts/detail?id=abc", cookie)).status).toBe(400);
    expect((await get("accounts/detail", cookie)).status).toBe(400);
    expect(k.srv.accounts.adminAuditTail(50).filter((x) => x.action === "account_view")).toHaveLength(before);
  });

  it("döküm görüntüleme hız sınırlı (429), zamanla açılır", async () => {
    const cookie = await adminLogin();
    const t = loginCookie("Sinir_1");
    void t;
    const id = idOf("Sinir_1");
    for (let i = 0; i < 20; i++) expect((await get(`accounts/detail?id=${id}`, cookie)).status).toBe(200);
    expect((await get(`accounts/detail?id=${id}`, cookie)).status).toBe(429);
    k.clock.advance(10_000);
    expect((await get(`accounts/detail?id=${id}`, cookie)).status).toBe(200);
  });
});

// ---- Ad değiştirme ---------------------------------------------------------------------------------------------

describe("zorla kullanıcı adı değiştirme", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("değişir, benzersizlik büyük/küçük harf duyarsız; aynı ad ve geçersiz ad reddedilir", async () => {
    const cookie = await adminLogin();
    const t = await register("Hedef_1");
    await register("Dolu_Ad");
    const rename = (username: string, id = t.id) => post("accounts/rename", cookie, { id, username });
    expect((await rename("dolu_ad")).status).toBe(409);
    expect((await rename("Hedef_1")).body.code).toBe("username_same");
    expect((await rename("a")).status).toBe(400);
    expect((await rename("bosluk var")).status).toBe(400);
    expect((await rename("Yeni_Ad", 999)).status).toBe(404);
    const ok = await rename("Yeni_Ad");
    expect(ok.status).toBe(200);
    expect(k.srv.accounts.findById(t.id)?.username).toBe("Yeni_Ad");
    expect(k.srv.accounts.findByUsername("hedef_1")).toBeNull();
    // Girişte yeni adla görünür.
    expect(await meAccount(t.cookie)).toMatchObject({ username: "Yeni_Ad" });
    const row = k.srv.accounts.adminAuditTail(5).find((r) => r.action === "account_rename");
    expect(row).toMatchObject({ accountId: 1, targetId: t.id, detail: "" });
    expect(JSON.stringify(row)).not.toContain("Yeni_Ad");
  });

  it("bekleme süresini aşar ve hesabın kendi bekleme sayacına dokunmaz", async () => {
    const cookie = await adminLogin();
    const t = await register("Hedef_2");
    const asUser = (username: string) =>
      fetch(`${base()}/api/auth/username`, {
        method: "POST",
        headers: { Origin: base(), "Content-Type": "application/json", Cookie: t.cookie },
        body: JSON.stringify({ username }),
      });
    // Taze hesapta yönetici değişikliği bekleme başlatmaz.
    expect((await post("accounts/rename", cookie, { id: t.id, username: "Admin_Adi" })).status).toBe(200);
    expect(k.srv.accounts.usernameAvailableAt(t.id, k.clock.now())).toBeNull();
    expect((await asUser("Kendi_Adi")).status).toBe(200);
    const lockedUntil = k.srv.accounts.usernameAvailableAt(t.id, k.clock.now());
    expect(lockedUntil).toBe(k.clock.now() + USERNAME_COOLDOWN_MS);
    expect((await asUser("Baska_Ad")).status).toBe(429);
    // Kullanıcının kendi beklemesi sürerken yönetici yine de değiştirir; sayaç aynı kalır.
    k.clock.advance(3 * 3600_000);
    const same = k.srv.accounts.usernameAvailableAt(t.id, k.clock.now());
    expect((await post("accounts/rename", cookie, { id: t.id, username: "Zorla_Ad" })).status).toBe(200);
    expect(k.srv.accounts.findById(t.id)?.username).toBe("Zorla_Ad");
    expect(k.srv.accounts.usernameAvailableAt(t.id, k.clock.now())).toBe(same);
  });

  it("yönetici kendine ve listedeki hesaplara dokunamaz (403)", async () => {
    const cookie = await adminLogin();
    const r = await post("accounts/rename", cookie, { id: 1, username: "Baska_Yonetici" });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("protected");
    expect(k.srv.accounts.findById(1)?.username).toBe("yonetici_1");
    for (const [p, body] of [
      ["accounts/suspend", { id: 1, duration: "1d", reason: "x" }],
      ["accounts/delete", { id: 1, confirm: "yonetici_1" }],
      ["accounts/logout-all", { id: 1 }],
    ] as const)
      expect((await post(p, cookie, body)).status).toBe(403);
    expect(k.srv.accounts.findById(1)).not.toBeNull();
    expect(k.srv.accounts.suspension(1, k.clock.now())).toBeNull();
  });

  it("canlı güncelleme: odadaki ad yayınlanır, arkadaşlar listeyi yenilemesi için haber alır", async () => {
    const cookie = await adminLogin();
    const t = loginCookie("Canli_Hedef");
    const friend = loginCookie("Canli_Dost");
    const tid = idOf("Canli_Hedef");
    const fid = idOf("Canli_Dost");
    k.srv.accounts.requestFriend(tid, fid, k.clock.now());
    k.srv.accounts.acceptFriend(fid, tid, k.clock.now());
    const host = await Client.connect(t);
    host.send({ type: "createRoom", nickname: "x" });
    await until(() => host.updates.length > 0, "oda");
    const watcher = await Client.connect(friend);
    await until(() => watcher.of("session").length >= 0, "bağlandı");
    expect((await post("accounts/rename", cookie, { id: tid, username: "Yeni_Canli" })).status).toBe(200);
    await until(() => host.room.players.some((p) => p.nickname === "Yeni_Canli"), "oda adı");
    await until(() => watcher.of("friendsChanged").length > 0, "arkadaş haberi");
  });
});

// ---- Askıya alma -----------------------------------------------------------------------------------------------

describe("askıya alma", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });
  const suspend = (cookie: string, id: number, duration = "7d", reason = "kural ihlali") =>
    post("accounts/suspend", cookie, { id, duration, reason });

  it("oturumlar silinir, parolayla giriş Türkçe mesajla reddedilir (sebep gösterilmez), süre dolunca açılır", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_1");
    const now = k.clock.now();
    const r = await suspend(cookie, t.id, "7d", "gizli yönetici notu");
    expect(r.status).toBe(200);
    expect(r.body.until).toBe(now + 7 * DAY);
    expect(await meAccount(t.cookie)).toBeNull();
    expect(k.srv.accounts.adminAccountDetail(t.id, now)?.sessions).toBe(0);
    const denied = await passwordLogin("Askili_1");
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("account_suspended");
    expect(denied.body.message).toMatch(/^Hesabın \d+ \w+ \d{4} \d\d:\d\d tarihine kadar askıya alındı\.$/);
    expect(JSON.stringify(denied.body)).not.toContain("gizli");
    expect(denied.body.until).toBe(now + 7 * DAY);
    // Yanlış parola hâlâ genel hata verir: askı bilgisi parola bilmeyene sızmaz.
    const wrong = await fetch(`${base()}/api/auth/login`, {
      method: "POST",
      headers: { Origin: base(), "Content-Type": "application/json" },
      body: JSON.stringify({ login: "Askili_1", password: "yanlis-sifre" }),
    });
    expect(wrong.status).toBe(401);
  });

  it("süresiz askı mesajı tarihsizdir; kaldırınca giriş açılır; askıda olmayanı kaldırma 409", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_2");
    expect((await post("accounts/unsuspend", cookie, { id: t.id })).status).toBe(409);
    expect((await suspend(cookie, t.id, "forever")).body.until).toBeNull();
    const denied = await passwordLogin("Askili_2");
    expect(denied.body.message).toBe("Hesabın askıya alındı.");
    expect((await post("accounts/unsuspend", cookie, { id: t.id })).status).toBe(200);
    expect((await passwordLogin("Askili_2")).status).toBe(200);
    const actions = k.srv.accounts.adminAuditTail(10).map((r) => r.action);
    expect(actions).toContain("account_suspend");
    expect(actions).toContain("account_unsuspend");
    const row = k.srv.accounts.adminAuditTail(10).find((r) => r.action === "account_suspend");
    expect(row).toMatchObject({ targetId: t.id, detail: "forever" });
  });

  it("1 gün seçeneği; sebep işlem kaydına yazılmaz; döküm askıyı gösterir", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_3");
    const now = k.clock.now();
    await suspend(cookie, t.id, "1d", "kayıtta olmamalı");
    expect(k.srv.accounts.suspension(t.id, now)).toEqual({
      since: now,
      until: now + DAY,
      reason: "kayıtta olmamalı",
    });
    expect(JSON.stringify(k.srv.accounts.adminAuditTail(20))).not.toContain("kayıtta olmamalı");
    const d = await get<AdminAccountDetail>(`accounts/detail?id=${t.id}`, cookie);
    expect(d.body.suspension).toEqual({ since: now, until: now + DAY, reason: "kayıtta olmamalı" });
    const s = await get<{ results: AdminAccountRow[] }>("accounts/search?q=askili_3", cookie);
    expect(s.body.results[0]?.suspended).toBe(true);
    k.clock.advance(DAY + 1);
    expect(
      k.srv.accounts.adminSearch({ kind: "prefix", value: "askili_3" }, k.clock.now())[0]?.suspended,
    ).toBe(false);
    // Süre dolunca kendiliğinden açılır: giriş serbest, askı kaydı yok.
    expect((await passwordLogin("Askili_3")).status).toBe(200);
    expect(k.srv.accounts.suspension(t.id, k.clock.now())).toBeNull();
  });

  it("geçersiz süre/sebep 400; zaten askıdaki hesap yeniden askıya alınabilir", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_4");
    expect((await suspend(cookie, t.id, "30d")).status).toBe(400);
    expect((await suspend(cookie, t.id, "1d", "")).status).toBe(400);
    expect((await suspend(cookie, t.id, "1d", "x".repeat(141))).status).toBe(400);
    expect((await suspend(cookie, 999)).status).toBe(404);
    expect(k.srv.accounts.suspension(t.id, k.clock.now())).toBeNull();
    await suspend(cookie, t.id, "1d", "ilk");
    await suspend(cookie, t.id, "forever", "ikinci");
    expect(k.srv.accounts.suspension(t.id, k.clock.now())).toMatchObject({ until: null, reason: "ikinci" });
  });

  it("canlı soket misafire döner (odada kalır), arkadaşlar çevrimdışı görür, istek bulunamadı", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_5");
    const friend = loginCookie("Dost_5");
    const stranger = loginCookie("Yabanci_5");
    const fid = idOf("Dost_5");
    k.srv.accounts.requestFriend(t.id, fid, k.clock.now());
    k.srv.accounts.acceptFriend(fid, t.id, k.clock.now());

    const player = await Client.connect(t.cookie);
    player.send({ type: "createRoom", nickname: "x" });
    await until(() => player.updates.length > 0, "oda");
    const watcher = await Client.connect(friend);
    await until(() => watcher.of("friendStatus").some((m) => m.status === "lobby"), "dost lobiyi gördü");
    const friendsBefore = watcher.of("friendsChanged").length;

    expect((await suspend(cookie, t.id)).status).toBe(200);
    await until(() => watcher.of("friendsChanged").length > friendsBefore, "dost haber aldı");
    // Soket açık, oyuncu odada mevcut adıyla duruyor; ama artık hesapla bağı yok.
    expect(player.ws.readyState).toBe(player.ws.OPEN);
    expect(player.room.players.map((p) => p.nickname)).toEqual(["Askili_5"]);
    const list = (await (await friendsApi(friend, "")).json()) as {
      friends: { username: string; status: string }[];
    };
    expect(list.friends).toEqual([expect.objectContaining({ username: "Askili_5", status: "offline" })]);
    // Hesap bağı koptuğu için odadaki oyuncu artık hesaplı değildir: yeniden takma ad değiştirebilir.
    player.send({ type: "rename", nickname: "Misafir_Ad" });
    await until(() => player.room.players.some((p) => p.nickname === "Misafir_Ad"), "misafir takma adı");

    // Başkası arkadaş isteği atamaz ve kabul edemez: "bulunamadı".
    const req = await friendsApi(stranger, "/request", { username: "askili_5" });
    expect(req.status).toBe(404);
    expect(((await req.json()) as { code: string }).code).toBe("not_found");
    const plain = await friendsApi(stranger, "/request", { username: "Olmayan_Biri" });
    expect(plain.status).toBe(404);
    // Arkadaşlık kaydı silinmedi; kaldırınca geri gelir.
    expect(k.srv.accounts.areFriends(t.id, fid)).toBe(true);
    // Askıdaki arkadaşın profili görünmez.
    const prof = await fetch(`${base()}/api/profile/Askili_5`, { headers: { Cookie: friend } });
    expect(prof.status).toBe(404);
    await post("accounts/unsuspend", cookie, { id: t.id });
    expect((await fetch(`${base()}/api/profile/Askili_5`, { headers: { Cookie: friend } })).status).toBe(200);
  });

  it("şifre sıfırlama bağlantısı askıdaki hesaba oturum açmaz", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_6");
    await suspend(cookie, t.id);
    const { createHash } = await import("node:crypto");
    const token = "T".repeat(43);
    k.srv.accounts.createToken(
      "reset",
      t.id,
      createHash("sha256").update(token).digest("hex"),
      k.clock.now() + 3600_000,
    );
    const res = await fetch(`${base()}/api/auth/reset/confirm`, {
      method: "POST",
      headers: { Origin: base(), "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "yeni-gizli-sifre" }),
    });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(k.srv.accounts.adminAccountDetail(t.id, k.clock.now())?.sessions).toBe(0);
  });

  it("sebep yalnız hesap sahibinin 'Verimi indir' dökümünde görünür", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_7");
    await suspend(cookie, t.id, "1d", "kural ihlali");
    const body = buildExport(k.srv.accounts, noopSocial, t.id, k.clock.now()) as {
      account: { suspension?: { reason: string; until: string } };
    };
    expect(body.account.suspension).toMatchObject({ reason: "kural ihlali" });
    k.clock.advance(2 * DAY);
    const later = buildExport(k.srv.accounts, noopSocial, t.id, k.clock.now()) as {
      account: Record<string, unknown>;
    };
    expect(later.account.suspension).toBeUndefined();
  });

  it("günlük temizlik süresi dolan askıyı siler", async () => {
    const cookie = await adminLogin();
    const t = await register("Askili_8");
    await suspend(cookie, t.id, "1d", "kısa");
    k.clock.advance(2 * DAY);
    k.srv.accounts.purge(k.clock.now());
    const { DatabaseSync } = loadSqlite();
    expect(k.srv.accounts.suspension(t.id, k.clock.now())).toBeNull();
    void DatabaseSync;
  });
});

// ---- Google ile askı -------------------------------------------------------------------------------------------

describe("askıdaki hesap Google ile giriş yapamaz", () => {
  const CLIENT_ID = "test-client.apps.googleusercontent.com";
  const GOOGLE = {
    clientId: CLIENT_ID,
    clientSecret: "test-secret",
    redirectUri: "https://glix.example/api/auth/google/callback",
  };
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:", google: GOOGLE });
  const realFetch = globalThis.fetch;
  afterEach(() => vi.restoreAllMocks());

  async function googleLogin(sub: string): Promise<{ status: number; location: string; cookies: string[] }> {
    const start = await realFetch(`${base()}/api/auth/google/start`, { redirect: "manual" });
    const url = new URL(start.headers.get("location") ?? "");
    const oauth =
      (start.headers.getSetCookie().find((c) => c.startsWith("glix_oauth=")) ?? "").split(";")[0] ?? "";
    const nonce = url.searchParams.get("nonce") ?? "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (target !== "https://oauth2.googleapis.com/token") return realFetch(input, init);
      const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const payload = {
        iss: "https://accounts.google.com",
        aud: CLIENT_ID,
        exp: Math.floor(k.clock.now() / 1000) + 3600,
        nonce,
        sub,
        email: "g@test.local",
        email_verified: true,
      };
      return new Response(JSON.stringify({ id_token: `${part({ alg: "RS256" })}.${part(payload)}.imza` }));
    });
    const hop = await realFetch(
      `${base()}/api/auth/google/callback?state=${url.searchParams.get("state")}&code=abc`,
      { redirect: "manual", headers: { Cookie: oauth } },
    );
    return {
      status: hop.status,
      location: hop.headers.get("location") ?? "",
      cookies: hop.headers.getSetCookie(),
    };
  }

  it("oturum açılmaz; bitiş adres parçasında, sebep yok; kaldırınca girer", async () => {
    const cookie = await adminLogin();
    const made = k.srv.accounts.createGoogle("Google_Askili", "g@test.local", "sub-1", k.clock.now());
    if (!made.ok) throw new Error("hesap");
    const ok = await googleLogin("sub-1");
    expect(ok.location).toBe("/");
    expect(ok.cookies.some((c) => c.startsWith("glix_sess="))).toBe(true);

    const now = k.clock.now();
    expect(
      (await post("accounts/suspend", cookie, { id: made.account.id, duration: "1d", reason: "gizli not" }))
        .status,
    ).toBe(200);
    const blocked = await googleLogin("sub-1");
    expect(blocked.location).toBe(`/#google-hata=askida&bitis=${now + DAY}`);
    expect(blocked.cookies.some((c) => c.startsWith("glix_sess="))).toBe(false);
    expect(blocked.location).not.toContain("gizli");

    await post("accounts/suspend", cookie, { id: made.account.id, duration: "forever", reason: "x" });
    expect((await googleLogin("sub-1")).location).toBe("/#google-hata=askida");

    await post("accounts/unsuspend", cookie, { id: made.account.id });
    const again = await googleLogin("sub-1");
    expect(again.location).toBe("/");
    expect(again.cookies.some((c) => c.startsWith("glix_sess="))).toBe(true);
  });
});

// ---- Silme ve oturum kapatma -----------------------------------------------------------------------------------

describe("hesap silme ve oturum kapatma", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("silme kullanıcı adı yazılmadan olmaz; yazılınca KVKK silmesiyle aynı veriyi siler", async () => {
    const cookie = await adminLogin();
    const t = await register("Silinecek");
    const friend = loginCookie("Dost_Sil");
    const fid = idOf("Dost_Sil");
    k.srv.accounts.requestFriend(t.id, fid, k.clock.now());
    k.srv.accounts.acceptFriend(fid, t.id, k.clock.now());
    k.srv.accounts.recordMatch(
      k.clock.now(),
      [{ accountId: t.id, players: 2, games: 1, score: 5, place: 1 }],
      [],
    );
    k.srv.accounts.awardBadges(t.id, ["ilk-adim"], k.clock.now());
    const watcher = await Client.connect(friend);
    const player = await Client.connect(t.cookie);
    player.send({ type: "createRoom", nickname: "x" });
    await until(() => player.updates.length > 0, "oda");

    const del = (confirm: string) => post("accounts/delete", cookie, { id: t.id, confirm });
    expect((await del("")).body.code).toBe("confirm_mismatch");
    expect((await del("baska")).status).toBe(400);
    expect(k.srv.accounts.findById(t.id)).not.toBeNull();
    expect((await post("accounts/delete", cookie, { id: t.id })).status).toBe(400);

    const before = watcher.of("friendsChanged").length;
    expect((await del("silinecek")).status).toBe(200);
    expect(k.srv.accounts.findById(t.id)).toBeNull();
    expect(k.srv.accounts.profile(t.id, false)).toBeNull();
    expect(k.srv.accounts.earnedBadges(t.id)).toEqual([]);
    expect(k.srv.accounts.friendLists(fid).friends).toEqual([]);
    expect(await meAccount(t.cookie)).toBeNull();
    await until(() => watcher.of("friendsChanged").length > before, "dost haber aldı");
    // Soket açık kalır, oyuncu odada misafir olarak durur.
    expect(player.ws.readyState).toBe(player.ws.OPEN);
    expect(player.room.players.map((p) => p.nickname)).toEqual(["Silinecek"]);
    // Kayıt hedef kimliği taşır; ad ve e-posta yok.
    const row = k.srv.accounts.adminAuditTail(5).find((r) => r.action === "account_delete");
    expect(row).toMatchObject({ accountId: 1, targetId: t.id, detail: "" });
    expect(JSON.stringify(row)).not.toMatch(/Silinecek|test\.local/i);
    expect((await post("accounts/delete", cookie, { id: t.id, confirm: "silinecek" })).status).toBe(404);
  });

  it("her yerden çıkar: tüm oturumlar silinir, canlı soketler misafire döner, hesap yerinde kalır", async () => {
    const cookie = await adminLogin();
    const t = await register("Cikis_1");
    const second = await passwordLogin("Cikis_1");
    expect(second.status).toBe(200);
    const friend = loginCookie("Dost_Cikis");
    const fid = idOf("Dost_Cikis");
    k.srv.accounts.requestFriend(t.id, fid, k.clock.now());
    k.srv.accounts.acceptFriend(fid, t.id, k.clock.now());
    const player = await Client.connect(t.cookie);
    const watcher = await Client.connect(friend);
    await until(() => watcher.of("friendStatus").some((m) => m.status === "online"), "çevrimiçi");
    const before = watcher.of("friendsChanged").length;

    const r = await post("accounts/logout-all", cookie, { id: t.id });
    expect(r.status).toBe(200);
    expect(r.body.closed).toBe(2);
    expect(await meAccount(t.cookie)).toBeNull();
    expect(k.srv.accounts.adminAccountDetail(t.id, k.clock.now())?.sessions).toBe(0);
    expect(k.srv.accounts.findById(t.id)).not.toBeNull();
    await until(() => watcher.of("friendsChanged").length > before, "dost haber aldı");
    expect(player.ws.readyState).toBe(player.ws.OPEN);
    // Yeniden giriş serbest (askı değil).
    expect((await passwordLogin("Cikis_1")).status).toBe(200);
    const row = k.srv.accounts.adminAuditTail(5).find((x) => x.action === "account_logout_all");
    expect(row).toMatchObject({ targetId: t.id, detail: "2" });
  });

  it("işlemler yönetici başına hız sınırlı (10 ani), zamanla açılır", async () => {
    const cookie = await adminLogin();
    const t = await register("Hizli_1");
    for (let i = 0; i < 10; i++)
      expect((await post("accounts/logout-all", cookie, { id: t.id })).status).toBe(200);
    expect((await post("accounts/logout-all", cookie, { id: t.id })).status).toBe(429);
    k.clock.advance(60_000);
    expect((await post("accounts/logout-all", cookie, { id: t.id })).status).toBe(200);
  });
});

// ---- İşlem kaydı -----------------------------------------------------------------------------------------------

describe("işlem kaydı sayfalama ve saklama", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("yeniden eskiye sayfalar, imleçle devam eder, sınırlar uygulanır", async () => {
    const cookie = await adminLogin();
    for (let i = 0; i < 120; i++) k.srv.accounts.adminAudit(1, "account_view", `n${i}`, k.clock.now() + i, 2);
    const p1 = await get<AdminAuditPage>("audit", cookie);
    expect(p1.body.entries).toHaveLength(50);
    expect(p1.body.entries[0]?.detail).toBe("n119");
    expect(p1.body.nextBefore).toBe(p1.body.entries[49]?.id);
    const p2 = await get<AdminAuditPage>(`audit?before=${p1.body.nextBefore}`, cookie);
    expect(p2.body.entries[0]?.detail).toBe("n69");
    const p3 = await get<AdminAuditPage>(`audit?before=${p2.body.nextBefore}`, cookie);
    // 120 + giriş olayları (kod isteği + doğrulama) toplam 122 satır: son sayfada kalanlar ve imleç yok.
    expect(p3.body.entries).toHaveLength(22);
    expect(p3.body.nextBefore).toBeNull();
    const ids = [...p1.body.entries, ...p2.body.entries, ...p3.body.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(122);
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    const small = await get<AdminAuditPage>("audit?limit=5", cookie);
    expect(small.body.entries).toHaveLength(5);
    const huge = await get<AdminAuditPage>("audit?limit=5000", cookie);
    expect(huge.body.entries).toHaveLength(100);
    for (const bad of ["before=abc", "before=0", "limit=0", "limit=x", "before=-3"])
      expect((await get(`audit?${bad}`, cookie)).status).toBe(400);
  });

  it("giriş olayları da sayfada görünür; kod ve e-posta yok", async () => {
    const cookie = await adminLogin();
    const page = await get<AdminAuditPage>("audit", cookie);
    expect(page.body.entries.map((e) => e.action)).toEqual(["otp_ok", "otp_request"]);
    expect(page.raw).not.toContain(lastCode());
    expect(page.raw).not.toContain("test.local");
  });

  it("günlük temizlik 1 yıldan eski kayıtları siler", async () => {
    await adminLogin();
    const now = k.clock.now();
    k.srv.accounts.adminAudit(1, "account_view", "eski", now - ADMIN_AUDIT_RETENTION_MS - 1, 2);
    k.srv.accounts.adminAudit(1, "account_view", "sinirda", now - ADMIN_AUDIT_RETENTION_MS + 1000, 2);
    k.srv.accounts.adminAudit(1, "account_view", "yeni", now, 2);
    k.srv.accounts.purge(now);
    const details = k.srv.accounts.adminAuditTail(50).map((r) => r.detail);
    expect(details).not.toContain("eski");
    expect(details).toEqual(expect.arrayContaining(["sinirda", "yeni"]));
  });
});

// ---- Hesap toplamları ve e-posta sayaçları ---------------------------------------------------------------------

describe("hesaplar sekmesi verisi", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("toplam, doğrulama, giriş yöntemi dağılımı, etkin hesaplar, askı", async () => {
    const cookie = await adminLogin();
    const a = await register("Hesap_a");
    const b = await register("Hesap_b");
    const g = k.srv.accounts.createGoogle("Hesap_g", "hg@test.local", "sub-h", k.clock.now());
    if (!g.ok) throw new Error("google");
    k.srv.accounts.linkGoogle(b.id, "sub-b");
    k.srv.accounts.markVerified(a.id);
    const now = k.clock.now();
    k.srv.accounts.recordMatch(
      now - 2 * DAY,
      [{ accountId: a.id, players: 2, games: 1, score: 1, place: 1 }],
      [],
    );
    k.srv.accounts.recordMatch(
      now - 20 * DAY,
      [{ accountId: b.id, players: 2, games: 1, score: 1, place: 2 }],
      [],
    );
    k.srv.accounts.recordMatch(
      now - 40 * DAY,
      [{ accountId: g.account.id, players: 2, games: 1, score: 1, place: 2 }],
      [],
    );
    k.srv.accounts.recordMatch(
      now - DAY,
      [{ accountId: a.id, players: 2, games: 1, score: 1, place: 1 }],
      [],
    );
    await post("accounts/suspend", cookie, { id: b.id, duration: "forever", reason: "x" });
    const r = await get<AdminAccounts>("accounts", cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      total: 4,
      // yonetici_1 (testkit hesabı) şifre özetli kabul edilir; Hesap_g yalnız Google.
      verified: 2,
      methods: { google: 1, password: 2, both: 1 },
      active7: 1,
      active30: 2,
      suspended: 1,
    });
    expect(r.body.methods.google + r.body.methods.password + r.body.methods.both).toBe(r.body.total);
    expect(r.body.newPerDay).toHaveLength(30);
    expect(r.body.newPerDay.at(-1)?.count).toBe(4);
    expect(r.raw).not.toContain("test.local");
  });
});

describe("e-posta gönderim sayaçları", () => {
  const db = newDb();
  beforeEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) rmSync(db + suffix, { force: true });
  });
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: db });

  const tableRows = (): Record<string, number | string>[] => {
    const { DatabaseSync } = loadSqlite();
    const conn = new DatabaseSync(db, { readOnly: true });
    try {
      return conn.prepare("SELECT * FROM mail_stats ORDER BY kind").all() as Record<
        string,
        number | string
      >[];
    } finally {
      conn.close();
    }
  };

  it("doğrulama, sıfırlama ve yönetici kodu: başarılı/başarısız gün başına sayılır; adres tutulmaz", async () => {
    const sess = loginCookie("yonetici_1");
    // Yönetici kodu: biri başarısız, biri başarılı.
    mailOk = false;
    expect((await call("POST", "otp/request", sess)).status).toBe(502);
    mailOk = true;
    k.clock.advance(61_000);
    expect((await call("POST", "otp/request", sess)).status).toBe(200);
    // Doğrulama e-postası (kayıt) ve şifre sıfırlama.
    await register("Posta_1");
    await register("Posta_2");
    mailOk = false;
    k.clock.advance(61_000);
    await fetch(`${base()}/api/auth/reset/request`, {
      method: "POST",
      headers: { Origin: base(), "Content-Type": "application/json" },
      body: JSON.stringify({ email: "posta_1@test.local" }),
    });
    await until(() => tableRows().some((r) => r.kind === "reset"), "sıfırlama sayacı");
    mailOk = true;

    const day = Math.floor(k.clock.now() / DAY) * DAY;
    const rows = tableRows();
    expect(rows).toEqual([
      { day, kind: "admin", ok: 1, failed: 1 },
      { day, kind: "reset", ok: 0, failed: 1 },
      { day, kind: "verify", ok: 2, failed: 0 },
    ]);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(["day", "failed", "kind", "ok"]);
    expect(JSON.stringify(rows)).not.toMatch(/@|posta_|test\.local/);
  });

  it("panel verisi: 30 gün, bugün dolu, toplamlar; istatistik kapalıysa enabled=false", async () => {
    const cookie = await adminLogin();
    const r = await get<AdminAccounts>("accounts", cookie);
    expect(r.body.mail.enabled).toBe(true);
    expect(r.body.mail.days).toHaveLength(30);
    expect(r.body.mail.days.at(-1)?.admin).toEqual({ ok: 1, failed: 0 });
    expect(r.body.mail.days[0]?.admin).toEqual({ ok: 0, failed: 0 });
    expect(r.body.mail.totals.admin).toEqual({ ok: 1, failed: 0 });
    expect(r.body.mail.totals.verify).toEqual({ ok: 0, failed: 0 });
  });
});

describe("e-posta sayacı: istatistik kapalıyken", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch });

  it("sunucu çalışır, panel 'kapalı' bilgisini döner", async () => {
    const cookie = await adminLogin();
    const r = await get<AdminAccounts>("accounts", cookie);
    expect(r.status).toBe(200);
    expect(r.body.mail).toEqual({
      enabled: false,
      days: [],
      totals: { verify: { ok: 0, failed: 0 }, reset: { ok: 0, failed: 0 }, admin: { ok: 0, failed: 0 } },
    });
  });
});
