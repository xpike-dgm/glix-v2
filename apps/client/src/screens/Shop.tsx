import {
  type ClothingColourId,
  type CosmeticItem,
  type CosmeticTypeId,
  cosmeticItem,
  cosmeticType,
  DEFAULT_COLOUR,
  equippedValue,
  isClothingType,
  itemsOfType,
  nextIstanbulMidnight,
} from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { balanceText } from "../net/glixRules.js";
import { buyItem, equipItem, loadShop, ownCosmetics, shop, shopError, shopLoad } from "../net/shop.js";
import {
  buyText,
  type DealView,
  DISCOUNT_LABEL,
  dealCountdownText,
  dealViews,
  equippedColour,
  itemStatus,
  priceNow,
  RARITY_LABEL,
  SHOP_SECTIONS,
  SHOP_TABS,
  type ShopState,
  shopErrorText,
  shortfall,
  shortfallText,
} from "../net/shopRules.js";
import { goHome, state, toast } from "../net/store.js";
import { Avatar } from "../ui/Avatar.js";
import { isArtItem } from "../ui/artItems.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { CharacterPoster } from "../ui/CharacterPoster.js";
import { CharacterView } from "../ui/CharacterView.js";
import { frameOf } from "../ui/Cosmetic.js";
import { CosmeticPreview, itemCosmetics } from "../ui/CosmeticPreview.js";
import { isCharacterItem, posterSpec, previewCosmetics } from "../ui/characterItems.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, BoltIcon, CheckIcon, CoinIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";
import {
  BalancePill,
  ColourSwatches,
  colourName,
  Price,
  RarityChip,
  ShopTabBar,
  SlotChips,
} from "../ui/ShopBits.js";
import {
  CardBackArt,
  CelebrationCollage,
  CelebrationLive,
  EntryLayers,
  EntryLive,
  PackCollage,
  PackGrid,
} from "../ui/ShopPreview.js";
import { boxSrc } from "../ui/shopArt.js";

function previewParts(item: CosmeticItem): "avatar" | "name" | "title" {
  return item.type === "cerceve" ? "avatar" : item.type === "unvan" ? "title" : "name";
}

/** Ürün karosu: nadirliğe göre kutu görseli, büyük önizleme, ad, nadirlik çipi, fiyat ya da durum hapı. */
function Card(props: {
  item: CosmeticItem;
  s: ShopState;
  now: number;
  deal?: DealView | undefined;
  onOpen: (id: string) => void;
}) {
  const status = () => itemStatus(props.s, props.item);
  const price = () => priceNow(props.s, props.item.id, props.now);
  const name = () => state.account?.username ?? "Sen";
  // Giysi kuşanılmışsa karo kuşanılan rengiyle görünür.
  const poster = () =>
    posterSpec(
      props.item,
      ownCosmetics(),
      status() === "equipped" ? equippedColour(props.s, props.item.type) : DEFAULT_COLOUR,
    );
  return (
    <button
      type="button"
      class="shop-card"
      data-r={props.item.rarity}
      data-status={status()}
      data-type={props.item.type}
      style={{ "--box": `url(${boxSrc(props.item.rarity)})` }}
      aria-label={`${props.item.name}, ${RARITY_LABEL[props.item.rarity]}, ${
        status() === "buy"
          ? `${balanceText(price())} Glix`
          : status() === "equipped"
            ? "kuşanıldı"
            : "sahipsin"
      }`}
      onClick={() => props.onOpen(props.item.id)}
    >
      <span class="shop-card__pv" aria-hidden="true">
        <Show when={isArtItem(props.item)}>
          <Show when={props.item.type === "kart-arkasi"}>
            <CardBackArt item={props.item} size="tile" />
          </Show>
          <Show when={props.item.type === "zafer"}>
            <CelebrationCollage item={props.item} />
          </Show>
          <Show when={props.item.type === "tepki"}>
            <PackCollage item={props.item} />
          </Show>
          <Show when={props.item.type === "giris"}>
            <EntryLayers item={props.item} />
          </Show>
        </Show>
        <Show
          when={!isArtItem(props.item) && isCharacterItem(props.item)}
          fallback={
            <Show when={!isArtItem(props.item)}>
              <CosmeticPreview
                avatar={avatarFromName(name())}
                name={name()}
                cosmetics={itemCosmetics(props.item)}
                size={props.deal ? 44 : 60}
                parts={previewParts(props.item)}
                plate={props.deal === undefined}
              />
            </Show>
          }
        >
          <CharacterPoster
            layers={poster().layers}
            tints={poster().tints}
            dance={poster().dance}
            focus={poster().focus}
            avatar={avatarFromName(name())}
            label={props.item.name}
            fallback={<Avatar index={avatarFromName(name())} size={44} />}
          />
        </Show>
      </span>
      {/* Unvanda ürün adı önizlemedeki levhanın kendisidir; tekrar yazılmaz. */}
      <Show when={props.item.type !== "unvan"}>
        <span class="shop-card__name">{props.item.name}</span>
      </Show>
      <RarityChip rarity={props.item.rarity} />
      <span class="shop-card__foot">
        {status() === "buy" ? (
          <Price price={price()} list={props.deal ? props.deal.listPrice : undefined} />
        ) : status() === "equipped" ? (
          <span class="shop-state" data-on="1">
            <CheckIcon size={14} /> Kuşanıldı
          </span>
        ) : (
          <span class="shop-state" data-on="1">
            <CheckIcon size={14} /> Sahipsin
          </span>
        )}
      </span>
    </button>
  );
}

