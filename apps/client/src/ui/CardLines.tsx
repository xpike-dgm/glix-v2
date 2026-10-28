import { CARDS, type CardsPublic, type PlayerInfo } from "@glix/engine";
import { For, Show } from "solid-js";
import { GemMark } from "./CardFace.js";
import { describeLine, lineSentence } from "./cards.js";

/** Sonuç ekranı: bu oyunda işleyen kartlar ve puana etkisi ("Çift Puan: +2 → +4"). Satır yoksa hiçbir şey çizilmez. */
export function CardLines(props: {
  cards: CardsPublic | null | undefined;
  players: readonly PlayerInfo[];
  big?: boolean;
  /** En çok kaç satır gösterilir (TV); fazlası "+N kart etkisi daha" olur. */
  limit?: number;
}) {
  const nick = (id: string): string => props.players.find((p) => p.id === id)?.nickname ?? "";
  const all = () => props.cards?.lines ?? [];
  const lines = () => (props.limit === undefined ? all() : all().slice(0, props.limit));
  const hidden = () => all().length - lines().length;
  return (
    <Show when={lines().length > 0}>
      <section class="kc-lines" data-big={props.big ? "1" : undefined} aria-label="Kart etkileri">
        <p class="overline">Kart etkileri</p>
        <ul class="kc-lines__list">
          <For each={lines()}>
            {(l) => {
              const t = () => describeLine(l, nick);
              return (
                <li
                  class="kc-line"
                  data-r={CARDS[l.cardId].rarity}
                  data-tone={t().tone}
                  aria-label={lineSentence(l, nick)}
                >
                  <GemMark rarity={CARDS[l.cardId].rarity} size={props.big ? 22 : 14} />
                  <span class="kc-line__what">
                    <b>{t().card}</b>
                    <span>{t().to ? `${t().who} → ${t().to}` : t().who}</span>
                  </span>
                  <span class="kc-line__delta">{t().text}</span>
                </li>
              );
            }}
          </For>
        </ul>
        <Show when={hidden() > 0}>
          <p class="kc-lines__more">+{hidden()} kart etkisi daha</p>
        </Show>
      </section>
    </Show>
  );
}
