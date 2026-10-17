import { loadConfig } from "./config.js";
import { log } from "./log.js";
import { startServer } from "./server.js";

const config = loadConfig();
const running = await startServer(config);
log.info("listening", { host: config.host, port: running.port, clientDir: config.clientDir });

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  log.info("shutdown", { signal });
  setTimeout(() => {
    log.error("shutdown_timeout");
    process.exit(1);
  }, 10_000).unref();
  await running.close();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
