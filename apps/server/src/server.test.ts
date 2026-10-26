import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { type RunningServer, startServer } from "./server.js";

let running: RunningServer;
let restricted: RunningServer;
let base: string;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "glix-client-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>test</title>");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
  writeFileSync(join(dir, "asset-manifest.json"), "{}");
  const common = { host: "127.0.0.1", port: 0, clientDir: dir, revision: "testrev" };
  running = await startServer({ ...common, allowedOrigins: null });
  restricted = await startServer({ ...common, allowedOrigins: ["https://ok.example"] });
  base = `127.0.0.1:${running.port}`;
});

afterAll(async () => {
  await running.close();
  await restricted.close();
});

function exchange(url: string, payload: string, headers?: Record<string, string>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    ws.on("open", () => ws.send(payload));
    ws.on("message", (d) => {
      resolve(JSON.parse(d.toString()));
      ws.close();
    });
    ws.on("error", reject);
  });
}

describe("http", () => {
  it("/health", async () => {
    const body = await (await fetch(`http://${base}/health`)).json();
    expect(body).toMatchObject({
      ok: true,
      version: "0.1.0",
      protocolVersion: 2,
      rooms: 0,
      players: 0,
      revision: "testrev",
    });
    expect(typeof (body as { uptimeSeconds: number }).uptimeSeconds).toBe("number");
  });
  it("güvenlik başlıkları (CSP dahil) hem sayfada hem varlıkta", async () => {
    for (const p of ["/", "/assets/app.js", "/yok.js"]) {
      const res = await fetch(`http://${base}${p}`);
      expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
      expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("permissions-policy")).toContain("camera=()");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
  it("index ve SPA geri dönüşü", async () => {
    for (const p of ["/", "/oda/ABCD"]) {
      const res = await fetch(`http://${base}${p}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-cache");
      expect(await res.text()).toContain("<title>test</title>");
    }
  });
  it("varlık bildirimi her seferinde doğrulanır", async () => {
    const res = await fetch(`http://${base}/asset-manifest.json`);
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("content-type")).toContain("json");
  });
  it("assets değişmez önbellek", async () => {
    const res = await fetch(`http://${base}/assets/app.js`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(res.headers.get("content-type")).toContain("javascript");
  });
  it("olmayan dosya 404, yol aşımı engellenir", async () => {
    expect((await fetch(`http://${base}/missing.png`)).status).toBe(404);
    const body = await new Promise<string>((resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port: running.port, path: "/..%2f..%2f..%2fetc/passwd" }, (res) => {
          let text = "";
          res.on("data", (c) => {
            text += String(c);
          });
          res.on("end", () => resolve(text));
        })
        .on("error", reject);
    });
    // Kök dizinin dışına çıkılamaz: yanıt ya 404 ya da istemci kabuğudur.
    expect(body).not.toContain("root:");
  });
});

describe("ws", () => {
  it("hello -> welcome", async () => {
    expect(await exchange(`ws://${base}/ws`, '{"type":"hello","clientVersion":"0.0.1"}')).toEqual({
      type: "welcome",
      protocolVersion: 2,
      serverVersion: "0.1.0",
    });
  });
  it("ping -> pong", async () => {
    expect(await exchange(`ws://${base}/ws`, '{"type":"ping","t":5}')).toMatchObject({ type: "pong", t: 5 });
  });
  it("geçersiz -> error", async () => {
    expect(await exchange(`ws://${base}/ws`, "nonsense")).toMatchObject({
      type: "error",
      code: "invalid_message",
    });
  });
  it("origin denetimi", async () => {
    const url = `ws://127.0.0.1:${restricted.port}/ws`;
    await expect(exchange(url, "{}", { Origin: "https://evil.example" })).rejects.toThrow(/403/);
    expect(await exchange(url, '{"type":"ping","t":1}', { Origin: "https://ok.example" })).toMatchObject({
      type: "pong",
    });
  });
});
