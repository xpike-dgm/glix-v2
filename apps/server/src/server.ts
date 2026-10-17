import { createServer, type Server } from "node:http";
import { APP_VERSION, type GameLog, PROTOCOL_VERSION, parseClientMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { CLIENT_ERROR_PATH, handleClientError } from "./clientError.js";
import { resolveClientIp } from "./clientIp.js";
import { type Clock, systemClock } from "./clock.js";
import { DEFAULT_LIMITS, type ServerLimits } from "./config.js";
import { handleClose, handleMessage } from "./handlers.js";
import { log } from "./log.js";
import { runTick, TICK_MS } from "./match.js";
import { errorMessage } from "./messages.js";
import { TokenBucket } from "./ratelimit.js";
import { countActiveMatches, countPlayers, createRuntime, disposeRuntime } from "./rooms.js";
import type { Connection } from "./runtime.js";
import { serveStatic } from "./static.js";
import { createStats, PURGE_EVERY_MS } from "./statsStore.js";

/** Bu kadar geçersiz mesajdan sonra bağlantı kapatılır. */
export const MAX_INVALID_MESSAGES = 5;
/** Üst üste bu kadar `rate_limited` yanıtından sonra bağlantı kapatılır. */
export const MAX_RATE_LIMIT_STREAK = 100;
/** Gelen mesajın en büyük bayt boyutu (ws `maxPayload` ile aynı). */
export const MAX_PAYLOAD_BYTES = 8 * 1024;
/** Giden tamponu bu kadar şişen (okumayan) soket koparılır. */
export const MAX_BUFFERED_BYTES = 1_000_000;
export const HEARTBEAT_MS = 20_000;
export const IDLE_CLOSE_CODE = 4000;

function byteLength(data: Buffer | ArrayBuffer | Buffer[]): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

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
  /** Sınırlar; verilmeyenler `DEFAULT_LIMITS`. */
  limits?: Partial<ServerLimits>;
  /** Kalp atışı aralığı (ms). Varsayılan 20 sn; sahte saatle atlamalı testler büyük değer verir. */
  heartbeatMs?: number;
  /** Yeni odaların varsayılan oyun seçimi. Verilmezse yeni odalar rastgele modda (5 oyun) açılır; verilirse bu oyunlarla manuel mod. */
  defaultGameIds?: readonly string[] | undefined;
  /** Rastgele oyun seçiminde kullanılan 0..max-1 rastgele tamsayı (testlerde sabitlenir). Varsayılan: crypto. */
  randomInt?: (max: number) => number;
  /** İstatistik SQLite yolu (":memory:" olabilir). Verilmezse/null ise istatistik kapalıdır. */
  statsDb?: string | null;
}

export interface RunningServer {
  server: Server;
  port: number;
  /** Açık WebSocket'ler (yalnız testler için). */
  sockets: ReadonlySet<WebSocket>;
  /** Son biten oyunların kayıtları (yalnız testler için). */
  recentLogs: readonly GameLog[];
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
  const limits: ServerLimits = { ...DEFAULT_LIMITS, ...opts.limits };
  const stats = createStats(opts.statsDb);
  stats.purge(clock.now());
  let cancelPurge: () => void = () => {};
  const schedulePurge = (): void => {
    cancelPurge = clock.setTimeout(() => {
      if (stopTicking) return;
      stats.purge(clock.now());
      schedulePurge();
    }, PURGE_EVERY_MS);
  };
  const rt = createRuntime(
    clock,
    limits.maxRooms,
    limits.roomCreateBurst,
    opts.defaultGameIds,
    opts.randomInt,
    stats,
  );
  const perIp = new Map<string, number>();
  const aliveSockets = new WeakMap<WebSocket, boolean>();

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

