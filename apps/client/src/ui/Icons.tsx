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

export const CrownIcon = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)} stroke-width={3.6}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const MinusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);
export const ShareIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const ExitIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 8l4 4-4 4M19 12H9" />
  </svg>
);
export const SoundOnIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />
  </svg>
);
export const SoundOffIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4zM16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);
export const RotateIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" transform="rotate(-90 12 12)" />
    <path d="M19 5.5a8 8 0 00-5-2M19 5.5V2M19 5.5h-3.5" />
  </svg>
);
export const EyeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);
