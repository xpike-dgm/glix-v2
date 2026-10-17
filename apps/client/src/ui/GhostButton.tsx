import type { JSX } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap, unlockAudio } from "../fx/sound.js";

interface Props {
  children: JSX.Element;
  onClick?: () => void;
  disabled?: boolean;
  /** "block": 64 px, ana butonla aynı boy; "small": 48 px bağlantı gibi. */
  size?: "block" | "small";
  variant?: "default" | "danger";
  class?: string;
  label?: string;
}

export function GhostButton(props: Props) {
  return (
    <button
      type="button"
      class={`gbtn gbtn--${props.size ?? "block"} gbtn--${props.variant ?? "default"} ${props.class ?? ""}`}
      disabled={props.disabled}
      aria-label={props.label}
      onPointerDown={() => {
        if (props.disabled) return;
        unlockAudio();
        tap();
        hapticTap();
      }}
      onClick={() => props.onClick?.()}
    >
      {props.children}
    </button>
  );
}
