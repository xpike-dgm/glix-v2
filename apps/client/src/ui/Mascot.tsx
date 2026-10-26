interface Props {
  pose: "varsayilan" | "merhaba" | "dusunuyor" | "saskin" | "kutluyor" | "bekliyor" | "tamir";
  /** px sayısı ya da CSS uzunluğu. */
  size: number | string;
  /** Hafif yukarı-aşağı salınım (reduced-motion'da durur). */
  bob?: boolean;
  class?: string;
}

/** Robot maskot. Süs görselidir; ekran okuyucuya gizli. */
export function Mascot(props: Props) {
  return (
    <img
      class={`mascot ${props.bob === false ? "" : "mascot--bob"} ${props.class ?? ""}`}
      style={{ "--ms": typeof props.size === "number" ? `${props.size}px` : props.size }}
      src={`/assets/mascot/${props.pose}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="512"
      height="512"
    />
  );
}
