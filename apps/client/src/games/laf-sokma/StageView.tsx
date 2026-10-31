import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import LafSokmaScreen from "./LafSokmaScreen.js";

/**
 * Büyük ekran (TV): oyunun asıl sahnesi. Soru tabelası ve iki kart büyük, kartlar yan yana, ortada VS;
 * oylamada kimin oy verdiği avatarlarla (hangi karta verdiği değil); açılış ve "LAF USTASI!" tüm ekranda.
 * İzleyici kipindedir: hiçbir oyuncunun kişisel bilgisi yoktur.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe lftv" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              {/* Sahne hiçbir oyuncunun kişisel görünümünü taşımaz. */}
              <LafSokmaScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
