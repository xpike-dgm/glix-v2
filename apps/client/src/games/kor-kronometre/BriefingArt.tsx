import "./kor-kronometre.css";
import { Dial } from "./Dial.js";

/** Anlatım görseli: rakamsız karanlık kronometre; nabzı düzensiz atar (KR-M4). */
export default function BriefingArt() {
  return (
    <div class="kroart">
      <Dial pulse />
    </div>
  );
}
