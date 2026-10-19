import { Mask } from "./Mask.js";
import "./sizma.css";

/** Anlatım görseli: ortak kelime kristalinin çevresinde dönen maskeler; biri farklı renkte sızıyor. */
export default function BriefingArt() {
  return (
    <div class="szart" aria-hidden="true">
      <i class="szart__gem" />
      <div class="szart__orbit">
        {[0, 1, 2, 3, 4].map((i) => (
          <span class="szart__m" data-odd={i === 3 ? "1" : undefined} style={{ "--a": `${i * 72}deg` }}>
            <Mask size={26} />
          </span>
        ))}
      </div>
    </div>
  );
}
