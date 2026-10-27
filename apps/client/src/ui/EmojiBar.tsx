import { LOBBY_EMOJIS, type LobbyEmoji } from "@glix/engine";
import { For } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";

/** Lobide tek dokunuşla gönderilen küçük emoji dizisi; 320 px genişlikte tek satıra sığar. */
export function EmojiBar(props: { onPick: (emoji: LobbyEmoji) => void }) {
  return (
    <div class="emojibar">
      <For each={LOBBY_EMOJIS}>
        {(emoji) => (
          <button
            type="button"
            class="emojibar__btn"
            aria-label={`${emoji} gönder`}
            onClick={() => {
              tap();
              hapticTap();
              props.onPick(emoji);
            }}
          >
            {emoji}
          </button>
        )}
      </For>
    </div>
  );
}
