/**
 * Çekirdeğin dokunuş tepkisi (Web Animations; DOM düğümü üretmez):
 * - gövde kısa bir an içe çöker ve geri esner;
 * - halkalar dokunulan yönden itilir: önce iç halka, az sonra dış halka (dalga);
 * - seri ritminde çekirdeğin çevresinde tek bir halka vuruşu.
 * Her öğede aynı anda tek animasyon tutulur (yenisi eskisini keser).
 */
export interface CoreFx {
  /** (dx, dy): çekirdek merkezinden dokunulan noktaya birim yön (merkeze dokunuşta 0,0). */
  poke(dx: number, dy: number, strength: number): void;
  beat(): void;
}

/** Çekirdek merkezinden noktaya birim yön; merkez çok yakınsa (0,0). Saf. */
export function pokeDirection(cx: number, cy: number, x: number, y: number): { dx: number; dy: number } {
  const vx = x - cx;
  const vy = y - cy;
  const len = Math.hypot(vx, vy);
  return len < 6 ? { dx: 0, dy: 0 } : { dx: vx / len, dy: vy / len };
}

export function createCoreFx(root: HTMLElement): CoreFx {
  const body = root.querySelector<HTMLElement>(".ay-core__body");
  const mid = root.querySelector<HTMLElement>(".ay-core__ringbox--mid");
  const outer = root.querySelector<HTMLElement>(".ay-core__ringbox--outer");
  const ring = root.querySelector<HTMLElement>(".ay-core__beat");
  const running = new Map<HTMLElement, Animation>();
  const run = (el: HTMLElement | null, frames: Keyframe[], opts: KeyframeAnimationOptions): void => {
    if (!el || typeof el.animate !== "function") return;
    running.get(el)?.cancel();
    const a = el.animate(frames, opts);
    running.set(el, a);
    a.onfinish = () => {
      if (running.get(el) === a) running.delete(el);
    };
  };
  return {
    poke(dx, dy, strength) {
      const k = Math.max(0.6, Math.min(1.4, strength));
      // Parmak çekirdeği iter: gövde dokunuşun tersine kayar, içe çöker, geri esner.
      const px = -dx * 5 * k;
      const py = -dy * 5 * k;
      run(
        body,
        [
          { transform: "translate(0,0) scale(1)" },
          { transform: `translate(${px}px,${py}px) scale(${1 - 0.09 * k})`, offset: 0.28 },
          { transform: `translate(${-px * 0.3}px,${-py * 0.3}px) scale(${1 + 0.035 * k})`, offset: 0.62 },
          { transform: "translate(0,0) scale(1)" },
        ],
        { duration: 260, easing: "ease-out" },
      );
      const ripple = (el: HTMLElement | null, amp: number, delay: number): void =>
        run(
          el,
          [
            { transform: "translate(0,0) scale(1)" },
            {
              transform: `translate(${-dx * amp * k}px,${-dy * amp * k}px) scale(${1 - 0.025 * k})`,
              offset: 0.35,
            },
            {
              transform: `translate(${dx * amp * 0.35 * k}px,${dy * amp * 0.35 * k}px) scale(1.01)`,
              offset: 0.7,
            },
            { transform: "translate(0,0) scale(1)" },
          ],
          { duration: 340, delay, easing: "ease-out" },
        );
      ripple(mid, 7, 0);
      ripple(outer, 9, 60);
    },
    beat() {
      run(
        ring,
        [
          { transform: "scale(0.72)", opacity: 0.95 },
          { transform: "scale(1.32)", opacity: 0 },
        ],
        { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    },
  };
}
