import "./rus-ruleti.css";
import { Revolver } from "./Revolver.js";

/** RR-U18: anlatım görseli: risk merdiveni döngüsü %16 → %26 → %36 → BAM → %16 (CSS ile). */
export default function BriefingArt() {
  return (
    <div class="rrart" aria-hidden="true">
      <svg class="rrart__ring" viewBox="0 0 120 120" role="presentation">
        <title>Risk halkası</title>
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,59,92,.18)" stroke-width="8" />
        <circle
          class="rrart__arc"
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="#ff3b5c"
          stroke-width="8"
          stroke-linecap="round"
          pathLength="100"
          stroke-dasharray="16 100"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <Revolver class="rrart__gun" part="tambur" />
      <span class="rrart__steps">
        <span class="rrart__step">%16</span>
        <span class="rrart__step">%26</span>
        <span class="rrart__step">%36</span>
        <span class="rrart__step rrart__step--bam">BAM</span>
      </span>
    </div>
  );
}
