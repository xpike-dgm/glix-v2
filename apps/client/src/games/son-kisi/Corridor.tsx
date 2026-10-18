import "./son-kisi.css";

/** Sakin neon koridor: ufka giden çizgiler ve sonunda kapı. Işık nabzı `--pulse` ile hızlanır. */
export function Corridor() {
  return (
    <svg
      class="skcor"
      viewBox="0 0 200 260"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
    >
      <title>Koridor</title>
      <g class="skcor__walls">
        <path d="M0 260 L72 70 M200 260 L128 70" />
        <path d="M0 160 L72 70 M200 160 L128 70" />
        <path d="M0 40 L72 70 M200 40 L128 70" />
      </g>
      <g class="skcor__floor">
        <path d="M72 70h56M58 104h84M40 150h120M14 214h172" />
      </g>
      <rect class="skcor__door" x="88" y="46" width="24" height="36" rx="3" />
      <rect class="skcor__light" x="94" y="52" width="12" height="24" rx="2" />
    </svg>
  );
}
