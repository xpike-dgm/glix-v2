import { CARDS, type CardId, type CardRarity, type CardSettings, DEFAULT_CARD_SETTINGS } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import { setCards } from "../net/client.js";
import { CardThumb, GemMark } from "./CardFace.js";
import { cardsOfRarity, RARITY_LABEL, settingsSummary, toggleCard } from "./cards.js";
import { GhostButton } from "./GhostButton.js";
import { ChevronIcon } from "./Icons.js";

const GROUPS: readonly CardRarity[] = ["siradan", "nadir", "efsanevi", "kotu"];

/**
 * Kartlar ayarının içeriği (docs/KURALLAR.md K8): ana anahtar ve her kart için ayrı anahtar. Host değiştirir,
 * misafirler yalnız okur. Değişiklik sunucuya gider; yeni durum oda görünümüyle geri gelir.
 * `fold`: tek tek kartlar bir düğmenin arkasında kapalı gelir (lobi ayarları ekranı uzamasın).
 */
export function CardSettingsBody(props: {
  settings: CardSettings | undefined;
  host: boolean;
  fold?: boolean;
}) {
  const s = (): CardSettings => props.settings ?? DEFAULT_CARD_SETTINGS;
  const [unfolded, setUnfolded] = createSignal(false);
  const shown = (): boolean => s().enabled && (!props.fold || unfolded());
  const on = (id: CardId): boolean => !s().off.includes(id);
  const flip = (id: CardId): void => {
    if (props.host) setCards(toggleCard(s(), id));
  };
  const master = (): void => {
    if (props.host) setCards({ enabled: !s().enabled, off: s().off });
  };
  return (
    <>
      <Show when={!props.fold}>
        <p class="sheet__text">
          Her 3 oyundan sonra herkes bir kart seçer; kartlar oyunların puanlarını değiştirir.
          {props.host ? "" : " Ayarı yalnızca oda sahibi değiştirebilir."}
        </p>
      </Show>
      <button
        type="button"
        class="kc-sw kc-sw--master"
        role="switch"
        aria-checked={s().enabled}
        data-on={s().enabled ? "1" : undefined}
        disabled={!props.host}
        onClick={master}
      >
        <span class="kc-sw__label">Kartlar</span>
        <span class="kc-sw__state">{s().enabled ? "Açık" : "Kapalı"}</span>
        <span class="kc-sw__knob" aria-hidden="true" />
      </button>
      <Show when={props.fold && s().enabled}>
        <button
          type="button"
          class="kc-open kc-fold"
          aria-expanded={unfolded()}
          onClick={() => setUnfolded(!unfolded())}
        >
          <span>{unfolded() ? "Tek tek kartları gizle" : `Tek tek kartlar · ${settingsSummary(s())}`}</span>
          <ChevronIcon size={20} class="kc-fold__chev" />
        </button>
      </Show>
      <Show when={shown()}>
        <For each={GROUPS}>
          {(rarity) => (
            <section class="kc-set" aria-label={RARITY_LABEL[rarity]}>
              <p class="overline kc-set__head">
                <GemMark rarity={rarity} size={14} /> {RARITY_LABEL[rarity]}
              </p>
              <For each={cardsOfRarity(rarity)}>
                {(id) => (
                  <button
                    type="button"
                    class="kc-sw"
                    role="switch"
                    aria-checked={on(id)}
                    data-on={on(id) ? "1" : undefined}
                    data-r={rarity}
                    disabled={!props.host}
                    onClick={() => flip(id)}
                  >
                    <CardThumb id={id} />
                    <span class="kc-sw__label">
                      <b>{CARDS[id].name}</b>
                      <span>{CARDS[id].text}</span>
                    </span>
                    <span class="kc-sw__state">{on(id) ? "Açık" : "Kapalı"}</span>
                    <span class="kc-sw__knob" aria-hidden="true" />
                  </button>
                )}
              </For>
            </section>
          )}
        </For>
        <Show when={props.host && s().off.length > 0}>
          <GhostButton size="small" onClick={() => setCards({ enabled: true, off: [] })}>
            Hepsini aç
          </GhostButton>
        </Show>
      </Show>
    </>
  );
}
