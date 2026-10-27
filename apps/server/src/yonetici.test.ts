import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_TTL_MS, OTP_GAP_MS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, parseCode } from "./admin.js";
import { hashToken } from "./auth.js";
import { loadAdminIds } from "./config.js";
import { create, join as joinRoom, k, loginCookie, sync, useServer } from "./testkit.js";

const MAIL = { apiKey: "re_test", from: "GLIX <noreply@glix.example>", publicUrl: "https://glix.example" };
const base = () => `http://127.0.0.1:${k.srv.port}`;

const sent: { to: string[]; text: string; subject: string }[] = [];
let mailOk = true;
const mailFetch = vi.fn(async (_url: string, init: { body: string }) => {
  if (!mailOk) return { status: 500 };
  sent.push(JSON.parse(init.body) as (typeof sent)[number]);
  return { status: 200 };
});
const lastCode = (): string => /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? "")?.[1] ?? "";

const ADMIN = new Set([1]);
/** Her testte sunucu yenidir: ilk açılan hesap kimlik 1 alır ve yöneticidir; sonrakiler değildir. */
const adminCookie = (): string => loginCookie("yonetici_1");
const otherCookie = (name = "oyuncu_2"): string => loginCookie(name);

interface Reply {
  status: number;
  body: Record<string, unknown>;
  setCookie: string;
}

