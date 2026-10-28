import { render } from "solid-js/web";
import { App } from "./App.js";
import { applyHapticsCompensation } from "./fx/haptics.js";
import { installNoZoom } from "./fx/noZoom.js";
import { installAudioUnlock } from "./fx/sound.js";
import { initPush } from "./pwa/push.js";
import { initPwa } from "./pwa/pwa.js";
import { applyRootSettings } from "./settings/settings.js";
import { isTvRoute, TvApp } from "./stage/TvApp.js";
import "./fonts.js";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/screens.css";
import "./styles/lobby.css";
import "./styles/game.css";
import "./styles/frame.css";
import "./styles/settings.css";
import "./styles/profile.css";
import "./styles/friends.css";
import "./styles/report.css";
import "./styles/badges.css";
import "./styles/leaderboard.css";
import "./styles/colorblind.css";
import "./styles/cards.css";
import "./styles/result.css";
import "./styles/cosmetics.css";
import "./styles/shop.css";

installAudioUnlock();
installNoZoom();
applyRootSettings();
applyHapticsCompensation();
// iOS Safari `:active` basılı görünümünü yalnız sayfada bir dokunma dinleyicisi varsa gösterir.
document.addEventListener("touchstart", () => undefined, { passive: true });
initPwa();
initPush();

const root = document.getElementById("root");
if (root)
  render(
    () =>
      isTvRoute(window.location) ||
      (import.meta.env.DEV &&
        (new URLSearchParams(window.location.search).get("mock") ?? "").startsWith("tv-")) ? (
        <TvApp />
      ) : (
        <App />
      ),
    root,
  );
