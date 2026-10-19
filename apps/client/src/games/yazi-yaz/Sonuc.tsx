import type { YaziYazReveal } from "@glix/engine";
import { For, onCleanup, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import { CheckIcon } from "../../ui/Icons.js";
import { outcomeOf } from "./view.js";
import type { Crew } from "./YaziYazScreen.js";

interface Props {
  reveal: YaziYazReveal;
  crew: Crew[];
  selfId: string;
  spectator: boolean;
}

const Cross = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" />
  </svg>
);

/** Açılış: iki yazan ve kelimeleri neon panoda, ardından herkesin tahmini ve puanı. */
export function Sonuc(props: Props) {
  const member = (id: string) => props.crew.find((m) => m.id === id);
  const mine = () => outcomeOf(props.reveal, props.selfId);
  const verdict = (): string => {
    const o = mine();
    if (o.personOk === null) return "Tahmin vermedin";
    if (o.personOk && o.wordOk) return "Tam isabet!";
    if (o.personOk) return o.wordOk === null ? "Yazanı buldun" : "Yazanı buldun, kelime tutmadı";
    return "Bu sefer olmadı";
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  onMount(() => {
    if (props.spectator) return;
    timer = setTimeout(() => {
      if (mine().points > 0) {
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
      <div class="yy__head yy__head--res">
        <Show when={!props.spectator} fallback={<span class="yy__title">Yazanlar belli oldu</span>}>
          <span class="yy__score" data-zero={mine().points === 0 ? "1" : undefined}>
            +{mine().points}
          </span>
          <span class="yy__verdict">{verdict()}</span>
        </Show>
      </div>

      <div class="yy__signs">
        <For each={props.reveal.writers}>
          {(id, i) => (
            <div class="yy__card" style={{ "--i": i() }}>
              <Avatar index={member(id)?.avatar ?? 0} size={44} ring="var(--magenta)" />
              <span class="yy__card-name">{member(id)?.nickname ?? "?"}</span>
              <span class="yy__card-word" data-empty={props.reveal.words[id] ? undefined : "1"}>
                {props.reveal.words[id] || "—"}
              </span>
            </div>
          )}
        </For>
      </div>

      <ul class="yy__rows" data-scroll>
        <For each={props.crew}>
          {(m, i) => {
            const g = () => props.reveal.guesses[m.id];
            const pts = () => props.reveal.scores[m.id] ?? 0;
            const target = () => (g()?.target ? member(g()?.target as string) : undefined);
            return (
              <li class="yy__row" data-me={m.id === props.selfId ? "1" : undefined} style={{ "--i": i() }}>
                <Avatar index={m.avatar} size={32} connected={m.connected} />
                <span class="yy__row-name">{m.nickname}</span>
                <Show when={g()?.target} fallback={<span class="yy__none">tahmin yok</span>}>
                  <span class="yy__pick" data-ok={g()?.personOk ? "1" : "0"}>
                    <Avatar index={target()?.avatar ?? 0} size={24} />
                    {g()?.personOk ? <CheckIcon size={14} /> : <Cross />}
                  </span>
                  <Show when={g()?.word}>
                    <span class="yy__guess" data-ok={g()?.wordOk ? "1" : "0"}>
                      <span class="yy__guess-text">{g()?.word}</span>
                      {g()?.wordOk ? <CheckIcon size={14} /> : <Cross />}
                    </span>
                  </Show>
                </Show>
                <span class="yy__pts" data-zero={pts() === 0 ? "1" : undefined}>
                  +{pts()}
                </span>
              </li>
            );
          }}
        </For>
      </ul>
    </>
  );
}
