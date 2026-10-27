import { Show } from "solid-js";
import { state } from "../net/store.js";

/** Odada büyük ekran (TV) açıkken telefonda küçük rozet: oyun TV'de izleniyor. */
export function TvBadge() {
  return (
    <Show when={(state.snapshot?.stageCount ?? 0) > 0}>
      <span class="tvbadge" role="status">
        TV'de oynanıyor
      </span>
    </Show>
  );
}
