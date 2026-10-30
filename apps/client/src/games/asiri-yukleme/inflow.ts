/**
 * Dokunulan noktadan çekirdeğe akan küçük ışık parçacıkları. Düğümler bir kez üretilir ve yeniden kullanılır
 * (havuz); havuz doluysa yeni parçacık atlanır. Yalnız transform/opacity canlandırılır (eski telefonlarda akıcı).
 */
export const INFLOW_POOL = 24;
export const INFLOW_PER_TAP = 4;
const COLORS = ["#2ef2ff", "#ffffff", "#b6ff3b", "#9be8ff"];

export interface Inflow {
  /** (x, y) dokunulan nokta, (cx, cy) çekirdek merkezi; ikisi de kapsayıcıya göre px. */
  emit(x: number, y: number, cx: number, cy: number): void;
  dispose(): void;
}

export function createInflow(host: HTMLElement, size = INFLOW_POOL): Inflow {
  const free: HTMLElement[] = [];
  const all: HTMLElement[] = [];
  for (let i = 0; i < size; i++) {
    const el = document.createElement("i");
    el.className = "ay__mote";
    el.style.background = COLORS[i % COLORS.length] ?? "#2ef2ff";
    host.appendChild(el);
    free.push(el);
    all.push(el);
  }
  return {
    emit(x, y, cx, cy) {
      const vx = cx - x;
      const vy = cy - y;
      const len = Math.hypot(vx, vy) || 1;
      // Dik yönde hafif kavis: parçacıklar düz değil, yay çizerek akar.
      const nx = -vy / len;
      const ny = vx / len;
      for (let i = 0; i < INFLOW_PER_TAP; i++) {
        const el = free.pop();
        if (!el) return;
        const jx = (Math.random() - 0.5) * 22;
        const jy = (Math.random() - 0.5) * 22;
        const bend = (Math.random() - 0.5) * Math.min(90, len * 0.5);
        const sx = x + jx;
        const sy = y + jy;
        const mx = sx + vx * 0.5 + nx * bend;
        const my = sy + vy * 0.5 + ny * bend;
        const a = el.animate(
          [
            { transform: `translate(${sx}px,${sy}px) scale(1.1)`, opacity: 0 },
            { transform: `translate(${sx}px,${sy}px) scale(1.1)`, opacity: 1, offset: 0.08 },
            { transform: `translate(${mx}px,${my}px) scale(0.9)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${cx}px,${cy}px) scale(0.3)`, opacity: 0 },
          ],
          { duration: 360 + Math.random() * 160, delay: i * 18, easing: "cubic-bezier(.5,0,.8,.6)" },
        );
        const done = (): void => {
          free.push(el);
        };
        a.onfinish = done;
        a.oncancel = done;
      }
    },
    dispose() {
      for (const el of all) {
        for (const a of el.getAnimations()) a.cancel();
        el.remove();
      }
      free.length = 0;
      all.length = 0;
    },
  };
}
