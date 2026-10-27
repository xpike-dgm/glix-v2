// biome-ignore-all lint/a11y/noSvgWithoutTitle: madalyon dekoratif (aria-hidden); anlamı yanındaki metin taşır
import { Match, Show, Switch } from "solid-js";
import { type MedalGlyph, type MedalShape, medalGlyph, medalShape } from "../net/badgeRules.js";

interface Props {
  id: string;
  earned: boolean;
  secret?: boolean;
  size?: number;
}

/** Şekil dış çizgisi (100x100 kutu). Renk körlüğü için aile şekille de ayırt edilir. */
const SHAPES: Record<MedalShape, string> = {
  circle: "M50 6a44 44 0 110 88 44 44 0 010-88z",
  hex: "M50 5l39 22.5v45L50 95 11 72.5v-45L50 5z",
  diamond: "M50 4l46 46-46 46L4 50 50 4z",
  square: "M26 8h48a18 18 0 0118 18v48a18 18 0 01-18 18H26A18 18 0 018 74V26A18 18 0 0126 8z",
};

/** Simge çizimleri (24x24 kutu, çizgi). */
const ICONS: Record<Extract<MedalGlyph, { kind: "icon" }>["name"], string> = {
  bayrak: "M6 21V4M6 4h11l-2.5 4L17 12H6",
  kupa: "M8 4h8v5a4 4 0 01-8 0V4zM8 6H5v2a3 3 0 003 3M16 6h3v2a3 3 0 01-3 3M12 13v4M8 20h8M10 17h4",
  yildiz: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z",
  kare4: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  kisiler:
    "M8 9a3 3 0 100-6 3 3 0 000 6zM17 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6M14 14.5c.9-.4 1.9-.5 3-.5 2.5 0 4.5 2.4 4.5 6",
  kalp: "M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z",
  simsek: "M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z",
  ay: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  parilti: "M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z",
  soru: "M9 9a3 3 0 115 2c-1 .8-2 1.3-2 3M12 18h.01",
};

/**
 * Rozet madalyonu: şekil + simge (ya da sayı). Kazanılmamış olan sönük ve kesik çizgilidir;
 * gizli ve kazanılmamış olanda yalnız "?" görünür.
 */
export function BadgeMedal(props: Props) {
  const hidden = () => props.secret === true && !props.earned;
  const shape = () => medalShape(props.id, props.secret === true);
  const glyph = (): MedalGlyph => (hidden() ? { kind: "icon", name: "soru" } : medalGlyph(props.id));
  const size = () => props.size ?? 64;
  return (
    <svg
      class="bd__medal"
      data-earned={props.earned ? "1" : undefined}
      data-shape={shape()}
      width={size()}
      height={size()}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path class="bd__shape" d={SHAPES[shape()]} />
      <Switch>
        <Match when={glyph().kind === "number"}>
          <text
            class="bd__num"
            x="50"
            y="50"
            text-anchor="middle"
            dominant-baseline="central"
            font-size={String((glyph() as { text: string }).text.length > 2 ? 30 : 38)}
          >
            {(glyph() as { text: string }).text}
          </text>
        </Match>
        <Match when={glyph().kind === "icon"}>
          <g transform="translate(26 26) scale(2)" class="bd__icon">
            <path d={ICONS[(glyph() as { name: keyof typeof ICONS }).name]} />
          </g>
        </Match>
      </Switch>
      <Show when={props.earned}>
        <path class="bd__shine" d="M22 30c6-12 18-18 30-18" />
      </Show>
    </svg>
  );
}
