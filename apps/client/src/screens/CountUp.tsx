import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { reducedMotion } from "../fx/motion.js";

/** "+N" rozeti: sayım başlayıp değer 0'ın üstüne çıkınca belirir (asla "+0" göstermez), sonra N'e dek artar. */
export function CountUp(props: { to: number; delay?: number; duration?: number }) {
  const reduced = reducedMotion();
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
    <Show when={v() > 0}>
      <span class="award" data-done={done() ? "1" : undefined}>
        +{v()}
      </span>
    </Show>
  );
}
