// GLIX simge ve ekran görüntüsü üreticisi. Yeni bağımlılık yok: SVG, mevcut Chromium ile (playwright-core) çizilir.
// Kullanım: `node scripts/gen-icons.mjs` (simgeler) ya da `node scripts/gen-icons.mjs --screenshots`
// (kurulum penceresi için ekran görüntüleri; Vite geliştirme sunucusunu mock sayfalarıyla açar).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "apps/client");
const PUB = join(CLIENT, "public");
const ICONS = join(PUB, "icons");
const SHOTS = join(PUB, "screenshots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Logo: derin lacivert yuvarlak kare, neon (camgöbeği → macenta) "G".
 * `maskable`: tam taşan zemin + G güvenli alanın (merkez çember, çap %80) içinde kalır.
 * `rounded`: köşe yarıçapı (0 = tam kare, zemin kenara kadar).
 */
function logo({ rounded = true, maskable = false } = {}) {
  const k = maskable ? 0.86 : 1; // G'yi güvenli alana sığdırmak için küçült
  const rx = rounded ? 112 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<title>GLIX</title>
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121a45"/><stop offset="1" stop-color="#05081a"/></linearGradient>
<linearGradient id="neon" x1="96" y1="96" x2="416" y2="416" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2ef2ff"/><stop offset=".55" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
<radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8b5cff" stop-opacity=".38"/><stop offset="1" stop-color="#8b5cff" stop-opacity="0"/></radialGradient>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/>
<circle cx="256" cy="256" r="236" fill="url(#halo)"/>
<g transform="translate(256 256) scale(${k}) translate(-256 -256)" fill="none" stroke-linecap="round" stroke-linejoin="round">
<path d="M367 160A134 134 0 1 0 390 256H274" stroke="url(#neon)" stroke-width="62" opacity=".55" filter="url(#glow)"/>
<path d="M367 160A134 134 0 1 0 390 256H274" stroke="url(#neon)" stroke-width="56"/>
</g>
</svg>
`;
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

async function renderPng(browser, svg, size, path) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
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
  mkdirSync(ICONS, { recursive: true });
  const plain = logo();
  writeFileSync(join(PUB, "favicon.svg"), plain);
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
  try {
    await renderPng(browser, plain, 192, join(ICONS, "icon-192.png"));
    await renderPng(browser, plain, 512, join(ICONS, "icon-512.png"));
    await renderPng(
      browser,
      logo({ rounded: false, maskable: true }),
      512,
      join(ICONS, "icon-maskable-512.png"),
    );
    // iOS köşeleri kendisi yuvarlar; saydam piksel siyaha döner, bu yüzden tam kare ve opak.
    await renderPng(browser, logo({ rounded: false }), 180, join(ICONS, "apple-touch-icon.png"));
    console.log("simgeler yazıldı:", ICONS);
    if (process.argv.includes("--screenshots")) {
      await screenshots(browser);
      console.log("ekran görüntüleri yazıldı:", SHOTS);
    }
  } finally {
    await browser.close();
  }
}

await main();
