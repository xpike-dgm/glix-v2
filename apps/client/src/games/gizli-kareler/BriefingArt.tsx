import "./gizli-kareler.css";

/** Anlatım görseli: 3×3 neon ızgara; iki enerji aynı karede söner, tek kalan altın sütunla yükselir. */
export default function BriefingArt() {
  const cells = Array.from({ length: 9 }, (_, i) => ({
    x: 14 + (i % 3) * 38,
    y: 12 + Math.floor(i / 3) * 38,
  }));
  return (
    <svg class="kart" viewBox="0 0 140 130" aria-hidden="true" role="presentation">
      <title>Gizli kareler</title>
      {cells.map((c, i) => (
        <rect
          x={c.x}
          y={c.y}
          width="32"
          height="32"
          rx="8"
          fill="#0a1030"
          stroke={i === 2 ? "#ffc23b" : i === 3 ? "#ff3b5c" : "#8e97c7"}
          stroke-width="2"
        />
      ))}
      <rect class="kart__beam" x="94" y="12" width="32" height="32" rx="8" fill="#ffc23b" opacity=".28" />
      <circle class="kart__core" cx="110" cy="28" r="8" fill="#ffc23b" />
      <circle cx="24" cy="42" r="6" fill="#ff2bd6" opacity=".7" />
      <circle cx="36" cy="54" r="6" fill="#2ef2ff" opacity=".7" />
      <path d="M22 46 L40 60 M40 46 L22 60" stroke="#ff3b5c" stroke-width="3" stroke-linecap="round" />
      <circle class="kart__core" cx="70" cy="104" r="5" fill="#8e97c7" opacity=".6" />
    </svg>
  );
}
