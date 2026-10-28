import type { CardsPublic, PlayerInfo } from "@glix/engine";
import { CARDS } from "@glix/engine";
import { For, Show } from "solid-js";
import { Avatar } from "./Avatar.js";
import { GemMark } from "./CardFace.js";
import { badSentence, playSentence } from "./cards.js";

const nickOf = (players: readonly PlayerInfo[]) => (id: string) =>
  players.find((p) => p.id === id)?.nickname ?? "";

/** Kötü kart duyurusu (K3.4): "Elif kötü kart çekti: Talihsizlik". Telefonlarda ve TV'de aynı bileşen. */
export function BadCardNotice(props: {
  cards: CardsPublic | null | undefined;
  players: readonly PlayerInfo[];
  big?: boolean;
}) {
  const list = () => props.cards?.announce ?? [];
  return (
    <Show when={list().length > 0}>
      <ul class="kc-bad" data-big={props.big ? "1" : undefined} aria-label="Kötü kartlar">
        <For each={list()}>
          {(a) => (
            <li class="kc-bad__row">
              <GemMark rarity="kotu" size={props.big ? 26 : 16} />
              <span>{badSentence(nickOf(props.players)(a.playerId), a.cardId)}</span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

/**
 * Oyun başında kartların açıklanması (K4.3): kim hangi kartı oynadı. Gizli Ayna / Koruma yoktur. Her satır sırayla
 * belirir (hareket azaltmada hepsi birden).
 */
export function CardReveal(props: {
  cards: CardsPublic | null | undefined;
  players: readonly PlayerInfo[];
  gameName: (id: string) => string;
  big?: boolean;
}) {
  const plays = () => props.cards?.plays ?? [];
  const nick = nickOf(props.players);
  return (
    <Show when={plays().length > 0}>
      <ul class="kc-reveal" data-big={props.big ? "1" : undefined} aria-label="Oynanan kartlar" role="status">
        <For each={plays()}>
          {(p, i) => {
            const player = () => props.players.find((x) => x.id === p.playerId);
            return (
              <li
                class="kc-reveal__row"
                data-r={CARDS[p.cardId].rarity}
                data-void={p.void ? "1" : undefined}
                style={{ "--i": i() }}
              >
                <Show when={player()}>
                  {(pl) => (
                    <Avatar index={pl().avatar} size={props.big ? 56 : 36} connected={pl().connected} />
                  )}
                </Show>
                <span class="kc-reveal__text">
                  <b>{CARDS[p.cardId].name}</b>
                  <span>{playSentence(p, nick, props.gameName)}</span>
                </span>
                <GemMark rarity={CARDS[p.cardId].rarity} size={props.big ? 22 : 14} />
              </li>
            );
          }}
        </For>
      </ul>
    </Show>
  );
}
