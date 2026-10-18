import "./ortalamanin-yarisi.css";

/** Anlatım görseli: kapalı neon kapsüller, ortada ortalama çizgisi ve altın hedef ışını. */
export default function BriefingArt() {
  return (
    <svg class="ortart" viewBox="0 0 160 110" aria-hidden="true" role="presentation">
      <title>Hedef</title>
      <line x1="14" y1="86" x2="146" y2="86" stroke="#8e97c7" stroke-width="2" stroke-linecap="round" />
      <line x1="94" y1="14" x2="94" y2="92" stroke="#2ef2ff" stroke-width="2" stroke-dasharray="5 4" />
      <line
        class="ortart__beam"
        x1="52"
        y1="8"
        x2="52"
        y2="92"
        stroke="#ffc23b"
        stroke-width="4"
        stroke-linecap="round"
      />
      <rect
        class="ortart__cap ortart__cap--a"
        x="40"
        y="52"
        width="24"
        height="34"
        rx="12"
        fill="#0a1030"
        stroke="#ffc23b"
        stroke-width="3"
      />
      <rect
        class="ortart__cap ortart__cap--b"
        x="82"
        y="40"
        width="24"
        height="46"
        rx="12"
        fill="#0a1030"
        stroke="#ff2bd6"
        stroke-width="3"
      />
      <rect
        class="ortart__cap ortart__cap--c"
        x="120"
        y="58"
        width="24"
        height="28"
        rx="12"
        fill="#0a1030"
        stroke="#8b5cff"
        stroke-width="3"
      />
      <text x="52" y="75" text-anchor="middle" fill="#ffc23b" font-size="15" font-weight="800">
        ?
      </text>
      <text x="94" y="68" text-anchor="middle" fill="#ff2bd6" font-size="15" font-weight="800">
        ?
      </text>
      <text x="132" y="77" text-anchor="middle" fill="#8b5cff" font-size="15" font-weight="800">
        ?
      </text>
    </svg>
  );
}
