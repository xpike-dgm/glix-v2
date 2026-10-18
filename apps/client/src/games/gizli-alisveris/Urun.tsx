import { productColor, productInitials, productShape } from "./view.js";

/** Ürün simgesi: kimlikten türeyen renk ve şekil, üstünde kısaltma. */
export function UrunArt(props: { id: number; name: string }) {
  return (
    <span class="uart" data-shape={productShape(props.id)} style={{ "--pc": productColor(props.id) }}>
      <b class="uart__t">{productInitials(props.name)}</b>
    </span>
  );
}
