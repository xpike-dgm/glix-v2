import { ALISVERIS_PROP_FILES, type PropPath, propSrc } from "../../ui/props.js";

/** Ürün simgesi: kimliğe karşılık gelen ürün görseli. */
export function UrunArt(props: { id: number; name: string; decorative?: boolean }) {
  const file = () => ALISVERIS_PROP_FILES[props.id] ?? ALISVERIS_PROP_FILES[0] ?? "";
  return (
    <img
      class="uart"
      src={propSrc(`gizli-alisveris/${file()}` as PropPath)}
      alt={props.decorative ? "" : props.name}
      draggable={false}
      width="384"
      height="384"
    />
  );
}
