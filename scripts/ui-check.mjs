// Otomatik tasarım denetimi: Vite geliştirme sunucusunda (mock sayfaları yalnız orada vardır; üretim
// `dist`'ine girmez) her sahte ekranı beş telefon boyutunda açar, ekran görüntüsünü docs/qa/a3'e yazar ve
// şunları doğrular: taşma yok, kırpılmış metin yok, her etkileşimli öğe >= 48x48 px, etkileşimli öğeler
// üst üste binmiyor, metin kontrastı >= 4.5:1, konsolda hata yok.
// Önce `pnpm build` (motor paketi dist'ten okunur). Kullanım: `pnpm ui:check [ekran-adı-parçası]`.
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
const OUT = join(ROOT, "docs/qa/a3");
const ONLY = process.argv[2] ?? "";
const T0 = Date.now();
const log = (...a) => console.log(`[ui-check +${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORTRAIT = [
  [320, 568],
  [390, 844],
  [430, 932],
];
const LANDSCAPE = [
  [844, 390],
  [667, 375],
];
const ALL = [...PORTRAIT, ...LANDSCAPE];

const clickText = (text) => async (page) => {
  await page.getByText(text, { exact: false }).first().click();
};

/** name: dosya adı; q: sorgu; act: ek eylem; settle: bekleme (ms); sizes: yalnız bu boyutlarda; clock: sahte saat (ms). */
const SCREENS = [
  { name: "home", q: "mock=home", settle: 1800 },
  { name: "home-nickname", q: "mock=home", act: async (p) => p.locator(".chip").click() },
  { name: "home-howto", q: "mock=home", act: clickText("Nasıl oynanır?") },
  { name: "join", q: "mock=join" },
  { name: "notfound", q: "mock=notfound" },
  { name: "reconnect", q: "mock=reconnect" },
  { name: "lobby-2", q: "mock=lobby&n=2" },
  { name: "lobby-8", q: "mock=lobby&n=8" },
  { name: "lobby-random", q: "mock=lobby", settle: 1000, act: clickText("Minigame Seçimi") },
  { name: "lobby-manual", q: "mock=lobby&sel=manual", settle: 1000, act: clickText("Minigame Seçimi") },
  {
    name: "lobby-kick",
    q: "mock=lobby",
    act: async (p) => p.locator(".seat:not(:disabled)").first().click(),
  },
  { name: "briefing", q: "mock=briefing" },
  { name: "briefing-ready", q: "mock=briefing-ready" },
  { name: "briefing-spectator", q: "mock=spectator-briefing" },
  { name: "countdown", q: "mock=countdown", settle: 700, clock: 1700 },
  { name: "playing", q: "mock=playing" },
  {
    name: "playing-press",
    q: "mock=playing",
    act: async (p) => {
      const box = await p.locator(".arcade__hit").boundingBox();
      if (!box) throw new Error("BAS düğmesi yok");
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await sleep(120);
    },
    after: async (p) => p.mouse.up(),
  },
  { name: "spectator-playing", q: "mock=spectator-playing" },
  // Çağrışım Ağı: klavye açıkken görünen alan küçülür (390x520, 360x300).
  { name: "cagrisim-briefing", q: "mock=cagrisim-briefing" },
  { name: "cagrisim-answer", q: "mock=cagrisim" },
  {
    name: "cagrisim-typed",
    q: "mock=cagrisim",
    act: async (p) => p.locator(".aform__field").fill("deniz kenarı"),
  },
  {
    name: "cagrisim-keyboard",
    q: "mock=cagrisim",
    sizes: [
      [390, 520],
      [360, 300],
      [320, 280],
    ],
    act: async (p) => p.locator(".aform__field").fill("deniz kenarı"),
  },
  {
    name: "cagrisim-sent",
    q: "mock=cagrisim",
    act: async (p) => {
      await p.locator(".aform__field").fill("mavi");
      await p.locator(".aform .pbtn").click();
    },
    settle: 800,
  },
  { name: "cagrisim-locked", q: "mock=cagrisim-locked" },
  { name: "cagrisim-spectator", q: "mock=cagrisim-spectator" },
  { name: "cagrisim-reveal-5", q: "mock=cagrisim-reveal&n=5", settle: 2400 },
  { name: "cagrisim-reveal-8", q: "mock=cagrisim-reveal&n=8", settle: 2400 },
  { name: "cagrisim-reveal-2", q: "mock=cagrisim-reveal&n=2", settle: 2400 },
  { name: "cagrisim-reveal-single", q: "mock=cagrisim-reveal-single&n=7", settle: 2400 },
  { name: "cagrisim-reveal-silent", q: "mock=cagrisim-reveal-silent&n=8", settle: 2400 },
  { name: "cagrisim-reveal-spectator", q: "mock=cagrisim-reveal-spectator", settle: 2400 },
  { name: "capraz-briefing", q: "mock=capraz-briefing" },
  { name: "capraz-pick", q: "mock=capraz-ates" },
  { name: "capraz-pick-8", q: "mock=capraz-ates&n=8" },
  { name: "capraz-pick-3", q: "mock=capraz-ates&n=3" },
  { name: "capraz-pick-offline", q: "mock=capraz-ates&off=1" },
  { name: "capraz-locked", q: "mock=capraz-locked" },
  {
    name: "capraz-tap",
    q: "mock=capraz-ates",
    act: async (p) => p.locator(".ca__cell:not(:disabled)").nth(1).click(),
  },
  { name: "capraz-closed", q: "mock=capraz-closed" },
  { name: "capraz-reveal", q: "mock=capraz-reveal", settle: 2800 },
  { name: "capraz-reveal-8", q: "mock=capraz-reveal&n=8", settle: 2800 },
  { name: "capraz-reveal-3", q: "mock=capraz-reveal&n=3", settle: 2800 },
  { name: "capraz-spectator", q: "mock=capraz-spectator" },
  { name: "capraz-spectator-reveal", q: "mock=capraz-spectator-reveal", settle: 2800 },
  { name: "results-3", q: "mock=results&n=3", settle: 2400 },
  { name: "results-8", q: "mock=results&n=8", settle: 2400 },
  { name: "final-3", q: "mock=final&n=3", settle: 2200 },
  { name: "final-8", q: "mock=final&n=8", settle: 2200 },
  {
    name: "final-feedback-open",
    q: "mock=final&n=8",
    settle: 2200,
    act: async (p) => p.getByRole("button", { name: "4 yıldız" }).click(),
  },
  {
    name: "final-feedback-sent",
    q: "mock=final&n=3",
    settle: 2200,
    act: async (p) => {
      await p.getByRole("button", { name: "5 yıldız" }).click();
      await p.locator(".fb__input").fill("Çok eğlenceliydi");
      await p.locator(".fb__send").click();
      await p.getByText("Teşekkürler!").waitFor();
    },
  },
  { name: "zaman-briefing", q: "mock=zaman-briefing" },
  { name: "zaman-playback", q: "mock=zaman-playback" },
  { name: "zaman-mine", q: "mock=zaman-mine" },
  { name: "zaman-mine-8", q: "mock=zaman-mine&n=8" },
  { name: "zaman-other", q: "mock=zaman-other" },
  { name: "zaman-ok", q: "mock=zaman-ok" },
  { name: "zaman-fail", q: "mock=zaman-fail" },
  { name: "zaman-timeout", q: "mock=zaman-timeout&n=8" },
  { name: "zaman-eliminated", q: "mock=zaman-eliminated" },
  { name: "zaman-spectator", q: "mock=zaman-spectator" },
  { name: "zaman-results", q: "mock=zaman-results&n=6", settle: 2400 },
  {
    name: "zaman-press",
    q: "mock=zaman-mine",
    act: async (p) => {
      const box = await p.locator(".zpad[data-c='mavi']").boundingBox();
      if (!box) throw new Error("mavi tuş yok");
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
      await sleep(120);
    },
    after: async (p) => p.mouse.up(),
  },
  { name: "kd-briefing", q: "mock=karalama-briefing" },
  { name: "kd-draw", q: "mock=karalama-draw" },
  { name: "kd-draw-near", q: "mock=karalama-draw-near" },
  { name: "kd-draw-ink", q: "mock=karalama-draw-ink" },
  {
    name: "kd-draw-pointer",
    q: "mock=karalama-draw",
    act: async (p) => {
      const box = await p.locator(".kd__live").boundingBox();
      if (!box) throw new Error("tahta yok");
      const at = (u, v) => [box.x + box.width * u, box.y + box.height * v];
      await p.mouse.move(...at(0.2, 0.7));
      await p.mouse.down();
      for (let i = 0; i <= 24; i++) {
        await p.mouse.move(...at(0.2 + i * 0.026, 0.7 - Math.sin(i / 3.5) * 0.3 - i * 0.008));
      }
      await p.mouse.up();
      await p.locator(".kd__swatch").nth(1).click();
      await p.mouse.move(...at(0.2, 0.3));
      await p.mouse.down();
      await p.mouse.move(...at(0.5, 0.2), { steps: 8 });
      await p.mouse.move(...at(0.8, 0.45), { steps: 8 });
      await p.mouse.up();
    },
  },
  { name: "kd-draw-spectator", q: "mock=karalama-draw-spectator" },
  { name: "kd-vote-3", q: "mock=karalama-vote&n=3" },
  { name: "kd-vote-5", q: "mock=karalama-vote" },
  { name: "kd-vote-8", q: "mock=karalama-vote&n=8" },
  { name: "kd-vote-voted", q: "mock=karalama-vote-voted" },
  {
    name: "kd-vote-tap",
    q: "mock=karalama-vote",
    act: async (p) => p.locator(".kd__bar:not(:disabled)").first().click(),
  },
  {
    name: "kd-vote-zoom",
    q: "mock=karalama-vote",
    act: async (p) => p.locator(".kd__frame").nth(1).click(),
  },
  { name: "kd-vote-spectator", q: "mock=karalama-vote-spectator" },
  { name: "kd-results-caught", q: "mock=karalama-results&n=5", settle: 2400 },
  { name: "kd-results-escaped-8", q: "mock=karalama-results-escaped&n=8", settle: 2400 },
  { name: "acgozluluk-briefing", q: "mock=acgozluluk-briefing" },
  { name: "acgozluluk-choosing-3", q: "mock=acgozluluk-choosing&n=3&chosen=0" },
  { name: "acgozluluk-choosing-5", q: "mock=acgozluluk-choosing&n=5" },
  { name: "acgozluluk-choosing-8", q: "mock=acgozluluk-choosing&n=8" },
  {
    name: "acgozluluk-choosing-tap",
    q: "mock=acgozluluk-choosing&n=6&chosen=0",
    settle: 2500,
    act: async (p) => p.locator(".lim-chip").nth(3).click(),
  },
  { name: "acgozluluk-reveal-ok-5", q: "mock=acgozluluk-reveal-ok&n=5", settle: 2800 },
  { name: "acgozluluk-reveal-ok-8", q: "mock=acgozluluk-reveal-ok&n=8", settle: 3500 },
  { name: "acgozluluk-reveal-over-3", q: "mock=acgozluluk-reveal-over&n=3", settle: 2800 },
  { name: "acgozluluk-reveal-over-8", q: "mock=acgozluluk-reveal-over&n=8", settle: 3500 },
  { name: "acgozluluk-spectator", q: "mock=acgozluluk-spectator&n=5" },
  { name: "kronometre-briefing", q: "mock=kor-kronometre-briefing" },
  { name: "kronometre-counting", q: "mock=kor-kronometre-counting" },
  {
    name: "kronometre-press",
    q: "mock=kor-kronometre-counting",
    settle: 800,
    act: async (p) => p.locator(".kk__press").click(),
  },
  { name: "kronometre-pressed", q: "mock=kor-kronometre-pressed" },
  { name: "kronometre-spectator", q: "mock=kor-kronometre-spectator" },
  { name: "kronometre-reveal-win-5", q: "mock=kor-kronometre-reveal&n=5&rank=1", settle: 1800 },
  { name: "kronometre-reveal-second-8", q: "mock=kor-kronometre-reveal&n=8&rank=2", settle: 2200 },
  { name: "kronometre-reveal-lose-8", q: "mock=kor-kronometre-reveal&n=8&rank=6&nopress=1", settle: 2200 },
  { name: "kronometre-reveal-2", q: "mock=kor-kronometre-reveal&n=2&rank=2", settle: 1800 },
  { name: "landscape", q: "mock=landscape", sizes: LANDSCAPE },
  { name: "landscape-8", q: "mock=landscape&n=8", sizes: LANDSCAPE },
  { name: "landscape-spectator", q: "mock=landscape&spectator=1", sizes: LANDSCAPE },
  { name: "kor-bomba-briefing", q: "mock=kor-bomba-briefing" },
  { name: "kor-bomba-holder", q: "mock=kor-bomba-holder", sizes: LANDSCAPE },
  { name: "kor-bomba-holder-8", q: "mock=kor-bomba-holder&n=8", sizes: LANDSCAPE },
  { name: "kor-bomba-watch", q: "mock=kor-bomba-watch", sizes: LANDSCAPE },
  { name: "kor-bomba-watch-8", q: "mock=kor-bomba-watch&n=8", sizes: LANDSCAPE },
  { name: "kor-bomba-urgent", q: "mock=kor-bomba-urgent", sizes: LANDSCAPE },
  { name: "kor-bomba-blast", q: "mock=kor-bomba-blast", sizes: LANDSCAPE },
  { name: "kor-bomba-spectator", q: "mock=kor-bomba-spectator", sizes: LANDSCAPE },
  { name: "kor-bomba-rotate", q: "mock=kor-bomba-watch", sizes: PORTRAIT, settle: 2000 },
  { name: "landscape-rotate", q: "mock=landscape", sizes: PORTRAIT, settle: 2000 },
];

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

/** Sayfa içinde çalışır: geometri/etkileşim/metin denetimleri. Metin düğümlerini kontrast için döndürür. */
function inPageAudit() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const issues = [];
  const texts = [];
  const desc = (el) => {
    const cls =
      typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    const t = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 28);
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}${t ? ` "${t}"` : ""}`;
  };
  const cs = (el) => getComputedStyle(el);
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= Number(cs(e).opacity);
    return o;
  };
  const hiddenBy = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = cs(e);
      if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse") return true;
    }
    return false;
  };
  const scroller = (el) => el.closest("[data-scroll]");
  const rectOf = (el) => el.getBoundingClientRect();
  const clipTo = (r, c) => ({
    left: Math.max(r.left, c.left),
    top: Math.max(r.top, c.top),
    right: Math.min(r.right, c.right),
    bottom: Math.min(r.bottom, c.bottom),
    get width() {
      return this.right - this.left;
    },
    get height() {
      return this.bottom - this.top;
    },
  });
  const inView = (r) => r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;
  /**
   * Üstteki öğe bu öğe (ya da içindekilerden biri) mi? Örtülen öğeler denetlenmez.
   * `loose`: üstteki öğe bunun atası olabilir (pointer-events: none olan metinler).
   */
  const topmost = (el, r, loose = false) => {
    const pts = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + r.width * 0.25, r.top + r.height / 2],
      [r.left + r.width * 0.75, r.top + r.height / 2],
    ];
    return pts.some(([x, y]) => {
      if (x < 0 || y < 0 || x >= vw || y >= vh) return false;
      const hit = document.elementFromPoint(x, y);
      return !!hit && (el === hit || el.contains(hit) || (loose && hit.contains(el)));
    });
  };

  // sayfa taşması
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) issues.push(["overflow", `sayfa yatayda taşıyor (${de.scrollWidth} > ${vw})`]);
  if (document.body.scrollWidth > vw + 1) issues.push(["overflow", "gövde yatayda taşıyor"]);

  // etkileşimli öğeler
  const SEL =
    'button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
  const inter = [];
  for (const el of document.querySelectorAll(SEL)) {
    if (el.classList.contains("sheet-backdrop") || el.closest('[aria-hidden="true"]')) continue;
    if (hiddenBy(el) || opacityOf(el) < 0.05) continue;
    const r = rectOf(el);
    if (r.width === 0 || r.height === 0) continue;
    const sc = scroller(el);
    if (sc) {
      const sr = rectOf(sc);
      if (r.bottom < sr.top || r.top > sr.bottom) continue; // kaydırılarak görünür olur
    }
    if (!topmost(el, r)) continue; // üstünü başka bir katman örtüyor
    // kaydırma alanında yalnız görünen kısım sayılır
    const vis = sc ? clipTo(r, rectOf(sc)) : r;
    inter.push({ el, r: vis });
    if (r.width < 47.5 || r.height < 47.5)
      issues.push([
        "target",
        `dokunma hedefi küçük ${Math.round(r.width)}x${Math.round(r.height)}: ${desc(el)}`,
      ]);
    if (!sc && !inView(r)) issues.push(["overflow", `etkileşimli öğe ekran dışında: ${desc(el)}`]);
    if (el.tagName === "BUTTON" && !el.getAttribute("aria-label") && !el.textContent.trim())
      issues.push(["a11y", `etiketsiz düğme: ${desc(el)}`]);
  }
  for (let i = 0; i < inter.length; i++) {
    for (let j = i + 1; j < inter.length; j++) {
      const a = inter[i];
      const b = inter[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (a.el.classList.contains("code__input") || b.el.classList.contains("code__input")) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 2 && h > 2)
        issues.push(["overlap", `${desc(a.el)}  ×  ${desc(b.el)} (${Math.round(w)}x${Math.round(h)})`]);
    }
  }

  // içerik öğeleri ekran içinde mi (avatarlar)
  for (const el of document.querySelectorAll(".av")) {
    if (hiddenBy(el) || opacityOf(el) < 0.05) continue;
    const r = rectOf(el);
    const sc = scroller(el);
    if (r.width === 0 || sc || !topmost(el, r, true)) continue;
    if (!inView(r)) issues.push(["overflow", `avatar ekran dışında: ${desc(el)}`]);
  }

  // kırpılan / taşan metin
  for (const el of document.querySelectorAll("*")) {
    if (el.closest(".sr-only") || el.closest("svg") || el.classList.contains("stage")) continue;
    const s = cs(el);
    if (s.display === "none" || s.display === "inline" || s.display === "contents") continue;
    if (hiddenBy(el) || el.clientWidth === 0 || el.clientHeight === 0) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const interactive = el.matches("button, a[href]") && el.textContent.trim();
    const clips = ["hidden", "clip"].includes(s.overflowX) || ["hidden", "clip"].includes(s.overflowY);
    if (el.closest("[data-scroll]") === el && !clips) continue;
    if (el.hasAttribute("data-scroll")) continue;
    if (
      (own || interactive) &&
      !["auto", "scroll"].includes(s.overflowX) &&
      el.scrollWidth > el.clientWidth + 1
    )
      issues.push(["clip", `metin kutusundan taşıyor (${el.scrollWidth} > ${el.clientWidth}): ${desc(el)}`]);
    if (
      clips &&
      el.textContent.trim() &&
      !el.hasAttribute("data-scroll") &&
      el.scrollHeight > el.clientHeight + 1
    )
      issues.push([
        "clip",
        `metin dikeyde kırpılıyor (${el.scrollHeight} > ${el.clientHeight}): ${desc(el)}`,
      ]);
  }

  // metin düğümleri: ekran içinde mi, yazı boyu, kontrast için bilgi
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.replace(/\s+/g, " ").trim();
    const el = n.parentElement;
    if (
      !text ||
      !el ||
      el.closest(".sr-only") ||
      el.closest("svg") ||
      ["SCRIPT", "STYLE"].includes(el.tagName)
    )
      continue;
    if (hiddenBy(el)) continue;
    const op = opacityOf(el);
    if (op < 0.2) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const sc = scroller(el);
    if (sc) {
      const sr = rectOf(sc);
      if (r.bottom <= sr.top + 1 || r.top >= sr.bottom - 1) continue;
      if (r.left < -0.5 || r.right > vw + 0.5)
        issues.push(["overflow", `kaydırılan metin yatayda taşıyor: ${desc(el)}`]);
    } else if (!inView(r)) {
      if (!topmost(el, r, true)) continue;
      issues.push([
        "overflow",
        `metin ekran dışına taşıyor [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]: ${desc(el)}`,
      ]);
      continue;
    }
    if (!topmost(el, r, true)) continue;
    const s = cs(el);
    const fontSize = parseFloat(s.fontSize);
    if (fontSize < 12.99) issues.push(["font", `yazı çok küçük (${fontSize}px): ${desc(el)}`]);
    const fill = s.webkitTextFillColor || s.color;
    texts.push({
      d: desc(el),
      fg: fill,
      opacity: op,
      r: [r.left, r.top, r.right, r.bottom].map((v) => Math.max(0, Math.round(v))),
      big: fontSize >= 24 || (fontSize >= 18.66 && Number(s.fontWeight) >= 700),
      disabled: el.closest(":disabled") !== null,
    });
  }
  return { issues, texts };
}

