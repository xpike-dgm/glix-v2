import { Match, Switch } from "solid-js";
import { CloseIcon, ShareIcon } from "../ui/Icons.js";
import { dismissInstallHint, installHint, promptInstall } from "./pwa.js";

/** Ana ekrana ekleme ipucu: Chromium'da "Yükle" düğmesi, iOS Safari'de tek satır yönerge. */
export function InstallHint() {
  return (
    <Switch>
      <Match when={installHint() === "prompt"}>
        <div class="install" role="note">
          <span class="install__text">GLIX'i ana ekranına ekle</span>
          <button type="button" class="install__btn" onClick={() => void promptInstall()}>
            Yükle
          </button>
          <button type="button" class="install__x" aria-label="Kapat" onClick={dismissInstallHint}>
            <CloseIcon size={20} />
          </button>
        </div>
      </Match>
      <Match when={installHint() === "ios"}>
        <div class="install" role="note">
          <span class="install__text">
            Ana ekrana ekle: <ShareIcon size={18} class="install__icon" /> → “Ana Ekrana Ekle”
          </span>
          <button type="button" class="install__x" aria-label="Kapat" onClick={dismissInstallHint}>
            <CloseIcon size={20} />
          </button>
        </div>
      </Match>
    </Switch>
  );
}
