/**
 * Yönetici paneli (U16, A1 ve A2) uç yanıtlarının tipleri: sunucu üretir, panel okur (docs/PROTOKOL.md "Yönetici uçları").
 * A1 tipleri kişi bilgisi taşımaz. A2 hesap tipleri (`AdminAccount*`, `AdminAudit*`) kullanıcı adı taşır; e-posta yalnız
 * `AdminAccountDetail` içindedir.
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

// ---- A2: hesaplar ve işlem kaydı -----------------------------------------------------------------------------

/** Bir e-posta türünün günlük sayacı: servise kabul edilen ve edilmeyen deneme sayısı. Adres tutulmaz. */
export interface AdminMailCount {
  ok: number;
  failed: number;
}

/** E-posta türleri: doğrulama, şifre sıfırlama, yönetici giriş kodu. */
export type AdminMailKind = "verify" | "reset" | "admin";

export interface AdminMailDay extends Record<AdminMailKind, AdminMailCount> {
  /** UTC gün, `YYYY-MM-DD`. */
  day: string;
}

/** `GET /api/admin/accounts`: hesap toplamları ve e-posta gönderim durumu. */
export interface AdminAccounts {
  total: number;
  verified: number;
  /** Giriş yöntemi dağılımı; üçü ayrık ve toplamı `total`'dır (yöntemi olmayan hesap yoktur). */
  methods: { google: number; password: number; both: number };
  /** Son 7 / 30 günde en az bir maç bitiren hesap sayısı. */
  active7: number;
  active30: number;
  /** Şu an askıda olan hesap sayısı. */
  suspended: number;
  newPerDay: { day: string; count: number }[];
  mail: {
    /** İstatistik kaydı kapalıysa sayaç tutulmaz. */
    enabled: boolean;
    /** Son 30 gün, eskiden yeniye. */
    days: AdminMailDay[];
    /** 30 günlük toplam. */
    totals: Record<AdminMailKind, AdminMailCount>;
  };
}

/** Arama sonucu satırı: e-posta içermez. */
export interface AdminAccountRow {
  id: number;
  username: string;
  createdAt: number;
  verified: boolean;
  google: boolean;
  password: boolean;
  /** En son oturum hareketi (saat hassasiyetinde); oturumu yoksa null. */
  lastSeen: number | null;
  matches: number;
  suspended: boolean;
}

/** `GET /api/admin/accounts/search`. */
export interface AdminAccountSearch {
  results: AdminAccountRow[];
  limit: number;
}

/** `GET /api/admin/accounts/detail`: e-postanın göründüğü tek yer. Bu uç her çağrıda işlem kaydına yazılır. */
export interface AdminAccountDetail {
  id: number;
  username: string;
  email: string;
  createdAt: number;
  verified: boolean;
  google: boolean;
  password: boolean;
  usernameChangedAt: number | null;
  lastSeen: number | null;
  sessions: number;
  matches: number;
  wins: number;
  games: number;
  badges: number;
  friends: number;
  /** Yönetici listesindeki hesap: ad değiştirme, askı, silme ve oturum kapatma yapılamaz. */
  protected: boolean;
  suspension: { since: number; until: number | null; reason: string } | null;
}

export interface AdminAuditEntry {
  id: number;
  /** İşlemi yapan yönetici hesabı. */
  actorId: number;
  action: string;
  targetId: number | null;
  detail: string;
  at: number;
}

/** `GET /api/admin/audit`: yeniden eskiye sayfa; `nextBefore` doluysa sonraki sayfa için `before` olarak verilir. */
export interface AdminAuditPage {
  entries: AdminAuditEntry[];
  nextBefore: number | null;
}
