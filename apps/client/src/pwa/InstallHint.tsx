import { Match, Switch } from "solid-js";
import { CloseIcon, PlusIcon, ShareIcon } from "../ui/Icons.js";
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
        <div class="install install--ios" role="note">
          <ol class="install__steps">
            <li class="install__step">
              <span class="install__chip" aria-hidden="true">
                <ShareIcon size={22} />
              </span>
              <span>
                Alttaki <b>Paylaş</b> düğmesine dokun
              </span>
            </li>
            <li class="install__step">
              <span class="install__chip" aria-hidden="true">
                <PlusIcon size={22} />
              </span>
              <span>
                <b>Ana Ekrana Ekle</b> de
              </span>
            </li>
          </ol>
          <button type="button" class="install__x" aria-label="Kapat" onClick={dismissInstallHint}>
            <CloseIcon size={20} />
          </button>
        </div>
      </Match>
    </Switch>
  );
}
