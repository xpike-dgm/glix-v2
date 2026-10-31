// Önizleme sayfası testi (UM-U4, MG-6): gerçek oyun sunucusu `onizleme.html`'i sunar; sahte bir "Üretim Merkezi"
// üst sayfası onu iframe'e gömüp sözleşmedeki protokolle konuşur (docs/uretim/SOZLESME.md bölüm 4).
// Önce `pnpm build`. Kullanım: `node scripts/onizleme-check.mjs [görüntü-klasörü]`.
//
// Denetimler:
// - sunucu başlıkları: CSP `frame-ancestors` izinli kaynaklar, `X-Frame-Options` yok, önbellek yok, `connect-src` data:;
// - hizmet çalışanı önizleme sayfasını ve parçalarını ön önbelleğe almaz;
// - sayfa hazır olunca `{ tur: "hazir", surum: 1 }`;
// - her ekran taslak satır ve `data:` dosyasıyla çizilir ve `{ tur: "cizildi", boyut }` döner; taslak çerçeve
//   görseli gerçekten taslak dosyadan gelir (ağdan istenmez);
// - geçersiz ileti `{ tur: "hata", neden }` alır; izinsiz kaynaktan gömme tarayıcıca engellenir;
// - doğrudan açılan sayfa çalışmaz ("yalnız Üretim Merkezi içinde").
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { createServer as createHttp } from "node:http";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_DIR = join(ROOT, "apps/client/dist");
const SHOTS = resolve(process.argv[2] ?? join(ROOT, "docs/qa/onizleme"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[onizleme]", ...a);
function assert(cond, msg) {
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
}

/** 40000–49999 arasında boş port. */
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
  throw new Error("boş port yok");
}

function chromiumPath() {
  const env = process.env;
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;
  const base = env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort()
    .pop();
  const p = dir && join(base, dir, "chrome-linux/chrome");
  return p && existsSync(p) ? p : undefined;
}

/** Sahte Üretim Merkezi sayfası: iframe + ileti günlüğü (`window.gelen`). */
function parentPage(frameSrc) {
  return `<!doctype html><meta charset="utf-8"><title>sahte üretim</title>
<body style="margin:0;background:#111">
<iframe id="f" src="${frameSrc}" style="width:390px;height:844px;border:0"></iframe>
<script>
window.gelen = [];
window.addEventListener("message", (e) => {
  if (e.source === document.getElementById("f").contentWindow) window.gelen.push({ origin: e.origin, data: e.data });
});
window.gonder = (m) => document.getElementById("f").contentWindow.postMessage(m, "*");
</script></body>`;
}

const webp1x1 = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

const draftFrame = {
  id: "cerceve-taslak-neon",
  type: "cerceve",
  rarity: "nadir",
  price: 450,
  name: "Taslak Neon",
  description: "Önizleme denemesi.",
  satista: true,
  koleksiyon: "Neon Gece",
  efekt: {
    motor: "donen-halka",
    parametreler: { doku: "cerceve/taslak-neon.webp", donusHizi: 9, katman: 2 },
  },
};
const draftName = {
  id: "ad-taslak",
  type: "ad-efekti",
  rarity: "siradan",
  price: 200,
  name: "Taslak Ad",
  description: "Önizleme denemesi.",
  satista: true,
  koleksiyon: "Neon Gece",
  efekt: {
    motor: "akan-renk",
    parametreler: { renkler: ["#2ef2ff", "#ff2bd6", "#2ef2ff"], akisHizi: 3 },
  },
};

async function main() {
  assert(existsSync(join(CLIENT_DIR, "onizleme.html")), "önce pnpm build (dist/onizleme.html yok)");
  const sw = readFileSync(join(CLIENT_DIR, "sw.js"), "utf8");
  assert(!/url:"[^"]*onizleme/.test(sw), "hizmet çalışanı önizleme dosyalarını ön önbelleğe almamalı");
  assert(sw.includes("/^\\/onizleme/"), "hizmet çalışanı önizleme gezintisini oyun kabuğuyla yanıtlamamalı");
  mkdirSync(SHOTS, { recursive: true });

  const gamePort = await freePort();
  const parentPort = await freePort();
  const game = spawn(process.execPath, [join(ROOT, "apps/server/dist/index.js")], {
    env: { ...process.env, PORT: String(gamePort), HOST: "127.0.0.1", CLIENT_DIR, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let gameLog = "";
  game.stdout.on("data", (d) => (gameLog += d));
  game.stderr.on("data", (d) => (gameLog += d));
  const GAME = `http://127.0.0.1:${gamePort}`;
  const parent = createHttp((req, res) => {
    const src = req.url?.startsWith("/dogrudan") ? "about:blank" : `${GAME}/onizleme.html`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(parentPage(src));
  });
  await new Promise((r) => parent.listen(parentPort, "0.0.0.0", r));
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${GAME}/health`)).ok) break;
      } catch {
        // açılıyor
      }
      await sleep(100);
    }
    // 1) Başlıklar
    const head = await fetch(`${GAME}/onizleme.html`);
    const csp = head.headers.get("content-security-policy") ?? "";
    assert(head.status === 200, "onizleme.html 200");
    assert(csp.includes("frame-ancestors https://uretim.dgmcraft.online"), `CSP frame-ancestors: ${csp}`);
    assert(csp.includes("http://localhost:*"), "geliştirmede yerel kaynak gömebilir");
    assert(/connect-src 'self' data: blob:/.test(csp), "taslak JSON için connect-src data:");
    assert(head.headers.get("x-frame-options") === null, "X-Frame-Options verilmemeli");
    assert(head.headers.get("cache-control") === "no-store", "önizleme önbelleğe alınmaz");
    const index = await fetch(`${GAME}/`);
    assert(index.headers.get("x-frame-options") === "DENY", "oyunun kendi sayfası gömülemez");
    log("başlıklar tamam");

    browser = await chromium.launch({
      executablePath: chromiumPath(),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
    const page = await ctx.newPage();
    const shopRequests = [];
    page.on("request", (r) => {
      if (r.url().includes("/assets/shop/cerceve/taslak-neon")) shopRequests.push(r.url());
    });
    await page.goto(`http://localhost:${parentPort}/`);
    await page.waitForFunction(() => window.gelen.some((m) => m.data?.tur === "hazir"), null, {
      timeout: 15000,
    });
    const hazir = await page.evaluate(() => window.gelen.find((m) => m.data?.tur === "hazir"));
    assert(hazir.data.surum === 1, "hazır iletisi sürüm 1");
    assert(hazir.origin === GAME, `ileti oyunun kaynağından: ${hazir.origin}`);
    log("hazır geldi");

    const frame = page.frames().find((f) => f.url().includes("/onizleme.html"));
    assert(frame, "iframe yüklendi");

    async function show(msg, name) {
      const before = await page.evaluate(() => window.gelen.length);
      await page.evaluate((m) => window.gonder(m), msg);
      await page.waitForFunction(
        (n) => window.gelen.length > n && ["cizildi", "hata"].includes(window.gelen.at(-1).data?.tur),
        before,
        { timeout: 20000 },
      );
      const last = await page.evaluate(() => window.gelen.at(-1).data);
      // Kürsü ve kutlama Pixi ile çizilir: görüntüden önce kısa bir pay.
      if (name === "kursu" || name === "zafer") await sleep(2500);
      if (name) await page.locator("#f").screenshot({ path: join(SHOTS, `${name}.png`) });
      return last;
    }

    const files = { "apps/client/public/assets/shop/cerceve/taslak-neon.webp": webp1x1 };
    const cases = [
      ["magaza-kart", draftFrame],
      ["avatar-lobi", draftFrame],
      ["skor-seridi", draftName],
      ["kursu", { ...readItem("dans-kazacok"), id: "dans-taslak", name: "Taslak Dans" }],
      ["zafer", { ...readItem("zafer-havai-fisek"), id: "zafer-taslak", name: "Taslak Zafer" }],
      ["giris", { ...readItem("giris-portal"), id: "giris-taslak", name: "Taslak Giriş" }],
      ["kart-arkasi", { ...readItem("kart-elektrik"), id: "kart-taslak", name: "Taslak Kart" }],
    ];
    for (const [ekran, row] of cases) {
      const r = await show({ tur: "goster", ekran, katalogSatiri: row, dosyalar: files }, ekran);
      assert(r.tur === "cizildi", `${ekran}: ${JSON.stringify(r)}`);
      assert(r.boyut.w > 0 && r.boyut.h > 0, `${ekran} boyutu`);
      log(`${ekran}: çizildi ${r.boyut.w}x${r.boyut.h}`);
      if (ekran === "magaza-kart" || ekran === "avatar-lobi") {
        const draftSrc = await frame.evaluate(() =>
          [...document.querySelectorAll("img")]
            .map((i) => i.getAttribute("src"))
            .find((s) => s?.startsWith("data:")),
        );
        assert(draftSrc !== undefined, `${ekran}: taslak görsel data: adresiyle çizildi`);
      }
    }
    // Taslak çerçeve görseli data: adresinden geldi, ağdan istenmedi.
    assert(shopRequests.length === 0, `taslak dosya ağdan istendi: ${shopRequests.join(", ")}`);

    // Koleksiyon: iki taslak aynı koleksiyonda -> mağazada şerit.
    const coll = await show(
      { tur: "goster", ekran: "koleksiyon", katalogSatiri: [draftFrame, draftName], dosyalar: files },
      "koleksiyon",
    );
    assert(coll.tur === "cizildi", `koleksiyon: ${JSON.stringify(coll)}`);
    assert(
      (await frame.locator(".shop-coll").count()) === 1 && (await frame.getByText("Neon Gece").count()) > 0,
      "koleksiyon şeridi görünür",
    );
    log("koleksiyon şeridi tamam");

    const oyun = await show(
      { tur: "goster", ekran: "oyun-ani", secenekler: { oyun: "kule", an: "oyun" } },
      "oyun-ani",
    );
    assert(oyun.tur === "cizildi" || oyun.tur === "hata", "oyun anı yanıtı");
    log(`oyun-ani: ${oyun.tur}${oyun.neden ? ` (${oyun.neden})` : ""}`);
    const ses = await show(
      { tur: "goster", ekran: "ses-ani", secenekler: { oyun: "kule-ustasi" } },
      "ses-ani",
    );
    assert(ses.tur === "hata" && /henüz yok/.test(ses.neden), `ses anı: ${JSON.stringify(ses)}`);

    // Hatalı iletiler
    const bad1 = await show({ tur: "goster", ekran: "yok" });
    assert(bad1.tur === "hata", "bilinmeyen ekran hata");
    const bad2 = await show({
      tur: "goster",
      ekran: "magaza-kart",
      katalogSatiri: { ...draftFrame, price: 5 },
    });
    assert(bad2.tur === "hata" && /price/.test(bad2.neden), `fiyat hatası: ${bad2.neden}`);
    const bad3 = await show({
      tur: "goster",
      ekran: "magaza-kart",
      katalogSatiri: draftFrame,
      dosyalar: { "/assets/shop/cerceve/x.webp": "https://kotu.example/x.webp" },
    });
    assert(bad3.tur === "hata", "dış adresli dosya reddedilir");
    const bad4 = await show({
      tur: "goster",
      ekran: "magaza-kart",
      katalogSatiri: draftFrame,
      dosyalar: { "/sw.js": webp1x1 },
    });
    assert(bad4.tur === "hata", "oyun dışı yol reddedilir");
    log("hatalı iletiler tamam");

    // İzinsiz kaynak: 127.0.0.2 üst sayfası gömemez (frame-ancestors yalnız localhost ve 127.0.0.1).
    const p2 = await ctx.newPage();
    const blocked = [];
    p2.on("console", (m) => blocked.push(m.text()));
    await p2.goto(`http://127.0.0.2:${parentPort}/`);
    await sleep(1500);
    const v6Ready = await p2.evaluate(() => window.gelen?.length ?? 0).catch(() => 0);
    assert(v6Ready === 0, "izinsiz kaynakta sayfa çalışmamalı");
    log("izinsiz kaynak engellendi");

    // Doğrudan açılış
    const p3 = await ctx.newPage();
    await p3.goto(`${GAME}/onizleme.html`);
    await p3.getByText("yalnız Üretim Merkezi içinde").waitFor({ timeout: 10000 });
    log("doğrudan açılış çalışmıyor (beklenen)");
    log(`TAMAM — görüntüler: ${SHOTS}`);
  } catch (err) {
    console.error(gameLog.slice(-2000));
    throw err;
  } finally {
    await browser?.close();
    parent.close();
    game.kill();
  }
}

/** Gerçek katalogdan bir satır (önizleme taslağını ona benzetmek için). */
function readItem(id) {
  const cat = JSON.parse(readFileSync(join(ROOT, "packages/engine/src/katalog/magaza.json"), "utf8"));
  const row = cat.urunler.find((u) => u.id === id);
  if (!row) throw new Error(id);
  return row;
}

await main();
