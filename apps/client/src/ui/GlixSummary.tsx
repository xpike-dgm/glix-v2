import { createMemo, createSignal, For, Show } from "solid-js";
import { badgeNames } from "../net/badges.js";
import { glixEarned } from "../net/glix.js";
import { GLIX_CAP_TEXT, glixLines, glixText } from "../net/glixRules.js";
import { ChevronRightIcon, CoinIcon } from "./Icons.js";

/**
 * Final ekranında "+N Glix" özeti. Dokununca dökümü açılır ("Maç +10", "2. oldun +10", ...). Veri sunucunun
 * `glixEarned` mesajından gelir; mesaj yoksa hiçbir şey çizilmez. Günlük sınır dolduysa kısa bir not görünür.
 */
export function GlixSummary(props: { place: number | null }) {
  const [open, setOpen] = createSignal(false);
  const lines = createMemo(() => {
    const g = glixEarned();
    return g ? glixLines(g, props.place, (id) => badgeNames()[id]) : [];
  });
  return (
    <Show when={glixEarned()}>
      {(g) => (
        <section class="glx rise" style={{ "--i": 5 }} aria-label="Kazandığın Glix">
          <Show when={g().total > 0}>
            <button
              type="button"
              class="glx__bar"
              aria-expanded={open()}
              aria-controls="glx-list"
              onClick={() => setOpen(!open())}
            >
              <CoinIcon size={28} />
              <span class="glx__total">{glixText(g().total)}</span>
              <span class="glx__hint">{open() ? "Gizle" : "Ayrıntı"}</span>
              <ChevronRightIcon size={18} class="glx__chev" />
            </button>
            <ul id="glx-list" class="glx__list" hidden={!open()}>
              <For each={lines()}>
                {(l) => (
                  <li class="glx__line">
                    <span>{l.label}</span>
                    <b>+{l.amount}</b>
                  </li>
                )}
              </For>
            </ul>
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
