import type { ZehirliKadehSwap } from "@glix/engine";
import { createEffect, For, on, Show } from "solid-js";

/** Takas geçmişi (herkese açık): sırayla "Mert → Elif" okları. En yenisi sağda; sığmazsa yana kayar. */
export function SwapHistory(props: { swaps: readonly ZehirliKadehSwap[]; nameOf: (id: string) => string }) {
  let list: HTMLOListElement | undefined;
  createEffect(
    on(
      () => props.swaps.length,
      () => {
        if (list) list.scrollLeft = list.scrollWidth;
      },
    ),
  );
  return (
    <div class="zkh">
      <Show when={props.swaps.length > 0} fallback={<p class="zkh__empty">Henüz takas yok</p>}>
        <ol class="zkh__list" ref={list} aria-label="Takas geçmişi">
          <For each={props.swaps}>
            {(s) => (
              <li class="zkh__item">
                <span class="zkh__who">{props.nameOf(s.from)}</span>
                <span class="zkh__arrow" aria-hidden="true">
                  →
                </span>
                <span class="sr-only">ile takas etti:</span>
                <span class="zkh__who">{props.nameOf(s.to)}</span>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </div>
  );
}
