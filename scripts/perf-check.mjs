// Başarım ölçümü: CPU 4x yavaşlatılmış, 390x844 mobil görünümde 5 sn kare süreleri.
// Sahneler: ana sayfa (Pixi zemin), oyun (Butona Bas, 150 ms'de bir basış), final (konfeti).
// Vite geliştirme sunucusunda çalışır (mock sayfaları yalnız orada). CI'da koşmaz (gürültülü).
// Önce `pnpm build`. Kullanım: `pnpm perf:check [sahne]`; ölçüler docs/qa/a3/PERF.md'ye elle işlenir.
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "apps/client");
const ONLY = process.argv[2] ?? "";
const RATE = Number(ENV.PERF_CPU_RATE ?? 4);
const DPR = Number(ENV.PERF_DPR ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}
function chromiumPath() {
  if (ENV.CHROMIUM_PATH) return ENV.CHROMIUM_PATH;
  const base = ENV.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .pop();
  const p = dir && join(base, dir, "chrome-linux/chrome");
  return p && existsSync(p) ? p : undefined;
}
async function startVite(port) {
  const require = createRequire(join(CLIENT, "package.json"));
  const viteBin = join(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  const child = spawn(
    process.execPath,
    [viteBin, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: CLIENT,
      env: { ...ENV, BROWSER: "none" },
      stdio: "ignore",
    },
  );
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/`)).ok) return child;
    } catch {
      // henüz açılmadı
    }
    await sleep(200);
  }
  child.kill();
  throw new Error("vite açılmadı");
}

const pct = (arr, p) => {
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? 0;
};
const summarize = (frames) => {
  if (frames.length < 2) return { fps: 0, p95: 0, max: 0, n: frames.length };
  const dts = frames.slice(1).map((t, i) => t - frames[i]);
  const span = frames[frames.length - 1] - frames[0];
  return { fps: (dts.length / span) * 1000, p95: pct(dts, 0.95), max: Math.max(...dts), n: dts.length };
};

const SCENES = [
  { name: "home", q: "mock=home", ready: ".home__bg canvas", warm: 1500 },
  {
    name: "playing",
    q: "mock=playing",
    ready: ".arcade__hit",
    warm: 1500,
    drive: async (page, stop) => {
      const box = await page.locator(".arcade__hit").boundingBox();
      while (!stop.done) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await sleep(40);
        await page.mouse.up();
        await sleep(110);
      }
    },
  },
  { name: "final", q: "mock=final&n=5", ready: ".confetti canvas", warm: 0, burst: 2200 },
];

async function measure(browser, scene, base) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: DPR,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__frames = [];
    window.__long = [];
    window.__rec = false;
    const loop = (t) => {
      if (window.__rec) window.__frames.push(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    try {
      new PerformanceObserver((l) => {
        if (window.__rec) for (const e of l.getEntries()) window.__long.push(e.duration);
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      // longtask yok
    }
  });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}/?${scene.q}`, { waitUntil: "load" });
  await page.waitForSelector(scene.ready, { timeout: 20000 });
  if (ENV.PERF_CSS) await page.addStyleTag({ content: ENV.PERF_CSS });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  await sleep(scene.warm);
  await page.evaluate(() => {
    window.__frames = [];
    window.__long = [];
    window.__rec = true;
  });
  const stop = { done: false };
  const driver = ENV.PERF_NOPRESS ? undefined : scene.drive?.(page, stop);
  await sleep(5000);
  stop.done = true;
  await driver;
  const { frames, long } = await page.evaluate(() => {
    window.__rec = false;
    return { frames: window.__frames, long: window.__long };
  });
  await ctx.close();
  const all = summarize(frames);
  const burst = scene.burst ? summarize(frames.filter((t) => t - frames[0] <= scene.burst)) : null;
  return { all, burst, long: long.filter((d) => d > 50) };
}

async function main() {
  const port = await freePort();
  const vite = await startVite(port);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const warm = await browser.newPage();
    for (const q of ["mock=home", "mock=playing", "mock=final"])
      await warm.goto(`${base}/?${q}`, { waitUntil: "networkidle" });
    await warm.close();
    console.log(`CPU x${RATE}, 390x844 @${DPR}x, 5 sn\n`);
    let fail = false;
    for (const scene of SCENES) {
      if (ONLY && scene.name !== ONLY) continue;
      const r = await measure(browser, scene, base);
      const ok = r.all.fps >= 55 && r.all.p95 <= 20 && r.long.length === 0;
      if (!ok) fail = true;
      console.log(
        `${ok ? "✓" : "✗"} ${scene.name.padEnd(8)} ortalama ${r.all.fps.toFixed(1)} fps · p95 ${r.all.p95.toFixed(1)} ms · en kötü ${r.all.max.toFixed(0)} ms · uzun görev(>50ms) ${r.long.length}` +
          (r.burst
            ? `\n           konfeti penceresi (${scene.burst} ms): ${r.burst.fps.toFixed(1)} fps · p95 ${r.burst.p95.toFixed(1)} ms`
            : ""),
      );
    }
    console.log("\nHedef: >= 55 fps ortalama, p95 <= 20 ms, yüklemeden sonra uzun görev yok.");
    process.exitCode = fail ? 1 : 0;
  } finally {
    await browser.close();
    vite.kill();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
