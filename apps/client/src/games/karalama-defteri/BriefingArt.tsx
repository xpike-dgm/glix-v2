// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import "./karalama.css";

/** Elma karalaması (yuvarlak gövde, sap, yaprak). */
const Apple = (p: { x: number }) => (
  <g transform={`translate(${p.x} 0)`}>
    <rect x="0" y="22" width="62" height="62" rx="12" class="kdart__board" />
    <path d="M31 40c-12-6-20 4-18 16s10 20 18 16c8 4 16-4 18-16s-6-22-18-16z" class="kdart__ink" />
    <path d="M31 40c0-5 2-8 5-10" class="kdart__ink" />
    <path d="M36 32c4-3 8-2 10 0-3 3-7 3-10 0z" class="kdart__leaf" />
  </g>
);

/**
 * Anlatım görseli (KD-U14): iki "elma" ve bir "armut" karalaması; kıvrılan ışık izi armuda (bilgisize) uzanır.
 * Altında küçük not: harf ve yazı yasak.
 */
export default function BriefingArt() {
  return (
    <div class="kdart" aria-hidden="true">
      <svg viewBox="0 0 220 150" class="kdart__svg">
        <Apple x={6} />
        <Apple x={79} />
        <g transform="translate(152 0)">
          <rect x="0" y="22" width="62" height="62" rx="12" class="kdart__board kdart__board--near" />
          <path
            d="M31 36c-6 0-7 8-9 14-5 4-8 10-6 18 3 8 12 9 15 8 3 1 12 0 15-8 2-8-1-14-6-18-2-6-3-14-9-14z"
            class="kdart__ink"
          />
          <path d="M31 36c0-4 1-6 3-8" class="kdart__ink" />
        </g>
        <path d="M37 96c30 34 110 40 146-6" class="kdart__halo" />
        <path d="M37 96c30 34 110 40 146-6" class="kdart__line" pathLength="1" />
        <circle cx="183" cy="90" r="5" class="kdart__dot" />
        <text x="110" y="146" text-anchor="middle" class="kdart__note">
          Harf ve yazı yok, yalnız çizim
        </text>
      </svg>
    </div>
  );
}
