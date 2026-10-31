// biome-ignore-all lint/a11y/noSvgWithoutTitle: bomba dekoratiftir (aria-hidden); süre metinde/ekran okuyucuda verilir
import { createEffect, type JSX, onCleanup, Show } from "solid-js";
import "./fuse-bomb.css";

/** Görsel (fitilsiz gövde) eklendiyse yapı bunu true verir; yoksa SVG gövde çizilir (bkz. vite.config.ts). */
const BODY_IMAGE = typeof __ZB_BOMBA_GORSEL__ !== "undefined" && __ZB_BOMBA_GORSEL__ === true;
export const BOMB_BODY_SRC = "/assets/props/zaman-bombasi-hafizasi/bomba.webp";

/** Fitil yolu: gövdenin sağ üstündeki ağızdan dışarı kıvrılır (viewBox 0 0 120 120). */
const FUSE_PATH = "M84 31 C 92 20, 88 12, 97 8 S 112 6, 113 15";
/** SVG gradyan kimlikleri sayfada tekil olsun (aynı anda birden çok bomba çizilebilir). */
let uidSeq = 0;

/**
 * Fitilli bomba (ZB-U1): giriş süresi fitilin yanmasıyla gösterilir. `burnt` 0 (yeni) … 1 (bitti); kıvılcım fitilin
 * yanan ucunda durur. Gövde, görsel varsa o (`bomba.webp`, fitilsiz), yoksa SVG. Yalnız transform/opacity ve
 * SVG çizgi boyu değişir.
 */
export function FuseBomb(props: {
  class?: string;
  /** Yanmış pay (0–1); `live` değilken fitil tamdır. */
  burnt: () => number;
  live: boolean;
  /** Son 2 sn: kıvılcım büyür ve titrer. */
  rush?: boolean;
  children?: JSX.Element;
}) {
  const uid = `zbomb${++uidSeq}`;
  let fuse: SVGPathElement | undefined;
  let spark: SVGGElement | undefined;
  createEffect(() => {
    const b = props.live ? props.burnt() : 0;
    if (!fuse) return;
    const len = fuse.getTotalLength?.() ?? 0;
    if (len <= 0) return;
    // Fitil gövdeden uca çizilir: yanmamış kısım baştan `kalan` uzunlukta görünür.
    const left = len * (1 - Math.min(1, Math.max(0, b)));
    fuse.style.strokeDasharray = `${left} ${len}`;
    const p = fuse.getPointAtLength(left);
    spark?.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
  });
  onCleanup(() => {
    fuse = undefined;
  });
  return (
    <span
      class={`zbomb ${props.class ?? ""}`}
      data-live={props.live ? "1" : undefined}
      data-rush={props.rush ? "1" : undefined}
      aria-hidden="true"
    >
      <Show when={BODY_IMAGE}>
        <img class="zbomb__img" src={BOMB_BODY_SRC} alt="" draggable={false} width="384" height="384" />
      </Show>
      <svg class="zbomb__svg" viewBox="0 0 120 120">
        <defs>
          <radialGradient id={`${uid}-body`} cx="38%" cy="34%" r="70%">
            <stop offset="0%" stop-color="#4a5280" />
            <stop offset="45%" stop-color="#1b1f3d" />
            <stop offset="100%" stop-color="#07081a" />
          </radialGradient>
          <radialGradient id={`${uid}-spark`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff" />
            <stop offset="35%" stop-color="#ffe27a" />
            <stop offset="70%" stop-color="#ff8a2b" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#ff3b5c" stop-opacity="0" />
          </radialGradient>
        </defs>
        <Show when={!BODY_IMAGE}>
          <g class="zbomb__body">
            <circle cx="54" cy="70" r="40" fill={`url(#${uid}-body)`} stroke="#05061a" stroke-width="4" />
            <path
              d="M30 52 C 36 40, 48 34, 60 33"
              fill="none"
              stroke="rgba(170,190,255,.55)"
              stroke-width="5"
              stroke-linecap="round"
            />
            <circle cx="33" cy="62" r="3.5" fill="rgba(200,215,255,.5)" />
            <g transform="rotate(38 80 34)">
              <rect
                x="70"
                y="24"
                width="20"
                height="16"
                rx="3"
                fill="#2a2f55"
                stroke="#05061a"
                stroke-width="3"
              />
              <rect x="72" y="26" width="16" height="4" rx="2" fill="rgba(46,242,255,.55)" />
            </g>
          </g>
        </Show>
        <path class="zbomb__fuse-base" d={FUSE_PATH} />
        <path class="zbomb__fuse" d={FUSE_PATH} ref={fuse} />
        <g class="zbomb__spark" ref={spark}>
          <g class="zbomb__spark-in">
            <circle r="9" fill={`url(#${uid}-spark)`} />
            <path d="M0 -8 L1.6 -1.6 L8 0 L1.6 1.6 L0 8 L-1.6 1.6 L-8 0 L-1.6 -1.6 Z" fill="#fff6c8" />
          </g>
        </g>
      </svg>
      {props.children}
    </span>
  );
}
