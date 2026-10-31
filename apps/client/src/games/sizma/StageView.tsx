import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import SizmaScreen from "./SizmaScreen.js";

/**
 * Büyük ekran (TV, SZ-U9): yatay düzen. İpucunda solda büyük söyleme sırası (konuşan büyük, "TUR 1/2"), sağda
 * oyuncular ve hazır olanlar; oylamada "Herkes oy veriyor" ve kilitleyenler; eşitlikte adaylar karşı karşıya;
 * sonuçta oyların uçuşu ve maskenin düşüşü tüm ekranda. Kelimeler TV'de hiç görünmez: sahne hiçbir oyuncunun
 * kişisel görünümünü taşımaz, düğme yoktur.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe sztv" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <SizmaScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
