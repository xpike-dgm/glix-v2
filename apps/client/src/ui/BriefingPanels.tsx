import { type Accessor, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { reducedMotion } from "../fx/motion.js";
import { BRIEFING_PANELS, briefingAllowed, briefingSrc } from "./briefingArt.js";

const STEP_MS = 2200;
const PANELS = Array.from({ length: BRIEFING_PANELS }, (_, i) => i);

/**
 * Anlatımın 3 karelik çizgi romanı: yumuşak geçişle kendiliğinden ilerler, dokununca sonrakine geçer.
 * Azaltılmış harekette kendiliğinden ilerlemez. Görsel yüklenemezse `fallback` (çizim) görünür.
 */
export function BriefingPanels(props: {
  gameId: string;
  index: Accessor<number>;
  onIndex: (i: number) => void;
  fallback: () => unknown;
}) {
  const allowed = briefingAllowed();
  const [failed, setFailed] = createSignal(false);
  let timer: ReturnType<typeof setInterval> | undefined;
  const still = (): boolean => reducedMotion();
  const advance = (): void => props.onIndex((props.index() + 1) % BRIEFING_PANELS);
  const restart = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = still() ? undefined : setInterval(advance, STEP_MS);
  };
  onMount(restart);
  onCleanup(() => {
    if (timer !== undefined) clearInterval(timer);
  });

  return (
    <Show when={allowed && !failed()} fallback={<>{props.fallback()}</>}>
      <button
        type="button"
        class="panels"
        aria-label="Sonraki kare"
        onClick={() => {
          advance();
          restart();
        }}
      >
        <span class="panels__frame">
          <For each={PANELS}>
            {(i) => (
              <img
                class="panels__img"
                data-on={props.index() === i ? "1" : undefined}
                src={briefingSrc(props.gameId, i + 1)}
                alt=""
                aria-hidden="true"
                decoding="async"
                draggable={false}
                width="720"
                height="540"
                onError={() => setFailed(true)}
              />
            )}
          </For>
        </span>
        <span class="panels__dots" aria-hidden="true">
          <For each={PANELS}>{(i) => <i data-on={props.index() === i ? "1" : undefined} />}</For>
        </span>
      </button>
    </Show>
  );
}
