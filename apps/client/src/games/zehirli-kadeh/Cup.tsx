import { Show } from "solid-js";
import { look } from "../../ui/avatars.js";
import { propSrc } from "../../ui/props.js";

/** Kadeh görseli: rengi ilk sahibinin sırasına göre (oyuncu renk dizisiyle aynı). Oyun sırasında parlaklık/boy değişmez; `mode` yalnız sonuçta efekt ekler. */
export function Cup(props: { cup: number; mode?: "unknown" | "clean" | "poison"; class?: string }) {
  const mode = () => props.mode ?? "unknown";
  return (
    <span class={`zkcup ${props.class ?? ""}`} data-mode={mode()} aria-hidden="true">
      <img
        class="zkcup__img"
        src={propSrc(`zehirli-kadeh/kadeh-${look(props.cup).name}`)}
        alt=""
        draggable={false}
        width="320"
        height="320"
      />
      <Show when={mode() !== "unknown"}>
        <img
          class="zkcup__fx"
          src={propSrc(mode() === "clean" ? "zehirli-kadeh/efekt-temiz" : "zehirli-kadeh/efekt-zehir")}
          alt=""
          draggable={false}
          width="384"
          height="384"
        />
      </Show>
    </span>
  );
}
