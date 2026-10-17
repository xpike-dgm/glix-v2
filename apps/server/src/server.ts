import { createServer, type Server } from "node:http";
import { APP_VERSION, PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { type Clock, systemClock } from "./clock.js";
import { handleClose, handleMessage } from "./handlers.js";
import { log } from "./log.js";
import { runTick, TICK_MS } from "./match.js";
import { errorMessage } from "./messages.js";
import { TokenBucket } from "./ratelimit.js";
import { countPlayers, createRuntime, disposeRuntime } from "./rooms.js";
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
}

export interface RunningServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const startedAt = Date.now();
  const sockets = new Set<WebSocket>();
  const clock = opts.clock ?? systemClock;
  const rt = createRuntime(clock);

  let stopTicking = false;
  let cancelTick: () => void = () => {};
  const scheduleTick = (): void => {
    cancelTick = clock.setTimeout(() => {
      if (stopTicking) return;
      runTick(rt);
      scheduleTick();
    }, TICK_MS);
  };
  scheduleTick();

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/health") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(
        JSON.stringify({
          ok: true,
          version: APP_VERSION,
          revision: opts.revision,
          protocolVersion: PROTOCOL_VERSION,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          rooms: rt.rooms.size,
          players: countPlayers(rt),
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
    const conn: Connection = {
      player: null,
      send: (msg) => send(ws, msg),
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
    close: () =>
      new Promise<void>((resolve) => {
        stopTicking = true;
        cancelTick();
        disposeRuntime(rt);
        for (const ws of sockets) ws.close(1001, "Sunucu kapanıyor");
        wss.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
