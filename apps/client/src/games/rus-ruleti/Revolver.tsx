import { propSrc } from "../../ui/props.js";

/** Oyuncak neon tabanca (yandan) ya da altı gözlü tambur (önden). Süs görselidir. */
export function Revolver(props: { class?: string; part?: "tabanca" | "tambur" }) {
  return (
    <img
      class={`rrgun ${props.class ?? ""}`}
      src={propSrc(props.part === "tambur" ? "rus-ruleti/tambur" : "rus-ruleti/tabanca")}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="384"
      height="384"
    />
  );
}
