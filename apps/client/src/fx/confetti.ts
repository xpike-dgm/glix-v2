import { reducedMotion } from "./motion.js";

const lowEnd = (): boolean =>
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

const SHEET = "/assets/fx/konfeti.webp";
const SHEET_FRAMES = 8;
const SHEET_CELL = 256;
const COLORS = [0x2ef2ff, 0xff2bd6, 0xffc23b, 0xb6ff3b, 0x8b5cff, 0xff8a3b, 0x2bffa8, 0x3b7bff];

/** 2 sn'lik Pixi konfetisi; bitince kendini yok eder. Pixi tembel yüklenir. Durdurma işlevi döner. */
export async function playConfetti(host: HTMLElement): Promise<() => void> {
  if (reducedMotion()) return () => {};
  const { Application, Assets, Graphics, Rectangle, Sprite, Texture } = await import("pixi.js");
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: false,
    preference: "webgl",
    resolution: Math.min(window.devicePixelRatio || 1, 1.5),
    autoDensity: true,
  });
  host.appendChild(app.canvas);
  const w = app.screen.width;
  const h = app.screen.height;

  // Konfeti şeridi (8 parça, 256 px); yüklenemezse düz dikdörtgenlere dönülür.
  let pieces: InstanceType<typeof Texture>[] = [];
  let sheetLoaded = false;
  try {
    const sheet = await Assets.load<InstanceType<typeof Texture>>(SHEET);
    sheetLoaded = true;
    pieces = Array.from(
      { length: SHEET_FRAMES },
      (_, i) =>
        new Texture({
          source: sheet.source,
          frame: new Rectangle(i * SHEET_CELL, 0, SHEET_CELL, SHEET_CELL),
        }),
    );
  } catch {
    pieces = [];
  }

  const bits = Array.from({ length: lowEnd() ? 80 : 130 }, (_, i) => {
    const tex = pieces[i % SHEET_FRAMES];
    const g = tex ? new Sprite(tex) : new Graphics();
    if (g instanceof Sprite) {
      g.anchor.set(0.5);
      g.scale.set((22 + Math.random() * 12) / SHEET_CELL);
    } else {
      const bw = 6 + Math.random() * 6;
      g.rect(-bw / 2, -bw / 4, bw, bw / 2).fill(COLORS[i % COLORS.length] ?? 0xffffff);
    }
    g.x = w / 2 + (Math.random() - 0.5) * w * 0.3;
    g.y = h * 0.28;
    app.stage.addChild(g);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
    const sp = 380 + Math.random() * 520;
    return { g, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vr: (Math.random() - 0.5) * 14 };
  });

  let t = 0;
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    app.destroy(true, { children: true });
    // Eski iPhone belleği: parçalar ve şerit görseli GPU'dan bırakılır (bir sonraki finalde yeniden yüklenir).
    for (const piece of pieces) piece.destroy(false);
    if (sheetLoaded) void Assets.unload(SHEET).catch(() => undefined);
  };
  app.ticker.add((tk) => {
    const dt = tk.deltaMS / 1000;
    t += dt;
    for (const b of bits) {
      b.vy += 900 * dt;
      b.vx *= 0.992;
      b.g.x += b.vx * dt;
      b.g.y += b.vy * dt;
      b.g.rotation += b.vr * dt;
      b.g.alpha = Math.max(0, Math.min(1, (2.2 - t) / 0.6));
    }
    if (t > 2.2) dispose();
  });
  return dispose;
}
