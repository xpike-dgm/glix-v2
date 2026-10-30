// biome-ignore-all lint/a11y/noSvgWithoutTitle: şekiller dekoratif (aria-hidden); anlamı tuşun aria-label değeri taşır
import { ZAMAN_BOMBASI_COLORS, type ZamanBombasiColor } from "@glix/engine";
import type { JSX } from "solid-js";
import { padNote } from "./sfx.js";

export interface PadInfo {
  color: ZamanBombasiColor;
  /** Ekran okuyucu ve anlatım için ad. */
  label: string;
  /** Yan yana iki nota arasında bile ayırt edilsin diye her renge ayrı bir ses. */
  freq: number;
}

/** Konsol düzeni: üstte yeşil–kırmızı, altta sarı–mavi. */
export const PADS: readonly PadInfo[] = [
  { color: "yesil", label: "Yeşil", freq: 392 },
  { color: "kirmizi", label: "Kırmızı", freq: 330 },
  { color: "sari", label: "Sarı", freq: 494 },
  { color: "mavi", label: "Mavi", freq: 262 },
];

export const PAD_COUNT = ZAMAN_BOMBASI_COLORS.length;

const freqOf = (c: ZamanBombasiColor): number => PADS.find((p) => p.color === c)?.freq ?? 330;

/** Renk körlüğü için her renge ayrı bir şekil: yeşil kare, kırmızı üçgen, sarı yıldız, mavi daire. */
export function PadSymbol(props: { color: ZamanBombasiColor }): JSX.Element {
  const common = {
    viewBox: "0 0 100 100",
    "aria-hidden": "true" as const,
    class: "zpad__sym",
    fill: "currentColor",
  };
  switch (props.color) {
    case "yesil":
      return (
        <svg {...common}>
          <rect x="22" y="22" width="56" height="56" rx="8" />
        </svg>
      );
    case "kirmizi":
      return (
        <svg {...common}>
          <path d="M50 16 L86 80 H14 Z" stroke="currentColor" stroke-width="8" stroke-linejoin="round" />
        </svg>
      );
    case "sari":
      return (
        <svg {...common}>
          <path
            d="M50 12 L61.8 38.4 L90.6 41.4 L69 60.8 L75.2 89 L50 74.4 L24.8 89 L31 60.8 L9.4 41.4 L38.2 38.4 Z"
            stroke="currentColor"
            stroke-width="5"
            stroke-linejoin="round"
          />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="31" />
        </svg>
      );
  }
}

/** Bir tuşun sesi (dolgun nota, ZB-U9): ışık süresine göre kısa ya da uzun. */
export function padSound(color: ZamanBombasiColor, durMs: number): void {
  padNote(freqOf(color), durMs);
}
