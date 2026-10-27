import { For, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { dismissBadges, freshBadges } from "../net/badges.js";
import { BadgeMedal } from "./BadgeMedal.js";
import { PrimaryButton } from "./PrimaryButton.js";

/**
 * "Yeni rozet!" kartı: maç sonunda kazanılan rozet(ler). Hareket azaltma CSS'te `data-motion` ile durur;
 * kart yine de aynı bilgiyi gösterir. Kapatılana kadar kalır.
 */
export function NewBadgeCard() {
  return (
    <Show when={freshBadges().length > 0}>
      <div class="nbc" role="dialog" aria-modal="true" aria-label="Yeni rozet">
        <NewBadgeBody />
      </div>
    </Show>
  );
}

function NewBadgeBody() {
  let closeRef: HTMLDivElement | undefined;
  onMount(() => {
    hapticTap();
    closeRef?.querySelector("button")?.focus({ preventScroll: true });
  });
  return (
    <div class="nbc__card">
      <p class="overline nbc__over">Yeni rozet!</p>
      <ul class="nbc__list">
        <For each={freshBadges()}>
          {(b, i) => (
            <li class="nbc__item" style={{ "--i": i() }}>
              <BadgeMedal id={b.id} earned secret={b.secret} size={96} />
              <span class="nbc__name">{b.name}</span>
              <span class="nbc__desc">{b.description}</span>
            </li>
          )}
        </For>
      </ul>
      <div ref={closeRef} class="nbc__act">
        <PrimaryButton onClick={dismissBadges}>Harika!</PrimaryButton>
      </div>
    </div>
  );
}
