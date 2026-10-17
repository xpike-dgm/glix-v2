import "./kor-bomba.css";

/** Anlatım görseli: kablolarla bağlı üç koltuk ve ortada nabız atan siyah bomba. */
export default function BriefingArt() {
  return (
    <svg class="kbart" viewBox="0 0 160 90" aria-hidden="true" role="presentation">
      <title>Bomba</title>
      <ellipse cx="80" cy="46" rx="64" ry="34" fill="#0d1a4a" stroke="#2ef2ff" stroke-width="2.5" />
      <path
        d="M80 46 L22 46 M80 46 L138 46 M80 46 L80 10"
        stroke="#8b5cff"
        stroke-width="1.8"
        stroke-linecap="round"
      />
      <circle cx="22" cy="46" r="8" fill="#ffc23b" />
      <circle cx="138" cy="46" r="8" fill="#b6ff3b" />
      <circle cx="80" cy="10" r="8" fill="#ff2bd6" />
      <circle class="kbart__ring" cx="80" cy="56" r="15" fill="none" stroke="#ff3b5c" stroke-width="2" />
      <circle cx="80" cy="56" r="15" fill="#05060d" stroke="#ff3b5c" stroke-width="2.5" />
      <circle class="kbart__dot" cx="80" cy="56" r="4" fill="#ff3b5c" />
    </svg>
  );
}
