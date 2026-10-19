import { productColor, productShape } from "./view.js";

/** Ürün simgesi: kimlikten türeyen renk ve şekil (12 ürünün hepsi farklı). */
export function UrunArt(props: { id: number; name: string }) {
  return (
    <span
      class="uart"
      data-shape={productShape(props.id)}
      style={{ "--pc": productColor(props.id) }}
      role="img"
      aria-label={props.name}
    />
  );
}
