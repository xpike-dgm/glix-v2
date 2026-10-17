import type { KaralamaStroke } from "@glix/engine";
import { createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { paintAll } from "./draw.js";

interface Props {
  strokes: readonly KaralamaStroke[];
  /** Çizim değişince değişen kısa anahtar; aynıysa yeniden çizilmez. */
  version: string;
  halo?: boolean;
  class?: string;
}

/** Yalnız gösterim: karanlık tahta üzerinde darbelerin tekrarı. Kutuyu doldurur (kare). */
export function DrawingCanvas(props: Props) {
  let box: HTMLDivElement | undefined;
  let canvas: HTMLCanvasElement | undefined;
  const [px, setPx] = createSignal(0);

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

  createEffect(() => {
    const size = px();
    void props.version;
    if (!canvas || size < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const backing = Math.round(size * dpr);
    if (canvas.width !== backing) {
      canvas.width = backing;
      canvas.height = backing;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    untrack(() => paintAll(ctx, props.strokes, size, backing / size, props.halo ?? true));
  });

  return (
    <div class={`kd__thumb ${props.class ?? ""}`} ref={box}>
      <canvas ref={canvas} />
    </div>
  );
}
