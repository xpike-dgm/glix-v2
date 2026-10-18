import "./zehirli-kadeh.css";
import { Cup } from "./Cup.js";

/** Anlatım görseli: iki neon kadeh ve aralarında amber ışık tüneli. */
export default function BriefingArt() {
  return (
    <div class="zkart" aria-hidden="true">
      <Cup color="#2EF2FF" class="zkart__cup zkart__cup--a" />
      <i class="zkart__tunnel" />
      <Cup color="#FF2BD6" class="zkart__cup zkart__cup--b" />
    </div>
  );
}
