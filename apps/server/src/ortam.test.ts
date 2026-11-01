import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

import { WebSocket } from "ws";
import { type AiFetch, createAiText } from "./aiComment.js";
import { createManualClock } from "./clock.js";
import { loadConfig } from "./config.js";
import {
  ORTAM_AI_PER_DAY,
  ORTAM_ROBOTS,
  ORTAM_SERIT_METNI,
  type Ortam,
  ortamSeridi,
  parseOrtam,
  seritEkle,
} from "./ortam.js";
import { type RunningServer, type ServerOptions, startServer } from "./server.js";
import type { PushGateway } from "./webpush.js";

const INDEX =
  '<!doctype html><html><head><title>GLIX</title></head><body>\n<div id="root"></div></body></html>';

const DIS_ENV = {
  GLIX_RESEND_API_KEY: "re_test",
  GLIX_MAIL_FROM: "GLIX <noreply@ornek.com>",
  GLIX_PUBLIC_URL: "https://glix.ornek.com",
  GLIX_VAPID_PUBLIC: "pub",
  GLIX_VAPID_PRIVATE: "priv",
  GLIX_VAPID_SUBJECT: "mailto:a@ornek.com",
  GLIX_GOOGLE_CLIENT_ID: "id",
  GLIX_GOOGLE_CLIENT_SECRET: "sir",
};

describe("ortam bayrağı (yapılandırma)", () => {
  it("boş ya da canli = canlı; tanınmayan değer açılışı durdurur", () => {
    expect(parseOrtam(undefined)).toBe("canli");
    expect(parseOrtam("")).toBe("canli");
    expect(parseOrtam("canli")).toBe("canli");
    expect(parseOrtam("test")).toBe("test");
    expect(parseOrtam(" test2 ")).toBe("test2");
    expect(() => parseOrtam("tset")).toThrow();
    expect(() => parseOrtam("TEST")).toThrow();
    expect(() => loadConfig({ GLIX_ORTAM: "prod" })).toThrow();
  });

  it("canlıda e-posta, bildirim ve Google ayarları eskisi gibi okunur", () => {
    const c = loadConfig({ ...DIS_ENV });
    expect(c.ortam).toBe("canli");
    expect(c.mail).not.toBeNull();
    expect(c.vapid).not.toBeNull();
    expect(c.google).not.toBeNull();
    expect(loadConfig({ ...DIS_ENV, GLIX_ORTAM: "canli" })).toEqual(c);
  });

  it.each(["test", "test2"] as const)("%s: anahtar verilse bile e-posta, bildirim ve Google kapalı", (o) => {
    const c = loadConfig({ ...DIS_ENV, GLIX_ORTAM: o });
    expect(c.ortam).toBe(o);
    expect(c.mail).toBeNull();
    expect(c.vapid).toBeNull();
    expect(c.google).toBeNull();
  });
});

describe("ortam şeridi", () => {
  it("canlıda yok; test ve oyun alanında sade metin", () => {
    expect(ortamSeridi("canli")).toBeNull();
    expect(ortamSeridi(undefined)).toBeNull();
    expect(ortamSeridi("test")).toContain(">TEST</div>");
    expect(ortamSeridi("test2")).toContain(">OYUN ALANI</div>");
    expect(ortamSeridi("test")).not.toMatch(/<script/i);
  });
  it("body açılışının ardına eklenir; body yoksa sayfa değişmez", () => {
    expect(seritEkle('<body class="a"><p>', "<i>x</i>")).toBe('<body class="a"><i>x</i><p>');
    expect(seritEkle("<p>yok</p>", "<i>x</i>")).toBe("<p>yok</p>");
  });
});

/** Mail ve bildirim açık bir canlı yapılandırması (sahte gönderici ve sahte e-posta servisi). */
function disariAcikSecenekler(dir: string, mailCalls: string[]): ServerOptions {
  const push: PushGateway = { enabled: true, publicKey: "SAHTE-ANAHTAR", send: () => Promise.resolve("ok") };
  return {
    host: "127.0.0.1",
    port: 0,
    clientDir: dir,
    revision: "ortamrev",
    allowedOrigins: null,
    push,
    mail: { apiKey: "re_test", from: "GLIX <noreply@ornek.com>", publicUrl: "https://glix.ornek.com" },
    mailFetch: (url) => {
      mailCalls.push(url);
      return Promise.resolve({ status: 200 });
    },
  };
}

function welcome(port: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on("open", () => ws.send(JSON.stringify({ type: "hello", clientVersion: "0.1.0" })));
    ws.on("message", (d) => {
      const msg = JSON.parse(d.toString()) as Record<string, unknown>;
      if (msg.type !== "welcome") return;
      resolve(msg);
      ws.close();
    });
    ws.on("error", reject);
  });
}

