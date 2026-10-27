import type { MatchSnapshot } from "@glix/engine";
import { createMemo, Show } from "solid-js";
import { createServerNow } from "../net/time.js";

/** Geri sayım: 3-2-1 dev rakamlarla. */
export function TvCountdown(props: { match: MatchSnapshot }) {
  const now = createServerNow(40);
  const n = createMemo(() => {
    const end = props.match.phaseEndsAt;
    if (end === null) return 3;
    return Math.max(1, Math.min(3, Math.ceil((end - now()) / 1000)));
  });
  return (
    <main class="tv__count">
      <p class="tv__overline">{props.match.gameName}</p>
      <div class="tv__countnum" aria-live="assertive">
        <Show when={n()} keyed>
          {(v) => <span class="tv__countdigit">{v}</span>}
        </Show>
      </div>
      <p class="tv__lead">Telefonlarınızı hazırlayın!</p>
    </main>
  );
}
