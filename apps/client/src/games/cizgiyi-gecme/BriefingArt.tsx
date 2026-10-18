import "./cizgiyi-gecme.css";

/** Anlatım görseli: onluk neon platformlar, üstteki tek pin yükselir, alttaki iki pin çarpışıp söner. */
export default function BriefingArt() {
  return (
    <svg class="cgart" viewBox="0 0 140 130" aria-hidden="true" role="presentation">
      <title>Platformlar</title>
      <rect x="20" y="108" width="100" height="10" rx="5" fill="#0a1030" stroke="#8e97c7" stroke-width="2" />
      <rect x="20" y="84" width="100" height="10" rx="5" fill="#0a1030" stroke="#ff3b5c" stroke-width="2" />
      <rect x="20" y="60" width="100" height="10" rx="5" fill="#0a1030" stroke="#8e97c7" stroke-width="2" />
      <rect x="20" y="36" width="100" height="10" rx="5" fill="#0a1030" stroke="#8e97c7" stroke-width="2" />
      <rect x="20" y="12" width="100" height="10" rx="5" fill="#0a1030" stroke="#ffc23b" stroke-width="2" />
      <circle class="cgart__pin cgart__pin--a" cx="70" cy="7" r="9" fill="#ffc23b" />
      <circle cx="50" cy="79" r="8" fill="#ff2bd6" opacity=".55" />
      <circle cx="84" cy="79" r="8" fill="#2ef2ff" opacity=".55" />
      <path d="M44 72 L56 86 M56 72 L44 86" stroke="#ff3b5c" stroke-width="3" stroke-linecap="round" />
      <circle class="cgart__pin cgart__pin--b" cx="36" cy="103" r="8" fill="#b6ff3b" />
    </svg>
  );
}
