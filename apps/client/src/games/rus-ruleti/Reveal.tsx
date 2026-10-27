import { createMemo, For, onMount, Show } from "solid-js";
import { hapticMatch, hapticSolo } from "../../fx/haptics.js";
import { match as matchSound, solo as soloSound } from "../../fx/sound.js";
import { Avatar } from "../../ui/Avatar.js";
import type { GameScreenProps } from "../registry.js";
import "./rus-ruleti.css";
import { parseRusRuletiPublicView } from "./view.js";

/** Sonuç ekranının üstüne giren kısa açılış: hayatta kalanlar altın halkayla +1, elenenler sönük. */
export default function Reveal(props: GameScreenProps) {
  const result = createMemo(() => parseRusRuletiPublicView(props.match.publicView)?.result ?? null);
  const person = (id: string) => props.players.find((p) => p.id === id);
  const mineAlive = () => result()?.survivors.includes(props.selfId) ?? false;
  onMount(() => {
    if (!result() || props.spectator) return;
    if (mineAlive()) {
      matchSound();
      hapticMatch();
    } else {
      soloSound();
      hapticSolo();
    }
  });
  return (
    <Show when={result()}>
      {(r) => (
        <section class="rrr rise" aria-label="Rus Ruleti sonucu">
          <h2 class="rrr__head">{r().survivors.length === 1 ? "Tek hayatta kalan" : "Hayatta kalanlar"}</h2>
          <ul class="rrr__row">
            <For each={r().survivors}>
              {(id) => (
                <li class="rrr__card">
                  <Show when={person(id)}>
                    {(p) => (
                      <Avatar index={p().avatar} size={44} connected={p().connected} ring="var(--amber)" />
                    )}
                  </Show>
                  <span class="rrr__pts">+1</span>
                  <span class="sr-only">{person(id)?.nickname}</span>
                </li>
              )}
            </For>
          </ul>
          <Show when={r().kahinler.length > 0}>
            <ul class="rrr__row rrr__row--kahin" aria-label="Kâhin rozeti">
              <For each={r().kahinler}>
                {(id) => (
                  <li class="rrr__kahin">
                    <Show when={person(id)}>
                      {(p) => <Avatar index={p().avatar} size={30} mood="out" connected={p().connected} />}
                    </Show>
                    <span class="rrr__rozet">{person(id)?.nickname} · Kâhin</span>
                    <span class="sr-only">{person(id)?.nickname} Kâhin rozeti kazandı</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <ul class="rrr__row rrr__row--out">
            <For each={r().eliminated}>
              {(id) => (
                <li class="rrr__gone">
                  <Show when={person(id)}>
                    {(p) => <Avatar index={p().avatar} size={30} mood="out" connected={p().connected} />}
                  </Show>
                  <span class="sr-only">{person(id)?.nickname} elendi</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      )}
    </Show>
  );
}
