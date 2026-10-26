// GLIX kurulum penceresi ekran görüntüsü üreticisi. Yeni bağımlılık yok: SVG, mevcut Chromium ile (playwright-core) çizilir.
// Kullanım: `node scripts/gen-icons.mjs` (Vite geliştirme sunucusunu mock sayfalarıyla açar).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "apps/client");
const PUB = join(CLIENT, "public");
const SHOTS = join(PUB, "screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function startVite(port) {
  const require = createRequire(join(CLIENT, "package.json"));
  const viteBin = join(dirname(require.resolve("vite/package.json")), "bin/vite.js");
  const child = spawn(
    process.execPath,
    [viteBin, "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    { cwd: CLIENT, env: { ...ENV, BROWSER: "none" }, stdio: ["ignore", "pipe", "pipe"] },
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

async function screenshots(browser) {
  mkdirSync(SHOTS, { recursive: true });
  const port = await freePort();
  const vite = await startVite(port);
  try {
    const jobs = [
      ["ana-sayfa.png", "mock=home", 540, 1170, 2200],
      ["lobi.png", "mock=lobby&n=6", 540, 1170, 1200],
      ["ana-sayfa-yatay.png", "mock=home", 1280, 720, 2200],
    ];
    for (const [file, q, w, h, settle] of jobs) {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${port}/?${q}`);
      await sleep(settle);
      await page.screenshot({ path: join(SHOTS, file) });
      await ctx.close();
    }
  } finally {
    vite.kill();
  }
}

async function main() {
  // Simgeler artık marka görsellerinden gelir (apps/client/public/icons, docs/gorsel/LOGO.md); burada yalnız
  // kurulum penceresinin ekran görüntüleri üretilir.
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
  try {
    await screenshots(browser);
    console.log("ekran görüntüleri yazıldı:", SHOTS);
  } finally {
    await browser.close();
  }
}

await main();
