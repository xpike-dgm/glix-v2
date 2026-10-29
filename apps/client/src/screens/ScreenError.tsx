import { type Accessor, createEffect, on, onMount } from "solid-js";
import { leaveRoom } from "../net/client.js";
import { goHome, state } from "../net/store.js";
import { reportClientError } from "../telemetry/errors.js";
import { GhostButton } from "../ui/GhostButton.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import type { ScreenId } from "./route.js";

/**
 * Ekran hata sınırının yedeği: bir ekran çizilirken hata olursa uygulama donmaz, bu sakin ekran çıkar.
 * Oyuncu ana sayfaya dönebilir ya da yeniden deneyebilir; oyun bir sonraki ekrana geçince (ör. sonuçtan finale)
 * sınır kendiliğinden yeniden kurulur. Hata sessizce bildirilir; oyuncuya teknik metin gösterilmez.
 */
export function ScreenError(props: { error: unknown; reset: () => void; screen: Accessor<ScreenId> }) {
  onMount(() => reportClientError(props.error));
  createEffect(on(props.screen, () => props.reset(), { defer: true }));
  const home = (): void => {
    if (state.snapshot) leaveRoom();
    else goHome();
    props.reset();
  };
  return (
    <Screen>
      <div class="center-stack">
        <div class="rise" style={{ "--i": 0 }}>
          <Mascot pose="saskin" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
        </div>
        <h1 class="display h-title rise" style={{ "--i": 1 }}>
          Bir şeyler ters gitti
        </h1>
        <p class="lead rise" style={{ "--i": 2 }}>
          Bu ekran açılamadı. Yeniden deneyebilir ya da ana sayfaya dönebilirsin.
        </p>
      </div>
      <div class="bottom-actions">
        <PrimaryButton onClick={() => props.reset()}>Yeniden dene</PrimaryButton>
        <GhostButton onClick={home}>Ana sayfaya dön</GhostButton>
      </div>
    </Screen>
  );
}
