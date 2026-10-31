import type { KaralamaStroke } from "@glix/engine";
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { paintAll } from "../karalama-defteri/draw.js";
import { replayFrame, replayMs } from "./replay.js";

interface Props {
  strokes: readonly KaralamaStroke[];
  /** Çizim değişince değişen kısa anahtar. */
  version: string;
  /** Doğruysa (ilk görünüşte) çizim darbe sırasıyla hızlandırılmış yeniden çizilir; yanlışsa bitmiş hâli. */
  play: boolean;
  /** Yeniden çizim sürerken her karede (ses için). */
  onDraw?: () => void;
  class?: string;
}

/**
 * Çizimi tek bir canvas'ta gösterir; `play` açıksa requestAnimationFrame ile en çok 1,5 sn'de yeniden çizer.
 * Silinen/geri alınan çizgiler hiç görünmez. Hareket azaltmada yeniden çizim atlanır, son hâl gösterilir.
 */
export function Replay(props: Props) {
  let box: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const [px, setPx] = createSignal(0);
  let raf = 0;
  let played = false;

  const paint = (strokes: readonly KaralamaStroke[]): void => {
    const size = px();
    if (!canvas || size < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const backing = Math.round(size * dpr);
    if (canvas.width !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) paintAll(ctx, strokes, size, backing / size);
  };

  onMount(() => {
    if (!box) return;
    const read = (): void => {
      setPx(Math.round(box?.clientWidth ?? 0));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(box);
    onCleanup(() => ro.disconnect());
  });
  onCleanup(() => cancelAnimationFrame(raf));

  const start = (): void => {
    cancelAnimationFrame(raf);
    raf = 0;
    const total = replayMs(props.strokes);
    if (reducedMotion() || total === 0) {
      paint(props.strokes);
      return;
    }
    const strokes = props.strokes;
    const t0 = performance.now();
    const frame = (t: number): void => {
      const f = Math.min(1, (t - t0) / total);
      paint(replayFrame(strokes, f));
      props.onDraw?.();
      raf = f < 1 ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
  };

  createEffect(
    on([px, () => props.version, () => props.play], ([size]) => {
      if (size < 2) return;
      if (props.play && !played) {
        played = true;
        start();
        return;
      }
      if (!raf) paint(props.strokes);
    }),
  );

  return (
    <div class={`kd__thumb ${props.class ?? ""}`} ref={box}>
      <canvas ref={canvas} />
    </div>
  );
}
