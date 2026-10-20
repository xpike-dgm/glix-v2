import { COLOR_CSS } from "./view.js";
import "./kontrol.css";

/** Anlatım görseli: dört neon kablo metalik kanallarda; biri kesik, kıvılcım atıyor. */
export default function BriefingArt() {
  const colors = [COLOR_CSS.blue, COLOR_CSS.green, COLOR_CSS.red, COLOR_CSS.yellow] as const;
  return (
    <div class="kpart" aria-hidden="true">
      {colors.map((c, i) => (
        <div class="kpart__row" style={{ "--wc": c }}>
          <i class="kpart__wire" data-cut={i === 2 ? "1" : undefined} />
          {i === 2 ? <b class="kpart__spark" /> : null}
        </div>
      ))}
    </div>
  );
}
