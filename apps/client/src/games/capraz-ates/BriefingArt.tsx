import { onMount } from "solid-js";
import { Avatar } from "../../ui/Avatar.js";
import { preloadCxArt } from "./art.js";
import "./capraz-ates.css";
import { Sight } from "./Sight.js";

/** Anlatım görseli: üç portre; yanlardakiler ortadakine ateş eder, ortadakinin üstünde nişangâh gezinir. */
export default function BriefingArt() {
  // Eklenmiş açılış görselleri anlatım sırasında önden indirilir.
  onMount(preloadCxArt);
  return (
    <div class="cxart" aria-hidden="true">
      <div class="cxart__p">
        <Avatar index={1} size={52} />
      </div>
      <i class="cxart__line" />
      <div class="cxart__p cxart__p--mid">
        <Avatar index={2} size={52} />
        <span class="cxart__sight">
          <Sight />
        </span>
      </div>
      <i class="cxart__line cxart__line--r" />
      <div class="cxart__p">
        <Avatar index={4} size={52} />
      </div>
    </div>
  );
}
