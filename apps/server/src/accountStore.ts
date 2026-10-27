import type { DatabaseSync } from "node:sqlite";
import type { AdminAccountDetail, AdminAccountRow } from "@glix/engine";
import { createFriendStore, FRIENDS_SCHEMA, type FriendStore } from "./friendStore.js";
import { log } from "./log.js";
import { loadSqlite } from "./statsStore.js";

/** Oturum bu süre sonra kendiliğinden düşer (çerez Max-Age ile aynı). */
export const SESSION_TTL_MS = 180 * 24 * 3600 * 1000;
/** `last_seen` en çok bu aralıkla güncellenir (her WS bağlantısında yazma olmasın). */
const TOUCH_EVERY_MS = 3600 * 1000;
/** Profilde gösterilen son maç sayısı ve "en çok birlikte oynadıkların" uzunluğu. */
export const RECENT_MATCHES = 10;
export const TOP_COPLAYERS = 5;

export interface Account {
  id: number;
  username: string;
  email: string;
}

export interface AccountWithHash extends Account {
  passHash: string | null;
}

export type TokenKind = "verify" | "reset";

/** Bir mini oyunda hesaplı oyuncunun sonucu (`account_games` satırı). */
export interface GameRow {
  accountId: number;
  gameId: string;
  /** Oyunu oynayan (sıralamaya giren) oyuncu sayısı. */
  players: number;
  miniScore: number;
  /** Mini puana göre sıra; eşit puan aynı sırayı paylaşır (1, 1, 3). */
  rank: number;
  /** Oyunun sonuçtaki sayaçları (ör. `kahin`, `perfects`); yalnız sunucu muhasebesi. Sıfırlar yazılmaz. */
  stats?: Readonly<Record<string, number>>;
}

/** Bir maçta hesaplı oyuncunun sonucu (`account_matches` satırı). */
export interface MatchRow {
  accountId: number;
  players: number;
  games: number;
  score: number;
  place: number;
}

/** Maçta birlikte oynayan hesaplar; her çift için iki yönlü sayaç artar. */
export type CoplayPair = readonly [accountId: number, otherAccountId: number];

/** Profil ekranının ham verisi (SQL toplamları). Oyun adı yok; ad katalogdan eklenir. */
export interface ProfileData {
  username: string;
  createdAt: number;
  totals: { matches: number; wins: number; winRate: number; games: number; gameWins: number };
  favoriteGame: { id: string; plays: number } | null;
  perGame: { gameId: string; plays: number; wins: number; bestMini: number; avgMini: number }[];
  recent: { endedAt: number; players: number; place: number; score: number }[];
  coPlayers: { username: string; matches: number }[];
  /** Kazanılmış rozetler (kimlik + zaman); adlar `badges.ts`'te. */
  badges: { badgeId: string; earnedAt: number }[];
}

/** Rozet değerlendirmesinin SQL toplamları (maç satırı yazıldıktan sonra). */
export interface BadgeStats {
  matches: number;
  wins: number;
  /** Birinci olunan farklı oyun sayısı. */
  winGames: number;
  /** Oynanan oyunların kimlikleri. */
  playedGames: string[];
  /** Kabul edilmiş bir arkadaşla en çok birlikte oynanan maç sayısı. */
  friendCoplayMax: number;
  /** Son maçların galibiyet bayrakları, en yeni önde (en çok 3). */
  lastWon: boolean[];
  /** Rus Ruleti'nde Kâhin unvanı kazanılan toplam oyun sayısı (`account_game_stats`, anahtar `kahin`). */
  kahinGames: number;
  /** Kule Ustası'nda tek oyundaki en çok kusursuz bırakış (anahtar `perfects`). */
  maxPerfects: number;
}

/** Sıralama satırı: hesap ve dönemdeki toplamları (hiç maçı yoksa sıfırlar). */
export interface StandingRow {
  accountId: number;
  username: string;
  matches: number;
  wins: number;
  score: number;
}

/** Bir oyunda bir hesabın dönemdeki birincilik/oynama sayısı. */
export interface GameStandingRow {
  gameId: string;
  accountId: number;
  username: string;
  plays: number;
  wins: number;
}

/** Kullanıcı adı en sık bu aralıkla değiştirilebilir (ilk değişiklik hesap açılışından sayılmaz, hemen serbest). */
export const USERNAME_COOLDOWN_MS = 7 * 24 * 3600 * 1000;

/** `taken`: başka hesapta var; `cooldown`: bekleme süresi dolmadı (`availableAt` ms). */
export type RenameResult =
  | { ok: true; account: Account; availableAt: number }
  | { ok: false; reason: "taken" }
  | { ok: false; reason: "cooldown"; availableAt: number }
  | { ok: false; reason: "missing" };

/** Hesabın "verimi indir" dökümü için ham veri (şifre özeti ve oturum belirteçleri içermez). */
export interface AccountExportData {
  username: string;
  email: string;
  emailVerified: boolean;
  /** Google `sub` değeri (bağlı değilse null); hesap sahibinin kendi verisidir. */
  googleSub: string | null;
  /** Şifre özeti saklanıyor mu (özetin kendisi hiçbir yerde dışarı verilmez). */
  hasPassword: boolean;
  createdAt: number;
  usernameChangedAt: number | null;
  sessions: { createdAt: number; lastSeen: number }[];
  /** Kayıtlı askı bilgisi (süresi dolmuş olabilir; dökümü yazan süreyi denetler). Hesap sahibinin kendi verisidir. */
  suspension: Suspension | null;
  games: {
    gameId: string;
    endedAt: number;
    players: number;
    miniScore: number;
    rank: number;
    won: boolean;
  }[];
  /** Oyun sonu sayaçları (rozet muhasebesi). */
  gameStats: { gameId: string; endedAt: number; key: string; value: number }[];
  matches: { endedAt: number; players: number; games: number; score: number; place: number; won: boolean }[];
  coplay: { username: string; matches: number; lastAt: number }[];
}

/** Yönetici ikinci adımı: tek kullanımlık kod denemesinin sonucu. */
export type AdminOtpCheck = "ok" | "invalid" | "locked" | "expired" | "none";

/** Yönetici işlem kaydı satırı (kod, belirteç ve e-posta içermez). */
export interface AdminAuditRow {
  id: number;
  /** İşlemi yapan yönetici hesabı. */
  accountId: number;
  action: string;
  /** İşlemin hedefi olan hesap (hesap dışı olaylarda null). Hesap silinse de kimlik kayıtta kalır. */
  targetId: number | null;
  detail: string;
  at: number;
}

/** Hesap askıda: başlangıç, bitiş (null = süresiz) ve yönetici notu. */
export interface Suspension {
  since: number;
  until: number | null;
  reason: string;
}

/** Yönetici hesap araması: kullanıcı adı öneki (küçük harf) ya da tam e-posta (küçük harf). */
export type AdminSearchQuery = { kind: "prefix"; value: string } | { kind: "email"; value: string };

/** Yönetici aramasında en çok bu kadar satır döner. */
export const ADMIN_SEARCH_LIMIT = 20;

/** Askı bitmişse (ya da hiç yoksa) false. `until` null = süresiz. */
function suspensionActive(at: number | null, until: number | null, now: number): boolean {
  return at !== null && (until === null || until > now);
}

/** Yönetici panelinin hesap toplamları: yalnız sayılar, kişi yok. */
export interface AccountMetrics {
  total: number;
  verified: number;
  google: number;
  password: number;
  friendships: number;
  badgesAwarded: number;
  /** Hem şifresi hem Google bağlantısı olan hesaplar (`google` ve `password` bunları da sayar). */
  both: number;
  /** Son 7 / 30 günde en az bir maç bitiren (final'e varan) hesap sayısı. */
  active7: number;
  active30: number;
  /** Şu an askıda olan hesaplar. */
  suspended: number;
  /** UTC gün başlangıcı (ms) ve o gün açılan hesap sayısı; son 30 gün, sıfırlar dahil. */
  newPerDay: { dayStart: number; count: number }[];
}