async function call(
  method: "GET" | "POST",
  path: string,
  cookie: string | null,
  opts: { body?: unknown; origin?: string | null; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const origin = opts.origin === undefined ? base() : opts.origin;
  const res = await fetch(`${base()}/api/admin/${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...opts.headers,
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
    setCookie: res.headers.get("set-cookie") ?? "",
  };
}

const requestCode = (cookie: string) => call("POST", "otp/request", cookie);
const verify = (cookie: string, code: string) => call("POST", "otp/verify", cookie, { body: { code } });

/** Kod iste + doğrula; `glix_sess` ve `glix_admin` çerezlerini birleştirip döner. */
async function signIn(sess: string): Promise<string> {
  const r = await requestCode(sess);
  expect(r.status).toBe(200);
  const v = await verify(sess, lastCode());
  expect(v.status).toBe(200);
  return `${sess}; ${v.setCookie.split(";")[0]}`;
}

const DATA = ["live", "stats", "errors"] as const;

beforeEach(() => {
  sent.length = 0;
  mailOk = true;
  mailFetch.mockClear();
});

describe("yönetici paneli: kapalı", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-admin-off-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>oyun</title>");
  writeFileSync(join(dir, "admin.html"), "<!doctype html><title>yonetici</title>");
  useServer({ clientDir: dir, mail: MAIL, mailFetch });

  it("GLIX_ADMIN_ACCOUNT_IDS boşken tüm uçlar ve sayfa 404", async () => {
    const cookie = adminCookie();
    for (const p of ["status", ...DATA]) expect((await call("GET", p, cookie)).status).toBe(404);
    expect((await requestCode(cookie)).status).toBe(404);
    for (const p of ["/admin", "/admin/", "/admin.html"])
      expect((await fetch(`${base()}${p}`)).status).toBe(404);
    expect(sent).toHaveLength(0);
  });
});

describe("yönetici paneli: sayfa", () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-admin-page-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>oyun</title>");
  writeFileSync(join(dir, "admin.html"), "<!doctype html><title>yonetici</title>");
  useServer({ clientDir: dir, adminAccountIds: ADMIN });

  it("/admin admin.html'i sunar (oyun kabuğunu değil); alt yollar 404", async () => {
    for (const p of ["/admin", "/admin/"]) {
      const r = await fetch(`${base()}${p}`);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain("yonetici");
      expect(r.headers.get("x-robots-tag")).toBe("noindex");
      expect(r.headers.get("cache-control")).toBe("no-cache");
    }
    expect((await fetch(`${base()}/admin/baska`)).status).toBe(404);
    expect(await (await fetch(`${base()}/`)).text()).toContain("oyun");
  });
});

describe("yönetici paneli: erişim denetimi", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("oturum yoksa 401, bilinmeyen uç 404", async () => {
    for (const p of ["status", ...DATA]) expect((await call("GET", p, null)).status).toBe(401);
    expect((await requestCode("")).status).toBe(401);
    expect((await call("GET", "yok", null)).status).toBe(404);
  });

  it("yönetici olmayan hesap 404 alır ve e-posta gitmez", async () => {
    adminCookie();
    const other = otherCookie();
    for (const p of ["status", ...DATA]) expect((await call("GET", p, other)).status).toBe(404);
    expect((await requestCode(other)).status).toBe(404);
    expect((await verify(other, "123456")).status).toBe(404);
    expect(sent).toHaveLength(0);
  });

  it("yönetici çerezi olmadan veri uçları 403 (otp_required), durum need_otp", async () => {
    const sess = adminCookie();
    expect((await call("GET", "status", sess)).body).toEqual({ state: "need_otp" });
    for (const p of DATA) {
      const r = await call("GET", p, sess);
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("otp_required");
    }
  });

  it("POST'larda Origin zorunlu ve Host ile aynı olmalı", async () => {
    const sess = adminCookie();
    expect((await call("POST", "otp/request", sess, { origin: null })).status).toBe(403);
    expect((await call("POST", "otp/request", sess, { origin: "https://kotu.example" })).status).toBe(403);
    expect((await call("POST", "otp/verify", sess, { origin: null, body: { code: "123456" } })).status).toBe(
      403,
    );
    expect((await call("POST", "logout", sess, { origin: "https://kotu.example" })).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("yanlış yöntem 405", async () => {
    const sess = adminCookie();
    expect((await call("POST", "live", sess)).status).toBe(405);
    expect((await call("GET", "otp/request", sess)).status).toBe(405);
  });

  it("kod e-postası hesabın adresine gider, kod 6 hane; günlüğe ve işlem kaydına yazılmaz", async () => {
    const out: string[] = [];
    const w1 = vi.spyOn(process.stdout, "write").mockImplementation((c: string | Uint8Array) => {
      out.push(String(c));
      return true;
    });
    const w2 = vi.spyOn(process.stderr, "write").mockImplementation((c: string | Uint8Array) => {
      out.push(String(c));
      return true;
    });
    try {
      const sess = adminCookie();
      const r = await requestCode(sess);
      expect(r.status).toBe(200);
      expect(sent[0]?.to).toEqual(["yonetici_1@test.local"]);
      expect(sent[0]?.subject).toContain("Yönetici giriş kodu");
      const code = lastCode();
      expect(code).toMatch(/^\d{6}$/);
      const v = await verify(sess, code);
      expect(v.status).toBe(200);
      const adminToken = /glix_admin=([^;]+)/.exec(v.setCookie)?.[1] ?? "";
      expect(adminToken).toHaveLength(43);
      const audit = JSON.stringify(k.srv.accounts.adminAuditTail(50));
      expect(audit).not.toContain(code);
      expect(audit).not.toContain(adminToken);
      expect(out.join("")).not.toContain(code);
      expect(out.join("")).not.toContain(adminToken);
    } finally {
      w1.mockRestore();
      w2.mockRestore();
    }
  });

  it("doğru kod: HttpOnly + SameSite=Strict çerez, yolu /api/admin, 12 saat; üç uç açılır", async () => {
    const sess = adminCookie();
    await requestCode(sess);
    const v = await verify(sess, lastCode());
    expect(v.status).toBe(200);
    expect(v.setCookie).toMatch(
      new RegExp(
        `^glix_admin=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}$`,
      ),
    );
    const cookie = `${sess}; ${v.setCookie.split(";")[0]}`;
    expect((await call("GET", "status", cookie)).body).toEqual({ state: "ready" });
    for (const p of DATA) expect((await call("GET", p, cookie)).status).toBe(200);
    // Yalnız yönetici çerezi (hesap oturumu olmadan) işe yaramaz.
    expect((await call("GET", "live", v.setCookie.split(";")[0] ?? "")).status).toBe(401);
    const actions = k.srv.accounts.adminAuditTail(10).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["otp_request", "otp_ok"]));
  });

  it("kod tek kullanımlık", async () => {
    const sess = adminCookie();
    await requestCode(sess);
    const code = lastCode();
    expect((await verify(sess, code)).status).toBe(200);
    const again = await verify(sess, code);
    expect(again.status).toBe(400);
    expect(again.body.code).toBe("expired");
  });

  it("yanlış kod 5 denemede kilitler; doğru kod da artık geçmez, yeni kod istenir", async () => {
    const sess = adminCookie();
    await requestCode(sess);
    const good = lastCode();
    const bad = good === "000000" ? "111111" : "000000";
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) {
      const r = await verify(sess, bad);
      expect(r.status).toBe(400);
      expect(r.body.code).toBe("invalid_code");
    }
    const last = await verify(sess, bad);
    expect(last.status).toBe(429);
    expect(last.body.code).toBe("locked");
    expect((await verify(sess, good)).status).toBe(400);
    expect(k.srv.accounts.adminAuditTail(20).map((a) => a.action)).toContain("otp_locked");
    // Yeni kod istenince yeniden giriş mümkün.
    k.clock.advance(OTP_GAP_MS + 1);
    await requestCode(sess);
    expect((await verify(sess, lastCode())).status).toBe(200);
  });

  it("süresi dolan kod reddedilir", async () => {
    const sess = adminCookie();
    await requestCode(sess);
    k.clock.advance(OTP_TTL_MS + 1);
    const r = await verify(sess, lastCode());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("expired");
    expect(k.srv.accounts.adminAuditTail(5).map((a) => a.action)).toContain("otp_expired");
  });

  it("geçersiz gövde 400; kod isteği hız sınırlı (60 sn)", async () => {
    const sess = adminCookie();
    for (const body of [
      {},
      { code: 123456 },
      { code: "12345" },
      { code: "abcdef" },
      { code: "123456", x: 1 },
    ])
      expect((await call("POST", "otp/verify", sess, { body })).status).toBe(400);
    expect(parseCode({ code: " 123 456 " })).toBe("123456");
    expect((await requestCode(sess)).status).toBe(200);
    const again = await requestCode(sess);
    expect(again.status).toBe(429);
    expect(again.body.code).toBe("too_soon");
    expect(sent).toHaveLength(1);
    k.clock.advance(OTP_GAP_MS + 1);
    expect((await requestCode(sess)).status).toBe(200);
  });

  it("kod, isteyen hesap oturumuna bağlı: başka oturumda doğrulanamaz", async () => {
    const first = adminCookie();
    await requestCode(first);
    const second = loginCookieFor("yonetici_1");
    const r = await verify(second, lastCode());
    expect(r.status).toBe(400);
    expect(r.body.code).toBe("expired");
  });

  it("yönetici çerezi oturuma bağlı: başka oturumda, başka hesapta ve 12 saat sonra geçmez", async () => {
    const first = adminCookie();
    const cookie = await signIn(first);
    const adminPart = cookie.split("; ")[1] ?? "";
    // Aynı hesabın başka oturumu, ilk oturumun yönetici çerezini kullanamaz.
    const second = loginCookieFor("yonetici_1");
    expect((await call("GET", "status", `${second}; ${adminPart}`)).body).toEqual({ state: "need_otp" });
    expect((await call("GET", "live", `${second}; ${adminPart}`)).status).toBe(403);
    // Yönetici olmayan hesap yönetici çerezini taşısa da 404.
    expect((await call("GET", "live", `${otherCookie()}; ${adminPart}`)).status).toBe(404);
    // Süre dolunca.
    expect((await call("GET", "live", cookie)).status).toBe(200);
    k.clock.advance(ADMIN_SESSION_TTL_MS + 1);
    expect((await call("GET", "live", cookie)).status).toBe(403);
  });

  it("hesap oturumu kapanınca yönetici oturumu da düşer; çıkış çerezi siler", async () => {
    const sess = adminCookie();
    const cookie = await signIn(sess);
    const out = await call("POST", "logout", cookie);
    expect(out.status).toBe(200);
    expect(out.setCookie).toMatch(/^glix_admin=; HttpOnly; SameSite=Strict; Path=\/api\/admin; Max-Age=0/);
    expect((await call("GET", "live", cookie)).status).toBe(403);
    k.clock.advance(OTP_GAP_MS + 1);
    const again = await signIn(sess);
    const token = sess.split("=")[1] ?? "";
    k.srv.accounts.deleteSession(hashToken(token));
    expect((await call("GET", "live", again)).status).toBe(401);
  });

  it("e-posta gönderilemezse 502 ve kod saklanmaz", async () => {
    const sess = adminCookie();
    mailOk = false;
    const r = await requestCode(sess);
    expect(r.status).toBe(502);
    expect((await verify(sess, "123456")).body.code).toBe("expired");
  });
});

/** Aynı hesap için ikinci bir oturum çerezi. */
function loginCookieFor(username: string): string {
  const acc = k.srv.accounts.findByUsername(username);
  if (!acc) throw new Error("hesap yok");
  const token = `t${Math.random().toString(36).slice(2)}`.padEnd(43, "x");
  k.srv.accounts.createSession(acc.id, hashToken(token), k.clock.now());
  return `glix_sess=${token}`;
}

describe("yönetici paneli: Secure çerez", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, limits: { trustProxy: true } });

  it("vekil https bildirirse Secure eklenir", async () => {
    const sess = adminCookie();
    await call("POST", "otp/request", sess, { headers: { "X-Forwarded-Proto": "https" } });
    const v = await call("POST", "otp/verify", sess, {
      body: { code: lastCode() },
      headers: { "X-Forwarded-Proto": "https" },
    });
    expect(v.setCookie).toMatch(/; Path=\/api\/admin; Max-Age=43200; Secure$/);
  });
});

describe("yönetici paneli: veri uçları ve gizlilik", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch, statsDb: ":memory:" });

  it("üç ucun şekli; oyuncu adı, kullanıcı adı, e-posta ve IP görünmez", async () => {
    const sess = adminCookie();
    const cookie = await signIn(sess);
    // Gerçek bir oda: oyuncu adları ve bir izleyici.
    const host = await create("GizliHostAdi");
    await joinRoom(host.session.roomCode, "GizliOyuncuAdi");
    await sync();
    // İstemci hatası: kişisel parçalar temizlenir.
    await fetch(`${base()}/api/client-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base() },
      body: JSON.stringify({
        message: "Hata ali@example.com https://glix.test/oda?token=SIRRIN",
        stack: "TypeError: x\n    at kaynak (https://glix.test/assets/index-ab12.js?v=3:10:20)",
        version: "0.1.0",
        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Version/17.0 Mobile Safari/604.1",
      }),
    });

    const live = (await call("GET", "live", cookie)).body as Record<string, unknown>;
    expect(live).toMatchObject({
      rooms: 1,
      players: 2,
      activeMatches: 0,
      stages: 0,
      sockets: { total: 2, guests: 1, accounts: 1 },
      draining: false,
      revision: "t",
    });
    for (const key of [
      "memory",
      "cpuPercent",
      "eventLoopLagMsP95",
      "tickMsP95",
      "bytesOutPerSec",
      "uptimeSec",
      "startedAt",
      "version",
    ])
      expect(live).toHaveProperty(key);
    const rooms = live.roomList as Record<string, unknown>[];
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      code: host.session.roomCode,
      phase: "lobby",
      players: 2,
      spectators: 0,
      gameId: null,
    });
    expect(Object.keys(rooms[0] ?? {}).sort()).toEqual(
      ["ageSec", "code", "connected", "gameId", "phase", "players", "spectators", "stages"].sort(),
    );

    const stats = (await call("GET", "stats", cookie)).body as Record<string, unknown>;
    expect(stats).toMatchObject({ enabled: true, windowDays: 90 });
    expect(stats.daily).toHaveLength(30);
    expect(stats.weekly).toHaveLength(8);
    expect(stats.accounts).toMatchObject({
      total: 2,
      verified: 0,
      google: 0,
      password: 2,
      friendships: 0,
      badgesAwarded: 0,
    });
    expect((stats.accounts as { newPerDay: unknown[] }).newPerDay).toHaveLength(30);
    expect(stats.feedback).toMatchObject({ count: 0, avg: null, byRating: [0, 0, 0, 0, 0], latest: [] });

    const errors = (await call("GET", "errors", cookie)).body as {
      groups: { message: string; frame: string; count: number; platforms: Record<string, number> }[];
      perDay: unknown[];
      perf: unknown[];
      failures: unknown[];
    };
    expect(errors.perDay).toHaveLength(14);
    expect(errors.groups).toHaveLength(1);
    expect(errors.groups[0]).toMatchObject({
      message: "Hata [e-posta] https://glix.test/oda",
      frame: "kaynak index-ab12.js:10:20",
      count: 1,
      platforms: { ios: 1, android: 0, diger: 0 },
    });

    const all = JSON.stringify([live, stats, errors]);
    for (const secret of [
      "GizliHostAdi",
      "GizliOyuncuAdi",
      "yonetici_1",
      "test.local",
      "127.0.0.1",
      "SIRRIN",
      "ali@example.com",
    ])
      expect(all).not.toContain(secret);
  });
});

