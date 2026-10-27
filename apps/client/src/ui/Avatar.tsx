import { createEffect, createSignal, on, Show } from "solid-js";
import { look, type Mood, moodSrc } from "./avatars.js";
import { CheckIcon, CrownIcon } from "./Icons.js";

interface Props {
  index: number;
  /** Ruh hâli; verilmezse büst. Görsel yumuşakça değişir. */
  mood?: Mood | undefined;
  /** px sayısı ya da CSS uzunluğu (örn. clamp(...)). */
  size: number | string;
  host?: boolean;
  ready?: boolean;
  connected?: boolean;
  self?: boolean;
  /** Halka rengini oyuncu renginin üstüne yazar (örn. lime). */
  ring?: string | undefined;
  /** Kısa süreli parlama. */
  flash?: "match" | "solo" | undefined;
  /**
   * Canlılık katmanı (yalnız CSS, hareket azaltmada durur): `breathe` bekleme nefesi, `joy` sevinç zıplaması,
   * `think` düşünüyor (yavaş sallanma + üç nokta). Elenen (`mood="out"`) avatara çatlak kendiliğinden biner.
   */
  live?: "breathe" | "joy" | "think" | undefined;
  /** Simge (hex rozet) göster; küçük boylarda gizlenir. */
  pip?: boolean;
  class?: string;
}

export function Avatar(props: Props) {
  const l = () => look(props.index);
  const big = () => typeof props.size === "string" || props.size >= 56;
  const src = () => (props.mood ? moodSrc(props.index, props.mood) : null);
  // Ruh hâli görseli yüklenene kadar büst görünür; yüklenince çapraz geçiş olur.
  const [loaded, setLoaded] = createSignal<string | null>(null);
  createEffect(
    on(src, (s) => {
      if (s === null) setLoaded(null);
    }),
  );
  const small = () => typeof props.size === "string" || props.size >= 40;
  return (
    <div
      data-live={props.connected === false ? undefined : props.live}
      data-out={props.mood === "out" ? "1" : undefined}
      class={`av ${props.connected === false ? "av--off" : ""} ${props.flash ? `av--flash-${props.flash}` : ""} ${props.class ?? ""}`}
      style={{
        "--s": typeof props.size === "number" ? `${props.size}px` : props.size,
        "--c": props.ring ?? l().color,
        "--pc": l().color,
        "--live-d": `${-((props.index * 0.37) % 2.6).toFixed(2)}s`,
      }}
    >
      <div class="av__disc">
        <img
          class="av__img"
          data-covered={src() !== null && loaded() === src() ? "1" : undefined}
          src={l().bust}
          alt=""
          draggable={false}
          width="256"
          height="256"
        />
        <Show when={src()} keyed>
          {(url) => (
            <img
              class="av__img av__mood"
              data-ready={loaded() === url ? "1" : undefined}
              src={url}
              alt=""
              draggable={false}
              width="384"
              height="384"
              onLoad={() => setLoaded(url)}
              ref={(el) => {
                if (el.complete && el.naturalWidth > 0) queueMicrotask(() => setLoaded(url));
              }}
            />
          )}
        </Show>
      </div>
      <Show when={props.live === "think" && props.connected !== false}>
        <span class="av__think" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </Show>
      <Show when={big() && props.pip}>
        <img class="av__pip" src={l().pip} alt="" draggable={false} />
      </Show>
      <Show when={small() && props.host}>
        <span class="av__badge av__badge--host">
          <CrownIcon size="62%" />
        </span>
      </Show>
      <Show when={small() && props.ready}>
        <span class="av__badge av__badge--ready">
          <CheckIcon size="62%" />
        </span>
      </Show>
      <Show when={props.self && big()}>
        <span class="av__self">Sen</span>
      </Show>
    </div>
  );
}
