import { propSrc } from "../../ui/props.js";

/** Neon nişangâh görseli. Süs görselidir; renk vurgusu çevresindeki parıltıdan gelir. */
export function Sight() {
  return (
    <img
      class="ca__sight-svg"
      src={propSrc("genel/nisangah")}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="384"
      height="384"
    />
  );
}
