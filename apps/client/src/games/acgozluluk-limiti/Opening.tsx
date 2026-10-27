import { For } from "solid-js";
import { propSrc } from "../../ui/props.js";

const COINS = Array.from({ length: 12 }, (_, i) => ({
  x: 50 + ((i * 37) % 23) - 11,
  spin: (i % 2 === 0 ? 1 : -1) * (360 + (i % 3) * 120),
}));

/** Başlangıç sahnesi: jetonlar haznenin içine yağar. Süs katmanı; dokunuşu geçirir. */
export function Opening() {
  return (
    <div class="lim-open" aria-hidden="true">
      <i class="lim-open__glow" />
      <For each={COINS}>
        {(c, i) => (
          <img
            class="lim-open__coin"
            style={{ "--x": `${c.x}%`, "--r": `${c.spin}deg`, "--k": i() }}
            src={propSrc("genel/rusvet-jetonu")}
            alt=""
            draggable={false}
            width="64"
            height="64"
          />
        )}
      </For>
    </div>
  );
}
