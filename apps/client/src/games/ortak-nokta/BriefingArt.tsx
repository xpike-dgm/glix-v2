import "./ortak-nokta.css";

/** Anlatım görseli: üç oyuncunun parmağı aynı parlayan şekle gider. */
export default function BriefingArt() {
  return (
    <svg class="onkart" viewBox="0 0 160 110" aria-hidden="true" role="presentation">
      <title>Ortak kutu</title>
      <rect x="16" y="20" width="36" height="36" rx="9" fill="#0a1030" stroke="#2ef2ff" stroke-width="3" />
      <circle cx="34" cy="38" r="9" fill="#2ef2ff" />
      <rect x="62" y="20" width="36" height="36" rx="9" fill="#0a1030" stroke="#ffc23b" stroke-width="4" />
      <path d="M80 27l3.6 7.6 8.2 1-6 5.6 1.6 8.2L80 45.5l-7.4 4 1.6-8.2-6-5.6 8.2-1z" fill="#ffc23b" />
      <rect x="108" y="20" width="36" height="36" rx="9" fill="#0a1030" stroke="#ff2bd6" stroke-width="3" />
      <path d="M126 27l10 10-10 10-10-10z" fill="#ff2bd6" />
      <g fill="none" stroke="#b6ff3b" stroke-width="3" stroke-linecap="round">
        <path d="M30 96c10-18 36-24 50-40" />
        <path d="M80 98V62" />
        <path d="M130 96c-10-18-36-24-50-40" />
      </g>
      <circle cx="80" cy="60" r="6" fill="#ffc23b" />
    </svg>
  );
}
