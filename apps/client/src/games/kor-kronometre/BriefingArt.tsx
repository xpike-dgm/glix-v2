import "./kor-kronometre.css";
import { Dial } from "./Dial.js";

/** Anlatım görseli: rakamsız, nabız atan karanlık kronometre kadranı. */
export default function BriefingArt() {
  return (
    <div class="kroart">
      <Dial />
    </div>
  );
}
