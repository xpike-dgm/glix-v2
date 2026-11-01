import { For, Show } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { propSrc, type RusvetProp, rusvetProp } from "../../ui/props.js";
import { Ballot, Crown, Seal } from "./Art.js";
import "./rusvet-darbe.css";

const FRAMES: readonly RusvetProp[] = ["anlatim-1", "anlatim-2", "anlatim-3", "anlatim-4"];

/**
 * RD-U15: anlatım görseli, 4 karelik döngü (4 sn): mühürler sandığa → taht yükselir → jetonlar uçar → taç düşer.
 * Kare görselleri (`rusvet-darbe/anlatim-1..4`) gelene kadar her kare CSS/SVG ile çizilir.
 */
export default function BriefingArt() {
  return (
    <div class="rdart" aria-hidden="true">
      <For each={FRAMES}>
        {(name, i) => (
          <div class="rdart__frame" style={{ "--k": i() }}>
            <Show when={rusvetProp(name)} fallback={<Frame index={i()} />}>
              {(src) => <img class="rdart__img" src={src()} alt="" draggable={false} />}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

function Frame(props: { index: number }) {
  return (
    <div class="rdart__scene" data-k={props.index}>
      <Show when={props.index === 0}>
        <span class="rdart__seal rdart__seal--a">
          <Seal size="22px" />
        </span>
        <span class="rdart__seal rdart__seal--b">
          <Seal size="22px" />
        </span>
        <Ballot size="56px" />
      </Show>
      <Show when={props.index === 1}>
        <span class="rdart__throne">
          <img src={propSrc("genel/taht")} alt="" draggable={false} />
          <span class="rdart__pres">
            <Avatar index={1} size={34} />
          </span>
        </span>
      </Show>
      <Show when={props.index === 2}>
        <Avatar index={2} size={34} />
        <span class="rdart__mid">
          <Avatar index={1} size={42} />
          <i class="rd__coin rdart__coin rdart__coin--l" />
          <i class="rd__coin rdart__coin rdart__coin--r" />
        </span>
        <Avatar index={4} size={34} />
      </Show>
      <Show when={props.index === 3}>
        <span class="rdart__mid">
          <span class="rdart__crown">
            <Crown size="30px" />
          </span>
          <Avatar index={1} size={42} />
        </span>
      </Show>
    </div>
  );
}
