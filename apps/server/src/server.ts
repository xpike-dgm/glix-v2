import { createServer, type Server } from "node:http";
import { APP_VERSION, PROTOCOL_VERSION, parseClientMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { type Clock, systemClock } from "./clock.js";
import { handleClose, handleMessage } from "./handlers.js";
import { log } from "./log.js";
import { runTick, TICK_MS } from "./match.js";
import { errorMessage } from "./messages.js";
import { TokenBucket } from "./ratelimit.js";
import { countActiveMatches, countPlayers, createRuntime, disposeRuntime } from "./rooms.js";
import type { Connection } from "./runtime.js";
import { serveStatic } from "./static.js";

/** Bu kadar geçersiz mesajdan sonra bağlantı kapatılır. */
export const MAX_INVALID_MESSAGES = 5;

export interface ServerOptions {
  host: string;
  port: number;
  clientDir: string;
  allowedOrigins: readonly string[] | null;
  revision: string;
  /** Zaman kaynağı (testlerde sahte saat). Varsayılan: sistem saati. */
  clock?: Clock;
  /** Drain süresi sınırı (ms). Varsayılan 10 dk. */
  drainTimeoutMs?: number;
}

export interface RunningServer {
  server: Server;
  port: number;
  /**
   * Drain kipine girer: yeni oda/katılım reddedilir, mevcut maçlar sürer. Maçı olan oda kalmayınca ya da
   * süre dolunca çözülür (soketleri kapatmaz; ardından `close(1012)` çağrılır).
   */
  drain(): Promise<void>;
  /** Soketleri `code` ile kapatır (1012: servis yeniden başlıyor). */
  close(code?: number): Promise<void>;
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const startedAt = Date.now();
  const sockets = new Set<WebSocket>();
  const clock = opts.clock ?? systemClock;
  const rt = createRuntime(clock);

  let stopTicking = false;
  let cancelTick: () => void = () => {};
  let drainDone: (() => void) | null = null;
  let cancelDrainTimeout: () => void = () => {};
  const finishDrain = (): void => {
    if (!drainDone) return;
    const done = drainDone;
    drainDone = null;
    cancelDrainTimeout();
    done();
  };
  const scheduleTick = (): void => {
    cancelTick = clock.setTimeout(() => {
      if (stopTicking) return;
      const t0 = performance.now();
      runTick(rt);
      rt.metrics.recordTick(performance.now() - t0);
      if (rt.draining && countActiveMatches(rt) === 0) finishDrain();
      scheduleTick();
    }, TICK_MS);
  };
  scheduleTick();

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/health") {
      res.writeHead(rt.draining ? 503 : 200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          ok: !rt.draining,
          draining: rt.draining,
          version: APP_VERSION,
          revision: opts.revision,
          protocolVersion: PROTOCOL_VERSION,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          rooms: rt.rooms.size,
          players: countPlayers(rt),
          activeMatches: countActiveMatches(rt),
          tickMsP95: Math.round(rt.metrics.tickMsP95() * 100) / 100,
          bytesOutPerSec: Math.round(rt.metrics.bytesOutPerSec(clock.now())),
          memoryRssMb: Math.round(process.memoryUsage().rss / 1048576),
        }),
      );
      return;
    }
    serveStatic(req, res, opts.clientDir).catch((err: unknown) => {
      log.error("static_failed", { error: String(err) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "").split("?")[0];
    if (path !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    if (opts.allowedOrigins) {
      const origin = req.headers.origin;
      if (!origin || !opts.allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws) => {
    sockets.add(ws);
    const sendRaw = (text: string): void => {
      if (ws.readyState !== ws.OPEN) return;
      rt.metrics.recordBytes(Buffer.byteLength(text), clock.now());
      ws.send(text);
    };
    const conn: Connection = {
      player: null,
      lastSent: null,
      sendRaw,
      send: (msg) => sendRaw(JSON.stringify(msg)),
      close: (code, reason) => ws.close(code, reason),
    };
    const bucket = new TokenBucket(clock);
    let invalid = 0;
    ws.on("close", () => {
      sockets.delete(ws);
      handleClose(rt, conn);
    });
    ws.on("error", (err) => log.warn("ws_error", { error: String(err) }));
    ws.on("message", (data, isBinary) => {
      if (!bucket.take()) {
        conn.send(errorMessage("rate_limited"));
        return;
      }
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) {
        conn.send(errorMessage("invalid_message"));
        invalid += 1;
        if (invalid >= MAX_INVALID_MESSAGES) ws.close(1008, "Çok sayıda geçersiz mesaj");
        return;
      }
      try {
        handleMessage(rt, conn, msg);
      } catch (err) {
        log.error("handler_failed", { type: msg.type, error: String(err) });
        conn.send(errorMessage("invalid_message", "Beklenmeyen bir sorun oluştu."));
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, opts.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : opts.port;

  return {
    server,
    port,
    drain: () => {
      rt.draining = true;
      if (countActiveMatches(rt) === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        drainDone = resolve;
        cancelDrainTimeout = clock.setTimeout(() => {
          log.warn("drain_timeout", { activeMatches: countActiveMatches(rt) });
          finishDrain();
        }, opts.drainTimeoutMs ?? 600_000);
      });
    },
    close: (code = 1001) =>
      new Promise<void>((resolve) => {
        stopTicking = true;
        cancelTick();
        finishDrain();
        // 1012: oyuncular "oda kapandı" görmez; istemci resume dener ve güncelleme mesajını gösterir.
        disposeRuntime(rt, code !== 1012);
        for (const ws of sockets)
          ws.close(code, code === 1012 ? "Sunucu yeniden başlıyor" : "Sunucu kapanıyor");
        wss.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
