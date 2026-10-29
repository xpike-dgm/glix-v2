// GLIX v2 sunucu içi ölçüm probu (yük testi için; üretimde kullanılmaz).
// Kullanım: PROBE_OUT=/yol/probe.jsonl node --import ./scripts/load-probe.mjs apps/server/dist/index.js
// Her saniye bir JSON satırı yazar: cpu (tek çekirdek = 100), rss/heap MB, olay döngüsü gecikmesi (p50/p99/max ms,
// ELU) ve SQLite çağrıları (adet, toplam, p50/p99/max ms, en yavaş SQL).
// Sunucu koduna dokunmaz: node:sqlite StatementSync/DatabaseSync yöntemleri sayaçla sarılır.
import { appendFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

const out = process.env.PROBE_OUT;
if (!out) throw new Error("PROBE_OUT gerekli");
writeFileSync(out, "");

const require = createRequire(import.meta.url);
const sqlite = require("node:sqlite");
let sql = { n: 0, total: 0, samples: [], worst: 0, worstSql: "" };
const resetSql = () => {
  sql = { n: 0, total: 0, samples: [], worst: 0, worstSql: "" };
};
const bySql = new Map(); // SQL metni -> { n, total, max } (sunucu kapanırken PROBE_OUT + ".sql.json")
function record(ms, text) {
  const key = String(text).replace(/\s+/g, " ").slice(0, 160);
  const agg = bySql.get(key) ?? { n: 0, total: 0, max: 0 };
  agg.n++;
  agg.total += ms;
  if (ms > agg.max) agg.max = ms;
  bySql.set(key, agg);
  sql.n++;
  sql.total += ms;
  if (sql.samples.length < 20000) sql.samples.push(ms);
  if (ms > sql.worst) {
    sql.worst = ms;
    sql.worstSql = String(text).replace(/\s+/g, " ").slice(0, 120);
  }
}
for (const name of ["run", "get", "all"]) {
  const orig = sqlite.StatementSync.prototype[name];
  sqlite.StatementSync.prototype[name] = function (...args) {
    const t0 = performance.now();
    try {
      return orig.apply(this, args);
    } finally {
      record(performance.now() - t0, this.sourceSQL);
    }
  };
}
const origExec = sqlite.DatabaseSync.prototype.exec;
sqlite.DatabaseSync.prototype.exec = function (text) {
  const t0 = performance.now();
  try {
    return origExec.call(this, text);
  } finally {
    record(performance.now() - t0, text);
  }
};

const RES = 10; // monitorEventLoopDelay çözünürlüğü (ms): taban gecikme
const h = monitorEventLoopDelay({ resolution: RES });
h.enable();
let lastCpu = process.cpuUsage();
let lastWall = performance.now();
let lastElu = performance.eventLoopUtilization();
const pct = (arr, p) => {
  if (arr.length === 0) return 0;
  const s = Float64Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const lag = (ns) => Math.max(0, ns / 1e6 - RES);
const r2 = (x) => Math.round(x * 100) / 100;
const timer = setInterval(() => {
  const wall = performance.now();
  const cpu = process.cpuUsage(lastCpu);
  const elu = performance.eventLoopUtilization(lastElu);
  const mem = process.memoryUsage();
  const line = {
    t: Date.now(),
    cpuPct: r2(((cpu.user + cpu.system) / 1000 / (wall - lastWall)) * 100),
    cpuUserPct: r2((cpu.user / 1000 / (wall - lastWall)) * 100),
    rssMb: r2(mem.rss / 1048576),
    heapMb: r2(mem.heapUsed / 1048576),
    elu: r2(elu.utilization),
    lagP50: r2(lag(h.percentile(50))),
    lagP99: r2(lag(h.percentile(99))),
    lagMax: r2(lag(h.max)),
    sql: {
      n: sql.n,
      totalMs: r2(sql.total),
      p50: r2(pct(sql.samples, 50)),
      p99: r2(pct(sql.samples, 99)),
      max: r2(sql.worst),
      worstSql: sql.worstSql,
    },
  };
  h.reset();
  resetSql();
  lastCpu = process.cpuUsage();
  lastWall = wall;
  lastElu = performance.eventLoopUtilization();
  appendFileSync(out, `${JSON.stringify(line)}\n`);
}, 1000);
timer.unref();

process.on("exit", () => {
  const rows = [...bySql]
    .map(([sqlText, a]) => ({
      sql: sqlText,
      n: a.n,
      totalMs: Math.round(a.total * 100) / 100,
      maxMs: Math.round(a.max * 100) / 100,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 25);
  writeFileSync(`${out}.sql.json`, JSON.stringify(rows, null, 1));
});
