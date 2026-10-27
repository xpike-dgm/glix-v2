import { describe, expect, it, vi } from "vitest";
import { hashToken } from "./auth.js";
import { loadMail } from "./config.js";
import { createMailer, MailThrottle, RESEND_URL } from "./mail.js";
import { k, useServer } from "./testkit.js";

const KEY = "re_test_anahtar";
const MAIL = { apiKey: KEY, from: "GLIX <noreply@glix.example>", publicUrl: "https://glix.example" };
const HOUR = 3600 * 1000;

interface Sent {
  url: string;
  headers: Record<string, string>;
  body: { from: string; to: string[]; subject: string; html: string; text: string };
}

const sent: Sent[] = [];
let status = 200;
let boom = false;
const mailFetch = vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
  if (boom) throw new Error("ağ yok");
  sent.push({ url, headers: init.headers, body: JSON.parse(init.body) as Sent["body"] });
  return { status };
});

const base = () => `http://127.0.0.1:${k.srv.port}`;

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "",
  };
}

async function get(path: string, cookie?: string) {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    redirect: "manual",
    ...(cookie ? { headers: { Cookie: cookie } } : {}),
  });
  return { status: res.status, location: res.headers.get("location") ?? "", res };
}

const me = async (cookie: string) =>
  (await (await fetch(`${base()}/api/auth/me`, { headers: { Cookie: cookie } })).json()) as {
    account: { username: string } | null;
    providers: { mail: boolean };
    linked: { password: boolean };
    verified: boolean;
  };

const register = (over: Record<string, unknown> = {}) =>
  post("register", { username: "Ali_01", email: "ali@example.com", password: "gizli-sifre", ...over });

/** Gönderilen son iletiden bağlantıyı çıkarır. */
const lastLink = (): string => /https:\/\/\S+/.exec(sent.at(-1)?.body.text ?? "")?.[0] ?? "";

async function mailed(n: number): Promise<void> {
  await vi.waitFor(() => expect(sent.length).toBe(n));
}

function reset(): void {
  sent.length = 0;
  status = 200;
  boom = false;
  mailFetch.mockClear();
}