const TYPE_LABEL: Readonly<Record<CosmeticTypeId, string>> = {
  unvan: "Lakap",
  "ad-efekti": "Ad efekti",
  cerceve: "Avatar çerçevesi",
  dans: "Dans",
  sapka: "Şapka",
  ust: "Üst giysi",
  alt: "Alt giysi",
  ayakkabi: "Ayakkabı",
  aksesuar: "Aksesuar",
  kostum: "Tam kostüm",
  "kart-arkasi": "Kart arkası",
  zafer: "Zafer kutlaması",
  tepki: "Tepki paketi",
  giris: "Giriş efekti",
};

/** Mağaza: günün fırsatı (iki büyük karo), alt çizgili sekmeler, iki sütun ürün ızgarası; karta dokununca satın alma sayfası. */
export function Shop() {
  const [tab, setTab] = createSignal<string>("cerceve");
  const section = () => SHOP_TABS.find((t) => t.id === tab())?.section ?? "gorunus";
  const sectionTabs = () => SHOP_TABS.filter((t) => t.section === section());
  const [openId, setOpenId] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [msg, setMsg] = createSignal<string | null>(null);
  /** Satın alma sayfasında seçili giysi rengi (önizleme ve kuşanma). */
  const [colour, setColour] = createSignal<ClothingColourId>(DEFAULT_COLOUR);
  const [now, setNow] = createSignal(Date.now());
  /** Giysiler sekmesinde açık yuva (şapka, üst…); varsayılan ilk yuva. */
  const [slot, setSlot] = createSignal<CosmeticTypeId>("sapka");

  onMount(() => {
    void loadShop();
    const t = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(t));
  });
  // Oturum düşerse (başka sekmede çıkış) ana sayfaya dönülür.
  createEffect(() => {
    if (!state.account) goHome();
  });

  const deals = createMemo(() => {
    const s = shop();
    return s ? dealViews(s, now()) : [];
  });
  const left = () => {
    const s = shop();
    const at = now() + (s?.clockOffset ?? 0);
    return nextIstanbulMidnight(at) - at;
  };
  /** Sekmenin ürünleri yuva başına gruplanır; ürünü olmayan yuva hiç görünmez. */
  const tabGroups = () =>
    (SHOP_TABS.find((t) => t.id === tab())?.types ?? [])
      .map((t) => ({ type: t, items: itemsOfType(t) }))
      .filter((g) => g.items.length > 0);
  /** Giysiler sekmesinde yalnız seçili yuva görünür (39 ürünlük tek uzun liste yerine); öteki sekmelerde tümü. */
  const slotChips = () =>
    tab() === "giysi" ? tabGroups().map((g) => ({ id: g.type, label: cosmeticType(g.type).name })) : [];
  const activeSlot = (): CosmeticTypeId => {
    const chips = slotChips();
    return chips.find((c) => c.id === slot())?.id ?? chips[0]?.id ?? slot();
  };
  const shownGroups = () =>
    tab() === "giysi" ? tabGroups().filter((g) => g.type === activeSlot()) : tabGroups();
  const opened = () => {
    const id = openId();
    return id === null ? null : (cosmeticItem(id) ?? null);
  };
  const name = () => state.account?.username ?? "Sen";

  function open(id: string): void {
    setMsg(null);
    const it = cosmeticItem(id);
    const s = shop();
    // Kuşanılmış giysi kendi rengiyle açılır; diğerleri çizildiği gibi (camgöbeği).
    setColour(it && s && itemStatus(s, it) === "equipped" ? equippedColour(s, it.type) : DEFAULT_COLOUR);
    setOpenId(id);
  }

  /** İşlem sürerken kullanıcı sayfayı kapatıp başka ürünü açtıysa sonuç o ürüne yazılmaz. */
  const stillOpen = (item: CosmeticItem): boolean => openId() === item.id;

  async function buy(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await buyItem(item.id);
    setBusy(false);
    // Başarı ekran okuyucuya da duyurulsun (bildirim alanı canlı bölgedir).
    if (r.ok) toast(`${item.name} satın alındı`, "success");
    if (stillOpen(item)) setMsg(r.ok ? null : r.message);
    else if (!r.ok) toast(r.message, "error");
  }

  async function equip(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await equipItem(
      item.type,
      isClothingType(item.type) ? equippedValue(item.id, colour()) : item.id,
    );
    setBusy(false);
    if (r.ok) {
      toast(`${item.name} kuşanıldı`, "success");
      if (stillOpen(item)) setOpenId(null);
    } else if (stillOpen(item)) setMsg(r.message);
    else toast(r.message, "error");
  }

  async function unequip(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await equipItem(item.type, null);
    setBusy(false);
    if (r.ok) {
      if (stillOpen(item)) setOpenId(null);
    } else if (stillOpen(item)) setMsg(r.message);
    else toast(r.message, "error");
  }

  return (
    <Screen class="set shop">
      <header class="topbar shop-top">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={goHome}>
          <BackIcon size={26} />
        </button>
        <h1 class="shop-top__title display">Mağaza</h1>
        <Show when={shop()}>{(s) => <BalancePill balance={s().balance} />}</Show>
      </header>

      <div class="set__body shop-body" data-scroll>
        <Show
          when={shop()}
          fallback={
            <Show
              when={shopLoad() === "error"}
              fallback={
                <p class="shop-note" role="status">
                  Yükleniyor…
                </p>
              }
            >
              <div class="shop-empty" role="alert">
                <Mascot pose="baglanti-koptu" size="var(--mascot-sm, 72px)" />
                <p class="shop-note">{shopError() ?? shopErrorText(null)}</p>
                <GhostButton onClick={() => void loadShop()}>Tekrar dene</GhostButton>
              </div>
            </Show>
          }
        >
          {(s) => (
            <>
              <Show when={deals().length > 0}>
                <section class="shop-deal" aria-label="Günün fırsatı">
                  <div class="shop-deal__head">
                    <h2 class="shop-h">
                      <BoltIcon size={22} />
                      Günün fırsatı
                    </h2>
                    <span class="shop-deal__left">{dealCountdownText(left())}</span>
                  </div>
                  <div class="shop-grid shop-grid--deal">
                    <For each={deals()}>
                      {(d) => <Card item={d.item} s={s()} now={now()} deal={d} onOpen={open} />}
                    </For>
                  </div>
                </section>
              </Show>

              <div class="shop-sections" role="tablist" aria-label="Ürün bölümü">
                <For each={SHOP_SECTIONS}>
                  {(sec) => (
                    <button
                      type="button"
                      role="tab"
                      class="shop-section"
                      aria-selected={section() === sec.id}
                      onClick={() => {
                        if (section() !== sec.id)
                          setTab(SHOP_TABS.find((t) => t.section === sec.id)?.id ?? "cerceve");
                      }}
                    >
                      {sec.label}
                    </button>
                  )}
                </For>
              </div>
              <div class="shop-tabs" role="tablist" aria-label="Ürün türü">
                <For each={sectionTabs()}>
                  {(t) => (
                    <button
                      type="button"
                      role="tab"
                      class="shop-tab"
                      aria-selected={tab() === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </div>

              <Show when={slotChips().length > 1}>
                <SlotChips label="Giysi türü" items={slotChips()} value={activeSlot()} onPick={setSlot} />
              </Show>
              <div role="tabpanel">
                <For each={shownGroups()}>
                  {(g) => (
                    <>
                      <div class="shop-grid" classList={{ "shop-grid--rows": tab() === "unvan" }}>
                        <For each={g.items}>
                          {(item) => (
                            <Card
                              item={item}
                              s={s()}
                              now={now()}
                              deal={deals().find((d) => d.item.id === item.id)}
                              onOpen={open}
                            />
                          )}
                        </For>
                      </div>
                    </>
                  )}
                </For>
              </div>
            </>
          )}
        </Show>
      </div>

      <ShopTabBar active="shop" />

      <BottomSheet open={opened() !== null} onClose={() => setOpenId(null)} title={opened()?.name ?? "Ürün"}>
        <Show when={opened()}>
          {(item) => (
            <Show when={shop()}>
              {(s) => {
                const status = () => itemStatus(s(), item());
                const price = () => priceNow(s(), item().id, now());
                const missing = () => shortfall(s().balance, price());
                return (
                  <div class="shop-sheet" data-r={item().rarity}>
                    <p class="shop-sheet__meta">
                      <RarityChip rarity={item().rarity} />
                      <span class="shop-sheet__type">{TYPE_LABEL[item().type]}</span>
                    </p>
                    <div
                      class="shop-sheet__stage"
                      data-char={isCharacterItem(item()) ? "1" : undefined}
                      data-art={isArtItem(item()) ? item().type : undefined}
                    >
                      <Show when={item().type === "kart-arkasi"}>
                        <CardBackArt item={item()} size="big" />
                      </Show>
                      <Show when={item().type === "zafer"}>
                        <Show when={item().id} keyed>
                          <CelebrationLive item={item()} />
                        </Show>
                      </Show>
                      <Show when={item().type === "tepki"}>
                        <PackGrid item={item()} />
                      </Show>
                      <Show when={item().type === "giris"}>
                        <Show when={item().id} keyed>
                          <EntryLive
                            item={item()}
                            avatar={avatarFromName(name())}
                            frame={frameOf(ownCosmetics())}
                          />
                        </Show>
                      </Show>
                      <Show
                        when={!isArtItem(item()) && isCharacterItem(item())}
                        fallback={
                          <Show when={!isArtItem(item())}>
                            <CosmeticPreview
                              avatar={avatarFromName(name())}
                              name={name()}
                              cosmetics={itemCosmetics(item())}
                              size="clamp(76px, 26vmin, 120px)"
                              parts="both"
                              plate
                            />
                          </Show>
                        }
                      >
                        <CharacterView
                          avatar={avatarFromName(name())}
                          cosmetics={previewCosmetics(item(), ownCosmetics(), colour())}
                          fallback={
                            <Avatar index={avatarFromName(name())} size="clamp(64px, 20vmin, 96px)" />
                          }
                        />
                      </Show>
                    </div>
                    <Show when={isClothingType(item().type)}>
                      <p class="swatches__label">Renk: {colourName(colour())}</p>
                      <ColourSwatches value={colour()} onPick={setColour} />
                    </Show>
                    <p class="shop-sheet__desc">{item().description}</p>
                    <Show when={msg()}>
                      <p class="shop-sheet__err" role="alert">
                        {msg()}
                      </p>
                    </Show>
                    <Show when={status() === "buy"}>
                      <PrimaryButton
                        busy={busy()}
                        disabled={missing() > 0}
                        reason={missing() > 0 ? shortfallText(missing()) : undefined}
                        onClick={() => void buy(item())}
                      >
                        <span class="shop-buy">
                          <CoinIcon size={28} />
                          {buyText(price())}
                        </span>
                      </PrimaryButton>
                    </Show>
                    <Show when={status() === "owned" && item().type === "tepki"}>
                      <PrimaryButton variant="done" disabled>
                        <span class="shop-buy">
                          <CheckIcon size={20} /> Tepkilerde hazır
                        </span>
                      </PrimaryButton>
                    </Show>
                    <Show when={status() === "owned" && item().type !== "tepki"}>
                      <PrimaryButton busy={busy()} onClick={() => void equip(item())}>
                        Kuşan
                      </PrimaryButton>
                    </Show>
                    <Show when={status() === "equipped" && colour() !== equippedColour(s(), item().type)}>
                      <PrimaryButton busy={busy()} onClick={() => void equip(item())}>
                        Rengi uygula
                      </PrimaryButton>
                      <GhostButton onClick={() => void unequip(item())}>Çıkar</GhostButton>
                    </Show>
                    <Show when={status() === "equipped" && colour() === equippedColour(s(), item().type)}>
                      <PrimaryButton variant="done" disabled>
                        <span class="shop-buy">
                          <CheckIcon size={20} /> Kuşanıldı
                        </span>
                      </PrimaryButton>
                      <GhostButton onClick={() => void unequip(item())}>Çıkar</GhostButton>
                    </Show>
                  </div>
                );
              }}
            </Show>
          )}
        </Show>
      </BottomSheet>
    </Screen>
  );
}