/** Sayfa içinde: saklı-metin ekran görüntüsünden arka plan örnekleyip kontrastı hesaplar. */
async function inPageContrast({ png, texts, dpr }) {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const parse = (css) => {
    const m = css.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1]
      .split(/[ ,/]+/)
      .filter(Boolean)
      .map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const out = [];
  for (const t of texts) {
    const fg = parse(t.fg);
    if (!fg || fg.a * t.opacity < 0.05) continue; // saydam metin (gradyan dolgu): atlanır
    const [x0, y0, x1, y1] = t.r.map((v) => Math.round(v * dpr));
    const w = Math.max(1, x1 - x0);
    const h = Math.max(1, y1 - y0);
    const data = g.getImageData(x0, y0, Math.min(w, img.width - x0), Math.min(h, img.height - y0)).data;
    const step = Math.max(1, Math.floor(data.length / 4 / 300));
    const ratios = [];
    const a = fg.a * t.opacity;
    for (let i = 0; i < data.length; i += 4 * step) {
      const br = data[i];
      const bg = data[i + 1];
      const bb = data[i + 2];
      const er = fg.r * a + br * (1 - a);
      const eg = fg.g * a + bg * (1 - a);
      const eb = fg.b * a + bb * (1 - a);
      ratios.push(ratio(lum(er, eg, eb), lum(br, bg, bb)));
    }
    ratios.sort((p, q) => p - q);
    const worst = ratios[Math.floor(ratios.length * 0.12)] ?? ratios[0];
    out.push({ d: t.d, ratio: worst, big: t.big, disabled: t.disabled });
  }
  return out;
}

