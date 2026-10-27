import { afterEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "./auth.js";
import { safeReturnTo } from "./google.js";
import { k, useServer } from "./testkit.js";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const CONFIG = {
  clientId: CLIENT_ID,
  clientSecret: "test-secret",
  redirectUri: "https://glix.example/api/auth/google/callback",
};

const base = () => `http://127.0.0.1:${k.srv.port}`;
const realFetch = globalThis.fetch;

interface Hop {
  status: number;
  location: string;
  cookies: string[];
}

async function get(path: string, cookie?: string): Promise<Hop> {
  const res = await realFetch(`${base()}${path}`, {
    redirect: "manual",
    ...(cookie ? { headers: { Cookie: cookie } } : {}),
  });
  return {
    status: res.status,
    location: res.headers.get("location") ?? "",
    cookies: res.headers.getSetCookie(),
  };
}

async function post(
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown>; cookie: string }> {
  const res = await realFetch(`${base()}/api/auth/${path}`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "",
  };
}

async function me(cookie: string): Promise<Record<string, unknown>> {
  const res = await realFetch(`${base()}/api/auth/me`, { headers: { Cookie: cookie } });
  return (await res.json()) as Record<string, unknown>;
}

const cookiePair = (h: Hop, name: string): string =>
  (h.cookies.find((c) => c.startsWith(`${name}=`)) ?? "").split(";")[0] ?? "";

/** Akışı başlatır: çerez ve Google'a giden state/nonce çıkarılır. */
async function start(sessionCookie?: string) {
  const hop = await get("/api/auth/google/start", sessionCookie);
  const url = new URL(hop.location);
  return {
    hop,
    url,
    oauth: cookiePair(hop, "glix_oauth"),
    state: url.searchParams.get("state") ?? "",
    nonce: url.searchParams.get("nonce") ?? "",
  };
}

interface Claims {
  iss: unknown;
  aud: unknown;
  exp: unknown;
  nonce: unknown;
  sub: unknown;
  email: unknown;
  email_verified: unknown;
}

let tokenCalls: URLSearchParams[] = [];

/** Google'ın belirteç uç noktasını taklit eder; diğer istekler gerçek fetch'e gider. */
function mockGoogle(claims: (nonce: string) => Partial<Claims>, nonce: string, status = 200): void {
  tokenCalls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url !== "https://oauth2.googleapis.com/token") return realFetch(input, init);
    tokenCalls.push(new URLSearchParams(String(init?.body ?? "")));
    const payload: Claims = {
      iss: "https://accounts.google.com",
      aud: CLIENT_ID,
      exp: Math.floor(k.clock.now() / 1000) + 3600,
      nonce,
      sub: "sub-1",
      email: "Kisi.Adi@Gmail.com",
      email_verified: true,
      ...claims(nonce),
    };
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const idToken = `${part({ alg: "RS256" })}.${part(payload)}.imza`;
    return new Response(JSON.stringify({ id_token: idToken }), { status });
  });
}

/** Başlat → (Google) → geri dön. */
async function login(claims: (nonce: string) => Partial<Claims> = () => ({}), sessionCookie?: string) {
  const s = await start(sessionCookie);
  mockGoogle(claims, s.nonce);
  const cookie = [s.oauth, sessionCookie].filter(Boolean).join("; ");
  const hop = await get(`/api/auth/google/callback?state=${s.state}&code=abc`, cookie);
  return { s, hop };
}

const hash = (h: Hop): URLSearchParams => new URLSearchParams(new URL(h.location, base()).hash.slice(1));

afterEach(() => vi.restoreAllMocks());

