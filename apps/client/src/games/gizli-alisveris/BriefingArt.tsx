import "./gizli-alisveris.css";

/** Anlatım görseli: neon raf, üç ürün; ortadaki iki kişiyle paylaşılınca değeri yarıya iner, sağdaki altın parlar. */
export default function BriefingArt() {
  return (
    <svg class="aart" viewBox="0 0 140 130" aria-hidden="true" role="presentation">
      <title>Neon raf</title>
      <rect x="10" y="94" width="120" height="8" rx="4" fill="#0a1030" stroke="#8e97c7" stroke-width="2" />
      <rect x="20" y="52" width="26" height="36" rx="7" fill="#2ef2ff" opacity=".85" />
      <rect x="57" y="52" width="26" height="36" rx="7" fill="#ff2bd6" opacity=".85" />
      <rect class="aart__gold" x="94" y="38" width="26" height="50" rx="7" fill="#ffc23b" />
      <text x="70" y="44" text-anchor="middle" font-size="13" font-weight="800" fill="#f3f5ff">
        ÷2
      </text>
      <circle class="aart__coin" cx="33" cy="22" r="8" fill="#ffc23b" />
      <circle class="aart__coin aart__coin--b" cx="70" cy="18" r="6" fill="#ffc23b" opacity=".7" />
      <rect x="22" y="108" width="96" height="10" rx="5" fill="#121a45" />
      <rect x="22" y="108" width="62" height="10" rx="5" fill="#b6ff3b" />
    </svg>
  );
}
