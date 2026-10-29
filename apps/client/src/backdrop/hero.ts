import { APP_VIEW_ONLY, loadPixi } from "../fx/pixiLoad.js";

/** Az çekirdekli / az belekli cihazlarda parçacık sayısı düşer. */
const lowEnd = (): boolean =>
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

const COLORS = [0x2ef2ff, 0xff2bd6, 0x8b5cff, 0x2ef2ff, 0xb6ff3b];

/** Zemin, ilk ekranın görünür içeriğini (logo, yazı tipleri) geciktirmesin diye en çok bu kadar beklenir. */
const CALM_CAP_MS = 10_000;

/**
 * Logo ve yazı tipleri inene dek (ve tarayıcı boşa çıkana dek) bekler. Pixi + yan parçalar ≈250 KB (gz) olduğundan
 * yavaş ağda hemen başlarsa logo ve karakterler onunla aynı hatta yarışır (ölçüm: yavaş 3G'de logo 18 sn). Süre sınırı
 * aşılırsa yine de başlar; görünüm değişmez, yalnız parçacıklar biraz sonra gelir.
 */
export function whenCalm(host: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = (): void => {
      if (done) return;
      done = true;
      clearTimeout(cap);
      const idle = (
        window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      ).requestIdleCallback;
      if (idle) idle.call(window, () => resolve(), { timeout: 1000 });
      else setTimeout(resolve, 0);
    };
    const cap = setTimeout(go, CALM_CAP_MS);
    const logo = host.ownerDocument.querySelector<HTMLImageElement>(".wordmark__img");
    const logoReady =
      !logo || logo.complete
        ? Promise.resolve()
        : new Promise<void>((r) => {
            logo.addEventListener("load", () => r(), { once: true });
            logo.addEventListener("error", () => r(), { once: true });
          });
    const fontsReady = host.ownerDocument.fonts?.ready ?? Promise.resolve();
    void Promise.all([logoReady, fontsReady]).then(go, go);
  });
}

/**
 * Ana sayfa arka planı: yavaş akan neon partiküller + ufuktaki ızgara. 30 fps sınırı, sekme gizliyken durur.
 * Pixi tembel yüklenir. Durdurma işlevi döner.
 */
export async function mountBackdrop(host: HTMLElement): Promise<() => void> {
  const { Application, Graphics, Sprite } = await loadPixi();
  const app = new Application();
  try {
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: false,
      preference: "webgl",
      powerPreference: "low-power",
      // Bulanık noktalar ve ince çizgiler için 1,5x yeter; 3x ekranlarda dolgu maliyeti 4 kat azalır.
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      autoDensity: true,
    });
  } catch (err) {
    // Başlatma yarıda kaldıysa çizim bağlamı (GPU) sızmasın.
    try {
      app.destroy(APP_VIEW_ONLY, { children: true });
    } catch {
      // başlatılamamış uygulama zaten yıkılmış olabilir
    }
    throw err;
  }
  app.ticker.maxFPS = 30;
  host.appendChild(app.canvas);

  const grid = new Graphics();
  app.stage.addChild(grid);

  const dot = new Graphics();
  dot.circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.18 });
  dot.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 1 });
  const texture = app.renderer.generateTexture(dot);
  dot.destroy();

  const parts = Array.from({ length: lowEnd() ? 20 : 34 }, (_, i) => {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.tint = COLORS[i % COLORS.length] ?? 0x2ef2ff;
    app.stage.addChild(s);
    return {
      s,
      x: Math.random(),
      y: Math.random(),
      v: 0.012 + Math.random() * 0.03,
      sway: 0.01 + Math.random() * 0.025,
      ph: Math.random() * 6.28,
      sc: 0.35 + Math.random() * 0.9,
      a: 0.25 + Math.random() * 0.6,
    };
  });

  let t = 0;
  const draw = (): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    const horizon = h * 0.66;
    grid.clear();
    // dikey çizgiler ufuk noktasından yayılır
    for (let i = -9; i <= 9; i++) {
      grid.moveTo(w / 2 + i * w * 0.012, horizon).lineTo(w / 2 + i * w * 0.2, h);
    }
    grid.stroke({ width: 1, color: 0x8b5cff, alpha: 0.28 });
    // yatay çizgiler izleyiciye doğru akar
    const rows = 9;
    for (let k = 0; k < rows; k++) {
      const p = (k + ((t * 0.18) % 1)) / rows;
      const y = horizon + (h - horizon) * p * p;
      grid.moveTo(0, y).lineTo(w, y);
    }
    grid.stroke({ width: 1, color: 0x8b5cff, alpha: 0.32 });
    grid.moveTo(0, horizon).lineTo(w, horizon).stroke({ width: 1.5, color: 0x2ef2ff, alpha: 0.4 });
    for (const p of parts) {
      const yy = (((p.y - t * p.v) % 1) + 1) % 1;
      p.s.x = (p.x + Math.sin(t * 0.4 + p.ph) * p.sway) * w;
      p.s.y = yy * h;
      p.s.scale.set(p.sc);
      p.s.alpha = p.a * Math.min(1, yy * 6, (1 - yy) * 6);
    }
  };

  app.ticker.add((tk) => {
    t += tk.deltaMS / 1000;
    draw();
  });
  draw();

  const onVis = (): void => {
    if (document.hidden) app.ticker.stop();
    else app.ticker.start();
  };
  document.addEventListener("visibilitychange", onVis);
  if (document.hidden) app.ticker.stop();

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    app.destroy(APP_VIEW_ONLY, { children: true, texture: true });
  };
}
