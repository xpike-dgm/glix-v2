import { type JSX, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";
import { pressable } from "./press.js";

interface Props {
  children: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  /** Devre dışıyken altında görünen kısa gerekçe. */
  reason?: string | undefined;
  variant?: "cyan" | "danger" | "done";
  busy?: boolean;
  type?: "button" | "submit";
  class?: string;
  /** Oyun içi eylem: parmak değer değmez etkinleşir (`click` klavye için kalır). Form gönderiminde kullanılmaz. */
  instant?: boolean;
}

export function PrimaryButton(props: Props) {
  const off = () => props.disabled || props.busy;
  const press = pressable(() => {
    if (!off()) props.onClick?.();
  });
  return (
    <div class="pbtn-wrap">
      <button
        type={props.type ?? "button"}
        class={`pbtn pbtn--${props.variant ?? "cyan"} ${props.class ?? ""}`}
        disabled={off()}
        data-busy={props.busy ? "1" : undefined}
        onPointerDown={(e) => {
          if (off()) return;
          unlockAudio();
          tap();
          hapticTap();
          if (props.instant) press.onPointerDown(e);
        }}
        onClick={() => (props.instant ? press.onClick() : props.onClick?.())}
      >
        <span class="pbtn__label">{props.children}</span>
        <Show when={props.busy}>
          <span class="pbtn__spin" aria-hidden="true" />
        </Show>
      </button>
      <Show when={props.reason}>
        <p class="pbtn__reason">{props.reason}</p>
      </Show>
    </div>
  );
}
