/** Sunucu içinden istatistik özeti: `docker exec glix-glix-1 node dist/stats.js`. */
import { existsSync } from "node:fs";
import { summarize } from "./statsSummary.js";

const path = process.env.STATS_DB || "/data/glix.db";
if (!existsSync(path)) {
  process.stderr.write(`İstatistik veritabanı bulunamadı: ${path}\n`);
  process.exit(1);
}
process.stdout.write(`${summarize(path)}\n`);
