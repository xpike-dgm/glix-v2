import type { IncomingMessage, ServerResponse } from "node:http";
import type { Account, AccountStore } from "./accountStore.js";
import { accountFromCookie, originAllowed, readJson, USERNAME_PATTERN } from "./auth.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { TokenBucket } from "./ratelimit.js";
import type { Social } from "./social.js";
import { SECURITY_HEADERS } from "./static.js";

export const FRIENDS_PATH = "/api/friends";

const ACTIONS = ["request", "accept", "decline", "cancel", "remove", "block", "unblock"] as const;
type Action = (typeof ACTIONS)[number];

export interface FriendsEnv {
  accounts: AccountStore;
  social: Social;
  clock: Clock;
  allowedOrigins: readonly string[] | null;
}

interface Failure {
  status: 400 | 401 | 403 | 404 | 405 | 409 | 429 | 500;
  code: string;
  message: string;
}
type Outcome = { status: 200; body: Record<string, unknown> } | Failure;

const fail = (status: Failure["status"], code: string, message: string): Failure => ({
  status,
  code,
  message,
});

const NOT_FOUND = fail(404, "not_found", "Bu kullanıcı adıyla biri bulunamadı.");
const TOO_FAST = fail(429, "rate_limited", "Çok hızlı gidiyorsun, biraz yavaşla.");
const ok = (body: Record<string, unknown> = {}): Outcome => ({ status: 200, body: { ok: true, ...body } });

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

/** `{username}` gövdesi; geçerliyse kullanıcı adı, değilse null. */
function parseUsername(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "username") return null;
  const name = (data as { username: unknown }).username;
  return typeof name === "string" && USERNAME_PATTERN.test(name) ? name : null;
}

/**
 * Arkadaş uçları (`/api/friends`). Oturum şart; POST'larda Origin denetimi; hesap başına hız sınırı.
 * Durum (çevrimiçi/lobide/oyunda) yalnız kabul edilmiş arkadaşlara gösterilir; oda kodu hiçbir yanıtta yoktur.
 */
