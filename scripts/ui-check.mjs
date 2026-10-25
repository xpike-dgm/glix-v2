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
  { name: "capraz-tamam", q: "mock=capraz-tamam" },
  { name: "capraz-tamam-8", q: "mock=capraz-tamam&n=8" },
  {
    name: "capraz-lock-tap",
    q: "mock=capraz-locked",
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
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
  { name: "kd-draw-locked", q: "mock=karalama-draw-locked" },
  {
    name: "kd-draw-lock-tap",
    q: "mock=karalama-draw-ink",
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
  },
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
  { name: "kd-vote-locked", q: "mock=karalama-vote-locked" },
  {
    name: "kd-vote-lock-tap",
    q: "mock=karalama-vote-voted",
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
  },
  { name: "kd-results-caught", q: "mock=karalama-results&n=5", settle: 2400 },
  { name: "kd-results-escaped-8", q: "mock=karalama-results-escaped&n=8", settle: 2400 },
  { name: "bt-briefing", q: "mock=bozuk-briefing" },
  { name: "bt-write", q: "mock=bozuk-write" },
  {
    name: "bt-write-typed",
    q: "mock=bozuk-write",
    act: async (p) => p.locator(".bt__input").fill("kedi uzayda pizza yiyor"),
  },
  {
    name: "bt-write-keyboard",
    q: "mock=bozuk-write-late",
    sizes: [
      [390, 520],
      [360, 300],
      [320, 280],
    ],
    act: async (p) => p.locator(".bt__input").fill("balon çiçeğe çarpıp patladı"),
  },
  { name: "bt-write-late", q: "mock=bozuk-write-late" },
  {
    name: "bt-write-lock-tap",
    q: "mock=bozuk-write-late",
    act: async (p) => {
      await p.locator(".bt__input").fill("dev kaplumbağa bisiklet sürüyor");
      await p.locator(".tamam .pbtn:not(:disabled)").click();
    },
    settle: 800,
  },
  { name: "bt-write-locked", q: "mock=bozuk-write-locked" },
  { name: "bt-write-spectator", q: "mock=bozuk-write-spectator" },
  { name: "bt-draw", q: "mock=bozuk-draw" },
  { name: "bt-draw-blank", q: "mock=bozuk-draw-blank" },
  { name: "bt-draw-ink", q: "mock=bozuk-draw-ink" },
  {
    name: "bt-draw-pointer",
    q: "mock=bozuk-draw",
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
    },
  },
  { name: "bt-draw-locked", q: "mock=bozuk-draw-locked" },
  { name: "bt-draw-spectator", q: "mock=bozuk-draw-spectator" },
  {
    name: "bt-draw-lock-tap",
    q: "mock=bozuk-draw-ink",
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
  },
  { name: "bt-show-2", q: "mock=bozuk-show&n=5&shown=2" },
  { name: "bt-show-4-3p", q: "mock=bozuk-show&n=3&shown=3" },
  { name: "bt-show-1-8", q: "mock=bozuk-show&n=8&shown=1" },
  { name: "bt-vote-3", q: "mock=bozuk-vote&n=3" },
  { name: "bt-vote-5", q: "mock=bozuk-vote&n=5" },
  { name: "bt-vote-8", q: "mock=bozuk-vote&n=8" },
  {
    name: "bt-vote-tap",
    q: "mock=bozuk-vote&n=5",
    act: async (p) => p.locator(".bt__card:not(:disabled)").first().click(),
  },
  {
    name: "bt-vote-confirm",
    q: "mock=bozuk-vote&n=5",
    act: async (p) => {
      await p.locator(".bt__card:not(:disabled)").first().click();
      await p.locator(".pbtn:not(:disabled)").click();
    },
    settle: 800,
  },
  { name: "bt-vote-voted", q: "mock=bozuk-vote-voted&n=5" },
  { name: "bt-vote-spectator", q: "mock=bozuk-vote-spectator&n=5" },
  { name: "bt-result-5", q: "mock=bozuk-result&n=5" },
  { name: "bt-result-robust-3", q: "mock=bozuk-result-robust&n=3" },
  { name: "bt-result-robust-8", q: "mock=bozuk-result-robust&n=8" },
  { name: "bt-result-quiet-6", q: "mock=bozuk-result-quiet&n=6" },
  { name: "bt-results-5", q: "mock=bozuk-results&n=3", settle: 2400 },
  { name: "kb-briefing", q: "mock=kara-briefing" },
  { name: "kb-bid-5", q: "mock=kara-bid" },
  { name: "kb-bid-8", q: "mock=kara-bid&n=8" },
  { name: "kb-bid-3", q: "mock=kara-bid&n=3" },
  { name: "kb-bid-broke", q: "mock=kara-bid-broke" },
  { name: "kb-bid-sent", q: "mock=kara-bid-sent" },
  { name: "kb-bid-spectator", q: "mock=kara-bid-spectator" },
  {
    name: "kb-bid-tap",
    q: "mock=kara-bid",
    settle: 800,
    act: async (p) => {
      await p.locator(".npick__step").nth(3).click();
      await p.locator(".pbtn:not(:disabled)").click();
    },
  },
  { name: "kb-reveal-5", q: "mock=kara-reveal", settle: 900 },
  { name: "kb-reveal-8", q: "mock=kara-reveal&n=8", settle: 900 },
  { name: "kb-reveal-me", q: "mock=kara-reveal-me", settle: 900 },
  { name: "kb-reveal-cursed", q: "mock=kara-reveal-cursed", settle: 900 },
  { name: "kb-reveal-none", q: "mock=kara-reveal-none&n=3", settle: 900 },
  { name: "kb-results", q: "mock=kara-results&n=3", settle: 2400 },
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
  { name: "acgozluluk-locked-5", q: "mock=acgozluluk-locked&n=5" },
  { name: "acgozluluk-locked-8", q: "mock=acgozluluk-locked&n=8" },
  {
    name: "acgozluluk-lock-tap",
    q: "mock=acgozluluk-choosing&n=6",
    settle: 2500,
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
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
  { name: "asiri-briefing", q: "mock=asiri-yukleme-briefing" },
  { name: "asiri-playing", q: "mock=asiri-yukleme-playing" },
  {
    name: "asiri-tap",
    q: "mock=asiri-yukleme-playing",
    settle: 400,
    act: async (p) => {
      const box = await p.locator(".ay__hit").boundingBox();
      if (!box) throw new Error("çekirdek yok");
      const t0 = Date.now();
      for (let i = 0; i < 14; i++) {
        await p.mouse.click(
          box.x + box.width / 2 + (i % 5) * 14 - 28,
          box.y + box.height / 2 + (i % 3) * 18 - 18,
        );
        await sleep(30);
      }
      // 14 hızlı dokunuş: hiçbir tık kaybolmamalı, mesaj hızı 80 ms'de 1'i aşmamalı (sunucu sınırı 20/sn).
      await sleep(400);
      const elapsed = Date.now() - t0;
      const sent = await p.evaluate(() => window.__sent);
      if (sent?.taps !== 14 || (sent?.messages ?? 99) > elapsed / 80 + 2 || sent.messages >= 14) {
        throw new Error(`toplu gönderim bozuk: ${JSON.stringify(sent)} (${elapsed} ms)`);
      }
    },
  },
  { name: "asiri-danger", q: "mock=asiri-yukleme-danger" },
  { name: "asiri-reveal-boom-5", q: "mock=asiri-yukleme-reveal-boom&n=5", settle: 1800 },
  { name: "asiri-reveal-boom-me-8", q: "mock=asiri-yukleme-reveal-boom&n=8&me=1", settle: 2200 },
  { name: "asiri-reveal-safe-8", q: "mock=asiri-yukleme-reveal-safe&n=8", settle: 2200 },
  { name: "asiri-reveal-2", q: "mock=asiri-yukleme-reveal-boom&n=2", settle: 1800 },
  { name: "asiri-spectator", q: "mock=asiri-yukleme-spectator" },
  { name: "ortalama-briefing", q: "mock=ortalama-briefing" },
  { name: "ortalama-choosing-3", q: "mock=ortalama-choosing&n=3&chosen=0" },
  { name: "ortalama-choosing-5", q: "mock=ortalama-choosing&n=5" },
  { name: "ortalama-choosing-8", q: "mock=ortalama-choosing&n=8" },
  {
    name: "ortalama-choosing-tap",
    q: "mock=ortalama-choosing&n=6&chosen=0",
    settle: 2500,
    act: async (p) => p.locator(".npick__step").nth(3).click(),
  },
  { name: "ortalama-locked-5", q: "mock=ortalama-locked&n=5" },
  { name: "ortalama-locked-8", q: "mock=ortalama-locked&n=8" },
  {
    name: "ortalama-lock-tap",
    q: "mock=ortalama-choosing&n=6",
    settle: 2500,
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
  },
  { name: "ortalama-reveal-5", q: "mock=ortalama-reveal&n=5", settle: 6000 },
  { name: "ortalama-reveal-3", q: "mock=ortalama-reveal&n=3", settle: 6000 },
  { name: "ortalama-reveal-8", q: "mock=ortalama-reveal&n=8", settle: 6500 },
  { name: "ortalama-reveal-tie-8", q: "mock=ortalama-reveal-tie&n=8", settle: 6500 },
  { name: "ortalama-reveal-mid", q: "mock=ortalama-reveal&n=5", settle: 2800 },
  { name: "ortalama-spectator", q: "mock=ortalama-spectator&n=5" },
  { name: "cizgi-briefing", q: "mock=cizgi-briefing" },
  { name: "cizgi-choosing-2", q: "mock=cizgi-choosing&n=2&chosen=0" },
  { name: "cizgi-choosing-5", q: "mock=cizgi-choosing&n=5" },
  { name: "cizgi-choosing-8", q: "mock=cizgi-choosing&n=8" },
  {
    name: "cizgi-choosing-tap",
    q: "mock=cizgi-choosing&n=6&chosen=0",
    settle: 2500,
    act: async (p) => p.locator(".npick__step").nth(3).click(),
  },
  { name: "cizgi-locked-5", q: "mock=cizgi-locked&n=5" },
  { name: "cizgi-locked-8", q: "mock=cizgi-locked&n=8" },
  {
    name: "cizgi-lock-tap",
    q: "mock=cizgi-choosing&n=6",
    settle: 2500,
    act: async (p) => p.locator(".tamam .pbtn:not(:disabled)").click(),
  },
  { name: "cizgi-reveal-5", q: "mock=cizgi-reveal&n=5", settle: 6000 },
  { name: "cizgi-reveal-2", q: "mock=cizgi-reveal&n=2", settle: 6000 },
  { name: "cizgi-reveal-8", q: "mock=cizgi-reveal&n=8", settle: 6000 },
  { name: "cizgi-reveal-crowd-8", q: "mock=cizgi-reveal-crowd&n=8", settle: 6000 },
  { name: "cizgi-reveal-passive-6", q: "mock=cizgi-reveal-passive&n=6", settle: 6000 },
  { name: "cizgi-reveal-mid", q: "mock=cizgi-reveal&n=5", settle: 2600 },
  { name: "cizgi-spectator", q: "mock=cizgi-spectator&n=5" },
  { name: "kareler-briefing", q: "mock=kareler-briefing" },
  { name: "kareler-choosing-3", q: "mock=kareler-choosing&n=3&chosen=0" },
  { name: "kareler-choosing-4", q: "mock=kareler-choosing&n=4" },
  { name: "kareler-choosing-5", q: "mock=kareler-choosing&n=5&chosen=0" },
  { name: "kareler-choosing-8", q: "mock=kareler-choosing&n=8" },
  {
    name: "kareler-choosing-tap",
    q: "mock=kareler-choosing&n=6&chosen=0",
    settle: 1200,
    act: async (p) => p.locator(".kcell").nth(5).click(),
  },
  { name: "kareler-locked-5", q: "mock=kareler-locked&n=5" },
  {
    name: "kareler-lock-tap",
    q: "mock=kareler-choosing&n=6",
    settle: 1200,
    act: async (p) => p.getByRole("button", { name: "Tamam" }).click(),
  },
  { name: "kareler-reveal-3", q: "mock=kareler-reveal&n=3", settle: 3200 },
  { name: "kareler-reveal-5", q: "mock=kareler-reveal&n=5", settle: 3200 },
  { name: "kareler-reveal-8", q: "mock=kareler-reveal&n=8", settle: 3200 },
  { name: "kareler-reveal-mid", q: "mock=kareler-reveal&n=6", settle: 1700 },
  { name: "kareler-reveal-all-8", q: "mock=kareler-reveal-all&n=8", settle: 3200 },
  { name: "kareler-reveal-walkover-5", q: "mock=kareler-reveal-walkover&n=5", settle: 3200 },
  { name: "kareler-choosing2-5", q: "mock=kareler-choosing2&n=5" },
  { name: "kareler-choosing2-out-6", q: "mock=kareler-choosing2-out&n=6" },
  { name: "kareler-final-5", q: "mock=kareler-final&n=5", settle: 3200 },
  { name: "kareler-final-win-8", q: "mock=kareler-final-win&n=8", settle: 3200 },
  { name: "kareler-spectator", q: "mock=kareler-spectator&n=5" },
  { name: "alisveris-briefing", q: "mock=alisveris-briefing" },
  { name: "alisveris-shop-3", q: "mock=alisveris-shop&n=3" },
  { name: "alisveris-shop-8", q: "mock=alisveris-shop&n=8" },
  { name: "alisveris-shop-empty", q: "mock=alisveris-shop&n=5&empty=1" },
  { name: "alisveris-locked-5", q: "mock=alisveris-locked&n=5" },
  {
    name: "alisveris-lock-empty",
    q: "mock=alisveris-shop&n=4&empty=1",
    settle: 1200,
    act: async (p) => p.getByRole("button", { name: "Tamam" }).click(),
  },
  { name: "alisveris-low", q: "mock=alisveris-low&n=5" },
  {
    name: "alisveris-tap",
    q: "mock=alisveris-shop&n=5&empty=1",
    settle: 900,
    act: async (p) => p.locator(".aitem").nth(3).click(),
  },
  { name: "alisveris-reveal-shelf", q: "mock=alisveris-reveal&n=5", settle: 2800 },
  { name: "alisveris-reveal-5", q: "mock=alisveris-reveal&n=5", settle: 6000 },
  { name: "alisveris-reveal-8", q: "mock=alisveris-reveal&n=8", settle: 6000 },
  { name: "alisveris-reveal-3", q: "mock=alisveris-reveal&n=3", settle: 6000 },
  { name: "alisveris-reveal-tie", q: "mock=alisveris-reveal-tie&n=6", settle: 6000 },
  { name: "alisveris-spectator", q: "mock=alisveris-spectator&n=5" },
  { name: "ittifak-briefing", q: "mock=ittifak-briefing" },
  { name: "ittifak-talk-5", q: "mock=ittifak-talk&n=5" },
  { name: "ittifak-talk-8", q: "mock=ittifak-talk&n=8" },
  { name: "ittifak-talk-3", q: "mock=ittifak-talk&n=3" },
  { name: "ittifak-vote-5", q: "mock=ittifak-vote&n=5" },
  { name: "ittifak-vote-8", q: "mock=ittifak-vote&n=8&chosen=3" },
  { name: "ittifak-vote-3", q: "mock=ittifak-vote&n=3" },
  {
    name: "ittifak-vote-tap",
    q: "mock=ittifak-vote&n=6",
    act: async (p) => p.locator(".ppick__cell:not(:disabled)").first().click(),
  },
  { name: "ittifak-talk-locked-5", q: "mock=ittifak-talk-locked&n=5" },
  { name: "ittifak-vote-locked-5", q: "mock=ittifak-vote-locked&n=5" },
  { name: "ittifak-vote-locked-8", q: "mock=ittifak-vote-locked&n=8" },
  {
    name: "ittifak-talk-skip",
    q: "mock=ittifak-talk&n=6",
    settle: 1200,
    act: async (p) => p.getByRole("button", { name: "Oylamaya geçelim" }).click(),
  },
  { name: "ittifak-reveal-5", q: "mock=ittifak-reveal&n=5", settle: 3000 },
  { name: "ittifak-reveal-8", q: "mock=ittifak-reveal&n=8", settle: 3000 },
  { name: "ittifak-reveal-3", q: "mock=ittifak-reveal&n=3", settle: 3000 },
  { name: "ittifak-reveal-zero", q: "mock=ittifak-reveal-zero&n=6", settle: 3000 },
  { name: "ittifak-spectator-talk", q: "mock=ittifak-spectator-talk&n=5" },
  { name: "ittifak-spectator-vote", q: "mock=ittifak-spectator-vote&n=5" },
  { name: "ittifak-spectator-reveal", q: "mock=ittifak-spectator-reveal&n=5", settle: 3000 },
  { name: "kontrol-briefing", q: "mock=kontrol-briefing" },
  { name: "kontrol-play-4", q: "mock=kontrol-play&n=4" },
  { name: "kontrol-play-3clue", q: "mock=kontrol-play&n=8&clue=3" },
  { name: "kontrol-play-2", q: "mock=kontrol-play&n=2" },
  {
    name: "kontrol-play-select",
    q: "mock=kontrol-play&n=5",
    act: async (p) => p.locator(".kp__wire:not(:disabled)").nth(1).click(),
  },
  { name: "kontrol-play-cut", q: "mock=kontrol-cut&n=6" },
  { name: "kontrol-reveal-right", q: "mock=kontrol-reveal&n=5", settle: 2500 },
  { name: "kontrol-reveal-8", q: "mock=kontrol-reveal&n=8", settle: 2500 },
  { name: "kontrol-reveal-wrong", q: "mock=kontrol-reveal-wrong&n=4", settle: 2500 },
  { name: "kontrol-reveal-2", q: "mock=kontrol-reveal&n=2", settle: 2500 },
  { name: "kontrol-spectator-play", q: "mock=kontrol-spectator-play&n=5" },
  { name: "kontrol-spectator-reveal", q: "mock=kontrol-spectator-reveal&n=5", settle: 2500 },
  { name: "kendim-briefing", q: "mock=kendim-briefing" },
  { name: "kendim-write", q: "mock=kendim-write&n=5" },
  {
    name: "kendim-write-typed",
    q: "mock=kendim-write&n=8",
    act: async (p) => p.locator(".wfield__input").fill("neşeli"),
  },
  { name: "kendim-write-locked", q: "mock=kendim-write-locked&n=6" },
  {
    name: "kendim-write-keyboard",
    q: "mock=kendim-write&n=5",
    sizes: [
      [390, 520],
      [360, 300],
      [320, 280],
    ],
    act: async (p) => p.locator(".wfield__input").fill("neşeli"),
  },
  { name: "kendim-match-5", q: "mock=kendim-match&n=5" },
  { name: "kendim-match-8", q: "mock=kendim-match&n=8&paired=3" },
  { name: "kendim-match-3", q: "mock=kendim-match&n=3" },
  {
    name: "kendim-match-sheet",
    q: "mock=kendim-match&n=8&paired=2",
    settle: 600,
    act: async (p) => p.locator(".kd__card").first().click({ force: true }),
  },
  { name: "kendim-match-locked", q: "mock=kendim-match-locked&n=6" },
  { name: "kendim-reveal-5", q: "mock=kendim-reveal&n=5", settle: 3000 },
  { name: "kendim-reveal-8", q: "mock=kendim-reveal&n=8", settle: 3000 },
  { name: "kendim-reveal-3", q: "mock=kendim-reveal&n=3", settle: 3000 },
  { name: "kendim-reveal-negative", q: "mock=kendim-reveal-negative&n=6", settle: 3000 },
  { name: "kendim-spectator-write", q: "mock=kendim-spectator-write&n=5" },
  { name: "kendim-spectator-match", q: "mock=kendim-spectator-match&n=5" },
  { name: "kendim-spectator-reveal", q: "mock=kendim-spectator-reveal&n=5", settle: 3000 },
  { name: "yazi-briefing", q: "mock=yazi-briefing" },
  { name: "yazi-write-innocent", q: "mock=yazi-write&n=5" },
  { name: "yazi-write-writer", q: "mock=yazi-write&n=5&role=writer" },
  {
    name: "yazi-write-typed",
    q: "mock=yazi-write&n=8",
    act: async (p) => p.locator(".wfield__input").fill("masum"),
  },
  {
    name: "yazi-write-peek",
    q: "mock=yazi-write&n=5",
    act: async (p) => {
      const box = await p.locator(".yy__peek").boundingBox();
      if (!box) throw new Error("rol düğmesi yok");
      await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await p.mouse.down();
    },
    after: async (p) => p.mouse.up(),
  },
  { name: "yazi-write-locked", q: "mock=yazi-write-locked&n=6" },
  {
    name: "yazi-write-keyboard",
    q: "mock=yazi-write&n=5",
    sizes: [
      [390, 520],
      [360, 300],
      [320, 280],
    ],
    act: async (p) => p.locator(".wfield__input").fill("masum"),
  },
  { name: "yazi-talk-5", q: "mock=yazi-talk&n=5" },
  { name: "yazi-talk-8", q: "mock=yazi-talk&n=8&role=writer" },
  { name: "yazi-talk-3", q: "mock=yazi-talk&n=3" },
  { name: "yazi-talk-locked", q: "mock=yazi-talk-locked&n=6" },
  { name: "yazi-guess-5", q: "mock=yazi-guess&n=5" },
  { name: "yazi-guess-8", q: "mock=yazi-guess&n=8&chosen=3" },
  { name: "yazi-guess-3", q: "mock=yazi-guess&n=3" },
  {
    name: "yazi-guess-tap",
    q: "mock=yazi-guess&n=6",
    act: async (p) => {
      await p.locator(".ppick__cell:not(:disabled)").first().click();
      await p.locator(".wfield__input").fill("kedi");
    },
  },
  { name: "yazi-guess-locked", q: "mock=yazi-guess-locked&n=6" },
  { name: "yazi-reveal-5", q: "mock=yazi-reveal&n=5", settle: 3000 },
  { name: "yazi-reveal-8", q: "mock=yazi-reveal&n=8", settle: 3000 },
  { name: "yazi-reveal-3", q: "mock=yazi-reveal&n=3", settle: 3000 },
  { name: "yazi-reveal-zero", q: "mock=yazi-reveal-zero&n=6", settle: 3000 },
  { name: "yazi-spectator-write", q: "mock=yazi-spectator-write&n=5" },
  { name: "yazi-spectator-talk", q: "mock=yazi-spectator-talk&n=5" },
  { name: "yazi-spectator-guess", q: "mock=yazi-spectator-guess&n=5" },
  { name: "yazi-spectator-reveal", q: "mock=yazi-spectator-reveal&n=5", settle: 3000 },
  { name: "rusvet-briefing", q: "mock=rusvet-briefing" },
  { name: "rusvet-vote-5", q: "mock=rusvet-vote&n=5" },
  { name: "rusvet-vote-8", q: "mock=rusvet-vote&n=8&chosen=3" },
  { name: "rusvet-vote-3", q: "mock=rusvet-vote&n=3" },
  { name: "rusvet-duel-3", q: "mock=rusvet-duel&n=5&c=3", settle: 800 },
  { name: "rusvet-duel-8", q: "mock=rusvet-duel&n=8&c=8", settle: 800 },
  { name: "rusvet-duel-2", q: "mock=rusvet-duel&n=4&c=2&replay=1", settle: 800 },
  { name: "rusvet-duel-open", q: "mock=rusvet-duel&n=6&c=4&open=1", settle: 1200 },
  { name: "rusvet-duel-out", q: "mock=rusvet-duel-out&n=6&c=3", settle: 800 },
  {
    name: "rusvet-duel-tap",
    q: "mock=rusvet-duel&n=5&c=3",
    settle: 800,
    act: async (p) => p.locator(".rd__sign").nth(1).click(),
  },
  { name: "rusvet-give-5", q: "mock=rusvet-give&n=5&budget=3" },
  { name: "rusvet-give-8", q: "mock=rusvet-give&n=8&budget=6" },
  { name: "rusvet-give-3", q: "mock=rusvet-give&n=3&budget=2" },
  {
    name: "rusvet-give-tap",
    q: "mock=rusvet-give&n=6&budget=4",
    settle: 500,
    act: async (p) => {
      const cells = p.locator(".ppick__cell:not(:disabled)");
      await cells.nth(0).click();
      await cells.nth(0).click();
      await cells.nth(1).click();
    },
  },
  { name: "rusvet-vote-locked-5", q: "mock=rusvet-vote-locked&n=5" },
  { name: "rusvet-vote-locked-8", q: "mock=rusvet-vote-locked&n=8" },
  { name: "rusvet-duel-locked-5", q: "mock=rusvet-duel-locked&n=5&c=3", settle: 800 },
  { name: "rusvet-give-locked-5", q: "mock=rusvet-give-locked&n=5&budget=3" },
  {
    name: "rusvet-vote-lock-tap",
    q: "mock=rusvet-vote&n=5&chosen=1",
    settle: 500,
    act: async (p) => p.getByRole("button", { name: "Tamam" }).click(),
  },
  {
    name: "rusvet-give-done-tap",
    q: "mock=rusvet-give&n=6&budget=4",
    settle: 500,
    act: async (p) => {
      await p.locator(".ppick__cell:not(:disabled)").nth(0).click();
      await p.getByRole("button", { name: "Bitti" }).click();
    },
  },
  { name: "rusvet-give-wait", q: "mock=rusvet-give-wait&n=5&budget=3", settle: 800 },
  { name: "rusvet-reveal-5", q: "mock=rusvet-reveal&n=5", settle: 5600 },
  { name: "rusvet-reveal-8", q: "mock=rusvet-reveal&n=8", settle: 5600 },
  { name: "rusvet-reveal-president", q: "mock=rusvet-reveal&n=5&me=president", settle: 5600 },
  { name: "rusvet-reveal-mid", q: "mock=rusvet-reveal&n=6", settle: 2200 },
  { name: "rusvet-spectator-vote", q: "mock=rusvet-spectator-vote&n=5" },
  { name: "rusvet-spectator-duel", q: "mock=rusvet-spectator-duel&n=5&c=3", settle: 800 },
  { name: "rusvet-spectator-give", q: "mock=rusvet-spectator-give&n=5", settle: 800 },
  { name: "rusvet-spectator-reveal", q: "mock=rusvet-spectator-reveal&n=5", settle: 5600 },
  { name: "sizma-briefing", q: "mock=sizma-briefing" },
  { name: "sizma-clue-3", q: "mock=sizma-clue&n=3" },
  { name: "sizma-clue-5", q: "mock=sizma-clue&n=5" },
  { name: "sizma-clue-8", q: "mock=sizma-clue&n=8" },
  { name: "sizma-clue-locked-5", q: "mock=sizma-clue-locked&n=5" },
  {
    name: "sizma-clue-skip",
    q: "mock=sizma-clue&n=6",
    settle: 1200,
    act: async (p) => p.getByRole("button", { name: "Oylamaya geç" }).click(),
  },
  { name: "sizma-vote-3", q: "mock=sizma-vote&n=3" },
  { name: "sizma-vote-5", q: "mock=sizma-vote&n=5" },
  { name: "sizma-vote-8", q: "mock=sizma-vote&n=8&chosen=3" },
  {
    name: "sizma-vote-self-tap",
    q: "mock=sizma-vote&n=6",
    act: async (p) => p.getByRole("button", { name: "Kendine oy ver" }).click(),
  },
  { name: "sizma-vote-locked-5", q: "mock=sizma-vote-locked&n=5" },
  { name: "sizma-vote-locked-8", q: "mock=sizma-vote-locked&n=8" },
  { name: "sizma-reveal-5", q: "mock=sizma-reveal&n=5", settle: 2400 },
  { name: "sizma-reveal-8", q: "mock=sizma-reveal&n=8", settle: 2400 },
  { name: "sizma-reveal-3", q: "mock=sizma-reveal&n=3", settle: 2400 },
  { name: "sizma-reveal-escaped-6", q: "mock=sizma-reveal-escaped&n=6", settle: 2400 },
  { name: "sizma-reveal-odd-5", q: "mock=sizma-reveal&n=5&me=odd", settle: 2400 },
  { name: "sizma-reveal-odd-escaped-5", q: "mock=sizma-reveal-escaped&n=5&me=odd", settle: 2400 },
  { name: "sizma-spectator-clue", q: "mock=sizma-spectator-clue&n=5" },
  { name: "sizma-spectator-vote", q: "mock=sizma-spectator-vote&n=5" },
  { name: "sizma-spectator-reveal", q: "mock=sizma-spectator-reveal&n=5", settle: 2400 },
  { name: "sozluk-briefing", q: "mock=sozluk-briefing" },
  { name: "sozluk-write-5", q: "mock=sozluk-write&n=5" },
  { name: "sozluk-write-3", q: "mock=sozluk-write&n=3" },
  { name: "sozluk-write-8", q: "mock=sozluk-write&n=8" },
  {
    name: "sozluk-write-typed",
    q: "mock=sozluk-write&n=5",
    act: async (p) =>
      p
        .locator(".sb__field")
        .fill("Eski zamanlarda köylerde kullanılan, ağzı geniş, iki kulplu büyük bir toprak çömlek türü"),
  },
  {
    name: "sozluk-write-keyboard",
    q: "mock=sozluk-write&n=5",
    sizes: [
      [390, 520],
      [360, 300],
      [320, 280],
    ],
    act: async (p) => p.locator(".sb__field").fill("eski bir kayık türü"),
  },
  {
    name: "sozluk-write-same-as-real",
    q: "mock=sozluk-write&n=5",
    settle: 800,
    act: async (p) => {
      await p.locator(".sb__field").fill("gerçek anlam");
      await p.getByRole("button", { name: "Gönder" }).click();
    },
  },
  {
    name: "sozluk-write-sent",
    q: "mock=sozluk-write&n=5",
    settle: 800,
    act: async (p) => {
      await p.locator(".sb__field").fill("denizcilerin taktığı kalın bir atkı");
      await p.getByRole("button", { name: "Gönder" }).click();
    },
  },
  { name: "sozluk-write-locked-5", q: "mock=sozluk-write-locked&n=5" },
  { name: "sozluk-write-locked-8", q: "mock=sozluk-write-locked&n=8" },
  { name: "sozluk-pick-3", q: "mock=sozluk-pick&n=3" },
  { name: "sozluk-pick-5", q: "mock=sozluk-pick&n=5" },
  { name: "sozluk-pick-8", q: "mock=sozluk-pick&n=8&chosen=2" },
  {
    name: "sozluk-pick-tap",
    q: "mock=sozluk-pick&n=6",
    act: async (p) => p.locator(".sbcard:not(:disabled)").nth(1).click(),
  },
  { name: "sozluk-pick-locked-5", q: "mock=sozluk-pick-locked&n=5" },
  { name: "sozluk-pick-locked-8", q: "mock=sozluk-pick-locked&n=8" },
  { name: "sozluk-reveal-3", q: "mock=sozluk-reveal&n=3", settle: 3600 },
  { name: "sozluk-reveal-5", q: "mock=sozluk-reveal&n=5", settle: 3600 },
  { name: "sozluk-reveal-8", q: "mock=sozluk-reveal&n=8", settle: 3600 },
  { name: "sozluk-reveal-none-6", q: "mock=sozluk-reveal&n=6&me=none", settle: 3600 },
  { name: "sozluk-spectator-write", q: "mock=sozluk-spectator-write&n=5" },
  { name: "sozluk-spectator-pick", q: "mock=sozluk-spectator-pick&n=5" },
  { name: "sozluk-spectator-reveal", q: "mock=sozluk-spectator-reveal&n=5", settle: 3600 },
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
  { name: "gizli-briefing", q: "mock=gizli-briefing" },
  { name: "gizli-idle", q: "mock=gizli-idle" },
  { name: "gizli-pressed", q: "mock=gizli-pressed" },
  {
    name: "gizli-tap",
    q: "mock=gizli-idle",
    act: async (p) => p.locator(".gh__btn").click(),
    settle: 700,
  },
  { name: "gizli-spectator", q: "mock=gizli-spectator" },
  { name: "gizli-reveal-solo", q: "mock=gizli-reveal-solo&n=5", settle: 2400 },
  { name: "gizli-reveal-multi", q: "mock=gizli-reveal-multi&n=8", settle: 2400 },
  { name: "gizli-reveal-none", q: "mock=gizli-reveal-none&n=3", settle: 2400 },
  { name: "sonkisi-briefing", q: "mock=sonkisi-briefing" },
  { name: "sonkisi-idle", q: "mock=sonkisi-idle" },
  { name: "sonkisi-tense", q: "mock=sonkisi-tense&n=8" },
  { name: "sonkisi-escaped", q: "mock=sonkisi-escaped", settle: 1200 },
  {
    name: "sonkisi-tap",
    q: "mock=sonkisi-idle",
    act: async (p) => p.locator(".sk__btn").click(),
    settle: 1200,
  },
  { name: "sonkisi-spectator", q: "mock=sonkisi-spectator" },
  { name: "sonkisi-reveal", q: "mock=sonkisi-reveal&n=5", settle: 2400 },
  { name: "sonkisi-reveal-tie", q: "mock=sonkisi-reveal-tie&n=8", settle: 2400 },
  { name: "sonkisi-reveal-none", q: "mock=sonkisi-reveal-none&n=3", settle: 2400 },
  { name: "rus-briefing", q: "mock=rus-briefing" },
  { name: "rus-hold-5", q: "mock=rus-hold&n=5" },
  { name: "rus-hold-8", q: "mock=rus-hold&n=8&off=1" },
  { name: "rus-hold-2", q: "mock=rus-hold&n=2" },
  {
    name: "rus-hold-picked",
    q: "mock=rus-hold&n=6",
    act: async (p) => p.locator(".rr__cell:not(:disabled)").nth(2).click(),
    settle: 600,
  },
  { name: "rus-wait", q: "mock=rus-wait&n=6" },
  { name: "rus-safe", q: "mock=rus-safe&n=5", settle: 900 },
  { name: "rus-boom", q: "mock=rus-boom&n=6", settle: 900 },
  { name: "rus-boom-me", q: "mock=rus-boom-me&n=8", settle: 900 },
  { name: "rus-out", q: "mock=rus-out&n=5" },
  { name: "rus-spectator", q: "mock=rus-spectator&n=6" },
  { name: "rus-reveal-6", q: "mock=rus-reveal&n=6", settle: 2400 },
  { name: "rus-reveal-2", q: "mock=rus-reveal&n=2", settle: 2400 },
  { name: "zehirli-briefing", q: "mock=zehirli-briefing" },
  { name: "zehirli-play-5", q: "mock=zehirli-play&n=5" },
  { name: "zehirli-play-8", q: "mock=zehirli-play&n=8" },
  { name: "zehirli-play-2", q: "mock=zehirli-play&n=2" },
  {
    name: "zehirli-picked",
    q: "mock=zehirli-play&n=6",
    act: async (p) => p.locator(".zk__cell:not(:disabled)").nth(1).click(),
    settle: 600,
  },
  { name: "zehirli-used", q: "mock=zehirli-used&n=6" },
  { name: "zehirli-spectator", q: "mock=zehirli-spectator&n=5" },
  { name: "zehirli-reveal-6", q: "mock=zehirli-reveal&n=6", settle: 2400 },
  {
    name: "zehirli-reveal-poison-8",
    q: "mock=zehirli-reveal&n=8&poison=1",
    settle: 2400,
    sizes: [
      [390, 844],
      [430, 932],
      [844, 390],
      [667, 375],
    ],
  },
  { name: "zehirli-reveal-poison-5", q: "mock=zehirli-reveal&n=5&poison=1", settle: 2400 },
  { name: "zehirli-reveal-2", q: "mock=zehirli-reveal&n=2", settle: 2400 },
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
      // Kaydırma alanının kenarında yarım kalan metin: kutusunun dışı başka öğeyle örtülüdür, kontrast ölçülemez.
      if (r.top < sr.top - 1 || r.bottom > sr.bottom + 1) continue;
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
