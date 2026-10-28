import type { Cosmetics } from "@glix/engine";
import type { JSX } from "solid-js";
import { CharacterStage } from "./CharacterStage.js";

/**
 * Tek canlı karakter (mağaza satın alma sayfası, dolap): kuşanılan giysilerle ve verilen dansla oynar.
 * Kutu içine sığar; karakter hazır olana kadar `fallback` (avatar) görünür. Azaltılmış harekette durağan duruş.
 */
export function CharacterView(props: {
  avatar: number;
  /** Giysiler ve dans bu kümeden alınır (önizlenen ürün kuşanılanların üstüne eklenmiş olabilir). */
  cosmetics: Cosmetics | undefined;
  fallback: JSX.Element;
  class?: string;
}) {
  return (
    <div class={`cview ${props.class ?? ""}`}>
      <div class="cview__ph">{props.fallback}</div>
      <div class="cview__box" data-cslot="gorunum" />
      <CharacterStage
        chars={[{ key: "gorunum", avatar: props.avatar, cosmetics: props.cosmetics, act: "dance" }]}
      />
    </div>
  );
}
