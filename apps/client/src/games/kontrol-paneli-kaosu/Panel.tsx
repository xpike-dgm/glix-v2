import type { WireColor } from "@glix/engine";
import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { COLOR_CSS, COLOR_NAME } from "./view.js";

export type CutVerdict = "right" | "wrong";

interface Props {
  panel: readonly WireColor[];
  /** Seçili (henüz kesilmemiş) kablo. */
  selected: WireColor | null;
  /** Kesilmiş kablo. */
  cut: WireColor | null;
  /** Sonuç açıldıysa kesimin doğruluğu (kıvılcım rengi). */
  verdict?: CutVerdict | undefined;
  disabled: boolean;
  /** Yalnız gösterim (sonuç ekranı): dokunulabilir düğme yerine düz satır. */
  display?: boolean;
  onPick: (color: WireColor) => void;
}

/** Dört kablo, yukarıdan aşağıya numaralı; her biri metalik bir kanalda neon renkte. */
export function Panel(props: Props) {
  return (
    <ul class="kp__panel" aria-label="Kablolar">
      <For each={props.panel}>
        {(color, i) => {
          const isCut = () => props.cut === color;
          return (
            <li>
              <Dynamic
                component={props.display ? "div" : "button"}
                type={props.display ? undefined : "button"}
                class="kp__wire"
                style={{ "--wc": COLOR_CSS[color] }}
                data-selected={props.selected === color ? "1" : undefined}
                data-cut={isCut() ? "1" : undefined}
                data-verdict={isCut() ? props.verdict : undefined}
                disabled={props.display ? undefined : props.disabled}
                aria-pressed={props.display ? undefined : props.selected === color}
                aria-label={`${i() + 1}. kablo, ${COLOR_NAME[color]}${isCut() ? ", kesildi" : ""}`}
                onClick={() => {
                  if (!props.display) props.onPick(color);
                }}
              >
                <span class="kp__no">{i() + 1}</span>
                <span class="kp__channel">
                  <i class="kp__core" />
                  <Show when={isCut()}>
                    <b class="kp__spark" />
                  </Show>
                </span>
                <span class="kp__name">{COLOR_NAME[color]}</span>
              </Dynamic>
            </li>
          );
        }}
      </For>
    </ul>
  );
}
