import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  parseLogin,
  parseRegister,
  readSessionToken,
  verifyPassword,
} from "./auth.js";
import { startServer } from "./server.js";
import { Client, create, join, k, until, useServer } from "./testkit.js";

const base = () => `http://127.0.0.1:${k.srv.port}`;

interface Reply {
  status: number;
  body: {
    ok?: boolean;
    code?: string;
    message?: string;
    field?: string;
    account?: Record<string, string> | null;
  };
  cookie: string | null;
}

async function call(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<Reply> {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    method,
    headers: {
      Origin: base(),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  return {
    status: res.status,
    body: (await res.json()) as Reply["body"],
    cookie: res.headers.get("set-cookie"),
  };
}

const reg = (over: Record<string, unknown> = {}) =>
  call("POST", "register", {
    username: "Ali_01",
    email: "Ali@Example.com",
    password: "gizli-sifre",
    ...over,
  });

const cookieOf = (r: Reply): string => (r.cookie ?? "").split(";")[0] ?? "";

describe("hesap uçları", () => {
  useServer();

  it("kayıt: çerez HttpOnly/SameSite, me hesabı döner, e-posta küçük harfe çevrilir", async () => {
    const r = await reg();
    expect(r.status).toBe(200);
    expect(r.body.account).toEqual({ username: "Ali_01", email: "ali@example.com" });
    expect(r.cookie).toMatch(
      /^glix_sess=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=\/; Max-Age=15552000$/,
    );
    expect(r.cookie).not.toMatch(/Secure/);
    const me = await call("GET", "me", undefined, { Cookie: cookieOf(r) });
    expect(me.body.account).toEqual({ username: "Ali_01", email: "ali@example.com" });
    expect((await call("GET", "me")).body.account).toBeNull();
  });

  it("kayıtta oturumun yalnız özeti saklanır; parola özeti scrypt", async () => {
    const r = await reg();
    const token = cookieOf(r).split("=")[1] ?? "";
    expect(k.srv.accounts.resolveSession(token, k.clock.now())).toBeNull();
    const found = k.srv.accounts.findByLogin("ali_01");
    expect(found?.passHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(found?.passHash).not.toContain("gizli-sifre");
  });

  it("aynı kullanıcı adı (büyük/küçük harf duyarsız) ve aynı e-posta reddedilir", async () => {
    expect((await reg()).status).toBe(200);
    const dupUser = await reg({ username: "ALI_01", email: "baska@example.com" });
    expect(dupUser.status).toBe(409);
    expect(dupUser.body.code).toBe("username_taken");
    const dupMail = await reg({ username: "Baska", email: "ALI@example.com" });
    expect(dupMail.status).toBe(409);
    expect(dupMail.body.code).toBe("email_taken");
  });

  it("geçersiz girdiler 400 döner", async () => {
    for (const [over, field] of [
      [{ username: "ab" }, "username"],
      [{ username: "a".repeat(21) }, "username"],
      [{ username: "ali-01" }, "username"],
      [{ username: "çağrı" }, "username"],
      [{ email: "yok" }, "email"],
      [{ email: "a@b" }, "email"],
      [{ password: "kisa" }, "password"],
      [{ password: "x".repeat(129) }, "password"],
      [{ password: 12345678 }, "password"],
    ] as const) {
      const r = await reg(over);
      expect(r.status, JSON.stringify(over)).toBe(400);
      expect(r.body.field).toBe(field);
    }
    expect(
      (await call("POST", "register", { username: "abc", email: "a@b.co", password: "12345678", x: 1 }))
        .status,
    ).toBe(400);
    expect((await call("POST", "register", "{bozuk")).status).toBe(400);
    expect((await call("POST", "register", "[]")).status).toBe(400);
  });

  it("giriş: kullanıcı adı ya da e-posta ile; yanlış şifre ve bilinmeyen hesap aynı genel hata", async () => {
    await reg();
    const byName = await call("POST", "login", { login: "ali_01", password: "gizli-sifre" });
    expect(byName.status).toBe(200);
    expect(cookieOf(byName)).toMatch(/^glix_sess=/);
    const byMail = await call("POST", "login", { login: "ALI@example.com", password: "gizli-sifre" });
    expect(byMail.status).toBe(200);
    const bad = await call("POST", "login", { login: "ali_01", password: "yanlis-sifre" });
    const none = await call("POST", "login", { login: "yok_boyle", password: "yanlis-sifre" });
    expect(bad.status).toBe(401);
    expect(none.status).toBe(401);
    expect(bad.body).toEqual(none.body);
    expect(bad.cookie).toBeNull();
  });

  it("çıkış oturumu siler ve çerezi temizler", async () => {
    const c = cookieOf(await reg());
    const out = await call("POST", "logout", {}, { Cookie: c });
    expect(out.status).toBe(200);
    expect(out.cookie).toMatch(/Max-Age=0/);
    expect((await call("GET", "me", undefined, { Cookie: c })).body.account).toBeNull();
  });

  it("oturum 180 gün sonra düşer", async () => {
    const c = cookieOf(await reg());
    // Sahte saat 181 gün ilerletilmez (tick zamanlayıcıları milyonlarca kez çalışır); depoya doğrudan sorulur.
    const hash = hashToken(c.split("=")[1] ?? "");
    expect(k.srv.accounts.resolveSession(hash, k.clock.now())).not.toBeNull();
    expect(k.srv.accounts.resolveSession(hash, k.clock.now() + 181 * 24 * 3600 * 1000)).toBeNull();
  });

  it("CSRF: Origin yok ya da başka alan adı ise POST reddedilir", async () => {
    const body = { username: "Ali_01", email: "a@example.com", password: "gizli-sifre" };
    const evil = await call("POST", "register", body, { Origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    const res = await fetch(`${base()}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(403);
    expect(k.srv.accounts.findByLogin("ali_01")).toBeNull();
  });

  it("yöntem ve yol denetimi", async () => {
    expect((await call("GET", "login")).status).toBe(405);
    expect((await call("POST", "me", {})).status).toBe(405);
    expect((await call("GET", "bilinmez")).status).toBe(404);
  });

  it("hız sınırı: IP başına kayıt/giriş denemesi sınırlanır", async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) {
      last = (await call("POST", "login", { login: "yok_boyle", password: "yanlis-sifre" })).status;
      if (last === 429) break;
    }
    expect(last).toBe(429);
  });
});

describe("https vekili", () => {
  it("güvenilen vekil https bildirirse çerez Secure olur; kapalıyken başlık yok sayılır", async () => {
    for (const trustProxy of [true, false]) {
      const srv = await startServer({
        host: "127.0.0.1",
        port: 0,
        clientDir: tmpdir(),
        allowedOrigins: null,
        revision: "t",
        heartbeatMs: 1_000_000_000,
        limits: { trustProxy },
      });
      try {
        const origin = `http://127.0.0.1:${srv.port}`;
        const res = await fetch(`${origin}/api/auth/register`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-Proto": "https" },
          body: JSON.stringify({ username: "Ali_01", email: "a@example.com", password: "gizli-sifre" }),
        });
        expect(res.status).toBe(200);
        expect(/; Secure/.test(res.headers.get("set-cookie") ?? "")).toBe(trustProxy);
      } finally {
        await srv.close();
      }
    }
  });
});

describe("hesap başına parola deneme sınırı", () => {
  useServer();
  it("art arda hatalı parola sonrası doğru parola da bir süre reddedilir", async () => {
    await reg();
    for (let i = 0; i < 8; i++) await call("POST", "login", { login: "ali_01", password: "yanlis-sifre" });
    const r = await call("POST", "login", { login: "ali_01", password: "gizli-sifre" });
    expect(r.status).toBe(429);
    k.clock.advance(31_000);
    expect((await call("POST", "login", { login: "ali_01", password: "gizli-sifre" })).status).toBe(200);
  });
});

describe("WS ve oda kurma", () => {
  useServer();

  it("çerezli bağlantı oda kurabilir; oyuncu kaydında hesap var, yayında yok", async () => {
    const r = await reg();
    const c = await Client.connect(cookieOf(r));
    c.send({ type: "createRoom", nickname: "Ali_01" });
    await until(() => c.updates.length > 0, "oda");
    expect(c.lastError).toBeUndefined();
    const text = JSON.stringify(c.msgs);
    expect(text).not.toContain("ali@example.com");
    expect(text).not.toContain("accountId");
  });

  it("misafir oda kuramaz (login_required); kodla katılabilir", async () => {
    const host = await create("Ali");
    const guest = await Client.connect();
    guest.send({ type: "createRoom", nickname: "Misafir" });
    await until(() => guest.lastError !== undefined, "hata");
    expect(guest.lastError?.code).toBe("login_required");
    const g2 = await join(host.session.roomCode, "Veli");
    expect(g2.lastError).toBeUndefined();
    expect(g2.room.players.map((p) => p.nickname)).toContain("Veli");
  });

  it("geçersiz ya da çıkış yapılmış çerezle bağlanan misafir sayılır", async () => {
    const r = await reg();
    const c = cookieOf(r);
    await call("POST", "logout", {}, { Cookie: c });
    const ws = await Client.connect(c);
    ws.send({ type: "createRoom", nickname: "Ali" });
    await until(() => ws.lastError !== undefined, "hata");
    expect(ws.lastError?.code).toBe("login_required");
    const junk = await Client.connect("glix_sess=zzz");
    junk.send({ type: "createRoom", nickname: "Ali" });
    await until(() => junk.lastError !== undefined, "hata");
    expect(junk.lastError?.code).toBe("login_required");
  });
});

describe("yardımcılar", () => {
  it("scrypt özeti doğrular ve her seferinde farklı tuz kullanır", async () => {
    const a = await hashPassword("parola-123");
    const b = await hashPassword("parola-123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("parola-123", a)).toBe(true);
    expect(await verifyPassword("parola-124", a)).toBe(false);
    expect(await verifyPassword("x", "scrypt$99999999$8$1$aa$bb")).toBe(false);
    expect(await verifyPassword("x", "bozuk")).toBe(false);
  });

  it("çerez ve girdi ayrıştırma", () => {
    const tok = "A".repeat(43);
    expect(readSessionToken(`a=1; glix_sess=${tok}; b=2`)).toBe(tok);
    expect(readSessionToken("glix_sess=kisa")).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
    expect(parseRegister({ username: "abc", email: " A@B.co ", password: "12345678" })).toEqual({
      username: "abc",
      email: "a@b.co",
      password: "12345678",
    });
    expect(parseLogin({ login: "abc", password: "12345678" })).toEqual({
      login: "abc",
      password: "12345678",
    });
    expect(parseLogin(null)).toBe("login");
  });
});
