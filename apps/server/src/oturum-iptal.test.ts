import { describe, expect, it, vi } from "vitest";
import { Client, k, until, useServer } from "./testkit.js";

const MAIL = { apiKey: "re_test", from: "GLIX <noreply@glix.example>", publicUrl: "https://glix.example" };
const outbox: string[] = [];
const mailFetch = vi.fn(async (_url: string, init: { body: string }) => {
  outbox.push((JSON.parse(init.body) as { text: string }).text);
  return { status: 200 };
});
const base = () => `http://127.0.0.1:${k.srv.port}`;

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${base()}/api/auth/${path}`, {
    method: "POST",
    headers: { Origin: base(), "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "" };
}

/** Hesap açar; açık oturumla bir odaya girmiş canlı soketi döner. */
async function signedInSocket(cookie: string): Promise<Client> {
  const c = await Client.connect(cookie);
  c.send({ type: "createRoom", nickname: "x" });
  await until(() => c.updates.length > 0, "oda kuruldu");
  return c;
}

const status = (username: string): string => {
  const acc = k.srv.accounts.findByUsername(username);
  if (!acc) throw new Error("hesap yok");
  return k.srv.runtime.social.presence(acc.id).status;
};
const playerAccount = (c: Client): number | null =>
  c.session && (k.srv.runtime.tokens.get(c.session.token)?.accountId ?? null);

describe("iptal edilen oturumun canlı soketi", () => {
  useServer({ mail: MAIL, mailFetch });
  const register = () =>
    post("register", { username: "Ali_01", email: "ali@example.com", password: "gizli-sifre" });

  it("çıkış yapınca o oturumun soketi misafire döner (diğer oturum kalır)", async () => {
    const a = await register();
    const b = await post("login", { login: "Ali_01", password: "gizli-sifre" });
    const sa = await signedInSocket(a.cookie);
    const sb = await signedInSocket(b.cookie);
    expect(status("Ali_01")).not.toBe("offline");
    await post("logout", {}, a.cookie);
    expect(playerAccount(sa)).toBeNull();
    expect(playerAccount(sb)).not.toBeNull();
  });

  it("şifre değişince diğer oturumların soketi düşer, değiştirenin kalır", async () => {
    const a = await register();
    const b = await post("login", { login: "Ali_01", password: "gizli-sifre" });
    const sa = await signedInSocket(a.cookie);
    const sb = await signedInSocket(b.cookie);
    const r = await post("password", { current: "gizli-sifre", password: "yeni-sifre-1" }, b.cookie);
    expect(r.status).toBe(200);
    expect(playerAccount(sa)).toBeNull();
    expect(playerAccount(sb)).not.toBeNull();
  });

  it("şifre sıfırlanınca tüm canlı soketler düşer", async () => {
    outbox.length = 0;
    const a = await register();
    const sa = await signedInSocket(a.cookie);
    await post("reset/request", { email: "ali@example.com" });
    await vi.waitFor(() => expect(outbox.length).toBeGreaterThan(0));
    const token = /sifre-sifirla=([A-Za-z0-9_-]{43})/.exec(outbox.at(-1) ?? "")?.[1] ?? "";
    expect((await post("reset/confirm", { token, password: "yepyeni-sifre" })).status).toBe(200);
    expect(playerAccount(sa)).toBeNull();
    expect(status("Ali_01")).toBe("offline");
  });
});

describe("giriş denemesi sınırı", () => {
  useServer();

  it("kullanıcı adıyla biriken hatalı denemeler e-postayla girişi de kilitler", async () => {
    await post("register", { username: "Veli_01", email: "veli@example.com", password: "dogru-sifre" });
    for (let i = 0; i < 8; i++)
      expect((await post("login", { login: "Veli_01", password: "yanlis-sifre" })).status).toBe(401);
    // Aynı hesap, farklı yazım: sınır hesap başınadır, yazım başına değil.
    expect((await post("login", { login: "veli@example.com", password: "dogru-sifre" })).status).toBe(429);
    expect((await post("login", { login: "VELI_01", password: "dogru-sifre" })).status).toBe(429);
  });
});
