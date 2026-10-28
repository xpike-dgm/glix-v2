// Başarım ölçümü (telefon sınıfı): anahtar ekranlarda yükleme, görsel gecikmesi ve 5 sn kararlı durum kare süreleri.
//
// Neden üretim yapısı: Vite geliştirme sunucusu yüzlerce ayrı modül, küçültülmemiş kod ve farklı önbellek davranışı
// verir; sayılar gerçeği yansıtmaz. Mock ekranlar yalnız `import.meta.env.DEV` ile açıldığından
// `apps/client/vite.perf.config.ts` üretim paketini bu bayrak açık ve hizmet çalışanı kapalı üretir (dist-perf/),
// bu betik onu gzip + üretimdeki gibi önbellek başlıklarıyla (hash'li dosya: immutable; html: no-cache) sunar.
//
// Ölçü ortamı: 390x844, DPR 3, CPU 4x yavaş (CDP), ağ 10 Mbps / 40 ms RTT (CDP). TV ekranları 1920x1080, kısıtsız.
// Her ekran iki kez: soğuk (boş önbellek) ve ılık (aynı bağlamda ikinci açılış, HTTP önbelleği dolu).
// Not: başsız Chromium'da raster/GPU yazılımsaldır (swiftshader); paint/raster süreleri gerçek telefondan kötü olabilir,
// ekranlar arası ve önce/sonra karşılaştırması için kullanılır, mutlak sayı olarak okunmaz.
//
// Kullanım: node scripts/perf-check.mjs [--cikti docs/qa/perf/before.md] [--ekran ad,ad] [--hizli] [--yapma]
//   --yapma: dist-perf yeniden üretilmez.  --hizli: 3 sn ölçüm ve iz kaydı yok.
import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer as createHttp } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = join(ROOT, "apps/client");
const DIST = ENV.PERF_DIST ? resolve(ENV.PERF_DIST) : join(CLIENT, "dist-perf");
const ARGS = process.argv.slice(2);
const argVal = (n) => {
  const i = ARGS.indexOf(n);
  return i >= 0 ? ARGS[i + 1] : undefined;
};
const OUT = argVal("--cikti");
const ONLY = (argVal("--ekran") ?? "").split(",").filter(Boolean);
const QUICK = ARGS.includes("--hizli");
const RATE = Number(ENV.PERF_CPU_RATE ?? 4);
const MEASURE_MS = QUICK ? 3000 : 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PHONE = { w: 390, h: 844, dpr: 3, cpu: RATE, net: true, mobile: true };
const LAND = { w: 844, h: 390, dpr: 3, cpu: RATE, net: true, mobile: true };
const TV = { w: 1920, h: 1080, dpr: 1, cpu: 1, net: false, mobile: false };

const press = async (page, sel) => {
  const box = await page.locator(sel).first().boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(40);
  await page.mouse.up();
};