describe("Google ile giriş", () => {
  useServer({ google: CONFIG });

  it("start: PKCE S256, state, nonce ile Google'a yönlendirir ve kısa ömürlü çerez koyar", async () => {
    const s = await start();
    expect(s.hop.status).toBe(302);
    expect(s.url.origin + s.url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = s.url.searchParams;
    expect(q.get("client_id")).toBe(CLIENT_ID);
    expect(q.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(q.get("response_type")).toBe("code");
    expect(q.get("scope")).toBe("openid email");
    expect(q.get("prompt")).toBe("select_account");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(q.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(q.get("nonce")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const raw = s.hop.cookies.find((c) => c.startsWith("glix_oauth=")) ?? "";
    expect(raw).toMatch(/HttpOnly/);
    expect(raw).toMatch(/SameSite=Lax/);
    expect(raw).toMatch(/Max-Age=600/);
    expect(raw).not.toMatch(/Secure/);
    // Çerez yalnız opak başvuru taşır: state/nonce içermez.
    expect(raw).not.toContain(q.get("state") ?? "x");
  });

  it("me: Google açık olduğunu bildirir", async () => {
    const r = await realFetch(`${base()}/api/auth/me`);
    const body = (await r.json()) as { providers: { google: boolean }; linked: { google: boolean } };
    expect(body.providers.google).toBe(true);
    expect(body.linked.google).toBe(false);
  });

  it("yeni kullanıcı: bekleyen kayıt → kullanıcı adı seçince hesap ve oturum", async () => {
    const { hop } = await login();
    expect(hop.status).toBe(302);
    expect(hop.cookies.some((c) => c.startsWith("glix_oauth=;"))).toBe(true);
    expect(cookiePair(hop, "glix_sess")).toBe("");
    const h = hash(hop);
    expect(h.get("u")).toBe("kisi_adi");
    const token = h.get("google-yeni") ?? "";
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect((await post("google/complete", { token, username: "ab" })).status).toBe(400);
    const done = await post("google/complete", { token, username: "Kisi_1" });
    expect(done.status).toBe(200);
    expect(done.body.account).toEqual({ username: "Kisi_1", email: "kisi.adi@gmail.com" });
    expect(done.cookie).toMatch(/^glix_sess=/);
    const who = await me(done.cookie);
    expect(who.account).toEqual({ username: "Kisi_1", email: "kisi.adi@gmail.com" });
    expect(who.linked).toEqual({ google: true, password: false });
    // Şifresiz hesap: parola ile giriş genel hatayla reddedilir.
    const pw = await post("login", { login: "kisi_1", password: "herhangi-bir-sey" });
    expect(pw.status).toBe(401);
    expect(pw.body.code).toBe("bad_credentials");
    // Belirteç tek kullanımlık.
    expect((await post("google/complete", { token, username: "Baska_1" })).status).toBe(410);
  });

  it("complete: alınmış kullanıcı adında belirteç korunur, bilinmeyen belirteç reddedilir", async () => {
    k.srv.accounts.create("Dolu_1", "dolu@example.com", "x", k.clock.now());
    const token = hash((await login()).hop).get("google-yeni") ?? "";
    const taken = await post("google/complete", { token, username: "dolu_1" });
    expect(taken.status).toBe(409);
    expect(taken.body.code).toBe("username_taken");
    expect((await post("google/complete", { token, username: "Serbest_1" })).status).toBe(200);
    const bogus = await post("google/complete", { token: "A".repeat(43), username: "Serbest_2" });
    expect(bogus.status).toBe(410);
  });

  it("belirteç değişimi: code_verifier ve client_secret_post gönderilir", async () => {
    await login();
    expect(tokenCalls).toHaveLength(1);
    const f = tokenCalls[0];
    expect(f?.get("grant_type")).toBe("authorization_code");
    expect(f?.get("client_id")).toBe(CLIENT_ID);
    expect(f?.get("client_secret")).toBe("test-secret");
    expect(f?.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(f?.get("code")).toBe("abc");
    expect(f?.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("bekleyen kayıt 10 dk sonra düşer", async () => {
    const token = hash((await login()).hop).get("google-yeni") ?? "";
    k.clock.advance(10 * 60 * 1000 + 1);
    expect((await post("google/complete", { token, username: "Gec_1" })).status).toBe(410);
  });

  it("bilinen google_sub: doğrudan oturum açar, hesap yeniden oluşmaz", async () => {
    const first = await login();
    const token = hash(first.hop).get("google-yeni") ?? "";
    await post("google/complete", { token, username: "Kisi_1" });
    const again = await login();
    expect(again.hop.status).toBe(302);
    expect(again.hop.location).toBe("/");
    const sess = cookiePair(again.hop, "glix_sess");
    expect(sess).toMatch(/^glix_sess=[A-Za-z0-9_-]{43}$/);
    expect((await me(sess)).account).toEqual({ username: "Kisi_1", email: "kisi.adi@gmail.com" });
  });

  it("açık oturumlu kullanıcıda Google hesabı bağlanır; sonra Google ile girilir", async () => {
    const acc = k.srv.accounts.create("Ali_01", "ali@example.com", "x", k.clock.now());
    if (!acc.ok) throw new Error("hesap açılamadı");
    const token = "T".repeat(43);
    k.srv.accounts.createSession(acc.account.id, hashToken(token), k.clock.now());
    const sess = `glix_sess=${token}`;
    const { hop } = await login(() => ({ sub: "sub-ali", email: "baska@gmail.com" }), sess);
    expect(hop.location).toBe("/");
    expect((await me(sess)).linked).toEqual({ google: true, password: true });
    expect(k.srv.accounts.findByGoogleSub("sub-ali")?.username).toBe("Ali_01");
    const next = await login(() => ({ sub: "sub-ali" }));
    expect(cookiePair(next.hop, "glix_sess")).toMatch(/^glix_sess=/);
  });

  it("e-posta çakışması: otomatik birleştirme yok, hata kodu döner", async () => {
    k.srv.accounts.create("Ali_01", "kisi.adi@gmail.com", "x", k.clock.now());
    const { hop } = await login();
    expect(hash(hop).get("google-hata")).toBe("eposta_kayitli");
    expect(cookiePair(hop, "glix_sess")).toBe("");
    expect(k.srv.accounts.findByGoogleSub("sub-1")).toBeNull();
  });

  it("başka hesaba bağlı Google kimliği, açık oturumlu farklı hesaba bağlanmaz", async () => {
    const a = k.srv.accounts.create("A_1", "a@example.com", "x", k.clock.now());
    const b = k.srv.accounts.create("B_1", "b@example.com", "x", k.clock.now());
    if (!a.ok || !b.ok) throw new Error("hesap açılamadı");
    k.srv.accounts.linkGoogle(a.account.id, "sub-1");
    const token = "U".repeat(43);
    k.srv.accounts.createSession(b.account.id, hashToken(token), k.clock.now());
    const { hop } = await login(() => ({}), `glix_sess=${token}`);
    expect(hash(hop).get("google-hata")).toBe("baska_hesap");
  });

  describe("geçersiz yanıtlar reddedilir", () => {
    const cases: [string, (n: string) => Partial<Claims>, string][] = [
      ["yanlış aud", () => ({ aud: "baska-istemci" }), "dogrulanamadi"],
      ["yanlış iss", () => ({ iss: "https://evil.example" }), "dogrulanamadi"],
      ["süresi dolmuş", () => ({ exp: Math.floor(k.clock.now() / 1000) - 1 }), "dogrulanamadi"],
      ["nonce uyuşmuyor", () => ({ nonce: "x".repeat(43) }), "dogrulanamadi"],
      ["e-posta doğrulanmamış", () => ({ email_verified: false }), "eposta_dogrulanmamis"],
      ["sub yok", () => ({ sub: undefined }), "dogrulanamadi"],
      ["e-posta bozuk", () => ({ email: 5 }), "dogrulanamadi"],
    ];
    for (const [name, claims, code] of cases) {
      it(name, async () => {
        const { hop } = await login(claims);
        expect(hash(hop).get("google-hata")).toBe(code);
        expect(hash(hop).get("google-yeni")).toBeNull();
        expect(cookiePair(hop, "glix_sess")).toBe("");
      });
    }

    it("accounts.google.com (şemasız) yayıncısı kabul edilir", async () => {
      const { hop } = await login(() => ({ iss: "accounts.google.com" }));
      expect(hash(hop).get("google-yeni")).not.toBeNull();
    });

    it("belirteç ucu hata dönerse", async () => {
      const s = await start();
      mockGoogle(() => ({}), s.nonce, 400);
      const hop = await get(`/api/auth/google/callback?state=${s.state}&code=abc`, s.oauth);
      expect(hash(hop).get("google-hata")).toBe("dogrulanamadi");
    });

    it("yanlış state, çerezsiz ya da yeniden kullanılmış akış", async () => {
      const s = await start();
      mockGoogle(() => ({}), s.nonce);
      const badState = await get(`/api/auth/google/callback?state=${"z".repeat(43)}&code=abc`, s.oauth);
      expect(hash(badState).get("google-hata")).toBe("gecersiz");
      // Başarısız denemeden sonra akış tüketilmiştir.
      const reuse = await get(`/api/auth/google/callback?state=${s.state}&code=abc`, s.oauth);
      expect(hash(reuse).get("google-hata")).toBe("gecersiz");
      const s2 = await start();
      const noCookie = await get(`/api/auth/google/callback?state=${s2.state}&code=abc`);
      expect(hash(noCookie).get("google-hata")).toBe("gecersiz");
      expect(tokenCalls).toHaveLength(0);
    });

    it("akış 10 dk sonra düşer; kullanıcı vazgeçerse iptal kodu", async () => {
      const s = await start();
      k.clock.advance(10 * 60 * 1000 + 1);
      const late = await get(`/api/auth/google/callback?state=${s.state}&code=abc`, s.oauth);
      expect(hash(late).get("google-hata")).toBe("gecersiz");
      const s2 = await start();
      const denied = await get(`/api/auth/google/callback?state=${s2.state}&error=access_denied`, s2.oauth);
      expect(hash(denied).get("google-hata")).toBe("iptal");
    });
  });

  it("returnTo yalnız aynı kaynaktaki yol olabilir; başarılı girişte oraya dönülür", async () => {
    for (const [given, want] of [
      ["/ayarlar", "/ayarlar"],
      ["//evil.example", "/"],
      ["https://evil.example", "/"],
      ["/\\evil", "/"],
      ["/api/auth/me", "/"],
      [null, "/"],
    ] as const) {
      expect(safeReturnTo(given)).toBe(want);
    }
    const acc = k.srv.accounts.createGoogle("Kisi_1", "kisi.adi@gmail.com", "sub-1", k.clock.now());
    expect(acc.ok).toBe(true);
    const hop = await get("/api/auth/google/start?returnTo=%2Fayarlar");
    const url = new URL(hop.location);
    mockGoogle(() => ({}), url.searchParams.get("nonce") ?? "");
    const back = await get(
      `/api/auth/google/callback?state=${url.searchParams.get("state")}&code=abc`,
      cookiePair(hop, "glix_oauth"),
    );
    expect(back.location).toBe("/ayarlar");
  });

  it("uçlar hız sınırlıdır", async () => {
    let last = "";
    for (let i = 0; i < 25; i++) last = (await get("/api/auth/google/start")).location;
    expect(last).toBe("/#google-hata=cok_deneme");
  });

  it("POST ile start/callback ve Origin'siz complete reddedilir", async () => {
    const bad = await realFetch(`${base()}/api/auth/google/start`, { method: "POST" });
    expect(bad.status).toBe(405);
    const noOrigin = await realFetch(`${base()}/api/auth/google/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(noOrigin.status).toBe(403);
  });
});

describe("Google ile giriş kapalıyken", () => {
  useServer();

  it("start ve callback hata koduyla döner, complete 404, me kapalı bildirir", async () => {
    expect((await get("/api/auth/google/start")).location).toBe("/#google-hata=kapali");
    expect((await get("/api/auth/google/callback?state=a&code=b")).location).toBe("/#google-hata=kapali");
    expect((await post("google/complete", { token: "A".repeat(43), username: "Abc" })).status).toBe(404);
    const body = (await (await realFetch(`${base()}/api/auth/me`)).json()) as {
      providers: { google: boolean };
    };
    expect(body.providers.google).toBe(false);
  });
});

describe("Google ayarı", () => {
  it("kimlik ve sır birlikte; genel adres gerekli; yoksa kapalı", async () => {
    const { loadGoogle } = await import("./config.js");
    expect(loadGoogle({})).toBeNull();
    expect(() => loadGoogle({ GLIX_GOOGLE_CLIENT_ID: "a" })).toThrow();
    expect(() => loadGoogle({ GLIX_GOOGLE_CLIENT_ID: "a", GLIX_GOOGLE_CLIENT_SECRET: "b" })).toThrow();
    expect(
      loadGoogle({
        GLIX_GOOGLE_CLIENT_ID: "a",
        GLIX_GOOGLE_CLIENT_SECRET: "b",
        GLIX_PUBLIC_URL: "https://glix.dgmcraft.online/",
      }),
    ).toEqual({
      clientId: "a",
      clientSecret: "b",
      redirectUri: "https://glix.dgmcraft.online/api/auth/google/callback",
    });
  });
});
