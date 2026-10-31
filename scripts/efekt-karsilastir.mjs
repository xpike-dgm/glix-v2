// Efekt görünümü karşılaştırması (MG-4): ad efektleri ve çerçeveler tariflere çevrildikten sonra görünümün aynı
// kaldığını ekran görüntüsüyle denetler. Vite geliştirme sunucusunda `?mock=efektler` sayfasını açar, bütün CSS
// animasyonlarını birkaç sabit anda dondurup ekran görüntüsü alır.
//
//   node scripts/efekt-karsilastir.mjs cek <klasör>            görüntüleri <klasör>'e yazar
//   node scripts/efekt-karsilastir.mjs karsilastir <önce> <sonra> <fark-klasörü>
//                                                              piksel farkını ölçer, fark görüntülerini yazar
//
// Karşılaştırmada iki pikselin kanal farkı 24'ten büyükse "farklı" sayılır (kenar yumuşatma payı); görüntü başına
// farklı piksel oranı %0,5'i geçerse betik hata verir. Önce `pnpm build` (motor paketi dist'ten okunur).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "apps/client");
const [cmd, ...rest] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Animasyonların dondurulduğu anlar (ms). */
const TIMES = [0, 700, 1300, 2100, 3500, 5200];
const VARIANTS = [
  { id: "tam", query: "" },
  { id: "sade", query: "&motion=reduce" },
];

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

/** 40000–49999 arasında boş bir port. */
async function freePort() {
  for (let i = 0; i < 50; i++) {
    const port = 40000 + Math.floor(Math.random() * 10000);
    const ok = await new Promise((done) => {
      const s = createServer();
      s.once("error", () => done(false));
      s.listen(port, "127.0.0.1", () => s.close(() => done(true)));
    });
    if (ok) return port;
  }
  throw new Error("boş port bulunamadı");
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
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`vite kapandı:\n${out}`);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      if (r.ok) return child;
    } catch {
      // henüz açılmadı
    }
    await sleep(200);
  }
  child.kill();
  throw new Error(`vite açılmadı:\n${out}`);
}

async function capture(outDir) {
  mkdirSync(outDir, { recursive: true });
  const port = await freePort();
  const vite = await startVite(port);
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  try {
    for (const v of VARIANTS) {
      const page = await browser.newPage({ viewport: { width: 640, height: 1100 }, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:${port}/?mock=efektler${v.query}`, { waitUntil: "networkidle" });
      await page.waitForSelector("html[data-ready]");
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".efekt-tablo img")].every((i) => i.complete && i.naturalWidth > 0),
      );
      await sleep(300);
      for (const t of TIMES) {
        await page.evaluate((ms) => {
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = ms;
          }
        }, t);
        await sleep(80);
        for (const part of ["adlar", "cerceveler"]) {
          const el = page.locator(`[data-efekt="${part}"]`);
          await el.screenshot({ path: join(outDir, `${v.id}-${part}-${String(t).padStart(4, "0")}.png`) });
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    vite.kill();
  }
  console.log(`görüntüler yazıldı: ${outDir}`);
}

async function compare(before, after, diffDir) {
  mkdirSync(diffDir, { recursive: true });
  const files = readdirSync(before).filter((f) => f.endsWith(".png"));
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const page = await browser.newPage();
  const report = [];
  let worst = 0;
  for (const f of files) {
    if (!existsSync(join(after, f))) throw new Error(`sonra klasöründe yok: ${f}`);
    const a = readFileSync(join(before, f)).toString("base64");
    const b = readFileSync(join(after, f)).toString("base64");
    const r = await page.evaluate(
      async ({ a, b }) => {
        const load = (s) =>
          new Promise((ok, no) => {
            const i = new Image();
            i.onload = () => ok(i);
            i.onerror = no;
            i.src = `data:image/png;base64,${s}`;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const w = Math.max(ia.width, ib.width);
        const h = Math.max(ia.height, ib.height);
        const px = (img) => {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const g = c.getContext("2d");
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, w, h);
        };
        const da = px(ia);
        const db = px(ib);
        const out = new ImageData(w, h);
        let diff = 0;
        let maxDelta = 0;
        for (let i = 0; i < da.data.length; i += 4) {
          let d = 0;
          for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(da.data[i + k] - db.data[i + k]));
          maxDelta = Math.max(maxDelta, d);
          const bad = d > 24;
          if (bad) diff += 1;
          out.data[i] = bad ? 255 : da.data[i] * 0.3;
          out.data[i + 1] = bad ? 40 : da.data[i + 1] * 0.3;
          out.data[i + 2] = bad ? 80 : da.data[i + 2] * 0.3;
          out.data[i + 3] = 255;
        }
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d").putImageData(out, 0, 0);
        return {
          sameSize: ia.width === ib.width && ia.height === ib.height,
          ratio: diff / (w * h),
          diff,
          maxDelta,
          png: c.toDataURL("image/png").split(",")[1],
        };
      },
      { a, b },
    );
    writeFileSync(join(diffDir, f), Buffer.from(r.png, "base64"));
    worst = Math.max(worst, r.sameSize ? r.ratio : 1);
    report.push({
      dosya: f,
      ayniBoyut: r.sameSize,
      farkliPiksel: r.diff,
      oran: r.ratio,
      enBuyukFark: r.maxDelta,
    });
  }
  await browser.close();
  writeFileSync(join(diffDir, "rapor.json"), JSON.stringify(report, null, 2));
  for (const r of report)
    console.log(
      `${r.dosya}: ${r.ayniBoyut ? "" : "BOYUT FARKLI "}${r.farkliPiksel} piksel (%${(r.oran * 100).toFixed(3)}), en büyük kanal farkı ${r.enBuyukFark}`,
    );
  if (worst > 0.005) {
    console.error(`görünüm değişti: en kötü oran %${(worst * 100).toFixed(3)}`);
    process.exit(1);
  }
  console.log(`görünüm aynı (en kötü oran %${(worst * 100).toFixed(3)})`);
}

if (cmd === "cek" && rest[0]) await capture(resolve(rest[0]));
else if (cmd === "karsilastir" && rest.length === 3)
  await compare(resolve(rest[0]), resolve(rest[1]), resolve(rest[2]));
else {
  console.error("kullanım: cek <klasör> | karsilastir <önce> <sonra> <fark>");
  process.exit(2);
}
