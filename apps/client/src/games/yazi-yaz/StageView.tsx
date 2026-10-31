import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import YaziYazScreen from "./YaziYazScreen.js";

/**
 * Büyük ekran (TV, YY-U7): solda büyük konu kartı, saat ve (tartışmadan itibaren) harf ipucu; sağda oyuncu halkası ve
 * hazır işaretleri (yazmada yalnız sayı). Rol ve kelime sonuca kadar hiç yoktur: sahne hiçbir oyuncunun kişisel
 * görünümünü taşımaz. Sonuç açılışı tüm ekranda.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div class="gframe yytv" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <YaziYazScreen {...props} match={{ ...props.match, view: null }} spectator tv />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
