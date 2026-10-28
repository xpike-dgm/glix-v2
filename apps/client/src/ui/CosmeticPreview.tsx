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
  size: number;
  /** Hangi parça gösterilir: yalnız avatar (çerçeve), yalnız ad + unvan (kart), ikisi (büyük önizleme). */
  parts?: "avatar" | "name" | "both";
}) {
  return (
    <span class="cpv" style={{ "--cpv-av": `${props.size}px` }}>
      <Show when={props.parts !== "name"}>
        <Avatar index={props.avatar} size={props.size} frame={frameOf(props.cosmetics)} />
      </Show>
      <Show when={props.parts !== "avatar"}>
        <span class="cpv__name">
          <PlayerName name={props.name} cosmetics={props.cosmetics} />
        </span>
        <PlayerTitle cosmetics={props.cosmetics} />
      </Show>
    </span>
  );
}
