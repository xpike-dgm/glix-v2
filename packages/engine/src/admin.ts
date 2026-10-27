/**
 * Yönetici paneli (U16, A1) uç yanıtlarının tipleri: sunucu üretir, panel okur (docs/PROTOKOL.md "Yönetici uçları").
 * Kişi bilgisi taşımaz: e-posta, kullanıcı adı, IP, oyuncu adı ve oyun durumu bu tiplerde yoktur.
 */

/** `GET /api/admin/status`. */
export interface AdminStatus {
  /** `need_otp`: kod gerekli; `ready`: panel açık. */
  state: "need_otp" | "ready";
}

export interface AdminRoomRow {
  code: string;
  phase: string;
  /** Odadaki oyuncu sayısı (izleyiciler dahil değil). */
  players: number;
  connected: number;
  spectators: number;
  stages: number;
  /** Maç sürüyorsa geçerli oyunun kimliği. */
  gameId: string | null;
  ageSec: number;
}

export interface AdminLive {
  rooms: number;
  players: number;
  activeMatches: number;
  stages: number;
  sockets: { total: number; guests: number; accounts: number };
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  /** Son örnekleme aralığındaki işlemci kullanımı (tek çekirdek = 100). */
  cpuPercent: number;
  eventLoopLagMsP95: number;
  tickMsP95: number;
  bytesOutPerSec: number;
  uptimeSec: number;
  startedAt: number;
  version: string;
  revision: string;
  draining: boolean;
  /** Tabloda gösterilen en fazla satır; `rooms` bundan çoksa liste kısaltılmıştır. */
  roomList: AdminRoomRow[];
}

export interface AdminDayCount {
  /** UTC gün, `YYYY-MM-DD`. */
  day: string;
  matches: number;
  players: number;
}

export interface AdminGameStat {
  gameId: string;
  plays: number;
  avgDurationSec: number;
  /** Yarıda kalan ya da çöken oyunların payı (0..1). */
  abandonRate: number;
  failed: number;
  /** Oyunun geçtiği maçların geri bildirim puanı ortalaması (geri bildirim maç başınadır); yoksa null. */
  ratingAvg: number | null;
  ratingCount: number;
}

export interface AdminStats {
  enabled: boolean;
  windowDays: number;
  daily: AdminDayCount[];
  weekly: { weekStart: string; matches: number; players: number }[];
  playerCounts: { players: number; matches: number }[];
  games: AdminGameStat[];
  feedback: {
    count: number;
    avg: number | null;
    byRating: number[];
    latest: { rating: number; text: string; at: number }[];
  };
  selection: { mode: string; matches: number; avgGameCount: number }[];
  gameCounts: { count: number; matches: number }[];
  accounts: {
    total: number;
    verified: number;
    google: number;
    password: number;
    friendships: number;
    badgesAwarded: number;
    newPerDay: { day: string; count: number }[];
  };
}

export interface AdminErrorGroup {
  message: string;
  frame: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  platforms: { ios: number; android: number; diger: number };
  browsers: string[];
  versions: string[];
}

export interface AdminPerfRow {
  platform: string;
  samples: number;
  reconnectsPerSample: number;
  reloadsPerSample: number;
  ackP95: number;
  tapP95: number;
  longTasksPerSample: number;
  rttMedian: number;
}

export interface AdminGameFailure {
  gameId: string;
  fn: string;
  message: string;
  at: number;
}

export interface AdminErrors {
  enabled: boolean;
  groups: AdminErrorGroup[];
  perDay: { day: string; count: number }[];
  perf: AdminPerfRow[];
  failures: AdminGameFailure[];
}