async function checkOne(browser, scr, [w, h]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  const failures = [];
  try {
    // clock: sahte saat; geri sayım rakamı sabit kalsın (örn. 1700 ms sonra "2" ve orada durur)
    if (scr.clock) await page.clock.install({ time: new Date() });
    await page.goto(`${URL_BASE}/?${scr.q}`, { waitUntil: "load" });
    if (scr.clock) await page.clock.runFor(scr.clock);
    await page.evaluate(() => document.fonts.ready);
    await sleep(scr.settle ?? 1500);
    if (scr.act) {
      await scr.act(page);
      await sleep(700);
    }
    // Ölçüm animasyon ortasına denk gelmesin: sonlu animasyonlar bitiş karesine, sonsuzlar durdurulur.
    // (Aksi halde kontrast, rozetin belirme ya da basış parlamasının o anki karesine bağlı kalır.)
    await page.evaluate(() => {
      // JS ile süren animasyonlar (Pixi arka planı, geri sayım, sayaçlar) da durur: yeni kare istenmez.
      window.requestAnimationFrame = () => 0;
      for (const a of document.getAnimations()) {
        const iterations = a.effect?.getTiming().iterations;
        if (iterations === Number.POSITIVE_INFINITY) a.pause();
        else a.finish();
      }
    });
    await sleep(150); // istenmiş son kare çizilsin
    await page.screenshot({ path: join(OUT, `${scr.name}-${w}x${h}.png`) });
    const { issues, texts } = await page.evaluate(inPageAudit);
    for (const [kind, msg] of issues) failures.push(`[${kind}] ${msg}`);

    // kontrast: metni saydamlaştırıp arka planı örnekle
    await page.addStyleTag({
      content:
        "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}.confetti{display:none!important}",
    });
    const png = (await page.screenshot()).toString("base64");
    const ratios = await page.evaluate(
      `(${inPageContrast.toString()})(${JSON.stringify({ png, texts, dpr: 1 })})`,
    );
    for (const r of ratios) {
      // WCAG: büyük yazı (>= 24 px ya da >= 18,66 px kalın) için 3:1; devre dışı öğe için şart yok
      const need = r.disabled ? 0 : r.big ? 3 : 4.5;
      if (r.ratio < need) failures.push(`[contrast] ${r.ratio.toFixed(2)}:1 < ${need}: ${r.d}`);
    }
    await scr.after?.(page);
  } catch (e) {
    failures.push(`[hata] ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
  for (const e of consoleErrors) failures.push(`[console] ${e.slice(0, 200)}`);
  await ctx.close();
  return failures;
}

let URL_BASE = "";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const port = await freePort();
  log("vite başlatılıyor…");
  const vite = await startVite(port);
  URL_BASE = `http://127.0.0.1:${port}`;
  const stop = () => vite.kill();
  process.on("exit", stop);
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromiumPath(),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    });
    // ısınma: bağımlılıklar paketlensin, ilk sayfa yenilenmesin
    const warm = await browser.newPage();
    await warm.goto(`${URL_BASE}/?mock=home`, { waitUntil: "networkidle" });
    await warm.goto(`${URL_BASE}/?mock=landscape`, { waitUntil: "networkidle" });
    await warm.close();

    const jobs = [];
    for (const scr of SCREENS) {
      if (ONLY && !scr.name.includes(ONLY)) continue;
      for (const size of scr.sizes ?? ALL) jobs.push({ scr, size });
    }
    log(`${jobs.length} denetim`);
    const results = [];
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        const failures = await checkOne(browser, job.scr, job.size);
        results.push({ ...job, failures });
        const tag = `${job.scr.name} ${job.size[0]}x${job.size[1]}`;
        console.log(`${failures.length ? "✗" : "✓"} ${tag}${failures.length ? ` (${failures.length})` : ""}`);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));

    const bad = results.filter((r) => r.failures.length);
    console.log(
      `\n===== ÖZET: ${results.length} denetim, ${results.length - bad.length} geçti, ${bad.length} kaldı =====`,
    );
    for (const r of bad.sort((a, b) => a.scr.name.localeCompare(b.scr.name) || a.size[0] - b.size[0])) {
      console.log(`\n✗ ${r.scr.name} ${r.size[0]}x${r.size[1]}`);
      for (const f of [...new Set(r.failures)]) console.log(`    ${f}`);
    }
    console.log(`\nEkran görüntüleri: ${OUT}`);
    process.exitCode = bad.length ? 1 : 0;
  } finally {
    await browser?.close();
    stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
