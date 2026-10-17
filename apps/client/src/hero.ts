/** Pixi sahnesi: birkaç neon daire. Pixi tembel yüklenir. Durdurma işlevi döner. */
export async function mountHero(host: HTMLElement): Promise<() => void> {
  const { Application, Graphics } = await import("pixi.js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });
  host.appendChild(app.canvas);

  const colors = [0x22e4ff, 0xff2bd6, 0x7c5cff];
  const orbs = Array.from({ length: 7 }, (_, i) => {
    const g = new Graphics();
    const r = 14 + ((i * 11) % 26);
    g.circle(0, 0, r).stroke({ width: 3, color: colors[i % colors.length] ?? 0x22e4ff, alpha: 0.9 });
    g.circle(0, 0, r * 0.45).fill({ color: colors[(i + 1) % colors.length] ?? 0xff2bd6, alpha: 0.35 });
    app.stage.addChild(g);
    return {
      g,
      phase: i * 0.9,
      speed: 0.4 + (i % 3) * 0.25,
      ax: 0.15 + (i % 4) * 0.1,
      ay: 0.12 + (i % 3) * 0.08,
    };
  });

  const place = (t: number): void => {
    const w = app.screen.width;
    const h = app.screen.height;
    orbs.forEach((o, i) => {
      o.g.x = w * (0.5 + (i - 3) * 0.12 + Math.sin(t * o.speed + o.phase) * o.ax * 0.5);
      o.g.y = h * (0.5 + Math.cos(t * o.speed * 0.8 + o.phase) * o.ay * 1.6);
    });
  };

  let t = 0;
  place(0);
  if (!reduced) {
    app.ticker.add((tk) => {
      t += tk.deltaMS / 1000;
      place(t);
    });
  } else {
    app.ticker.stop();
    app.renderer.on("resize", () => place(0));
    app.render();
  }
  return () => app.destroy(true, { children: true });
}
