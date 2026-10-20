// biome-ignore-all lint/a11y/noSvgWithoutTitle: simge dekoratif (aria-hidden)
interface Props {
  size?: number | string;
  class?: string;
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
      <path
        d="M3 9c6-4 13-5 21-2 8-3 15-2 21 2 1 9-3 18-11 20-4 1-7-2-10-6-3 4-6 7-10 6C6 27 2 18 3 9z"
        fill="currentColor"
      />
      <ellipse cx="15" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(14 15 15)" />
      <ellipse cx="33" cy="15" rx="5" ry="3.2" fill="#05081a" transform="rotate(-14 33 15)" />
    </svg>
  );
}
