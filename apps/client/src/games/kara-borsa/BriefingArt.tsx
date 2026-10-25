// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden)
import "./kara-borsa.css";

/** Anlatım görseli: gizemli kutu ve jeton. */
export default function BriefingArt() {
  return (
    <div class="kbart" aria-hidden="true">
      <svg viewBox="0 0 200 130" class="kbart__svg">
        <path d="M30 52l50-24 50 24v50l-50 24-50-24z" class="kbart__box" />
        <path d="M30 52l50 24 50-24M80 76v50" class="kbart__edge" />
        <path d="M72 46a9 9 0 1116 3c-3 4-8 4-8 11M80 68v1" class="kbart__q" />
        <circle cx="150" cy="86" r="22" class="kbart__coin" />
        <path d="M150 74v24M142 80h13a5 5 0 010 10h-13" class="kbart__sym" />
      </svg>
    </div>
  );
}
