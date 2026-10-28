// PWA denetimi: DERLENMİŞ istemci gerçek sunucuyla sunulur (e2e gibi). Doğrulananlar: manifest geçerli ve bağlı,
// simgeler yüklenir, hizmet çalışanı kaydolur ve sayfayı denetler, çevrimdışı yenilemede ana sayfa "internet yok"
// durumuyla açılır, /ws ve /health önbellekten sunulmaz, yeni sürüm bildirimi ve yenileme akışı çalışır.
// Önce `pnpm build`. Kullanım: `pnpm pwa:check`.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "apps/client/dist");
const SHOTS = join(ROOT, "docs/qa/pwa");
const T0 = Date.now();
const log = (...a) => console.log(`[pwa +${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
}
const OPT = { timeout: 15_000 };

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

async function startServer(port, clientDir) {
  const env = {
    ...ENV,
    PORT: String(port),
    HOST: "127.0.0.1",
    CLIENT_DIR: clientDir,
    DRAIN_TIMEOUT_MS: "2000",
  };
  delete env.NODE_ENV;
  const child = spawn("node", ["apps/server/dist/index.js"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (out += d));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`sunucu kapandı:\n${out}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return child;
    } catch {
      // henüz açılmadı
    }
    await sleep(100);
  }
  child.kill();
  throw new Error(`sunucu açılmadı:\n${out}`);
}