/** Ekran listesi: ad, sorgu, ortam. `drive`: ölçüm sırasında kullanıcı etkileşimi. */
const SCENES = [
  { name: "home", q: "mock=home", env: PHONE },
  { name: "lobi-8", q: "mock=lobby&n=8", env: PHONE },
  { name: "anlatim-kule", q: "mock=kule-briefing", env: PHONE },
  { name: "anlatim-kor-bomba", q: "mock=kor-bomba-briefing", env: PHONE },
  { name: "anlatim-zaman", q: "mock=zaman-briefing", env: PHONE },
  { name: "anlatim-asiri", q: "mock=asiri-yukleme-briefing", env: PHONE },
  { name: "anlatim-karalama", q: "mock=karalama-briefing", env: PHONE },
  { name: "geri-sayim", q: "mock=countdown", env: PHONE },
  {
    name: "sonuc-5",
    q: "mock=results&n=5",
    env: PHONE,
    // Sıradaki oyunun (Kör Bomba) anlatım görselleri sonuç ekranındayken önden inmiş olmalı; Çağrışım Ağı kontrol (önden inmez).
    probeNext: [
      "/assets/briefing/kor-bomba-1.webp",
      "/assets/briefing/kor-bomba-2.webp",
      "/assets/briefing/kor-bomba-3.webp",
      "/assets/worlds/kor-bomba-portrait.webp",
    ],
    probeControl: [
      "/assets/briefing/cagrisim-agi-1.webp",
      "/assets/briefing/cagrisim-agi-2.webp",
      "/assets/briefing/cagrisim-agi-3.webp",
      "/assets/worlds/cagrisim-agi-portrait.webp",
    ],
  },
  { name: "final-8", q: "mock=final&n=8", env: PHONE },
  { name: "kart-secim", q: "mock=kart-secim", env: PHONE },
  { name: "tv-lobi-8", q: "mock=tv-lobby&n=8", env: TV },
  { name: "tv-sonuc", q: "mock=tv-results&n=6", env: TV },
  { name: "tv-final", q: "mock=tv-final&n=8", env: TV },
  { name: "oyun-kule", q: "mock=kule-turn", env: PHONE },
  { name: "oyun-kor-bomba", q: "mock=kor-bomba-holder", env: LAND },
  { name: "oyun-zaman", q: "mock=zaman-mine", env: PHONE },
  {
    name: "oyun-butona-bas",
    q: "mock=playing",
    env: PHONE,
    drive: async (page, stop) => {
      while (!stop.done) {
        await press(page, ".arcade__hit");
        await sleep(110);
      }
    },
  },
  { name: "oyun-asiri", q: "mock=asiri-yukleme-playing", env: PHONE },
  { name: "oyun-karalama", q: "mock=karalama-draw", env: PHONE },
].filter((s) => ONLY.length === 0 || ONLY.includes(s.name));

// ---------------------------------------------------------------- yardımcılar
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};
const f = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : "-");

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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};
const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg"]);

