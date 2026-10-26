import { propSrc } from "../../ui/props.js";
import "./son-kisi.css";

/** Sakin neon koridor: ufka giden çizgiler ve sonunda kaçış kolu. Işık nabzı `--pulse` ile hızlanır. */
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
      <image
        class="skcor__lever"
        href={propSrc("genel/kacis-kolu")}
        x="72"
        y="24"
        width="56"
        height="56"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
