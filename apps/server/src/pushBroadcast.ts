/**
 * Herkese web bildirimi (U16 A3). Hedefler: veritabanındaki hesap abonelikleri + açık odalardaki (misafir dahil)
 * bellek abonelikleri, uç noktaya göre tekilleştirilmiş. Saniyede en çok `perSecond` gönderim; 404/410 dönen abonelik
 * silinir. Saatte en çok bir gönderim (son gönderim `server_settings`te durur, yeniden başlatmada da geçerlidir).
 * Gönderim arka planda sürer; sonuç `status()` ile okunur.
 */
import type { AdminBroadcastResult, AdminBroadcastStatus } from "@glix/engine";
import type { AccountStore } from "./accountStore.js";
import type { Clock } from "./clock.js";
import { log } from "./log.js";
import type { Runtime } from "./runtime.js";
import type { PushTarget } from "./webpush.js";

export const BROADCAST_PER_SECOND = 20;
export const BROADCAST_MIN_GAP_MS = 3600 * 1000;
const KEY_LAST = "broadcast_last";

export interface BroadcastInput {
  title: string;
  body: string;
  /** Tıklamada açılacak site içi yol; yoksa ana sayfa. */
  url: string | null;
}

export type BroadcastStart =
  | { ok: true; total: number; done: Promise<AdminBroadcastResult> }
  | { ok: false; reason: "disabled" | "running" | "cooldown" | "empty"; nextAllowedAt: number | null };

export interface PushBroadcaster {
  status(): AdminBroadcastStatus;
  start(input: BroadcastInput): BroadcastStart;
}

interface Item {
  target: PushTarget;
  /** Kalıcı hesap aboneliği mi (değilse odadaki oyuncuya bağlı). */
  persisted: boolean;
}

function readLast(accounts: AccountStore): AdminBroadcastResult | null {
  try {
    const raw = accounts.settingGet(KEY_LAST);
    if (raw === null) return null;
    const v = JSON.parse(raw) as Partial<AdminBroadcastResult>;
    if (
      typeof v.at !== "number" ||
      typeof v.title !== "string" ||
      typeof v.total !== "number" ||
      typeof v.sent !== "number" ||
      typeof v.failed !== "number" ||
      typeof v.removed !== "number"
    )
      return null;
    return {
      at: v.at,
      title: v.title,
      total: v.total,
      sent: v.sent,
      failed: v.failed,
      removed: v.removed,
      finished: v.finished === true,
    };
  } catch {
    return null;
  }
}

export function createPushBroadcaster(
  rt: Runtime,
  accounts: AccountStore,
  clock: Clock,
  perSecond: number = BROADCAST_PER_SECOND,
): PushBroadcaster {
  let running: AdminBroadcastResult | null = null;

  const save = (r: AdminBroadcastResult): void => {
    try {
      accounts.settingSet(KEY_LAST, JSON.stringify(r), clock.now());
    } catch (err) {
      log.error("accounts_error", { op: "broadcast_save", error: String(err) });
    }
  };

  function collect(): Item[] {
    const seen = new Set<string>();
    const items: Item[] = [];
    for (const { target } of accounts.pushAll()) {
      if (seen.has(target.endpoint)) continue;
      seen.add(target.endpoint);
      items.push({ target, persisted: true });
    }
    for (const room of rt.rooms.values()) {
      for (const p of room.players.values()) {
        if (!p.push || seen.has(p.push.endpoint)) continue;
        seen.add(p.push.endpoint);
        items.push({ target: p.push, persisted: false });
      }
    }
    return items;
  }

  /** Oda oyuncusuna bağlı abonelik 404/410 verdiyse bellekten de düşer. */
  function dropRoomSubscription(endpoint: string): void {
    for (const room of rt.rooms.values())
      for (const p of room.players.values()) if (p.push?.endpoint === endpoint) p.push = null;
  }

  async function run(
    items: Item[],
    payload: string,
    result: AdminBroadcastResult,
  ): Promise<AdminBroadcastResult> {
    const wait = (ms: number): Promise<void> => new Promise((resolve) => clock.setTimeout(resolve, ms));
    for (let i = 0; i < items.length; i += perSecond) {
      if (i > 0) await wait(1000);
      const batch = items.slice(i, i + perSecond);
      await Promise.all(
        batch.map(async (item) => {
          let outcome: "ok" | "gone" | "error" = "error";
          try {
            outcome = await rt.push.send(item.target, payload);
          } catch {
            outcome = "error";
          }
          if (outcome === "ok") result.sent += 1;
          else if (outcome === "gone") {
            result.removed += 1;
            try {
              accounts.pushDeleteEndpoint(item.target.endpoint);
            } catch (err) {
              log.error("accounts_error", { op: "push_gone", error: String(err) });
            }
            dropRoomSubscription(item.target.endpoint);
          } else result.failed += 1;
        }),
      );
      save({ ...result, finished: false });
    }
    result.finished = true;
    save(result);
    return result;
  }

  function status(): AdminBroadcastStatus {
    const last = running ?? readLast(accounts);
    let nextAllowedAt: number | null = null;
    if (last && last.at + BROADCAST_MIN_GAP_MS > clock.now()) nextAllowedAt = last.at + BROADCAST_MIN_GAP_MS;
    // Sunucu gönderim sürerken yeniden başladıysa kayıt "bitmedi" kalır; süren iş yoksa yarıda kalmış sayılır.
    const shown = last && running === null && !last.finished ? { ...last, finished: true } : last;
    return {
      enabled: rt.push.enabled,
      subscribers: accounts.pushCount(),
      nextAllowedAt,
      last: shown ? { ...shown } : null,
    };
  }

  return {
    status,
    start(input) {
      const nextAllowedAt = status().nextAllowedAt;
      if (!rt.push.enabled) return { ok: false, reason: "disabled", nextAllowedAt };
      if (running) return { ok: false, reason: "running", nextAllowedAt };
      if (nextAllowedAt !== null) return { ok: false, reason: "cooldown", nextAllowedAt };
      const items = collect();
      if (items.length === 0) return { ok: false, reason: "empty", nextAllowedAt: null };
      const payload = JSON.stringify({
        title: input.title,
        body: input.body,
        tag: "glix-duyuru",
        ...(input.url ? { url: input.url } : {}),
      });
      const result: AdminBroadcastResult = {
        at: clock.now(),
        title: input.title,
        total: items.length,
        sent: 0,
        failed: 0,
        removed: 0,
        finished: false,
      };
      running = result;
      save(result);
      const done = run(items, payload, result).finally(() => {
        running = null;
      });
      done.catch((err: unknown) => log.error("broadcast_failed", { error: String(err) }));
      return { ok: true, total: items.length, done };
    },
  };
}
