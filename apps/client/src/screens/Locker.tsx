import {
  COSMETIC_TYPES,
  type CosmeticItem,
  type CosmeticTypeId,
  cosmeticItem,
  itemsOfType,
} from "@glix/engine";
import { createEffect, For, onMount, Show } from "solid-js";
import { equipItem, loadShop, ownCosmetics, shop, shopLoad } from "../net/shop.js";
import { ownedOfType, RARITY_LABEL, shopErrorText } from "../net/shopRules.js";
import { goHome, setState, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { avatarFromName } from "../ui/avatars.js";
import { EmptyPlate, frameOf, PlayerName, PlayerTitle, TitlePlate } from "../ui/Cosmetic.js";
import { CosmeticPreview, itemCosmetics } from "../ui/CosmeticPreview.js";
import { BackIcon, CheckIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";
import { SHOP_TYPES, ShopTabBar } from "../ui/ShopBits.js";
import { boxSrc } from "../ui/shopArt.js";

/** Bölüm başlığı yanındaki küçük simge (çember, taç, kıvılcım). */
function SecIcon(props: { type: CosmeticTypeId }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: dekoratif simge
    <svg class="locker-sec__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <Show when={props.type === "cerceve"}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="3" />
      </Show>
      <Show when={props.type === "unvan"}>
        <path
          d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "ad-efekti"}>
        <path
          d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"
          fill="currentColor"
        />
      </Show>
    </svg>
  );
}

/** Dolap karosu: ürünün kendi önizlemesi; kuşanılan karo vurgulu ve onay işaretli. */
function Tile(props: {
  type: CosmeticTypeId;
  item: CosmeticItem | null;
  label: string;
  on: boolean;
  name: string;
  onPick: () => void;
}) {
  const it = () => props.item;
  return (
    <button
      type="button"
      class="locker-tile"
      data-type={props.type}
      data-r={it()?.rarity ?? "yok"}
      data-on={props.on ? "1" : undefined}
      aria-pressed={props.on}
      aria-label={
        it() ? `${props.label}, ${RARITY_LABEL[it()?.rarity ?? "siradan"]}` : `${props.label}, kuşanma`
      }
      style={it() ? { "--box": `url(${boxSrc(it()?.rarity ?? "siradan")})` } : undefined}
      onClick={props.onPick}
    >
      <Show when={props.on}>
        <span class="locker-tile__tick" aria-hidden="true">
          <CheckIcon size={14} />
        </span>
      </Show>
      <span class="locker-tile__pv" aria-hidden="true">
        <Show
          when={it()}
          fallback={
            <Show
              when={props.type === "unvan"}
              fallback={
                <Show
                  when={props.type === "cerceve"}
                  fallback={<span class="locker-tile__plain">{props.name}</span>}
                >
                  <span class="locker-tile__ring" />
                </Show>
              }
            >
              <EmptyPlate />
            </Show>
          }
        >
          {(i) => (
            <Show
              when={props.type === "unvan"}
              fallback={
                <CosmeticPreview
                  avatar={avatarFromName(props.name)}
                  name={props.name}
                  cosmetics={itemCosmetics(i())}
                  size={34}
                  parts={props.type === "cerceve" ? "avatar" : "name"}
                />
              }
            >
              <TitlePlate item={i()} />
            </Show>
          )}
        </Show>
      </span>
      <span class="locker-tile__name">{props.label}</span>
    </button>
  );
}

/** Dolabım: üstte şimdiki görünüm, altında her tür için "Yok" + sahip olunanlar; dokununca kuşanılır. */
export function Locker() {
  onMount(() => void loadShop());
  createEffect(() => {
    if (!state.account) goHome();
  });
  const name = () => state.account?.username ?? "Sen";

  async function pick(type: CosmeticTypeId, itemId: string | null): Promise<void> {
    const r = await equipItem(type, itemId);
    if (!r.ok) toast(r.message, "error");
  }

  return (
    <Screen class="set shop">
      <header class="topbar shop-top">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={() => setState("nav", "profile")}>
          <BackIcon size={26} />
        </button>
        <h1 class="shop-top__title display">Dolabım</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body shop-body" data-scroll>
        <Show
          when={shop()}
          fallback={
            <p class="shop-note" role="status">
              {shopLoad() === "error" ? shopErrorText(null) : "Yükleniyor…"}
            </p>
          }
        >
          {(s) => (
            <>
              <section class="locker-look" aria-label="Şimdiki görünüm">
                <div class="locker-look__stage">
                  <Avatar
                    index={avatarFromName(name())}
                    size="clamp(72px, 22vmin, 104px)"
                    frame={frameOf(ownCosmetics())}
                  />
                </div>
                <h2 class="locker-look__name">
                  <PlayerName name={name()} cosmetics={ownCosmetics()} />
                </h2>
                <PlayerTitle cosmetics={ownCosmetics()} plate />
              </section>
              <For each={SHOP_TYPES}>
                {(t) => {
                  const owned = () => ownedOfType(s(), t.id, itemsOfType(t.id));
                  return (
                    <section class="locker-sec" aria-label={t.name} data-type={t.id}>
                      <h2 class="locker-sec__h">
                        <SecIcon type={t.id} />
                        {t.name}
                        <span class="locker-sec__line" aria-hidden="true" />
                      </h2>
                      <div class="locker-grid" data-type={t.id}>
                        <Tile
                          type={t.id}
                          item={null}
                          label={t.none}
                          name={name()}
                          on={s().equipped[t.id] === undefined}
                          onPick={() => void pick(t.id, null)}
                        />
                        <For each={owned()}>
                          {(it) => (
                            <Tile
                              type={t.id}
                              item={cosmeticItem(it.id) ?? null}
                              label={it.name}
                              name={name()}
                              on={s().equipped[t.id] === it.id}
                              onPick={() => void pick(t.id, it.id)}
                            />
                          )}
                        </For>
                      </div>
                      <Show when={owned().length === 0}>
                        <p class="shop-note shop-note--left">Henüz yok. Mağazadan alabilirsin.</p>
                      </Show>
                    </section>
                  );
                }}
              </For>
            </>
          )}
        </Show>
      </div>

      <ShopTabBar active="locker" />
    </Screen>
  );
}
