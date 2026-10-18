import type { Sign } from "@glix/engine";
import { Match, Switch } from "solid-js";

/** Taş, kâğıt ve makas simgeleri (düz, neon çizgili). */
export function SignIcon(props: { sign: Sign; size?: number | string }) {
  return (
    <svg
      class="rd__sign-svg"
      viewBox="0 0 48 48"
      width={props.size ?? 40}
      height={props.size ?? 40}
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <Switch>
        <Match when={props.sign === "tas"}>
          <path d="M10 30 L14 16 L26 9 L38 15 L40 28 L31 38 L17 38 Z" />
          <path d="M14 16 L22 22 L26 9 M22 22 L31 38 M22 22 L40 28" stroke-width="2" opacity=".6" />
        </Match>
        <Match when={props.sign === "kagit"}>
          <path d="M12 6 H30 L38 14 V42 H12 Z" />
          <path d="M30 6 V14 H38" />
          <path d="M18 24 H32 M18 31 H32" stroke-width="2.4" opacity=".7" />
        </Match>
        <Match when={props.sign === "makas"}>
          <circle cx="14" cy="36" r="6" />
          <circle cx="34" cy="36" r="6" />
          <path d="M18 31 L36 7 M30 31 L12 7" />
        </Match>
      </Switch>
    </svg>
  );
}
