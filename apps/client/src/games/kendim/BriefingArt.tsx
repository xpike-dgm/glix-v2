import { Avatar } from "../../ui/Avatar.js";
import "./kendim.css";

/** Anlatım görseli: havada duran iki hologram kelime kartı ve portreye bağlanan neon ip. */
export default function BriefingArt() {
  return (
    <div class="kdart" aria-hidden="true">
      <div class="kdart__card">
        <span>ÇAY</span>
      </div>
      <i class="kdart__rope" />
      <Avatar index={2} size={52} />
    </div>
  );
}
