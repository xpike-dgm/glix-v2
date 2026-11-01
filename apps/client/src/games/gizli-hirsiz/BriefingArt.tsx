import "./gizli-hirsiz.css";

function Print(props: { x: number; y: number; color: string }) {
  return (
    <g fill="none" stroke={props.color} stroke-width="1.8" stroke-linecap="round">
      <ellipse cx={props.x} cy={props.y} rx="2.6" ry="3.6" />
      <ellipse cx={props.x} cy={props.y} rx="5.6" ry="7.2" />
      <ellipse cx={props.x} cy={props.y} rx="8.6" ry="10.8" />
    </g>
  );
}

/**
 * GH-U16: iki kareli anlatım döngüsü: tek parmak izi → yeşil kasa (+1); iki parmak izi → kırmızı alarm (−1).
 * Hareket azaltmada iki kare yan yana durur.
 */
export default function BriefingArt() {
  return (
    <svg class="ghart" viewBox="0 0 240 120" aria-hidden="true" role="presentation">
      <title>Tek hırsız kazanır, çok hırsız yanar</title>
      <g class="ghart__frame ghart__frame--solo">
        <circle cx="60" cy="56" r="44" fill="#05081a" stroke="#b6ff3b" stroke-width="3" />
        <circle cx="60" cy="56" r="34" fill="none" stroke="#b6ff3b" stroke-width="1.5" opacity="0.4" />
        <Print x={60} y={54} color="#b6ff3b" />
        <text x="60" y="114" text-anchor="middle" class="ghart__label" fill="#b6ff3b">
          ✓ +1
        </text>
      </g>
      <g class="ghart__frame ghart__frame--multi">
        <circle cx="180" cy="56" r="44" fill="#1a0510" stroke="#ff3b5c" stroke-width="3" />
        <circle cx="180" cy="56" r="34" fill="none" stroke="#ff3b5c" stroke-width="1.5" opacity="0.4" />
        <Print x={168} y={54} color="#ff3b5c" />
        <Print x={192} y={58} color="#ff3b5c" />
        <text x="180" y="114" text-anchor="middle" class="ghart__label" fill="#ff3b5c">
          ✕ −1
        </text>
      </g>
    </svg>
  );
}