/** dist-perf'i üretimdeki gibi sunar: metin gzip, hash'li dosya immutable, html no-cache. */
function serveDist() {
  const gz = new Map();
  const server = createHttp((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    let rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (rel === "/" || rel === "") rel = "/index.html";
    const file = join(DIST, rel);
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const ext = extname(file);
    const headers = { "Content-Type": MIME[ext] ?? "application/octet-stream" };
    const hashed = /\/assets\/.*-[\w-]{8}\.(js|css|woff2)$/.test(rel);
    headers["Cache-Control"] = hashed
      ? "public, max-age=31536000, immutable"
      : ext === ".html"
        ? "no-cache"
        : "public, max-age=86400";
    if (COMPRESSIBLE.has(ext) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
      let body = gz.get(file);
      if (!body) {
        body = gzipSync(readFileSync(file));
        gz.set(file, body);
      }
      headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = body.length;
      res.writeHead(200, headers).end(body);
      return;
    }
    headers["Content-Length"] = statSync(file).size;
    res.writeHead(200, headers);
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

/** Sayfaya girmeden önce enjekte edilir: kare, uzun görev, görsel ve boyama ölçümü. */
const INIT = () => {
  const w = window;
  w.__perf = { frames: [], long: [], rec: false, imgs: [], fcp: 0, lcp: 0, shownAt: 0, firstFrame: 0 };
  const loop = (t) => {
    if (!w.__perf.shownAt && document.documentElement?.hasAttribute("data-ready"))
      w.__perf.shownAt = performance.now();
    if (w.__perf.shownAt && !w.__perf.firstFrame) w.__perf.firstFrame = t;
    if (w.__perf.rec) w.__perf.frames.push(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const obs = (type, cb) => {
    try {
      new PerformanceObserver((l) => cb(l.getEntries())).observe({ type, buffered: true });
    } catch {
      /* desteklenmiyor */
    }
  };
  obs("longtask", (es) => {
    if (w.__perf.rec) for (const e of es) w.__perf.long.push(e.duration);
  });
  obs("paint", (es) => {
    for (const e of es) if (e.name === "first-contentful-paint") w.__perf.fcp = e.startTime;
  });
  obs("largest-contentful-paint", (es) => {
    for (const e of es) w.__perf.lcp = e.startTime;
  });
  // <img> öğeleri: DOM'a girdi -> yüklendi -> çözüldü (decode) zamanları.
  const seen = new WeakSet();
  const track = (img) => {
    if (seen.has(img)) return;
    seen.add(img);
    const rec = { src: img.currentSrc || img.src, added: performance.now(), load: 0, decode: 0 };
    w.__perf.imgs.push(rec);
    const done = () => {
      rec.src = img.currentSrc || img.src;
      rec.load = performance.now();
      img
        .decode()
        .then(() => {
          rec.decode = performance.now();
        })
        .catch(() => {
          rec.decode = performance.now();
        });
    };
    if (img.complete && img.naturalWidth > 0) done();
    else img.addEventListener("load", done, { once: true });
  };
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.tagName === "IMG") track(n);
        else for (const i of n.querySelectorAll?.("img") ?? []) track(i);
      }
      if (m.type === "attributes" && m.target.tagName === "IMG") {
        seen.delete(m.target);
        track(m.target);
      }
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
};

const metricMap = (m) => Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));

/** Bir izden (Tracing) boyama/bileşim/raster/çözümleme toplam süreleri (ms). */
function sumTrace(events) {
  const want = {
    Paint: "paint",
    PrePaint: "prepaint",
    Layout: "layout",
    UpdateLayoutTree: "style",
    Layerize: "layerize",
    CompositeLayers: "composite",
    Commit: "commit",
    RasterTask: "raster",
    ImageDecodeTask: "imgdecode",
    "Decode Image": "imgdecode",
    GPUTask: "gpu",
  };
  const out = {
    paint: 0,
    prepaint: 0,
    layout: 0,
    style: 0,
    layerize: 0,
    composite: 0,
    commit: 0,
    raster: 0,
    imgdecode: 0,
    gpu: 0,
  };
  for (const e of events) {
    const k = want[e.name];
    if (k && e.dur) out[k] += e.dur / 1000;
  }
  return out;
}

async function openPage(ctx, scene) {
  const page = await ctx.newPage();
  await page.bringToFront();
  const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(INIT);
  await cdp.send("Network.enable");
  if (scene.env.net)
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 40,
      downloadThroughput: (10 * 1024 * 1024) / 8,
      uploadThroughput: (10 * 1024 * 1024) / 8,
    });
  if (scene.env.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: scene.env.cpu });
  await cdp.send("Performance.enable");
  return { page, cdp };
}

