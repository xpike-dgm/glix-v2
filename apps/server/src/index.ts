import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { startServer } from "./server.js";

const config = loadConfig();
const running = await startServer(config);
log.info("listening", { host: config.host, port: running.port, clientDir: config.clientDir });

let stopping = false;
let draining = false;

async function stop(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  setTimeout(() => {
    log.error("shutdown_timeout");
    process.exit(1);
  }, 10_000).unref();
  await running.close(code);
  process.exit(0);
}

/** SIGTERM: maçlar bitene (ya da süre dolana) kadar bekle, sonra 1012 ile kapat. İkinci sinyal beklemeyi keser. */
async function drainAndStop(signal: string): Promise<void> {
  if (draining) {
    log.warn("drain_skipped", { signal });
    await stop(1012);
    return;
  }
  draining = true;
  log.info("drain_start", { signal, timeoutMs: config.drainTimeoutMs });
  await running.drain();
  log.info("drain_done");
  await stop(1012);
}

process.on("SIGTERM", () => void drainAndStop("SIGTERM"));
// Geliştirmede Ctrl+C beklemeden kapatır.
process.on("SIGINT", () => {
  log.info("shutdown", { signal: "SIGINT" });
  void stop(1001);
});
