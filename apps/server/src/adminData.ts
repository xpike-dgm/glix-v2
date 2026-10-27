/**
 * Yönetici paneli veri üreticileri (U16 A1). Oyuncu adı, oyun durumu, e-posta, IP ya da kullanıcı adı üretmez;
 * yalnız sayılar, oda kodları, aşamalar ve oyun kimlikleri.
 */
import { monitorEventLoopDelay } from "node:perf_hooks";
import type {
  AdminAccounts,
  AdminErrors,
  AdminLive,
  AdminRelease,
  AdminRoomRow,
  AdminStats,
} from "@glix/engine";
import { APP_VERSION } from "@glix/engine";
import type { AccountStore, ServerStartRow } from "./accountStore.js";
import { countActiveMatches, countPlayers } from "./rooms.js";
import type { Runtime } from "./runtime.js";
import { dayLabel } from "./statsAdmin.js";
import type { StatsStore } from "./statsStore.js";

/** Canlı durum tablosunda gösterilen en çok oda. */
export const MAX_ROOM_ROWS = 200;
const MB = 1048576;

/** İşlemci yüzdesi ve olay döngüsü gecikmesi örnekleyicisi (isteklerden bağımsız, hafif). */
export interface HealthSampler {
  cpuPercent(): number;
  eventLoopLagMsP95(): number;
  stop(): void;
}

export function createHealthSampler(): HealthSampler {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  let histogramSince = performance.now();
  let lastWall = performance.now();
  let lastCpu = process.cpuUsage();
  let cpu = 0;
  return {
    cpuPercent() {
      const wall = performance.now();
      if (wall - lastWall >= 2000) {
        const used = process.cpuUsage(lastCpu);
        cpu = ((used.user + used.system) / 1000 / (wall - lastWall)) * 100;
        lastWall = wall;
        lastCpu = process.cpuUsage();
      }
      return Math.round(cpu * 10) / 10;
    },
    eventLoopLagMsP95() {
      const wall = performance.now();
      const ms = histogram.count > 0 ? histogram.percentile(95) / 1e6 : 0;
      // Eski örnekler yeni durumu gizlemesin: dakikada bir sıfırlanır.
      if (wall - histogramSince > 60_000) {
        histogram.reset();
        histogramSince = wall;
      }
      return Number.isFinite(ms) ? Math.round(ms * 100) / 100 : 0;
    },
    stop: () => histogram.disable(),
  };
}

export interface LiveContext {
  rt: Runtime;
  startedAt: number;
  revision: string;
  sockets: { total: number; accounts: number };
  sampler: HealthSampler;
}

export function buildLive(ctx: LiveContext): AdminLive {
  const { rt } = ctx;
  const now = rt.clock.now();
  const mem = process.memoryUsage();
  let stages = 0;
  const rows: AdminRoomRow[] = [];
  for (const room of rt.rooms.values()) {
    stages += room.stages.size;
    let players = 0;
    let connected = 0;
    let spectators = 0;
    for (const p of room.players.values()) {
      if (p.spectator) spectators += 1;
      else players += 1;
      if (p.conn) connected += 1;
    }
    rows.push({
      code: room.code,
      phase: room.phase,
      players,
      connected,
      spectators,
      stages: room.stages.size,
      gameId: room.match?.games[room.match.index]?.id ?? null,
      ageSec: Math.max(0, Math.floor((now - room.createdAt) / 1000)),
    });
  }
  rows.sort((a, b) => a.ageSec - b.ageSec);
  return {
    rooms: rt.rooms.size,
    players: countPlayers(rt),
    activeMatches: countActiveMatches(rt),
    stages,
    sockets: {
      total: ctx.sockets.total,
      accounts: ctx.sockets.accounts,
      guests: Math.max(0, ctx.sockets.total - ctx.sockets.accounts),
    },
    memory: {
      rssMb: Math.round(mem.rss / MB),
      heapUsedMb: Math.round(mem.heapUsed / MB),
      heapTotalMb: Math.round(mem.heapTotal / MB),
    },
    cpuPercent: ctx.sampler.cpuPercent(),
    eventLoopLagMsP95: ctx.sampler.eventLoopLagMsP95(),
    tickMsP95: Math.round(rt.metrics.tickMsP95() * 100) / 100,
    bytesOutPerSec: Math.round(rt.metrics.bytesOutPerSec(now)),
    uptimeSec: Math.floor((Date.now() - ctx.startedAt) / 1000),
    startedAt: ctx.startedAt,
    version: APP_VERSION,
    revision: ctx.revision,
    draining: rt.draining,
    roomList: rows.slice(0, MAX_ROOM_ROWS),
  };
}

