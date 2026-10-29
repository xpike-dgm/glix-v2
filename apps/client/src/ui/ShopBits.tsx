import { CLOTHING_COLOURS, type ClothingColourId, type CosmeticRarity, cosmeticItem } from "@glix/engine";
import { For, Show } from "solid-js";
import { balanceText } from "../net/glixRules.js";
import { RARITY_LABEL } from "../net/shopRules.js";
import { setState, state } from "../net/store.js";
import { BagIcon, CoinIcon, HangerIcon } from "./Icons.js";
import { COIN_STACK_SRC } from "./shopArt.js";

/** Bakiye hapı: jeton yığını + "1.250 Glix". */
export function BalancePill(props: { balance: number }) {
  return (
    <span class="shop-bal" role="status" aria-label={`Glix bakiyen ${balanceText(props.balance)}`}>
      <img class="shop-bal__art" src={COIN_STACK_SRC} alt="" aria-hidden="true" draggable={false} />
      <b>{balanceText(props.balance)}</b>
      <span class="shop-bal__unit">Glix</span>
    </span>
  );
}

/** Fiyat: jeton + (varsa üstü çizili eski fiyat) + güncel fiyat. */
export function Price(props: { price: number; list?: number | undefined; size?: number }) {
  return (
    <span class="shop-price">
      <CoinIcon size={props.size ?? 20} />
      <Show when={props.list !== undefined && props.list !== props.price}>
        <s class="shop-price__old">{balanceText(props.list ?? 0)}</s>
      </Show>
      <b>{balanceText(props.price)}</b>
    </span>
  );
}

/** Nadirlik çipi (Sıradan / Nadir / Efsanevi). */
export function RarityChip(props: { rarity: CosmeticRarity }) {
  return (
    <span class="shop-chip" data-r={props.rarity}>
      {RARITY_LABEL[props.rarity]}
    </span>
  );
}

/** Ürün kimliğinden nadirlik (bilinmiyorsa sıradan). */
export const rarityOf = (id: string): CosmeticRarity => cosmeticItem(id)?.rarity ?? "siradan";

/** Alt sekme çubuğu: Mağaza | Dolabım. */
export function ShopTabBar(props: { active: "shop" | "locker" }) {
  const tabs = [
    { id: "shop", label: "Mağaza", Icon: BagIcon },
    { id: "locker", label: "Dolabım", Icon: HangerIcon },
  ] as const;
  return (
    <nav class="shop-nav" aria-label="Mağaza ve Dolabım">
      <For each={tabs}>
        {(t) => (
          <button
            type="button"
            class="shop-nav__tab"
            aria-current={props.active === t.id ? "page" : undefined}
            onClick={() => {
              if (state.nav !== t.id) setState("nav", t.id);
            }}
          >
            <t.Icon size={26} />
            <span>{t.label}</span>
          </button>
        )}
      </For>
    </nav>
  );
}

/**
 * Giysi rengi seçici: beş neon renk topu (camgöbeği, pembe, altın, yeşil, mor). Seçili olan halkalıdır; her top
 * en az 44 px dokunma alanıdır. `onPick` verilen rengi bildirir (sahiplik/kuşanma çağıranın işi).
 */
export function ColourSwatches(props: {
  value: ClothingColourId;
  onPick: (colour: ClothingColourId) => void;
  disabled?: boolean | undefined;
}) {
  return (
    <fieldset class="swatches" aria-label="Giysi rengi">
      <For each={CLOTHING_COLOURS}>
        {(c) => (
          <button
            type="button"
            class="swatch"
            aria-pressed={props.value === c.id}
            aria-label={c.name}
            data-colour={c.id}
            disabled={props.disabled}
            style={{ "--sw": c.hex }}
            onClick={() => props.onPick(c.id)}
          />
        )}
      </For>
    </fieldset>
  );
}
