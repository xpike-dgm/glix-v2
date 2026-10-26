// Uçtan uca tarayıcı testi: gerçek sunucu + gerçek arayüz, 3 telefon bağlamı.
// Önce `pnpm build` çalıştırılmış olmalı. Kullanım: `pnpm e2e`.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ENV = process.env;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = join(ROOT, "docs/qa/a1-real");
const CLIENT_DIR = join(ROOT, "apps/client/dist");
const STATS_DB = join(mkdtempSync(join(tmpdir(), "glix-e2e-")), "glix.db");
const T0 = Date.now();

const log = (...a) => console.log(`[e2e +${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) {
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
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

function grepDist(dir, needle, hits = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) grepDist(p, needle, hits);
    else if (/\.(js|css|html|json|webmanifest)$/.test(name) && readFileSync(p, "utf8").includes(needle))
      hits.push(p);
  }
  return hits;
}

async function startServer(port) {
  const env = {
    ...ENV,
    PORT: String(port),
    HOST: "127.0.0.1",
    CLIENT_DIR,
    DRAIN_TIMEOUT_MS: "4000",
    STATS_DB,
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
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return { child, output: () => out, health: await r.text() };
    } catch {
      // henüz açılmadı
    }
    await sleep(100);
  }
  throw new Error(`sunucu açılmadı:\n${out}`);
}

const errors = [];
const pages = new Set();
// Sayfaların aldığı WebSocket karelerinden: tam room ve patch sayıları (senkron yaması şeffaf çalışmalı).
const frames = { room: 0, patch: 0 };
function watch(label, page) {
  pages.add(page);
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => {
      const text = typeof f.payload === "string" ? f.payload : "";
      if (text.startsWith('{"type":"patch"')) frames.patch += 1;
      else if (text.startsWith('{"type":"room"')) frames.room += 1;
    });
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${label}] console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    // Sayfa kapanırken iptal edilen istekler hata sayılmaz.
    if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? ""))
      errors.push(`[${label}] istek başarısız: ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`[${label}] HTTP ${r.status()}: ${r.url()}`);
  });
  page.on("close", () => pages.delete(page));
}

const btn = (page, re) => page.getByRole("button", { name: re });
const OPT = { timeout: 15_000 };

