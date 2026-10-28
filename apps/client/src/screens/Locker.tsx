import { COSMETIC_TYPES, type CosmeticTypeId, itemsOfType } from "@glix/engine";
import { createEffect, For, onMount, Show } from "solid-js";
import { equipItem, loadShop, ownCosmetics, shop, shopLoad } from "../net/shop.js";
import { ownedOfType, RARITY_LABEL, shopErrorText } from "../net/shopRules.js";
import { goHome, setState, state, toast } from "../net/store.js";
import { avatarFromName } from "../ui/avatars.js";
import { CosmeticPreview } from "../ui/CosmeticPreview.js";
import { GhostButton } from "../ui/GhostButton.js";
import { BackIcon, CheckIcon } from "../ui/Icons.js";
import { Screen } from "../ui/Screen.js";

/** Dolabım: her tür için sahip olunanlar ve "Yok"; dokununca kuşanılır. Üstte canlı önizleme. */
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
      <header class="topbar">
        <button type="button" class="icon-btn" aria-label="Geri" onClick={() => setState("nav", "profile")}>
          <BackIcon size={26} />
        </button>
        <h1 class="set__title display">Dolabım</h1>
        <span class="set__spacer" aria-hidden="true" />
      </header>

      <div class="set__body" data-scroll>
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
              <div class="locker-pv">
                <CosmeticPreview
                  avatar={avatarFromName(name())}
                  name={name()}
                  cosmetics={ownCosmetics()}
                  size={80}
                  parts="both"
                />
              </div>
              <For each={COSMETIC_TYPES}>
                {(t) => {
                  const owned = () => ownedOfType(s(), t.id, itemsOfType(t.id));
                  return (
                    <section class="locker-sec" aria-label={t.name}>
                      <h2 class="shop-h">{t.name}</h2>
                      <div class="locker-row">
                        <button
                          type="button"
                          class="locker-chip"
                          aria-pressed={s().equipped[t.id] === undefined}
                          onClick={() => void pick(t.id, null)}
                        >
                          <Show when={s().equipped[t.id] === undefined}>
                            <CheckIcon size={14} />
                          </Show>
                          {t.none}
                        </button>
                        <For each={owned()}>
                          {(it) => (
                            <button
                              type="button"
                              class="locker-chip"
                              data-r={it.rarity}
                              aria-pressed={s().equipped[t.id] === it.id}
                              aria-label={`${it.name}, ${RARITY_LABEL[it.rarity]}`}
                              onClick={() => void pick(t.id, it.id)}
                            >
                              <Show
                                when={s().equipped[t.id] === it.id}
                                fallback={<span class="shop-dot" aria-hidden="true" />}
                              >
                                <CheckIcon size={14} />
                              </Show>
                              {it.name}
                            </button>
                          )}
                        </For>
                      </div>
                      <Show when={owned().length === 0}>
                        <p class="shop-note shop-note--left">Henüz yok.</p>
                      </Show>
                    </section>
                  );
                }}
              </For>
              <GhostButton size="small" onClick={() => setState("nav", "shop")}>
                Mağazaya git
              </GhostButton>
            </>
          )}
        </Show>
      </div>
    </Screen>
  );
}
