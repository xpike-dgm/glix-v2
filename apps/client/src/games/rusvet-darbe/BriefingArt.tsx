import { Avatar } from "../../ui/Avatar.js";
import "./rusvet-darbe.css";

/** Anlatım görseli: ortada koltuğundaki başkan, ondan iki portreye neon jetonlar uçar. */
export default function BriefingArt() {
  return (
    <div class="rdart" aria-hidden="true">
      <div class="rdart__p">
        <Avatar index={2} size={36} />
      </div>
      <div class="rdart__mid">
        <Avatar index={1} size={46} />
        <i class="rd__coin rdart__coin rdart__coin--l" />
        <i class="rd__coin rdart__coin rdart__coin--r" />
      </div>
      <div class="rdart__p">
        <Avatar index={4} size={36} />
      </div>
    </div>
  );
}