const controlled = (page) => page.evaluate(() => navigator.serviceWorker.controller !== null);

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  assert(existsSync(join(DIST, "sw.js")), "istemci derlenmemiş ya da sw.js yok: önce `pnpm build`");
  // Güncelleme denemesi sw.js'i değiştirir; derlenmiş klasöre dokunmamak için kopya üzerinde çalışılır.
  const dir = mkdtempSync(join(tmpdir(), "glix-pwa-"));
  cpSync(DIST, dir, { recursive: true });
  const port = await freePort();
  const server = await startServer(port, dir);
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
  const errors = [];
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      // Çevrimdışı denemelerde WebSocket/ağ hataları beklenir; yalnız beklenmeyenler sayılır.
      if (m.type() === "error" && !/WebSocket|net::ERR|Failed to load resource/.test(m.text()))
        errors.push(`console: ${m.text()}`);
    });

    // 1) Manifest ve başlık etiketleri
    await page.goto(base, { waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    const head = await page.evaluate(() => {
      const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? null;
      return {
        manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? null,
        touch: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ?? null,
        theme: meta("theme-color"),
        capable: meta("apple-mobile-web-app-capable"),
        status: meta("apple-mobile-web-app-status-bar-style"),
      };
    });
    assert(head.manifest === "/manifest.webmanifest", `manifest bağlantısı yok: ${head.manifest}`);
    assert(head.touch === "/icons/apple-touch-icon.png", "apple-touch-icon yok");
    const share = await fetch(`${base}/assets/brand/paylasim.jpg`);
    assert(
      share.ok && share.headers.get("content-type") === "image/jpeg",
      "paylaşım kartı sunucudan image/jpeg olarak gelmiyor",
    );
    assert(
      (await page.locator('meta[property="og:image"]').getAttribute("content")) ===
        "https://glix.dgmcraft.online/assets/brand/paylasim.jpg",
      "og:image",
    );
    assert((await page.locator('link[rel="apple-touch-startup-image"]').count()) === 9, "açılış görselleri");
    assert(
      (await page.locator('link[rel="icon"]').getAttribute("href")) === "/icons/favicon-64.png",
      "favicon bağlantısı",
    );
    assert(head.theme === "#05081a", `theme-color: ${head.theme}`);
    assert(head.capable === "yes" && head.status === "black-translucent", "iOS meta etiketleri eksik");
    const mres = await fetch(`${base}${head.manifest}`);
    assert(mres.ok && /manifest\+json/.test(mres.headers.get("content-type") ?? ""), "manifest türü yanlış");
    const m = await mres.json();
    assert(m.name === "GLIX" && m.short_name === "GLIX", "manifest adı");
    assert(m.display === "standalone" && m.display_override?.[0] === "fullscreen", "manifest display");
    assert(m.start_url === "/" && m.scope === "/" && m.id === "/", "manifest start_url/scope/id");
    assert(
      m.orientation === "any" && m.lang === "tr" && m.categories?.includes("games"),
      "manifest alanları",
    );
    assert(m.theme_color === "#05081a" && m.background_color === "#05081a", "manifest renkleri");
    const purposes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
    for (const need of ["192x192:any", "512x512:any", "512x512:maskable"])
      assert(purposes.includes(need), `simge eksik: ${need}`);
    assert(
      m.screenshots.some((s) => s.form_factor === "narrow") &&
        m.screenshots.some((s) => s.form_factor === "wide"),
      "ekran görüntüleri",
    );
    log("manifest geçerli");

    // 2) Simgeler ve ekran görüntüleri gerçekten yüklenir, boyutları bildirilenle uyuşur
    for (const item of [
      ...m.icons,
      ...m.screenshots,
      { src: head.touch, sizes: "180x180", type: "image/png" },
    ]) {
      const r = await fetch(new URL(item.src, base));
      assert(r.ok && (r.headers.get("content-type") ?? "").startsWith(item.type), `yüklenmedi: ${item.src}`);
      if (item.type !== "image/png") continue;
      const dims = await page.evaluate(
        (u) =>
          new Promise((ok, no) => {
            const img = new Image();
            img.onload = () => ok(`${img.naturalWidth}x${img.naturalHeight}`);
            img.onerror = () => no(new Error("görsel çözülemedi"));
            img.src = u;
          }),
        item.src,
      );
      assert(dims === item.sizes, `${item.src} boyutu ${dims}, bildirilen ${item.sizes}`);
    }
    log("simgeler ve ekran görüntüleri yükleniyor");

    // 3) Sunucu başlıkları
    const sw = await fetch(`${base}/sw.js`);
    assert(sw.ok && sw.headers.get("cache-control") === "no-cache", "sw.js Cache-Control: no-cache olmalı");
    assert(
      /worker-src 'self'/.test(sw.headers.get("content-security-policy") ?? ""),
      "CSP worker-src 'self' yok",
    );

    // 4) Hizmet çalışanı kaydolur, yenilemeden sonra sayfayı denetler
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    assert(await controlled(page), "yenilemeden sonra sayfa hizmet çalışanı tarafından denetlenmiyor");
    log("hizmet çalışanı sayfayı denetliyor");

    // 5) /ws ve /health önbelleğe girmez
    const cached = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys())
        for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
      return urls;
    });
    assert(
      cached.some((u) => /\/index\.html(\?|$)/.test(u)),
      "kabuk (index.html) önbellekte değil",
    );
    assert(
      cached.some((u) => /\/assets\/index-.*\.js$/.test(u)),
      "giriş betiği önbellekte değil",
    );
    assert(
      cached.some((u) => /\/icons\/icon-192\.png(\?|$)/.test(u)),
      "simgeler önbellekte değil",
    );
    assert(!cached.some((u) => /\/(ws|health|api)(\/|$|\?)/.test(u)), "ağ uçları önbelleğe girmiş");
    for (const logo of ["logo-512.webp", "logo.webp"])
      assert(
        cached.some((u) => u.endsWith(`/assets/brand/${logo}`)),
        `ana sayfa logosu kabukta değil: ${logo}`,
      );
    assert(
      !cached.some((u) => /\/assets\/brand\/paylasim\.jpg|\/splash\//.test(u)),
      "paylaşım kartı/açılış görselleri kabuğa girmiş",
    );
    const health = await page.evaluate(async () => {
      const r = await fetch("/health", { cache: "no-store" });
      return { ok: r.ok, body: await r.text(), cached: (await caches.match("/health")) !== undefined };
    });
    assert(health.ok && health.body.includes("ok") && !health.cached, "/health önbellekten sunuluyor");
    log("/ws, /health ve /api önbellekte yok", `(önbellek: ${cached.length} kayıt)`);

    // 6) Çevrimdışı: yenileme sonrası ana sayfa "internet yok" durumuyla açılır
    await ctx.setOffline(true);
    await page.reload({ waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    const note = page.locator(".offline");
    await note.waitFor(OPT);
    assert(
      await page.locator(".wordmark img").evaluate((i) => i.complete && i.naturalWidth > 0),
      "çevrimdışı ana sayfada logo yüklenmedi",
    );
    assert(
      (await note.innerText()).includes("İnternet bağlantısı yok — bağlanınca oyuna katılabilirsin"),
      "çevrimdışı metni",
    );
    // Misafir ana sayfası: oda kurmak hesap ister; katılma düğmesi "Kodla katıl"
    assert(
      await page.getByRole("button", { name: /odaya katıl|kodla katıl/i }).isDisabled(),
      "KODLA KATIL devre dışı olmalı",
    );
    assert(
      (await page.locator(".overlay").count()) === 0,
      "çevrimdışıyken yeniden bağlanma örtüsü görünmemeli",
    );
    const offHealth = await page.evaluate(() =>
      fetch("/health").then(
        () => "ok",
        () => "hata",
      ),
    );
    assert(offHealth === "hata", "çevrimdışıyken /health yanıt veriyor (önbellekten sunulmuş olabilir)");
    await sleep(500);
    await page.screenshot({ path: join(SHOTS, "offline-home.png") });
    log("çevrimdışı ana sayfa tamam");

    // SPA yolu da kabuğa düşer
    await page.goto(`${base}/baska/yol`, { waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    log("çevrimdışı SPA yolu kabuğa düştü");

    // 7) Bağlantı gelince durum kalkar ve düğmeler açılır
    await ctx.setOffline(false);
    await page.locator(".offline").waitFor({ state: "detached", timeout: 20_000 });
    await page.getByRole("button", { name: /odaya katıl|kodla katıl/i }).waitFor(OPT);
    assert(
      await page.getByRole("button", { name: /odaya katıl|kodla katıl/i }).isEnabled(),
      "bağlantı gelince KODLA KATIL açılmalı",
    );
    log("bağlantı dönünce ana sayfa etkin");

    // 8) Güncelleme akışı: yeni sw.js yayınlanınca ana sayfada (güvenli an) sormadan uygulanır, sayfa
    // yenilenir ve bir kez "Yeni sürüm yüklendi" bildirimi çıkar.
    await page.goto(base, { waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    assert((await page.locator(".toast").count()) === 0, "güncelleme yokken bildirim görünüyor");
    appendFileSync(join(dir, "sw.js"), `\n// yeni sürüm ${Date.now()}\n`);
    await Promise.all([
      page.waitForEvent("load", OPT),
      page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }),
    ]);
    await page.locator(".wordmark").waitFor(OPT);
    await page.getByText("Yeni sürüm yüklendi").waitFor(OPT);
    await page.screenshot({ path: join(SHOTS, "update-toast.png") });
    assert(await controlled(page), "yenileme sonrası denetim yok");
    await page.getByText("Yeni sürüm yüklendi").waitFor({ state: "hidden", timeout: 10_000 });
    await page.reload({ waitUntil: "load" });
    await page.locator(".wordmark").waitFor(OPT);
    await sleep(500);
    assert((await page.getByText("Yeni sürüm yüklendi").count()) === 0, "bildirim yalnız bir kez çıkmalı");
    log("güvenli anda sessiz güncelleme, tek seferlik bildirim çalışıyor");

    // 9) İçerik paketi: Ayarlar > "Tüm içeriği indir"; çevrimdışı görseller; ikinci çalıştırma 0; tek özet 1.
    const manifest = await (await fetch(`${base}/asset-manifest.json`)).json();
    assert(manifest.files.length > 200, `bildirim dosya sayısı: ${manifest.files.length}`);
    for (const f of manifest.files) {
      const bytes = readFileSync(join(DIST, f.path));
      assert(bytes.length === f.size, `bildirim boyutu yanlış: ${f.path}`);
      assert(
        createHash("sha256").update(bytes).digest("hex").slice(0, 16) === f.hash,
        `özet yanlış: ${f.path}`,
      );
    }
    assert(
      !manifest.files.some((f) => f.path === "/assets/mascot/yukleniyor.webp"),
      "kabuktaki maskot bildirimde olmamalı",
    );
    const precached = await page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys())
        if (name.startsWith("workbox-precache"))
          for (const r of await (await caches.open(name)).keys()) urls.push(r.url);
      return urls;
    });
    assert(
      precached.some((u) => /\/assets\/mascot\/yukleniyor\.webp/.test(u)),
      "'Hazırlanıyor' maskotu kabukta (precache) değil",
    );
    const openSettings = async () => {
      await page.goto(base, { waitUntil: "load" });
      await page.getByRole("button", { name: "Ayarlar" }).click();
      // Ayarlar başlıklara bölünmüş: içerik indirme "Cihaz" altında
      await page.getByRole("button", { name: /^Cihaz/ }).click();
      await page.getByRole("button", { name: "Tüm içeriği indir" }).waitFor(OPT);
    };
    const runPack = async () => {
      await page.getByRole("button", { name: "Tüm içeriği indir" }).click();
      const el = page.locator("[data-pack-result]");
      await el.waitFor({ timeout: 60_000 });
      return Number(await el.getAttribute("data-pack-result"));
    };
    const artKeys = () =>
      page.evaluate(async () =>
        (await (await caches.open("glix-art")).keys()).map((r) => new URL(r.url).pathname),
      );
    await openSettings();
    const first = await runPack();
    assert(first === manifest.files.length, `ilk indirme ${first} dosya, beklenen ${manifest.files.length}`);
    const keys = await artKeys();
    for (const f of manifest.files) assert(keys.includes(f.path), `önbellekte yok: ${f.path}`);
    await page.screenshot({ path: join(SHOTS, "ayarlar-indirildi.png") });
    log(`içerik paketi indi: ${first} dosya`);

    // Çevrimdışı: bir anlatım paneli, bir kart ve bir dünya görseli önbellekten gelir.
    const pick = (prefix) => manifest.files.find((f) => f.path.startsWith(prefix)).path;
    const samples = [pick("/assets/briefing/"), pick("/assets/cards/"), pick("/assets/worlds/")];
    await ctx.setOffline(true);
    for (const src of samples) {
      const dims = await page
        .evaluate(
          (u) =>
            new Promise((ok, no) => {
              const img = new Image();
              img.onload = () => ok(img.naturalWidth);
              img.onerror = () => no(new Error("yüklenemedi"));
              img.src = u;
            }),
          src,
        )
        .catch(() => 0);
      assert(dims > 0, `çevrimdışıyken önbellekten gelmedi: ${src}`);
      const hit = await page.evaluate(
        async (u) => (await (await caches.open("glix-art")).match(u)) !== undefined,
        src,
      );
      assert(hit, `çalışma anı adresi önbellek kaydını bulamıyor: ${src}`);
    }
    await ctx.setOffline(false);
    log("çevrimdışı: anlatım paneli, kart ve dünya görseli önbellekten geliyor");

    await openSettings();
    const second = await runPack();
    assert(second === 0, `ikinci çalıştırma ${second} dosya indirdi, beklenen 0`);
    log("ikinci çalıştırma 0 dosya");

    const target = manifest.files[5];
    manifest.files[5] = { ...target, hash: "degisti0000000000" };
    writeFileSync(join(dir, "asset-manifest.json"), JSON.stringify(manifest));
    await openSettings();
    const third = await runPack();
    assert(third === 1, `tek özet değişince ${third} dosya indi, beklenen 1`);
    assert((await artKeys()).includes(target.path), "değişen dosya önbellekte yok");
    // Bildirimden bir dosya düşünce eski kayıt silinir.
    manifest.files.pop();
    writeFileSync(join(dir, "asset-manifest.json"), JSON.stringify(manifest));
    await openSettings();
    assert((await runPack()) === 0, "yalnız silme indirme yapmamalı");
    assert(
      (await artKeys()).filter((k) => !k.startsWith("/__pack/")).length === manifest.files.length,
      "eski kayıt silinmedi",
    );
    log("tek özet değişince 1 dosya indi; listeden düşen silindi");

    // 10) Ana ekrandan ilk açılış: "Hazırlanıyor" ekranı indirir ve ana sayfaya geçer; misafir beklemez.
    for (const guest of [false, true]) {
      const c2 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      await c2.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
      const p2 = await c2.newPage();
      await p2.goto(guest ? `${base}/?oda=KX7QP` : base, { waitUntil: "load" });
      if (guest) {
        await p2.waitForTimeout(1500);
        assert((await p2.locator(".pack").count()) === 0, "misafir için 'Hazırlanıyor' ekranı çıkmamalı");
        await p2.locator(".join, .wordmark, input").first().waitFor(OPT);
      } else {
        await p2.locator(".pack").waitFor(OPT);
        await p2.screenshot({ path: join(SHOTS, "hazirlaniyor.png") });
        await p2.locator(".pack").waitFor({ state: "detached", timeout: 60_000 });
        await p2.locator(".wordmark").waitFor(OPT);
        const n = await p2.evaluate(async () => (await (await caches.open("glix-art")).keys()).length);
        assert(n >= manifest.files.length, `ilk açılış sonrası önbellek eksik: ${n}`);
        log("ana ekran ilk açılışı: Hazırlanıyor → indi → ana sayfa");
      }
      await c2.close();
    }

    // 11) Havuz kullanmayan (tarayıcı sekmesi) kullanıcı: özeti değişen yolun eski çalışma anı kaydı silinir,
    // yeniden istenince ağdan taze gelir. Bildirim hiçbir önbelleğe girmez ve her seferinde doğrulanır.
    {
      const c3 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const p3 = await c3.newPage();
      const cacheHas = (path) =>
        p3.evaluate(async (u) => (await (await caches.open("glix-art")).match(u)) !== undefined, path);
      const waitFor = async (fn, what) => {
        for (let i = 0; i < 100; i++) {
          if (await fn()) return;
          await sleep(100);
        }
        throw new Error(`BAŞARISIZ: zaman aşımı: ${what}`);
      };
      await p3.goto(base, { waitUntil: "load" });
      await p3.evaluate(() => navigator.serviceWorker.ready);
      await p3.reload({ waitUntil: "load" });
      await p3.locator(".wordmark").waitFor(OPT);
      await waitFor(() => cacheHas("/__pack/seen.json"), "son görülen bildirim yazılmadı");
      assert((await p3.locator(".pack").count()) === 0, "tarayıcı sekmesinde 'Hazırlanıyor' çıkmamalı");
      const victim = manifest.files[10];
      const onDisk = readFileSync(join(DIST, victim.path));
      await p3.evaluate(async (u) => {
        await (await caches.open("glix-art")).put(
          u,
          new Response("ESKI", { headers: { "content-type": "image/webp" } }),
        );
      }, victim.path);
      const mres2 = await fetch(`${base}/asset-manifest.json`);
      assert(mres2.headers.get("cache-control") === "no-cache", "asset-manifest.json no-cache olmalı");
      manifest.files[10] = { ...victim, hash: "yenilendi00000000" };
      writeFileSync(join(dir, "asset-manifest.json"), JSON.stringify(manifest));
      await p3.reload({ waitUntil: "load" });
      await p3.locator(".wordmark").waitFor(OPT);
      await waitFor(async () => !(await cacheHas(victim.path)), "eski kayıt silinmedi");
      const fresh = await p3.evaluate(async (u) => {
        const r = await fetch(u);
        return { ok: r.ok, len: (await r.arrayBuffer()).byteLength };
      }, victim.path);
      assert(fresh.ok && fresh.len === onDisk.length, "yeniden istek ağdan taze gelmedi");
      const seenNow = await p3.evaluate(
        async () =>
          (await (await (await caches.open("glix-art")).match("/__pack/seen.json"))?.json()) ?? null,
      );
      assert(seenNow?.[victim.path] === "yenilendi00000000", "son görülen bildirim güncellenmedi");
      const everywhere = await p3.evaluate(async () => {
        const urls = [];
        for (const name of await caches.keys())
          for (const r of await (await caches.open(name)).keys()) urls.push(r.url);
        return urls;
      });
      assert(!everywhere.some((u) => /asset-manifest\.json/.test(u)), "bildirim bir önbelleğe girmiş");
      await c3.close();
      log("havuzsuz kullanıcı: değişen yolun eski kaydı silindi, yeniden istek ağdan taze geldi");
    }

    assert(errors.length === 0, `beklenmeyen hatalar:\n${errors.join("\n")}`);
    log("TAMAM");
  } finally {
    await browser.close();
    server.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
