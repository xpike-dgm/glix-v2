import { createServer, type Server } from "node:http";
import { APP_VERSION, PROTOCOL_VERSION, parseClientMessage, type ServerMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { log } from "./log.js";
import { serveStatic } from "./static.js";

export interface ServerOptions {
  host: string;
  port: number;
  clientDir: string;
  allowedOrigins: readonly string[] | null;
  revision: string;
}

export interface RunningServer {
  server: Server;
  port: number;
  close(): Promise<void>;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const startedAt = Date.now();
  const sockets = new Set<WebSocket>();

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
    ws.on("close", () => sockets.delete(ws));
    ws.on("error", (err) => log.warn("ws_error", { error: String(err) }));
    ws.on("message", (data, isBinary) => {
      const msg = isBinary ? null : parseClientMessage(data.toString());
      if (!msg) {
        send(ws, { type: "error", code: "invalid_message", message: "Geçersiz mesaj" });
        return;
      }
      if (msg.type === "hello") {
        send(ws, { type: "welcome", protocolVersion: PROTOCOL_VERSION, serverVersion: APP_VERSION });
      } else {
        send(ws, { type: "pong", t: msg.t, serverTime: Date.now() });
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
        for (const ws of sockets) ws.close(1001, "Sunucu kapanıyor");
        wss.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
