import { createMemo, createSignal, Show } from "solid-js";
import { glixEarned } from "../net/glix.js";
import { GLIX_CAP_TEXT, glixInline, glixLines, glixText } from "../net/glixRules.js";
import { CoinIcon } from "./Icons.js";

/**
 * Final ekranında küçük "+N Glix" hapı. Dokununca altında tek satırlık kısa döküm açılır. Veri sunucunun `glixEarned`
 * mesajından gelir; mesaj yoksa hiçbir şey çizilmez. Kazanç 0 ve sınır dolmuşsa yalnız soluk not görünür.
 */
export function GlixSummary(props: { place: number | null }) {
  const [open, setOpen] = createSignal(false);
  const line = createMemo(() => {
    const g = glixEarned();
    return g ? glixInline(glixLines(g, props.place)) : "";
  });
  return (
    <Show when={glixEarned()}>
      {(g) => (
        <section class="glx rise" style={{ "--i": 5 }} aria-label="Kazandığın Glix">
          <Show when={g().total > 0}>
            <button
              type="button"
              class="glx__pill"
              aria-expanded={open()}
              aria-controls="glx-list"
              onClick={() => setOpen(!open())}
            >
              <span class="glx__chip">
                <CoinIcon size={16} />
                {glixText(g().total)}
              </span>
            </button>
            <p id="glx-list" class="glx__list" hidden={!open()}>
              {line()}
            </p>
          </Show>
          <Show when={g().capped}>
            <p class="glx__cap" role="note">
              {GLIX_CAP_TEXT}
            </p>
          </Show>
        </section>
      )}
    </Show>
  );
}
