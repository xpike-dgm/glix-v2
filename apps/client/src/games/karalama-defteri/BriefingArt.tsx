// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import "./karalama.css";
/** Anlatım görseli: neon kalemle çizilen çizgi ve altındaki "?" kartı. */
export default function BriefingArt() {
  return (
    <div class="kdart" aria-hidden="true">
      <svg viewBox="0 0 220 150" class="kdart__svg">
        <rect x="6" y="6" width="208" height="138" rx="22" class="kdart__board" />
        <path d="M30 108c14-48 30 6 46-26s26-38 44-12 26 40 44 8 20-34 28-26" class="kdart__halo" />
        <path
          d="M30 108c14-48 30 6 46-26s26-38 44-12 26 40 44 8 20-34 28-26"
          class="kdart__line"
          pathLength="1"
        />
        <circle cx="48" cy="44" r="13" class="kdart__dot" />
        <path d="M44 40a5 5 0 119 2c-1 3-5 3-5 7M48.5 54v.5" class="kdart__q" />
      </svg>
    </div>
  );
}
