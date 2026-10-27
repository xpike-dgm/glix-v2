import type { DatabaseSync } from "node:sqlite";
import { log } from "./log.js";
import { loadSqlite } from "./statsStore.js";

/** Oturum bu süre sonra kendiliğinden düşer (çerez Max-Age ile aynı). */
export const SESSION_TTL_MS = 180 * 24 * 3600 * 1000;
/** `last_seen` en çok bu aralıkla güncellenir (her WS bağlantısında yazma olmasın). */
const TOUCH_EVERY_MS = 3600 * 1000;

export interface Account {
  id: number;
  username: string;
  email: string;
}

export interface AccountWithHash extends Account {
  passHash: string | null;
}

export type CreateResult = { ok: true; account: Account } | { ok: false; field: "username" | "email" };

/**
 * Hesap ve oturum deposu. İstatistik deposundan ayrı göç sırası (`account_schema_version`) kullanır;
 * aynı SQLite dosyasını paylaşabilir. Dosya yolu verilmezse bellekte açılır (yeniden başlatınca silinir).
 * Hata fırlatabilir: çağıran (auth.ts) 500 döner, sunucu çökmez.
 */
export interface AccountStore {
  create(username: string, email: string, passHash: string, now: number): CreateResult;
  /** Kullanıcı adı ya da e-posta (küçük harfe çevrilmiş) ile bulur. */
  findByLogin(login: string): AccountWithHash | null;
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
  createSession(accountId: number, tokenHash: string, now: number): void;
  /** Geçerli oturumun hesabı; süresi dolmuşsa ya da yoksa null. */
  resolveSession(tokenHash: string, now: number): Account | null;
  deleteSession(tokenHash: string): void;
  /** Süresi dolan oturumları siler. */
  purge(now: number): void;
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
  let closed = false;
  return {
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
