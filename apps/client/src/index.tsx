import { render } from "solid-js/web";
import { App } from "./App.js";
import { applyHapticsCompensation } from "./fx/haptics.js";
import { installNoZoom } from "./fx/noZoom.js";
import { installAudioUnlock } from "./fx/sound.js";
import { taslaklariYukle } from "./net/oyunAlani.js";
import { initPush } from "./pwa/push.js";
import { forceUpdate, initPwa } from "./pwa/pwa.js";
import { recoverFromStaleChunk } from "./pwa/staleChunk.js";
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
import "./styles/effects.css";
import "./styles/shop.css";
import "./styles/quests.css";
import "./styles/character.css";

installAudioUnlock();
installNoZoom();
applyRootSettings();
applyHapticsCompensation();
// iOS Safari `:active` basılı görünümünü yalnız sayfada bir dokunma dinleyicisi varsa gösterir.
document.addEventListener("touchstart", () => undefined, { passive: true });
initPwa();
// Yeni sürüm canlıya alındıktan sonra eski sürümün parçası yüklenemezse: yeni sürüme yenile (pwa/staleChunk.ts).
window.addEventListener("vite:preloadError", (e) => {
  if (recoverFromStaleChunk(() => void forceUpdate())) e.preventDefault();
});
initPush();
// Yalnız oyun alanı (test2): Üretim Merkezi'nin taslak mağaza ürünleri (canlıda istek atılmaz).
void taslaklariYukle();

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