  // Kalp atışı: her turda ping; bir önceki tura pong gelmediyse soket koparılır (normal kapanış yolu: grace).
  let cancelHeartbeat: () => void = () => {};
  const scheduleHeartbeat = (): void => {
    cancelHeartbeat = clock.setTimeout(() => {
      if (stopTicking) return;
      for (const ws of sockets) {
        if (aliveSockets.get(ws) === false) {
          log.warn("heartbeat_timeout");
          ws.terminate();
          continue;
        }
        aliveSockets.set(ws, false);
        try {
          ws.ping();
        } catch {
          ws.terminate();
        }
      }
      rt.ipLimiter.prune();
      scheduleHeartbeat();
    }, opts.heartbeatMs ?? HEARTBEAT_MS);
  };
  scheduleHeartbeat();
  schedulePurge();

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
    if (path === CLIENT_ERROR_PATH) {
      handleClientError(req, res, {
        allowedOrigins: opts.allowedOrigins,
        limiter: rt.ipLimiter,
        ip: resolveClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], limits.trustProxy),
      });
      return;
    }
    serveStatic(req, res, opts.clientDir).catch((err: unknown) => {
      log.error("static_failed", { error: String(err) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

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
    const ip = resolveClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], limits.trustProxy);
    if (sockets.size >= limits.maxSockets) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nRetry-After: 10\r\n\r\n");
      socket.destroy();
      return;
    }
    if ((perIp.get(ip) ?? 0) >= limits.maxSocketsPerIp) {
      socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nRetry-After: 10\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, { ip }));
  });

  wss.on("connection", (ws: WebSocket, info: { ip: string }) => {
    const ip = info.ip;
    sockets.add(ws);
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
    aliveSockets.set(ws, true);
    ws.on("pong", () => aliveSockets.set(ws, true));
    const sendRaw = (text: string): void => {
      if (ws.readyState !== ws.OPEN) return;
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        // Okumayan istemci sunucu belleğini şişirmesin: koparılır, oyuncu normal kopma (grace) yolunu izler.
        log.warn("slow_consumer", { bufferedAmount: ws.bufferedAmount });
        ws.terminate();
        return;
      }
      rt.metrics.recordBytes(Buffer.byteLength(text), clock.now());
      ws.send(text);
    };
    let limitedThisMessage = false;
    let rateLimitStreak = 0;
    const conn: Connection = {
      player: null,
      lastSent: null,
      sentVer: -1,
      ip,
      failedJoins: 0,
      sendRaw,
      send: (msg) => {
        if (msg.type === "error" && msg.code === "rate_limited") limitedThisMessage = true;
        sendRaw(JSON.stringify(msg));
      },
      close: (code, reason) => ws.close(code, reason),
    };
    const bucket = new TokenBucket(clock);
    let invalid = 0;
    // Odaya girmeyen soketler boşuna yer tutmasın: süre dolunca hâlâ odasızsa kapatılır (4000).
    let cancelIdle: () => void = () => {};
    const armIdle = (): void => {
      cancelIdle = clock.setTimeout(() => {
        if (ws.readyState !== ws.OPEN) return;
        if (conn.player) armIdle();
        else ws.close(IDLE_CLOSE_CODE, "Uzun süre işlem yapılmadı");
      }, limits.idleUnjoinedMs);
    };
    armIdle();
    ws.on("close", () => {
      cancelIdle();
      sockets.delete(ws);
      const left = (perIp.get(ip) ?? 1) - 1;
      if (left <= 0) perIp.delete(ip);
      else perIp.set(ip, left);
      handleClose(rt, conn);
    });
    ws.on("error", (err) => log.warn("ws_error", { error: String(err) }));
    ws.on("message", (data, isBinary) => {
      if (!bucket.take()) {
        conn.send(errorMessage("rate_limited"));
        rateLimitStreak += 1;
        if (rateLimitStreak >= MAX_RATE_LIMIT_STREAK) ws.close(1008, "Çok hızlı mesaj gönderiyorsun");
        return;
      }
      // Bayt boyutu `toString()` öncesi denetlenir (ws maxPayload ikinci savunma hattı).
      const msg =
        isBinary || byteLength(data) > MAX_PAYLOAD_BYTES ? null : parseClientMessage(data.toString());
      if (!msg) {
        conn.send(errorMessage("invalid_message"));
        invalid += 1;
        if (invalid >= MAX_INVALID_MESSAGES) ws.close(1008, "Çok sayıda geçersiz mesaj");
        return;
      }
      limitedThisMessage = false;
      try {
        handleMessage(rt, conn, msg);
        if (limitedThisMessage) {
          rateLimitStreak += 1;
          if (rateLimitStreak >= MAX_RATE_LIMIT_STREAK) ws.close(1008, "Çok hızlı istek gönderiyorsun");
        } else rateLimitStreak = 0;
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
    sockets,
    recentLogs: rt.recentLogs,
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
        cancelHeartbeat();
        cancelPurge();
        finishDrain();
        // 1012: oyuncular "oda kapandı" görmez; istemci resume dener ve güncelleme mesajını gösterir.
        disposeRuntime(rt, code !== 1012);
        for (const ws of sockets)
          ws.close(code, code === 1012 ? "Sunucu yeniden başlıyor" : "Sunucu kapanıyor");
        wss.close();
        stats.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
