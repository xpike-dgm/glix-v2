import { Avatar } from "../../ui/Avatar.js";
import "./cagrisim.css";

/**
 * Anlatım görseli (CG-U14): DENİZ → "mavi", "mavi", "dalga" kartları; iki "mavi" neon çizgiyle bağlanır. Altta küçük not:
 * cevabı yüksek sesle söyleme.
 */
export default function BriefingArt() {
  return (
    <div class="caart" aria-hidden="true">
      <div class="caart__orb">
        <span>DENİZ</span>
      </div>
      <div class="caart__crew">
        <span class="caart__card">
          <Avatar index={0} size={30} ring="var(--magenta)" />
          <b>mavi</b>
        </span>
        <i class="caart__link" />
        <span class="caart__card">
          <Avatar index={2} size={30} ring="var(--magenta)" />
          <b>mavi</b>
        </span>
        <span class="caart__card caart__dim">
          <Avatar index={4} size={30} />
          <b>dalga</b>
        </span>
      </div>
      <p class="caart__note">Cevabını yüksek sesle söyleme! Küçük yazım hataları sayılmaz.</p>
    </div>
  );
}
