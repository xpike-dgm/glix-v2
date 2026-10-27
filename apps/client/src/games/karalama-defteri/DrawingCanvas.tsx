import type { KaralamaStroke } from "@glix/engine";
import { createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { reducedMotion } from "../../fx/motion.js";
import { paintAll, REPLAY_MS, strokesUpTo } from "./draw.js";

interface Props {
  strokes: readonly KaralamaStroke[];
  /** Çizim değişince değişen kısa anahtar; aynıysa yeniden çizilmez. */
  version: string;
  halo?: boolean;
  /**
   * Tekrar sayacı: 0 ya da verilmezse çizim hazır görünür; sayaç her değiştiğinde (0'dan büyükse) çizim
   * hızla baştan çizilir. Hareket azaltma açıksa bitmiş resim gösterilir.
   */
  replay?: number;
  class?: string;
}

/** Yalnız gösterim: karanlık tahta üzerinde darbelerin tekrarı. Kutuyu doldurur (kare). */
export function DrawingCanvas(props: Props) {
  let box: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const [px, setPx] = createSignal(0);
  let raf = 0;
  let playedToken = 0;

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

  const paint = (strokes: readonly KaralamaStroke[]): void => {
    const size = px();
    if (!canvas || size < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const backing = Math.round(size * dpr);
    if (canvas.width !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) paintAll(ctx, strokes, size, backing / size, props.halo ?? true);
  };

  createEffect(() => {
    const token = props.replay ?? 0;
    const size = px();
    if (token === 0 || token === playedToken || size < 2) return;
    playedToken = token;
    untrack(() => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (reducedMotion() || props.strokes.length === 0) {
        paint(props.strokes);
        return;
      }
      const t0 = performance.now();
      const frame = (t: number): void => {
        const f = Math.min(1, (t - t0) / REPLAY_MS);
        paint(strokesUpTo(props.strokes, f));
        raf = f < 1 ? requestAnimationFrame(frame) : 0;
      };
      raf = requestAnimationFrame(frame);
    });
  });

  createEffect(() => {
    px();
    void props.version;
    // Tekrar sürerken kare kare çizim üzerine yazmasın; bitince son resim zaten çizilir.
    if (raf) return;
    untrack(() => paint(props.strokes));
  });

  return (
    <div class={`kd__thumb ${props.class ?? ""}`} ref={box}>
      <canvas ref={canvas} />
    </div>
  );
}