describe("e-posta doğrulama", () => {
  reset();
  useServer({ mail: MAIL, mailFetch });
  const fresh = () => reset();

  it("kayıtta Resend'e doğru istek gider; bağlantı doğrular, tek kullanımlıktır", async () => {
    fresh();
    const r = await register();
    expect(r.status).toBe(200);
    await mailed(1);
    const m = sent[0] as Sent;
    expect(m.url).toBe(RESEND_URL);
    expect(m.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(m.headers["Content-Type"]).toBe("application/json");
    expect(m.body.from).toBe(MAIL.from);
    expect(m.body.to).toEqual(["ali@example.com"]);
    expect(m.body.subject).toBe("GLIX — E-postanı doğrula");
    expect(m.body.html).toContain("Bu isteği sen yapmadıysan bu e-postayı yok say.");
    expect(m.body.text).toContain("24 saat");
    expect(m.body.html).not.toMatch(/<img/i);
    const link = lastLink();
    expect(link).toMatch(/^https:\/\/glix\.example\/api\/auth\/verify\?t=[A-Za-z0-9_-]{43}$/);

    expect((await me(r.cookie)).verified).toBe(false);
    const path = link.replace("https://glix.example/api/auth/", "");
    const ok = await get(path);
    expect(ok.status).toBe(302);
    expect(ok.location).toBe("/#eposta=dogrulandi");
    expect((await me(r.cookie)).verified).toBe(true);
    expect((await get(path)).location).toBe("/#eposta=gecersiz");
  });

  it("bilinmeyen ya da bozuk belirteç geçersiz sayılır", async () => {
    fresh();
    expect((await get(`verify?t=${"A".repeat(43)}`)).location).toBe("/#eposta=gecersiz");
    expect((await get("verify?t=kisa")).location).toBe("/#eposta=gecersiz");
    expect((await get("verify")).location).toBe("/#eposta=gecersiz");
  });

  it("24 saat sonra bağlantı geçersiz", async () => {
    fresh();
    const r = await register();
    await mailed(1);
    const path = lastLink().replace("https://glix.example/api/auth/", "");
    k.clock.advance(24 * HOUR + 1000);
    expect((await get(path)).location).toBe("/#eposta=gecersiz");
    expect((await me(r.cookie)).verified).toBe(false);
  });

  it("yeniden gönder: oturum şart, 60 sn'de 1, günde 5", async () => {
    fresh();
    expect((await post("verify/resend", {})).status).toBe(401);
    const r = await register();
    await mailed(1);
    expect((await post("verify/resend", {}, r.cookie)).status).toBe(429);
    for (let i = 2; i <= 5; i++) {
      k.clock.advance(61_000);
      expect((await post("verify/resend", {}, r.cookie)).status).toBe(200);
      await mailed(i);
    }
    // Kayıttaki dahil günde 5 e-posta doldu.
    k.clock.advance(61_000);
    expect((await post("verify/resend", {}, r.cookie)).status).toBe(429);
    k.clock.advance(24 * HOUR);
    expect((await post("verify/resend", {}, r.cookie)).status).toBe(200);
  });

  it("doğrulanmış hesapta yeniden gönderim bir şey yollamaz", async () => {
    fresh();
    const r = await register();
    await mailed(1);
    await get(lastLink().replace("https://glix.example/api/auth/", ""));
    k.clock.advance(61_000);
    const again = await post("verify/resend", {}, r.cookie);
    expect(again.body).toEqual({ ok: true, verified: true });
    expect(sent.length).toBe(1);
  });

  it("e-posta servisi hata verse de kayıt başarılı olur", async () => {
    fresh();
    status = 500;
    const r = await register();
    expect(r.status).toBe(200);
    await vi.waitFor(() => expect(mailFetch).toHaveBeenCalled());
    fresh();
    boom = true;
    const r2 = await register({ username: "Veli_02", email: "veli@example.com" });
    expect(r2.status).toBe(200);
    await vi.waitFor(() => expect(mailFetch).toHaveBeenCalled());
    expect((await me(r2.cookie)).account?.username).toBe("Veli_02");
  });
});

describe("şifre sıfırlama", () => {
  reset();
  useServer({ mail: MAIL, mailFetch });
  const fresh = () => reset();

  async function setup() {
    fresh();
    const r = await register();
    await mailed(1);
    return r;
  }
  const resetLink = (): string => lastLink();
  const resetToken = (): string => resetLink().split("#sifre-sifirla=")[1] ?? "";

  it("bilinmeyen e-posta da ok döner, mail gitmez; bozuk e-posta 400", async () => {
    await setup();
    const r = await post("reset/request", { email: "yok@example.com" });
    expect(r).toMatchObject({ status: 200, body: { ok: true } });
    expect(sent.length).toBe(1);
    expect((await post("reset/request", { email: "x" })).status).toBe(400);
    expect((await post("reset/request", { email: "a@b.co", extra: 1 })).status).toBe(400);
  });

  it("kayıtlı e-postaya bağlantı gider; onaylayınca şifre değişir, eski oturumlar düşer, yeni oturum açılır", async () => {
    const old = await setup();
    const other = await post("login", { login: "ali_01", password: "gizli-sifre" });
    expect((await post("reset/request", { email: "Ali@Example.com" })).body.ok).toBe(true);
    await mailed(2);
    const m = sent[1] as Sent;
    expect(m.body.subject).toBe("GLIX — Şifre sıfırlama");
    expect(m.body.to).toEqual(["ali@example.com"]);
    expect(m.body.text).toContain("1 saat");
    expect(resetLink()).toMatch(/^https:\/\/glix\.example\/#sifre-sifirla=[A-Za-z0-9_-]{43}$/);

    const done = await post("reset/confirm", { token: resetToken(), password: "yepyeni-sifre" });
    expect(done.status).toBe(200);
    expect(done.cookie).toMatch(/^glix_sess=/);
    expect((await me(old.cookie)).account).toBeNull();
    expect((await me(other.cookie)).account).toBeNull();
    const fresh2 = await me(done.cookie);
    expect(fresh2.account?.username).toBe("Ali_01");
    expect(fresh2.verified).toBe(true);
    expect((await post("login", { login: "ali_01", password: "gizli-sifre" })).status).toBe(401);
    expect((await post("login", { login: "ali_01", password: "yepyeni-sifre" })).status).toBe(200);
    // Tek kullanımlık.
    const again = await post("reset/confirm", { token: resetToken(), password: "bir-baska-sifre" });
    expect(again.status).toBe(410);
  });

  it("1 saatten sonra bağlantı geçersiz", async () => {
    await setup();
    await post("reset/request", { email: "ali@example.com" });
    await mailed(2);
    const token = resetToken();
    k.clock.advance(HOUR + 1000);
    const r = await post("reset/confirm", { token, password: "yepyeni-sifre" });
    expect(r).toMatchObject({ status: 410, body: { code: "token_invalid" } });
  });

  it("yeni bağlantı eskisini geçersiz kılar", async () => {
    await setup();
    await post("reset/request", { email: "ali@example.com" });
    await mailed(2);
    const first = resetToken();
    k.clock.advance(61_000);
    await post("reset/request", { email: "ali@example.com" });
    await mailed(3);
    const second = resetToken();
    expect(second).not.toBe(first);
    expect((await post("reset/confirm", { token: first, password: "yepyeni-sifre" })).status).toBe(410);
    expect((await post("reset/confirm", { token: second, password: "yepyeni-sifre" })).status).toBe(200);
  });

  it("aynı adrese dakikada 1; sınırda da yanıt ok (sızıntı yok)", async () => {
    await setup();
    await post("reset/request", { email: "ali@example.com" });
    await mailed(2);
    const r = await post("reset/request", { email: "ali@example.com" });
    expect(r.body.ok).toBe(true);
    expect(sent.length).toBe(2);
  });

  it("geçersiz belirteç ve zayıf şifre reddedilir", async () => {
    await setup();
    expect((await post("reset/confirm", { token: "x", password: "yepyeni-sifre" })).status).toBe(410);
    expect((await post("reset/confirm", { token: "A".repeat(43), password: "kisa" })).status).toBe(400);
    expect((await post("reset/confirm", { token: 5, password: "yepyeni-sifre" })).status).toBe(400);
  });

  it("yalnız Google'lı hesap sıfırlamayla ilk şifresini belirler", async () => {
    fresh();
    const made = k.srv.accounts.createGoogle("Gul_01", "gul@example.com", "sub-1", k.clock.now());
    expect(made.ok).toBe(true);
    await post("reset/request", { email: "gul@example.com" });
    await mailed(1);
    const done = await post("reset/confirm", { token: resetToken(), password: "ilk-sifrem-1" });
    expect(done.status).toBe(200);
    expect((await me(done.cookie)).linked.password).toBe(true);
  });
});

describe("şifre değiştirme", () => {
  reset();
  useServer({ mail: MAIL, mailFetch });

  it("mevcut şifre şart; diğer oturumlar düşer, bu oturum kalır", async () => {
    reset();
    const a = await register();
    const b = await post("login", { login: "ali_01", password: "gizli-sifre" });
    expect(
      (await post("password", { current: "yanlis-sifre", password: "yepyeni-sifre" }, a.cookie)).status,
    ).toBe(401);
    expect((await post("password", { current: "gizli-sifre", password: "kisa" }, a.cookie)).status).toBe(400);
    const ok = await post("password", { current: "gizli-sifre", password: "yepyeni-sifre" }, a.cookie);
    expect(ok.status).toBe(200);
    expect((await me(a.cookie)).account?.username).toBe("Ali_01");
    expect((await me(b.cookie)).account).toBeNull();
    expect((await post("login", { login: "ali_01", password: "yepyeni-sifre" })).status).toBe(200);
  });

  it("oturumsuz 401; şifresiz hesap 409", async () => {
    reset();
    expect((await post("password", { current: "a", password: "yepyeni-sifre" })).status).toBe(401);
    const made = k.srv.accounts.createGoogle("Gul_01", "gul@example.com", "sub-1", k.clock.now());
    if (!made.ok) throw new Error("hesap açılamadı");
    const tok = "G".repeat(43);
    k.srv.accounts.createSession(made.account.id, hashToken(tok), k.clock.now());
    const r = await post(
      "password",
      { current: "x".repeat(8), password: "yepyeni-sifre" },
      `glix_sess=${tok}`,
    );
    expect(r).toMatchObject({ status: 409, body: { code: "no_password" } });
  });
});

describe("e-posta kapalıyken", () => {
  reset();
  useServer();

  it("kayıt çalışır (doğrulanmamış), sıfırlama ve yeniden gönderim kapalı", async () => {
    reset();
    const r = await register();
    expect(r.status).toBe(200);
    const info = await me(r.cookie);
    expect(info.providers.mail).toBe(false);
    expect(info.verified).toBe(false);
    expect(info.linked.password).toBe(true);
    expect((await post("reset/request", { email: "ali@example.com" })).status).toBe(404);
    expect((await post("verify/resend", {}, r.cookie)).status).toBe(404);
    expect(mailFetch).not.toHaveBeenCalled();
  });
});

describe("yardımcılar", () => {
  it("loadMail: anahtar, gönderen ve geçerli genel adres birlikte gerekir", () => {
    const env = {
      GLIX_RESEND_API_KEY: "k",
      GLIX_MAIL_FROM: "GLIX <a@b.co>",
      GLIX_PUBLIC_URL: "https://glix.example/yol",
    };
    expect(loadMail(env)).toEqual({ apiKey: "k", from: "GLIX <a@b.co>", publicUrl: "https://glix.example" });
    expect(loadMail({ ...env, GLIX_RESEND_API_KEY: "" })).toBeNull();
    expect(loadMail({ ...env, GLIX_MAIL_FROM: undefined })).toBeNull();
    expect(loadMail({ ...env, GLIX_PUBLIC_URL: "" })).toBeNull();
  });

  it("createMailer: 2xx başarı, diğerleri ve fırlatma false", async () => {
    const msg = { kind: "verify" as const, to: "a@b.co", subject: "s", html: "h", text: "t" };
    expect(await createMailer(MAIL, async () => ({ status: 200 })).send(msg)).toBe(true);
    expect(await createMailer(MAIL, async () => ({ status: 422 })).send(msg)).toBe(false);
    expect(
      await createMailer(MAIL, async () => {
        throw new Error("x");
      }).send(msg),
    ).toBe(false);
  });

  it("MailThrottle: aralık ve günlük sınır", () => {
    const t = new MailThrottle();
    expect(t.allow("a", 0, 1000, 2)).toBe(true);
    expect(t.allow("a", 500, 1000, 2)).toBe(false);
    expect(t.allow("a", 1500, 1000, 2)).toBe(true);
    expect(t.allow("a", 3000, 1000, 2)).toBe(false);
    expect(t.allow("a", 24 * HOUR + 1600, 1000, 2)).toBe(true);
    expect(t.allow("b", 0, 1000, 2)).toBe(true);
  });
});
