import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { APP_VERSION, type CardLog, type GameLog, PROTOCOL_VERSION, parseClientMessage } from "@glix/engine";
import { type WebSocket, WebSocketServer } from "ws";
import { createAccountRecorder } from "./accountStats.js";
import { type AccountStore, createAccounts } from "./accountStore.js";
import { ADMIN_PREFIX, createAdminLimits, handleAdmin } from "./admin.js";
import { buildLive, createHealthSampler } from "./adminData.js";
import { createAdminRoomOps } from "./adminRooms.js";
import { type AiFetch, createAiCommenter, createAiText } from "./aiComment.js";
import { INSPIRE_PER_MINUTE, INSPIRE_TIMEOUT_MS } from "./aiInspire.js";
import { AUTH_PREFIX, accountFromCookie, handleAuth, hashToken, readSessionToken } from "./auth.js";
import { createBackupService } from "./backup.js";
import { CLIENT_ERROR_PATH, handleClientError } from "./clientError.js";
import { resolveClientIp } from "./clientIp.js";
import { type Clock, systemClock } from "./clock.js";
import { DEFAULT_LIMITS, type ServerLimits } from "./config.js";
import { type ContentStore, createContentStore } from "./contentStore.js";
import { createFriendsApi, FRIENDS_PATH } from "./friendsApi.js";
import { gameNameOf } from "./gameSwitches.js";
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
import { TICK_BUCKETS_MS } from "./metrics.js";
import { type BannedWords, createBannedWords, createReportDesk } from "./moderation.js";
import {
  isTestOrtam,
  ORTAM_AI_PER_DAY,
  ORTAM_AI_PER_MINUTE,
  ORTAM_ROBOTS,
  ORTAM_ROBOTS_HEADER,
  type Ortam,
  ortamSeridi,
} from "./ortam.js";
import { OYUN_ALANI_PREFIX, OyunAlaniKatmani, oyunAlaniKlasoru } from "./oyunAlani.js";
import { handleProfile, PROFILE_PATH } from "./profile.js";
import { createPushBroadcaster } from "./pushBroadcast.js";
import { createQuestsApi, QUESTS_PATH } from "./quests.js";
import { TokenBucket } from "./ratelimit.js";
import { countActiveMatches, countPlayers, createRuntime, disposeRuntime } from "./rooms.js";
import type { AccountRef, Connection, Runtime } from "./runtime.js";
import { createShopApi, SHOP_PATH } from "./shopApi.js";
import { createSiteSettings } from "./siteSettings.js";
import { createSocial } from "./social.js";
import { DEV_PREVIEW_ANCESTORS, serveStatic } from "./static.js";
import { createStats, PURGE_EVERY_MS } from "./statsStore.js";
import { enableDraftGames } from "./taslak.js";
import { createUretimApi, URETIM_PREFIX } from "./uretim.js";
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
  /** Oyun ansiklopedisi içerik klasörü; verilmezse wiki uçları 404 verir. */
  wikiDir?: string;
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
  /** Yönetici paneline girebilen hesap kimlikleri; boş/verilmezse panel kapalıdır (`/admin` 404). */
  adminAccountIds?: ReadonlySet<number>;
  /** Hazır gönderici (testlerde sahte); verilirse `vapid` yok sayılır. */
  push?: PushGateway;
  /** Yedeklerin geçici kopyaları için klasör; varsayılan sistem geçici klasörü (konteynerde /tmp, bellek diski). */
  backupDir?: string;
  /** Herkese bildirimde saniyedeki gönderim sayısı; varsayılan 20 (testlerde küçültülür). */
  broadcastPerSecond?: number;
  /** TASLAK oyunları açar (yalnız geliştirme/test; bkz. `taslak.ts`). Varsayılan kapalı. */
  draftGames?: boolean;
  /** Üretim Merkezi uçlarının anahtarı (`GLIX_URETIM_TOKEN`); boş/null ise `/api/uretim/*` 404. */
  uretimToken?: string | null;
  /** Önizleme sayfasını (`onizleme.html`) gömebilecek kaynaklar (CSP `frame-ancestors`). */
  previewAncestors?: readonly string[];
  /** Oyun sonu yorumu anahtarı; verilmezse/null ise yorum tamamen kapalı (hiç istek yok). */
  aiKey?: string | null;
  /** Yorum servisine giden istek (testlerde sahte); varsayılan: yerleşik `fetch`. */
  aiFetch?: AiFetch;
  /**
   * Çalışma ortamı (`GLIX_ORTAM`); verilmezse canlı ve davranış değişmez. test/test2'de e-posta ve bildirim kapalı,
   * yapay zekâ düşük sınırla, yanıtlar `noindex`, `robots.txt` kapalı ve ana sayfada ortam şeridi (bkz. `ortam.ts`).
   */
  ortam?: Ortam;
  /**
   * Oyun alanının (test2) taslak katmanı klasörü. Yalnız `ortam: "test2"`de kullanılır; verilmezse hesap
   * veritabanının yanındaki `oyun-alani/` (bellekteki veritabanında yalnız bellek).
   */
  oyunAlaniDir?: string | null;
}

