import { Show } from "solid-js";
import { look } from "../../ui/avatars.js";
import { CbMarker } from "../../ui/CbMarker.js";
import { CbState } from "../../ui/CbState.js";
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
      {/* Renk körlüğü dostu mod: kadehin rengi şekil olarak, zehirli/temiz de ✗/✓ olarak yazılır. */}
      <CbMarker index={props.cup} size={16} class="zkcup__mark" />
      <Show when={mode() !== "unknown"}>
        <CbState kind={mode() === "clean" ? "ok" : "bad"} size={16} class="zkcup__verdict" />
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
