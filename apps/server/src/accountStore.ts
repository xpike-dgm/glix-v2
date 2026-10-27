import type { DatabaseSync } from "node:sqlite";
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
}

/** Kullanıcı adı en sık bu aralıkla değiştirilebilir (ilk değişiklik hesap açılışından sayılmaz, hemen serbest). */
export const USERNAME_COOLDOWN_MS = 7 * 24 * 3600 * 1000;

/** `taken`: başka hesapta var; `cooldown`: bekleme süresi dolmadı (`availableAt` ms). */
export type RenameResult =
  | { ok: true; account: Account; availableAt: number }
  | { ok: false; reason: "taken" }
  | { ok: false; reason: "cooldown"; availableAt: number }
  | { ok: false; reason: "missing" };

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
  /**
   * Hesabın istatistik ve arkadaşlık verisini siler (oyun, maç, birlikte oynama; karşı taraftaki sayaçlar dahil;
   * arkadaşlıklar, istekler ve engeller, iki yönde).
   * Hesabın kendisine dokunmaz; hesap silme (H10) bunu çağırır, tablolar ayrıca `ON DELETE CASCADE` taşır.
   */
  deleteAccountData(accountId: number): void;
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
  // Kullanıcı adı değişikliği: son değişiklik anı (null = hiç değişmedi, hemen serbest).
  `ALTER TABLE accounts ADD COLUMN username_changed_at INTEGER;`,
];

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
    `SELECT a.id AS id, a.username AS username, a.email AS email, s.created_at AS created_at, s.last_seen AS last_seen
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
  const dropGames = db.prepare("DELETE FROM account_games WHERE account_id = ?");
  const dropMatches = db.prepare("DELETE FROM account_matches WHERE account_id = ?");
  const dropCoplay = db.prepare("DELETE FROM account_coplay WHERE account_id = ? OR other_account_id = ?");
  const dropFriends = db.prepare("DELETE FROM friends WHERE a = ? OR b = ?");
  const dropBlocks = db.prepare("DELETE FROM blocks WHERE blocker = ? OR blocked = ?");
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
      };
    },
    deleteAccountData(accountId) {
      inTransaction(() => {
        dropGames.run(accountId);
        dropMatches.run(accountId);
        dropCoplay.run(accountId, accountId);
        dropFriends.run(accountId, accountId);
        dropBlocks.run(accountId, accountId);
      });
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
        | (Omit<AccountRow, "pass_hash"> & { created_at: number; last_seen: number })
        | undefined;
      if (!row || now - row.created_at > SESSION_TTL_MS) return null;
      if (now - row.last_seen > TOUCH_EVERY_MS) touch.run(now, tokenHash);
      return { id: row.id, username: row.username, email: row.email };
    },
    deleteSession(tokenHash) {
      removeSession.run(tokenHash);
    },
    purge(now) {
      try {
        purgeSessions.run(now - SESSION_TTL_MS);
        purgeTokens.run(now);
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
