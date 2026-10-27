import { KARALAMA_DRAW_MS } from "@glix/engine";
import { createSignal, onCleanup, Show } from "solid-js";
import { PhaseClock } from "../../ui/PhaseClock.js";
import type { KaralamaScreenView } from "./view.js";
import { shownWord } from "./view.js";

interface Props {
  view: KaralamaScreenView;
  now: () => number;
  /** "draw": süre drawEndsAt'e, "vote": voteEndsAt'e kadar. */
  phase?: "draw" | "vote";
  /** Kelime yerine gösterilecek başlık (izleyici ya da oylama). */
  title?: string;
}

/** Üst şerit: kelime (bilgisizde "yakın sinyal" etiketiyle), süre çubuğu ve kalan saniye. */
export function Header(props: Props) {
  const phase = () => props.phase ?? "draw";
  const endsAt = () => (phase() === "draw" ? props.view.drawEndsAt : props.view.voteEndsAt);
  const startedAt = () =>
    phase() === "draw" ? props.view.drawEndsAt - KARALAMA_DRAW_MS : props.view.drawEndsAt;

  // "Yakın sinyal" etiketi kısa süre görünür, sonra söner.
  const [signal, setSignal] = createSignal(true);
  const hide = setTimeout(() => setSignal(false), 7_000);
  onCleanup(() => clearTimeout(hide));

  const word = () => props.view.word;
  const long = () => word()?.length ?? 0;
  return (
    <>
      <header class="kd__top">
        <div class="kd__center">
          <Show
            when={props.title}
            fallback={
              <Show when={word()}>
                {(w) => (
                  <>
                    <span
                      class="kd__sig"
                      data-on={props.view.near && signal() ? "1" : undefined}
                      aria-hidden={!(props.view.near && signal())}
                    >
                      yakın sinyal
                    </span>
                    <span class="kd__word" data-len={long() > 10 ? "l" : long() > 7 ? "m" : "s"}>
                      {shownWord(w())}
                    </span>
                  </>
                )}
              </Show>
            }
          >
            <span class="kd__title">{props.title}</span>
            <Show when={word()}>{(w) => <span class="kd__mine">Kelimen: {w()}</span>}</Show>
          </Show>
        </div>
      </header>
      <PhaseClock startedAt={startedAt()} endsAt={endsAt()} urgency />
    </>
  );
}
