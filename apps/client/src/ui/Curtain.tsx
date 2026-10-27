import { createEffect, createSignal, For, on, onCleanup } from "solid-js";
import { CURTAIN_MS, shouldSweep } from "../fx/curtain.js";
import { reducedMotion } from "../fx/motion.js";
import type { ScreenId } from "../screens/route.js";

/**
 * Geçiş perdesi: anlatım → geri sayım → oyun → sonuç arasında tek, tutarlı neon çapraz ışık süpürmesi (~450 ms).
 * Yalnız görseldir: `pointer-events: none`, ekran değişimini ve sunucu zamanlı aşamaları geciktirmez
 * (yeni ekran hemen yerindedir, perde üstünden geçer). Hareket azaltmada hiç çizilmez.
 */
export function Curtain(props: { screen: ScreenId }) {
  const [sweeps, setSweeps] = createSignal<number[]>([]);
  let n = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  createEffect(
    on(
      () => props.screen,
      (cur, prev) => {
        if (!shouldSweep(prev, cur) || reducedMotion()) return;
        const id = ++n;
        setSweeps((s) => [...s, id]);
        const t = setTimeout(() => {
          timers.delete(t);
          setSweeps((s) => s.filter((x) => x !== id));
        }, CURTAIN_MS + 80);
        timers.add(t);
      },
    ),
  );
  onCleanup(() => {
    for (const t of timers) clearTimeout(t);
  });
  return <For each={sweeps()}>{() => <div class="curtain" aria-hidden="true" />}</For>;
}
