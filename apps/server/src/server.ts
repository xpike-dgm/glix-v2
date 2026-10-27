import { createServer, type Server } from "node:http";
import { APP_VERSION, type GameLog, PROTOCOL_VERSION, parseClientMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { createAccountRecorder } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { AUTH_PREFIX, accountFromCookie, handleAuth } from "./auth.js";
import { CLIENT_ERROR_PATH, handleClientError } from "./clientError.js";
import { resolveClientIp } from "./clientIp.js";
import { type Clock, systemClock } from "./clock.js";
import { DEFAULT_LIMITS, type ServerLimits } from "./config.js";
import { createFriendsApi, FRIENDS_PATH } from "./friendsApi.js";
import { createGoogleAuth, type GoogleConfig } from "./google.js";
import { handleClose, handleMessage } from "./handlers.js";
import { ACCOUNT_PATH, createAccountApi } from "./kvkk.js";
import { createLeaderboardApi, LEADERBOARD_PATH } from "./leaderboard.js";
import { log } from "./log.js";
import {
  createMailer,
  type MailConfig,
  type FetchLike as MailFetch,
  type MailService,
  MailThrottle,
} from "./mail.js";
import { runTick, TICK_MS } from "./match.js";
import { errorMessage } from "./messages.js";
import { handleProfile, PROFILE_PATH } from "./profile.js";
import { TokenBucket } from "./ratelimit.js";
import { countActiveMatches, countPlayers, createRuntime, disposeRuntime } from "./rooms.js";
import type { AccountRef, Connection } from "./runtime.js";
import { createSocial } from "./social.js";
import { serveStatic } from "./static.js";
import { createStats, PURGE_EVERY_MS } from "./statsStore.js";
import { createWebPush, disabledPush, type PushGateway, type VapidConfig } from "./webpush.js";

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
  /** Hesap/oturum SQLite yolu (istatistikle aynı dosya olabilir). Verilmezse bellekte açılır (kalıcı değil). */
  accountsDb?: string | null;
  /** Google ile giriş ayarı; verilmezse kapalı (uçlar hata koduyla döner, düğme gizlenir). */
  google?: GoogleConfig | null;
  /** E-posta ayarı; verilmezse kapalı (doğrulama gönderilmez, şifre sıfırlama gizlenir). */
  mail?: MailConfig | null;
  /** E-posta servisine giden istek (testlerde sahte); varsayılan: genel `fetch`. */
  mailFetch?: MailFetch;
  /** Web bildirimi anahtarları; verilmezse ya da geçersizse bildirim kapalı kalır. */
  vapid?: VapidConfig | null;
  /** Hazır gönderici (testlerde sahte); verilirse `vapid` yok sayılır. */
  push?: PushGateway;
}

function resolvePush(opts: ServerOptions): PushGateway {
  if (opts.push) return opts.push;
  if (!opts.vapid) return disabledPush;
  try {
    return createWebPush(opts.vapid);
  } catch (err) {
    log.warn("push_disabled", { error: String(err) });
    return disabledPush;
  }
}

export interface RunningServer {
  server: Server;
  port: number;
  /** Açık WebSocket'ler (yalnız testler için). */
  sockets: ReadonlySet<WebSocket>;
  /** Hesap deposu (yalnız testler için: hızlı oturum açma). */
  accounts: AccountStore;
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
  const accounts = createAccounts(opts.accountsDb || ":memory:");
  accounts.purge(clock.now());
  const google = opts.google ? createGoogleAuth(opts.google) : null;
  const mail: MailService | null = opts.mail
    ? {
        mailer: createMailer(opts.mail, opts.mailFetch),
        publicUrl: opts.mail.publicUrl,
        throttle: new MailThrottle(),
      }
    : null;
  let cancelPurge: () => void = () => {};
  const schedulePurge = (): void => {
    cancelPurge = clock.setTimeout(() => {
      if (stopTicking) return;
      stats.purge(clock.now());
      accounts.purge(clock.now());
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
    resolvePush(opts),
    createAccountRecorder(accounts, (accountId, ids) =>
      rt.social.sendTo(accountId, { type: "badgesEarned", ids }),
    ),
  );
  rt.social = createSocial(rt, accounts);
  const friendsApi = createFriendsApi({
    accounts,
    social: rt.social,
    clock,
    allowedOrigins: opts.allowedOrigins,
  });
  const accountApi = createAccountApi({
    accounts,
    social: rt.social,
    google,
    limiter: rt.ipLimiter,
    clock,
    trustProxy: limits.trustProxy,
    allowedOrigins: opts.allowedOrigins,
  });
  const leaderboardApi = createLeaderboardApi({
    accounts,
    clock,
    gameName: (id) => rt.catalog.find((g) => g.id === id)?.name ?? null,
  });
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
      rt.social.tick(clock.now());
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
    const path = (req.url ?? "/").split("?")[0] ?? "/";
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
    if (path.startsWith(AUTH_PREFIX)) {
      handleAuth(req, res, {
        accounts,
        limiter: rt.ipLimiter,
        ip: resolveClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], limits.trustProxy),
        now: clock.now(),
        trustProxy: limits.trustProxy,
        allowedOrigins: opts.allowedOrigins,
        google,
        mail,
        onRenamed: (id, username) => rt.social.accountRenamed(id, username),
      });
      return;
    }
    if (path.startsWith(ACCOUNT_PATH)) {
      accountApi(req, res);
      return;
    }
    if (path === FRIENDS_PATH || path.startsWith(`${FRIENDS_PATH}/`)) {
      friendsApi(req, res);
      return;
    }
    if (path === LEADERBOARD_PATH || path.startsWith(`${LEADERBOARD_PATH}/`)) {
      leaderboardApi(req, res);
      return;
    }
    if (path === PROFILE_PATH || path.startsWith(`${PROFILE_PATH}/`)) {
      handleProfile(req, res, {
        accounts,
        now: clock.now(),
        gameName: (id) => rt.catalog.find((g) => g.id === id)?.name ?? null,
      });
      return;
    }
    serveStatic(req, res, opts.clientDir).catch((err: unknown) => {
      log.error("static_failed", { error: String(err) });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  // perMessageDeflate kapalı: küçük JSON mesajlarda sıkıştırma gecikme ve CPU ekler. ws her sokette TCP_NODELAY açar.
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_PAYLOAD_BYTES,
    perMessageDeflate: false,
  });

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
    const account = accountFromCookie(accounts, req.headers.cookie, clock.now());
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, {
        ip,
        account: account ? { id: account.id, username: account.username } : null,
      }),
    );
  });

  wss.on("connection", (ws: WebSocket, info: { ip: string; account: AccountRef | null }) => {
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
      stage: null,
      lastSent: null,
      sentVer: -1,
      ip,
      failedJoins: 0,
      account: info.account,
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
        // Hesaplı bağlantı boşta da açık kalır: arkadaş durumu ve canlı davet bunun üzerinden gelir.
        if (conn.player || conn.stage || conn.account) armIdle();
        else ws.close(IDLE_CLOSE_CODE, "Uzun süre işlem yapılmadı");
      }, limits.idleUnjoinedMs);
    };
    armIdle();
    rt.social.attach(conn);
    ws.on("close", () => {
      cancelIdle();
      rt.social.detach(conn);
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
    accounts,
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
        accounts.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
