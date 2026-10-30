import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import ZehirliKadehScreen from "./ZehirliKadehScreen.js";

/**
 * Büyük ekran (TV): aynı ziyafet masası ve "Şerefe!" açılışı, telefon çerçevesinden daha geniş ve büyük bir
 * kutuda (izleyici kipi: takas/kontrol yok, zehir ve kontrol bilgisi yok).
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={700} h={760}>
      <div class="gframe zktv" data-o="tvp" data-spectator="1">
        <div class="gframe__main">
          <div class="gframe__body">
            <div
              class="gframe__game"
              ref={(el) => {
                el.inert = true;
              }}
            >
              <ZehirliKadehScreen {...props} spectator />
            </div>
          </div>
        </div>
      </div>
    </TvFit>
  );
}
