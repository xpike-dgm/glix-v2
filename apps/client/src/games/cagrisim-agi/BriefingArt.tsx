import { Avatar } from "../../ui/Avatar.js";
import "./cagrisim.css";

/** Anlatım görseli: ortada elektrikli kelime merkezi, iki oyuncuyu bağlayan aynı renkli neon çizgi. */
export default function BriefingArt() {
  return (
    <div class="caart" aria-hidden="true">
      <div class="caart__orb">
        <span>AĞ</span>
      </div>
      <div class="caart__crew">
        <Avatar index={0} size={34} ring="var(--magenta)" />
        <i class="caart__link" />
        <Avatar index={2} size={34} ring="var(--magenta)" />
        <Avatar index={4} size={34} class="caart__dim" />
      </div>
    </div>
  );
}
