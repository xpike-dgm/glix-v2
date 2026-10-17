import { createSignal, onCleanup } from "solid-js";
import { serverNow } from "./store.js";

/** Sunucu saatini `ms` aralıkla güncelleyen sinyal. */
export function createServerNow(ms = 50): () => number {
  const [now, setNow] = createSignal(serverNow());
  const id = setInterval(() => setNow(serverNow()), ms);
  onCleanup(() => clearInterval(id));
  return now;
}
