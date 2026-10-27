import { request } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { k, useServer } from "./testkit.js";

const ORIGIN = "https://glix.test";
useServer({ allowedOrigins: [ORIGIN] });

let out: string[] = [];
beforeEach(() => {
  out = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
    out.push(String(chunk));
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const good = {
  message: "boom",
  stack: "Error: boom\n at x",
  url: "/oda/ABCDE",
  version: "0.1.0",
  ua: "Mozilla/5.0",
};

function post(
  body: string | Buffer,
  headers: Record<string, string> = {},
  method = "POST",
  chunked = false,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const h: Record<string, string | number> = { "Content-Type": "application/json", ...headers };
    if (!chunked) h["Content-Length"] = Buffer.byteLength(body);
    const req = request(
      { host: "127.0.0.1", port: k.srv.port, path: "/api/client-error", method, headers: h },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

const logged = () =>
  out
    .flatMap((l) => l.split("\n"))
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .filter((o) => o.msg === "client_error");

describe("POST /api/client-error", () => {
  it("geçerli bildirim 204 döner ve IP'siz yapılandırılmış günlüğe yazılır", async () => {
    expect(await post(JSON.stringify({ ...good, url: "/oda/ABCDE?token=gizli#x" }), { Origin: ORIGIN })).toBe(
      204,
    );
    const l = logged();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ level: "warn", message: "boom", url: "/oda/ABCDE", version: "0.1.0" });
    expect(JSON.stringify(l[0])).not.toMatch(/127\.0\.0\.1|gizli|ip/);
  });

  it("Origin başlığı yoksa kabul edilir; sadece zorunlu alanlar yeter", async () => {
    expect(await post(JSON.stringify({ message: "m", version: "1" }))).toBe(204);
    expect(
      await post(JSON.stringify({ message: "m", version: "1" }), {
        "Content-Type": "application/json; charset=utf-8",
      }),
    ).toBe(204);
  });

  it("izin verilmeyen Origin reddedilir", async () => {
    expect(await post(JSON.stringify(good), { Origin: "https://kotu.example" })).toBe(403);
    expect(logged()).toHaveLength(0);
  });

  it("yalnız POST", async () => {
    expect(await post("", {}, "GET")).toBe(405);
    expect(await post("", {}, "PUT")).toBe(405);
  });

  it("Content-Type application/json olmalı", async () => {
    expect(await post(JSON.stringify(good), { "Content-Type": "text/plain" })).toBe(415);
  });

  it("4 KB'tan büyük gövde 413 (Content-Length ile ve akışla)", async () => {
    const big = JSON.stringify({ ...good, message: "a".repeat(5000) });
    expect(await post(big)).toBe(413);
    expect(await post(big, {}, "POST", true)).toBe(413);
    expect(logged()).toHaveLength(0);
  });

  it("geçersiz gövde 400", async () => {
    for (const body of [
      "{",
      "[]",
      "null",
      JSON.stringify({ version: "1" }),
      JSON.stringify({ message: "", version: "1" }),
      JSON.stringify({ message: 5, version: "1" }),
      JSON.stringify({ message: "m" }),
      JSON.stringify({ message: "m", version: "1", ekstra: 1 }),
      JSON.stringify({ message: "m", version: "1", url: "https://baska.example/x" }),
      JSON.stringify({ message: "m", version: "1", stack: 3 }),
    ]) {
      expect(await post(body), body).toBe(400);
    }
  });

  it("günlükte e-posta, IP ve belirteç maskelenir", async () => {
    const message = "hata ali@ornek.com 10.1.2.3 abcdefghijklmnopqrstuvwxyz123456";
    expect(await post(JSON.stringify({ message, version: "1" }))).toBe(204);
    const l = logged()[0] as { message: string };
    expect(l.message).toBe("hata [e-posta] [ip] [belirteç]");
  });

  it("uzun alanlar kırpılır", async () => {
    expect(
      await post(JSON.stringify({ message: "mm ".repeat(300), version: "1", stack: "ss ".repeat(1000) })),
    ).toBe(204);
    const l = logged()[0] as { message: string; stack: string };
    expect(l.message).toHaveLength(500);
    expect(l.stack).toHaveLength(2048);
  });

  it("IP başına dakikada 10; sonrası 429, süre geçince yeniden açılır", async () => {
    const body = JSON.stringify(good);
    for (let i = 0; i < 10; i++) expect(await post(body)).toBe(204);
    expect(await post(body)).toBe(429);
    k.clock.advance(60_000);
    expect(await post(body)).toBe(204);
  });
});
