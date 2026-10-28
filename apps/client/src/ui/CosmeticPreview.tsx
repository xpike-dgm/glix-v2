import { type CosmeticItem, type Cosmetics, cosmeticsFromEquipped } from "@glix/engine";
import { Show } from "solid-js";
import { Avatar } from "./Avatar.js";
import { frameOf, PlayerName, PlayerTitle } from "./Cosmetic.js";

/** Bir ürünü tek başına gösteren kozmetik kümesi (türüne göre tek alan). */
export function itemCosmetics(item: CosmeticItem): Cosmetics {
  return cosmeticsFromEquipped({ [item.type]: item.id }) ?? {};
}

/**
 * Önizleme: oyuncunun KENDİ avatarı ve adı üzerinde. `cosmetics` verilen küme çizilir (ürün ya da kuşanılanlar).
 * `size` avatar boyu; `compact` kartlarda yalnız ilgili parçayı büyütür.
 */
export function CosmeticPreview(props: {
  avatar: number;
  name: string;
  cosmetics: Cosmetics | undefined;
  size: number | string;
  /** Hangi parça gösterilir: yalnız avatar (çerçeve), yalnız ad + unvan (kart), ikisi (büyük önizleme). */
  parts?: "avatar" | "name" | "title" | "both";
  /** Unvan levha üzerinde mi (büyük önizleme) yoksa düz metin mi. */
  plate?: boolean | undefined;
}) {
  return (
    <span class="cpv" style={{ "--cpv-av": typeof props.size === "number" ? `${props.size}px` : props.size }}>
      <Show when={props.parts !== "name"}>
        <span class="cpv__av">
          <Avatar index={props.avatar} size={props.size} frame={frameOf(props.cosmetics)} />
        </span>
      </Show>
      <Show when={props.parts !== "avatar" && props.parts !== "title"}>
        <span class="cpv__name">
          <PlayerName name={props.name} cosmetics={props.cosmetics} />
        </span>
      </Show>
      <Show when={props.parts !== "avatar"}>
        <PlayerTitle cosmetics={props.cosmetics} plate={props.plate} />
      </Show>
    </span>
  );
}