/** Bir yükleme (soğuk ya da ılık): açılış ve görsel ölçüleri. */
async function loadOnce(ctx, scene, base) {
  const { page, cdp } = await openPage(ctx, scene);
  await page.goto(`${base}/?${scene.q}`, { waitUntil: "commit" });
  await page.waitForSelector("html[data-ready]", { state: "attached", timeout: 60000 });
  // Görsellerin oturması için bekle (ağ sessizliği ya da 6 sn).
  await Promise.race([page.waitForLoadState("networkidle").catch(() => {}), sleep(6000)]);
  await sleep(500);
  const m0 = metricMap(await cdp.send("Performance.getMetrics"));
  const data = await page.evaluate(() => {
    const p = window.__perf;
    const res = performance.getEntriesByType("resource").map((r) => ({
      name: r.name.replace(location.origin, ""),
      type: r.initiatorType,
      reqStart: r.requestStart,
      end: r.responseEnd,
      enc: r.encodedBodySize,
    }));
    const visibleImgs = [...document.images]
      .filter((i) => {
        const r = i.getBoundingClientRect();
        const s = getComputedStyle(i);
        return (
          r.width > 0 &&
          r.height > 0 &&
          s.visibility !== "hidden" &&
          s.display !== "none" &&
          r.bottom > 0 &&
          r.top < innerHeight &&
          r.right > 0 &&
          r.left < innerWidth
        );
      })
      .map((i) => i.currentSrc || i.src);
    return {
      fcp: p.fcp || p.firstFrame,
      lcp: p.lcp || p.firstFrame,
      shownAt: p.shownAt,
      imgs: p.imgs,
      res,
      visibleImgs,
    };
  });
  await page.close();
  const fontsAt = Math.max(0, ...data.res.filter((r) => /\.woff2/.test(r.name)).map((r) => r.end));
  const bytes = { js: 0, css: 0, img: 0, font: 0, other: 0 };
  for (const r of data.res) {
    const path = r.name.split("?")[0];
    const k = /\.js$/.test(path)
      ? "js"
      : /\.css$/.test(path)
        ? "css"
        : /\.(png|webp|jpg|jpeg|svg|gif|avif)$/.test(path)
          ? "img"
          : /\.woff2?$/.test(path)
            ? "font"
            : "other";
    bytes[k] += r.enc || 0;
  }
  // Görsel gecikmesi: ekran gösterildikten (data-ready) sonra çözülen görünür görseller.
  const rows = [];
  const byUrl = new Map(data.imgs.map((i) => [i.src, i]));
  for (const src of new Set(data.visibleImgs)) {
    const rec = byUrl.get(src);
    const path = src.replace(base, "");
    const rr = data.res.find((r) => r.name.split("?")[0] === path);
    const doneAt = rec?.decode || rec?.load || 0;
    rows.push({
      src: path,
      added: rec ? rec.added - data.shownAt : null,
      reqStart: rr ? rr.reqStart - data.shownAt : null,
      loaded: rec ? rec.load - data.shownAt : null,
      decoded: doneAt - data.shownAt,
      kb: rr ? rr.enc / 1024 : 0,
    });
  }
  rows.sort((a, b) => b.decoded - a.decoded);
  return {
    fcp: data.fcp,
    lcp: data.lcp,
    shownAt: data.shownAt,
    fontsAt,
    visibleImgs: rows.length,
    late: rows.filter((r) => r.decoded > 300),
    worst: rows.slice(0, 3),
    bytes,
    scriptMs: (m0.ScriptDuration ?? 0) * 1000,
    reqCount: data.res.length,
  };
}

/**
 * Sıradaki oyun görselleri: sayfa açıldıktan 5 sn sonra (önden yükleme için süre tanınır) bu görseller
 * bir <img>e verilir; hepsinin çözülmesi kaç ms sürdü. Kontrol listesi önden yüklenmeyen bir oyunun görselleri.
 */
async function probeImages(ctx, scene, base) {
  const { page } = await openPage(ctx, scene);
  await page.goto(`${base}/?${scene.q}`, { waitUntil: "load" });
  await page.waitForSelector("html[data-ready]", { state: "attached", timeout: 60000 });
  await sleep(5000);
  const run = (urls) =>
    page.evaluate(async (list) => {
      const t0 = performance.now();
      await Promise.all(
        list.map(async (u) => {
          const i = new Image();
          i.decoding = "async";
          i.src = u;
          await i.decode().catch(() => undefined);
        }),
      );
      return performance.now() - t0;
    }, urls);
  const next = await run(scene.probeNext);
  const control = await run(scene.probeControl);
  await page.close();
  return { next, control };
}

