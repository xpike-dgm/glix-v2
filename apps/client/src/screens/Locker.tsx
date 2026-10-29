import {
  type ClothingColourId,
  COSMETIC_TYPES,
  type CosmeticItem,
  type CosmeticTypeId,
  cosmeticItem,
  DEFAULT_COLOUR,
  equippedValue,
  isClothingType,
  isEquippable,
  itemsOfType,
} from "@glix/engine";
import { createEffect, For, onMount, Show } from "solid-js";
import { equipItem, loadShop, ownCosmetics, shop, shopLoad } from "../net/shop.js";
import {
  equippedColour,
  equippedId,
  ownedOfType,
  RARITY_LABEL,
  SHOP_TYPES,
  shopErrorText,
} from "../net/shopRules.js";
import { goHome, setState, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { ART_TYPES } from "../ui/artItems.js";
import { avatarFromName } from "../ui/avatars.js";
import { CharacterPoster } from "../ui/CharacterPoster.js";
import { CharacterView } from "../ui/CharacterView.js";
import { EmptyPlate, frameOf, PlayerName, PlayerTitle, TitlePlate } from "../ui/Cosmetic.js";
import { CosmeticPreview, itemCosmetics } from "../ui/CosmeticPreview.js";
import { defaultDancePoster, isCharacterItem, posterSpec } from "../ui/characterItems.js";
import { BackIcon, CheckIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";
import { ColourSwatches, ShopTabBar } from "../ui/ShopBits.js";
import { CardBackArt, CelebrationCollage, EntryLayers, PackCollage } from "../ui/ShopPreview.js";
import { boxSrc } from "../ui/shopArt.js";

const isArtType = (t: CosmeticTypeId): boolean => ART_TYPES.includes(t);

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
      <Show when={props.type === "dans"}>
        <path
          d="M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "sapka"}>
        <path
          d="M4 15c0-5 3.5-8 8-8s8 3 8 8M3 15h18l-1.5 3h-15z"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "ust"}>
        <path
          d="M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3c-.6 1.6-1.8 2.4-4 2.4S8.6 5.6 8 4z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "alt"}>
        <path
          d="M7 3h10l1 18h-5l-1-9-1 9H6z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "ayakkabi"}>
        <path
          d="M4 6h5v6c1.5 1.5 4 2 7 3l4 1.5V19H4z"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "aksesuar"}>
        <path
          d="M12 3l2.4 5.2 5.6.7-4.1 3.9 1.1 5.6L12 15.6 7 18.4l1.1-5.6L4 8.9l5.6-.7z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "kostum"}>
        <path
          d="M12 4a2 2 0 1 0 0-.01M12 6c-5 0-8 3-8 8v2h16v-2c0-5-3-8-8-8zM9 16v4h6v-4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </Show>
      <Show when={props.type === "kart-arkasi"}>
        <rect x="6" y="3" width="12" height="18" rx="2.5" stroke="currentColor" stroke-width="2.2" />
        <path d="M12 8.5l2 3.5-2 3.5-2-3.5z" fill="currentColor" />
      </Show>
      <Show when={props.type === "zafer"}>
        <path
          d="M5 20l3-9 6 6zM13 4v3M18 7l-2 2M20 13h-3M16 3l.8 1.8L19 5.5l-1.7.8L16.5 8l-.8-1.7L14 5.5l1.7-.7z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </Show>
      <Show when={props.type === "tepki"}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.2" />
        <path
          d="M8.5 14c1 1.8 2.2 2.5 3.5 2.5s2.5-.7 3.5-2.5M9 9.5h.01M15 9.5h.01"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </Show>
      <Show when={props.type === "giris"}>
        <ellipse cx="12" cy="18" rx="7" ry="2.5" stroke="currentColor" stroke-width="2.2" />
        <path d="M8 17V8l4-4 4 4v9" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
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
  /** Kuşanılmaz tür (tepki paketi): dokunuşsuz, "Hazır" etiketli karo. */
  fixed?: boolean;
  /** Kuşanılan giysinin rengi (karo bu renkle görünür). */
  colour?: ClothingColourId;
}) {
  const it = () => props.item;
  return (
    <button
      type="button"
      class="locker-tile"
      data-type={props.type}
      data-r={it()?.rarity ?? "yok"}
      data-on={props.on ? "1" : undefined}
      data-fixed={props.fixed ? "1" : undefined}
      disabled={props.fixed}
      aria-pressed={props.fixed ? undefined : props.on}
      aria-label={
        props.fixed
          ? `${props.label}, ${RARITY_LABEL[it()?.rarity ?? "siradan"]}, tepkilerde kullanıma hazır`
          : it()
            ? `${props.label}, ${RARITY_LABEL[it()?.rarity ?? "siradan"]}`
            : `${props.label}, kuşanma`
      }
      style={it() ? { "--box": `url(${boxSrc(it()?.rarity ?? "siradan")})` } : undefined}
      onClick={props.onPick}
    >
      <Show when={props.on}>
        <span class="locker-tile__tick" aria-hidden="true">
          <CheckIcon size={14} />
        </span>
      </Show>
      <Show when={props.fixed}>
        <span class="locker-tile__ready" aria-hidden="true">
          Hazır
        </span>
      </Show>
      <span class="locker-tile__pv" aria-hidden="true">
        <Show when={props.type === "kart-arkasi"}>
          <CardBackArt item={it() ?? undefined} size="tile" />
        </Show>
        <Show when={props.type === "zafer" && it()}>{(i) => <CelebrationCollage item={i()} />}</Show>
        <Show when={props.type === "tepki" && it()}>{(i) => <PackCollage item={i()} />}</Show>
        <Show when={props.type === "giris" && it()}>{(i) => <EntryLayers item={i()} />}</Show>
        <Show when={!isArtType(props.type)}>
          <Show
            when={it()}
            fallback={
              <Show
                when={props.type === "unvan"}
                fallback={
                  <Show
                    when={props.type === "dans"}
                    fallback={
                      <Show
                        when={props.type === "cerceve" || isClothingType(props.type)}
                        fallback={<span class="locker-tile__plain">{props.name}</span>}
                      >
                        <span class="locker-tile__ring" />
                      </Show>
                    }
                  >
                    <CharacterPoster
                      layers={defaultDancePoster(ownCosmetics()).layers}
                      tints={defaultDancePoster(ownCosmetics()).tints}
                      dance={defaultDancePoster(ownCosmetics()).dance}
                      focus="full"
                      avatar={avatarFromName(props.name)}
                      label={props.label}
                      fallback={<Avatar index={avatarFromName(props.name)} size={36} />}
                    />
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
                  <Show
                    when={isCharacterItem(i())}
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
                    <CharacterPoster
                      layers={posterSpec(i(), ownCosmetics(), props.colour).layers}
                      tints={posterSpec(i(), ownCosmetics(), props.colour).tints}
                      dance={posterSpec(i(), ownCosmetics(), props.colour).dance}
                      focus={posterSpec(i(), ownCosmetics(), props.colour).focus}
                      avatar={avatarFromName(props.name)}
                      label={props.label}
                      fallback={<Avatar index={avatarFromName(props.name)} size={36} />}
                    />
                  </Show>
                }
              >
                <TitlePlate item={i()} />
              </Show>
            )}
          </Show>
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
                  <CharacterView
                    avatar={avatarFromName(name())}
                    cosmetics={ownCosmetics()}
                    fallback={
                      <Avatar
                        index={avatarFromName(name())}
                        size="clamp(72px, 22vmin, 104px)"
                        frame={frameOf(ownCosmetics())}
                      />
                    }
                  />
                </div>
                <h2 class="locker-look__name">
                  <Avatar
                    class="locker-look__tag"
                    index={avatarFromName(name())}
                    size={36}
                    frame={frameOf(ownCosmetics())}
                  />
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
                        <Show when={isEquippable(t)}>
                          <Tile
                            type={t.id}
                            item={null}
                            label={t.none}
                            name={name()}
                            on={s().equipped[t.id] === undefined}
                            onPick={() => void pick(t.id, null)}
                          />
                        </Show>
                        <For each={owned()}>
                          {(it) => (
                            <Tile
                              type={t.id}
                              item={cosmeticItem(it.id) ?? null}
                              label={it.name}
                              name={name()}
                              on={equippedId(s(), t.id) === it.id}
                              colour={
                                equippedId(s(), t.id) === it.id ? equippedColour(s(), t.id) : DEFAULT_COLOUR
                              }
                              fixed={!isEquippable(t)}
                              onPick={() => {
                                // Kuşanılı karoya yeniden dokunmak rengi sıfırlamaz.
                                if (equippedId(s(), t.id) !== it.id) void pick(t.id, it.id);
                              }}
                            />
                          )}
                        </For>
                      </div>
                      <Show when={isClothingType(t.id) && equippedId(s(), t.id)}>
                        {(id) => (
                          <div class="locker-colours">
                            <p class="swatches__label">Renk</p>
                            <ColourSwatches
                              value={equippedColour(s(), t.id)}
                              onPick={(c) => void pick(t.id, equippedValue(id(), c))}
                            />
                          </div>
                        )}
                      </Show>
                      <Show when={owned().length === 0}>
                        <p class="shop-note shop-note--left">Henüz yok. Mağazadan alabilirsin.</p>
                      </Show>
                      <Show when={!isEquippable(t) && owned().length > 0}>
                        <p class="shop-note shop-note--left">
                          Aldığın paketler kuşanmadan hazır: tepki düğmesinde yeni bir sayfa olarak çıkar.
                        </p>
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