function resolvePush(opts: ServerOptions): PushGateway {
  // Test ortamlarında hiçbir bildirim gönderilmez (hazır gönderici ya da anahtar verilse bile).
  if (isTestOrtam(opts.ortam)) return disabledPush;
  if (opts.push) return opts.push;
  if (!opts.vapid) return disabledPush;
  try {
    return createWebPush(opts.vapid);
  } catch (err) {
    log.warn("push_disabled", { error: String(err) });
    return disabledPush;
  }
}

interface UpgradeInfo {
  ip: string;
  account: AccountRef | null;
  sessionHash: string | null;
}

/** HTTP boşta-bağlantı süresi (vekilin ve istemcinin yeniden kullanım süresinden uzun). */
export const KEEP_ALIVE_MS = 65_000;

export interface RunningServer {
  server: Server;
  port: number;
  /** Açık WebSocket'ler (yalnız testler için). */
  sockets: ReadonlySet<WebSocket>;
  /** Hesap deposu (yalnız testler için: hızlı oturum açma). */
  accounts: AccountStore;
  /** Son biten oyunların kayıtları (yalnız testler için). */
  recentLogs: readonly GameLog[];
  /** Son biten maçların kart kayıtları (yalnız testler için). */
  recentCardLogs: readonly CardLog[];
  /** Çalışma zamanı durumu (yalnız testler için: oda ve maç durumunu kurmak/okumak). */
  runtime: Runtime;
  /** Yönetici yasaklı kelime listesi (yalnız testler için). */
  bannedWords: BannedWords;
  /** İçerik havuzu deposu (yalnız testler için). */
  content: ContentStore;
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
  const testOrtam = isTestOrtam(opts.ortam);
  // Test ortamlarında dışarıya e-posta ve Google girişi yoktur (ayar verilse bile).
  const google = opts.google && !testOrtam ? createGoogleAuth(opts.google) : null;
  const mailConfig = testOrtam ? null : (opts.mail ?? null);
  const mail: MailService | null = mailConfig
    ? {
        mailer: createMailer(mailConfig, opts.mailFetch, (kind, ok) => stats.mailSent(clock.now(), kind, ok)),
        publicUrl: mailConfig.publicUrl,
        throttle: new MailThrottle(),
      }
    : null;
  if (testOrtam) log.warn("ortam_test", { ortam: opts.ortam ?? "canli" });
  const serit = ortamSeridi(opts.ortam);
  let cancelPurge: () => void = () => {};
  const schedulePurge = (): void => {
    cancelPurge = clock.setTimeout(() => {
      if (stopTicking) return;
      stats.purge(clock.now());
      accounts.purge(clock.now());
      schedulePurge();
    }, PURGE_EVERY_MS);
  };
  if (opts.draftGames) {
    const opened = enableDraftGames();
    log.warn("draft_games_enabled", { games: opened });
  }
  const rt = createRuntime(
    clock,
    limits.maxRooms,
    limits.roomCreateBurst,
    opts.defaultGameIds,
    opts.randomInt,
    stats,
    resolvePush(opts),
    createAccountRecorder(
      accounts,
      (accountId, ids) => rt.social.sendTo(accountId, { type: "badgesEarned", ids }),
      (accountId, earned) => rt.social.sendTo(accountId, { type: "glixEarned", ...earned }),
      () => rt.gunlukGorevler,
      (accountId, quests, balance) => rt.social.sendTo(accountId, { type: "questsDone", quests, balance }),
    ),
  );
  // Bot ekleme yalnız test ortamlarında; canlıda istek reddedilir ve arayüz düğmeyi göstermez (bkz. bots.ts).
  rt.botsEnabled = testOrtam;
  rt.social = createSocial(rt, accounts);
  rt.bannedWords = createBannedWords(accounts);
  rt.content = createContentStore(accounts, rt.bannedWords);
  rt.reports = createReportDesk(accounts, clock);
  rt.aiComment = createAiCommenter({
    apiKey: opts.aiKey ?? null,
    clock,
    ...(testOrtam ? { perMinute: ORTAM_AI_PER_MINUTE, perDay: ORTAM_AI_PER_DAY } : {}),
    isBanned: (text) => rt.bannedWords.matches(text),
    ...(opts.aiFetch ? { fetch: opts.aiFetch } : {}),
  });
  rt.aiInspire = createAiText({
    apiKey: opts.aiKey ?? null,
    clock,
    timeoutMs: INSPIRE_TIMEOUT_MS,
    perMinute: testOrtam ? ORTAM_AI_PER_MINUTE : INSPIRE_PER_MINUTE,
    ...(testOrtam ? { perDay: ORTAM_AI_PER_DAY } : {}),
    ...(opts.aiFetch ? { fetch: opts.aiFetch } : {}),
  });
  const friendsApi = createFriendsApi({
    accounts,
    social: rt.social,
    clock,
    allowedOrigins: opts.allowedOrigins,
  });
  const questsApi = createQuestsApi({ accounts, clock, enabled: () => rt.gunlukGorevler });
  const shopApi = createShopApi({
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
    gameName: gameNameOf,
  });
  const connections = new Set<Connection>();
  // Duyuru ve bakım kipi değişikliği tüm açık bağlantılara (misafir, hesaplı, sahne) canlı gider.
  const site = createSiteSettings(rt, accounts, (msg) => {
    const text = JSON.stringify(msg);
    for (const c of connections) c.sendRaw(text);
  });
  const broadcaster = createPushBroadcaster(rt, accounts, clock, opts.broadcastPerSecond);
  const backup = createBackupService(accounts, stats, opts.backupDir);
  // Sunucu başlangıç kaydı ("son yayınlar"); yazılamazsa sunucu yine açılır.
  let runId: number | null = null;
  try {
    runId = accounts.serverStarted(opts.revision, APP_VERSION, clock.now());
  } catch (err) {
    log.error("accounts_error", { op: "server_started", error: String(err) });
  }
  const adminIds: ReadonlySet<number> = opts.adminAccountIds ?? new Set<number>();
  const adminThrottle = new MailThrottle();
  const adminLimits = createAdminLimits(clock);
  // Oyun alanı taslak katmanı: yalnız test2 (canlıda ve test'te hiç kurulmaz, uçları 404).
  const oyunAlani =
    opts.ortam === "test2"
      ? new OyunAlaniKatmani(
          opts.oyunAlaniDir !== undefined
            ? opts.oyunAlaniDir
            : opts.accountsDb && opts.accountsDb !== ":memory:"
              ? oyunAlaniKlasoru(opts.accountsDb)
              : null,
          join(opts.clientDir, "assets", "shop"),
        )
      : null;
  if (oyunAlani) log.warn("oyun_alani_katmani", { taslak: oyunAlani.liste().length });
  const uretimApi = createUretimApi({
    oyunAlani,
    token: opts.uretimToken ?? null,
    accounts,
    content: rt.content,
    banned: rt.bannedWords,
    clock,
    revision: opts.revision,
  });
  const healthSampler = adminIds.size > 0 ? createHealthSampler() : null;
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
      // Bir adım hata atsa da döngü sürer: aksi hâlde tüm odaların saati sessizce durur.
      try {
        const t0 = performance.now();
        runTick(rt);
        rt.social.tick(clock.now());
        site.tick(clock.now());
        rt.metrics.recordTick(performance.now() - t0);
        if (rt.draining && countActiveMatches(rt) === 0) finishDrain();
      } catch (err) {
        log.error("tick_failed", { error: String(err) });
      }
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
    if (testOrtam) {
      // Test ortamları arama motorlarına kapalıdır: her yanıtta başlık, robots.txt her yolu kapatır.
      res.setHeader("X-Robots-Tag", ORTAM_ROBOTS_HEADER);
      if (path === "/robots.txt" && (req.method === "GET" || req.method === "HEAD")) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(req.method === "HEAD" ? undefined : ORTAM_ROBOTS);
        return;
      }
    }
    if (path === "/health") {
      const detail = (req.url ?? "").includes("detail=1");
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
          ...(testOrtam ? { ortam: opts.ortam } : {}),
          ...(detail ? { tickHistogram: { edgesMs: TICK_BUCKETS_MS, ...rt.metrics.tickHistogram() } } : {}),
        }),
      );
      return;
    }
    if (path === URETIM_PREFIX || path.startsWith(`${URETIM_PREFIX}/`)) {
      uretimApi(req, res);
      return;
    }
    if (oyunAlani && path.startsWith(`${OYUN_ALANI_PREFIX}/`)) {
      oyunAlani.handle(req, res);
      return;
    }
    if (path.startsWith(ADMIN_PREFIX)) {
      handleAdmin(req, res, {
        accounts,
        stats,
        limiter: rt.ipLimiter,
        throttle: adminThrottle,
        mail,
        adminIds,
        allowedOrigins: opts.allowedOrigins,
        trustProxy: limits.trustProxy,
        ip: resolveClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], limits.trustProxy),
        now: clock.now(),
        social: rt.social,
        google,
        limits: adminLimits,
        site,
        broadcaster,
        backup,
        clock,
        runId,
        rooms: createAdminRoomOps(rt),
        banned: rt.bannedWords,
        content: rt.content,
        wikiDir: opts.wikiDir ?? null,
        live: () => {
          let withAccount = 0;
          for (const c of connections) if (c.account) withAccount += 1;
          return buildLive({
            rt,
            startedAt,
            revision: opts.revision,
            sockets: { total: sockets.size, accounts: withAccount },
            sampler: healthSampler ?? { cpuPercent: () => 0, eventLoopLagMsP95: () => 0, stop: () => {} },
          });
        },
      });
      return;
    }
    if (path === CLIENT_ERROR_PATH) {
      handleClientError(req, res, {
        stats,
        now: clock.now(),
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
        bannedWords: rt.bannedWords,
        adminIds,
        onRenamed: (id, username) => rt.social.accountRenamed(id, username),
        onSessionsRevoked: (id, revoked) => rt.social.sessionsRevoked(id, revoked),
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
    if (path === QUESTS_PATH) {
      questsApi(req, res);
      return;
    }
    if (path === SHOP_PATH || path.startsWith(`${SHOP_PATH}/`)) {
      shopApi(req, res);
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
        gameName: gameNameOf,
      });
      return;
    }
    serveStatic(req, res, opts.clientDir, {
      adminEnabled: adminIds.size > 0,
      previewAncestors: opts.previewAncestors ?? DEV_PREVIEW_ANCESTORS,
      ...(serit ? { serit } : {}),
    }).catch((err: unknown) => {
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

  // Node'un varsayılan 5 sn boşta-bağlantı süresi, ters vekilin (Caddy) ve istemcinin bağlantıyı yeniden kullandığı
  // an ile çakışıp "ECONNRESET"e yol açar (gevşek yükte seyrek, yükte sık). Vekilden uzun tutulur;
  // headersTimeout her zaman bundan büyük olmalıdır. Kapanışta boştaki bağlantılar zaten kapatılır.
  server.keepAliveTimeout = KEEP_ALIVE_MS;
  server.headersTimeout = KEEP_ALIVE_MS + 1000;

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
    const sessionToken = account ? readSessionToken(req.headers.cookie) : null;
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, {
        ip,
        account: account ? { id: account.id, username: account.username } : null,
        sessionHash: sessionToken ? hashToken(sessionToken) : null,
      }),
    );
  });

  wss.on("connection", (ws: WebSocket, info: UpgradeInfo) => {
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
      sessionHash: info.sessionHash,
      sendRaw,
      send: (msg) => {
        if (msg.type === "error" && msg.code === "rate_limited") limitedThisMessage = true;
        sendRaw(JSON.stringify(msg));
      },
      close: (code, reason) => ws.close(code, reason),
    };
    connections.add(conn);
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
      connections.delete(conn);
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
    recentCardLogs: rt.recentCardLogs,
    runtime: rt,
    bannedWords: rt.bannedWords,
    content: rt.content,
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
        healthSampler?.stop();
        oyunAlani?.kapat();
        // Temiz kapanış kaydı (çökme/zorla durdurmada yazılmaz; panel bunu "kapanış kaydı yok" gösterir).
        if (runId !== null) {
          try {
            accounts.serverStopped(runId, clock.now());
          } catch (err) {
            log.error("accounts_error", { op: "server_stopped", error: String(err) });
          }
        }
        stats.close();
        accounts.close();
        server.close(() => resolve());
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 2000).unref();
      }),
  };
}
