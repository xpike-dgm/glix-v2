/** Yönetici paneli testleri için ortak yardımcılar (HTTP çağrısı, kod ile giriş). Üretim kodunda kullanılmaz. */
import { createHash, randomBytes } from "node:crypto";
import { expect, vi } from "vitest";
import { k, loginCookie } from "./testkit.js";

export const ADMIN = new Set([1]);
export const MAIL = {
  apiKey: "re_test",
  from: "GLIX <noreply@glix.example>",
  publicUrl: "https://glix.example",
};
export const base = (): string => `http://127.0.0.1:${k.srv.port}`;

export interface Reply<T = Record<string, unknown>> {
  status: number;
  body: T & { ok?: boolean; code?: string; message?: string };
}

/** Giden e-postaları toplar; son koddan giriş yapılır. */
export function createAdminKit() {
  const sent: { to: string[]; text: string }[] = [];
  const mailFetch = vi.fn(async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body) as (typeof sent)[number]);
    return { status: 200 };
  });
  const lastCode = (): string => /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? "")?.[1] ?? "";

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
    const text = await res.text();
    let body: unknown = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = {};
    }
    return { status: res.status, body: body as Reply<T>["body"] };
  }

  /** Hesap yoksa açar; varsa yeni bir oturum açar (yeniden başlatma sonrası girişler için). */
  function sessionFor(username: string): string {
    const found = k.srv.accounts.findByUsername(username);
    if (!found) return loginCookie(username);
    const token = randomBytes(32).toString("base64url");
    k.srv.accounts.createSession(found.id, createHash("sha256").update(token).digest("hex"), k.clock.now());
    return `glix_sess=${token}`;
  }

  /** İlk açılan hesap kimlik 1 alır ve yöneticidir; kod isteyip doğrular, iki çerezi birleştirir. */
  async function adminLogin(username = "yonetici_1"): Promise<string> {
    const sess = sessionFor(username);
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

  return {
    sent,
    mailFetch,
    call,
    adminLogin,
    get: <T = Record<string, unknown>>(path: string, cookie: string | null) => call<T>("GET", path, cookie),
    post: (path: string, cookie: string | null, body?: unknown) => call("POST", path, cookie, { body }),
  };
}
