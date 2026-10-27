import { For } from "solid-js";
import { propSrc } from "../../ui/props.js";

/** Başlangıç sahnesi: nişangâhlar köşelerden süpürüp ortada kilitlenir. Süs katmanı; dokunuşu geçirir. */
export function Opening() {
  return (
    <div class="cx-open" aria-hidden="true">
      <i class="cx-open__sweep" />
      <For each={[0, 1, 2]}>
        {(k) => (
          <img
            class="cx-open__sight"
            style={{ "--k": k }}
            src={propSrc("genel/nisangah")}
            alt=""
            draggable={false}
            width="384"
            height="384"
          />
        )}
      </For>
      <i class="cx-open__ring" />
    </div>
  );
}