export type CreateResult = { ok: true; account: Account } | { ok: false; field: "username" | "email" };

/**
 * Hesap ve oturum deposu. İstatistik deposundan ayrı göç sırası (`account_schema_version`) kullanır;
 * aynı SQLite dosyasını paylaşabilir. Dosya yolu verilmezse bellekte açılır (yeniden başlatınca silinir).
 * Hata fırlatabilir: çağıran (auth.ts) 500 döner, sunucu çökmez.
 */
export interface AccountStore extends FriendStore {
  create(username: string, email: string, passHash: string, now: number): CreateResult;
  /** Kullanıcı adı ya da e-posta (küçük harfe çevrilmiş) ile bulur. */
  findByLogin(login: string): AccountWithHash | null;
  findById(id: number): Account | null;
  /** Google `sub` ile bağlı hesap. */
  findByGoogleSub(sub: string): Account | null;
  /** E-posta (küçük harfe çevrilmiş) ile hesap. */
  findByEmail(email: string): Account | null;
  /** Hesap Google'a bağlı mı. */
  hasGoogle(accountId: number): boolean;
  /** Hesaba Google kimliği bağlar; `sub` başka hesapta ya da hesap zaten bağlıysa false. */
  linkGoogle(accountId: number, sub: string): boolean;
  /** Google ile yeni hesap: e-posta doğrulanmış, şifresiz. `sub` zaten kayıtlıysa "sub". */
  createGoogle(
    username: string,
    email: string,
    sub: string,
    now: number,
  ): CreateResult | { ok: false; field: "sub" };
  /** E-postası doğrulanmış mı. */
  isVerified(accountId: number): boolean;
  /** Şifre özeti; Google ile açılıp şifre belirlenmemişse null. */
  passwordHash(accountId: number): string | null;
  /** E-postayı doğrulanmış işaretler. */
  markVerified(accountId: number): void;
  /**
   * Tek kullanımlık belirteç kaydeder (yalnız özeti). `reset` türünde hesabın eski sıfırlama belirteçleri silinir.
   */
  createToken(kind: TokenKind, accountId: number, tokenHash: string, expiresAt: number): void;
  /** Geçerli belirteci tek hamlede tüketir; hesabı döner. Yoksa, süresi dolmuşsa ya da kullanılmışsa null. */
  consumeToken(kind: TokenKind, tokenHash: string, now: number): number | null;
  /**
   * Yeni şifre özeti yazar; hesabın sıfırlama belirteçlerini siler ve oturumlarını siler
   * (`keepSession` verilirse yalnız o oturum kalır).
   */
  replacePassword(accountId: number, passHash: string, keepSession: string | null): void;
  createSession(accountId: number, tokenHash: string, now: number): void;
  /** Geçerli oturumun hesabı; süresi dolmuşsa ya da yoksa null. */
  resolveSession(tokenHash: string, now: number): Account | null;
  deleteSession(tokenHash: string): void;
  /** Süresi dolan oturumları siler. */
  purge(now: number): void;
  /**
   * Kullanıcı adını değiştirir (büyük/küçük harf duyarsız benzersiz; kendi adının harf boyu değişebilir).
   * Son değişiklikten `USERNAME_COOLDOWN_MS` dolmadıysa `cooldown`. Denetim ve yazma tek işlemde yapılır.
   */
  changeUsername(accountId: number, username: string, now: number): RenameResult;
  /** Bir sonraki değişikliğin serbest olacağı an (ms); şimdi serbestse null. */
  usernameAvailableAt(accountId: number, now: number): number | null;
  /** Kullanıcı adıyla (yalnız kullanıcı adı; e-posta eşleşmez) hesap bulur. */
  findByUsername(username: string): Account | null;
  /**
   * Biten mini oyunun hesaplı oyuncu satırlarını tek işlemde yazar (`won` = sıra 1).
   * Silinmiş hesabın satırı sessizce atlanır. Hata fırlatabilir; çağıran yutar.
   */
  recordGame(endedAt: number, rows: readonly GameRow[]): void;
  /**
   * Biten maçın satırlarını ve birlikte oynama sayaçlarını tek işlemde yazar (`won` = yer 1).
   * Hata fırlatabilir; çağıran yutar.
   */
  recordMatch(endedAt: number, rows: readonly MatchRow[], pairs: readonly CoplayPair[]): void;
  /** Profil toplamları; hesap yoksa null. `recent` ve `coPlayers` yalnız `full` iken doludur. */
  profile(accountId: number, full: boolean): ProfileData | null;
  /** Rozet değerlendirmesi için toplamlar. */
  badgeStats(accountId: number): BadgeStats;
  /** Kazanılmış rozetler (kazanma sırasıyla). */
  earnedBadges(accountId: number): { badgeId: string; earnedAt: number }[];
  /** Rozetleri yazar; yalnızca yeni kazanılanların kimliklerini döner (zaten olan atlanır, ikinci kez verilmez). */
  awardBadges(accountId: number, badgeIds: readonly string[], at: number): string[];
  /**
   * Verilen hesapların (en çok ~200) maç toplamları; `since` doluysa yalnız o andan sonra biten maçlar.
   * Tek toplu sorgu; maçı olmayan hesap da sıfırlarla döner.
   */
  standings(accountIds: readonly number[], since: number | null): StandingRow[];
  /** Verilen hesapların oyun başına birincilik/oynama sayıları (en az bir oyunu olanlar). */
  gameStandings(accountIds: readonly number[], since: number | null): GameStandingRow[];
  /**
   * Hesabın istatistik ve arkadaşlık verisini siler (oyun, maç, rozet, birlikte oynama; karşı taraftaki sayaçlar dahil;
   * arkadaşlıklar, istekler ve engeller, iki yönde).
   * Hesabın kendisine dokunmaz; hesap silme (H10) bunu çağırır, tablolar ayrıca `ON DELETE CASCADE` taşır.
   */
  deleteAccountData(accountId: number): void;
  /** "Verimi indir" için hesaba ait ham veri; hesap yoksa null. */
  exportData(accountId: number): AccountExportData | null;
  /** Oturumun açılış anı (ms); oturum yoksa null. "Taze giriş" denetimi için. */
  sessionCreatedAt(tokenHash: string): number | null;
  /** Arkadaşlık/istek/engel ilişkisi olan hesapların kimlikleri (iki yönde, tekrarsız); silmeden önce bildirim için. */
  relatedAccountIds(accountId: number): number[];
  /**
   * Hesabı kalıcı siler (H10): istatistik, rozet, arkadaşlık ve engeller (`deleteAccountData`), oturumlar, e-posta
   * belirteçleri ve hesap satırı tek işlemde gider. Geri alınamaz. Hesap yoksa false.
   */
  deleteAccount(accountId: number): boolean;
  /**
   * Yönetici işlem kaydı yazar (`admin_audit`); `detail` kod/belirteç/e-posta taşımamalı. `targetId` işlemin
   * hedefi olan hesap kimliğidir.
   */
  adminAudit(accountId: number, action: string, detail: string, at: number, targetId?: number | null): void;
  /** Son `limit` yönetici kaydı (en yeni önde). */
  adminAuditTail(limit: number): AdminAuditRow[];
  /** Sayfalı kayıt: `before` (kayıt kimliği) verilirse ondan eski olanlar, en yeni önde, en çok `limit`. */
  adminAuditPage(before: number | null, limit: number): AdminAuditRow[];
  /** Kullanıcı adı önekiyle ya da tam e-postayla arama (en çok `ADMIN_SEARCH_LIMIT`); satırlarda e-posta yoktur. */
  adminSearch(query: AdminSearchQuery, now: number): AdminAccountRow[];
  /** Tek hesabın yönetici dökümü (e-posta dahil); `protected` alanını çağıran doldurur. */
  adminAccountDetail(accountId: number, now: number): Omit<AdminAccountDetail, "protected"> | null;
  /** Hesap şu an askıdaysa bilgisi; süresi dolmuşsa ya da hiç askıya alınmamışsa null. */
  suspension(accountId: number, now: number): Suspension | null;
  /**
   * Hesabı askıya alır (zaten askıdaysa yeni süre/sebep yazar) ve tüm oturumlarını siler. `until` null = süresiz.
   * Hesap yoksa false.
   */
  suspend(accountId: number, now: number, until: number | null, reason: string): boolean;
  /** Askıyı kaldırır; hesap yoksa ya da askıda değilse false. */
  unsuspend(accountId: number, now: number): boolean;
  /** Yönetici zoruyla kullanıcı adı değişikliği: bekleme süresini aşar ve hesabın kendi bekleme sayacına dokunmaz. */
  forceUsername(accountId: number, username: string): "ok" | "taken" | "missing";
  /** Hesabın tüm oturumlarını siler ("her yerden çıkar"); silinen oturum sayısını döner. */
  deleteSessionsOf(accountId: number): number;
  /** Hesabın yönetici kodunu (yalnız özeti + tuz) kaydeder; eski kod silinir. Kod isteyen oturuma bağlıdır. */
  adminOtpPut(
    accountId: number,
    sessionHash: string,
    salt: string,
    codeHash: string,
    expiresAt: number,
  ): void;
  /**
   * Kod denemesi (tek işlemde): süre/oturum/deneme sınırı denetlenir, `matches` özeti karşılaştırır. Doğruysa kod silinir
   * (tek kullanım); yanlış denemeler sayılır, `maxAttempts`'a varınca kod silinir ("locked").
   */
  adminOtpCheck(
    accountId: number,
    sessionHash: string,
    now: number,
    maxAttempts: number,
    matches: (salt: string, codeHash: string) => boolean,
  ): AdminOtpCheck;
  /** Yönetici çerezi oturumu: yalnız özet saklanır; hesap oturumu silinince birlikte gider. */
  adminSessionCreate(
    tokenHash: string,
    accountId: number,
    sessionHash: string,
    now: number,
    expiresAt: number,
  ): void;
  /** Çerez hâlâ geçerli mi: süre dolmadı, aynı hesap ve aynı hesap oturumu. */
  adminSessionValid(tokenHash: string, accountId: number, sessionHash: string, now: number): boolean;
  adminSessionDelete(tokenHash: string): void;
  /** Panel için hesap toplamları. */
  adminMetrics(now: number): AccountMetrics;
  close(): void;
}

