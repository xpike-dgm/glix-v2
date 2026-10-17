import { Show } from "solid-js";
import type { ScreenId } from "../screens/route.js";
import { applyUpdate, updateWaiting } from "./pwa.js";
import { shouldOfferUpdate } from "./updateGate.js";

/** Yeni sürüm hazır bildirimi; maç sürerken görünmez, maç bitince ortaya çıkar. */
export function UpdateToast(props: { screen: ScreenId }) {
  return (
    <Show when={shouldOfferUpdate(updateWaiting(), props.screen)}>
      <div class="update" role="status">
        <span class="update__text">Yeni sürüm hazır</span>
        <button type="button" class="update__btn" onClick={applyUpdate}>
          Yenile
        </button>
      </div>
    </Show>
  );
}
