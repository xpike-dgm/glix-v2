import { Avatar } from "../../ui/Avatar.js";
import "./ittifak.css";

/** Anlatım görseli: iki portre arasında neon bir bağ yanıp söner, üstlerinde konuşma izleri belirir. */
export default function BriefingArt() {
  return (
    <div class="itart" aria-hidden="true">
      <div class="itart__p">
        <Avatar index={0} size={56} />
        <i class="it__bubble itart__bubble">
          <b />
          <b />
          <b />
        </i>
      </div>
      <i class="itart__bond" />
      <div class="itart__p">
        <Avatar index={3} size={56} />
        <i class="it__bubble itart__bubble itart__bubble--r">
          <b />
          <b />
          <b />
        </i>
      </div>
    </div>
  );
}
