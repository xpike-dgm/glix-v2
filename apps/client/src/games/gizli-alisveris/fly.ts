import { reducedMotion } from "../../fx/motion.js";

/** Görselin küçük kopyası bir noktadan ötekine yay çizerek uçar (yalnız transform/opacity). */
export function fly(from: Element | null | undefined, to: Element | null | undefined, back = false): void {
  if (!from || !to || reducedMotion() || typeof document === "undefined") return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return;
  const ghost = from.cloneNode(true) as HTMLElement;
  ghost.classList.add("gafly");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    left: `${a.left}px`,
    top: `${a.top}px`,
    width: `${a.width}px`,
    height: `${a.height}px`,
  });
  document.body.appendChild(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const s = Math.max(0.2, Math.min(1, b.height / Math.max(1, a.height)));
  const lift = back ? 30 : -60;
  const anim = ghost.animate(
    [
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(${(1 + s) / 2})`, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: back ? 0.2 : 0.9 },
    ],
    { duration: back ? 380 : 460, easing: "cubic-bezier(.3,.7,.4,1)" },
  );
  anim.onfinish = () => ghost.remove();
  anim.oncancel = () => ghost.remove();
}
