import {
  COSMETIC_TYPES,
  type CosmeticItem,
  type CosmeticTypeId,
  cosmeticItem,
  itemsOfType,
  nextIstanbulMidnight,
} from "@glix/engine";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { balanceText } from "../net/glixRules.js";
import { buyItem, equipItem, loadShop, shop, shopError, shopLoad } from "../net/shop.js";
import {
  buyText,
  type DealView,
  DISCOUNT_LABEL,
  dealCountdownText,
  dealViews,
  itemStatus,
  priceNow,
  RARITY_LABEL,
  type ShopState,
  shopErrorText,
  shortfall,
  shortfallText,
} from "../net/shopRules.js";
import { goHome, state, toast } from "../net/store.js";
import { avatarFromName } from "../ui/avatars.js";
import { BottomSheet } from "../ui/BottomSheet.js";
import { CosmeticPreview, itemCosmetics } from "../ui/CosmeticPreview.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, CheckIcon, CoinIcon } from "../ui/Icons.js";
import { Mascot } from "../ui/Mascot.js";
import { PrimaryButton } from "../ui/PrimaryButton.js";
import { Screen } from "../ui/Screen.js";

function Price(props: { price: number; list?: number | undefined }) {
  return (
    <span class="shop-price">
      <CoinIcon size={14} />
      <Show when={props.list !== undefined && props.list !== props.price}>
        <s class="shop-price__old">{props.list}</s>
      </Show>
      <b>{props.price}</b>
    </span>
  );
}

function previewParts(item: CosmeticItem): "avatar" | "name" {
  return item.type === "cerceve" ? "avatar" : "name";
}

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
  return (
    <button
      type="button"
      class="shop-card"
      data-r={props.item.rarity}
      data-status={status()}
      aria-label={`${props.item.name}, ${RARITY_LABEL[props.item.rarity]}, ${
        status() === "buy" ? `${price()} Glix` : status() === "equipped" ? "kuşanıldı" : "sahipsin"
      }`}
      onClick={() => props.onOpen(props.item.id)}
    >
      <span class="shop-card__pv" aria-hidden="true">
        <CosmeticPreview
          avatar={avatarFromName(name())}
          name={name()}
          cosmetics={itemCosmetics(props.item)}
          size={44}
          parts={previewParts(props.item)}
        />
      </span>
      {/* Unvanda ürün adı önizlemedeki unvanın kendisidir; tekrar yazılmaz. */}
      <Show when={props.item.type !== "unvan"}>
        <span class="shop-card__name">{props.item.name}</span>
      </Show>
      <span class="shop-card__foot">
        {status() === "buy" ? (
          <>
            <Price price={price()} list={props.deal ? props.deal.listPrice : undefined} />
            <Show when={props.deal}>
              <span class="shop-card__off">{DISCOUNT_LABEL}</span>
            </Show>
          </>
        ) : status() === "equipped" ? (
          <span class="shop-card__state" data-on="1">
            <CheckIcon size={14} /> Kuşanıldı
          </span>
        ) : (
          <span class="shop-card__state">Sahipsin</span>
        )}
      </span>
    </button>
  );
}

/** Mağaza: günün fırsatı (ince satır), sekmeler, kompakt ürün kartları; karta dokununca satın alma sayfası. */
export function Shop() {
  const [tab, setTab] = createSignal<CosmeticTypeId>(COSMETIC_TYPES[0]?.id ?? "unvan");
  const [openId, setOpenId] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [msg, setMsg] = createSignal<string | null>(null);
  const [now, setNow] = createSignal(Date.now());

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
  const opened = () => {
    const id = openId();
    return id === null ? null : (cosmeticItem(id) ?? null);
  };
  const name = () => state.account?.username ?? "Sen";

  function open(id: string): void {
    setMsg(null);
    setOpenId(id);
  }

  async function buy(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await buyItem(item.id);
    setBusy(false);
    setMsg(r.ok ? null : r.message);
  }

  async function equip(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await equipItem(item.type, item.id);
    setBusy(false);
    if (r.ok) {
      toast(`${item.name} kuşanıldı`, "success");
      setOpenId(null);
    } else setMsg(r.message);
  }

  async function unequip(item: CosmeticItem): Promise<void> {
    if (busy()) return;
    setBusy(true);
    const r = await equipItem(item.type, null);
    setBusy(false);
    if (r.ok) setOpenId(null);
    else setMsg(r.message);
  }

  return (
    <Screen class="set shop">
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={goHome}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Mağaza</h1>
        <Show when={shop()} fallback={<span class="set__spacer" aria-hidden="true" />}>
          {(s) => (
            <span class="shop-bal" role="status" aria-label={`Glix bakiyen ${balanceText(s().balance)}`}>
              <CoinIcon size={16} />
              {balanceText(s().balance)}
            </span>
          )}
        </Show>
      </header>

      <div class="set__body" data-scroll>
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
                    <h2 class="shop-h">Günün fırsatı</h2>
                    <span class="shop-deal__left">{dealCountdownText(left())}</span>
                  </div>
                  <div class="shop-grid">
                    <For each={deals()}>
                      {(d) => <Card item={d.item} s={s()} now={now()} deal={d} onOpen={open} />}
                    </For>
                  </div>
                </section>
              </Show>

              <div class="shop-tabs" role="tablist" aria-label="Ürün türü">
                <For each={COSMETIC_TYPES}>
                  {(t) => (
                    <button
                      type="button"
                      role="tab"
                      class="shop-tab"
                      aria-selected={tab() === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.plural}
                    </button>
                  )}
                </For>
              </div>

              <div class="shop-grid" role="tabpanel">
                <For each={itemsOfType(tab())}>
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
        </Show>
      </div>

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
                    <div class="shop-sheet__pv">
                      <CosmeticPreview
                        avatar={avatarFromName(name())}
                        name={name()}
                        cosmetics={itemCosmetics(item())}
                        size={item().type === "cerceve" ? 88 : 64}
                        parts="both"
                      />
                    </div>
                    <p class="shop-sheet__meta">
                      <span class="shop-dot" aria-hidden="true" />
                      {RARITY_LABEL[item().rarity]} · {COSMETIC_TYPES.find((t) => t.id === item().type)?.name}
                    </p>
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
                        {buyText(price())}
                      </PrimaryButton>
                    </Show>
                    <Show when={status() === "owned"}>
                      <PrimaryButton busy={busy()} onClick={() => void equip(item())}>
                        Kuşan
                      </PrimaryButton>
                    </Show>
                    <Show when={status() === "equipped"}>
                      <PrimaryButton disabled>Kuşanıldı</PrimaryButton>
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