export function createFriendsApi(env: FriendsEnv): (req: IncomingMessage, res: ServerResponse) => void {
  const { accounts, social, clock } = env;
  const reads = new Map<number, TokenBucket>();
  const writes = new Map<number, TokenBucket>();
  const requests = new Map<number, TokenBucket>();

  /** Hesap başına kova; harita şişmesin diye dolu (boşta) kovalar zaman zaman silinir. */
  const take = (
    map: Map<number, TokenBucket>,
    id: number,
    capacity: number,
    refillPerSecond: number,
  ): boolean => {
    let b = map.get(id);
    if (!b) {
      if (map.size > 5000) for (const [k, v] of map) if (v.isFull()) map.delete(k);
      b = new TokenBucket(clock, capacity, refillPerSecond);
      map.set(id, b);
    }
    return b.take();
  };

  function list(me: Account): Outcome {
    if (!take(reads, me.id, 30, 1)) return TOO_FAST;
    const lists = accounts.friendLists(me.id);
    const mine = social.presence(me.id).room;
    return ok({
      friends: lists.friends.map((f) => {
        const p = social.presence(f.id);
        return {
          username: f.username,
          since: f.at,
          status: p.status,
          // Katılınabilir mi ve seninle aynı odada mı: oda kodu değil, yalnız iki işaret.
          joinable: p.room !== null && social.joinable(p.room),
          withYou: p.room !== null && p.room === mine,
        };
      }),
      incoming: lists.incoming.map((f) => ({ username: f.username, at: f.at })),
      outgoing: lists.outgoing.map((f) => ({ username: f.username, at: f.at })),
      blocked: lists.blocked.map((f) => ({ username: f.username })),
    });
  }

  function act(me: Account, action: Action, name: string): Outcome {
    if (!take(writes, me.id, 30, 0.5)) return TOO_FAST;
    const other = USERNAME_PATTERN.test(name) ? accounts.findByUsername(name) : null;
    if (!other) {
      // Kaldırma/geri alma gibi temizlik işlemleri hesap yoksa da zararsızdır; yine de varlık sızmasın.
      return NOT_FOUND;
    }
    // Askıdaki hesap yeni istek alamaz/kabul edemez: bulunamamış gibi davranılır (temizlik işlemleri açık kalır).
    if ((action === "request" || action === "accept") && accounts.suspension(other.id, clock.now()))
      return NOT_FOUND;
    const changed = (): void => void social.sendTo(other.id, { type: "friendsChanged" });
    switch (action) {
      case "request": {
        if (!take(requests, me.id, 10, 1 / 6)) return TOO_FAST;
        const r = accounts.requestFriend(me.id, other.id, clock.now());
        switch (r) {
          case "sent":
            social.sendTo(other.id, { type: "friendRequest", username: me.username });
            return ok({ result: "sent" });
          case "accepted":
            changed();
            return ok({ result: "accepted" });
          case "self":
            return fail(400, "self", "Kendine istek gönderemezsin.");
          case "already":
            return fail(409, "already_friends", "Zaten arkadaşsınız.");
          case "pending":
            return fail(409, "already_requested", "İsteği zaten gönderdin.");
          case "blockedByMe":
            return fail(409, "blocked_by_me", "Bu kişiyi engelledin. Önce engeli kaldır.");
          case "limit":
            return fail(409, "limit", "Arkadaş ya da bekleyen istek sınırına ulaştın.");
          case "failed":
            return fail(400, "request_failed", "İstek gönderilemedi.");
        }
        break;
      }
      case "accept": {
        const r = accounts.acceptFriend(me.id, other.id, clock.now());
        if (r === "none") return fail(404, "no_request", "Bu istek artık yok.");
        if (r === "limit") return fail(409, "limit", "Arkadaş sınırına ulaşıldı.");
        changed();
        return ok();
      }
      case "decline":
        // Reddedilen kişiye haber verilmez.
        accounts.declineFriend(me.id, other.id);
        return ok();
      case "cancel":
        if (accounts.cancelFriend(me.id, other.id)) changed();
        return ok();
      case "remove":
        if (accounts.removeFriend(me.id, other.id)) changed();
        return ok();
      case "block":
        if (other.id === me.id) return fail(400, "self", "Kendini engelleyemezsin.");
        accounts.blockAccount(me.id, other.id, clock.now());
        changed();
        return ok();
      case "unblock":
        accounts.unblockAccount(me.id, other.id);
        return ok();
    }
    return fail(500, "server_error", "Bir sorun oluştu, biraz sonra tekrar dene.");
  }

  async function resolve(req: IncomingMessage): Promise<Outcome> {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const rest = path.slice(FRIENDS_PATH.length).replace(/^\/+/, "");
    const method = req.method ?? "GET";
    const me = accountFromCookie(accounts, req.headers.cookie, clock.now());
    if (rest === "") {
      if (method !== "GET") return fail(405, "method_not_allowed", "Bu istek desteklenmiyor.");
      if (!me) return fail(401, "login_required", "Önce giriş yap.");
      return list(me);
    }
    const action = ACTIONS.find((a) => a === rest);
    if (!action) return fail(404, "not_found", "Bulunamadı.");
    if (method !== "POST") return fail(405, "method_not_allowed", "Bu istek desteklenmiyor.");
    if (!originAllowed(req, env.allowedOrigins)) return fail(403, "forbidden", "İstek reddedildi.");
    if (!me) return fail(401, "login_required", "Önce giriş yap.");
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json"))
      return fail(400, "invalid_input", "Geçersiz istek.");
    const name = parseUsername(await readJson(req));
    if (name === null) return fail(400, "invalid_input", "Kullanıcı adı geçersiz.");
    return act(me, action, name);
  }

  return (req, res) => {
    resolve(req)
      .then((out) => {
        if (out.status === 200) send(res, 200, out.body);
        else send(res, out.status, { ok: false, code: out.code, message: out.message });
      })
      .catch((err: unknown) => {
        log.error("friends_failed", { error: String(err) });
        if (!res.headersSent)
          send(res, 500, {
            ok: false,
            code: "server_error",
            message: "Bir sorun oluştu, biraz sonra tekrar dene.",
          });
        else res.end();
      });
  };
}
