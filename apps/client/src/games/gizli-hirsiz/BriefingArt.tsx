import "./gizli-hirsiz.css";

/** Anlatım görseli: karanlık güvenlik çekirdeği ve üzerinde beliren parmak izi. */
export default function BriefingArt() {
  return (
    <svg class="ghart" viewBox="0 0 120 120" aria-hidden="true" role="presentation">
      <title>Kasa</title>
      <circle cx="60" cy="60" r="54" fill="none" stroke="#2ef2ff" stroke-width="2" opacity="0.35" />
      <circle cx="60" cy="60" r="42" fill="none" stroke="#8b5cff" stroke-width="2" opacity="0.5" />
      <circle cx="60" cy="60" r="30" fill="#05081a" stroke="#2ef2ff" stroke-width="3" />
      <g class="ghart__print" fill="none" stroke="#2ef2ff" stroke-width="2.4" stroke-linecap="round">
        <path d="M48 66c0-8 5-14 12-14s12 6 12 14" />
        <path d="M53 68c0-5 3-9 7-9s7 4 7 9" />
        <path d="M58 70c0-2 1-3 2-3s2 1 2 3" />
      </g>
    </svg>
  );
}
