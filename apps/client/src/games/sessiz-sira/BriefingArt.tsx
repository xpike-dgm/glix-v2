import "./sessiz-sira.css";

/** Anlatım görseli: küçükten büyüğe dizilen üç kart ve parmak dudağında. */
export default function BriefingArt() {
  return (
    <svg class="ssrart" viewBox="0 0 160 110" aria-hidden="true" role="presentation">
      <title>Sessiz sıra</title>
      <g font-family="Unbounded, sans-serif" font-weight="800" font-size="20" text-anchor="middle">
        <rect x="14" y="44" width="38" height="50" rx="9" fill="#0a1030" stroke="#b6ff3b" stroke-width="3" />
        <text x="33" y="76" fill="#b6ff3b">
          12
        </text>
        <rect x="62" y="36" width="38" height="50" rx="9" fill="#0a1030" stroke="#2ef2ff" stroke-width="3" />
        <text x="81" y="68" fill="#2ef2ff">
          47
        </text>
        <rect x="110" y="28" width="38" height="50" rx="9" fill="#0a1030" stroke="#ff2bd6" stroke-width="3" />
        <text x="129" y="60" fill="#ff2bd6">
          90
        </text>
      </g>
      <path d="M20 22h120" stroke="#8e97c7" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round" />
      <path
        d="M130 14l10 8-10 8"
        fill="none"
        stroke="#8e97c7"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
