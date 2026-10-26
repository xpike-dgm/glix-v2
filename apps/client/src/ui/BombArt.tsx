import type { JSX } from "solid-js";
import { propSrc } from "./props.js";
import "./bomb.css";

/**
 * Bomba: gövde + fitil + fitil ucunda kıvılcım. Görseller süstür (ekran okuyucuya gizli); içerik (ör. süre) gizlenmez.
 * Kök kutu gövdenin boyutudur; fitil ve kıvılcım üstüne taşar. `children` gövdenin ortasına konur.
 */
export function BombArt(props: { class?: string; spark?: boolean; children?: JSX.Element }) {
  return (
    <span class={`bomb ${props.class ?? ""}`}>
      <img
        class="bomb__fuse"
        src={propSrc("bomba/fitil")}
        alt=""
        aria-hidden="true"
        draggable={false}
        width="384"
        height="384"
      />
      <img
        class="bomb__body"
        src={propSrc("bomba/govde")}
        alt=""
        aria-hidden="true"
        draggable={false}
        width="384"
        height="384"
      />
      {props.spark === false ? null : (
        <img
          class="bomb__spark"
          src={propSrc("bomba/kivilcim")}
          alt=""
          aria-hidden="true"
          draggable={false}
          width="384"
          height="384"
        />
      )}
      {props.children}
    </span>
  );
}

/** Patlama bulutu; kök kutunun ortasında büyüyüp söner. */
export function BlastArt(props: { class?: string }) {
  return (
    <img
      class={`blast ${props.class ?? ""}`}
      src={propSrc("bomba/patlama")}
      alt=""
      aria-hidden="true"
      draggable={false}
      width="384"
      height="384"
    />
  );
}
