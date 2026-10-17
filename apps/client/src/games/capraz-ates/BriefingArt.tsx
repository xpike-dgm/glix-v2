import { Avatar } from "../../ui/Avatar.js";
import "./capraz-ates.css";
import { Sight } from "./Sight.js";

/** Anlatım görseli: üç portre; yanlardakiler ortadakine ateş eder, ortadakinin üstünde nişangâh gezinir. */
export default function BriefingArt() {
  return (
    <div class="caart" aria-hidden="true">
      <div class="caart__p">
        <Avatar index={1} size={52} />
      </div>
      <i class="caart__line" />
      <div class="caart__p caart__p--mid">
        <Avatar index={2} size={52} />
        <span class="caart__sight">
          <Sight />
        </span>
      </div>
      <i class="caart__line caart__line--r" />
      <div class="caart__p">
        <Avatar index={4} size={52} />
      </div>
    </div>
  );
}
