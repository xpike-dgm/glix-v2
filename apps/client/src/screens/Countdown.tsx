import type { MatchSnapshot } from "@glix/engine";
import { createEffect, createMemo, on, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { go, tick } from "../fx/sound.js";
import { createServerNow } from "../net/time.js";
import { Screen } from "../ui/Screen.js";

export function Countdown(props: { match: MatchSnapshot }) {
  const now = createServerNow(40);
  const n = createMemo(() => {
    const end = props.match.phaseEndsAt;
    if (end === null) return 3;
    return Math.max(1, Math.min(3, Math.ceil((end - now()) / 1000)));
  });
  onMount(() => tick());
  createEffect(
    on(
      n,
      (v, prev) => {
        if (prev === undefined) return;
        if (v < prev) {
          tick();
          hapticTap();
        }
      },
      { defer: true },
    ),
  );
  const over = () => props.match.phaseEndsAt !== null && now() >= props.match.phaseEndsAt;
  createEffect(on(over, (o) => o && go(), { defer: true }));

  return (
    <Screen class="countdown">
      <div class="count__stack">
        <p class="overline">{props.match.gameName}</p>
        <div class="count__stage" aria-live="assertive">
          <Show when={n()} keyed>
            {(v) => (
              <div class="count__num" data-n={v}>
                <span class="count__wave" />
                <span class="count__digit">{v}</span>
              </div>
            )}
          </Show>
        </div>
        <p class="lead">Hazır ol!</p>
      </div>
    </Screen>
  );
}
