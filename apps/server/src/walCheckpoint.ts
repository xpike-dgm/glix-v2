import type { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { log } from "./log.js";

/**
 * SQLite WAL checkpoint'ini ana iş parçacığından çıkarır.
 *
 * Varsayılan otomatik checkpoint, eşiği aşan commit'i yapan çağrıyı (fsync dahil) bloklar; bu da
 * tüm odaların event-loop'unu yüzlerce ms durdurabilir. Burada ana bağlantıda otomatik checkpoint
 * kapatılır, ayrı bir worker iş parçacığı kendi bağlantısıyla aralıklı `PASSIVE` checkpoint yapar
 * (PASSIVE yazarları ve okuyucuları beklemez). Worker açılamaz ya da ölürse ana bağlantı varsayılan
 * otomatik checkpoint'e (1000 sayfa) geri döner.
 */

export const WAL_CHECKPOINT_INTERVAL_MS = 5000;
const DEFAULT_AUTOCHECKPOINT_PAGES = 1000;
const STOP_WAIT_MS = 1500;

/** Worker kaynağı (CommonJS, `eval`). Testler bozuk bir kaynak verip geri dönüşü sınayabilir. */
export const CHECKPOINT_WORKER_SOURCE = `
const { workerData, parentPort } = require("node:worker_threads");
const original = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const type = typeof rest[0] === "string" ? rest[0] : rest[0] && rest[0].type;
  if (type === "ExperimentalWarning") return;
  return original.call(process, warning, ...rest);
};
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(workerData.path);
db.exec("PRAGMA busy_timeout = 2000");
const flag = new Int32Array(workerData.flag);
const timer = setInterval(() => {
  try {
    db.exec("PRAGMA wal_checkpoint(PASSIVE)");
  } catch {}
}, workerData.intervalMs);
parentPort.on("message", (msg) => {
  if (msg !== "stop") return;
  clearInterval(timer);
  try {
    db.close();
  } catch {}
  Atomics.store(flag, 0, 1);
  Atomics.notify(flag, 0);
  parentPort.close();
});
`;

export interface WalCheckpointer {
  /**
   * Önce worker bağlantısını kapatır (kısa süre beklenir), sonra worker'ı sonlandırır. Çağıran bunun
   * ardından ana bağlantıyı kapatmalıdır. Tekrar çağrılabilir.
   */
  stop(): void;
}

export interface WalCheckpointOptions {
  intervalMs?: number;
  /** Yalnız testler için. */
  workerSource?: string;
}

export function isFileDatabase(path: string): boolean {
  return path !== "" && path !== ":memory:" && !path.startsWith("file::memory:");
}

/** Dosya veritabanı için checkpoint worker'ı başlatır; bellek içi veritabanında `null` döner. */
export function startWalCheckpointer(
  db: DatabaseSync,
  path: string,
  opts: WalCheckpointOptions = {},
): WalCheckpointer | null {
  if (!isFileDatabase(path)) return null;
  const intervalMs = opts.intervalMs ?? WAL_CHECKPOINT_INTERVAL_MS;
  const flagBuffer = new SharedArrayBuffer(4);
  const flag = new Int32Array(flagBuffer);
  let stopping = false;
  let alive = false;
  let worker: Worker;

  function fallback(reason: string): void {
    if (stopping || !alive) return;
    alive = false;
    try {
      db.exec(`PRAGMA wal_autocheckpoint = ${DEFAULT_AUTOCHECKPOINT_PAGES}`);
    } catch (err) {
      log.error("wal_checkpoint_error", { op: "fallback", error: String(err) });
    }
    log.warn("wal_checkpoint_fallback", { reason });
  }

  try {
    db.exec("PRAGMA wal_autocheckpoint = 0");
    alive = true;
    worker = new Worker(opts.workerSource ?? CHECKPOINT_WORKER_SOURCE, {
      eval: true,
      workerData: { path, intervalMs, flag: flagBuffer },
    });
  } catch (err) {
    fallback(String(err));
    return { stop: () => {} };
  }
  worker.unref();
  worker.on("error", (err) => fallback(String(err)));
  worker.on("exit", () => fallback("exit"));

  return {
    stop() {
      if (stopping) return;
      const wasAlive = alive;
      stopping = true;
      if (wasAlive) {
        worker.postMessage("stop");
        Atomics.wait(flag, 0, 0, STOP_WAIT_MS);
      }
      void worker.terminate();
    },
  };
}
