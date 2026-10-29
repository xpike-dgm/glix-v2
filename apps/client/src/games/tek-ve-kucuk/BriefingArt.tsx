import "./tek-ve-kucuk.css";

/** Anlatım görseli: çakışan 1'ler elenir, tek kalan en küçük sayı altın parlar. */
export default function BriefingArt() {
  return (
    <svg class="tvkart" viewBox="0 0 160 110" aria-hidden="true" role="presentation">
      <title>Tek ve küçük</title>
      <g font-family="Unbounded, sans-serif" font-weight="800" font-size="22" text-anchor="middle">
        <rect x="14" y="30" width="30" height="40" rx="9" fill="#0a1030" stroke="#ff3b5c" stroke-width="3" />
        <text x="29" y="58" fill="#ff3b5c">
          1
        </text>
        <rect x="50" y="30" width="30" height="40" rx="9" fill="#0a1030" stroke="#ff3b5c" stroke-width="3" />
        <text x="65" y="58" fill="#ff3b5c">
          1
        </text>
        <rect x="86" y="24" width="30" height="46" rx="9" fill="#0a1030" stroke="#ffc23b" stroke-width="4" />
        <text x="101" y="56" fill="#ffc23b">
          2
        </text>
        <rect x="122" y="30" width="26" height="40" rx="9" fill="#0a1030" stroke="#2ef2ff" stroke-width="3" />
        <text x="135" y="58" fill="#2ef2ff">
          4
        </text>
      </g>
      <path
        d="M101 80v14M94 88l7 8 7-8"
        fill="none"
        stroke="#ffc23b"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