describe("yönetici paneli: istatistik kapalı", () => {
  useServer({ adminAccountIds: ADMIN, mail: MAIL, mailFetch });

  it("statsDb yokken stats/errors enabled:false ve boş listeler", async () => {
    const cookie = await signIn(adminCookie());
    const stats = (await call("GET", "stats", cookie)).body as {
      enabled: boolean;
      daily: unknown[];
      accounts: { total: number };
    };
    expect(stats.enabled).toBe(false);
    expect(stats.daily).toEqual([]);
    expect(stats.accounts.total).toBe(1);
    expect(((await call("GET", "errors", cookie)).body as { groups: unknown[] }).groups).toEqual([]);
  });
});

describe("yönetici paneli: e-posta kapalı", () => {
  useServer({ adminAccountIds: ADMIN });
  it("kod gönderilemez: 503", async () => {
    const r = await requestCode(adminCookie());
    expect(r.status).toBe(503);
    expect(r.body.code).toBe("mail_disabled");
  });
});

describe("GLIX_ADMIN_ACCOUNT_IDS", () => {
  it("virgülle ayrılmış pozitif tamsayılar; boş = kapalı; bozuk değer hata", () => {
    expect([...loadAdminIds({})]).toEqual([]);
    expect([...loadAdminIds({ GLIX_ADMIN_ACCOUNT_IDS: "" })]).toEqual([]);
    expect([...loadAdminIds({ GLIX_ADMIN_ACCOUNT_IDS: " 3, 12 ,3," })]).toEqual([3, 12]);
    for (const bad of ["abc", "0", "-1", "1.5", "1;2", "99999999999"])
      expect(() => loadAdminIds({ GLIX_ADMIN_ACCOUNT_IDS: bad })).toThrow("GLIX_ADMIN_ACCOUNT_IDS");
  });
});
