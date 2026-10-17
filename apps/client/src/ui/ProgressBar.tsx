import { onCleanup, onMount } from "solid-js";

interface Props {
  startedAt: number;
  endsAt: number;
  /** Sunucu saati. */
  now: () => number;
  /** Son kısımda renk değişsin (oyun süresi için). */
  urgency?: boolean;
  class?: string;
}

/** İnce süre çubuğu: tek öğe, rAF ile `scaleX`. */
export function ProgressBar(props: Props) {
  let fill: HTMLDivElement | undefined;
  let raf = 0;
  const frame = (): void => {
    const total = Math.max(1, props.endsAt - props.startedAt);
    const left = Math.min(1, Math.max(0, (props.endsAt - props.now()) / total));
    if (fill) {
      fill.style.transform = `scaleX(${left})`;
      if (props.urgency) fill.dataset.tone = left < 0.12 ? "red" : left < 0.3 ? "amber" : "";
    }
    raf = requestAnimationFrame(frame);
  };
  onMount(() => {
    frame();
  });
  onCleanup(() => cancelAnimationFrame(raf));
  return (
    <div class={`pbar ${props.class ?? ""}`} role="progressbar" aria-hidden="true">
      <div class="pbar__fill" ref={fill} />
    </div>
  );
}
