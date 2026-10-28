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
export const QrIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2.2}>
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v6h-6M17 17h3" />
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
export const StarIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2} stroke-linejoin="round">
    <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8L12 3.2z" />
  </svg>
);
export const GearIcon = (p: P) => (
  <svg {...base(p)} stroke-width={2}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20c0-3.4 2.8-6 6.2-6s6.2 2.6 6.2 6" />
    <path d="M16 4.8a3.2 3.2 0 010 6.2M18.4 14.4c1.8.8 2.8 2.6 2.8 5.6" />
  </svg>
);
export const ChevronRightIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const UserIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20.5c0-3.8 3.2-6.5 7.2-6.5s7.2 2.7 7.2 6.5" />
  </svg>
);
export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
    <path d="M10.5 18.5h3" />
  </svg>
);
export const BellIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.6 2H4.4l1.6-2zM10 21h4" />
  </svg>
);
export const KeyIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8.5-8.5M16 7l3 3" />
  </svg>
);
export const InfoIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.6v.1" />
  </svg>
);
export const PencilIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
  </svg>
);

/**
 * Glix jetonu: basit çizim (altın daire, iç halka, ortada eşkenar baklava). Gerçek çizim sonra gelecek; yerine
 * koymak için yalnız bu bileşen değişir.
 */
export const CoinIcon = (p: P) => (
  <svg {...base(p)} stroke-width={1.8}>
    <circle cx="12" cy="12" r="9.4" fill="var(--amber)" stroke="#8a5a00" />
    <circle cx="12" cy="12" r="6.4" fill="none" stroke="#8a5a00" />
    <path d="M12 8.2l3 3.8-3 3.8-3-3.8z" fill="#8a5a00" stroke="none" />
  </svg>
);

/** Dolap (askı): Dolabım girişi. */
export const HangerIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 7.5V6.4a2.2 2.2 0 1 0-2.2-2.2" />
    <path d="M12 7.5 3.4 14a1.6 1.6 0 0 0 1 2.9h15.2a1.6 1.6 0 0 0 1-2.9z" />
  </svg>
);
/** Alışveriş çantası: Mağaza girişi. */
export const BagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 8h14l-1 12.2H6z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </svg>
);
