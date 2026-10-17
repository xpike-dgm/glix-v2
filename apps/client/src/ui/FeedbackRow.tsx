import { MAX_FEEDBACK_TEXT } from "@glix/engine";
import { createSignal, For, Show } from "solid-js";
import { hapticTap } from "../fx/haptics.js";
import { tap } from "../fx/sound.js";
import { sendFeedback } from "../net/client.js";
import { StarIcon } from "./Icons.js";

/** Maç sonu geri bildirimi: beş yıldız, isteğe bağlı tek satır yazı. Seyirciler de oy verebilir. */
export function FeedbackRow() {
  const [rating, setRating] = createSignal(0);
  const [text, setText] = createSignal("");
  /** Yıldız satırı açık mı; puan seçilince yazı satırına geçilir, rozete dokunmak puanı değiştirmeyi açar. */
  const [picking, setPicking] = createSignal(true);
  const [sent, setSent] = createSignal(false);

  const submit = (): void => {
    const r = rating();
    if (r < 1 || sent()) return;
    sendFeedback(r, text());
    setSent(true);
  };

  return (
    <div class="fb" data-state={sent() ? "sent" : picking() ? "rate" : "text"}>
      <Show
        when={!sent()}
        fallback={
          <p class="fb__thanks" role="status">
            Teşekkürler!
          </p>
        }
      >
        <Show when={picking()}>
          {/* biome-ignore lint/a11y/useSemanticElements: fieldset düzeni bozar; düğmeler aria-pressed ile işaretli */}
          <div class="fb__stars" role="group" aria-label="Nasıldı?">
            <span class="fb__label" aria-hidden="true">
              Nasıldı?
            </span>
            <For each={[1, 2, 3, 4, 5]}>
              {(n) => (
                <button
                  type="button"
                  class="fb__star"
                  aria-pressed={rating() === n}
                  aria-label={`${n} yıldız`}
                  data-on={n <= rating() ? "1" : undefined}
                  onPointerDown={() => {
                    tap();
                    hapticTap();
                  }}
                  onClick={() => {
                    setRating(n);
                    setPicking(false);
                  }}
                >
                  <StarIcon size={30} />
                </button>
              )}
            </For>
          </div>
        </Show>
        <Show when={!picking()}>
          <form
            class="fb__form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <button
              type="button"
              class="fb__chip"
              aria-label={`${rating()} yıldız verdin, değiştir`}
              onClick={() => setPicking(true)}
            >
              <StarIcon size={22} />
              <span>{rating()}</span>
            </button>
            <input
              class="fb__input"
              type="text"
              enterkeyhint="send"
              autocomplete="off"
              maxlength={MAX_FEEDBACK_TEXT}
              placeholder="Kısaca yaz (isteğe bağlı)"
              aria-label="Kısaca yaz (isteğe bağlı)"
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
            />
            <button type="submit" class="fb__send">
              Gönder
            </button>
          </form>
        </Show>
      </Show>
    </div>
  );
}
