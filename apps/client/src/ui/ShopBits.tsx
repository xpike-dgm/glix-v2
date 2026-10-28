import { type CosmeticRarity, cosmeticItem, cosmeticType } from "@glix/engine";
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
        <s class="shop-price__old">{props.list}</s>
      </Show>
      <b>{props.price}</b>
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

/** Mağaza sekmeleri ve dolap bölümleri sırası: çerçeve, unvan, ad efekti (katalog sırasından bağımsız). */
export const SHOP_TYPES = (["cerceve", "unvan", "ad-efekti"] as const).map((id) => cosmeticType(id));
