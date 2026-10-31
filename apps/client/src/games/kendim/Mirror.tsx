import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { kendimArtUrl } from "./art.js";

interface Props {
  /** Tamam anında kısa ışık çakması. */
  flash?: boolean;
  /** Yazı kilitlendi: cam soğur, kelime kazınmış görünür. */
  locked?: boolean;
  /** Boşluk denendi: kısa sallanma. */
  shake?: boolean;
  class?: string;
  children?: JSX.Element;
}

/**
 * KN-U1: gotik, mor-altın çerçeveli, hafif buğulu ayna. Çerçeve görseli (`ayna-cercevesi.webp`) varsa onu kullanır;
 * yoksa çerçeve CSS ile çizilir. İçerik (yazı panosu) camın ortasında durur.
 */
export function Mirror(props: Props) {
  const art = kendimArtUrl("ayna-cercevesi");
  return (
    <div
      class={`knm ${props.class ?? ""}`}
      data-art={art ? "1" : undefined}
      data-flash={props.flash ? "1" : undefined}
      data-locked={props.locked ? "1" : undefined}
      data-shake={props.shake ? "1" : undefined}
    >
      <div class="knm__glass" aria-hidden="true">
        <i class="knm__fog" />
        <i class="knm__shine" />
        <i class="knm__flash" />
      </div>
      <Show when={art}>{(src) => <img class="knm__frame" src={src()} alt="" aria-hidden="true" />}</Show>
      <div class="knm__in">{props.children}</div>
    </div>
  );
}
