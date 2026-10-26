import { Mascot } from "./Mascot.js";
import { Screen } from "./Screen.js";

/** Oyun parçası yüklenirken görünen bekleme ekranı. */
export function Loading() {
  return (
    <Screen>
      <div class="center-stack">
        <Mascot pose="yukleniyor" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
        <span class="loader" aria-hidden="true" />
      </div>
    </Screen>
  );
}
