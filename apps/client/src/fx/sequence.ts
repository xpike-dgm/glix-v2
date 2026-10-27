import { type Accessor, createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { serverNow } from "../net/store.js";
import { reducedMotion } from "./motion.js";
import "./sequence.css";
import { nextStepDelay, sequenceTiming, stepsShown } from "./sequenceTiming.js";

export interface Sequence {
  /** Şu ana dek görünen adım sayısı (0..steps). */
  shown: Accessor<number>;
  /** Dizi bitti (ya da hiç oynatılmayacak). */
  done: Accessor<boolean>;
  /** Adım `i` için `data-seq` değeri: dizi hiç oynamıyorsa (azaltılmış hareket, yeniden bağlanma) undefined. */
  attr: (step: number) => "in" | "out" | undefined;
  /** Son adıma atla (ekrana dokunmak da aynı işi görür). */
  skip: () => void;
}

interface Options {
  /** Adım sayısı. */
  steps: Accessor<number>;
  /** Açılış aşamasının sunucu saatiyle başlangıcı (ms). */
  startAt: Accessor<number>;
  /** Açılış aşamasının toplam süresi (ms); vuruşlar buna sığar. */
  budgetMs: Accessor<number>;
}

/**
 * Sıralı açılış: adımlar sunucu saatine göre birer vuruşla görünür. Yeniden bağlanan oyuncu kaldığı yerden
 * devam eder; aşama zaten ilerlemişse ya da hareket azaltılmışsa her şey bir arada gösterilir.
 */
export function createSequence(o: Options): Sequence {
  const [skipped, setSkipped] = createSignal(false);
  const initial = untrack(() => {
    const n = o.steps();
    return (
      n > 0 &&
      !reducedMotion() &&
      stepsShown(serverNow() - o.startAt(), n, sequenceTiming(n, o.budgetMs())) < n
    );
  });
  const [shown, setShown] = createSignal(initial ? 0 : untrack(o.steps));
  const [animated] = createSignal(initial);

  createEffect(() => {
    const n = o.steps();
    const start = o.startAt();
    const t = sequenceTiming(n, o.budgetMs());
    if (n <= 0 || skipped() || !animated() || reducedMotion()) {
      setShown(n);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = (): void => {
      const elapsed = serverNow() - start;
      setShown(stepsShown(elapsed, n, t));
      const d = nextStepDelay(elapsed, n, t);
      if (d !== null) timer = setTimeout(tick, d);
    };
    untrack(tick);
    onCleanup(() => clearTimeout(timer));
  });

  // Ekranın herhangi bir yerine dokunmak diziyi sona atlatır.
  onMount(() => {
    const onTap = (): void => {
      setSkipped(true);
    };
    window.addEventListener("pointerdown", onTap, { passive: true });
    onCleanup(() => window.removeEventListener("pointerdown", onTap));
  });

  return {
    shown,
    done: () => shown() >= o.steps(),
    attr: (step) => (animated() ? (shown() > step ? "in" : "out") : undefined),
    skip: () => {
      setSkipped(true);
    },
  };
}
