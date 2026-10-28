// biome-ignore-all lint/a11y/noSvgWithoutTitle: simgeler dekoratif (aria-hidden); anlamı yanındaki etiket taşır
import type { JSX } from "solid-js";

type P = { size?: number | string; class?: string };
const base = (p: P): JSX.SvgSVGAttributes<SVGSVGElement> => ({
  width: p.size ?? 24,
  height: p.size ?? 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2.2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
  class: p.class,
});

/** Podyum madalyası: kurdele + yuvarlak; renk `currentColor` (altın/gümüş/bronz bloktan gelir). */
export const MedalIcon = (p: P) => (
  <svg {...base(p)} stroke="none" fill="currentColor">
    <path d="M7 2h4l1.4 5.2-3 .8L7 2zM17 2h-4l-1.4 5.2 3 .8L17 2z" opacity="0.55" />
    <circle cx="12" cy="15" r="7" />
    <circle cx="12" cy="15" r="4.6" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" />
    <path d="M12 11.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="rgba(0,0,0,0.34)" />
  </svg>
);

/** Bayrak: "Oyuncuyu bildir" düğmesinin simgesi. */
export const FlagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);

/** Gülen yüz: tepki yelpazesini açan düğmenin simgesi. */
export const SmileIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.2 14.2c.9 1.5 2.2 2.3 3.8 2.3s2.9-.8 3.8-2.3" />
    <path d="M9 9.6v.4M15 9.6v.4" stroke-width="3" />
  </svg>
);