/** Kararlı durum: kareler + uzun görevler + (isteğe bağlı) iz. */
async function steadyOnce(ctx, scene, base, { trace }) {
  const { page, cdp } = await openPage(ctx, scene);
  await page.goto(`${base}/?${scene.q}`, { waitUntil: "load" });
  await page.waitForSelector("html[data-ready]", { state: "attached", timeout: 60000 });
  await Promise.race([page.waitForLoadState("networkidle").catch(() => {}), sleep(5000)]);
  await sleep(1500);
  const stop = { done: false };
  const before = metricMap(await cdp.send("Performance.getMetrics"));
  if (trace)
    await cdp.send("Tracing.start", {
      traceConfig: {
        recordMode: "recordAsMuchAsPossible",
        includedCategories: [
          "devtools.timeline",
          "disabled-by-default-devtools.timeline",
          "cc",
          "gpu",
          "viz",
        ],
      },
      transferMode: "ReturnAsStream",
    });
  await page.evaluate(() => {
    const p = window.__perf;
    p.frames = [];
    p.long = [];
    p.rec = true;
  });
  const driver = scene.drive?.(page, stop);
  await sleep(MEASURE_MS);
  stop.done = true;
  await driver;
  const res = await page.evaluate(() => {
    window.__perf.rec = false;
    return { frames: window.__perf.frames, long: window.__perf.long };
  });
  let tr = null;
  if (trace) {
    const done = new Promise((ok) => cdp.once("Tracing.tracingComplete", ok));
    await cdp.send("Tracing.end");
    const ev = await done;
    let text = "";
    if (ev.stream) {
      for (;;) {
        const chunk = await cdp.send("IO.read", { handle: ev.stream });
        text += chunk.data;
        if (chunk.eof) break;
      }
      await cdp.send("IO.close", { handle: ev.stream });
    }
    try {
      const j = JSON.parse(text);
      tr = sumTrace(Array.isArray(j) ? j : (j.traceEvents ?? []));
    } catch {
      tr = null;
    }
  }
  const after = metricMap(await cdp.send("Performance.getMetrics"));
  await page.close();
  const fr = res.frames;
  const dts = fr.slice(1).map((t, i) => t - fr[i]);
  const span = fr.length > 1 ? fr[fr.length - 1] - fr[0] : 1;
  const d = (k) => (after[k] ?? 0) - (before[k] ?? 0);
  const secs = MEASURE_MS / 1000;
  return {
    fps: (dts.length / span) * 1000,
    p95: pct(dts, 0.95),
    p99: pct(dts, 0.99),
    over33: dts.length ? (dts.filter((x) => x > 33.4).length / dts.length) * 100 : 0,
    long: res.long.filter((x) => x > 50).length,
    longMs: res.long.filter((x) => x > 50).reduce((a, b) => a + b, 0),
    layoutPerS: d("LayoutCount") / secs,
    stylePerS: d("RecalcStyleCount") / secs,
    scriptPct: (d("ScriptDuration") / secs) * 100,
    taskPct: (d("TaskDuration") / secs) * 100,
    trace: tr && Object.fromEntries(Object.entries(tr).map(([k, v]) => [k, v / secs])),
  };
}

