import { Avatar } from "../../ui/Avatar.js";
import { ArcadeButton } from "./ArcadeButton.js";

/** Anlatım ekranı görseli: nabız atan kırmızı buton, aynı anda yanan avatarlar. */
export default function BriefingArt() {
  return (
    <div class="bbart" aria-hidden="true">
      <div class="bbart__btn">
        <ArcadeButton demo disabled />
      </div>
      <div class="bbart__crew">
        <Avatar index={0} size={34} />
        <Avatar index={1} size={34} />
        <Avatar index={3} size={34} />
      </div>
    </div>
  );
}
