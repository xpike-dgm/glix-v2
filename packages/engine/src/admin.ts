import type { Announcement } from "./siteNotice.js";

/**
 * Yönetici paneli (U16, A1, A2 ve A3) uç yanıtlarının tipleri: sunucu üretir, panel okur (docs/PROTOKOL.md "Yönetici uçları").
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
/** Hesabın Glix defterinden bir satır (yönetici dökümü). */
export interface AdminGlixRow {
  at: number;
  /** İşaretli tutar. */
  amount: number;
  reason: "mac" | "rozet" | "yonetici" | "satin-alma";
  ref: string | null;
}

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
  /** Glix bakiyesi ve son hareketler (yeniden eskiye). */
  glix: { balance: number; ledger: AdminGlixRow[] };
  /** Sahip olunan kozmetikler (`pricePaid` 0: armağan) ve kuşanılanlar (tür -> ürün kimliği). */
  cosmetics: {
    owned: { itemId: string; acquiredAt: number; pricePaid: number }[];
    equipped: Record<string, string>;
  };
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

// ---- A3: içerik, bildirim ve bakım ------------------------------------------------------------------------

/** Bir oyunun yönetici anahtarları. `randomPool` etkin değerdir (yönetici ayarı varsa o, yoksa motor varsayılanı). */
export interface AdminGameSwitch {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Kapalı oyun lobi kataloğundan ve rastgele seçimden çıkar; süren maç normal biter. */
  open: boolean;
  /** Etkin rastgele havuz üyeliği. */
  randomPool: boolean;
  /** Motorun varsayılanı (oyun tanımındaki `randomPool`). */
  engineRandomPool: boolean;
  /** Yönetici ayarı motor varsayılanından farklı mı (panelde "değiştirildi" işareti). */
  overridden: boolean;
}

/** `GET /api/admin/content`. */
export interface AdminContent {
  games: AdminGameSwitch[];
  announcement: Announcement | null;
}

export type AdminReleaseState = "running" | "clean" | "unclean";

/** Bir sunucu başlangıcı ("son yayınlar"). `endedAt`: temiz kapanışta kapanış anı; değilse sonraki başlangıç (üst sınır). */
export interface AdminRelease {
  id: number;
  revision: string;
  version: string;
  startedAt: number;
  endedAt: number | null;
  durationSec: number | null;
  state: AdminReleaseState;
}

/** `GET /api/admin/maintenance`. */
export interface AdminMaintenance {
  on: boolean;
  activeMatches: number;
  rooms: number;
  players: number;
  /** Sunucu boşaltma (SIGTERM) kipinde mi. */
  draining: boolean;
  backup: {
    /** Son 24 saatte alınan yedek sayısı ve günlük sınır. */
    usedToday: number;
    limit: number;
    /** Sınır dolduysa yeniden alınabileceği an (ms), değilse null. */
    nextAt: number | null;
  };
  /** Son 20 başlangıç, yeniden eskiye. */
  releases: AdminRelease[];
}

/** Herkese bildirimin sonucu ya da son durumu. */
export interface AdminBroadcastResult {
  at: number;
  title: string;
  total: number;
  sent: number;
  failed: number;
  removed: number;
  /** false: gönderim sürüyor. */
  finished: boolean;
}

/** `GET /api/admin/push/status`. */
export interface AdminBroadcastStatus {
  /** Bildirim gönderimi bu sunucuda açık mı (VAPID ayarlı). */
  enabled: boolean;
  /** Kayıtlı hesap aboneliği sayısı. */
  subscribers: number;
  /** Yeni gönderim en erken bu anda yapılabilir (ms); şimdi serbestse null. */
  nextAllowedAt: number | null;
  last: AdminBroadcastResult | null;
}

// ---- A4: içerik havuzları ----------------------------------------------------------------------------------------

/** Bir havuzun form alanı (panel formu bundan kurulur). */
export interface AdminPoolField {
  key: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  long: boolean;
}

export interface AdminPoolSummary {
  id: string;
  gameId: string;
  gameName: string;
  label: string;
  hint: string;
  fields: AdminPoolField[];
  /** Etkin havuz bundan küçükse yerleşik havuz kullanılır. */
  min: number;
  /** Bir maçın havuzdan çektiği en çok girdi. */
  needed: number;
  builtin: number;
  /** Eklenen (yönetici) girdi sayısı. */
  custom: number;
  /** Kapatılan yerleşik girdi sayısı. */
  disabled: number;
  /** Yeni maçlarda kullanılacak girdi sayısı (yerleşik açık + eklenen). */
  active: number;
  /** Değişiklik var ve yeni maçlara uygulanıyor. */
  applied: boolean;
  /** Değişiklik var ama etkin sayı `min`'in altında: yerleşik havuz kullanılıyor. */
  belowMin: boolean;
}

/** `GET /api/admin/pools`. */
export interface AdminPools {
  pools: AdminPoolSummary[];
  /** Havuz başına en çok eklenen girdi. */
  customMax: number;
}

export type AdminPoolFilter = "all" | "builtin" | "custom" | "disabled";

export interface AdminPoolEntry {
  /** Girdiyi tanıtan anahtar (büyük/küçük harf ve aksan duyarsız); işlemlerde bu gönderilir. */
  key: string;
  source: "builtin" | "custom";
  /** Yalnız yerleşik girdiler kapatılabilir. */
  disabled: boolean;
  fields: Record<string, string>;
}

/** `GET /api/admin/pools/entries`. */
export interface AdminPoolPage {
  pool: AdminPoolSummary;
  entries: AdminPoolEntry[];
  /** Süzgece uyan toplam girdi. */
  total: number;
  page: number;
  pageSize: number;
}

export type AdminPoolLineStatus = "ok" | "invalid" | "duplicate" | "banned" | "full";

export interface AdminPoolLine {
  /** 1'den başlayan satır numarası (boş satırlar atlanır ama numara korunur). */
  line: number;
  status: AdminPoolLineStatus;
  /** Durum `ok` değilse Türkçe açıklama. */
  message: string;
  fields: Record<string, string>;
}

/** `POST /api/admin/pools/check` ve `pools/bulk` yanıtı. */
export interface AdminPoolBulk {
  lines: AdminPoolLine[];
  ok: number;
  /** Yalnız `pools/bulk`: kaydedilen satır sayısı. */
  added: number;
  pool: AdminPoolSummary;
}