const MIGRATIONS: readonly string[] = [
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     username TEXT NOT NULL,
     username_lc TEXT NOT NULL UNIQUE,
     email TEXT NOT NULL UNIQUE,
     email_verified INTEGER NOT NULL DEFAULT 0,
     pass_hash TEXT,
     google_sub TEXT UNIQUE,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE sessions (
     id_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     last_seen INTEGER NOT NULL
   );
   CREATE INDEX sessions_account ON sessions (account_id);
   CREATE TABLE email_tokens (
     kind TEXT NOT NULL,
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     expires_at INTEGER NOT NULL
   );`,
  // İstatistik (H5): yalnız hesaplı oyuncular. Hesap silinince satırlar da gider.
  `CREATE TABLE account_games (
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     game_id TEXT NOT NULL,
     ended_at INTEGER NOT NULL,
     players INTEGER NOT NULL,
     mini_score INTEGER NOT NULL,
     rank INTEGER NOT NULL,
     won INTEGER NOT NULL
   );
   CREATE INDEX account_games_account ON account_games (account_id, ended_at);
   CREATE TABLE account_matches (
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     ended_at INTEGER NOT NULL,
     players INTEGER NOT NULL,
     games INTEGER NOT NULL,
     score INTEGER NOT NULL,
     place INTEGER NOT NULL,
     won INTEGER NOT NULL
   );
   CREATE INDEX account_matches_account ON account_matches (account_id, ended_at);
   CREATE TABLE account_coplay (
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     other_account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     matches INTEGER NOT NULL,
     last_at INTEGER NOT NULL,
     PRIMARY KEY (account_id, other_account_id)
   );
   CREATE INDEX account_coplay_other ON account_coplay (other_account_id);`,
  // Arkadaşlar (H7): tek satırlık kanonik çift ve engeller. Hesap silinince satırlar da gider.
  FRIENDS_SCHEMA,
  // Rozetler (H6): kazanılan rozet bir kez yazılır. Hesap silinince satırlar da gider.
  `CREATE TABLE badges (
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     badge_id TEXT NOT NULL,
     earned_at INTEGER NOT NULL,
     PRIMARY KEY (account_id, badge_id)
   );`,
  // Kullanıcı adı değişikliği: son değişiklik anı (null = hiç değişmedi, hemen serbest).
  `ALTER TABLE accounts ADD COLUMN username_changed_at INTEGER;`,
  // Oyun sonu sayaçları (rozetler: Kâhin ×10, Kule Ustası): hesap-oyun-anahtar-değer; SUM/MAX ile okunur.
  // Hesap silinince satırlar da gider.
  `CREATE TABLE account_game_stats (
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     game_id TEXT NOT NULL,
     ended_at INTEGER NOT NULL,
     key TEXT NOT NULL,
     value INTEGER NOT NULL
   );
   CREATE INDEX account_game_stats_account ON account_game_stats (account_id, game_id, key);`,
  // Yönetici paneli (U16 A1): işlem kaydı, tek kullanımlık kod (yalnız özet) ve yönetici çerez oturumu (yalnız özet).
  `CREATE TABLE admin_audit (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     account_id INTEGER NOT NULL,
     action TEXT NOT NULL,
     detail TEXT NOT NULL,
     at INTEGER NOT NULL
   );
   CREATE INDEX admin_audit_at ON admin_audit (at);
   CREATE TABLE admin_otp (
     account_id INTEGER PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
     session_hash TEXT NOT NULL,
     salt TEXT NOT NULL,
     code_hash TEXT NOT NULL,
     expires_at INTEGER NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE admin_sessions (
     token_hash TEXT PRIMARY KEY,
     account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
     session_hash TEXT NOT NULL REFERENCES sessions (id_hash) ON DELETE CASCADE,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL
   );`,
  // Yönetici paneli hesap işlemleri (U16 A2): askıya alma (`suspended_at` boşsa askıda değil; `suspended_until` boşsa
  // süresiz) ve işlem kaydında hedef hesap. Askı bitince sütunlar günlük temizlikte silinir.
  `ALTER TABLE accounts ADD COLUMN suspended_at INTEGER;
   ALTER TABLE accounts ADD COLUMN suspended_until INTEGER;
   ALTER TABLE accounts ADD COLUMN suspend_reason TEXT;
   ALTER TABLE admin_audit ADD COLUMN target_id INTEGER;
   CREATE INDEX admin_audit_target ON admin_audit (target_id);`,
];

/** Yönetici işlem kayıtları bu süreden sonra silinir. */
export const ADMIN_AUDIT_RETENTION_MS = 365 * 24 * 3600 * 1000;

function migrate(db: DatabaseSync): void {
  db.exec("CREATE TABLE IF NOT EXISTS account_schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT MAX(version) AS v FROM account_schema_version").get() as
    | { v: number | null }
    | undefined;
  let version = row?.v ?? 0;
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version] as string);
      version += 1;
      db.prepare("INSERT INTO account_schema_version (version) VALUES (?)").run(version);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

interface AuditDbRow {
  id: number;
  account_id: number;
  action: string;
  detail: string;
  at: number;
  target_id: number | null;
}

const auditRow = (r: AuditDbRow): AdminAuditRow => ({
  id: r.id,
  accountId: r.account_id,
  action: r.action,
  targetId: r.target_id,
  detail: r.detail,
  at: r.at,
});

interface SearchDbRow {
  id: number;
  username: string;
  created_at: number;
  verified: number;
  g: number;
  p: number;
  sus_at: number | null;
  sus_until: number | null;
  last_seen: number | null;
  matches: number;
}

interface AccountRow {
  id: number;
  username: string;
  email: string;
  pass_hash: string | null;
}

export function createAccounts(path: string): AccountStore {
  const { DatabaseSync: Db } = loadSqlite();
  const db = new Db(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 2000;");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  const byUsername = db.prepare("SELECT id FROM accounts WHERE username_lc = ?");
  const byEmail = db.prepare("SELECT id FROM accounts WHERE email = ?");
  const insert = db.prepare(
    "INSERT INTO accounts (username, username_lc, email, pass_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  const byLogin = db.prepare(
    "SELECT id, username, email, pass_hash FROM accounts WHERE username_lc = ? OR email = ? LIMIT 1",
  );
  const bySub = db.prepare("SELECT id, username, email FROM accounts WHERE google_sub = ?");
  const byEmailRow = db.prepare("SELECT id, username, email FROM accounts WHERE email = ?");
  const byId = db.prepare("SELECT id, username, email FROM accounts WHERE id = ?");
  const subOf = db.prepare("SELECT google_sub FROM accounts WHERE id = ?");
  const setSub = db.prepare("UPDATE accounts SET google_sub = ? WHERE id = ? AND google_sub IS NULL");
  const insertGoogle = db.prepare(
    "INSERT INTO accounts (username, username_lc, email, email_verified, pass_hash, google_sub, created_at) VALUES (?, ?, ?, 1, NULL, ?, ?)",
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (id_hash, account_id, created_at, last_seen) VALUES (?, ?, ?, ?)",
  );
  const sessionRow = db.prepare(
    `SELECT a.id AS id, a.username AS username, a.email AS email, s.created_at AS created_at, s.last_seen AS last_seen,
            a.suspended_at AS sus_at, a.suspended_until AS sus_until
       FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id_hash = ?`,
  );
  const touch = db.prepare("UPDATE sessions SET last_seen = ? WHERE id_hash = ?");
  const removeSession = db.prepare("DELETE FROM sessions WHERE id_hash = ?");
  const purgeSessions = db.prepare("DELETE FROM sessions WHERE created_at < ?");
  const purgeTokens = db.prepare("DELETE FROM email_tokens WHERE expires_at < ?");
  const verifiedOf = db.prepare("SELECT email_verified, pass_hash FROM accounts WHERE id = ?");
  const setVerified = db.prepare("UPDATE accounts SET email_verified = 1 WHERE id = ?");
  const insertToken = db.prepare(
    "INSERT INTO email_tokens (kind, token_hash, account_id, expires_at) VALUES (?, ?, ?, ?)",
  );
  const dropTokens = db.prepare("DELETE FROM email_tokens WHERE kind = ? AND account_id = ?");
  const takeToken = db.prepare(
    "DELETE FROM email_tokens WHERE kind = ? AND token_hash = ? RETURNING account_id, expires_at",
  );
  const setPass = db.prepare("UPDATE accounts SET pass_hash = ? WHERE id = ?");
  const dropSessions = db.prepare("DELETE FROM sessions WHERE account_id = ?");
  const dropOtherSessions = db.prepare("DELETE FROM sessions WHERE account_id = ? AND id_hash != ?");
  const renameState = db.prepare("SELECT username_changed_at AS at FROM accounts WHERE id = ?");
  const renameWrite = db.prepare(
    "UPDATE accounts SET username = ?, username_lc = ?, username_changed_at = ? WHERE id = ?",
  );
  const byUsernameRow = db.prepare("SELECT id, username, email FROM accounts WHERE username_lc = ?");
  const insertGame = db.prepare(
    `INSERT INTO account_games (account_id, game_id, ended_at, players, mini_score, rank, won)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)`,
  );
  const insertGameStat = db.prepare(
    `INSERT INTO account_game_stats (account_id, game_id, ended_at, key, value)
       SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)`,
  );
  const statSum = db.prepare(
    `SELECT COALESCE(SUM(value), 0) AS n FROM account_game_stats
       WHERE account_id = ? AND game_id = ? AND key = ?`,
  );
  const statMax = db.prepare(
    `SELECT COALESCE(MAX(value), 0) AS n FROM account_game_stats
       WHERE account_id = ? AND game_id = ? AND key = ?`,
  );
  const gameStatDump = db.prepare(
    `SELECT game_id, ended_at, key, value FROM account_game_stats WHERE account_id = ?
       ORDER BY ended_at, rowid`,
  );
  const dropGameStats = db.prepare("DELETE FROM account_game_stats WHERE account_id = ?");
  const insertMatch = db.prepare(
    `INSERT INTO account_matches (account_id, ended_at, players, games, score, place, won)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)`,
  );
  const bumpCoplay = db.prepare(
    `INSERT INTO account_coplay (account_id, other_account_id, matches, last_at)
       SELECT ?, ?, 1, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)
         AND EXISTS (SELECT 1 FROM accounts WHERE id = ?)
       ON CONFLICT (account_id, other_account_id) DO UPDATE SET matches = matches + 1, last_at = excluded.last_at`,
  );
  const accountRow = db.prepare("SELECT username, created_at FROM accounts WHERE id = ?");
  const matchTotals = db.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(won), 0) AS wins FROM account_matches WHERE account_id = ?",
  );
  const gameTotals = db.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(won), 0) AS wins FROM account_games WHERE account_id = ?",
  );
  const perGameRows = db.prepare(
    `SELECT game_id, COUNT(*) AS plays, SUM(won) AS wins, MAX(mini_score) AS best, AVG(mini_score) AS avg
       FROM account_games WHERE account_id = ?
       GROUP BY game_id ORDER BY plays DESC, MAX(ended_at) DESC, game_id`,
  );
  const recentRows = db.prepare(
    `SELECT ended_at, players, place, score FROM account_matches WHERE account_id = ?
       ORDER BY ended_at DESC, rowid DESC LIMIT ${RECENT_MATCHES}`,
  );
  const coplayRows = db.prepare(
    `SELECT a.username AS username, c.matches AS matches
       FROM account_coplay c JOIN accounts a ON a.id = c.other_account_id
       WHERE c.account_id = ? ORDER BY c.matches DESC, c.last_at DESC, a.username_lc LIMIT ${TOP_COPLAYERS}`,
  );
  const winGameCount = db.prepare(
    "SELECT COUNT(DISTINCT game_id) AS n FROM account_games WHERE account_id = ? AND won = 1",
  );
  const playedGameRows = db.prepare("SELECT DISTINCT game_id FROM account_games WHERE account_id = ?");
  const friendCoplay = db.prepare(
    `SELECT COALESCE(MAX(c.matches), 0) AS n FROM account_coplay c
       JOIN friends f ON f.a = MIN(c.account_id, c.other_account_id) AND f.b = MAX(c.account_id, c.other_account_id)
       WHERE c.account_id = ? AND f.state = 'accepted'`,
  );
  const lastWonRows = db.prepare(
    "SELECT won FROM account_matches WHERE account_id = ? ORDER BY ended_at DESC, rowid DESC LIMIT 3",
  );
  const earnedRows = db.prepare(
    "SELECT badge_id, earned_at FROM badges WHERE account_id = ? ORDER BY earned_at, rowid",
  );
  const insertBadge = db.prepare(
    `INSERT OR IGNORE INTO badges (account_id, badge_id, earned_at)
       SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)`,
  );
  const dropBadges = db.prepare("DELETE FROM badges WHERE account_id = ?");
  const dropGames = db.prepare("DELETE FROM account_games WHERE account_id = ?");
  const dropMatches = db.prepare("DELETE FROM account_matches WHERE account_id = ?");
  const dropCoplay = db.prepare("DELETE FROM account_coplay WHERE account_id = ? OR other_account_id = ?");
  const dropFriends = db.prepare("DELETE FROM friends WHERE a = ? OR b = ?");
  const dropBlocks = db.prepare("DELETE FROM blocks WHERE blocker = ? OR blocked = ?");
  const detailRow = db.prepare(
    `SELECT username, email, email_verified, google_sub, pass_hash IS NOT NULL AS has_pass, created_at,
            username_changed_at FROM accounts WHERE id = ?`,
  );
  const sessionTimes = db.prepare(
    "SELECT created_at, last_seen FROM sessions WHERE account_id = ? ORDER BY created_at",
  );
  const gameDump = db.prepare(
    `SELECT game_id, ended_at, players, mini_score, rank, won FROM account_games
       WHERE account_id = ? ORDER BY ended_at, rowid`,
  );
  const matchDump = db.prepare(
    `SELECT ended_at, players, games, score, place, won FROM account_matches
       WHERE account_id = ? ORDER BY ended_at, rowid`,
  );
  const coplayDump = db.prepare(
    `SELECT a.username AS username, c.matches AS matches, c.last_at AS last_at
       FROM account_coplay c JOIN accounts a ON a.id = c.other_account_id
       WHERE c.account_id = ? ORDER BY a.username_lc`,
  );
  const sessionCreated = db.prepare("SELECT created_at FROM sessions WHERE id_hash = ?");
  const relatedRows = db.prepare(
    `SELECT CASE WHEN a = ? THEN b ELSE a END AS id FROM friends WHERE a = ? OR b = ?
       UNION SELECT blocked FROM blocks WHERE blocker = ?
       UNION SELECT blocker FROM blocks WHERE blocked = ?`,
  );
  const insertAudit = db.prepare(
    "INSERT INTO admin_audit (account_id, action, detail, at, target_id) VALUES (?, ?, ?, ?, ?)",
  );
  const auditTail = db.prepare(
    "SELECT id, account_id, action, detail, at, target_id FROM admin_audit ORDER BY id DESC LIMIT ?",
  );
  const auditPage = db.prepare(
    "SELECT id, account_id, action, detail, at, target_id FROM admin_audit WHERE id < ? ORDER BY id DESC LIMIT ?",
  );
  const searchColumns = `SELECT a.id AS id, a.username AS username, a.created_at AS created_at,
            a.email_verified AS verified, a.google_sub IS NOT NULL AS g, a.pass_hash IS NOT NULL AS p,
            a.suspended_at AS sus_at, a.suspended_until AS sus_until,
            (SELECT MAX(s.last_seen) FROM sessions s WHERE s.account_id = a.id) AS last_seen,
            (SELECT COUNT(*) FROM account_matches m WHERE m.account_id = a.id) AS matches
       FROM accounts a`;
  const searchPrefix = db.prepare(
    `${searchColumns} WHERE a.username_lc >= ? AND a.username_lc < ? ORDER BY a.username_lc LIMIT ${ADMIN_SEARCH_LIMIT}`,
  );
  const searchEmail = db.prepare(`${searchColumns} WHERE a.email = ? LIMIT ${ADMIN_SEARCH_LIMIT}`);
  const adminDetailRow = db.prepare(
    `SELECT username, email, email_verified, google_sub IS NOT NULL AS g, pass_hash IS NOT NULL AS p, created_at,
            username_changed_at, suspended_at, suspended_until, suspend_reason FROM accounts WHERE id = ?`,
  );
  const sessionSummary = db.prepare(
    "SELECT COUNT(*) AS n, MAX(last_seen) AS last_seen FROM sessions WHERE account_id = ?",
  );
  const badgeCount = db.prepare("SELECT COUNT(*) AS n FROM badges WHERE account_id = ?");
  const friendCount = db.prepare(
    "SELECT COUNT(*) AS n FROM friends WHERE state = 'accepted' AND (a = ? OR b = ?)",
  );
  const suspensionRow = db.prepare(
    "SELECT suspended_at, suspended_until, suspend_reason FROM accounts WHERE id = ?",
  );
  const suspendWrite = db.prepare(
    "UPDATE accounts SET suspended_at = ?, suspended_until = ?, suspend_reason = ? WHERE id = ?",
  );
  const suspendClear = db.prepare(
    "UPDATE accounts SET suspended_at = NULL, suspended_until = NULL, suspend_reason = NULL WHERE id = ?",
  );
  const suspendExpired = db.prepare(
    `UPDATE accounts SET suspended_at = NULL, suspended_until = NULL, suspend_reason = NULL
      WHERE suspended_until IS NOT NULL AND suspended_until <= ?`,
  );
  const forceRename = db.prepare("UPDATE accounts SET username = ?, username_lc = ? WHERE id = ?");
  const putOtp = db.prepare(
    `INSERT INTO admin_otp (account_id, session_hash, salt, code_hash, expires_at, attempts)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT (account_id) DO UPDATE SET session_hash = excluded.session_hash, salt = excluded.salt,
         code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
  );
  const getOtp = db.prepare(
    "SELECT session_hash, salt, code_hash, expires_at, attempts FROM admin_otp WHERE account_id = ?",
  );
  const dropOtp = db.prepare("DELETE FROM admin_otp WHERE account_id = ?");
  const bumpOtp = db.prepare("UPDATE admin_otp SET attempts = attempts + 1 WHERE account_id = ?");
  const insertAdminSession = db.prepare(
    `INSERT INTO admin_sessions (token_hash, account_id, session_hash, created_at, expires_at)
       SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sessions WHERE id_hash = ?)`,
  );
  const adminSessionRow = db.prepare(
    "SELECT account_id, session_hash, expires_at FROM admin_sessions WHERE token_hash = ?",
  );
  const dropAdminSession = db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?");
  const purgeAdmin = db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?");
  const purgeOtp = db.prepare("DELETE FROM admin_otp WHERE expires_at < ?");
  const purgeAudit = db.prepare("DELETE FROM admin_audit WHERE at < ?");
  const metricTotals = db.prepare(
    `SELECT COUNT(*) AS total, COALESCE(SUM(email_verified), 0) AS verified,
            COALESCE(SUM(google_sub IS NOT NULL), 0) AS google, COALESCE(SUM(pass_hash IS NOT NULL), 0) AS pass
       FROM accounts`,
  );
  const metricFriends = db.prepare("SELECT COUNT(*) AS n FROM friends WHERE state = 'accepted'");
  const metricBadges = db.prepare("SELECT COUNT(*) AS n FROM badges");
  const metricBoth = db.prepare(
    "SELECT COUNT(*) AS n FROM accounts WHERE google_sub IS NOT NULL AND pass_hash IS NOT NULL",
  );
  const metricActive = db.prepare(
    "SELECT COUNT(DISTINCT account_id) AS n FROM account_matches WHERE ended_at >= ?",
  );
  const metricSuspended = db.prepare(
    "SELECT COUNT(*) AS n FROM accounts WHERE suspended_at IS NOT NULL AND (suspended_until IS NULL OR suspended_until > ?)",
  );
  const metricNew = db.prepare(
    `SELECT CAST(created_at / 86400000 AS INTEGER) AS d, COUNT(*) AS n FROM accounts
      WHERE created_at >= ? GROUP BY d`,
  );
  const dropAccount = db.prepare("DELETE FROM accounts WHERE id = ?");
  const dropTokensOf = db.prepare("DELETE FROM email_tokens WHERE account_id = ?");
  /** Tek işlem: ya hepsi yazılır ya hiçbiri. */
  const inTransaction = (work: () => void): void => {
    db.exec("BEGIN");
    try {
      work();
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };
  let closed = false;
  return {
    ...createFriendStore(db, inTransaction),
    changeUsername(accountId, username, now) {
      const lc = username.toLowerCase();
      let result: RenameResult = { ok: false, reason: "missing" };
      inTransaction(() => {
        const found = byId.get(accountId) as Account | undefined;
        if (!found) return;
        const at = (renameState.get(accountId) as { at: number | null } | undefined)?.at ?? null;
        if (at !== null && now < at + USERNAME_COOLDOWN_MS) {
          result = { ok: false, reason: "cooldown", availableAt: at + USERNAME_COOLDOWN_MS };
          return;
        }
        const owner = byUsername.get(lc) as { id: number } | undefined;
        if (owner && owner.id !== accountId) {
          result = { ok: false, reason: "taken" };
          return;
        }
        try {
          renameWrite.run(username, lc, now, accountId);
        } catch (err) {
          // Eşzamanlı iki değişiklik yarışırsa UNIQUE kısıtı son sözü söyler.
          if (String(err).includes("accounts.username_lc")) {
            result = { ok: false, reason: "taken" };
            return;
          }
          throw err;
        }
        result = {
          ok: true,
          account: { id: accountId, username, email: found.email },
          availableAt: now + USERNAME_COOLDOWN_MS,
        };
      });
      return result;
    },
    usernameAvailableAt(accountId, now) {
      const at = (renameState.get(accountId) as { at: number | null } | undefined)?.at ?? null;
      return at !== null && now < at + USERNAME_COOLDOWN_MS ? at + USERNAME_COOLDOWN_MS : null;
    },
    findByUsername(username) {
      const row = byUsernameRow.get(username.toLowerCase()) as Account | undefined;
      return row ? { id: row.id, username: row.username, email: row.email } : null;
    },
    recordGame(endedAt, rows) {
      if (rows.length === 0) return;
      inTransaction(() => {
        for (const r of rows)
          insertGame.run(
            r.accountId,
            r.gameId,
            endedAt,
            r.players,
            r.miniScore,
            r.rank,
            r.rank === 1 ? 1 : 0,
            r.accountId,
          );
        for (const r of rows)
          for (const [key, value] of Object.entries(r.stats ?? {}))
            if (Number.isSafeInteger(value) && value > 0)
              insertGameStat.run(r.accountId, r.gameId, endedAt, key, value, r.accountId);
      });
    },
    recordMatch(endedAt, rows, pairs) {
      if (rows.length === 0) return;
      inTransaction(() => {
        for (const r of rows)
          insertMatch.run(
            r.accountId,
            endedAt,
            r.players,
            r.games,
            r.score,
            r.place,
            r.place === 1 ? 1 : 0,
            r.accountId,
          );
        for (const [a, b] of pairs) {
          bumpCoplay.run(a, b, endedAt, a, b);
          bumpCoplay.run(b, a, endedAt, b, a);
        }
      });
    },
    profile(accountId, full) {
      const acc = accountRow.get(accountId) as { username: string; created_at: number } | undefined;
      if (!acc) return null;
      const m = matchTotals.get(accountId) as { n: number; wins: number };
      const g = gameTotals.get(accountId) as { n: number; wins: number };
      const per = (
        perGameRows.all(accountId) as {
          game_id: string;
          plays: number;
          wins: number;
          best: number;
          avg: number;
        }[]
      ).map((r) => ({
        gameId: r.game_id,
        plays: r.plays,
        wins: r.wins,
        bestMini: r.best,
        avgMini: Math.round(r.avg * 10) / 10,
      }));
      const top = per[0];
      return {
        username: acc.username,
        createdAt: acc.created_at,
        totals: {
          matches: m.n,
          wins: m.wins,
          winRate: m.n > 0 ? Math.round((m.wins / m.n) * 1000) / 1000 : 0,
          games: g.n,
          gameWins: g.wins,
        },
        favoriteGame: top ? { id: top.gameId, plays: top.plays } : null,
        perGame: per,
        recent: full
          ? (
              recentRows.all(accountId) as {
                ended_at: number;
                players: number;
                place: number;
                score: number;
              }[]
            ).map((r) => ({ endedAt: r.ended_at, players: r.players, place: r.place, score: r.score }))
          : [],
        coPlayers: full ? (coplayRows.all(accountId) as { username: string; matches: number }[]) : [],
        badges: (earnedRows.all(accountId) as { badge_id: string; earned_at: number }[]).map((r) => ({
          badgeId: r.badge_id,
          earnedAt: r.earned_at,
        })),
      };
    },
    badgeStats(accountId) {
      const m = matchTotals.get(accountId) as { n: number; wins: number };
      const wg = winGameCount.get(accountId) as { n: number };
      const fc = friendCoplay.get(accountId) as { n: number };
      return {
        matches: m.n,
        wins: m.wins,
        winGames: wg.n,
        playedGames: (playedGameRows.all(accountId) as { game_id: string }[]).map((r) => r.game_id),
        friendCoplayMax: fc.n,
        lastWon: (lastWonRows.all(accountId) as { won: number }[]).map((r) => r.won === 1),
        kahinGames: (statSum.get(accountId, "rus-ruleti", "kahin") as { n: number }).n,
        maxPerfects: (statMax.get(accountId, "kule-ustasi", "perfects") as { n: number }).n,
      };
    },
    earnedBadges(accountId) {
      return (earnedRows.all(accountId) as { badge_id: string; earned_at: number }[]).map((r) => ({
        badgeId: r.badge_id,
        earnedAt: r.earned_at,
      }));
    },
    awardBadges(accountId, badgeIds, at) {
      const fresh: string[] = [];
      inTransaction(() => {
        for (const id of badgeIds)
          if (Number(insertBadge.run(accountId, id, at, accountId).changes) === 1) fresh.push(id);
      });
      return fresh;
    },
    standings(accountIds, since) {
      if (accountIds.length === 0) return [];
      const marks = accountIds.map(() => "?").join(",");
      const rows = db
        .prepare(
          `SELECT a.id AS id, a.username AS username, COUNT(m.account_id) AS matches,
                  COALESCE(SUM(m.won), 0) AS wins, COALESCE(SUM(m.score), 0) AS score
             FROM accounts a
             LEFT JOIN account_matches m ON m.account_id = a.id AND m.ended_at >= ?
             WHERE a.id IN (${marks}) GROUP BY a.id`,
        )
        .all(since ?? Number.MIN_SAFE_INTEGER, ...accountIds) as {
        id: number;
        username: string;
        matches: number;
        wins: number;
        score: number;
      }[];
      return rows.map((r) => ({
        accountId: r.id,
        username: r.username,
        matches: r.matches,
        wins: r.wins,
        score: r.score,
      }));
    },
    gameStandings(accountIds, since) {
      if (accountIds.length === 0) return [];
      const marks = accountIds.map(() => "?").join(",");
      const rows = db
        .prepare(
          `SELECT g.game_id AS game_id, a.id AS id, a.username AS username, COUNT(*) AS plays, SUM(g.won) AS wins
             FROM account_games g JOIN accounts a ON a.id = g.account_id
             WHERE g.account_id IN (${marks}) AND g.ended_at >= ? GROUP BY g.game_id, a.id`,
        )
        .all(...accountIds, since ?? Number.MIN_SAFE_INTEGER) as {
        game_id: string;
        id: number;
        username: string;
        plays: number;
        wins: number;
      }[];
      return rows.map((r) => ({
        gameId: r.game_id,
        accountId: r.id,
        username: r.username,
        plays: r.plays,
        wins: r.wins,
      }));
    },
    deleteAccountData(accountId) {
      inTransaction(() => {
        dropGames.run(accountId);
        dropGameStats.run(accountId);
        dropMatches.run(accountId);
        dropBadges.run(accountId);
        dropCoplay.run(accountId, accountId);
        dropFriends.run(accountId, accountId);
        dropBlocks.run(accountId, accountId);
      });
    },
    exportData(accountId) {
      const d = detailRow.get(accountId) as
        | {
            username: string;
            email: string;
            email_verified: number;
            google_sub: string | null;
            has_pass: number;
            created_at: number;
            username_changed_at: number | null;
          }
        | undefined;
      if (!d) return null;
      const sus = suspensionRow.get(accountId) as
        | { suspended_at: number | null; suspended_until: number | null; suspend_reason: string | null }
        | undefined;
      return {
        username: d.username,
        email: d.email,
        emailVerified: d.email_verified === 1,
        googleSub: d.google_sub,
        hasPassword: d.has_pass === 1,
        createdAt: d.created_at,
        usernameChangedAt: d.username_changed_at,
        suspension:
          sus && sus.suspended_at !== null
            ? { since: sus.suspended_at, until: sus.suspended_until, reason: sus.suspend_reason ?? "" }
            : null,
        sessions: (sessionTimes.all(accountId) as { created_at: number; last_seen: number }[]).map((r) => ({
          createdAt: r.created_at,
          lastSeen: r.last_seen,
        })),
        games: (
          gameDump.all(accountId) as {
            game_id: string;
            ended_at: number;
            players: number;
            mini_score: number;
            rank: number;
            won: number;
          }[]
        ).map((r) => ({
          gameId: r.game_id,
          endedAt: r.ended_at,
          players: r.players,
          miniScore: r.mini_score,
          rank: r.rank,
          won: r.won === 1,
        })),
        gameStats: (
          gameStatDump.all(accountId) as { game_id: string; ended_at: number; key: string; value: number }[]
        ).map((r) => ({ gameId: r.game_id, endedAt: r.ended_at, key: r.key, value: r.value })),
        matches: (
          matchDump.all(accountId) as {
            ended_at: number;
            players: number;
            games: number;
            score: number;
            place: number;
            won: number;
          }[]
        ).map((r) => ({
          endedAt: r.ended_at,
          players: r.players,
          games: r.games,
          score: r.score,
          place: r.place,
          won: r.won === 1,
        })),
        coplay: (coplayDump.all(accountId) as { username: string; matches: number; last_at: number }[]).map(
          (r) => ({ username: r.username, matches: r.matches, lastAt: r.last_at }),
        ),
      };
    },
    sessionCreatedAt(tokenHash) {
      const row = sessionCreated.get(tokenHash) as { created_at: number } | undefined;
      return row ? row.created_at : null;
    },
    relatedAccountIds(accountId) {
      return (relatedRows.all(accountId, accountId, accountId, accountId, accountId) as { id: number }[]).map(
        (r) => r.id,
      );
    },
    deleteAccount(accountId) {
      let removed = false;
      inTransaction(() => {
        dropGames.run(accountId);
        dropGameStats.run(accountId);
        dropMatches.run(accountId);
        dropBadges.run(accountId);
        dropCoplay.run(accountId, accountId);
        dropFriends.run(accountId, accountId);
        dropBlocks.run(accountId, accountId);
        dropSessions.run(accountId);
        dropTokensOf.run(accountId);
        removed = Number(dropAccount.run(accountId).changes) === 1;
      });
      return removed;
    },
    isVerified(accountId) {
      const row = verifiedOf.get(accountId) as { email_verified: number } | undefined;
      return row?.email_verified === 1;
    },
    passwordHash(accountId) {
      const row = verifiedOf.get(accountId) as { pass_hash: string | null } | undefined;
      return row?.pass_hash ?? null;
    },
    markVerified(accountId) {
      setVerified.run(accountId);
    },
    createToken(kind, accountId, tokenHash, expiresAt) {
      if (kind === "reset") dropTokens.run(kind, accountId);
      insertToken.run(kind, tokenHash, accountId, expiresAt);
    },
    consumeToken(kind, tokenHash, now) {
      const row = takeToken.get(kind, tokenHash) as { account_id: number; expires_at: number } | undefined;
      return row && row.expires_at > now ? row.account_id : null;
    },
    replacePassword(accountId, passHash, keepSession) {
      setPass.run(passHash, accountId);
      dropTokens.run("reset", accountId);
      if (keepSession === null) dropSessions.run(accountId);
      else dropOtherSessions.run(accountId, keepSession);
    },
    create(username, email, passHash, now) {
      const lc = username.toLowerCase();
      if (byUsername.get(lc)) return { ok: false, field: "username" };
      if (byEmail.get(email)) return { ok: false, field: "email" };
      try {
        const res = insert.run(username, lc, email, passHash, now);
        return { ok: true, account: { id: Number(res.lastInsertRowid), username, email } };
      } catch (err) {
        // Eşzamanlı iki kayıt yarışırsa UNIQUE kısıtı son sözü söyler.
        const text = String(err);
        if (text.includes("accounts.username_lc")) return { ok: false, field: "username" };
        if (text.includes("accounts.email")) return { ok: false, field: "email" };
        throw err;
      }
    },
    findByLogin(login) {
      const lc = login.toLowerCase();
      const row = byLogin.get(lc, lc) as AccountRow | undefined;
      return row ? { id: row.id, username: row.username, email: row.email, passHash: row.pass_hash } : null;
    },
    findById(id) {
      const row = byId.get(id) as Account | undefined;
      return row ? { id: row.id, username: row.username, email: row.email } : null;
    },
    findByGoogleSub(sub) {
      const row = bySub.get(sub) as Account | undefined;
      return row ? { id: row.id, username: row.username, email: row.email } : null;
    },
    findByEmail(email) {
      const row = byEmailRow.get(email) as Account | undefined;
      return row ? { id: row.id, username: row.username, email: row.email } : null;
    },
    hasGoogle(accountId) {
      const row = subOf.get(accountId) as { google_sub: string | null } | undefined;
      return !!row?.google_sub;
    },
    linkGoogle(accountId, sub) {
      try {
        return Number(setSub.run(sub, accountId).changes) === 1;
      } catch (err) {
        if (String(err).includes("accounts.google_sub")) return false;
        throw err;
      }
    },
    createGoogle(username, email, sub, now) {
      const lc = username.toLowerCase();
      if (bySub.get(sub)) return { ok: false, field: "sub" };
      if (byUsername.get(lc)) return { ok: false, field: "username" };
      if (byEmail.get(email)) return { ok: false, field: "email" };
      try {
        const res = insertGoogle.run(username, lc, email, sub, now);
        return { ok: true, account: { id: Number(res.lastInsertRowid), username, email } };
      } catch (err) {
        const text = String(err);
        if (text.includes("accounts.google_sub")) return { ok: false, field: "sub" };
        if (text.includes("accounts.username_lc")) return { ok: false, field: "username" };
        if (text.includes("accounts.email")) return { ok: false, field: "email" };
        throw err;
      }
    },
    createSession(accountId, tokenHash, now) {
      insertSession.run(tokenHash, accountId, now, now);
    },
    resolveSession(tokenHash, now) {
      const row = sessionRow.get(tokenHash) as
        | (Omit<AccountRow, "pass_hash"> & {
            created_at: number;
            last_seen: number;
            sus_at: number | null;
            sus_until: number | null;
          })
        | undefined;
      if (!row || now - row.created_at > SESSION_TTL_MS) return null;
      // Askıdaki hesabın oturumları askıya alınırken silinir; yine de bir oturum kalmışsa hesap yok sayılır.
      if (suspensionActive(row.sus_at, row.sus_until, now)) return null;
      if (now - row.last_seen > TOUCH_EVERY_MS) touch.run(now, tokenHash);
      return { id: row.id, username: row.username, email: row.email };
    },
    deleteSession(tokenHash) {
      removeSession.run(tokenHash);
    },
    adminAudit(accountId, action, detail, at, targetId = null) {
      insertAudit.run(accountId, action, detail, at, targetId);
    },
    adminAuditTail(limit) {
      return (auditTail.all(limit) as unknown as AuditDbRow[]).map(auditRow);
    },
    adminAuditPage(before, limit) {
      return (auditPage.all(before ?? Number.MAX_SAFE_INTEGER, limit) as unknown as AuditDbRow[]).map(
        auditRow,
      );
    },
    adminSearch(query, now) {
      const rows =
        query.kind === "email"
          ? (searchEmail.all(query.value) as unknown as SearchDbRow[])
          : (searchPrefix.all(query.value, `${query.value}\u{10FFFF}`) as unknown as SearchDbRow[]);
      return rows.map((r) => ({
        id: r.id,
        username: r.username,
        createdAt: r.created_at,
        verified: r.verified === 1,
        google: r.g === 1,
        password: r.p === 1,
        lastSeen: r.last_seen,
        matches: r.matches,
        suspended: suspensionActive(r.sus_at, r.sus_until, now),
      }));
    },
    adminAccountDetail(accountId, now) {
      const r = adminDetailRow.get(accountId) as
        | {
            username: string;
            email: string;
            email_verified: number;
            g: number;
            p: number;
            created_at: number;
            username_changed_at: number | null;
            suspended_at: number | null;
            suspended_until: number | null;
            suspend_reason: string | null;
          }
        | undefined;
      if (!r) return null;
      const sess = sessionSummary.get(accountId) as { n: number; last_seen: number | null };
      const m = matchTotals.get(accountId) as { n: number; wins: number };
      const g = gameTotals.get(accountId) as { n: number };
      return {
        id: accountId,
        username: r.username,
        email: r.email,
        createdAt: r.created_at,
        verified: r.email_verified === 1,
        google: r.g === 1,
        password: r.p === 1,
        usernameChangedAt: r.username_changed_at,
        lastSeen: sess.last_seen,
        sessions: sess.n,
        matches: m.n,
        wins: m.wins,
        games: g.n,
        badges: (badgeCount.get(accountId) as { n: number }).n,
        friends: (friendCount.get(accountId, accountId) as { n: number }).n,
        suspension: suspensionActive(r.suspended_at, r.suspended_until, now)
          ? { since: r.suspended_at as number, until: r.suspended_until, reason: r.suspend_reason ?? "" }
          : null,
      };
    },
    suspension(accountId, now) {
      const r = suspensionRow.get(accountId) as
        | { suspended_at: number | null; suspended_until: number | null; suspend_reason: string | null }
        | undefined;
      if (!r || !suspensionActive(r.suspended_at, r.suspended_until, now)) return null;
      return { since: r.suspended_at as number, until: r.suspended_until, reason: r.suspend_reason ?? "" };
    },
    suspend(accountId, now, until, reason) {
      let done = false;
      inTransaction(() => {
        if (Number(suspendWrite.run(now, until, reason, accountId).changes) !== 1) return;
        dropSessions.run(accountId);
        done = true;
      });
      return done;
    },
    unsuspend(accountId, now) {
      const r = suspensionRow.get(accountId) as
        | { suspended_at: number | null; suspended_until: number | null }
        | undefined;
      if (!r || !suspensionActive(r.suspended_at, r.suspended_until, now)) return false;
      return Number(suspendClear.run(accountId).changes) === 1;
    },
    forceUsername(accountId, username) {
      const lc = username.toLowerCase();
      let result: "ok" | "taken" | "missing" = "missing";
      inTransaction(() => {
        if (!byId.get(accountId)) return;
        const owner = byUsername.get(lc) as { id: number } | undefined;
        if (owner && owner.id !== accountId) {
          result = "taken";
          return;
        }
        try {
          forceRename.run(username, lc, accountId);
          result = "ok";
        } catch (err) {
          if (!String(err).includes("accounts.username_lc")) throw err;
          result = "taken";
        }
      });
      return result;
    },
    deleteSessionsOf(accountId) {
      return Number(dropSessions.run(accountId).changes);
    },
    adminOtpPut(accountId, sessionHash, salt, codeHash, expiresAt) {
      putOtp.run(accountId, sessionHash, salt, codeHash, expiresAt);
    },
    adminOtpCheck(accountId, sessionHash, now, maxAttempts, matches) {
      let result: AdminOtpCheck = "none";
      inTransaction(() => {
        const row = getOtp.get(accountId) as
          | { session_hash: string; salt: string; code_hash: string; expires_at: number; attempts: number }
          | undefined;
        if (!row || row.session_hash !== sessionHash) return;
        if (row.expires_at <= now) {
          dropOtp.run(accountId);
          result = "expired";
          return;
        }
        if (row.attempts >= maxAttempts) {
          dropOtp.run(accountId);
          result = "locked";
          return;
        }
        if (matches(row.salt, row.code_hash)) {
          dropOtp.run(accountId);
          result = "ok";
          return;
        }
        bumpOtp.run(accountId);
        if (row.attempts + 1 >= maxAttempts) {
          dropOtp.run(accountId);
          result = "locked";
        } else result = "invalid";
      });
      return result;
    },
    adminSessionCreate(tokenHash, accountId, sessionHash, now, expiresAt) {
      insertAdminSession.run(tokenHash, accountId, sessionHash, now, expiresAt, sessionHash);
    },
    adminSessionValid(tokenHash, accountId, sessionHash, now) {
      const row = adminSessionRow.get(tokenHash) as
        | { account_id: number; session_hash: string; expires_at: number }
        | undefined;
      return (
        !!row && row.account_id === accountId && row.session_hash === sessionHash && row.expires_at > now
      );
    },
    adminSessionDelete(tokenHash) {
      dropAdminSession.run(tokenHash);
    },
    adminMetrics(now) {
      const t = metricTotals.get() as { total: number; verified: number; google: number; pass: number };
      const today = Math.floor(now / 86_400_000);
      const byDay = new Map(
        (metricNew.all((today - 29) * 86_400_000) as { d: number; n: number }[]).map((r) => [r.d, r.n]),
      );
      return {
        total: t.total,
        verified: t.verified,
        google: t.google,
        password: t.pass,
        both: (metricBoth.get() as { n: number }).n,
        active7: (metricActive.get(now - 7 * 86_400_000) as { n: number }).n,
        active30: (metricActive.get(now - 30 * 86_400_000) as { n: number }).n,
        suspended: (metricSuspended.get(now) as { n: number }).n,
        friendships: (metricFriends.get() as { n: number }).n,
        badgesAwarded: (metricBadges.get() as { n: number }).n,
        newPerDay: Array.from({ length: 30 }, (_, i) => {
          const d = today - (29 - i);
          return { dayStart: d * 86_400_000, count: byDay.get(d) ?? 0 };
        }),
      };
    },
    purge(now) {
      try {
        purgeSessions.run(now - SESSION_TTL_MS);
        purgeTokens.run(now);
        purgeAdmin.run(now);
        purgeOtp.run(now);
        purgeAudit.run(now - ADMIN_AUDIT_RETENTION_MS);
        suspendExpired.run(now);
      } catch (err) {
        log.error("accounts_error", { op: "purge", error: String(err) });
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        db.close();
      } catch (err) {
        log.error("accounts_error", { op: "close", error: String(err) });
      }
    },
  };
}
