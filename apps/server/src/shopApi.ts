import type { IncomingMessage, ServerResponse } from "node:http";
import {
  COSMETIC_TYPES,
  type CosmeticTypeId,
  cosmeticItem,
  dailyDeals,
  nextIstanbulMidnight,
} from "@glix/engine";
import type { Account, AccountStore } from "./accountStore.js";
import { accountFromCookie, originAllowed, readJson } from "./auth.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { TokenBucket } from "./ratelimit.js";
import type { Social } from "./social.js";
import { SECURITY_HEADERS } from "./static.js";

export const SHOP_PATH = "/api/shop";

export interface ShopEnv {
  accounts: AccountStore;
  social: Social;
  clock: Clock;
  allowedOrigins: readonly string[] | null;
}

interface Failure {
  status: 400 | 401 | 403 | 404 | 405 | 409 | 429 | 500;
  code: string;
  message: string;
  /** Ek alanlar (örn. yetersiz bakiyede `balance` ve `price`). */
  extra?: Record<string, unknown>;
}
type Outcome = { status: 200; body: Record<string, unknown> } | Failure;

const fail = (
  status: Failure["status"],
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Failure => ({ status, code, message, ...(extra ? { extra } : {}) });

const TOO_FAST = fail(429, "rate_limited", "Çok hızlı gidiyorsun, biraz yavaşla.");
const INVALID = fail(400, "invalid_input", "Geçersiz istek.");

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `{itemId}` gövdesi. */
export function parseBuy(data: unknown): { itemId: string } | null {
  if (!isRecord(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== "itemId") return null;
  const id = data.itemId;
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? { itemId: id } : null;
}

/**
 * `{type, itemId}` gövdesi; `itemId: null` temel (yok) seçimi. Giysilerde `itemId` `kimlik~renk` olabilir (renk
 * doğrulaması kuşanma sırasında: bilinmeyen renk 400 `unknown_colour`).
 */
export function parseEquip(data: unknown): { type: CosmeticTypeId; itemId: string | null } | null {
  if (!isRecord(data)) return null;
  const keys = Object.keys(data).sort();
  if (keys.length !== 2 || keys[0] !== "itemId" || keys[1] !== "type") return null;
  const type = COSMETIC_TYPES.find((t) => t.id === data.type)?.id;
  if (type === undefined) return null;
  const id = data.itemId;
  if (id === null) return { type, itemId: null };
  return typeof id === "string" && id.length > 0 && id.length <= 64 ? { type, itemId: id } : null;
}

/**
 * Mağaza uçları (`/api/shop`): durum (GET), satın alma ve kuşanma (POST). Oturum şart (misafir 401); POST'larda
 * Origin denetimi; hesap başına hız sınırı. Ücret her zaman sunucunun hesabıdır (fırsat dahil), istemciye güvenilmez.
 */
export function createShopApi(env: ShopEnv): (req: IncomingMessage, res: ServerResponse) => void {
  const { accounts, social, clock } = env;
  const reads = new Map<number, TokenBucket>();
  const writes = new Map<number, TokenBucket>();

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

  function state(me: Account): Outcome {
    if (!take(reads, me.id, 30, 1)) return TOO_FAST;
    const now = clock.now();
    const dump = accounts.cosmetics(me.id);
    return {
      status: 200,
      body: {
        ok: true,
        balance: accounts.glixBalance(me.id),
        owned: dump.owned.map((o) => o.itemId),
        equipped: dump.equipped,
        deals: dailyDeals(now),
        dealEndsAt: nextIstanbulMidnight(now),
        serverNow: now,
      },
    };
  }

  function buy(me: Account, itemId: string): Outcome {
    if (!take(writes, me.id, 20, 0.5)) return TOO_FAST;
    if (!cosmeticItem(itemId)) return fail(404, "unknown_item", "Bu ürün bulunamadı.");
    const r = accounts.purchaseCosmetic(me.id, itemId, clock.now());
    if (r.ok) {
      return { status: 200, body: { ok: true, balance: r.balance, price: r.price, itemId } };
    }
    switch (r.reason) {
      case "unknown":
        return fail(404, "unknown_item", "Bu ürün bulunamadı.");
      case "owned":
        return fail(409, "already_owned", "Bu ürüne zaten sahipsin.");
      case "insufficient":
        return fail(409, "insufficient_glix", "Yeterli Glix yok.", { balance: r.balance, price: r.price });
      case "missing":
        return fail(401, "login_required", "Önce giriş yap.");
    }
  }

  function equip(me: Account, type: CosmeticTypeId, itemId: string | null): Outcome {
    if (!take(writes, me.id, 20, 0.5)) return TOO_FAST;
    const r = accounts.equipCosmetic(me.id, type, itemId);
    switch (r) {
      case "ok":
        social.cosmeticsChanged(me.id);
        return { status: 200, body: { ok: true, equipped: accounts.equippedCosmetics(me.id) } };
      case "unknown":
        return fail(404, "unknown_item", "Bu ürün bulunamadı.");
      case "unknown_colour":
        return fail(400, "unknown_colour", "Bu renk seçilemez.");
      case "not_owned":
        return fail(409, "not_owned", "Bu ürüne sahip değilsin.");
      case "missing":
        return fail(401, "login_required", "Önce giriş yap.");
    }
  }

  async function resolve(req: IncomingMessage): Promise<Outcome> {
    const path = (req.url ?? "").split("?")[0] ?? "";
    const rest = path.slice(SHOP_PATH.length).replace(/^\/+/, "");
    const method = req.method ?? "GET";
    const me = accountFromCookie(accounts, req.headers.cookie, clock.now());
    if (rest === "") {
      if (method !== "GET") return fail(405, "method_not_allowed", "Bu istek desteklenmiyor.");
      if (!me) return fail(401, "login_required", "Önce giriş yap.");
      return state(me);
    }
    if (rest !== "buy" && rest !== "equip") return fail(404, "not_found", "Bulunamadı.");
    if (method !== "POST") return fail(405, "method_not_allowed", "Bu istek desteklenmiyor.");
    if (!originAllowed(req, env.allowedOrigins)) return fail(403, "forbidden", "İstek reddedildi.");
    if (!me) return fail(401, "login_required", "Önce giriş yap.");
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) return INVALID;
    const data = await readJson(req);
    if (rest === "buy") {
      const input = parseBuy(data);
      return input ? buy(me, input.itemId) : INVALID;
    }
    const input = parseEquip(data);
    return input ? equip(me, input.type, input.itemId) : INVALID;
  }

  return (req, res) => {
    resolve(req)
      .then((out) => {
        if (out.status === 200) send(res, 200, out.body);
        else send(res, out.status, { ok: false, code: out.code, message: out.message, ...out.extra });
      })
      .catch((err: unknown) => {
        log.error("shop_failed", { error: String(err) });
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
