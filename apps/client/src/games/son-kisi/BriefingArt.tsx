import "./son-kisi.css";

/** Anlatım görseli: neon koridor, sonunda kapı ve koşan bir gölge. */
export default function BriefingArt() {
  return (
    <svg class="skart" viewBox="0 0 120 120" aria-hidden="true" role="presentation">
      <title>Koridor</title>
      <path d="M8 112 L44 40 L76 40 L112 112" fill="none" stroke="#8b5cff" stroke-width="2" opacity="0.7" />
      <path d="M26 112 L48 54 L72 54 L94 112" fill="none" stroke="#2ef2ff" stroke-width="1.6" opacity="0.5" />
      <rect x="52" y="40" width="16" height="22" rx="2" fill="#0a1030" stroke="#b6ff3b" stroke-width="2" />
      <g class="skart__runner">
        <circle cx="60" cy="86" r="6" fill="#ffc23b" />
        <path
          d="M60 92v12M60 96l-7 6M60 96l7 6M60 104l-5 8M60 104l5 8"
          stroke="#ffc23b"
          stroke-width="3"
          stroke-linecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
