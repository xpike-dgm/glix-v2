import type { KendimReveal } from "@glix/engine";
import { For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import type { Crew } from "./KendimScreen.js";
import { outcomeOf, signed, wordLen } from "./view.js";

interface Props {
  reveal: KendimReveal;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

/** Açılış: kartların sahipleri ve onları bulanlar, sonra mini oyun puanları. */
export function Sonuc(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const myPair = (card: number) => props.reveal.pairs[props.selfId]?.find((p) => p.card === card);
  const ranking = () =>
    [...props.crew].sort((a, b) => (props.reveal.scores[b.id] ?? 0) - (props.reveal.scores[a.id] ?? 0));
  const verdict = (): string => {
    const o = mine();
    if (o.right + o.wrong === 0) return o.bonus ? "Kelimeni biri buldu" : "Eşleştirme yapmadın";
    if (o.wrong === 0) return o.right === 1 ? "Doğru bildin!" : `${o.right} doğru, hiç yanlış yok!`;
    return `${o.right} doğru, ${o.wrong} yanlış`;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  onMount(() => {
    if (props.spectator) return;
    timer = setTimeout(() => {
      if (mine().total > 0) {
        matchSound();
        hapticMatch();
      } else {
        soloSound();
        hapticSolo();
      }
    }, 900);
  });
  return (
    <>
      <div class="kd__head kd__head--res">
        <Show when={!props.spectator} fallback={<span class="kd__title">Kartlar açıldı</span>}>
          <span
            class="kd__score"
            data-neg={mine().total < 0 ? "1" : undefined}
            data-zero={mine().total === 0 ? "1" : undefined}
          >
            {signed(mine().total)}
          </span>
          <span class="kd__verdict">{verdict()}</span>
        </Show>
      </div>

      <div class="kd__results" data-scroll>
        <ul class="kd__rcards">
          <For each={props.reveal.cards}>
            {(card, i) => {
              const owner = () => member(card.owner);
              const my = () => myPair(card.id);
              return (
                <li
                  class="kd__rcard"
                  data-me={card.owner === props.selfId ? "1" : undefined}
                  data-mine={my() ? (my()?.ok ? "ok" : "bad") : undefined}
                  style={{ "--i": i() }}
                >
                  <span
                    class="kd__rword"
                    data-long={wordLen(card.text) > 7 ? "1" : undefined}
                    style={{ "--len": wordLen(card.text) }}
                  >
                    {card.text}
                  </span>
                  <span class="kd__rowner">
                    <Avatar index={owner()?.avatar ?? 0} size={30} ring="var(--lime)" />
                    <span class="kd__rname">{owner()?.nickname ?? "?"}</span>
                  </span>
                  <Show when={card.bonus}>
                    <span class="kd__bonus">+1</span>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>

        <ul class="kd__rank">
          <For each={ranking()}>
            {(m, i) => {
              const total = () => props.reveal.scores[m.id] ?? 0;
              const won = () => props.reveal.winners.includes(m.id);
              return (
                <li class="kd__rrow" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
                  <Avatar index={m.avatar} size={32} connected={m.connected} />
                  <span class="kd__rrow-name">{m.nickname}</span>
                  <Show when={won()}>
                    <span class="kd__crown">+1</span>
                  </Show>
                  <span
                    class="kd__pts"
                    data-neg={total() < 0 ? "1" : undefined}
                    data-zero={total() === 0 ? "1" : undefined}
                  >
                    {signed(total())}
                  </span>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
    </>
  );
}
