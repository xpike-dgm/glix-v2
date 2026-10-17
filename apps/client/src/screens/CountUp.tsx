import { createSignal, onCleanup, onMount } from "solid-js";

/** "+N" rozeti: 0'dan N'e sayarak artar. */
export function CountUp(props: { to: number; delay?: number; duration?: number }) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [v, setV] = createSignal(reduced ? props.to : 0);
  const [done, setDone] = createSignal(reduced);
  onMount(() => {
    if (reduced) return;
    const dur = props.duration ?? 650;
    let raf = 0;
    const timer = setTimeout(() => {
      const t0 = performance.now();
      const step = (t: number): void => {
        const p = Math.min(1, (t - t0) / dur);
        setV(Math.round(props.to * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(step);
        else setDone(true);
      };
      raf = requestAnimationFrame(step);
    }, props.delay ?? 400);
    onCleanup(() => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    });
  });
  return (
    <span class="award" data-done={done() ? "1" : undefined}>
      +{v()}
    </span>
  );
}
