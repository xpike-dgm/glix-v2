// biome-ignore-all lint/a11y/noSvgWithoutTitle: simge dekoratif (aria-hidden)
import { Show } from "solid-js";

interface Props {
  size?: number | string;
  class?: string;
}

const MASK_PATH = "M3 9c6-4 13-5 21-2 8-3 15-2 21 2 1 9-3 18-11 20-4 1-7-2-10-6-3 4-6 7-10 6C6 27 2 18 3 9z";
/** Kırık çizgisi: maskenin ortasından zikzakla iner (iki parçanın ortak kenarı). */
const CRACK = "24,4 21,10 26,14 22,19 25,24 23,31";

/** Sızma görseli derlemede var mı (`public/assets/props/sizma/<ad>.webp`); yoksa SVG çizilir, dosya istenmez. */
export function sizmaArt(name: string): string | null {
  const built = typeof __SIZMA_PROPS__ === "undefined" ? undefined : __SIZMA_PROPS__;
  return built?.includes(name) ? `/assets/props/sizma/${name}.webp` : null;
}

/** Sızma maskesi: iki göz deliği olan basit domino maskesi. */
export function Mask(props: Props) {
  return (
    <svg
      class={props.class}
      viewBox="0 0 48 32"
      width={props.size ?? 28}
      height={props.size ?? 28}
      aria-hidden="true"
    >
      <path d={MASK_PATH} fill="currentColor" />
      <ellipse cx="15" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(14 15 15)" />
      <ellipse cx="33" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(-14 33 15)" />
    </svg>
  );
}

/** Maskenin bir yarısı (kırılma için): sol ya da sağ parça, kırık kenarıyla. */
function MaskHalf(props: { side: "sol" | "sag" }) {
  const id = `szmh-${props.side}`;
  const poly =
    props.side === "sol"
      ? `0,0 24,0 ${CRACK} 0,32`
      : `24,0 48,0 48,32 ${CRACK.split(" ").reverse().join(" ")}`;
  return (
    <svg viewBox="0 0 48 32" width="100%" height="100%" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <polygon points={poly} />
        </clipPath>
      </defs>
      <g clip-path={`url(#${id})`}>
        <path d={MASK_PATH} fill="currentColor" />
        <ellipse cx="15" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(14 15 15)" />
        <ellipse cx="33" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(-14 33 15)" />
        <polyline points={CRACK} fill="none" stroke="#05081a" stroke-width="0.9" />
      </g>
    </svg>
  );
}

/**
 * Sonuçtaki büyük maske: bütün hâli ve kırılınca iki parçası. Görsel dosyası (maske, maske-parca-sol,
 * maske-parca-sag) varsa o kullanılır; yoksa aynı biçimde SVG çizilir.
 */
export function BigMask(props: { state: "on" | "wobble" | "broken" | "wink" | "off" }) {
  const whole = sizmaArt("maske");
  const left = sizmaArt("maske-parca-sol");
  const right = sizmaArt("maske-parca-sag");
  return (
    <span class="szmask" data-st={props.state} aria-hidden="true">
      <span class="szmask__whole">
        <Show when={whole} fallback={<Mask size="100%" />}>
          {(src) => <img src={src()} alt="" draggable={false} />}
        </Show>
      </span>
      <span class="szmask__half szmask__half--l">
        <Show when={left} fallback={<MaskHalf side="sol" />}>
          {(src) => <img src={src()} alt="" draggable={false} />}
        </Show>
      </span>
      <span class="szmask__half szmask__half--r">
        <Show when={right} fallback={<MaskHalf side="sag" />}>
          {(src) => <img src={src()} alt="" draggable={false} />}
        </Show>
      </span>
      <i class="szmask__chip szmask__chip--a" />
      <i class="szmask__chip szmask__chip--b" />
      <i class="szmask__chip szmask__chip--c" />
    </span>
  );
}
