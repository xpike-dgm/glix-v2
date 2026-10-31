import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { headOf, largestFit, overflows } from "./fit.js";

interface Props {
  text: string;
  /** En büyük ve en küçük yazı boyutu (px). */
  max: number;
  min?: number;
  /** Daktilo: görünen harf sayısı; verilmezse hepsi. Yerleşim her zaman tam metinle ölçülür (zıplama yok). */
  typed?: number;
  class?: string;
}

/**
 * Kartın içine sığan yazı: kelime ortasından bölünmez, kutuya sığana kadar küçülür (BT-U2). Kutuyu (ebeveyni)
 * doldurur; boyutu ebeveyn belirler.
 */
export function FitText(props: Props) {
  let outer: HTMLDivElement | undefined;
  let inner: HTMLSpanElement | undefined;
  const [size, setSize] = createSignal(props.max);
  const [broken, setBroken] = createSignal(false);

  const refit = (): void => {
    if (!outer || !inner || outer.clientWidth < 4 || outer.clientHeight < 4) return;
    const el = inner;
    const box = outer;
    const min = props.min ?? 12;
    el.dataset.break = "";
    const best = largestFit(
      (s) => {
        el.style.fontSize = `${s}px`;
        return !overflows(el, box);
      },
      min,
      props.max,
    );
    el.style.fontSize = `${best}px`;
    // En küçük boyutta bile sığmayan tek uzun kelime: son çare harf sınırında kırılır.
    const lastResort = overflows(el, box);
    el.dataset.break = lastResort ? "1" : "";
    setBroken(lastResort);
    setSize(best);
  };

  onMount(() => {
    refit();
    const ro = new ResizeObserver(() => refit());
    if (outer) ro.observe(outer);
    onCleanup(() => ro.disconnect());
    // Yazı tipi geç yüklenirse yeniden ölç.
    void document.fonts?.ready.then(() => refit());
  });
  createEffect(on([() => props.text, () => props.max], () => refit(), { defer: true }));

  const shown = () => (props.typed === undefined ? props.text : headOf(props.text, props.typed));
  const rest = () => (props.typed === undefined ? "" : props.text.slice(shown().length));

  return (
    <div class={`fit ${props.class ?? ""}`} ref={outer}>
      <span
        class="fit__in"
        ref={inner}
        style={{ "font-size": `${size()}px` }}
        data-break={broken() ? "1" : undefined}
      >
        <span>{shown()}</span>
        {rest() ? (
          <span class="fit__ghost" aria-hidden="true">
            {rest()}
          </span>
        ) : null}
      </span>
      {props.typed !== undefined && rest() ? <span class="sr-only">{props.text}</span> : null}
    </div>
  );
}
