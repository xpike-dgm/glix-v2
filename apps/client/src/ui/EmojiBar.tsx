import type { LobbyEmoji, ReactionId } from "@glix/engine";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";
import { ensureShopLoaded, ownPacks } from "../net/shop.js";
import { state } from "../net/store.js";
import { reactionPages } from "./reactionPages.js";

/** Sonuç ve final ekranlarında gösterilen dörtlü (sunucunun izinli kümesinin alt kümesi). */
export const RESULT_EMOJIS: readonly LobbyEmoji[] = ["😂", "😱", "🔥", "👏"];

/**
 * Tek dokunuşla gönderilen küçük emoji dizisi. Lobide altısı birden 320 px genişlikte tek satıra sığar;
 * `compact` (sonuç/final) dörtlü, ortalı ve altta ince bir şerittir. Tepki paketi sahibi oyuncuya her paket için
 * bir sayfa düğmesi çıkar (üstte küçük şerit): paketin altı çıkartması aynı satıra gelir.
 */
export function EmojiBar(props: {
  onPick: (emoji: ReactionId) => void;
  emojis?: readonly LobbyEmoji[];
  compact?: boolean;
}) {
  const [pageNo, setPageNo] = createSignal(0);
  onMount(() => {
    if (state.account) ensureShopLoaded();
  });
  const pages = createMemo(() => reactionPages(props.emojis, ownPacks()));
  const page = () => pages()[Math.min(pageNo(), pages().length - 1)] ?? pages()[0];
  return (
    <div class="emojibar-wrap">
      <Show when={pages().length > 1}>
        <div class="emojibar__pages" role="tablist" aria-label="Tepki sayfası">
          <For each={pages()}>
            {(pg, i) => (
              <button
                type="button"
                role="tab"
                class="emojibar__page"
                aria-selected={i() === pageNo()}
                aria-label={pg.label}
                onClick={() => {
                  tap();
                  setPageNo(i());
                }}
              >
                <Show when={pg.icon} fallback={<span aria-hidden="true">😀</span>}>
                  {(src) => <img src={src()} alt="" draggable={false} />}
                </Show>
              </button>
            )}
          </For>
        </div>
      </Show>
      <div class="emojibar" classList={{ "emojibar--compact": props.compact === true }}>
        <For each={page()?.items ?? []}>
          {(choice) => (
            <button
              type="button"
              class="emojibar__btn"
              data-sticker={choice.src ? "1" : undefined}
              aria-label={`${choice.label} tepkisi ver`}
              onClick={() => {
                tap();
                hapticTap();
                props.onPick(choice.id);
              }}
            >
              <Show when={choice.src} fallback={choice.text}>
                {(src) => <img src={src()} alt="" draggable={false} decoding="async" />}
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
