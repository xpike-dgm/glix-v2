import { LOBBY_EMOJIS, type LobbyEmoji } from "@glix/engine";
import { For } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";

/** Sonuç ve final ekranlarında gösterilen dörtlü (sunucunun izinli kümesinin alt kümesi). */
export const RESULT_EMOJIS: readonly LobbyEmoji[] = ["😂", "😱", "🔥", "👏"];

/**
 * Tek dokunuşla gönderilen küçük emoji dizisi. Lobide altısı birden 320 px genişlikte tek satıra sığar;
 * `compact` (sonuç/final) dörtlü, ortalı ve altta ince bir şerittir.
 */
export function EmojiBar(props: {
  onPick: (emoji: LobbyEmoji) => void;
  emojis?: readonly LobbyEmoji[];
  compact?: boolean;
}) {
  return (
    <div class="emojibar" classList={{ "emojibar--compact": props.compact === true }}>
      <For each={props.emojis ?? LOBBY_EMOJIS}>
        {(emoji) => (
          <button
            type="button"
            class="emojibar__btn"
            aria-label={`${emoji} tepkisi ver`}
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
