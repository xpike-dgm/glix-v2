import { goHome, state } from "../net/store.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

export function NotFound() {
  return (
    <Screen>
      <div class="center-stack">
        <div class="rise" style={{ "--i": 0 }}>
          <Mascot pose="oda-bulunamadi" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
        </div>
        <h1 class="display h-title rise" style={{ "--i": 1 }}>
          Oda bulunamadı
        </h1>
        <p class="lead rise" style={{ "--i": 2 }}>
          {state.notFoundCode && state.notFoundCode !== "?"
            ? `${state.notFoundCode} kodlu oda yok ya da kapanmış. `
            : ""}
          Kodu kontrol et ya da yeni bir oda kur.
        </p>
      </div>
      <div class="bottom-actions">
        <PrimaryButton onClick={goHome}>Ana sayfa</PrimaryButton>
      </div>
    </Screen>
  );
}
