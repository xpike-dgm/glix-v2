import { createSignal } from "solid-js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import { forceUpdate } from "./pwa.js";

/** Sunucuyla uyumsuz sürüm: tam ekran engel. Güncellemeden oyuna girilemez. */
export function UpdateRequired() {
  const [busy, setBusy] = createSignal(false);
  const [offline, setOffline] = createSignal(false);
  const go = async (): Promise<void> => {
    setBusy(true);
    setOffline(false);
    const result = await forceUpdate();
    if (result === "offline") {
      setOffline(true);
      setBusy(false);
    }
  };
  return (
    <div class="update-required" role="alertdialog" aria-modal="true" aria-labelledby="ur-title">
      <Screen>
        <div class="center-stack">
          <div class="rise" style={{ "--i": 0 }}>
            <Mascot pose="tamir" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
          </div>
          <h1 id="ur-title" class="display h-title rise" style={{ "--i": 1 }}>
            Güncelleme gerekli
          </h1>
          <p class="lead rise" style={{ "--i": 2 }}>
            Oyun yeni sürüme geçti. Devam etmek için uygulamayı güncellemen gerekiyor, birkaç saniye sürer.
          </p>
        </div>
        <div class="bottom-actions">
          <PrimaryButton
            onClick={() => void go()}
            busy={busy()}
            reason={offline() ? "İnternet bağlantını kontrol edip tekrar dene." : undefined}
          >
            Güncelle
          </PrimaryButton>
        </div>
      </Screen>
    </div>
  );
}
