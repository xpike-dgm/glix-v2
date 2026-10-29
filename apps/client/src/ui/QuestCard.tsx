import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { balanceText } from "../net/glixRules.js";
import { questCountText, questProgressText, questResetText } from "../net/questRules.js";
import { loadQuests, quests } from "../net/quests.js";
import { formatCountdown } from "../net/shopRules.js";
import { CoinIcon } from "./Icons.js";

/**
 * Ana sayfada kompakt "Günlük görevler" kartı (yalnız hesaplı oyuncu, anahtar açıksa). Kapalıyken ya da veri
 * gelmediyse hiçbir şey çizilmez. Geri sayım İstanbul gece yarısına (sunucu saatiyle); sıfırlanınca görevler yenilenir.
 */
export function QuestCard() {
  const [now, setNow] = createSignal(Date.now());
  const open = createMemo(() => {
    const s = quests();
    return s?.enabled ? s : null;
  });
  const left = () => {
    const q = open();
    return q ? q.endsAt - (now() + q.clockOffset) : 1;
  };
  let reloadedAt = 0;
  createEffect(() => {
    if (left() <= 0 && now() - reloadedAt > 5000) {
      reloadedAt = now();
      void loadQuests();
    }
  });
  onMount(() => {
    void loadQuests();
    const t = setInterval(() => setNow(Date.now()), 1000);
    onCleanup(() => clearInterval(t));
  });
  return (
    <Show when={open()}>
      {(q) => {
        return (
          <section class="qst" aria-label="Günlük görevler">
            <header class="qst__head">
              <h2 class="qst__title">
                Günlük görevler <span class="qst__count">{questCountText(q().quests)}</span>
              </h2>
              <span class="qst__left">{questResetText(formatCountdown(left()))}</span>
            </header>
            <ul class="qst__list">
              <For each={q().quests}>
                {(quest) => (
                  <li class="qst__row" classList={{ "qst__row--done": quest.done }}>
                    <span class="qst__text">{quest.text}</span>
                    <span class="qst__num">{questProgressText(quest)}</span>
                    <span class="qst__reward">
                      <CoinIcon size={14} />
                      {quest.done ? "Tamam" : `+${balanceText(quest.reward)}`}
                    </span>
                    <span
                      class="qst__bar"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={quest.target}
                      aria-valuenow={quest.progress}
                      aria-label={quest.text}
                    >
                      <span
                        class="qst__fill"
                        style={{ transform: `scaleX(${quest.progress / quest.target})` }}
                      />
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </section>
        );
      }}
    </Show>
  );
}
