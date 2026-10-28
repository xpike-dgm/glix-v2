// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden); anlamı yanındaki metin taşır
import type { JSX } from "solid-js";

type P = { size?: number | string; class?: string };
const base = (p: P): JSX.SvgSVGAttributes<SVGSVGElement> => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2.4,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
  class: p.class,
});

/** Ev sahibi işareti: küçük ev (taç "kazanan" gibi okunduğu için lobide kullanılmaz). */
export const HouseIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 3.2l9 7.6c.5.4.2 1.2-.5 1.2H19v7.2c0 .9-.7 1.6-1.6 1.6H14v-5.3h-4V21H6.6C5.7 21 5 20.3 5 19.4V12H3.5c-.7 0-1-.8-.5-1.2l9-7.6z" />
  </svg>
);
export const FlagIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2.2}>
    <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />
  </svg>
);
export const UserPlusIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2.2}>
    <circle cx="10" cy="8" r="3.6" />
    <path d="M3.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6" />
  </svg>
);
export const TransferIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2.2}>
    <path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" />
  </svg>
);
