import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import SozlukBlofuScreen from "./SozlukBlofuScreen.js";

/**
 * Büyük ekran (TV, SB-U12): yazmada büyük plaka ve tüy kalemler, seçmede iki sütunlu büyük kart duvarı, açılış tüm
 * ekranda. Sahne hiçbir oyuncunun kişisel görünümünü taşımaz (`view: null`).
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe sbtvframe" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <SozlukBlofuScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
