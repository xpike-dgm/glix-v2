import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import CagrisimAgiScreen from "./CagrisimAgiScreen.js";

/**
 * Büyük ekran (TV, CG-U11): cevapta ortada dev küre ve halkalı sayaç, gönderenin düğümü yörüngeye fırlar; mini açılışlar
 * 4 sn; büyük açılışta ağ halkası tüm ekranda, ardından liste ve genel skor. Sahne hiçbir oyuncunun kişisel görünümünü
 * taşımaz (`view: null`); açılıştan önce hiçbir cevap metni yoktur.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe cgtvframe" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <CagrisimAgiScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