describe("ortam bayrağı (sunucu)", () => {
  const servers = new Map<Ortam | "yok", RunningServer>();
  const mailCalls = new Map<Ortam | "yok", string[]>();
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "glix-ortam-"));
    writeFileSync(join(dir, "index.html"), INDEX);
    for (const o of ["yok", "canli", "test", "test2"] as const) {
      const calls: string[] = [];
      mailCalls.set(o, calls);
      const opts = disariAcikSecenekler(dir, calls);
      servers.set(o, await startServer(o === "yok" ? opts : { ...opts, ortam: o }));
    }
  });
  afterAll(async () => {
    for (const s of servers.values()) await s.close();
  });
  const url = (o: Ortam | "yok", p: string): string => `http://127.0.0.1:${servers.get(o)?.port}${p}`;
  const kayit = async (o: Ortam | "yok"): Promise<number> =>
    (
      await fetch(url(o, "/api/auth/register"), {
        method: "POST",
        headers: { "content-type": "application/json", origin: `http://127.0.0.1:${servers.get(o)?.port}` },
        body: JSON.stringify({
          username: `ortam_${o}`,
          email: `ortam_${o}@ornek.com`,
          password: "parola-123",
        }),
      })
    ).status;

  it.each(["yok", "canli"] as const)("canlı (%s): sayfa birebir, noindex yok, robots.txt yok", async (o) => {
    for (const p of ["/", "/oda/ABCD", "/index.html"]) {
      const res = await fetch(url(o, p));
      expect(res.headers.get("x-robots-tag")).toBeNull();
      expect(await res.text()).toBe(INDEX);
    }
    expect((await fetch(url(o, "/robots.txt"))).status).toBe(404);
    const health = (await (await fetch(url(o, "/health"))).json()) as Record<string, unknown>;
    expect(health).not.toHaveProperty("ortam");
    expect((await fetch(url(o, "/health"))).headers.get("x-robots-tag")).toBeNull();
  });

  it("canlı: e-posta ve bildirim açık kalır", async () => {
    for (const o of ["yok", "canli"] as const) {
      const me = (await (await fetch(url(o, "/api/auth/me"))).json()) as { providers: { mail: boolean } };
      expect(me.providers.mail).toBe(true);
      expect((await welcome(servers.get(o)?.port ?? 0)).pushKey).toBe("SAHTE-ANAHTAR");
      await kayit(o);
      for (let i = 0; i < 100 && (mailCalls.get(o)?.length ?? 0) === 0; i += 1) await sleep(10);
      expect(mailCalls.get(o)?.length).toBeGreaterThan(0);
    }
  });

  it.each(["test", "test2"] as const)("%s: her yanıt noindex, robots.txt her yolu kapatır", async (o) => {
    for (const p of ["/", "/health", "/api/auth/me", "/yok.js", "/robots.txt"]) {
      expect((await fetch(url(o, p))).headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
    const robots = await fetch(url(o, "/robots.txt"));
    expect(robots.status).toBe(200);
    expect(await robots.text()).toBe(ORTAM_ROBOTS);
    const health = (await (await fetch(url(o, "/health"))).json()) as Record<string, unknown>;
    expect(health.ortam).toBe(o);
  });

  it.each(["test", "test2"] as const)("%s: ana sayfada ortam şeridi, uzunluk doğru", async (o) => {
    for (const p of ["/", "/oda/ABCD", "/index.html"]) {
      const res = await fetch(url(o, p));
      const text = await res.text();
      expect(text).toContain(`>${ORTAM_SERIT_METNI[o]}</div>`);
      expect(text).toContain('<div id="root"></div>');
      expect(Number(res.headers.get("content-length"))).toBe(Buffer.byteLength(text));
      const head = await fetch(url(o, p), { method: "HEAD" });
      expect(head.headers.get("content-length")).toBe(res.headers.get("content-length"));
    }
  });

  it.each(["test", "test2"] as const)("%s: e-posta ve bildirim kapalı (gönderim denenmez)", async (o) => {
    const me = (await (await fetch(url(o, "/api/auth/me"))).json()) as {
      providers: { mail: boolean; google: boolean };
    };
    expect(me.providers).toEqual({ mail: false, google: false });
    expect((await welcome(servers.get(o)?.port ?? 0)).pushKey).toBeUndefined();
    expect(await kayit(o)).toBe(200);
    await sleep(100);
    expect(mailCalls.get(o)).toEqual([]);
  });
});

describe("yapay zekâ günlük sınırı", () => {
  it("perDay dolunca istek gönderilmez; 24 saat sonra açılır", async () => {
    const clock = createManualClock();
    let calls = 0;
    const fetchImpl: AiFetch = () => {
      calls += 1;
      return Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
    };
    const ai = createAiText({ apiKey: "k", clock, fetch: fetchImpl, perMinute: 1000, perDay: 2 });
    const req = { prompt: { system: "s", user: "u" }, maxTokens: 10, parse: () => null, tag: "t" };
    expect(ai.generate(req, () => {})).toBe(true);
    expect(ai.generate(req, () => {})).toBe(true);
    expect(ai.generate(req, () => {})).toBe(false);
    clock.advance(24 * 3600 * 1000);
    expect(ai.generate(req, () => {})).toBe(true);
    await Promise.resolve();
    expect(calls).toBe(3);
  });
  it("perDay verilmezse günlük sınır yok (canlı)", () => {
    const clock = createManualClock();
    const fetchImpl: AiFetch = () => Promise.resolve({ status: 200, json: () => Promise.resolve({}) });
    const ai = createAiText({ apiKey: "k", clock, fetch: fetchImpl, perMinute: 10_000 });
    const req = { prompt: { system: "s", user: "u" }, maxTokens: 10, parse: () => null, tag: "t" };
    let ok = 0;
    for (let i = 0; i < ORTAM_AI_PER_DAY + 50; i += 1) if (ai.generate(req, () => {})) ok += 1;
    expect(ok).toBe(ORTAM_AI_PER_DAY + 50);
  });
});
