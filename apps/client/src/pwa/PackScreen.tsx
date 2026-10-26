import { Match, Show, Switch } from "solid-js";
import { GhostButton } from "../ui/GhostButton.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import {
  chooseNow,
  chooseWifi,
  packPhase,
  packProgress,
  pendingBytes,
  retryPack,
  skipPackScreen,
} from "./packController.js";
import { fraction, megabytes } from "./packPolicy.js";

/** İlk açılışta tam ekran "Hazırlanıyor": içerik ilerleme çubuğuyla iner; mobil veride önce sorar. */
export function PackScreen() {
  const ratio = (): number => {
    const p = packProgress();
    return p ? fraction(p.bytes, p.totalBytes) : 0;
  };
  const pct = (): number => Math.round(ratio() * 100);
  const sizeText = (): string => {
    const p = packProgress();
    return p ? `${megabytes(p.bytes)} / ${megabytes(p.totalBytes)} MB` : "";
  };
  return (
    <div class="pack" role="dialog" aria-modal="true" aria-labelledby="pack-title" data-phase={packPhase()}>
      <Screen>
        <div class="center-stack">
          <div class="pack__mascot rise" style={{ "--i": 0 }}>
            <Mascot pose="yukleniyor" size="var(--mascot-lg, clamp(96px, 30vw, 150px))" />
          </div>
          <Switch>
            <Match when={packPhase() === "ask"}>
              <h1 id="pack-title" class="display h-title rise" style={{ "--i": 1 }}>
                Oyun içeriği hazırlanacak
              </h1>
              <p class="lead rise" style={{ "--i": 2 }}>
                Görseller yaklaşık {megabytes(pendingBytes())} MB. Mobil verini harcamamak için Wi-Fi'ye
                bağlanınca indirmek daha iyi olur.
              </p>
            </Match>
            <Match when={packPhase() === "failed"}>
              <h1 id="pack-title" class="display h-title rise" style={{ "--i": 1 }}>
                Bağlantı koptu
              </h1>
              <p class="lead rise" style={{ "--i": 2 }}>
                Kaldığı yerden devam eder. İstersen şimdi tekrar deneyebilirsin.
              </p>
            </Match>
            <Match when={true}>
              <h1 id="pack-title" class="display h-title rise" style={{ "--i": 1 }}>
                Hazırlanıyor
              </h1>
              <p class="lead rise" style={{ "--i": 2 }}>
                Oyun görselleri telefonuna iniyor. Bir kez inince internetsiz de açılır.
              </p>
              <div
                class="pack__meter rise"
                style={{ "--i": 3 }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct()}
                aria-label="İndirme ilerlemesi"
              >
                <div class="pack__bar">
                  <div
                    class="pack__fill"
                    data-indeterminate={packProgress() ? undefined : "1"}
                    style={packProgress() ? { transform: `scaleX(${ratio()})` } : undefined}
                  />
                </div>
                <span class="pack__size" aria-live="off">
                  {sizeText() || " "}
                </span>
              </div>
            </Match>
          </Switch>
        </div>
        <div class="bottom-actions">
          <Show when={packPhase() === "ask"}>
            <PrimaryButton onClick={chooseNow}>Şimdi indir</PrimaryButton>
            <div class="pack__gap" />
            <GhostButton onClick={chooseWifi}>Wi-Fi'yi bekle</GhostButton>
          </Show>
          <Show when={packPhase() === "failed"}>
            <PrimaryButton onClick={retryPack}>Tekrar dene</PrimaryButton>
          </Show>
          <button type="button" class="pack__skip" onClick={skipPackScreen}>
            Atla
          </button>
        </div>
      </Screen>
    </div>
  );
}