export function buildStats(stats: StatsStore, accounts: AccountStore, now: number): AdminStats {
  const m = accounts.adminMetrics(now);
  const accountPart: AdminStats["accounts"] = {
    total: m.total,
    verified: m.verified,
    google: m.google,
    password: m.password,
    friendships: m.friendships,
    badgesAwarded: m.badgesAwarded,
    newPerDay: m.newPerDay.map((d) => ({ day: dayLabel(d.dayStart), count: d.count })),
  };
  const part = stats.reader?.stats(now);
  if (part) return { ...part, accounts: accountPart };
  return {
    enabled: false,
    windowDays: 90,
    daily: [],
    weekly: [],
    playerCounts: [],
    games: [],
    feedback: { count: 0, avg: null, byRating: [0, 0, 0, 0, 0], latest: [] },
    selection: [],
    gameCounts: [],
    accounts: accountPart,
  };
}

export function buildErrors(stats: StatsStore, now: number): AdminErrors {
  const part = stats.reader?.errors(now);
  if (part) return { enabled: true, ...part };
  return { enabled: false, groups: [], perDay: [], perf: [], failures: [] };
}

/** Hesaplar sekmesi: hesap toplamları (hesap deposu) + e-posta gönderim sayaçları (istatistik deposu). */
export function buildAccounts(stats: StatsStore, accounts: AccountStore, now: number): AdminAccounts {
  const m = accounts.adminMetrics(now);
  const mail = stats.reader?.mail(now);
  const zero = (): { ok: number; failed: number } => ({ ok: 0, failed: 0 });
  return {
    total: m.total,
    verified: m.verified,
    methods: { google: m.google - m.both, password: m.password - m.both, both: m.both },
    active7: m.active7,
    active30: m.active30,
    suspended: m.suspended,
    newPerDay: m.newPerDay.map((d) => ({ day: dayLabel(d.dayStart), count: d.count })),
    mail: mail
      ? { enabled: true, ...mail }
      : { enabled: false, days: [], totals: { verify: zero(), reset: zero(), admin: zero() } },
  };
}

/**
 * "Son yayınlar": başlangıç kayıtlarından süreli liste (satırlar yeniden eskiye). Süren sunucu `runId`; temiz kapanışta
 * bitiş kapanış anıdır; kapanış kaydı olmayan (çökme, zorla durdurma) başlangıç için bitiş en geç sonraki başlangıçtır.
 */
export function buildReleases(
  rows: readonly ServerStartRow[],
  runId: number | null,
  now: number,
): AdminRelease[] {
  return rows.map((r, i) => {
    const newer = i > 0 ? rows[i - 1] : undefined;
    const running = r.id === runId;
    const endedAt = running ? null : (r.stoppedAt ?? newer?.startedAt ?? null);
    const end = running ? now : endedAt;
    return {
      id: r.id,
      revision: r.revision,
      version: r.version,
      startedAt: r.startedAt,
      endedAt,
      durationSec: end === null ? null : Math.max(0, Math.round((end - r.startedAt) / 1000)),
      state: running ? "running" : r.stoppedAt !== null ? "clean" : "unclean",
    };
  });
}
