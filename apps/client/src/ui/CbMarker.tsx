// biome-ignore-all lint/a11y/noSvgWithoutTitle: işaret dekoratif (aria-hidden); anlamı yanındaki metin ya da etiket taşır
import { cbIndex, cbShape } from "./cbShapes.js";

interface Props {
  /** Renk sırası (0–7); her sıraya ayrı bir şekil düşer. */
  index: number;
  size?: number | string;
  /** Mod kapalıyken de görünür (ucuz ve görünümü bozmayan yerlerde). */
  always?: boolean;
  class?: string;
}

/**
 * Renk körlüğü dostu modda renk yanına konan küçük şekil. Kapalıyken `display: none` (ui.css).
 * Renk: çevresindeki yazı rengi; zemin renkliyse ince koyu/açık kontur şekli ayırır.
 */
export function CbMarker(props: Props) {
  const s = () => cbShape(props.index);
  return (
    <svg
      class={`cbm ${props.class ?? ""}`}
      data-always={props.always ? "1" : undefined}
      data-shape={cbIndex(props.index)}
      width={props.size ?? 14}
      height={props.size ?? 14}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d={s().path}
        fill={s().outline ? "none" : "currentColor"}
        stroke={s().outline ? "currentColor" : "rgba(0,0,0,0.55)"}
        stroke-width={s().outline ? 3.4 : 1.6}
        stroke-linejoin="round"
        paint-order="stroke"
      />
    </svg>
  );
}

interface GlyphProps {
  index: number;
  /** Merkez noktası ve kenar uzunluğu, çevreleyen SVG'nin birimiyle. */
  cx: number;
  cy: number;
  size: number;
  /** Şeklin rengi; verilmezse çevreleyen yazı rengi. */
  color?: string;
  class?: string;
}

/** `CbMarker`ın SVG içi karşılığı: bir çizimin (örn. ipucu şeması) içine doğrudan yerleşir. */
export function CbGlyph(props: GlyphProps) {
  const s = () => cbShape(props.index);
  const k = () => props.size / 24;
  return (
    <g
      class={`cbm ${props.class ?? ""}`}
      data-shape={cbIndex(props.index)}
      transform={`translate(${props.cx - props.size / 2} ${props.cy - props.size / 2}) scale(${k()})`}
      style={props.color ? { color: props.color } : undefined}
    >
      <path
        d={s().path}
        fill={s().outline ? "none" : "currentColor"}
        stroke={s().outline ? "currentColor" : "rgba(0,0,0,0.6)"}
        stroke-width={s().outline ? 3.4 : 1.8}
        stroke-linejoin="round"
        paint-order="stroke"
      />
    </g>
  );
}
