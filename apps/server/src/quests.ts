import type { IncomingMessage, ServerResponse } from "node:http";
import {
  dailyQuests,
  istanbulDayNumber,
  nextIstanbulMidnight,
  type QuestCompleted,
  type QuestView,
  questDone,
  questProgress,
  questReward,
} from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import { accountFromCookie } from "./auth.js";
import { istanbulDayStart } from "./badges.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import { TokenBucket } from "./ratelimit.js";
import { SECURITY_HEADERS } from "./static.js";

export const QUESTS_PATH = "/api/quests";

/** Hesabın bugünkü üç görevi ve ilerlemesi (kayıtlı satırlardan hesaplanır; ödenmiş görev tamamlanmış sayılır). */
export function questViews(store: AccountStore, accountId: number, now: number): QuestView[] {
  const dayStart = istanbulDayStart(now);
  const facts = store.questFacts(accountId, dayStart);
  const paid = new Set(store.questsPaid(accountId, dayStart));
  return dailyQuests(accountId, istanbulDayNumber(now)).map((q) => {
    const done = paid.has(q.id) || questDone(q, facts);
    return {
      id: q.id,
      text: q.text,
      target: q.target,
      progress: done ? q.target : questProgress(q, facts),
      reward: questReward(q),
      done,
    };
  });
}

/**
 * Maç sonunda: tamamlanmış ama ödenmemiş görevleri öder (idempotent; tek işlem). Yeni ödenenleri ve bakiyeyi döner;
 * yeni ödeme yoksa null.
 */
export function settleQuests(
  store: AccountStore,
  accountId: number,
  now: number,
): { quests: QuestCompleted[]; balance: number } | null {
  const dayStart = istanbulDayStart(now);
  const facts = store.questFacts(accountId, dayStart);
  const todo = dailyQuests(accountId, istanbulDayNumber(now)).filter((q) => questDone(q, facts));
  if (todo.length === 0) return null;
  const res = store.creditQuests(
    accountId,
    dayStart,
    now,
    todo.map((q) => ({ id: q.id, reward: questReward(q) })),
  );
  if (!res || res.paid.length === 0) return null;
  const text = new Map(todo.map((q) => [q.id, q.text]));
  return {
    quests: res.paid.map((p) => ({ id: p.id, text: text.get(p.id) ?? "", reward: p.reward })),
    balance: res.balance,
  };
}

export interface QuestsEnv {
  accounts: AccountStore;
  clock: Clock;
  /** Anahtar (varsayılan kapalı). Kapalıyken `{enabled:false}` döner, hiçbir görev ya da ilerleme sızmaz. */
  enabled: () => boolean;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...SECURITY_HEADERS,
  });
  res.end(JSON.stringify(body));
}

/** `GET /api/quests`: oturum şart (misafir 401). */
export function createQuestsApi(env: QuestsEnv): (req: IncomingMessage, res: ServerResponse) => void {
  const reads = new Map<number, TokenBucket>();
  return (req, res) => {
    try {
      if ((req.method ?? "GET") !== "GET")
        return send(res, 405, { ok: false, code: "method_not_allowed", message: "Bu istek desteklenmiyor." });
      const now = env.clock.now();
      const me = accountFromCookie(env.accounts, req.headers.cookie, now);
      if (!me) return send(res, 401, { ok: false, code: "login_required", message: "Önce giriş yap." });
      let b = reads.get(me.id);
      if (!b) {
        if (reads.size > 5000) for (const [k, v] of reads) if (v.isFull()) reads.delete(k);
        b = new TokenBucket(env.clock, 30, 1);
        reads.set(me.id, b);
      }
      if (!b.take())
        return send(res, 429, {
          ok: false,
          code: "rate_limited",
          message: "Çok hızlı gidiyorsun, biraz yavaşla.",
        });
      if (!env.enabled()) return send(res, 200, { ok: true, enabled: false });
      send(res, 200, {
        ok: true,
        enabled: true,
        quests: questViews(env.accounts, me.id, now),
        endsAt: nextIstanbulMidnight(now),
        serverNow: now,
      });
    } catch (err) {
      log.error("quests_failed", { error: String(err) });
      if (!res.headersSent)
        send(res, 500, {
          ok: false,
          code: "server_error",
          message: "Bir sorun oluştu, biraz sonra tekrar dene.",
        });
      else res.end();
    }
  };
}
