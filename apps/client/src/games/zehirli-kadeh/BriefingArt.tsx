import "./zehirli-kadeh.css";
import { Cup } from "./Cup.js";

/** Anlatım görseli: iki neon kadeh ve aralarında amber ışık tüneli. */
export default function BriefingArt() {
  return (
    <div class="zkart" aria-hidden="true">
      <Cup cup={0} class="zkart__cup zkart__cup--a" />
      <i class="zkart__tunnel" />
      <Cup cup={1} class="zkart__cup zkart__cup--b" />
    </div>
  );
}
