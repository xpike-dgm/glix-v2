import "./acgozluluk-limiti.css";

/** Anlatım görseli: limit çizgili neon hazne, içinde jetonlar. */
export default function BriefingArt() {
  return (
    <svg class="limart" viewBox="0 0 120 150" aria-hidden="true" role="presentation">
      <title>Hazne</title>
      <rect x="22" y="8" width="76" height="134" rx="14" fill="#0a1030" stroke="#2ef2ff" stroke-width="3" />
      <line x1="22" y1="50" x2="98" y2="50" stroke="#ffc23b" stroke-width="3" stroke-dasharray="7 5" />
      <circle class="limart__tok limart__tok--a" cx="44" cy="124" r="13" fill="#ff2bd6" />
      <circle class="limart__tok limart__tok--b" cx="76" cy="124" r="13" fill="#b6ff3b" />
      <circle class="limart__tok limart__tok--c" cx="60" cy="98" r="13" fill="#8b5cff" />
      <circle class="limart__tok limart__tok--d" cx="60" cy="70" r="13" fill="#ffc23b" />
    </svg>
  );
}
