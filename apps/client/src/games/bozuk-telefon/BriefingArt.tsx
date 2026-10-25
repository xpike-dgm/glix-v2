// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import "./bozuk-telefon.css";

/** Anlatım görseli: cümle -> çizim -> bozulmuş cümle zinciri. */
export default function BriefingArt() {
  return (
    <div class="btart" aria-hidden="true">
      <svg viewBox="0 0 240 110" class="btart__svg">
        <rect x="6" y="22" width="64" height="64" rx="14" class="btart__card btart__card--a" />
        <path d="M18 46h40M18 58h30M18 70h36" class="btart__lines" />
        <rect x="88" y="22" width="64" height="64" rx="14" class="btart__card btart__card--b" />
        <path d="M100 68c8-26 14 6 22-16s12-6 20 6" class="btart__ink" />
        <rect x="170" y="22" width="64" height="64" rx="14" class="btart__card btart__card--c" />
        <path d="M182 46h40M182 58h20M182 70h34" class="btart__lines btart__lines--bad" />
        <path d="M74 54h10M82 50l4 4-4 4M156 54h10M164 50l4 4-4 4" class="btart__arrow" />
      </svg>
    </div>
  );
}
