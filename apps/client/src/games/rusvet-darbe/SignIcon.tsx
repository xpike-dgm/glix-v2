import type { Sign } from "@glix/engine";
import { type PropPath, propSrc } from "../../ui/props.js";

const FILES: Record<Sign, PropPath> = {
  tas: "genel/el-tas",
  kagit: "genel/el-kagit",
  makas: "genel/el-makas",
};

/** Taş, kâğıt ve makas elleri. Süs görselidir; anlamı çevresindeki metinde. */
export function SignIcon(props: { sign: Sign; size?: number | string }) {
  const size = () => (typeof props.size === "number" ? `${props.size}px` : (props.size ?? "40px"));
  return (
    <img
      class="rd__sign-svg"
      src={propSrc(FILES[props.sign])}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="384"
      height="384"
      style={{ width: size(), height: size() }}
    />
  );
}
