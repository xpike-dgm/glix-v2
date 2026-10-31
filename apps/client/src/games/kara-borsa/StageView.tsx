import { TvFit } from "../../stage/TvParts.js";
import type { GameScreenProps } from "../registry.js";
import KaraBorsaScreen from "./KaraBorsaScreen.js";

/**
 * Büyük ekran (TV, KB-U6): solda büyük kutu, tur bandı ve pazar defteri; sağda oyuncu sütunu (avatar, ad, jeton ya
 * da kâr, zarf durumu). Açılışta tokmak, sıralı teklifler ve kutunun açılması tüm sahnede. İzleyici kipindedir:
 * ipucu ve hiçbir oyuncunun kişisel görünümü yoktur.
 */
export default function StageView(props: GameScreenProps) {
  return (
    <TvFit w={960} h={600}>
      <div
        class="kbtv"
        ref={(el) => {
          el.inert = true;
        }}
      >
        {/* Sahne hiçbir oyuncunun kişisel görünümünü (ipucu, teklif) taşımaz. */}
        <KaraBorsaScreen
          {...props}
          match={{ ...props.match, view: { hint: null, myBid: null } }}
          spectator
          tv
        />
      </div>
    </TvFit>
  );
}