async function main() {
  if (!ARGS.includes("--yapma")) {
    const r = spawnSync("npx", ["vite", "build", "-c", "vite.perf.config.ts", "--logLevel", "warn"], {
      cwd: CLIENT,
      stdio: "inherit",
    });
    if (r.status !== 0) throw new Error("perf yapısı üretilemedi");
  }
  const server = await serveDist();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const rows = [];
  try {
    for (const scene of SCENES) {
      const mk = () =>
        browser.newContext({
          viewport: { width: scene.env.w, height: scene.env.h },
          deviceScaleFactor: scene.env.dpr,
          isMobile: scene.env.mobile,
          hasTouch: scene.env.mobile,
        });
      // Soğuk: yeni (boş önbellekli) bağlam. Ilık: aynı bağlamda ikinci açılış.
      const ctx = await mk();
      const cold = await loadOnce(ctx, scene, base);
      const warm = await loadOnce(ctx, scene, base);
      let probe = null;
      if (scene.probeNext) {
        const pctx = await mk();
        probe = await probeImages(pctx, scene, base);
        await pctx.close();
      }
      const steady = await steadyOnce(ctx, scene, base, { trace: false });
      const traced = QUICK ? null : await steadyOnce(ctx, scene, base, { trace: true });
      await ctx.close();
      rows.push({ scene: { name: scene.name, q: scene.q }, cold, warm, steady, traced, probe });
      console.log(
        `${scene.name.padEnd(18)} soğuk hazır ${f(cold.shownAt, 0)} ms · FCP ${f(cold.fcp, 0)} · geç görsel ${cold.late.length}/${cold.visibleImgs} · ${f(steady.fps)} fps · p95 ${f(steady.p95)} · >33ms %${f(steady.over33)} · uzun ${steady.long}`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
  const md = render(rows);
  if (OUT) {
    mkdirSync(dirname(resolve(ROOT, OUT)), { recursive: true });
    writeFileSync(resolve(ROOT, OUT), md);
    console.log(`yazıldı: ${OUT}`);
  } else console.log(`\n${md}`);
}

function render(rows) {
  const out = [];
  out.push("# Başarım ölçümü");
  out.push("");
  out.push(
    `Üretim yapısı (küçültülmüş, gzip, immutable başlıklar), başsız Chromium + swiftshader. Telefon: 390x844 @3x, CPU ${RATE}x, 10 Mbps / 40 ms. TV: 1920x1080 kısıtsız. Ölçüm penceresi ${MEASURE_MS / 1000} sn. Hücrelerde "a | b" = soğuk | ılık.`,
  );
  out.push("");
  out.push("## Yükleme ve görseller");
  out.push("");
  out.push(
    "| ekran | ekran hazır (ms) | FCP (ms) | LCP (ms) | görünür görsel | >300 ms geç görsel | en geç çözülen (ms, hazırdan sonra) | JS+CSS aktarım (KB) | betik (ms) | yazı tipleri indi (ms) |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const { scene, cold, warm } of rows) {
    const pair = (a, b, d = 0) => `${f(a, d)} \\| ${f(b, d)}`;
    out.push(
      `| ${scene.name} | ${pair(cold.shownAt, warm.shownAt)} | ${pair(cold.fcp, warm.fcp)} | ${pair(cold.lcp, warm.lcp)} | ${cold.visibleImgs} | ${cold.late.length} \\| ${warm.late.length} | ${pair(cold.worst[0]?.decoded ?? 0, warm.worst[0]?.decoded ?? 0)} | ${f((cold.bytes.js + cold.bytes.css) / 1024, 0)} | ${f(cold.scriptMs, 0)} | ${f(cold.fontsAt, 0)} |`,
    );
  }
  out.push("");
  out.push(
    "## Sıradaki oyunun görselleri (anlatım 3 kare + dünya arka planı; sonuç ekranında 5 sn sonra istenir)",
  );
  out.push("");
  out.push("| ekran | sıradaki oyun (ms) | önden inmeyen kontrol oyunu (ms) |");
  out.push("|---|---|---|");
  for (const { scene, probe } of rows)
    if (probe) out.push(`| ${scene.name} | ${f(probe.next, 0)} | ${f(probe.control, 0)} |`);
  out.push("");
  out.push("## Kararlı durum");
  out.push("");
  out.push(
    "| ekran | ort. FPS | p95 kare (ms) | p99 kare (ms) | >33 ms kare % | uzun görev >50 ms | layout/sn | stil hesabı/sn | ana iş p. meşgul % | betik % | paint ms/sn | raster ms/sn | composite ms/sn | resim çözme ms/sn |",
  );
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const { scene, steady: s, traced } of rows) {
    const t = traced?.trace;
    out.push(
      `| ${scene.name} | ${f(s.fps)} | ${f(s.p95)} | ${f(s.p99)} | ${f(s.over33)} | ${s.long} (${f(s.longMs, 0)} ms) | ${f(s.layoutPerS)} | ${f(s.stylePerS)} | ${f(s.taskPct, 0)} | ${f(s.scriptPct, 0)} | ${t ? f(t.paint + t.prepaint, 1) : "-"} | ${t ? f(t.raster, 1) : "-"} | ${t ? f(t.composite + t.commit + t.layerize, 1) : "-"} | ${t ? f(t.imgdecode, 1) : "-"} |`,
    );
  }
  out.push("");
  out.push("## Geç gelen görseller (soğuk açılış; ekran hazır olduktan >300 ms sonra çözülenler)");
  out.push("");
  let any = false;
  for (const { scene, cold } of rows) {
    if (!cold.late.length) continue;
    any = true;
    out.push(`- **${scene.name}**`);
    for (const l of cold.late.slice(0, 6))
      out.push(
        `  - \`${l.src}\` ${f(l.kb, 0)} KB: DOM'a girdi ${f(l.added, 0)} ms, istek ${f(l.reqStart, 0)} ms, yüklendi ${f(l.loaded, 0)} ms, çözüldü ${f(l.decoded, 0)} ms`,
      );
  }
  if (!any) out.push("Yok.");
  out.push("");
  return out.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
