import { createEffect, createSignal, type JSX, onCleanup, Show } from "solid-js";
import { hueShiftFor } from "../character/look.js";
import type { PosterFocus } from "../character/poster.js";
import { look } from "./avatars.js";

/**
 * Durağan karakter afişi: mağaza ve dolap karolarında. Afiş Pixi ile tembel çizilip resme çevrilir (önbellekli);
 * hazır olana kadar `fallback` (oyuncunun avatarı) görünür. Çizilemezse fallback kalır. Izgarada animasyon yoktur.
 */
export function CharacterPoster(props: {
  /** Kimlik renginin kaynağı (avatar sırası). */
  avatar: number;
  layers: readonly string[];
  dance: string | null;
  focus: PosterFocus;
  /** Ekran okuyucu için kısa ad. */
  label: string;
  fallback: JSX.Element;
}) {
  const [src, setSrc] = createSignal<string | null>(null);
  let gone = false;
  onCleanup(() => {
    gone = true;
  });
  createEffect(() => {
    const req = {
      layers: [...props.layers],
      dance: props.dance,
      hue: hueShiftFor(look(props.avatar).color),
      focus: props.focus,
    };
    void import("../character/poster.js")
      .then((m) => m.renderPoster(req))
      .then((url) => {
        if (!gone) setSrc(url);
      })
      .catch(() => {
        // afiş çizilemedi: avatar kalır
      });
  });
  return (
    <span class="cposter" data-focus={props.focus} data-ready={src() ? "1" : undefined}>
      <Show when={src()} fallback={<span class="cposter__ph">{props.fallback}</span>}>
        {(url) => <img class="cposter__img" src={url()} alt={props.label} draggable={false} />}
      </Show>
    </span>
  );
}
