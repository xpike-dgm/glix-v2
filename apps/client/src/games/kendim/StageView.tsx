import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import KendimScreen from "./KendimScreen.js";

/**
 * Büyük ekran (TV, KN-U7): yazmada konu büyük, ortada ayna, avatarlar Tamam dedikçe ✓; eşleştirmede sahipsiz kelime
 * kartları büyük (kimin kimi seçtiği yok, yalnız kimin Tamam dediği); açılışta kart kart açılış tam ekran, sağda
 * oyuncular ve canlı artan tanıma puanları. Sahne hiçbir oyuncunun kişisel görünümünü taşımaz.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe kntv" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <KendimScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
