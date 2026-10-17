import { For } from "solid-js";
import { state } from "../net/store.js";

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      <For each={state.toasts}>{(t) => <div class={`toast toast--${t.kind}`}>{t.text}</div>}</For>
    </div>
  );
}
