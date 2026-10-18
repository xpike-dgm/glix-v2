import { Show } from "solid-js";

/** Aynalı neon kadeh. `mode` yalnız sonuçta değişir; oyun sırasında kadeh içeriği hiçbir ipucu vermez. */
export function Cup(props: { color: string; mode?: "unknown" | "clean" | "poison"; class?: string }) {
  const mode = () => props.mode ?? "unknown";
  return (
    <svg
      class={`zkcup ${props.class ?? ""}`}
      data-mode={mode()}
      viewBox="0 0 48 64"
      aria-hidden="true"
      role="presentation"
      style={{ "--cc": props.color }}
    >
      <title>Kadeh</title>
      <path class="zkcup__liquid" d="M9 22h30l-3 14q-2 8-12 8t-12-8z" />
      <path class="zkcup__glass" d="M6 8h36l-3 28q-2 11-15 11T9 36z" />
      <path class="zkcup__shine" d="M13 13l3 20" />
      <path class="zkcup__stem" d="M24 47v10M14 58h20" />
      <Show when={mode() === "clean"}>
        <path
          class="zkcup__star"
          d="M24 1l2.4 4.8 5.2.8-3.8 3.7.9 5.2L24 13l-4.7 2.5.9-5.2-3.8-3.7 5.2-.8z"
        />
      </Show>
      <Show when={mode() === "poison"}>
        <g class="zkcup__smoke">
          <circle cx="16" cy="6" r="4" />
          <circle cx="26" cy="3" r="5" />
          <circle cx="35" cy="7" r="3.5" />
        </g>
      </Show>
    </svg>
  );
}