async function shot(page, name) {
  await sleep(450); // giriş animasyonları otursun
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function setNick(page, name) {
  const input = page.getByRole("textbox", { name: "Takma ad" });
  await input.waitFor(OPT);
  await input.fill(name);
  await btn(page, /^tamam$/i).click();
}

async function joinViaUi(page, code, nick) {
  await btn(page, /odaya katıl/i).click();
  const codeInput = page.getByRole("textbox", { name: "Oda kodu" });
  await codeInput.waitFor(OPT);
  await codeInput.pressSequentially(code.toLowerCase(), { delay: 30 });
  await btn(page, /^katıl$/i).click();
  if (nick) await setNick(page, nick);
}

async function lobbyCode(page) {
  const el = page.locator(".roomcode");
  await el.waitFor(OPT);
  const code = (await el.innerText()).trim();
  assert(/^[A-Z0-9]{5}$/.test(code), `oda kodu geçersiz: "${code}"`);
  return code;
}

async function seatsCount(page) {
  return page.locator("button.seat:not(.seat--empty)").count();
}

async function myScore(page) {
  return Number((await page.locator(".game__num").innerText()).trim());
}

// Birden çok sayfada aynı ana (duvar saati) basış; ritim penceresi 300 ms olduğundan ms hassasiyeti yeter.
async function pressAt(targets, at) {
  await Promise.all(
    targets.map((page) =>
      page.evaluate(
        (t) =>
          new Promise((resolveFn) => {
            const btnEl = document.querySelector(".arcade__hit");
            if (!btnEl) throw new Error("buton yok");
            const fire = () => {
              const o = { bubbles: true, pointerType: "touch", isPrimary: true, pointerId: 1 };
              btnEl.dispatchEvent(new PointerEvent("pointerdown", o));
              btnEl.dispatchEvent(new PointerEvent("pointerup", o));
              resolveFn();
            };
            const wait = t - Date.now();
            if (wait > 25)
              setTimeout(() => {
                const end = t;
                while (Date.now() < end) {
                  /* ince ayar */
                }
                fire();
              }, wait - 20);
            else fire();
          }),
        at,
      ),
    ),
  );
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  assert(existsSync(join(CLIENT_DIR, "index.html")), "istemci derlenmemiş: önce `pnpm build`");
  assert(existsSync(join(ROOT, "apps/server/dist/index.js")), "sunucu derlenmemiş: önce `pnpm build`");

  const mockHits = grepDist(CLIENT_DIR, "mock");
  assert(mockHits.length === 0, `üretim derlemesinde "mock" geçiyor: ${mockHits.join(", ")}`);
  log('dist içinde "mock" yok');

  const port = await freePort();
  let server = await startServer(port);
  const base = `http://127.0.0.1:${port}`;
  assert(server.health.includes("ok"), `/health beklenmeyen: ${server.health}`);
  log("sunucu hazır", base, server.health.trim());

  const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
  try {
    const mk = () =>
      browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: "tr-TR",
        timezoneId: "Europe/Istanbul",
        baseURL: base,
      });
    const ctxA = await mk();
    await ctxA.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    const ctxB = await mk();
    const ctxC = await mk();
    const A = await ctxA.newPage();
    const B = await ctxB.newPage();
    const C = await ctxC.newPage();
    watch("A", A);
    watch("B", B);
    watch("C", C);

    // 1) A: takma ad + oda kur
    await A.goto("/");
    await btn(A, /oda kur/i).waitFor(OPT);
    await shot(A, "01-home");
    await btn(A, /oda kur/i).click();
    await A.getByRole("textbox", { name: "Takma ad" }).waitFor(OPT);
    await shot(A, "02-nickname");
    await setNick(A, "Ayşe");
    const code = await lobbyCode(A);
    log("oda kodu", code);
    await shot(A, "03-lobby-solo");
    assert(await btn(A, /^başlat$/i).isDisabled(), "tek oyuncuyla BAŞLAT kapalı olmalı");

    // 2) B: ODAYA KATIL, kodu elle yazar
    await B.goto("/");
    await btn(B, /odaya katıl/i).click();
    await B.getByRole("textbox", { name: "Takma ad" }).waitFor(OPT);
    await setNick(B, "Burak");
    const codeInput = B.getByRole("textbox", { name: "Oda kodu" });
    await codeInput.waitFor(OPT);
    await shot(B, "b-join-empty");
    await codeInput.pressSequentially(code.toLowerCase(), { delay: 30 });
    await btn(B, /^katıl$/i).click();
    await B.locator(".roomcode").waitFor(OPT);
    assert((await lobbyCode(B)) === code, "B farklı odada");
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty)").length === 2,
      null,
      OPT,
    );
    await shot(A, "04-lobby-two");

    // 3) C: ?oda= bağlantısı
    await C.goto(`/?oda=${code}`);
    await C.getByRole("textbox", { name: "Oda kodu" }).waitFor(OPT);
    const filled = await C.locator(".code__box").allInnerTexts();
    assert(filled.join("") === code, `bağlantıdan kod dolmadı: ${filled.join("")}`);
    await btn(C, /^katıl$/i).click();
    await setNick(C, "Cem");
    await C.locator(".roomcode").waitFor(OPT);
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty)").length === 3,
      null,
      OPT,
    );
    await shot(A, "05-lobby-three");
    assert(!(await btn(C, /^başlat$/i).count()), "host olmayan BAŞLAT görmemeli");

    // Paylaş: bağlantı panoya kopyalanır (Web Share yoksa)
    await btn(A, /paylaş/i).click();
    await A.getByText("Bağlantı kopyalandı").waitFor(OPT);
    const clip = await A.evaluate(() => navigator.clipboard.readText());
    assert(clip === `${base}/?oda=${code}`, `panodaki bağlantı yanlış: ${clip}`);

    // QR sayfası: boş daireye dokununca da açılır; kod kopyalanır
    await btn(A, /qr göster/i).click();
    const inviteSheet = A.getByRole("dialog");
    await inviteSheet.getByRole("img", { name: /qr/i }).waitFor(OPT);
    await shot(A, "05-qr");
    await inviteSheet.getByRole("button", { name: /kapat/i }).first().click();
    await inviteSheet.waitFor({ state: "detached", ...OPT });
    await btn(A, /arkadaş davet et/i)
      .first()
      .click();
    await A.getByRole("dialog").getByRole("img", { name: /qr/i }).waitFor(OPT);
    await A.keyboard.press("Escape");
    await A.getByRole("dialog").waitFor({ state: "detached", ...OPT });
    await A.locator(".roomcode").first().click();
    await A.getByText("Kopyalandı").waitFor(OPT);
    assert((await A.evaluate(() => navigator.clipboard.readText())) === code, "kod kopyalanmadı");

    // Karakter seçimi: B kendi avatarına dokunup boş bir karakter alır; A'da görünür; alınmış olan soluk
    await btn(B, /karakterini değiştir/i).click();
    const picker = B.getByRole("dialog");
    await picker.waitFor(OPT);
    await shot(B, "05-picker");
    await picker.locator(".picker__opt:not(.picker__opt--taken):not(.picker__opt--on)").last().click();
    await picker.waitFor({ state: "detached", ...OPT });
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty) .av").length === 3,
      null,
      OPT,
    );
    assert((await B.evaluate(() => localStorage.getItem("glix.avatar"))) === "7", "karakter hatırlanmadı");

    // Minigame akordeonu: oda rastgele 5 ile açılır; host "Ben seçeyim"e geçip yalnız Butona Bas'ı bırakır,
    // son oyun kapatılamaz
    const head = A.locator(".games__head");
    assert(
      (await head.locator(".games__count").innerText()).trim() === "Rastgele · 5",
      "akordeon başlığı 'Rastgele · 5' göstermeli",
    );
    await btn(A, /minigame seçimi/i).click();
    await A.locator(".seg__opt", { hasText: "Rastgele" }).waitFor(OPT);
    await shot(A, "05a-lobby-random");
    assert(
      !(await C.locator(".seg__opt", { hasText: "Ben seçeyim" })
        .isEnabled()
        .catch(() => false)),
      "host olmayan seçim biçimini değiştirememeli",
    );
    await A.locator(".seg__opt", { hasText: "Ben seçeyim" }).click();
    const card = A.locator(".gcard", { hasText: "Butona Bas" });
    await card.waitFor(OPT);
    await shot(A, "05b-lobby-games");
    for (;;) {
      const others = A.locator('.gcard[aria-pressed="true"]').filter({ hasNotText: "Butona Bas" });
      if ((await others.count()) === 0) break;
      const before = await A.locator('.gcard[aria-pressed="true"]').count();
      await others.first().click();
      await A.waitForFunction(
        (n) => document.querySelectorAll('.gcard[aria-pressed="true"]').length === n - 1,
        before,
        OPT,
      );
    }
    assert((await card.getAttribute("aria-pressed")) === "true", "Butona Bas seçili kalmalı");
    await card.click();
    await A.getByText("En az bir oyun seçili olmalı").waitFor(OPT);
    assert((await card.getAttribute("aria-pressed")) === "true", "son oyun seçili kalmalı");
    assert(
      (await head.locator(".games__count").innerText()).trim() === "1 oyun",
      "el ile modda başlık '1 oyun' göstermeli",
    );
    await btn(A, /minigame seçimi/i).click();

    // Olmayan oda: nazik mesaj + ANA SAYFA
    const ctxD = await mk();
    const D = await ctxD.newPage();
    watch("D", D);
    await D.goto("/?oda=ZZZZZ");
    await D.getByRole("textbox", { name: "Oda kodu" }).waitFor(OPT);
    await btn(D, /^katıl$/i).click();
    await setNick(D, "Deniz");
    await btn(D, /ana sayfa/i).waitFor(OPT);
    await shot(D, "d-notfound");
    await btn(D, /ana sayfa/i).click();
    await btn(D, /oda kur/i).waitFor(OPT);
    await ctxD.close();

    // 4) Lobide yenileme: host (A) yeniler; 20 sn bekleme süresi içinde döndüğü için host kalır
    await A.reload();
    await A.locator(".roomcode").waitFor(OPT);
    assert((await lobbyCode(A)) === code, "yenilemeden sonra oda değişti");
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty)").length === 3,
      null,
      OPT,
    );
    assert(!(await btn(A, /oda kur/i).count()), "yenilemeden sonra ana sayfa görünmemeli");
    await btn(A, /^başlat$/i).waitFor(OPT);
    assert(!(await btn(B, /^başlat$/i).count()), "B host olmamalı");
    log("lobide host yenileme: oda ve host korunuyor");

    // 5) A, C'yi çıkarır
    await A.locator("button.seat:not(.seat--empty)", { hasText: "Cem" }).click();
    const kickSheet = A.getByRole("dialog");
    await kickSheet.waitFor(OPT);
    await shot(A, "06-kick-sheet");
    await kickSheet.getByRole("button", { name: /^çıkar$/i }).click();
    await btn(C, /oda kur/i).waitFor(OPT);
    await C.getByText("Odadan çıkarıldın").waitFor(OPT);
    await shot(C, "07-c-kicked");
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty)").length === 2,
      null,
      OPT,
    );
    // C yeniden katılır (takma ad hatırlanıyor)
    await joinViaUi(C, code, null);
    await C.locator(".roomcode").waitFor(OPT);
    await A.waitForFunction(
      () => document.querySelectorAll("button.seat:not(.seat--empty)").length === 3,
      null,
      OPT,
    );
    assert((await seatsCount(B)) === 3, "B üç oyuncu görmeli");
    log("çıkarma ve yeniden katılma tamam");

    // 6) Başlat → anlatım
    await btn(A, /^başlat$/i).click();
    for (const p of [A, B, C]) await btn(p, /hazırım/i).waitFor(OPT);
    await shot(A, "08-briefing");
    await btn(B, /hazırım/i).click();
    await btn(C, /hazırım/i).click();
    await sleep(1200);
    assert(await btn(A, /hazırım/i).isEnabled(), "A hâlâ anlatımda ve hazır değil olmalı");
    assert((await A.locator(".game__num").count()) === 0, "A oyuna geçmemeli");
    await shot(A, "09-briefing-others-ready");
    await btn(A, /hazırım/i).click();
    await A.locator(".count__num").waitFor(OPT);
    await shot(A, "10-countdown");
    await A.locator(".game__num").waitFor(OPT);
    for (const p of [B, C]) await p.locator(".game__num").waitFor(OPT);
    await shot(A, "11-playing");
    log("oyun başladı");

    // 7a) Gerçek dokunuş: C butona bir kez gerçekten dokunur (örtü/hedef sorunu varsa tap başarısız olur)
    await C.locator(".arcade__hit").tap();
    await C.waitForFunction(
      () => Number(document.querySelector(".game__num")?.textContent) === -1,
      null,
      OPT,
    );
    await sleep(700);

    // 7) Oyun: A+B birlikte, C tek başına
    const a0 = await myScore(A);
    const b0 = await myScore(B);
    const c0 = await myScore(C);
    for (let i = 0; i < 6; i++) {
      await pressAt([A, B], Date.now() + 250);
      await sleep(900); // bir sonraki turdan ayrı pencere
    }
    await shot(A, "12-playing-after-match");
    // C yalnız, diğerlerinden uzakta
    for (let i = 0; i < 3; i++) {
      await pressAt([C], Date.now() + 100);
      await sleep(1300);
    }
    await sleep(500);
    await A.waitForFunction((s) => Number(document.querySelector(".game__num")?.textContent) > s, a0, OPT);
    const a1 = await myScore(A);
    const b1 = await myScore(B);
    const c1 = await myScore(C);
    log("skorlar", { A: [a0, a1], B: [b0, b1], C: [c0, c1] });
    assert(a1 > a0, `A skoru artmalı (${a0} → ${a1})`);
    assert(b1 > b0, `B skoru artmalı (${b0} → ${b1})`);
    assert(c1 < c0, `C skoru düşmeli (${c0} → ${c1})`);
    await shot(C, "13-playing-c-solo");

    // 8) B'nin sayfası kapanır, aynı bağlamda yenisi açılır → oyuna otomatik döner
    await B.close();
    const B2 = await ctxB.newPage();
    watch("B2", B2);
    await B2.goto("/");
    await B2.locator(".game__num").waitFor(OPT);
    assert(!(await btn(B2, /oda kur/i).count()), "B ana sayfaya düşmemeli");
    const b2 = await myScore(B2);
    assert(b2 === b1, `B skoru korunmalı (${b1} → ${b2})`);
    await shot(B2, "b-resumed-playing");
    log("B oyuna geri döndü, skor", b2);

    // 9) Sonuç ekranı
    await A.locator(".podium").waitFor({ timeout: 70_000 });
    await sleep(2200); // ödül sayacı bitsin
    await shot(A, "14-results");
    const awards = (await A.locator(".podium__badge").allInnerTexts()).map((x) => x.trim()).filter(Boolean);
    log("ödül rozetleri", awards);
    assert(
      awards.length > 0 && awards.every((x) => /^\+[1-9]$/.test(x)),
      `ödül rozetleri beklenmedik: ${awards}`,
    );
    await B2.locator(".podium").waitFor(OPT);
    await C.locator(".podium").waitFor(OPT);

    // 10) Final
    await A.locator(".winner").waitFor({ timeout: 20_000 });
    await sleep(1500);
    await shot(A, "15-final");
    assert(await btn(A, /lobiye dön/i).isVisible(), "host LOBİYE DÖN görmeli");
    assert(!(await btn(C, /lobiye dön/i).count()), "C LOBİYE DÖN görmemeli");
    const finalScores = await A.locator(".row__score--big").allInnerTexts();
    log(
      "final skorları",
      finalScores.map((s) => s.trim()),
    );
    // Geri bildirim: A beş yıldız verir, "Teşekkürler!" görür; LOBİYE DÖN görünür kalır.
    await A.getByRole("button", { name: "5 yıldız" }).click();
    await btn(A, /gönder/i).click();
    await A.getByText("Teşekkürler!").waitFor(OPT);
    assert(await btn(A, /lobiye dön/i).isVisible(), "geri bildirimden sonra LOBİYE DÖN görünmeli");
    await shot(A, "15b-final-feedback");
    {
      // Sunucu geri bildirimi ve tamamlanan maçı kaydetmiş olmalı.
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(STATS_DB, { readOnly: true });
      const fb = db.prepare("SELECT rating FROM feedback").all();
      const done = db.prepare("SELECT completed FROM matches").all();
      db.close();
      assert(fb.length === 1 && fb[0].rating === 5, `geri bildirim kaydı: ${JSON.stringify(fb)}`);
      assert(done.length >= 1 && done[0].completed === 1, `maç kaydı: ${JSON.stringify(done)}`);
    }
    await btn(A, /lobiye dön/i).click();
    for (const p of [A, B2, C]) {
      await p.locator(".roomcode").waitFor(OPT);
      assert((await lobbyCode(p)) === code, "lobiye aynı odada dönülmeli");
      assert((await p.locator("button.seat:not(.seat--empty)").count()) === 3, "lobide üç oyuncu olmalı");
    }
    await shot(A, "16-lobby-after");
    // Skorlar sıfırlandı: sonraki maçın başında herkes 0
    await btn(A, /^başlat$/i).click();
    for (const p of [A, B2, C]) await btn(p, /hazırım/i).waitFor(OPT);
    for (const p of [A, B2, C]) await btn(p, /hazırım/i).click();
    await A.locator(".game__num").waitFor(OPT);
    for (const p of [A, B2, C]) assert((await myScore(p)) === 0, "yeni maçta skor 0 olmalı");
    log("lobiye dönüş ve sıfırlanmış skor tamam");

    // Senkron: oyun boyunca en az bir patch mesajı alınmış olmalı (ve arayüz zaten doğru çalıştı)
    log("WebSocket kareleri", frames);
    assert(frames.patch > 0, "hiç patch mesajı alınmadı");
    assert(frames.room > 0, "hiç tam room mesajı alınmadı");

    // 11) Sunucu güncellenir (SIGTERM): drain -> /health 503, maç sürer; süre dolunca 1012 ile kapanır,
    // istemci yeniden bağlanır, oda bellekte olmadığı için "Oyun güncellendi" der ve yeni oda kurulabilir.
    const exited = new Promise((r) => server.child.once("exit", r));
    server.child.kill("SIGTERM");
    let drainHealth = null;
    for (let i = 0; i < 30 && !drainHealth; i++) {
      const r = await fetch(`${base}/health`).catch(() => null);
      if (r && r.status === 503) drainHealth = await r.json();
      else await sleep(100);
    }
    assert(drainHealth?.draining === true, "drain sırasında /health 503 ve draining:true olmalı");
    assert(
      drainHealth.activeMatches >= 1,
      `drain sırasında maç sürüyor olmalı: ${JSON.stringify(drainHealth)}`,
    );
    await exited;
    await A.getByText("Tekrar bağlanıyor").waitFor(OPT);
    await shot(A, "17-reconnecting");
    errors.length = 0; // sunucu bilerek durduruldu: bu süredeki bağlantı hataları beklenen
    server = await startServer(port);
    await A.getByText("Oyun güncellendi, yeni oda kurabilirsin.").waitFor({ timeout: 30_000 });
    await A.getByText("Tekrar bağlanıyor").waitFor({ state: "hidden", timeout: 30_000 });
    await btn(A, /oda kur/i).click();
    await A.locator(".roomcode").waitFor(OPT);
    assert((await lobbyCode(A)) !== code, "yeni sunucuda yeni oda kurulmalı");
    await shot(A, "18-new-room-after-restart");
    log("sunucu güncelleme (drain, 1012, resume mesajı) ve yeni oda tamam");
    await sleep(500);

    assert(errors.length === 0, `tarayıcı hataları:\n${errors.join("\n")}`);
    log("TAMAM");
  } finally {
    await browser.close().catch(() => {});
    server.child.kill("SIGTERM");
    if (ENV.E2E_VERBOSE) console.log(server.output());
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    if (errors.length) console.error(`Toplanan tarayıcı hataları:\n${errors.join("\n")}`);
    process.exit(1);
  },
);
